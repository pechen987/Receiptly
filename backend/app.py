import sys
import os

# Add the project root directory to sys.path
# This allows importing modules like backend.routes.auth
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from dotenv import load_dotenv
import os
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, url_for, render_template_string, send_from_directory
from flask_mail import Mail
from email_utils import init_mail, send_confirmation_email, send_password_reset_email
from functools import wraps
import jwt
import requests
from werkzeug.utils import secure_filename
import base64
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS, cross_origin
from models import db, User, Receipt, WidgetOrder
from dotenv import load_dotenv
from sqlalchemy import func
import hashlib
import json
from werkzeug.security import generate_password_hash
from config import Config
from errors import register_error_handlers, APIError, ValidationError, AuthenticationError
from logger import setup_logger
import time
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from backend.routes.subscription import subscription_bp

# Load environment variables
load_dotenv()

# Add print statements to check environment variables
print(f"GMAIL_USERNAME from env: {os.environ.get('GMAIL_USERNAME')}")
print(f"GMAIL_APP_PASSWORD from env: {os.environ.get('GMAIL_APP_PASSWORD')}")
print(f"API_BASE_URL from env: {os.environ.get('API_BASE_URL')}")
print(f"JWT_SECRET from env: {os.environ.get('JWT_SECRET')}")

# Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your_jwt_secret')
UPLOAD_FOLDER = './uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
CORS(app)
db.init_app(app)
mail = init_mail(app)

# Setup logging
setup_logger(app)

# Register error handlers
register_error_handlers(app)

# Create upload directory
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Create database tables
with app.app_context():
    db.create_all()

# Import blueprints
from backend.routes.auth import auth_bp
from backend.utils.decorators import token_required
from backend.routes.analytics import analytics_bp
from backend.routes.profile import profile_bp
from backend.routes.receipts import receipts_bp
from backend.routes.filters import filters_bp

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# Remove all route definitions and helper functions that have been moved to blueprints
# This includes auth, analytics, profile, and receipts routes/helpers.

# The token refresh endpoint is now in auth.py

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(receipts_bp)
app.register_blueprint(subscription_bp)
app.register_blueprint(filters_bp)

# Define the path for uploaded images
UPLOAD_FOLDER = os.path.join(project_root, 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/thank_you.html')
def thank_you():
    return send_from_directory(os.path.join(project_root), 'thank_you.html')

@app.route('/cancel.html')
def cancel():
    return send_from_directory(os.path.join(project_root), 'cancel.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
