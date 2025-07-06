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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #16191f; color: #e6e9f0;">
            <div style="background: #232632; border-radius: 16px; padding: 32px; border: 1px solid #333; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);">
                <h1 style="color: #7e5cff; margin-bottom: 20px; font-size: 28px; font-weight: 700; text-align: center;">Welcome to Recipta!</h1>
                <p style="color: #c1c6d9; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Hello {username},</p>
                <p style="color: #c1c6d9; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Thank you for registering with Recipta. Please confirm your email address by clicking the button below:</p>
                
                <div style="margin: 32px 0; text-align: center;">
                    <a href="{confirm_url}" 
                       style="background-color: #7e5cff; 
                              color: white; 
                              padding: 16px 32px; 
                              text-decoration: none; 
                              border-radius: 8px;
                              font-weight: 600;
                              display: inline-block;
                              margin: 10px 0;
                              font-size: 16px;
                              transition: background-color 0.3s ease;">
                        Confirm Email Address
                    </a>
                </div>
                
                <p style="color: #8ca0c6; font-size: 14px; margin-bottom: 16px;">If the button above doesn't work, you can also copy and paste this link in your browser:</p>
                <div style="word-break: break-all; color: #c1c6d9; background: #1a1d24; padding: 16px; border-radius: 8px; font-size: 14px; border: 1px solid #333; margin-bottom: 24px;">
                    {confirm_url}
                </div>
                
                <div style="margin-top: 32px; padding: 20px; background: #1a1d24; border-radius: 8px; border-left: 4px solid #7e5cff;">
                    <p style="margin: 0; color: #8ca0c6; font-size: 14px;">
                        <strong style="color: #7e5cff;">Security Notice:</strong> This link will expire in 24 hours for your security.
                    </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #333; margin: 32px 0;">
                <p style="color: #8ca0c6; font-size: 14px; text-align: center; margin: 0;">
                    If you didn't create an account, you can safely ignore this email.
                </p>
            </div>
        </div>
        """
    )
    
    # Add plain text version as well
    msg.body = f"""
    Welcome to Recipta!
    
    Hello {username},
    
    Thank you for registering with Recipta. Please confirm your email address by visiting the following link:
    
    {confirm_url}
    
    This link will expire in 24 hours for your security.
    
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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #16191f; color: #e6e9f0;">
            <div style="background: #232632; border-radius: 16px; padding: 32px; border: 1px solid #333; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);">
                <h1 style="color: #7e5cff; margin-bottom: 20px; font-size: 28px; font-weight: 700; text-align: center;">Reset Your Password</h1>
                <p style="color: #c1c6d9; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Hello {username},</p>
                <p style="color: #c1c6d9; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
                
                <div style="margin: 32px 0; text-align: center;">
                    <a href="{reset_url}" 
                       style="background-color: #7e5cff; 
                              color: white; 
                              padding: 16px 32px; 
                              text-decoration: none; 
                              border-radius: 8px;
                              font-weight: 600;
                              display: inline-block;
                              margin: 10px 0;
                              font-size: 16px;
                              transition: background-color 0.3s ease;">
                        Reset Password
                    </a>
                </div>
                
                <p style="color: #8ca0c6; font-size: 14px; margin-bottom: 16px;">If the button above doesn't work, you can also copy and paste this link in your browser:</p>
                <div style="word-break: break-all; color: #c1c6d9; background: #1a1d24; padding: 16px; border-radius: 8px; font-size: 14px; border: 1px solid #333; margin-bottom: 24px;">
                    {reset_url}
                </div>
                
                <div style="margin-top: 32px; padding: 20px; background: #1a1d24; border-radius: 8px; border-left: 4px solid #7e5cff;">
                    <p style="margin: 0; color: #8ca0c6; font-size: 14px;">
                        <strong style="color: #7e5cff;">Security Notice:</strong> This link will expire in 1 hour for your security.
                    </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #333; margin: 32px 0;">
                <p style="color: #8ca0c6; font-size: 14px; text-align: center; margin: 0;">
                    If you're having trouble with the app, please contact our support team.
                </p>
            </div>
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
