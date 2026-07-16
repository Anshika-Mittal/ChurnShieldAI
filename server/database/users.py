from bson import ObjectId
from datetime import datetime
from database.connection import get_db

def create_user(name, email, password_hash, google_auth=False, verified=False, profile_image=""):
    """Inserts a new user record in the users collection."""
    db = get_db()
    user_doc = {
        "name": name,
        "email": email.strip().lower(),
        "password_hash": password_hash,
        "google_auth": google_auth,
        "verified": verified,
        "profile_image": profile_image,
        "created_at": datetime.utcnow(),
        "last_login": datetime.utcnow()
    }
    
    result = db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id
    return user_doc

def find_user_by_email(email):
    """Finds a user by email address."""
    db = get_db()
    return db.users.find_one({"email": email.strip().lower()})

def find_user_by_id(user_id):
    """Finds a user by ObjectId. Sanitizes password_hash from projection."""
    if not user_id:
        return None
    
    try:
        obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        return None
        
    db = get_db()
    return db.users.find_one({"_id": obj_id}, {"password_hash": 0})

def update_profile(user_id, name=None, profile_image=None):
    """Updates user name or profile image."""
    try:
        obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        return False
        
    update_fields = {}
    if name is not None:
        update_fields["name"] = name
    if profile_image is not None:
        update_fields["profile_image"] = profile_image
        
    if not update_fields:
        return True
        
    db = get_db()
    result = db.users.update_one({"_id": obj_id}, {"$set": update_fields})
    return result.matched_count > 0

def update_last_login(user_id):
    """Updates the last_login timestamp on successful login."""
    try:
        obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    except Exception:
        return False
        
    db = get_db()
    result = db.users.update_one(
        {"_id": obj_id},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    return result.modified_count > 0

def verify_user_email(email):
    """Marks a user account as email verified."""
    db = get_db()
    result = db.users.update_one(
        {"email": email.strip().lower()},
        {"$set": {"verified": True}}
    )
    return result.modified_count > 0
