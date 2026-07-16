import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config

logger = logging.getLogger(__name__)

def send_otp_email(to_email, otp):
    """Sends a verification email containing the 6-digit OTP code."""
    to_email_clean = to_email.strip().lower()
    
    subject = "Verify Your Account - Customer Churn Prediction"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f7fc; padding: 20px; color: #333;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e1e8ed; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <h2 style="color: #4f46e5; text-align: center; margin-bottom: 20px;">Verification Code</h2>
          <p>Hello,</p>
          <p>Thank you for registering. Please use the following One-Time Password (OTP) to complete your signup process. This OTP is valid for <strong>5 minutes</strong>.</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 30px 0; padding: 15px; background: #f0f4ff; color: #4f46e5; border-radius: 6px;">
            {otp}
          </div>
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            If you did not request this code, please ignore this email.
          </p>
        </div>
      </body>
    </html>
    """

    # Check if SMTP details are configured
    if not Config.SMTP_USER or not Config.SMTP_PASSWORD:
        # Falling back to Console Logger Mode (very handy for local testing & showcase portfolios)
        logger.warning("SMTP credentials not configured. FALLING BACK TO CONSOLE LOGGER MODE.")
        print("\n" + "="*60)
        print(f" EMAIL SENT TO: {to_email_clean}")
        print(f" OTP CODE IS:    {otp}")
        print(f" VALID FOR:      5 Minutes")
        print("="*60 + "\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = Config.SMTP_FROM
        msg["To"] = to_email_clean
        msg.attach(MIMEText(body, "html"))
        
        # Connect to SMTP server
        server = smtplib.SMTP(Config.SMTP_SERVER, Config.SMTP_PORT)
        server.starttls()
        server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
        server.sendmail(Config.SMTP_FROM, to_email_clean, msg.as_string())
        server.quit()
        logger.info(f"OTP Email sent successfully to {to_email_clean}")
        return True
    except Exception as e:
        logger.error(f"Failed to send SMTP email to {to_email_clean}: {e}")
        # Log to terminal as backup so registration doesn't block developers
        print("\n" + "!"*60)
        print(f" SMTP FAILURE. BACKUP CONSOLE LOGGER FOR {to_email_clean}")
        print(f" OTP CODE IS: {otp}")
        print("!"*60 + "\n")
        return False
