from flask import Blueprint, request, jsonify, current_app as app
from flask_cors import cross_origin
from datetime import datetime, timedelta
from sqlalchemy import func
import hashlib
import json

# Import necessary components from the backend application
from models import User, Receipt
from errors import AuthenticationError, APIError, ValidationError

# Import the token_required decorator
from utils.decorators import token_required

receipts_bp = Blueprint('receipts', __name__, url_prefix='/api/receipts')

BASIC_MONTHLY_LIMIT = 8 # Define the monthly limit for basic users (now 8 per calendar month)

def canonicalize_receipt(data):
    # Ensure all relevant fields are present and items are sorted
    receipt = {
        "store_category": data.get("store_category"),
        "store_name": data.get("store_name"),
        "date": data.get("date"),
        "total": data.get("total"),
        "currency": data.get("currency"),
        "tax_amount": data.get("tax_amount"),
        "total_discount": data.get("total_discount"),
        "items": sorted([
            {
                "name": item.get("name"),
                "quantity": item.get("quantity"),
                "category": item.get("category"),
                "price": item.get("price"),
                "total": item.get("total"),
                "discount": item.get("discount"),
            }
            for item in data.get("items") or []
        ], key=lambda x: (x.get("name") or "", x.get("price") or 0)),
    }
    return receipt

def compute_fingerprint(receipt):
    canonical = json.dumps(receipt, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()

@receipts_bp.route('', methods=['GET'])
@token_required
def get_receipts(user_id):
    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        # user_id is now passed by the decorator
        # user_id = request.args.get('user_id', type=int) # Removed

        if not user_id:
            # This should be caught by the decorator, but for safety:
            app.logger.warning("User ID missing (or None) passed to get_receipts.")
            raise AuthenticationError('User ID is required')

        receipts = db.session.query(Receipt).filter_by(user_id=user_id).all() # Use the passed user_id

        return jsonify({
            'receipts': [
                {
                    'id': r.id,
                    'store_category': r.store_category,
                    'store_name': r.store_name,
                    'date': r.date.strftime('%Y-%m-%d'),
                    'total': r.total,
                    'currency': r.user.currency if r.user and r.user.currency else 'USD',
                    'tax_amount': r.tax_amount,
                    'total_discount': r.total_discount,
                    'items': r.items,
                    'fingerprint': '',  # not stored in DB but can be recalculated if needed
                    'timestamp': int(r.created_at.timestamp() * 1000),
                } for r in receipts
            ]
        })

@receipts_bp.route('', methods=['POST'])
@token_required
def add_receipt(user_id):
    data = request.get_json()

    if not user_id:
        app.logger.warning("User ID missing (or None) passed to add_receipt.")
        raise AuthenticationError('User ID is required')

    if not data:
         return jsonify({'error': 'Request body is empty'}), 400

    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        user = db.session.query(User).get(user_id) # Get the user to check their plan
        
        if not user:
            app.logger.error(f"User with ID {user_id} not found in DB during add_receipt.")
            return jsonify({'error': 'User not found'}), 404

        # --- Plan Restriction Check ----
        if user.plan == 'basic':
            # Only allow 8 scans per current calendar month
            today = datetime.utcnow().date()
            first_day = today.replace(day=1)
            if today.month == 12:
                next_month = today.replace(year=today.year + 1, month=1, day=1)
            else:
                next_month = today.replace(month=today.month + 1, day=1)
            current_month_receipt_count = db.session.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.date >= first_day,
                Receipt.date < next_month
            ).count()

            if current_month_receipt_count >= BASIC_MONTHLY_LIMIT:
                app.logger.info(f"Basic user {user_id} reached monthly receipt limit.")
                return jsonify({'error': f'Monthly receipt limit ({BASIC_MONTHLY_LIMIT}) reached for basic plan. Upgrade to add more.'}), 403 # Use 403 Forbidden
        # --- End Plan Restriction Check ---

        # Canonicalize and compute fingerprint on backend (after plan check)
        canonical = canonicalize_receipt(data)
        fingerprint = compute_fingerprint(canonical)
        
        # Check for duplicate (after plan check)
        existing = db.session.query(Receipt).filter_by(user_id=user_id, fingerprint=fingerprint).first()
        if existing:
            app.logger.info(f"Duplicate receipt detected for user {user_id}.")
            return jsonify({'error': 'Receipt already saved'}), 409

        try:
            # Validate required fields in data
            required_fields = ['date', 'total']
            for field in required_fields:
                if field not in data or data[field] is None:
                     raise ValidationError(f'Missing required field: {field}')

            receipt = Receipt(
                user_id=user_id,
                store_category=data.get('store_category'),
                store_name=data.get('store_name'),
                date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
                total=data.get('total'),
                tax_amount=data.get('tax_amount'),
                total_discount=data.get('total_discount'),
                items=data.get('items'),
                fingerprint=fingerprint
            )
            db.session.add(receipt)
            db.session.commit() # Use db from extensions
            app.logger.info(f"Receipt saved successfully for user {user_id}.")
            return jsonify({'message': 'Receipt saved', 'id': receipt.id}), 201 # Use 201 Created
        except ValidationError as e:
             app.logger.warning(f"Validation error saving receipt for user {user_id}: {e}")
             return jsonify({'error': str(e)}), 400
        except Exception as e:
            app.logger.error(f"Error saving receipt for user {user_id}: {e}")
            return jsonify({'error': 'Failed to save receipt'}), 500


