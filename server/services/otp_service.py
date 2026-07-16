import random
import logging
from datetime import datetime, timedelta
from database.otp import save_otp, find_otp, delete_otp, increment_attempts
from services.email_service import send_otp_email

logger = logging.getLogger(__name__)

def generate_otp():
    """Generates a secure 6-digit random number."""
    return str(random.randint(100000, 999999))

def generate_and_send_otp(email):
    """Generates, saves, and emails a 6-digit OTP code to the user."""
    email_clean = email.strip().lower()
    
    # Check cooldown before sending
    can_resend, remaining_seconds = check_resend_cooldown(email_clean)
    if not can_resend:
        return False, f"Please wait {remaining_seconds} seconds before requesting a new OTP."
        
    otp = generate_otp()
    try:
        # Save OTP to DB
        save_otp(email_clean, otp, expires_in_minutes=5)
        # Send Email
        sent = send_otp_email(email_clean, otp)
        if sent:
            return True, "Verification code sent to your email."
        else:
            return False, "Failed to send verification email. Please try again."
    except Exception as e:
        logger.error(f"Error in generate_and_send_otp for {email_clean}: {e}")
        return False, "An unexpected error occurred. Please try again."

def verify_otp_code(email, code):
    """Verifies the code against the database. Tracks attempts and enforces constraints."""
    email_clean = email.strip().lower()
    otp_doc = find_otp(email_clean)
    
    if not otp_doc:
        return False, "OTP has expired or does not exist. Please request a new code."
        
    attempts = otp_doc.get("attempts", 0)
    if attempts >= 5:
        # Delete OTP to force resending
        delete_otp(email_clean)
        return False, "Maximum verification attempts exceeded. Please request a new OTP."
        
    # Increment attempts
    increment_attempts(email_clean)
    
    if otp_doc["otp"] == str(code).strip():
        # Clean up database entry
        delete_otp(email_clean)
        return True, "Email verified successfully."
    else:
        remaining_attempts = 5 - (attempts + 1)
        if remaining_attempts <= 0:
            delete_otp(email_clean)
            return False, "Too many incorrect attempts. This OTP has been invalidated."
        return False, f"Invalid verification code. {remaining_attempts} attempts remaining."

def check_resend_cooldown(email):
    """Checks if the email is allowed to receive a new OTP or is still on cooldown (60 seconds)."""
    email_clean = email.strip().lower()
    otp_doc = find_otp(email_clean)
    
    if not otp_doc:
        return True, 0
        
    created_at = otp_doc.get("created_at")
    if not created_at:
        return True, 0
        
    time_diff = datetime.utcnow() - created_at
    if time_diff < timedelta(seconds=60):
        remaining = 60 - int(time_diff.total_seconds())
        return False, remaining
        
    return True, 0
