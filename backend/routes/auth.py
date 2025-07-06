from flask import Blueprint, request, jsonify, url_for, render_template_string, current_app as app
from functools import wraps
import jwt
from datetime import datetime, timedelta
import base64
import json as pyjson
import time

# Import the token_required decorator from the new utility file
from utils.decorators import token_required

# Import necessary components from the backend application
# We assume db, mail, User, ValidationError, AuthenticationError, APIError,
# and send_confirmation_email, send_password_reset_email are available via app.config or context
# Import User model, but not db here; access db via app.extensions['sqlalchemy']
from models import User
from errors import ValidationError, AuthenticationError, APIError
from email_utils import send_confirmation_email, send_password_reset_email

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email', '').strip().lower()
    password = data.get('password')
    
    with app.app_context():
        # Access db via app.extensions
        db = app.extensions['sqlalchemy'] # Access db via app.extensions
        if not email or not password:
            raise ValidationError('Email and password are required')
        
        if db.session.query(User).filter_by(email=email).first(): # Use db from extensions
            raise ValidationError('Email already registered', status_code=409)
        
        user = User(email=email, email_verified=False)
        user.set_password(password)
        user.plan = 'basic' # Assign the basic plan by default
        db.session.add(user) # Use db from extensions
        db.session.commit() # Use db from extensions
        app.logger.info(f"Created new user: {email}")
        
        # Generate confirmation token
        token = jwt.encode(
            {
                'user_id': user.id,
                'email': user.email,
                'exp': int((datetime.utcnow() + timedelta(hours=app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 120))).timestamp())
            },
            app.config['JWT_SECRET'],
            algorithm='HS256'
        )
    
    # Send confirmation email (can be outside app context if mail is configured for it)
    # Access mail from the app context implicitly via app.extensions['mail']
    if send_confirmation_email(app.extensions['mail'], email, email, token):
        return jsonify({'message': 'Registration successful! Please check your email to verify your account.'})
    else:
        with app.app_context(): # Also need context for logger in error case
             app.logger.error(f"Failed to send confirmation email to {email}")
        return jsonify({
            'message': 'Registration successful, but failed to send confirmation email. Please contact support.'
        }), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email', '').strip().lower()
    password = data.get('password')
    
    with app.app_context():
        # Access db via app.extensions
        db = app.extensions['sqlalchemy'] # Access db via app.extensions
        if not email or not password:
            return jsonify({'message': 'Email and password are required'}), 400
        user = db.session.query(User).filter_by(email=email).first() # Use db from extensions
        if user and user.check_password(password):
            if not user.email_verified:
                return jsonify({'message': 'Please verify your email before logging in'}), 403
            # Access JWT_SECRET from the app config
            token = jwt.encode({'user_id': user.id, 'email': user.email, 'exp': int((datetime.utcnow() + timedelta(hours=app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 120))).timestamp())}, app.config['JWT_SECRET'], algorithm='HS256')
            return jsonify({'token': token})
        else:
            return jsonify({'message': 'Invalid credentials'}), 401

