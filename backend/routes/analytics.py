from flask import Blueprint, request, jsonify, current_app as app, send_file
from datetime import datetime, timedelta
from sqlalchemy import func
from flask_cors import cross_origin
import json
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle, SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import traceback
from reportlab.lib.colors import HexColor

# Import necessary components from the backend application
# Import models and error classes
from backend.models import User, Receipt, WidgetOrder
from backend.errors import AuthenticationError, APIError

# Import the token_required decorator
from backend.utils.decorators import token_required

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')

@analytics_bp.route('/spend', methods=['GET'])
@cross_origin()
@token_required
def get_spend_analytics(user_id):
    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        interval = request.args.get('interval', 'monthly')  # daily, weekly, monthly

        app.logger.info(f"[Analytics] Spend analytics request - user_id: {user_id}, interval: {interval}")
        app.logger.info(f"[Analytics] Request headers: {request.headers}")
        app.logger.info(f"[Analytics] Request args: {request.args}")

        if not user_id:
            app.logger.warning("[Analytics] Missing user_id in request")
            return jsonify({'error': 'Missing user_id'}), 400

        # Define time formatting based on interval
        if interval == 'daily':
            date_format = '%Y-%m-%d'
            group_by = func.strftime('%Y-%m-%d', Receipt.date)
        elif interval == 'weekly':
            date_format = '%Y-W%W'
            group_by = func.strftime('%Y-W%W', Receipt.date)
        else:
            date_format = '%Y-%m'
            group_by = func.strftime('%Y-%m', Receipt.date)

        try:
            app.logger.info(f"[Analytics] Fetching spend analytics for user {user_id} with interval {interval}")
            period_results = (
                db.session.query(
                    group_by.label('period'),
                    func.sum(Receipt.total).label('total_spent')
                )
                .filter(Receipt.user_id == user_id)
                .group_by('period')
                .order_by('period')
                .all()
            )
            # Fetch user currency
            user = db.session.query(User).get(user_id) # Use db from extensions
            user_currency = user.currency if user and user.currency else 'USD'
            response = [
                {'period': period, 'total_spent': round(total, 4)}
                for period, total in period_results
            ]
            app.logger.info(f"[Analytics] Found {len(response)} periods of data")
            return jsonify({'currency': user_currency, 'data': response})

        except Exception as e:
            app.logger.error(f"[Analytics] Error fetching analytics: {e}")
            return jsonify({'error': 'Internal server error'}), 500

