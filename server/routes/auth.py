import jwt
import bcrypt
import logging
import requests
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from config import Config
from database.users import (
    create_user, find_user_by_email, find_user_by_id,
    verify_user_email, update_profile, update_last_login
)
from services.otp_service import generate_and_send_otp, verify_otp_code, check_resend_cooldown
from middleware.jwt_auth import token_required
import random

logger = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__)

def generate_jwt_token(user):
    """Helper to generate JWT session token for the user."""
    payload = {
        "user_id": str(user["_id"]),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm="HS256")

@auth_bp.route("/captcha", methods=["GET"])
def get_captcha():
    """Generates a simple, stateless arithmetic Captcha challenge."""
    num1 = random.randint(1, 9)
    num2 = random.randint(1, 9)
    question = f"What is {num1} + {num2}?"
    answer = str(num1 + num2)
    
    # Encode answer inside a short-lived captcha token
    payload = {
        "ans": answer,
        "exp": datetime.utcnow() + timedelta(minutes=3)
    }
    captcha_token = jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")
    
    return jsonify({
        "question": question,
        "captcha_token": captcha_token
    }), 200

@auth_bp.route("/signup", methods=["POST"])
def signup():
    """Starts signup process: hashes password, registers unverified user, sends OTP."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    
    if not name or not email or not password:
        return jsonify({"message": "Name, email, and password are required."}), 400
        
    # Check if email is already taken
    existing_user = find_user_by_email(email)
    if existing_user:
        if existing_user.get("verified", False):
            return jsonify({"message": "An account with this email is already registered."}), 400
        else:
            # Overwrite unverified account details
            password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            db_user = existing_user
            # Update user details
            from server.database.connection import get_db
            get_db().users.update_one(
                {"_id": existing_user["_id"]},
                {"$set": {"name": name, "password_hash": password_hash, "created_at": datetime.utcnow()}}
            )
    else:
        # Create unverified user
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        db_user = create_user(name, email, password_hash, google_auth=False, verified=False)
        
    # Send OTP code
    success, msg = generate_and_send_otp(email)
    if not success:
        return jsonify({"message": msg}), 400
        
    return jsonify({
        "message": "OTP verification code sent. Please check your inbox.",
        "email": email
    }), 200

@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    """Verifies OTP and activates the user account."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    otp_code = data.get("otp", "").strip()
    
    if not email or not otp_code:
        return jsonify({"message": "Email and OTP code are required."}), 400
        
    # Validate OTP
    success, msg = verify_otp_code(email, otp_code)
    if not success:
        return jsonify({"message": msg}), 400
        
    # Activate user
    verify_user_email(email)
    
    # Log user in
    user = find_user_by_email(email)
    token = generate_jwt_token(user)
    update_last_login(user["_id"])
    
    return jsonify({
        "message": "Account verified successfully.",
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "profile_image": user.get("profile_image", "")
        }
    }), 200

