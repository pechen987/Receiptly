from flask import Blueprint, request, jsonify, current_app as app
from flask_cors import cross_origin

# Import necessary components from the backend application
from backend.models import User
from backend.errors import AuthenticationError, APIError, ValidationError

# Import the token_required decorator
from backend.utils.decorators import token_required

profile_bp = Blueprint('profile', __name__, url_prefix='/api/user/profile')

@profile_bp.route('', methods=['GET'])
@cross_origin()
@token_required
def get_user_profile(user_id):
    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        # Get user_id from the token data set by token_required decorator
        # user_id = request.user.get('user_id')

        # The user_id is now passed directly by the decorator

        if not user_id:
            # This case should ideally be caught by @token_required, but included for robustness
            app.logger.warning("User ID missing (or None) passed to get_user_profile.")
            raise AuthenticationError('User ID is required')

        user = db.session.query(User).get(user_id) # Use db from extensions
        if not user:
            # This case indicates a potential issue with the database or token data consistency
            app.logger.error(f"User with ID {user_id} not found in DB based on token data.")
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'user_id': user.id,
            'email': user.email,
            'currency': user.currency or 'USD',
        })

@profile_bp.route('', methods=['POST'])
@cross_origin()
@token_required
def update_user_profile(user_id):
    data = request.get_json()
    # Get user_id from the token data set by token_required decorator (more secure)
    # user_id = request.user.get('user_id')

    # The user_id is now passed directly by the decorator

    if not user_id:
        # This case should ideally be caught by @token_required
        app.logger.warning("User ID missing (or None) passed to update_user_profile.")
        raise AuthenticationError('User ID is required')

    # The currency should still come from the request body
    currency = data.get('currency')

    if not currency:
        return jsonify({'error': 'Missing currency'}), 400

    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        user = db.session.query(User).get(user_id) # Use db from extensions
        if not user:
            # This case indicates a potential issue with the database or token data consistency
            app.logger.error(f"User with ID {user_id} not found in DB for update based on token data.")
            return jsonify({'error': 'User not found'}), 404
        user.currency = currency
        db.session.commit() # Use db from extensions
        return jsonify({'success': True, 'currency': user.currency})