@analytics_bp.route('/top-products', methods=['GET'])
@cross_origin()
@token_required
def get_top_products(user_id):
     # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        limit = request.args.get('limit', 10, type=int)
        period = request.args.get('period', 'month')  # month, year, all

        app.logger.info(f"[Analytics] Top products request - user_id: {user_id}, period: {period}")
        app.logger.info(f"[Analytics] Request headers: {request.headers}")
        app.logger.info(f"[Analytics] Request args: {request.args}")

        if not user_id:
            app.logger.warning("[Analytics] Missing user_id in request")
            return jsonify({'error': 'Missing user_id'}), 400
        try:
            # Calculate date range based on period
            today = datetime.utcnow().date() # Use today's date
            if period == 'month':
                start_date = today - timedelta(days=30)  # Last 30 days from today
            elif period == 'year':
                start_date = today - timedelta(days=365)  # Rolling last 365 days
            else:  # all time
                start_date = None

            # Base query
            query = db.session.query(
                Receipt.items,
                Receipt.date,
                Receipt.id
            ).filter(
                Receipt.user_id == user_id,
                Receipt.items.isnot(None)
            )
            # Add date filter if needed
            if start_date:
                query = query.filter(Receipt.date >= start_date)

            receipts = query.all()
            total_receipts = len(receipts)

            # Check if user has any receipts at all
            any_receipts = db.session.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.items.isnot(None)
            ).count() > 0

            if total_receipts == 0:
                return jsonify({
                    'period': period,
                    'products': [],
                    'total_receipts': 0,
                    'has_data': any_receipts
                })

            # Process items to count product occurrences across receipts
            product_receipt_counts = {}  # Will store {product_name: {'count': int, 'category': str}}
            for receipt in receipts:
                if not receipt.items:
                    continue
                # Get unique product names in this receipt
                products_in_receipt = {}  # {product_name: category}
                for item in receipt.items:
                    if not item or not item.get('name'):
                        continue
                    product_name = item['name'].strip()
                    category = item.get('category', 'Other')
                    if not product_name:
                        continue
                    products_in_receipt[product_name] = category

                # Count each unique product once per receipt
                for product_name, category in products_in_receipt.items():
                    if product_name in product_receipt_counts:
                        product_receipt_counts[product_name]['count'] += 1
                    else:
                        product_receipt_counts[product_name] = {
                            'count': 1,
                            'category': category
                        }

            # Calculate percentages and sort by count (descending)
            sorted_products = []
            for name, data in product_receipt_counts.items():
                percentage = (data['count'] / total_receipts) * 100
                sorted_products.append({
                    'name': name,
                    'count': data['count'],
                    'percentage': round(percentage, 1),
                    'category': data['category']
                })

            # Sort by count (descending) and take top N
            sorted_products.sort(key=lambda x: x['count'], reverse=True)
            top_products = sorted_products[:limit]

            return jsonify({
                'period': period,
                'products': top_products,
                'total_receipts': total_receipts,
                'has_data': any_receipts
            })
        except Exception as e:
            app.logger.error(f"Error fetching top products: {e}")
            return jsonify({'error': 'Internal server error'}), 500

@analytics_bp.route('/most-expensive-products', methods=['GET'])
@cross_origin()
@token_required
def get_most_expensive_products(user_id):
    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        limit = request.args.get('limit', 8, type=int)
        period = request.args.get('period', 'month')  # month, year, all

        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        try:
            # Calculate date range based on period
            today = datetime.utcnow().date() # Use today's date
            if period == 'month':
                start_date = today - timedelta(days=30)  # Last 30 days from today
            elif period == 'year':
                start_date = today - timedelta(days=365)  # Rolling last 365 days
            else:  # all time
                start_date = None

            # Base query
            query = db.session.query(
                Receipt.items,
                Receipt.date,
                Receipt.id
            ).filter(
                Receipt.user_id == user_id,
                Receipt.items.isnot(None)
            )
            # Add date filter if needed
            if start_date:
                query = query.filter(Receipt.date >= start_date)

            receipts = query.all()

            # Check if user has any receipts at all
            any_receipts = db.session.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.items.isnot(None)
            ).count() > 0

            if len(receipts) == 0:
                return jsonify({
                    'period': period,
                    'products': [],
                    'currency': user_currency if 'user_currency' in locals() else 'USD',
                    'has_data': any_receipts
                })

            # Process items to find most expensive products and count occurrences
            product_data = {}  # Will store {product_name: {'max_price': float, 'count': int, 'category': str}}
            for receipt in receipts:
                if not receipt.items:
                    continue
                for item in receipt.items:
                    if not item or not item.get('name') or not item.get('price'):
                        continue
                    product_name = item['name'].strip()
                    # Ensure price is treated as float
                    try:
                         price = float(item.get('price', 0))
                    except (ValueError, TypeError):
                         price = 0.0 # Handle cases where price is not a valid number

                    category = item.get('category', 'Other')  # Default to Other if no category

                    if not product_name or price <= 0: # Skip if no name or invalid price
                        continue

                    # Initialize or update product data
                    if product_name in product_data:
                        # Update max price if this one is higher
                        if price > product_data[product_name]['max_price']:
                            product_data[product_name]['max_price'] = price
                            product_data[product_name]['category'] = category  # Update category with the highest price instance
                        # Increment count
                        product_data[product_name]['count'] += 1
                    else:
                        # First time seeing this product
                        product_data[product_name] = {
                            'max_price': price,
                            'count': 1,
                            'category': category
                        }

            # Sort by max price (descending) and take top N
            sorted_products = []
            for name, data in product_data.items():
                sorted_products.append({
                    'name': name,
                    'price': round(data['max_price'], 2),
                    'count': data['count'],
                    'category': data['category']
                })

            sorted_products.sort(key=lambda x: x['price'], reverse=True)
            top_expensive = sorted_products[:limit]

            # Get user currency
            user = db.session.query(User).get(user_id) # Use db from extensions
            user_currency = user.currency if user and user.currency else 'USD'

            return jsonify({
                'period': period,
                'products': top_expensive,
                'currency': user_currency,
                'has_data': any_receipts
            })
        except Exception as e:
            app.logger.error(f"Error fetching most expensive products: {e}")
            return jsonify({'error': 'Internal server error'}), 500

