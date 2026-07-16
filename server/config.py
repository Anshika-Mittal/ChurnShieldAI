import os
from dotenv import load_dotenv

# Load .env file if it exists
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "your-super-secret-key-change-it")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-jwt-secret-key-change-it")
    
    # MongoDB Configuration
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/churn_db")
    
    # Google OAuth
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    
    # AWS S3 Configuration
    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
    AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "")
    
    # Email SMTP Config
    SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    SMTP_FROM = os.environ.get("SMTP_FROM", "no-reply@churnpredict.com")
    
    # Development Flags
    DEMO_MODE = os.environ.get("DEMO_MODE", "false").lower() in ("true", "1", "yes")
