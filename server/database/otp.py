from datetime import datetime, timedelta
from database.connection import get_db

def save_otp(email, otp, expires_in_minutes=5):
    """Saves a verification OTP for the email, replacing any existing ones."""
    db = get_db()
    email_clean = email.strip().lower()
    
    # Remove any existing OTP for this email
    db.otp_verifications.delete_many({"email": email_clean})
    
    now = datetime.utcnow()
    otp_doc = {
        "email": email_clean,
        "otp": str(otp),
        "created_at": now,
        "expires_at": now + timedelta(minutes=expires_in_minutes),
        "attempts": 0
    }
    
    db.otp_verifications.insert_one(otp_doc)
    return otp_doc

def find_otp(email):
    """Retrieves an active (unexpired) OTP document."""
    db = get_db()
    email_clean = email.strip().lower()
    
    # Query for unexpired OTP
    now = datetime.utcnow()
    return db.otp_verifications.find_one({
        "email": email_clean,
        "expires_at": {"$gt": now}
    })

def increment_attempts(email):
    """Increments the entry verification attempt count for an OTP."""
    db = get_db()
    email_clean = email.strip().lower()
    
    result = db.otp_verifications.update_one(
        {"email": email_clean},
        {"$inc": {"attempts": 1}}
    )
    return result.modified_count > 0

def delete_otp(email):
    """Deletes all OTP verification records for the email."""
    db = get_db()
    email_clean = email.strip().lower()
    result = db.otp_verifications.delete_many({"email": email_clean})
    return result.deleted_count > 0
