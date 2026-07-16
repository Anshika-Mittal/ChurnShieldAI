import jwt
from functools import wraps
from flask import request, jsonify, g
from config import Config
from database.users import find_user_by_id

def token_required(f):
    """Decorator to enforce JWT authentication on Flask route endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check Authorization header
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                
        if not token:
            return jsonify({"message": "Access denied. Authentication token is missing!"}), 401
            
        try:
            # Decode token
            data = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])
            user_id = data.get("user_id")
            
            if not user_id:
                return jsonify({"message": "Invalid token payload!"}), 401
                
            # Fetch user details
            user = find_user_by_id(user_id)
            if not user:
                return jsonify({"message": "Account not found or session invalid!"}), 401
                
            # Attach to request globals
            g.current_user = user
            g.user_id = str(user["_id"])
            
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Session expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Invalid token. Authorization denied."}), 401
        except Exception as e:
            return jsonify({"message": f"Authentication validation failed: {str(e)}"}), 500
            
        return f(*args, **kwargs)
        
    return decorated
