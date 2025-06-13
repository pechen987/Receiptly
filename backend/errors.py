from flask import jsonify
from werkzeug.exceptions import HTTPException

class APIError(Exception):
    """Base exception for API errors"""
    def __init__(self, message, status_code=400, payload=None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['message'] = self.message
        return rv

class ValidationError(APIError):
    """Raised when input validation fails"""
    def __init__(self, message, payload=None):
        super().__init__(message, status_code=400, payload=payload)

class AuthenticationError(APIError):
    """Raised when authentication fails"""
    def __init__(self, message, payload=None):
        super().__init__(message, status_code=401, payload=payload)

class AuthorizationError(APIError):
    """Raised when user is not authorized to perform an action"""
    def __init__(self, message, payload=None):
        super().__init__(message, status_code=403, payload=payload)

class ResourceNotFoundError(APIError):
    """Raised when a requested resource is not found"""
    def __init__(self, message, payload=None):
        super().__init__(message, status_code=404, payload=payload)

def register_error_handlers(app):
    @app.errorhandler(APIError)
    def handle_api_error(error):
        response = jsonify(error.to_dict())
        response.status_code = error.status_code
        return response

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        response = jsonify({
            'message': error.description,
            'status_code': error.code
        })
        response.status_code = error.code
        return response

    @app.errorhandler(Exception)
    def handle_generic_error(error):
        # Log the detailed exception
        app.logger.error("An unexpected error occurred:", exc_info=True)
        
        response = jsonify({
            'message': 'An unexpected error occurred',
            'status_code': 500
        })
        response.status_code = 500
        return response 