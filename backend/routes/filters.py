from flask import Blueprint, jsonify, request, current_app as app
from flask_cors import cross_origin
from ..utils.decorators import token_required
from sqlalchemy import text
from models import db, Receipt

filters_bp = Blueprint('filters', __name__)

@filters_bp.route('/store-names', methods=['GET'])
@cross_origin()
@token_required
def get_store_names(user_id):
    try:
        # Get unique store names for the user
        store_names = db.session.query(Receipt.store_name)\
            .filter(Receipt.user_id == user_id)\
            .distinct()\
            .order_by(Receipt.store_name)\
            .all()
        
        return jsonify({
            'success': True,
            'store_names': [name[0] for name in store_names if name[0]]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@filters_bp.route('/store-categories', methods=['GET'])
@cross_origin()
@token_required
def get_store_categories(user_id):
    try:
        # Get unique store categories for the user
        store_categories = db.session.query(Receipt.store_category)\
            .filter(Receipt.user_id == user_id)\
            .distinct()\
            .order_by(Receipt.store_category)\
            .all()
        
        return jsonify({
            'success': True,
            'store_categories': [category[0] for category in store_categories if category[0]]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500 