@receipts_bp.route('/<int:receipt_id>', methods=['DELETE'])
@token_required
def delete_receipt(user_id, receipt_id):
    try:
        # Access db via app.extensions within context
        with app.app_context():
            db = app.extensions['sqlalchemy']
            receipt = db.session.query(Receipt).filter_by(id=receipt_id, user_id=user_id).first() # Use the passed user_id to ensure ownership
            if not receipt:
                return jsonify({'error': 'Receipt not found or does not belong to user'}), 404

            db.session.delete(receipt) # Use db from extensions
            db.session.commit() # Use db from extensions
            app.logger.info(f"Receipt {receipt_id} deleted successfully for user {user_id}.")
            return jsonify({'message': 'Receipt deleted'})
    except Exception as e:
        app.logger.error(f"Error deleting receipt {receipt_id} for user {user_id}: {e}")
        return jsonify({'error': 'Failed to delete receipt'}), 500

@receipts_bp.route('/<int:receipt_id>/item-price', methods=['PATCH'])
@token_required
def update_item_price(user_id, receipt_id):
    data = request.get_json()
    item_index = data.get('item_index')
    new_price = data.get('new_price')

    if item_index is None or new_price is None:
        return jsonify({'error': 'Missing item_index or new_price'}), 400

    # Robust float conversion
    try:
        if isinstance(new_price, str):
            new_price = new_price.replace(',', '.')
        new_price = float(new_price)
    except Exception:
        return jsonify({'error': 'Invalid price format'}), 400

    with app.app_context():
        db = app.extensions['sqlalchemy']
        receipt = db.session.query(Receipt).filter_by(id=receipt_id, user_id=user_id).first()
        if not receipt:
            return jsonify({'error': 'Receipt not found or does not belong to user'}), 404
        if not receipt.items or not (0 <= item_index < len(receipt.items)):
            return jsonify({'error': 'Invalid item index'}), 400

        # Update the price and total for the item
        item = receipt.items[item_index]
        try:
            quantity = float(item.get('quantity', 1))
        except Exception:
            quantity = 1
        item['price'] = new_price
        item['total'] = new_price * quantity
        receipt.items[item_index] = item

        # Recalculate receipt total - handle None values properly
        receipt.total = sum(
            float(i.get('total', 0)) if i.get('total') is not None else 0 
            for i in receipt.items
        )

        db.session.commit()
        return jsonify({'success': True, 'receipt': {
            'id': receipt.id,
            'store_category': receipt.store_category,
            'store_name': receipt.store_name,
            'date': receipt.date.strftime('%Y-%m-%d'),
            'total': receipt.total,
            'currency': receipt.user.currency if receipt.user and receipt.user.currency else 'USD',
            'tax_amount': receipt.tax_amount,
            'total_discount': receipt.total_discount,
            'items': receipt.items,
        }})