@analytics_bp.route('/expenses-by-category', methods=['GET'])
@token_required
def expenses_by_category(user_id):
    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        period = request.args.get('period', 'week')  # week, month, all

        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
        try:
            today = datetime.utcnow().date()
            if period == 'week':
                start_date = today - timedelta(days=7)
            elif period == 'month':
                start_date = today - timedelta(days=30)
            else:
                start_date = None

            # Query receipts
            query = db.session.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.items.isnot(None)
            )

            if start_date:
                # Use Receipt.created_at or Receipt.date for filtering, assuming Receipt.date is the transaction date
                query = query.filter(Receipt.date >= start_date)

            receipts = query.all()

            # Check if user has any receipts at all
            any_receipts = db.session.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.items.isnot(None)
            ).count() > 0

            category_totals = {}
            for receipt in receipts:
                items = receipt.items or []
                for item in items:
                    category = item.get('category', 'Other')
                    item_total = item.get('total', 0) # Use item total, not unit price
                    try:
                        item_total = float(item_total)
                    except Exception:
                        item_total = 0
                    if not category:
                        category = 'Other'
                    if category in category_totals:
                        category_totals[category] += item_total
                    else:
                        category_totals[category] = item_total

            # Format result
            result = [
                {'category': cat, 'total': round(total, 2)}
                for cat, total in category_totals.items()
            ]

            # Sort by total descending
            result.sort(key=lambda x: x['total'], reverse=True)

            # Get user currency
            user = db.session.query(User).get(user_id) # Use db from extensions
            user_currency = user.currency if user and user.currency else 'USD'

            return jsonify({'categories': result, 'currency': user_currency, 'has_data': any_receipts})
        except Exception as e:
            app.logger.error(f"Error in expenses_by_category: {e}")
            return jsonify({'error': 'Internal server error'}), 500

@analytics_bp.route('/receipts-by-date', methods=['GET'])
@token_required
def get_receipts_by_date(user_id):
    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        date = request.args.get('date')
        interval = request.args.get('interval', 'weekly')  # daily, weekly, monthly
        
        if not user_id or not date:
            return jsonify({'error': 'Missing user_id or date'}), 400
            
        try:
            # Parse the date based on interval
            if interval == 'daily':
                start_date = datetime.strptime(date, '%Y-%m-%d').date()
                end_date = start_date
            elif interval == 'weekly':
                # Assuming date format is 'YYYY-WW'
                year, week = map(int, date.split('-W'))
                start_date = datetime.strptime(f'{year}-W{week}-1', '%Y-W%W-%w').date()
                end_date = start_date + timedelta(days=6)
            else:  # monthly
                # Assuming date format is 'YYYY-MM'
                year, month = map(int, date.split('-'))
                start_date = datetime(year, month, 1).date()
                if month == 12:
                    end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
                else:
                    end_date = datetime(year, month + 1, 1).date() - timedelta(days=1)
            
            # Query receipts for the date range
            receipts = db.session.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.date >= start_date,
                Receipt.date <= end_date
            ).order_by(Receipt.date.desc()).all()
            
            # Format response
            formatted_receipts = [{
                'id': r.id,
                'store_name': r.store_name,
                'store_category': r.store_category,
                'date': r.date.strftime('%Y-%m-%d'),
                'total': r.total,
                'currency': r.user.currency if r.user and r.user.currency else 'USD',
                'tax_amount': r.tax_amount,
                'total_discount': r.total_discount,
                'items': r.items
            } for r in receipts]
            
            return jsonify({'receipts': formatted_receipts})
            
        except Exception as e:
            app.logger.error(f"Error fetching receipts by date: {e}")
            return jsonify({'error': 'Internal server error'}), 500