@auth_bp.route('/confirm-email', methods=['GET'])
def confirm_email():
    token = request.args.get('token')
    if not token:
        return "Error: No token provided", 400
    
    try:
        with app.app_context():
            # Access db via app.extensions
            db = app.extensions['sqlalchemy'] # Access db via app.extensions
            # Verify token using JWT_SECRET from app config
            data = jwt.decode(token, app.config['JWT_SECRET'], algorithms=["HS256"])
            email = data.get('email')
            
            if not email:
                return "Error: Invalid token", 400
                
            # Find user and mark email as verified
            user = db.session.query(User).filter_by(email=email).first() # Use db from extensions
            if not user:
                return "Error: User not found", 404
                
            # Mark email as verified
            user.email_verified = True
            db.session.commit() # Use db from extensions
            
            # Generate JWT token using JWT_SECRET from app config
            token = jwt.encode({'email': email}, app.config['JWT_SECRET'], algorithm='HS256')
        
        # Return HTML confirmation page (can be outside app context)
        html_response = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Confirmation</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background-color: #16191f;
                }
                .container {
                    background: #232632;
                    padding: 2.5rem;
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    text-align: center;
                    max-width: 400px;
                    width: 90%;
                    border: 1px solid #333;
                }
                .success-icon {
                    font-size: 4rem;
                    color: #4caf50;
                    margin-bottom: 1.5rem;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    width: 80px;
                    height: 80px;
                    background: rgba(76, 175, 80, 0.1);
                    border-radius: 50%;
                    margin: 0 auto 1.5rem;
                }
                h1 {
                    color: #e6e9f0;
                    margin-bottom: 1.5rem;
                    font-size: 1.8rem;
                    font-weight: 700;
                }
                .message {
                    color: #c1c6d9;
                    margin-bottom: 2rem;
                    line-height: 1.6;
                    font-size: 1rem;
                }
                .button {
                    display: inline-block;
                    padding: 0.8rem 1.5rem;
                    background-color: #7e5cff;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    transition: background-color 0.3s ease;
                    border: none;
                    cursor: pointer;
                    font-size: 1rem;
                }
                .button:hover {
                    background-color: #5a3fc0;
                }
                .footer {
                    margin-top: 2rem;
                    color: #8ca0c6;
                    font-size: 0.9rem;
                }
                .app-name {
                    color: #7e5cff;
                    font-weight: 700;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success-icon">✓</div>
                <h1>Email Verified Successfully!</h1>
                <div class="message">
                    <p>Your email address has been successfully verified.</p>
                    <p>You can now use <span class="app-name">Recipta</span> to track your expenses and scan receipts.</p>
                </div>
                <button class="button" onclick="window.close()">Close Page</button>
                <div class="footer">
                    <p>Welcome to Recipta!</p>
                </div>
            </div>
        </body>
        </html>
        """
        return html_response
        
    except jwt.ExpiredSignatureError:
        return "Error: The confirmation link has expired. Please request a new one.", 400
    except jwt.InvalidTokenError:
        return "Error: Invalid token", 400
    except Exception as e:
        with app.app_context(): # Also need context for logger in error case
             app.logger.error(f"Error confirming email: {str(e)}")
        return "Error: An error occurred while confirming your email", 500

@auth_bp.route('/request-password-reset', methods=['POST'])
def request_password_reset():
    data = request.get_json() or request.form
    email = data.get('email')
    print(f"Password reset requested for: {email}")
    if not email:
        print("No email provided.")
        return jsonify({'success': True}), 200  # Always return success
    
    with app.app_context():
        # Access db via app.extensions
        db = app.extensions['sqlalchemy'] # Access db via app.extensions
        user = db.session.query(User).filter_by(email=email).first() # Use db from extensions
        if user:
            print(f"User found: {user.email}")
            now = datetime.utcnow()
            exp_time = now + timedelta(hours=1)
            exp_timestamp = int(exp_time.timestamp())
            print(f"Creating reset token at: {now} (UTC), exp: {exp_time} (UTC), exp_timestamp: {exp_timestamp}")
            # Generate reset token (expires in 1 hour) using JWT_SECRET from app config
            token = jwt.encode(
                {'user_id': user.id,
                'email': user.email,
                'exp': int((datetime.utcnow() + timedelta(hours=app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 120))).timestamp())},
                app.config['JWT_SECRET'],
                algorithm='HS256'
            )
            # Access mail from the app context
            result = send_password_reset_email(app.extensions['mail'], user.email, user.email, token)
            print(f"send_password_reset_email result: {result}")
        else:
            print("No user found for this email.")
    
    return jsonify({'success': True}), 200

@auth_bp.route('/reset-password-web', methods=['GET', 'POST'])
def reset_password_web():
    print(f"reset_password_web called at: {datetime.utcnow()} (UTC), server now: {int(time.time())}")
    token = request.args.get('token') if request.method == 'GET' else request.form.get('token')
    if not token:
        return render_template_string('<h2>Error: No token provided.</h2>'), 400
    try:
        with app.app_context():
            # Access db via app.extensions
            db = app.extensions['sqlalchemy'] # Access db via app.extensions
            # Verify token using JWT_SECRET from app config
            data = jwt.decode(token, app.config['JWT_SECRET'], algorithms=["HS256"])
            email = data.get('email')
            if not email:
                return render_template_string('<h2>Error: Invalid token.</h2>'), 400
            user = db.session.query(User).filter_by(email=email).first() # Use db from extensions
            if not user:
                return render_template_string('<h2>Error: User not found.</h2>'), 404
            
            if request.method == 'POST':
                 # POST: handle password reset
                new_password = request.form.get('new_password')
                confirm_password = request.form.get('confirm_password')
                if not new_password or not confirm_password:
                    return render_template_string('<h2 class="error">Both password fields are required.</h2>'), 400
                if new_password != confirm_password:
                    return render_template_string('<h2 class="error">Passwords do not match.</h2>'), 400
                if len(new_password) < 6:
                    return render_template_string('<h2 class="error">Password must be at least 6 characters.</h2>'), 400
                user.set_password(new_password)
                db.session.commit() # Use db from extensions
                return render_template_string('''
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Password Reset Success</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            background-color: #16191f;
                        }
                        .container {
                            background: #232632;
                            padding: 2.5rem;
                            border-radius: 16px;
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                            text-align: center;
                            max-width: 400px;
                            width: 90%;
                            border: 1px solid #333;
                        }
                        .success-icon {
                            font-size: 4rem;
                            color: #4caf50;
                            margin-bottom: 1.5rem;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            width: 80px;
                            height: 80px;
                            background: rgba(76, 175, 80, 0.1);
                            border-radius: 50%;
                            margin: 0 auto 1.5rem;
                        }
                        h1 {
                            color: #e6e9f0;
                            margin-bottom: 1.5rem;
                            font-size: 1.8rem;
                            font-weight: 700;
                        }
                        .message {
                            color: #c1c6d9;
                            margin-bottom: 2rem;
                            line-height: 1.6;
                            font-size: 1rem;
                        }
                        .button {
                            display: inline-block;
                            padding: 0.8rem 1.5rem;
                            background-color: #7e5cff;
                            color: white;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: 600;
                            transition: background-color 0.3s ease;
                            border: none;
                            cursor: pointer;
                            font-size: 1rem;
                        }
                        .button:hover {
                            background-color: #5a3fc0;
                        }
                        .footer {
                            margin-top: 2rem;
                            color: #8ca0c6;
                            font-size: 0.9rem;
                        }
                        .app-name {
                            color: #7e5cff;
                            font-weight: 700;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success-icon">✓</div>
                        <h1>Password Reset Successful!</h1>
                        <div class="message">
                            <p>Your password has been successfully updated.</p>
                            <p>You can now close this page and log in to <span class="app-name">Recipta</span> with your new password.</p>
                        </div>
                        <button class="button" onclick="window.close()">Close Page</button>
                        <div class="footer">
                            <p>Thank you for using Recipta!</p>
                        </div>
                    </div>
                </body>
                </html>
                ''')

    except jwt.ExpiredSignatureError as e:
        print(f"ExpiredSignatureError: {e}")
        try:
            # Decode payload for debugging
            payload = token.split('.')[1]
            # Pad base64 if needed
            missing_padding = len(payload) % 4
            if missing_padding:
                payload += '=' * (4 - missing_padding)
            decoded = base64.urlsafe_b64decode(payload)
            payload_json = pyjson.loads(decoded)
            print(f"Token payload: {payload_json}")
            print(f"Token exp: {payload_json.get('exp')}, Server now: {int(time.time())}")
        except Exception as ex:
            print(f"Failed to decode token payload: {ex}")
        return render_template_string('<h2>Error: The reset link has expired. Please request a new one.</h2>'), 400
    except jwt.InvalidTokenError as e:
        print(f"InvalidTokenError: {e}")
        return render_template_string('<h2>Error: Invalid token.</h2>'), 400
    except Exception as e:
        print(f"Other JWT error: {e}")
        return render_template_string(f'<h2>Error: {str(e)}</h2>'), 400
    
    if request.method == 'GET':
        # Render password reset form
        return render_template_string('''
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Reset Password</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
                        background: #16191f; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        min-height: 100vh; 
                        margin: 0;
                        padding: 20px;
                    }
                    .container { 
                        background: #232632; 
                        padding: 2.5rem; 
                        border-radius: 16px; 
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3); 
                        max-width: 400px; 
                        width: 100%; 
                        border: 1px solid #333;
                    }
                    h2 { 
                        color: #7e5cff; 
                        margin-bottom: 1.5rem; 
                        font-size: 1.8rem;
                        font-weight: 700;
                        text-align: center;
                    }
                    input[type=password] { 
                        width: 100%; 
                        padding: 16px; 
                        margin: 12px 0; 
                        border-radius: 8px; 
                        border: 1px solid #333; 
                        font-size: 1rem; 
                        background: #1a1d24;
                        color: #e6e9f0;
                        box-sizing: border-box;
                    }
                    input[type=password]:focus {
                        outline: none;
                        border-color: #7e5cff;
                        box-shadow: 0 0 0 2px rgba(126, 92, 255, 0.2);
                    }
                    input[type=password]::placeholder {
                        color: #8ca0c6;
                    }
                    input[type=submit] { 
                        width: 100%; 
                        padding: 16px; 
                        margin: 16px 0 8px 0; 
                        border-radius: 8px; 
                        border: none; 
                        font-size: 1rem; 
                        background: #7e5cff; 
                        color: #fff; 
                        font-weight: 600; 
                        cursor: pointer; 
                        transition: background-color 0.3s ease;
                    }
                    input[type=submit]:hover { 
                        background: #5a3fc0; 
                    }
                    .error { 
                        color: #ff4a4a; 
                        margin-bottom: 1rem; 
                        text-align: center;
                        font-size: 0.9rem;
                    }
                    .app-name {
                        color: #7e5cff;
                        font-weight: 700;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Reset Your Password</h2>
                    <form method="POST">
                        <input type="hidden" name="token" value="{{ token }}" />
                        <input type="password" name="new_password" placeholder="New Password" required minlength="6" />
                        <input type="password" name="confirm_password" placeholder="Confirm Password" required minlength="6" />
                        <input type="submit" value="Reset Password" />
                    </form>
                </div>
            </body>
            </html>
        ''', token=token)

@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    try:
        with app.app_context():
            # Access db via app.extensions
            db = app.extensions['sqlalchemy'] # Access db via app.extensions
            # Get the current token from the Authorization header
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                raise AuthenticationError('No token provided')

            current_token = auth_header.split(' ')[1]
            
            # Decode the current token to get user info using JWT_SECRET from app config
            try:
                data = jwt.decode(current_token, app.config['JWT_SECRET'], algorithms=["HS256"])
            except jwt.ExpiredSignatureError:
                # Even if the token is expired, we can still get the user info
                data = jwt.decode(current_token, app.config['JWT_SECRET'], algorithms=["HS256"], options={"verify_exp": False})
            except Exception as e:
                raise AuthenticationError('Invalid token')

            # Generate a new token using JWT_SECRET from app config
            new_token = jwt.encode(
                {
                    'user_id': data['user_id'],
                    'email': data['email'],
                    'exp': int((datetime.utcnow() + timedelta(hours=app.config.get('JWT_ACCESS_TOKEN_EXPIRES', 120))).timestamp())
                },
                app.config['JWT_SECRET'],
                algorithm='HS256'
            )

            return jsonify({'token': new_token})
    except Exception as e:
        with app.app_context(): # Also need context for logger in error case
            app.logger.error(f"Error refreshing token: {str(e)}")
        raise AuthenticationError('Failed to refresh token')

# Register error handler for ValidationError
@auth_bp.app_errorhandler(ValidationError)
def handle_validation_error(error):
    response = jsonify({'message': str(error), 'status_code': error.status_code})
    response.status_code = error.status_code
    return response