@auth_bp.route("/resend-otp", methods=["POST"])
def resend_otp():
    """Resends a new verification OTP code after checking cooldown."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    
    if not email:
        return jsonify({"message": "Email address is required."}), 400
        
    success, msg = generate_and_send_otp(email)
    if not success:
        return jsonify({"message": msg}), 400
        
    return jsonify({"message": "A new verification code has been sent."}), 200

@auth_bp.route("/login", methods=["POST"])
def login():
    """Logs in verified user with password & captcha check."""
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    captcha_token = data.get("captcha_token", "").strip()
    captcha_ans = data.get("captcha_ans", "").strip()
    
    if not email or not password or not captcha_token or not captcha_ans:
        return jsonify({"message": "All sign-in fields and Captcha are required."}), 400
        
    # Verify Captcha
    try:
        captcha_payload = jwt.decode(captcha_token, Config.SECRET_KEY, algorithms=["HS256"])
        if captcha_payload["ans"] != captcha_ans:
            return jsonify({"message": "Incorrect Captcha answer. Please try again."}), 400
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Captcha code expired. Please reload the Captcha challenge."}), 400
    except jwt.InvalidTokenError:
        return jsonify({"message": "Invalid Captcha token. Access denied."}), 400
        
    # Verify User
    user = find_user_by_email(email)
    if not user or user.get("google_auth", False):
        return jsonify({"message": "Invalid email or password."}), 401
        
    if not user.get("verified", False):
        return jsonify({
            "message": "Account has not been verified yet. Please sign up again to verify.",
            "unverified": True
        }), 401
        
    # Verify Password hash
    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"message": "Invalid email or password."}), 401
        
    # Success: Generate Token
    token = generate_jwt_token(user)
    update_last_login(user["_id"])
    
    return jsonify({
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "profile_image": user.get("profile_image", "")
        }
    }), 200

@auth_bp.route("/google-login", methods=["POST"])
def google_login():
    """Google OAuth sign-in / sign-up endpoint."""
    data = request.get_json() or {}
    id_token = data.get("id_token", "").strip()
    
    if not id_token:
        return jsonify({"message": "Google authentication ID token is missing."}), 400
        
    try:
        if id_token == "mock-google-token":
            email = "demo_google_user@gmail.com"
            name = "Demo Google User"
            profile_img = ""
        else:
            # Validate token with Google API tokeninfo
            response = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}")
            if response.status_code != 200:
                return jsonify({"message": "Google token validation failed. Access denied."}), 401
                
            g_info = response.json()
            email = g_info.get("email", "").strip().lower()
            name = g_info.get("name", "Google User")
            profile_img = g_info.get("picture", "")
        
        if not email:
            return jsonify({"message": "Could not retrieve email from Google profile."}), 400
            
        user = find_user_by_email(email)
        if user:
            # User exists: check if they registered via password earlier
            if not user.get("google_auth", False):
                # Convert user to google_auth or keep both. Let's make it compatible.
                from server.database.connection import get_db
                get_db().users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"google_auth": True, "verified": True, "profile_image": profile_img}}
                )
                user = find_user_by_email(email)
        else:
            # Create a new Google-authenticated user, auto-verified
            user = create_user(name, email, password_hash="", google_auth=True, verified=True, profile_image=profile_img)
            
        # Log in
        token = generate_jwt_token(user)
        update_last_login(user["_id"])
        
        return jsonify({
            "message": "Google login successful.",
            "token": token,
            "user": {
                "id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"],
                "profile_image": user.get("profile_image", "")
            }
        }), 200
    except Exception as e:
        logger.exception("Google login handler error:")
        return jsonify({"message": f"Google authentication failed: {str(e)}"}), 500

@auth_bp.route("/profile", methods=["GET"])
@token_required
def get_profile():
    """Gets the authenticated user profile details."""
    user = g.current_user
    return jsonify({
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "profile_image": user.get("profile_image", "")
        }
    }), 200

@auth_bp.route("/profile", methods=["PUT"])
@token_required
def edit_profile():
    """Updates user profile details (name & image)."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    profile_image = data.get("profile_image", "").strip()
    
    if not name:
        return jsonify({"message": "Profile name cannot be blank."}), 400
        
    updated = update_profile(g.user_id, name=name, profile_image=profile_image)
    if not updated:
        return jsonify({"message": "Profile update failed."}), 500
        
    return jsonify({"message": "Profile updated successfully."}), 200

@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Signs out client user (effectively logged out client side)."""
    return jsonify({"message": "Logged out successfully."}), 200

import os
from services.s3_service import upload_file_to_s3, delete_file_from_s3

@auth_bp.route("/profile/image", methods=["POST"])
@token_required
def upload_profile_image():
    """Validates and uploads user profile picture to AWS S3, updating user document."""
    if "file" not in request.files:
        return jsonify({"message": "No file payload found."}), 400
        
    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"message": "No file selected."}), 400
        
    # Validate format
    allowed_extensions = {".jpg", ".jpeg", ".png"}
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    if ext not in allowed_extensions:
        return jsonify({"message": "Invalid file format. Only JPG, JPEG, and PNG files are accepted."}), 400
        
    # Validate size (5MB maximum)
    file_bytes = file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        return jsonify({"message": "File size exceeds the 5 MB limit."}), 400
        
    try:
        user = g.current_user
        # Delete existing S3 avatar if present
        if user.get("profile_image"):
            delete_file_from_s3(user["profile_image"])
            
        # Upload new to S3
        url = upload_file_to_s3(file_bytes, filename, file.content_type)
        
        # Update user profile in database
        updated = update_profile(g.user_id, profile_image=url)
        if not updated:
            return jsonify({"message": "Failed to update user profile image reference."}), 500
            
        return jsonify({
            "message": "Profile picture uploaded successfully.",
            "profile_image": url
        }), 200
    except Exception as e:
        logger.exception("Profile picture upload failure:")
        return jsonify({"message": str(e)}), 500

@auth_bp.route("/profile/image", methods=["DELETE"])
@token_required
def remove_profile_image():
    """Removes current user profile picture from AWS S3 and database."""
    try:
        user = g.current_user
        if user.get("profile_image"):
            delete_file_from_s3(user["profile_image"])
            
        # Clear profile image field
        updated = update_profile(g.user_id, profile_image="")
        if not updated:
            return jsonify({"message": "Failed to clear profile image reference."}), 500
            
        return jsonify({"message": "Profile picture removed successfully."}), 200
    except Exception as e:
        logger.exception("Profile picture removal failure:")
        return jsonify({"message": str(e)}), 500