@analytics_bp.route('/products-by-category', methods=['GET'])
@cross_origin()
@token_required
def get_products_by_category(user_id):
     # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        category = request.args.get('category')
        period = request.args.get('period', 'week')  # week, month, all
        
        if not user_id or not category:
            return jsonify({'error': 'Missing user_id or category'}), 400
            
        try:
            # Calculate date range based on period
            today = datetime.utcnow().date()
            if period == 'week':
                start_date = today - timedelta(days=7)
            elif period == 'month':
                start_date = today - timedelta(days=30)
            else:  # all
                start_date = None
                
            # Query receipts
            query = db.session.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.items.isnot(None)
            )
            
            if start_date:
                # Use Receipt.created_at or Receipt.date for filtering, assuming Receipt.date is the transaction date
                query = query.filter(Receipt.date >= start_date)
                
            receipts = query.all()
            
            # Check if user has any receipts at all
            any_receipts = db.session.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.items.isnot(None)
            ).count() > 0
            
            # Process items to find and group products in the specified category
            product_groups = {}  # {(name, price): {'quantity': total_qty, 'total': total_price}}
            for receipt in receipts:
                if not receipt.items:
                    continue
                for item in receipt.items:
                    if item.get('category') == category:
                        name = item.get('name', '')
                        price = float(item.get('price', 0))
                        quantity = float(item.get('quantity', 1))
                        total = float(item.get('total', 0))
                        
                        # Use (name, price) as key to group identical products
                        key = (name, price)
                        if key in product_groups:
                            product_groups[key]['quantity'] += quantity
                            product_groups[key]['total'] += total
                        else:
                            product_groups[key] = {
                                'quantity': quantity,
                                'total': total
                            }
            
            # Convert grouped products to list format
            products = [
                {
                    'name': name,
                    'quantity': round(data['quantity'], 2),
                    'price': price,
                    'total': round(data['total'], 2)
                }
                for (name, price), data in product_groups.items()
            ]
            
            # Sort by total price descending
            products.sort(key=lambda x: x['total'], reverse=True)
            
            # Get user currency
            user = db.session.query(User).get(user_id) # Use db from extensions
            user_currency = user.currency if user and user.currency else 'USD'
            
            return jsonify({
                'items': products,
                'currency': user_currency,
                'has_data': any_receipts
            })
            
        except Exception as e:
            app.logger.error(f"Error fetching products by category: {e}")
            return jsonify({'error': 'Internal server error'}), 500

@analytics_bp.route('/shopping-days', methods=['GET'])
@cross_origin()
@token_required
def get_shopping_days(user_id):
     # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        period = request.args.get('period', 'month')  # month, all
        
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
            
        try:
            # Calculate date range based on period
            today = datetime.utcnow().date()
            if period == 'month':
                start_date = today - timedelta(days=30)
            else:  # all time
                start_date = None
                
            # Query receipts
            query = db.session.query(Receipt).filter(
                Receipt.user_id == user_id
            )
            
            if start_date:
                # Use Receipt.created_at or Receipt.date for filtering, assuming Receipt.date is the transaction date
                query = query.filter(Receipt.date >= start_date)
                
            receipts = query.all()
            
            # Check if user has any receipts at all
            any_receipts = db.session.query(Receipt).filter(
                Receipt.user_id == user_id
            ).count() > 0
            
            # Initialize counts for each day of week (0 = Monday, 6 = Sunday)
            day_counts = {i: 0 for i in range(7)}
            
            # Count receipts for each day of week
            for receipt in receipts:
                day_of_week = receipt.date.weekday()  # 0 = Monday, 6 = Sunday
                day_counts[day_of_week] += 1
                
            # Format response with day names
            day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            result = [
                {
                    'day': day_names[i],
                    'count': count
                }
                for i, count in day_counts.items()
            ]
            
            return jsonify({
                'period': period,
                'data': result,
                'has_data': any_receipts
            })
            
        except Exception as e:
            app.logger.error(f"Error fetching shopping days: {e}")
            return jsonify({'error': 'Internal server error'}), 500

