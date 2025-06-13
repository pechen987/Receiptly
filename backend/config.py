import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    # Flask settings
    SECRET_KEY = os.environ.get('JWT_SECRET', 'your_jwt_secret')
    UPLOAD_FOLDER = './uploads'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
    
    # Database settings
    SQLALCHEMY_DATABASE_URI = 'sqlite:///app.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Email settings
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.environ.get('GMAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('GMAIL_APP_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('GMAIL_USERNAME')
    
    # JWT settings
    JWT_SECRET = os.environ.get('JWT_SECRET', 'your_jwt_secret')
    JWT_ACCESS_TOKEN_EXPIRES = 120  # hours (5 days)
    
    # Security settings
    PASSWORD_MIN_LENGTH = 8
    PASSWORD_REQUIRE_SPECIAL = True
    PASSWORD_REQUIRE_NUMBERS = True
    PASSWORD_REQUIRE_UPPERCASE = True 