from bson import ObjectId
from datetime import datetime
from database.connection import get_db

def create_batch(user_id, file_name, total_records):
    """Creates a new batch document with Pending/Processing status."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        return None
        
    batch_doc = {
        "user_id": user_obj_id,
        "file_name": file_name,
        "total_records": int(total_records),
        "processed_records": 0,
        "status": "Processing",
        "created_at": datetime.utcnow(),
        "completed_at": None
    }
    
    result = db.batch_predictions.insert_one(batch_doc)
    batch_doc["_id"] = result.inserted_id
    return batch_doc

def add_batch_results(batch_id, results_list):
    """Bulk inserts a list of individual predictions linked by batch_id."""
    if not results_list:
        return True
        
    db = get_db()
    try:
        batch_obj_id = ObjectId(batch_id) if isinstance(batch_id, str) else batch_id
    except Exception:
        return False
        
    # Map results list to include batch_id
    documents = []
    for r in results_list:
        documents.append({
            "batch_id": batch_obj_id,
            "customer_number": r["customer_number"],
            "input_data": r["input_data"],
            "prediction": r["prediction"],
            "probability": float(r["probability"]),
            "risk_level": r["risk_level"],
            "top_features": r["top_features"]
        })
        
    db.batch_prediction_results.insert_many(documents)
    return True

def update_batch_status(batch_id, status, processed_records=None):
    """Updates the status and processed count of a batch."""
    db = get_db()
    try:
        batch_obj_id = ObjectId(batch_id) if isinstance(batch_id, str) else batch_id
    except Exception:
        return False
        
    update_fields = {
        "status": status
    }
    if processed_records is not None:
        update_fields["processed_records"] = int(processed_records)
    if status in ("Completed", "Failed"):
        update_fields["completed_at"] = datetime.utcnow()
        
    result = db.batch_predictions.update_one(
        {"_id": batch_obj_id},
        {"$set": update_fields}
    )
    return result.modified_count > 0

def get_batch_details(user_id, batch_id):
    """Fetches details of a batch and all its associated results."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        batch_obj_id = ObjectId(batch_id) if isinstance(batch_id, str) else batch_id
    except Exception:
        return None
        
    batch = db.batch_predictions.find_one({"_id": batch_obj_id, "user_id": user_obj_id})
    if not batch:
        return None
        
    # Fetch results
    results_cursor = db.batch_prediction_results.find({"batch_id": batch_obj_id})
    results = []
    for r in results_cursor:
        r["_id"] = str(r["_id"])
        r["batch_id"] = str(r["batch_id"])
        results.append(r)
        
    batch["_id"] = str(batch["_id"])
    batch["user_id"] = str(batch["user_id"])
    batch["results"] = results
    return batch

def delete_batch(user_id, batch_id):
    """Deletes the batch prediction metadata and cascaded results."""
    db = get_db()
    try:
        user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
        batch_obj_id = ObjectId(batch_id) if isinstance(batch_id, str) else batch_id
    except Exception:
        return False
        
    # Make sure the batch belongs to the user
    batch = db.batch_predictions.find_one({"_id": batch_obj_id, "user_id": user_obj_id})
    if not batch:
        return False
        
    # Delete results first
    db.batch_prediction_results.delete_many({"batch_id": batch_obj_id})
    # Delete metadata record
    db.batch_predictions.delete_one({"_id": batch_obj_id})
    return True