@analytics_bp.route('/bill-stats', methods=['GET'])
@cross_origin()
@token_required
def get_bill_stats(user_id):
     # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        interval = request.args.get('interval', 'M')  # M for monthly, All for all time
        
        if not user_id:
            return jsonify({'error': 'Missing user_id'}), 400
            
        try:
            today = datetime.utcnow().date()
            
            # Calculate current period stats
            if interval == 'M':
                start_date = today - timedelta(days=30)
                query = db.session.query(Receipt).filter(
                    Receipt.user_id == user_id,
                    Receipt.date >= start_date
                )
            else:  # All time
                query = db.session.query(Receipt).filter(Receipt.user_id == user_id)
                
            current_receipts = query.all()
            
            # Check if user has any receipts at all
            any_receipts = db.session.query(Receipt).filter(
                Receipt.user_id == user_id
            ).count() > 0
            
            # Calculate current period metrics
            total_receipts = len(current_receipts)
            total_amount = sum(r.total for r in current_receipts)
            avg_bill = total_amount / total_receipts if total_receipts > 0 else 0
            
            # Calculate previous period comparison (only for monthly view)
            avg_bill_delta = None
            if interval == 'M':
                prev_start_date = start_date - timedelta(days=30)
                prev_end_date = start_date - timedelta(days=1)
                
                prev_receipts = db.session.query(Receipt).filter(
                    Receipt.user_id == user_id,
                    Receipt.date >= prev_start_date,
                    Receipt.date <= prev_end_date
                ).all()
                
                # Only calculate delta if there are receipts in both periods
                if prev_receipts and current_receipts:
                    prev_total = sum(r.total for r in prev_receipts)
                    prev_count = len(prev_receipts)
                    prev_avg = prev_total / prev_count
                    avg_bill_delta = avg_bill - prev_avg
            
            # Get user currency
            user = db.session.query(User).get(user_id) # Use db from extensions
            user_currency = user.currency if user and user.currency else 'USD'
            
            return jsonify({
                'total_receipts': total_receipts,
                'average_bill': round(avg_bill, 2),
                'average_bill_delta': round(avg_bill_delta, 2) if avg_bill_delta is not None else None,
                'currency': user_currency,
                'has_data': any_receipts
            })
            
        except Exception as e:
            app.logger.error(f"Error calculating bill stats: {e}")
            return jsonify({'error': 'Internal server error'}), 500

@analytics_bp.route('/widget-order', methods=['GET'])
@cross_origin()
@token_required
def get_widget_order(user_id):
    # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        if not user_id:
            # This case should ideally be caught by @token_required, but good for robustness
            app.logger.warning("User ID missing in token for widget order request.")
            raise AuthenticationError('User ID is required')
        
        try:
            # Default order if none exists
            default_order = [
                'bill_stats',
                'total_spent',
                'expenses_by_category',
                'top_products',
                'most_expensive',
                'shopping_days'
            ]

            # Try to get the user's saved order
            widget_order = db.session.query(WidgetOrder).filter_by(user_id=user_id).first() # Use db from extensions
            
            if widget_order:
                return jsonify({'order': widget_order.order})
            else:
                # If no order exists, create one with default order
                new_widget_order = WidgetOrder(user_id=user_id, order=default_order)
                db.session.add(new_widget_order) # Use db from extensions
                db.session.commit() # Use db from extensions
                return jsonify({'order': default_order})
        except Exception as e:
            app.logger.error(f"Error getting widget order: {str(e)}")
            # Re-raise as APIError for consistent error handling
            raise APIError('Failed to get widget order')

