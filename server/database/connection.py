import logging
import time
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from bson import ObjectId
from datetime import datetime, timedelta
from config import Config

logger = logging.getLogger(__name__)

# Global variables for connection state
_mongo_client = None
_db_instance = None
_is_demo = False

class MockCursor:
    """Mock PyMongo Cursor for in-memory database fallback."""
    def __init__(self, data):
        self._data = data
        self._sort_key = None
        self._sort_dir = 1
        self._skip = 0
        self._limit = None

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, list):
            self._sort_key = key_or_list[0][0]
            self._sort_dir = key_or_list[0][1]
        else:
            self._sort_key = key_or_list
            self._sort_dir = direction
        
        # Sort key logic
        def sort_fn(x):
            val = x.get(self._sort_key)
            # Handle objectId comparison safely
            if isinstance(val, ObjectId):
                return str(val)
            if val is None:
                return ""
            return val

        self._data.sort(key=sort_fn, reverse=(self._sort_dir == -1))
        return self

    def skip(self, count):
        self._skip = count
        return self

    def limit(self, count):
        self._limit = count
        return self

    def __iter__(self):
        start = self._skip
        end = len(self._data) if self._limit is None else start + self._limit
        for item in self._data[start:end]:
            yield item

    def __getitem__(self, index):
        return list(self)[index]

class MockCollection:
    """Mock PyMongo Collection for in-memory operations."""
    def __init__(self, name):
        self.name = name
        self._documents = []

    def _matches(self, doc, query):
        if not query:
            return True
        for key, val in query.items():
            if key == "_id" and isinstance(val, (str, ObjectId)):
                if str(doc.get("_id")) != str(val):
                    return False
            elif key == "$or":
                # list of subqueries
                sub_match = False
                for subq in val:
                    if self._matches(doc, subq):
                        sub_match = True
                        break
                if not sub_match:
                    return False
            elif isinstance(val, dict):
                # operator query like $gte, $lte, $regex
                doc_val = doc.get(key)
                for op, op_val in val.items():
                    if op == "$gte":
                        if doc_val is None or doc_val < op_val:
                            return False
                    elif op == "$lte":
                        if doc_val is None or doc_val > op_val:
                            return False
                    elif op == "$gt":
                        if doc_val is None or doc_val <= op_val:
                            return False
                    elif op == "$lt":
                        if doc_val is None or doc_val >= op_val:
                            return False
                    elif op == "$regex":
                        import re
                        flags = 0
                        if "$options" in val and "i" in val["$options"]:
                            flags = re.IGNORECASE
                        if doc_val is None or not re.search(op_val, str(doc_val), flags):
                            return False
                    elif op == "$in":
                        if doc_val not in op_val:
                            return False
            else:
                if doc.get(key) != val:
                    return False
        return True

    def find_one(self, filter_query=None, projection=None):
        filter_query = filter_query or {}
        # Clean up TTL expired documents first
        self._clean_expired()
        
        for doc in self._documents:
            if self._matches(doc, filter_query):
                return self._apply_projection(doc, projection)
        return None

    def find(self, filter_query=None, projection=None):
        filter_query = filter_query or {}
        self._clean_expired()
        
        matched_docs = [self._apply_projection(doc, projection) for doc in self._documents if self._matches(doc, filter_query)]
        return MockCursor(matched_docs)

    def insert_one(self, document):
        if "_id" not in document:
            document["_id"] = ObjectId()
        if "created_at" not in document:
            document["created_at"] = datetime.utcnow()
        
        # Check unique constraint for email on users collection
        if self.name == "users" and "email" in document:
            existing = self.find_one({"email": document["email"]})
            if existing:
                from pymongo.errors import DuplicateKeyError
                raise DuplicateKeyError(f"E11000 duplicate key error collection: {self.name} index: email_1 dup key: {document['email']}")

        self._documents.append(document)
        class InsertOneResult:
            inserted_id = document["_id"]
        return InsertOneResult()

    def insert_many(self, documents):
        inserted_ids = []
        for document in documents:
            if "_id" not in document:
                document["_id"] = ObjectId()
            if "created_at" not in document:
                document["created_at"] = datetime.utcnow()
            self._documents.append(document)
            inserted_ids.append(document["_id"])
        
        class InsertManyResult:
            def __init__(self, ids):
                self.inserted_ids = ids
        return InsertManyResult(inserted_ids)

    def update_one(self, filter_query, update, upsert=False):
        self._clean_expired()
        
        doc = None
        for d in self._documents:
            if self._matches(d, filter_query):
                doc = d
                break
        
        if not doc:
            if upsert:
                # Basic upsert implementation
                new_doc = {}
                # Extract simple equality fields from filter
                for k, v in filter_query.items():
                    if not k.startswith("$") and not isinstance(v, dict):
                        new_doc[k] = v
                self.insert_one(new_doc)
                doc = new_doc
            else:
                class UpdateResult:
                    matched_count = 0
                    modified_count = 0
                return UpdateResult()

        # Apply update operators
        modified = False
        if "$set" in update:
            for k, v in update["$set"].items():
                doc[k] = v
            modified = True
        if "$inc" in update:
            for k, v in update["$inc"].items():
                doc[k] = doc.get(k, 0) + v
            modified = True
        if "$unset" in update:
            for k in update["$unset"]:
                if k in doc:
                    del doc[k]
            modified = True

        class UpdateResult:
            matched_count = 1
            modified_count = 1 if modified else 0
        return UpdateResult()

    def delete_one(self, filter_query):
        self._clean_expired()
        for idx, doc in enumerate(self._documents):
            if self._matches(doc, filter_query):
                self._documents.pop(idx)
                class DeleteResult:
                    deleted_count = 1
                return DeleteResult()
        class DeleteResult:
            deleted_count = 0
        return DeleteResult()

    def delete_many(self, filter_query=None):
        filter_query = filter_query or {}
        self._clean_expired()
        initial_count = len(self._documents)
        self._documents = [d for d in self._documents if not self._matches(d, filter_query)]
        deleted = initial_count - len(self._documents)
        class DeleteResult:
            deleted_count = deleted
        return DeleteResult()

    def count_documents(self, filter_query=None):
        filter_query = filter_query or {}
        self._clean_expired()
        return sum(1 for d in self._documents if self._matches(d, filter_query))

    def aggregate(self, pipeline):
        # We manually process custom dashboard stats aggregates
        self._clean_expired()
        
        if self.name == "prediction_history":
            # Check pipeline content to know what stats are requested
            # Let's write a robust parser for dashboard stats
            stats = {
                "total_predictions": len(self._documents),
                "total_customers": len(self._documents), # Each prediction represents a customer
                "high_risk": sum(1 for d in self._documents if d.get("risk_level") == "High"),
                "low_risk": sum(1 for d in self._documents if d.get("risk_level") == "Low"),
                "churn_count": sum(1 for d in self._documents if d.get("prediction") == "Churn"),
                "non_churn_count": sum(1 for d in self._documents if d.get("prediction") != "Churn"),
                "avg_probability": sum(d.get("probability", 0.0) for d in self._documents) / max(len(self._documents), 1),
            }
            
            # Grouping by feature contribution
            features_dict = {}
            for d in self._documents:
                for tf in d.get("top_features", []):
                    f_name = tf.get("feature")
                    f_impact = abs(tf.get("impact", 0.0))
                    features_dict[f_name] = features_dict.get(f_name, 0.0) + f_impact
            
            top_feature = max(features_dict, key=features_dict.get) if features_dict else "N/A"
            stats["top_feature"] = top_feature

            # In aggregation pipeline, the server expects results in lists
            # We will mock the returns depending on query structure.
            # Usually, predictions.py needs to query list of dicts. We will return [stats] or specific outputs
            return [stats]
            
        return []

    def _clean_expired(self):
        """Remove expired OTPs (TTL Sim)."""
        if self.name == "otp_verifications":
            now = datetime.utcnow()
            self._documents = [d for d in self._documents if d.get("expires_at", now) > now]

    def _apply_projection(self, doc, projection):
        if not projection:
            return doc.copy()
        new_doc = {}
        # standard inclusion projection (e.g. {"password_hash": 0} or {"email": 1})
        exclude_mode = any(v == 0 for v in projection.values())
        if exclude_mode:
            new_doc = doc.copy()
            for k, v in projection.items():
                if v == 0 and k in new_doc:
                    new_doc.pop(k)
        else:
            # inclusion mode
            # always include _id unless explicitly excluded
            if "_id" not in projection or projection["_id"] != 0:
                new_doc["_id"] = doc.get("_id")
            for k, v in projection.items():
                if v == 1 and k != "_id" and k in doc:
                    new_doc[k] = doc[k]
        return new_doc

