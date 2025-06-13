import os
from flask_mail import Mail, Message
from flask import current_app
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Debug: Print current working directory and environment variables
print("Current working directory:", os.getcwd())
print("Environment variables:", os.environ.get('API_BASE_URL'))

API_BASE_URL = os.getenv('API_BASE_URL')
if not API_BASE_URL:
    raise ValueError('API_BASE_URL environment variable is not set')

def init_mail(app):
    # Gmail SMTP Configuration
    app.config['MAIL_SERVER'] = 'smtp.gmail.com'
    app.config['MAIL_PORT'] = 587
    app.config['MAIL_USE_TLS'] = True
    app.config['MAIL_USE_SSL'] = False
    # These should be set as environment variables
    app.config['MAIL_USERNAME'] = os.environ.get('GMAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.environ.get('GMAIL_APP_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = (os.environ.get('GMAIL_USERNAME'), 'Receipt Scanner App')
    return Mail(app)

def send_confirmation_email(mail, to_email, username, token):
    confirm_url = f"{API_BASE_URL}/api/auth/confirm-email?token={token}"
    
    msg = Message(
        subject="Confirm Your Email Address",
        recipients=[to_email],
        html=f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4a6fa5; margin-bottom: 20px;">Welcome to Our App!</h1>
            <p>Hello {username},</p>
            <p>Thank you for registering. Please confirm your email address by clicking the button below:</p>
            <div style="margin: 25px 0;">
                <a href="{confirm_url}" 
                   style="background-color: #4a6fa5; 
                          color: white; 
                          padding: 12px 24px; 
                          text-decoration: none; 
                          border-radius: 4px;
                          font-weight: bold;
                          display: inline-block;
                          margin: 10px 0;">
                    Confirm Email
                </a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #333; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 0.9em;">
                {confirm_url}
            </p>
            <p style="color: #666; font-size: 0.9em; margin-top: 20px;">
                This link will expire in 24 hours.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
            <p style="color: #999; font-size: 0.9em;">
                If you didn't create an account, you can safely ignore this email.
            </p>
        </div>
        """
    )
    
    # Add plain text version as well
    msg.body = f"""
    Welcome to Our App!
    
    Hello {username},
    
    Thank you for registering. Please confirm your email address by visiting the following link:
    
    {confirm_url}
    
    This link will expire in 24 hours.
    
    If you didn't create an account, you can safely ignore this email.
    """
    
    try:
        mail.send(msg)
        print(f"Confirmation email sent to {to_email}")
        return True
    except Exception as e:
        print(f"Error sending confirmation email to {to_email}: {str(e)}")
        current_app.logger.error(f"Detailed email sending error to {to_email}: {e}", exc_info=True)
        return False


def send_password_reset_email(mail, to_email, username, token):
    reset_url = f"{API_BASE_URL}/api/auth/reset-password-web?token={token}"
    
    msg = Message(
        subject="Reset Your Password",
        recipients=[to_email],
        html=f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #7e5cff; margin-bottom: 20px;">Reset Your Password</h1>
            <p>Hello {username},</p>
            <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
            
            <div style="margin: 25px 0;">
                <a href="{reset_url}" 
                   style="background-color: #7e5cff; 
                          color: white; 
                          padding: 12px 24px; 
                          text-decoration: none; 
                          border-radius: 8px;
                          font-weight: bold;
                          display: inline-block;
                          margin: 10px 0;">
                    Reset Password in App
                </a>
            </div>
            
            <p>If the button above doesn't work, you can also copy and paste this link in your mobile browser (it will open the app):</p>
            <p style="word-break: break-all; color: #333; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 0.9em;">
                {reset_url}
            </p>
            
            <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid #7e5cff;">
                <p style="margin: 0; color: #666; font-size: 0.95em;">
                    <strong>Security Notice:</strong> This link will expire in 1 hour for your security.
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
            <p style="color: #999; font-size: 0.9em;">
                If you're having trouble with the app, please contact our support team.
            </p>
        </div>
        """
    )
    
    # Add plain text version
    msg.body = f"""
    Reset Your Password
    
    Hello {username},
    
    We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
    
    To reset your password, open this link in your mobile browser (it will open the app):
    {reset_url}
    
    This link will expire in 1 hour for your security.
    
    If you're having trouble, please contact our support team.
    """
    
    try:
        mail.send(msg)
        print(f"Password reset email sent to {to_email}")
        return True
    except Exception as e:
        print(f"Error sending password reset email to {to_email}: {str(e)}")
        current_app.logger.error(f"Detailed email sending error to {to_email}: {e}", exc_info=True)
        return False
