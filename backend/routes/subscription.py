from flask import Blueprint, jsonify, current_app as app, request, redirect
from backend.utils.decorators import token_required
from backend.models import Receipt, User
from datetime import datetime, timedelta
import stripe
import os
import json
import time

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Stripe price IDs
MONTHLY_PRICE_ID = 'price_1RX00ZE9IYgVm0lSJvDKn8Y8'  # Test
YEARLY_PRICE_ID = 'price_1RX00sE9IYgVm0lSsaM5ea9f'   # Test

subscription_bp = Blueprint('subscription', __name__)

@subscription_bp.route('/api/subscription/receipt-count', methods=['GET'])
@token_required
def get_receipt_count(user_id):
    """
    Returns the current number of receipts for the logged-in user, their plan,
    the count of receipts in the last 30 days for basic users, and subscription details.
    """
    try:
        with app.app_context():
            db = app.extensions['sqlalchemy']
            
            user = db.session.query(User).get(user_id)
            if not user:
                app.logger.error(f"User with ID {user_id} not found in DB for receipt count.")
                return jsonify({'message': 'User not found'}), 404

            total_receipt_count = db.session.query(Receipt).filter_by(user_id=user_id).count()
            
            monthly_receipt_count = None
            if user.plan == 'basic':
                thirty_days_ago = datetime.utcnow() - timedelta(days=30)
                monthly_receipt_count = db.session.query(Receipt).filter(
                    Receipt.user_id == user_id,
                    Receipt.date >= thirty_days_ago.date()
                ).count()
            
            # Prepare subscription details
            subscription_details = {
                'next_billing_date': user.next_billing_date.isoformat() if user.next_billing_date else None,
                'subscription_end_date': user.subscription_end_date.isoformat() if user.subscription_end_date else None,
                'subscription_start_date': user.subscription_start_date.isoformat() if user.subscription_start_date else None,
                'subscription_status': user.subscription_status
            }
            
            return jsonify({
                'total_receipt_count': total_receipt_count,
                'monthly_receipt_count': monthly_receipt_count,
                'user_plan': user.plan,
                'subscription_details': subscription_details
            }), 200
    except Exception as e:
        app.logger.error(f"Error fetching receipt count for user {user_id}: {e}")
        return jsonify({'message': 'Error fetching receipt count'}), 500

@subscription_bp.route('/api/subscription/plan', methods=['POST'])
@token_required
def set_user_plan(user_id):
    data = request.get_json()
    if not data or 'plan' not in data:
        return jsonify({'error': 'Missing plan'}), 400
    plan = data['plan']
    allowed_plans = ['basic', 'pro']
    if plan not in allowed_plans:
        return jsonify({'error': 'Invalid plan'}), 400
    with app.app_context():
        db = app.extensions['sqlalchemy']
        user = db.session.query(User).get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.plan = plan
        db.session.commit()
        return jsonify({'success': True, 'plan': user.plan}) 

@subscription_bp.route('/api/subscription/create-subscription-setup', methods=['POST'])
@token_required
def create_subscription_setup(user_id):
    data = request.get_json()
    plan = data.get('plan')
    billing_details = data.get('billing_details', {})
    
    if plan not in ['monthly', 'yearly']:
        return jsonify({'error': 'Invalid plan'}), 400
    
    price_id = MONTHLY_PRICE_ID if plan == 'monthly' else YEARLY_PRICE_ID
    
    try:
        with app.app_context():
            db = app.extensions['sqlalchemy']
            user = db.session.query(User).get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Create or retrieve Stripe customer
            if not hasattr(user, 'stripe_customer_id') or not user.stripe_customer_id:
                customer = stripe.Customer.create(
                    email=user.email,
                    name=billing_details.get('name'),
                )
                user.stripe_customer_id = customer.id
                db.session.commit()
                app.logger.info(f"Created new Stripe customer {customer.id} for user {user_id}")
            else:
                customer = stripe.Customer.retrieve(user.stripe_customer_id)
                app.logger.info(f"Retrieved existing Stripe customer {customer.id} for user {user_id}")
            
            # Get price details to calculate amount
            price = stripe.Price.retrieve(price_id)
            amount = price.unit_amount
            currency = price.currency
            
            # Create payment intent for the subscription
            payment_intent = stripe.PaymentIntent.create(
                amount=amount,
                currency=currency,
                customer=customer.id,
                setup_future_usage='off_session',
                metadata={
                    'user_id': str(user_id),
                    'plan': plan,
                    'price_id': price_id
                }
            )
            
            app.logger.info(f"Created payment intent {payment_intent.id} for user {user_id}")
            
            return jsonify({
                'client_secret': payment_intent.client_secret,
                'payment_intent_id': payment_intent.id,
                'customer_id': customer.id,
                'price_id': price_id,
                'amount': amount,
                'currency': currency
            })
            
    except Exception as e:
        app.logger.error(f"Stripe payment intent setup error: {str(e)}")
        return jsonify({'error': f'Stripe error: {str(e)}'}), 500

