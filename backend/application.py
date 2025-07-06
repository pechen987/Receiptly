import os
import sys
from datetime import datetime, timedelta
from functools import wraps
import jwt
import requests
import base64
import hashlib
import json
import time

from flask import Flask, request, jsonify, url_for, render_template_string, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_mail import Mail
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

# Load environment variables from a .env file for local development
load_dotenv()

# --- Configuration ---
# This pulls configuration from the config.py file and environment variables.
# For AWS, you will set these in the Elastic Beanstalk configuration.
from config import Config
from errors import register_error_handlers
from logger import setup_logger
from email_utils import init_mail

# --- Initialize Flask App ---
app = Flask(__name__)
app.config.from_object(Config)

# This is the variable Elastic Beanstalk looks for to run your application.
application = app

# --- Initialize Extensions ---
CORS(app)
mail = init_mail(app)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["1000 per day", "200 per hour", "30 per minute"]
)

# Setup logging
setup_logger(app)

# Register custom error handlers
register_error_handlers(app)

# --- Database Models ---
# Import models after db is initialized
from models import db  # Import db only here

db.init_app(app)  # Bind db to app

# --- Database Models ---
# It's good practice to have your models defined or imported before creating the tables.
# Assuming your models are correctly defined in the 'models.py' file.
from models import User, Receipt, WidgetOrder

# --- Blueprints (Routes) ---
# FIX: Corrected the import paths by removing the 'backend.' prefix.
from routes.auth import auth_bp
from routes.analytics import analytics_bp
from routes.profile import profile_bp
from routes.receipts import receipts_bp
from routes.subscription import subscription_bp
from routes.filters import filters_bp

# Register all blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(analytics_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(receipts_bp)
app.register_blueprint(subscription_bp)
app.register_blueprint(filters_bp)

# These routes are for serving static HTML pages for Stripe checkout.
@app.route('/thank_you.html')
def thank_you():
    # Use os.path.join for cross-platform compatibility
    return send_from_directory(app.root_path, 'templates/thank_you.html')

@app.route('/cancel.html')
def cancel():
    return send_from_directory(app.root_path, 'templates/cancel.html')

# Register the init-db CLI command (after app and models are fully set up)
from init_db import init_app as register_init_db
register_init_db(app)

# --- Main Execution ---
if __name__ == '__main__':
    # This block is for local development only.
    # Gunicorn will be used to run the app on Elastic Beanstalk.
    app.run(debug=True, host='0.0.0.0', port=5001)