import os
import boto3
import uuid
import logging
from config import Config

logger = logging.getLogger(__name__)

def get_s3_client():
    if not Config.AWS_ACCESS_KEY_ID or not Config.AWS_SECRET_ACCESS_KEY:
        logger.warning("AWS Credentials not configured in environment.")
        return None
    return boto3.client(
        "s3",
        aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
        region_name=Config.AWS_REGION
    )

def upload_file_to_s3(file_data, file_name, content_type):
    """
    Uploads a file stream/bytes to AWS S3 bucket and returns the public URL.
    """
    s3_client = get_s3_client()
    if not s3_client:
        raise ValueError(
            "AWS S3 is not configured. Please add AWS_ACCESS_KEY_ID, "
            "AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET to your backend .env file."
        )

    if not Config.AWS_S3_BUCKET:
        raise ValueError("AWS_S3_BUCKET is not set in the environment variables.")

    # Generate a unique key
    ext = os.path.splitext(file_name)[1]
    unique_key = f"avatars/{uuid.uuid4().hex}{ext}"

    try:
        s3_client.put_object(
            Bucket=Config.AWS_S3_BUCKET,
            Key=unique_key,
            Body=file_data,
            ContentType=content_type
        )
        # Construct standard public S3 URL
        url = f"https://{Config.AWS_S3_BUCKET}.s3.{Config.AWS_REGION}.amazonaws.com/{unique_key}"
        logger.info(f"File uploaded successfully to S3: {url}")
        return url
    except Exception as e:
        logger.exception("S3 upload failed:")
        raise RuntimeError(f"AWS S3 upload failed: {str(e)}")

def delete_file_from_s3(image_url):
    """
    Parses an S3 object URL and deletes it from the S3 bucket to prevent orphan files.
    """
    if not image_url:
        return False

    s3_client = get_s3_client()
    if not s3_client:
        logger.warning("AWS credentials not configured. Skipping S3 deletion.")
        return False

    if not Config.AWS_S3_BUCKET:
        logger.warning("AWS_S3_BUCKET not configured. Skipping S3 deletion.")
        return False

    try:
        # Verify if it looks like an AWS S3 URL
        if "s3" not in image_url or ".amazonaws.com" not in image_url:
            return False

        # Extract the S3 Key from the URL
        # e.g., https://my-bucket.s3.us-east-1.amazonaws.com/avatars/abc123xyz.png
        if "avatars/" in image_url:
            key = "avatars/" + image_url.split("avatars/")[1]
        else:
            # Fallback parsing
            parts = image_url.split(".amazonaws.com/")
            if len(parts) > 1:
                key = parts[1]
            else:
                return False

        s3_client.delete_object(Bucket=Config.AWS_S3_BUCKET, Key=key)
        logger.info(f"Successfully deleted S3 object: {key}")
        return True
    except Exception as e:
        logger.exception(f"Failed to delete S3 object for url {image_url}:")
        return False