@subscription_bp.route('/api/subscription/complete-subscription-payment', methods=['POST'])
@token_required
def complete_subscription_payment(user_id):
    data = request.get_json()
    payment_intent_id = data.get('payment_intent_id')
    
    if not payment_intent_id:
        return jsonify({'error': 'Missing payment intent ID'}), 400
    
    try:
        with app.app_context():
            db = app.extensions['sqlalchemy']
            user = db.session.query(User).get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Retrieve the payment intent to check its status
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            app.logger.info(f"Payment intent {payment_intent_id} status: {payment_intent.status}")
            
            if payment_intent.status == 'succeeded':
                # Get metadata from payment intent
                plan = payment_intent.metadata.get('plan')
                price_id = payment_intent.metadata.get('price_id')
                
                # Create the subscription now that payment is confirmed
                subscription = stripe.Subscription.create(
                    customer=user.stripe_customer_id,
                    items=[{'price': price_id}],
                    default_payment_method=payment_intent.payment_method,
                    metadata={'user_id': str(user_id), 'plan': plan}
                )
                
                # Update user plan and subscription details
                user.plan = 'pro'
                user.stripe_subscription_id = subscription.id
                user.subscription_status = subscription.status
                
                # Handle subscription dates - use created timestamp as start if period dates not available
                if hasattr(subscription, 'current_period_start') and subscription.current_period_start:
                    user.subscription_start_date = datetime.fromtimestamp(subscription.current_period_start)
                else:
                    user.subscription_start_date = datetime.fromtimestamp(subscription.created)
                
                if hasattr(subscription, 'current_period_end') and subscription.current_period_end:
                    user.next_billing_date = datetime.fromtimestamp(subscription.current_period_end)
                else:
                    # If no period end, calculate based on plan (fallback)
                    plan = payment_intent.metadata.get('plan')
                    if plan == 'yearly':
                        user.next_billing_date = user.subscription_start_date + timedelta(days=365)
                    else:  # monthly
                        user.next_billing_date = user.subscription_start_date + timedelta(days=30)
                
                user.subscription_end_date = None  # Clear any previous end date
                
                db.session.commit()
                
                app.logger.info(f"Successfully created subscription {subscription.id} and activated Pro plan for user {user_id}")
                
                return jsonify({
                    'success': True,
                    'subscription_id': subscription.id,
                    'status': subscription.status,
                    'next_billing_date': user.next_billing_date.isoformat(),
                    'message': 'Subscription created successfully'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f'Payment status: {payment_intent.status}',
                    'status': payment_intent.status
                })
        
    except Exception as e:
        app.logger.error(f"Error completing subscription payment: {str(e)}")
        return jsonify({'error': f'Error completing payment: {str(e)}'}), 500


@subscription_bp.route('/api/subscription/stripe-webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    event = None
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except Exception as e:
        app.logger.error(f"Webhook error: {e}")
        return '', 400
    
    # Handle different event types
    if event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        subscription_id = invoice.get('subscription')
        
        if subscription_id:
            try:
                subscription = stripe.Subscription.retrieve(subscription_id)
                user_id = subscription.metadata.get('user_id')
                
                if user_id:
                    with app.app_context():
                        db = app.extensions['sqlalchemy']
                        user = db.session.query(User).get(int(user_id))
                        if user:
                            user.plan = 'pro'
                            user.subscription_status = subscription.status
                            user.next_billing_date = datetime.fromtimestamp(subscription.current_period_end)
                            user.subscription_end_date = None  # Clear end date on successful payment
                            db.session.commit()
                            app.logger.info(f"User {user_id} subscription renewed - next billing: {user.next_billing_date}")
            except Exception as e:
                app.logger.error(f"Error processing webhook for subscription {subscription_id}: {e}")
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        user_id = subscription.metadata.get('user_id')
        
        if user_id:
            try:
                with app.app_context():
                    db = app.extensions['sqlalchemy']
                    user = db.session.query(User).get(int(user_id))
                    if user:
                        user.plan = 'basic'
                        user.subscription_status = 'cancelled'
                        user.subscription_end_date = datetime.fromtimestamp(subscription.current_period_end)
                        user.next_billing_date = None  # Clear next billing date
                        db.session.commit()
                        app.logger.info(f"User {user_id} subscription cancelled - ends on: {user.subscription_end_date}")
            except Exception as e:
                app.logger.error(f"Error processing cancellation webhook for user {user_id}: {e}")
    
    elif event['type'] == 'customer.subscription.updated':
        # Handle subscription updates (plan changes, etc.)
        subscription = event['data']['object']
        user_id = subscription.metadata.get('user_id')
        
        if user_id:
            try:
                with app.app_context():
                    db = app.extensions['sqlalchemy']
                    user = db.session.query(User).get(int(user_id))
                    if user:
                        user.subscription_status = subscription.status
                        if subscription.status == 'active':
                            user.next_billing_date = datetime.fromtimestamp(subscription.current_period_end)
                            user.subscription_end_date = None
                        elif subscription.cancel_at_period_end:
                            # Subscription is set to cancel at period end
                            user.subscription_end_date = datetime.fromtimestamp(subscription.current_period_end)
                        db.session.commit()
                        app.logger.info(f"User {user_id} subscription updated - status: {subscription.status}")
            except Exception as e:
                app.logger.error(f"Error processing subscription update webhook for user {user_id}: {e}")
    
    return '', 200