@analytics_bp.route('/widget-order', methods=['POST'])
@cross_origin()
@token_required
def save_widget_order(user_id):
     # Access db via app.extensions within context
    with app.app_context():
        db = app.extensions['sqlalchemy']
        if not user_id:
            # This case should ideally be caught by @token_required
            app.logger.warning("User ID missing in token for saving widget order.")
            raise AuthenticationError('User ID is required')
        
        data = request.json
        if not data or 'order' not in data:
            raise ValidationError('Widget order is required')
        
        try:
            # Try to get existing order
            widget_order = db.session.query(WidgetOrder).filter_by(user_id=user_id).first() # Use db from extensions
            
            if widget_order:
                # Update existing order
                widget_order.order = data['order']
            else:
                # Create new order with default if not provided
                default_order = [
                    'bill_stats',
                    'total_spent',
                    'expenses_by_category',
                    'top_products',
                    'most_expensive',
                    'shopping_days'
                ]
                widget_order = WidgetOrder(user_id=user_id, order=data.get('order', default_order))
                db.session.add(widget_order) # Use db from extensions
            
            db.session.commit() # Use db from extensions
            return jsonify({'message': 'Widget order saved successfully'})
        except Exception as e:
            app.logger.error(f"Error saving widget order: {str(e)}")
            # Re-raise as APIError for consistent error handling
            raise APIError('Failed to save widget order')