class MockDatabase:
    """Mock PyMongo Database."""
    def __init__(self):
        self._collections = {}

    def __getattr__(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection(name)
        return self._collections[name]

    def __getitem__(self, name):
        return self.__getattr__(name)

def init_db():
    """Initializes the database connection. Fallbacks to in-memory mock database if MongoDB is down."""
    global _mongo_client, _db_instance, _is_demo
    
    if Config.DEMO_MODE:
        logger.warning("DEMO_MODE is enabled in configuration. Running with In-Memory Mock Database.")
        _db_instance = MockDatabase()
        _is_demo = True
        return _db_instance

    try:
        logger.info(f"Connecting to MongoDB at {Config.MONGO_URI}...")
        # 3 second timeout for quick fallback detection
        _mongo_client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=3000)
        # Check connection
        _mongo_client.server_info()
        
        # Extract database name from URI, default to 'churn_db'
        db_name = Config.MONGO_URI.split("/")[-1]
        if "?" in db_name:
            db_name = db_name.split("?")[0]
        if not db_name:
            db_name = "churn_db"

        _db_instance = _mongo_client[db_name]
        _is_demo = False
        
        # Configure Indexes
        logger.info("Configuring MongoDB indexes...")
        _db_instance.users.create_index("email", unique=True)
        # TTL Index: expire after 0 seconds relative to the expires_at field
        _db_instance.otp_verifications.create_index("expires_at", expireAfterSeconds=0)
        # Compound index for fast prediction lookups
        _db_instance.prediction_history.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        _db_instance.batch_predictions.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        _db_instance.batch_prediction_results.create_index([("batch_id", ASCENDING)])
        
        logger.info("MongoDB initialized successfully with indexes.")
        
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.critical(f"MongoDB connection failed: {e}. Falling back to In-Memory Mock Database!")
        _db_instance = MockDatabase()
        _is_demo = True
        
    return _db_instance

def get_db():
    """Gets the database instance. Runs init_db if not initialized yet."""
    global _db_instance
    if _db_instance is None:
        return init_db()
    return _db_instance

def is_demo_mode():
    """Check if database layer is running in Mock Mode."""
    return _is_demo
