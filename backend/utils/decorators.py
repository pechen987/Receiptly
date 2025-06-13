from flask import request, jsonify, current_app as app
from functools import wraps
import jwt
from datetime import datetime, timedelta

# Import necessary components that the decorator needs
from backend.errors import AuthenticationError

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
            elif len(parts) > 1:
                 with app.app_context():
                      app.logger.warning(f'Malformed Authorization header: {auth_header}')

        if not token:
            # Use app.app_context() to ensure logger and config are accessible
            with app.app_context():
                 app.logger.warning('Token is missing!')
            raise AuthenticationError('Token is missing!')
        try:
            # Access JWT_SECRET from the app config using current_app
            # Ensure this is within an app context if run outside a request
            with app.app_context():
                data = jwt.decode(token, app.config['JWT_SECRET'], algorithms=["HS256"])

            # Pass the user_id to the decorated function
            user_id = data.get('user_id')
            if user_id is None:
                 raise AuthenticationError('User ID not found in token!')

        except jwt.ExpiredSignatureError:
            with app.app_context():
                app.logger.error("Token validation error: Signature has expired")
            raise AuthenticationError('Token has expired!')
        except jwt.InvalidTokenError:
            with app.app_context():
                app.logger.error("Token validation error: Invalid token")
            raise AuthenticationError('Token is invalid!')
        except Exception as e:
            with app.app_context():
                app.logger.error(f"Token validation error: {str(e)}")
            raise AuthenticationError('Token is invalid!')

        return f(user_id, *args, **kwargs) # Pass user_id as the first argument
    return decorated