@receipts_bp.route('/<int:receipt_id>/update-field', methods=['PATCH'])
@token_required
def update_receipt_field(user_id, receipt_id):
    data = request.get_json()
    field = data.get('field')
    value = data.get('value')
    item_index = data.get('item_index')
    item_field = data.get('item_field')
    item_value = data.get('item_value')

    with app.app_context():
        db = app.extensions['sqlalchemy']
        receipt = db.session.query(Receipt).filter_by(id=receipt_id, user_id=user_id).first()
        if not receipt:
            return jsonify({'error': 'Receipt not found or does not belong to user'}), 404

        # Update store_name or date
        if field in ['store_name', 'date', 'store_category']:
            if field == 'store_name':
                if not isinstance(value, str) or not value.strip():
                    return jsonify({'error': 'Invalid store name'}), 400
                receipt.store_name = value.strip()
            elif field == 'date':
                try:
                    # Accept both YYYY-MM-DD and ISO format
                    if isinstance(value, str):
                        if 'T' in value:
                            value = value.split('T')[0]
                        receipt.date = datetime.strptime(value, '%Y-%m-%d').date()
                    else:
                        return jsonify({'error': 'Invalid date format'}), 400
                except Exception:
                    return jsonify({'error': 'Invalid date format'}), 400
            elif field == 'store_category':
                if not isinstance(value, str) or not value.strip():
                    return jsonify({'error': 'Invalid store category'}), 400
                receipt.store_category = value.strip()
            db.session.commit()
            return jsonify({'success': True, 'receipt': {
                'id': receipt.id,
                'store_category': receipt.store_category,
                'store_name': receipt.store_name,
                'date': receipt.date.strftime('%Y-%m-%d'),
                'total': receipt.total,
                'currency': receipt.user.currency if receipt.user and receipt.user.currency else 'USD',
                'tax_amount': receipt.tax_amount,
                'total_discount': receipt.total_discount,
                'items': receipt.items,
                'store_category': receipt.store_category,
            }})

        # Update item fields (name, quantity)
        if item_index is not None and item_field in ['name', 'quantity', 'category']:
            if not receipt.items or not (0 <= item_index < len(receipt.items)):
                return jsonify({'error': 'Invalid item index'}), 400
            item = receipt.items[item_index]
            if item_field == 'name':
                if not isinstance(item_value, str) or not item_value.strip():
                    return jsonify({'error': 'Invalid item name'}), 400
                item['name'] = item_value.strip()
            elif item_field == 'quantity':
                try:
                    qty = float(item_value)
                    if qty <= 0:
                        return jsonify({'error': 'Quantity must be positive'}), 400
                    item['quantity'] = qty
                    # Recalculate total for this item - handle None values properly
                    price = float(item.get('price', 0)) if item.get('price') is not None else 0
                    item['total'] = price * qty
                except Exception:
                    return jsonify({'error': 'Invalid quantity'}), 400
            elif item_field == 'category':
                if not isinstance(item_value, str) or not item_value.strip():
                    return jsonify({'error': 'Invalid category'}), 400
                item['category'] = item_value.strip()
            receipt.items[item_index] = item
            # Recalculate receipt total - handle None values properly
            receipt.total = sum(
                float(i.get('total', 0)) if i.get('total') is not None else 0 
                for i in receipt.items
            )
            db.session.commit()
            return jsonify({'success': True, 'receipt': {
                'id': receipt.id,
                'store_category': receipt.store_category,
                'store_name': receipt.store_name,
                'date': receipt.date.strftime('%Y-%m-%d'),
                'total': receipt.total,
                'currency': receipt.user.currency if receipt.user and receipt.user.currency else 'USD',
                'tax_amount': receipt.tax_amount,
                'total_discount': receipt.total_discount,
                'items': receipt.items,
            }})

        return jsonify({'error': 'Invalid update request'}), 400