@analytics_bp.route('/export-pdf', methods=['POST'])
@token_required
def export_analytics_pdf(user_id):
    app.logger.info(f"[Export PDF] Called by user_id: {user_id}")
    try:
        data = request.get_json()
        user_plan = data.get('user_plan', 'basic')
        analytics_data = data.get('data', {})
        export_date = data.get('export_date')
        app.logger.info(f"[Export PDF] user_plan: {user_plan}, export_date: {export_date}")

        # Set up PDF buffer
        buffer = io.BytesIO()
        styles = getSampleStyleSheet()
        title_style = styles['Title']
        h2_style = styles['Heading2']
        h3_style = styles['Heading3']
        normal_style = styles['BodyText']

        # Custom styles
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.units import inch
        app_name_style = ParagraphStyle(
            'AppName',
            parent=title_style,
            fontSize=28,
            leading=34,
            alignment=TA_CENTER,
            textColor=colors.white,
            spaceAfter=12,
            spaceBefore=0,
        )
        export_title_style = ParagraphStyle(
            'ExportTitle',
            parent=title_style,
            fontSize=20,
            leading=26,
            alignment=TA_CENTER,
            textColor=colors.white,
            spaceAfter=8,
            spaceBefore=0,
        )
        # Override h2_style for table titles to be white
        h2_white_style = ParagraphStyle(
            'H2White',
            parent=h2_style,
            textColor=colors.white
        )
        export_date_style = ParagraphStyle(
            'ExportDate',
            parent=normal_style,
            textColor=colors.white
        )

        # Define background color
        background_color = HexColor('#202338')  # Soft dark blue
        # Define a function to draw the background on each page
        def draw_background(canvas, doc):
            canvas.saveState()
            canvas.setFillColor(background_color)
            canvas.rect(0, 0, doc.pagesize[0], doc.pagesize[1], fill=1, stroke=0)
            canvas.restoreState()

        # Build content
        elements = []
        # App name at the top
        elements.append(Paragraph('Receiptly', app_name_style))
        # Export title and date
        elements.append(Paragraph('Analytics Export', export_title_style))
        elements.append(Paragraph(f'Exported: {export_date[:10]}', export_date_style))
        elements.append(Spacer(1, 18))

        # Define which charts to export by plan
        chart_map = {
            'bill_stats': 'Bill Stats',
            'total_spent': 'Total Spent',
            'by_category': 'By Category',
            'top_products': 'Top Products',
            'most_expensive': 'Most Expensive Products',
            'shopping_days': 'Shopping Days',
        }
        if user_plan == 'basic':
            charts = ['bill_stats', 'total_spent', 'by_category']
        else:
            charts = list(chart_map.keys())

        # Helper to add a table for a chart/interval
        def add_table(title, headers, rows):
            elements.append(Paragraph(title, h2_white_style))
            t = Table([headers] + rows, hAlign='LEFT')
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), HexColor('#7e5cff')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), HexColor('#232642')),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.white),  # Body text white
                ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#2d3748')),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 16))

        # Bill Stats
        if 'bill_stats' in charts:
            for interval, stats in analytics_data.get('bill_stats', {}).items():
                if stats.get('error') or not stats.get('has_data'):
                    continue
                headers = ['Interval', 'Total Receipts', 'Average Bill', 'Delta (vs prev)']
                rows = [[interval, stats.get('total_receipts', ''), stats.get('average_bill', ''), stats.get('average_bill_delta', '')]]
                add_table(f'Bill Stats ({interval})', headers, rows)

        # Total Spent
        if 'total_spent' in charts:
            for interval, data in analytics_data.get('total_spent', {}).items():
                if data.get('error') or not data.get('data'):
                    continue
                headers = ['Period', 'Total Spent']
                rows = [[row.get('period', ''), row.get('total_spent', '')] for row in data.get('data', [])]
                if rows:
                    add_table(f'Total Spent ({interval})', headers, rows)

        # By Category
        if 'by_category' in charts:
            for interval, data in analytics_data.get('by_category', {}).items():
                if data.get('error') or not data.get('categories'):
                    continue
                headers = ['Category', 'Total']
                rows = [[row.get('category', ''), row.get('total', '')] for row in data.get('categories', [])]
                if rows:
                    add_table(f'By Category ({interval})', headers, rows)

        # Top Products
        if 'top_products' in charts:
            for interval, data in analytics_data.get('top_products', {}).items():
                if data.get('error') or not data.get('products'):
                    continue
                headers = ['Product', 'Count', 'Percentage', 'Category']
                rows = [[row.get('name', ''), row.get('count', ''), row.get('percentage', ''), row.get('category', '')] for row in data.get('products', [])]
                if rows:
                    add_table(f'Top Products ({interval})', headers, rows)

        # Most Expensive Products
        if 'most_expensive' in charts:
            for interval, data in analytics_data.get('most_expensive', {}).items():
                if data.get('error') or not data.get('products'):
                    continue
                headers = ['Product', 'Max Price', 'Count', 'Category']
                rows = [[row.get('name', ''), row.get('price', ''), row.get('count', ''), row.get('category', '')] for row in data.get('products', [])]
                if rows:
                    add_table(f'Most Expensive Products ({interval})', headers, rows)

        # Shopping Days
        if 'shopping_days' in charts:
            for interval, data in analytics_data.get('shopping_days', {}).items():
                if data.get('error') or not data.get('data'):
                    continue
                headers = ['Day', 'Count']
                rows = [[row.get('day', ''), row.get('count', '')] for row in data.get('data', [])]
                if rows:
                    add_table(f'Shopping Days ({interval})', headers, rows)

        # If no data, add a message
        if len(elements) <= 4:
            elements.append(Paragraph('No analytics data available for export.', normal_style))

        # Build PDF with background on each page
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        doc.build(elements, onFirstPage=draw_background, onLaterPages=draw_background)
        buffer.seek(0)
        app.logger.info("[Export PDF] PDF generated successfully, sending file.")
        return send_file(
            buffer,
            as_attachment=True,
            download_name='analytics_export.pdf',
            mimetype='application/pdf'
        )
    except Exception as e:
        app.logger.error(f"Error generating analytics PDF: {e}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Failed to generate PDF'}), 500
