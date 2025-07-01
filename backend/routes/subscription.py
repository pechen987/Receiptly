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
    the count of receipts in the current calendar month for basic users, and subscription details.
    """
    try:
        with app.app_context():
            db = app.extensions['sqlalchemy']
            
            user = db.session.query(User).get(user_id)
            if not user:
                app.logger.error(f"User with ID {user_id} not found in DB for receipt count.")
                return jsonify({'message': 'User not found'}), 404

            total_receipt_count = db.session.query(Receipt).filter_by(user_id=user_id).count()
            
            current_month_receipt_count = None
            if user.plan == 'basic':
                # Get the first and last day of the current month
                today = datetime.utcnow().date()
                first_day = today.replace(day=1)
                if today.month == 12:
                    next_month = today.replace(year=today.year + 1, month=1, day=1)
                else:
                    next_month = today.replace(month=today.month + 1, day=1)
                # Count receipts for the current month
                current_month_receipt_count = db.session.query(Receipt).filter(
                    Receipt.user_id == user_id,
                    Receipt.date >= first_day,
                    Receipt.date < next_month
                ).count()
            
            # Prepare subscription details
            subscription_details = {
                'next_billing_date': user.next_billing_date.isoformat() if user.next_billing_date else None,
                'subscription_end_date': user.subscription_end_date.isoformat() if user.subscription_end_date else None,
                'subscription_start_date': user.subscription_start_date.isoformat() if user.subscription_start_date else None,
                'subscription_status': user.subscription_status,
                'trial_start_date': user.trial_start_date.isoformat() if user.trial_start_date else None,
                'trial_end_date': user.trial_end_date.isoformat() if user.trial_end_date else None,
                'is_trial_active': user.is_trial_active,
            }
            
            return jsonify({
                'total_receipt_count': total_receipt_count,
                'current_month_receipt_count': current_month_receipt_count,
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
    promotion_code_id = data.get('promotion_code_id')  # Stripe object ID
    
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
            
            # Check if user is eligible for trial
            has_trial = not user.trial_start_date
            discount_info = None
            coupon_id = None  # Always define coupon_id
            if has_trial:
                # Create SetupIntent to collect payment method for trial
                metadata = {
                    'user_id': str(user_id),
                    'plan': plan,
                    'price_id': price_id
                }
                if promotion_code_id:
                    metadata['promotion_code_id'] = promotion_code_id
                    # When validating a promocode, get coupon_id and store it in metadata if present
                    promo = stripe.PromotionCode.retrieve(promotion_code_id)
                    coupon_id = promo.coupon.id if hasattr(promo, 'coupon') else None
                    if coupon_id:
                        metadata['coupon_id'] = coupon_id
                setup_intent = stripe.SetupIntent.create(
                    customer=customer.id,
                    usage='off_session',
                    metadata=metadata
                )
                app.logger.info(f"Created SetupIntent {setup_intent.id} for trial user {user_id}")
                # If a promotion code is provided, fetch its details for the frontend
                if promotion_code_id:
                    coupon = promo.coupon
                    discount_info = {
                        'percent_off': getattr(coupon, 'percent_off', None),
                        'amount_off': getattr(coupon, 'amount_off', None),
                        'currency': getattr(coupon, 'currency', None),
                        'id': promotion_code_id,
                        'code': promo.code
                    }
                return jsonify({
                    'client_secret': setup_intent.client_secret,
                    'setup_intent_id': setup_intent.id,
                    'customer_id': customer.id,
                    'price_id': price_id,
                    'has_trial': True,
                    'intent_type': 'setup_intent',
                    'promotion_code_id': promotion_code_id,
                    'discount_info': discount_info,
                    'coupon_id': coupon_id
                })
            else:
                # User already had trial, create payment intent for immediate payment
                payment_intent_kwargs = {
                    'amount': 390 if plan == 'monthly' else 4000,  # $3.90 or $40.00 in cents
                    'currency': 'usd',
                    'customer': customer.id,
                    'setup_future_usage': 'off_session',
                    'metadata': {
                        'user_id': str(user_id),
                        'plan': plan,
                        'price_id': price_id
                    }
                }
                if promotion_code_id:
                    payment_intent_kwargs['promotion_code'] = promotion_code_id
                    promo = stripe.PromotionCode.retrieve(promotion_code_id)
                    coupon = promo.coupon
                    discount_info = {
                        'percent_off': getattr(coupon, 'percent_off', None),
                        'amount_off': getattr(coupon, 'amount_off', None),
                        'currency': getattr(coupon, 'currency', None),
                        'id': promotion_code_id,
                        'code': promo.code
                    }
                payment_intent = stripe.PaymentIntent.create(**payment_intent_kwargs)
                app.logger.info(f"Created payment intent {payment_intent.id} for user {user_id}")
                return jsonify({
                    'client_secret': payment_intent.client_secret,
                    'payment_intent_id': payment_intent.id,
                    'customer_id': customer.id,
                    'price_id': price_id,
                    'has_trial': False,
                    'amount': payment_intent.amount,
                    'currency': payment_intent.currency,
                    'intent_type': 'payment_intent',
                    'promotion_code_id': promotion_code_id,
                    'discount_info': discount_info,
                    'coupon_id': None
                })
    except Exception as e:
        app.logger.error(f"Stripe subscription setup error: {str(e)}")
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
                plan = payment_intent.metadata.get('plan')
                price_id = payment_intent.metadata.get('price_id')
                promotion_code_id = payment_intent.metadata.get('promotion_code_id')
                coupon_id = payment_intent.metadata.get('coupon_id')

                create_kwargs = {
                    'customer': user.stripe_customer_id,
                    'items': [{'price': price_id}],
                    'default_payment_method': payment_intent.payment_method,
                    'metadata': {'user_id': str(user_id), 'plan': plan}
                }
                if coupon_id:
                    create_kwargs['discounts'] = [{'coupon': coupon_id}]

                subscription = stripe.Subscription.create(**create_kwargs)

                
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
                    'message': 'Subscription created successfully',
                    'coupon_id': coupon_id
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

@subscription_bp.route('/api/subscription/complete-trial-setup', methods=['POST'])
@token_required
def complete_trial_setup(user_id):
    data = request.get_json()
    setup_intent_id = data.get('setup_intent_id')
    
    if not setup_intent_id:
        return jsonify({'error': 'Missing setup intent ID'}), 400
    
    try:
        with app.app_context():
            db = app.extensions['sqlalchemy']
            user = db.session.query(User).get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Retrieve the setup intent to check its status
            setup_intent = stripe.SetupIntent.retrieve(setup_intent_id)
            
            app.logger.info(f"SetupIntent {setup_intent_id} status: {setup_intent.status}")
            
            if setup_intent.status == 'succeeded':
                plan = setup_intent.metadata.get('plan')
                price_id = setup_intent.metadata.get('price_id')
                promotion_code_id = setup_intent.metadata.get('promotion_code_id')
                coupon_id = setup_intent.metadata.get('coupon_id')
                create_kwargs = {
                    'customer': user.stripe_customer_id,
                    'items': [{'price': price_id}],
                    'default_payment_method': setup_intent.payment_method,
                    'trial_period_days': 14,
                    'metadata': {'user_id': str(user_id), 'plan': plan},
                    'expand': ['latest_invoice']
                }
                if coupon_id:
                    create_kwargs['discounts'] = [{'coupon': coupon_id}]
                subscription = stripe.Subscription.create(**create_kwargs)


                
                # Update user with trial information
                user.plan = 'pro'  # Give pro features during trial
                user.stripe_subscription_id = subscription.id
                user.subscription_status = subscription.status
                user.trial_start_date = datetime.utcnow()
                user.trial_end_date = datetime.utcnow() + timedelta(days=14)
                user.is_trial_active = True
                user.subscription_start_date = datetime.fromtimestamp(subscription.created)
                
                # Handle next billing date - use trial_end if available, otherwise calculate
                if hasattr(subscription, 'trial_end') and subscription.trial_end:
                    user.next_billing_date = datetime.fromtimestamp(subscription.trial_end)
                elif hasattr(subscription, 'current_period_end') and subscription.current_period_end:
                    user.next_billing_date = datetime.fromtimestamp(subscription.current_period_end)
                else:
                    # Fallback: calculate based on trial period
                    user.next_billing_date = user.trial_end_date
                
                db.session.commit()
                
                app.logger.info(f"Successfully created trial subscription {subscription.id} for user {user_id}")
                
                return jsonify({
                    'success': True,
                    'subscription_id': subscription.id,
                    'status': subscription.status,
                    'trial_end': user.trial_end_date.isoformat(),
                    'next_billing_date': user.next_billing_date.isoformat(),
                    'message': 'Trial started successfully',
                    'coupon_id': coupon_id
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f'Setup status: {setup_intent.status}',
                    'status': setup_intent.status
                })
        
    except Exception as e:
        app.logger.error(f"Error completing trial setup: {str(e)}")
        return jsonify({'error': f'Error completing setup: {str(e)}'}), 500

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
    
    # Log every incoming event type for traceability
    app.logger.info(f"[Stripe Webhook] Received event: {event['type']}")
    
    # Handle different event types
    if event['type'] == 'customer.subscription.created':
        subscription = event['data']['object']
        user_id = subscription.metadata.get('user_id')
        
        if user_id and subscription.status == 'trialing':
            try:
                with app.app_context():
                    db = app.extensions['sqlalchemy']
                    user = db.session.query(User).get(int(user_id))
                    if user:
                        # Update user trial status and plan
                        user.trial_start_date = datetime.utcnow()
                        user.trial_end_date = datetime.utcnow() + timedelta(days=14)
                        user.is_trial_active = True
                        user.plan = 'pro'  # Give them pro features during trial
                        user.stripe_subscription_id = subscription.id
                        user.subscription_status = subscription.status
                        db.session.commit()
                        app.logger.info(f"Trial started for user {user_id} via webhook")
            except Exception as e:
                app.logger.error(f"Error processing trial creation webhook for user {user_id}: {e}")
    
    elif event['type'] == 'invoice.payment_succeeded':
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
        app.logger.info(f"[Stripe Webhook] customer.subscription.deleted received for user_id={user_id}, subscription_id={subscription.id}, status={subscription.status}, cancel_at_period_end={getattr(subscription, 'cancel_at_period_end', None)}, current_period_end={getattr(subscription, 'current_period_end', None)}")
        app.logger.info(f"[Stripe Webhook] Full subscription object: {json.dumps(dict(subscription), default=str)}")
        
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
        app.logger.info(f"[Stripe Webhook] customer.subscription.updated received for user_id={user_id}, subscription_id={subscription.id}, status={subscription.status}, cancel_at_period_end={getattr(subscription, 'cancel_at_period_end', None)}, current_period_end={getattr(subscription, 'current_period_end', None)}")
        app.logger.info(f"[Stripe Webhook] Full subscription object: {json.dumps(dict(subscription), default=str)}")
        
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
                            # Trial ended successfully, user is now on paid plan
                            user.is_trial_active = False
                        elif subscription.status == 'past_due':
                            # Trial ended but payment failed
                            user.is_trial_active = False
                            user.plan = 'basic'
                        elif subscription.cancel_at_period_end:
                            # Subscription is set to cancel at period end
                            user.subscription_end_date = datetime.fromtimestamp(subscription.current_period_end)
                        db.session.commit()
                        app.logger.info(f"User {user_id} subscription updated - status: {subscription.status}")
            except Exception as e:
                app.logger.error(f"Error processing subscription update webhook for user {user_id}: {e}")
    
    elif event['type'] == 'customer.subscription.trial_will_end':
        # 3 days before trial ends - could send notification
        subscription = event['data']['object']
        user_id = subscription.metadata.get('user_id')
        if user_id:
            app.logger.info(f"Trial will end soon for user {user_id}")
    
    elif event['type'] == 'invoice.payment_failed':
        # Handle failed payments after trial
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
                            # Trial ended but payment failed, downgrade to basic
                            user.plan = 'basic'
                            user.subscription_status = 'past_due'
                            user.is_trial_active = False
                            db.session.commit()
                            app.logger.info(f"User {user_id} trial ended with failed payment - downgraded to basic")
            except Exception as e:
                app.logger.error(f"Error processing payment failure webhook for subscription {subscription_id}: {e}")
    
    return '', 200

@subscription_bp.route('/api/subscription/complete-custom-payment', methods=['POST'])
@token_required
def complete_custom_payment(user_id):
    data = request.get_json()
    client_secret = data.get('client_secret')
    intent_type = data.get('intent_type')  # 'payment_intent' or 'setup_intent'
    
    if not client_secret or not intent_type:
        return jsonify({'error': 'Missing client secret or intent type'}), 400
    
    try:
        with app.app_context():
            db = app.extensions['sqlalchemy']
            user = db.session.query(User).get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            if intent_type == 'payment_intent':
                # Handle PaymentIntent completion
                payment_intent = stripe.PaymentIntent.retrieve(client_secret.split('_secret_')[0])
                
                if payment_intent.status == 'succeeded':
                    # Get metadata from payment intent
                    plan = payment_intent.metadata.get('plan')
                    price_id = payment_intent.metadata.get('price_id')
                    promotion_code_id = payment_intent.metadata.get('promotion_code_id')
                    coupon_id = payment_intent.metadata.get('coupon_id')
                    
                    create_kwargs = {
                        'customer': user.stripe_customer_id,
                        'items': [{'price': price_id}],
                        'default_payment_method': payment_intent.payment_method,
                        'trial_period_days': 14,
                        'metadata': {'user_id': str(user_id), 'plan': plan}
                    }
                    if coupon_id:
                        create_kwargs['discounts'] = [{'coupon': coupon_id}]
                    subscription = stripe.Subscription.create(**create_kwargs)
                    
                    # Update user plan and subscription details
                    user.plan = 'pro'
                    user.stripe_subscription_id = subscription.id
                    user.subscription_status = subscription.status
                    
                    # Handle subscription dates
                    if hasattr(subscription, 'current_period_start') and subscription.current_period_start:
                        user.subscription_start_date = datetime.fromtimestamp(subscription.current_period_start)
                    else:
                        user.subscription_start_date = datetime.fromtimestamp(subscription.created)
                    
                    if hasattr(subscription, 'current_period_end') and subscription.current_period_end:
                        user.next_billing_date = datetime.fromtimestamp(subscription.current_period_end)
                    else:
                        plan = payment_intent.metadata.get('plan')
                        if plan == 'yearly':
                            user.next_billing_date = user.subscription_start_date + timedelta(days=365)
                        else:
                            user.next_billing_date = user.subscription_start_date + timedelta(days=30)
                    
                    user.subscription_end_date = None
                    
                    db.session.commit()
                    
                    return jsonify({
                        'success': True,
                        'subscription_id': subscription.id,
                        'status': subscription.status,
                        'next_billing_date': user.next_billing_date.isoformat(),
                        'message': 'Subscription created successfully',
                        'coupon_id': coupon_id
                    })
                else:
                    return jsonify({
                        'success': False,
                        'error': f'Payment status: {payment_intent.status}',
                        'status': payment_intent.status
                    })
            
            elif intent_type == 'setup_intent':
                # Handle SetupIntent completion
                setup_intent = stripe.SetupIntent.retrieve(client_secret.split('_secret_')[0])
                
                if setup_intent.status == 'succeeded':
                    # Get metadata from setup intent
                    plan = setup_intent.metadata.get('plan')
                    price_id = setup_intent.metadata.get('price_id')
                    promotion_code_id = setup_intent.metadata.get('promotion_code_id')
                    coupon_id = setup_intent.metadata.get('coupon_id')
                    
                    # Create the subscription with trial period
                    create_kwargs = {
                        'customer': user.stripe_customer_id,
                        'items': [{'price': price_id}],
                        'default_payment_method': setup_intent.payment_method,
                        'trial_period_days': 14,
                        'metadata': {'user_id': str(user_id), 'plan': plan},
                        'expand': ['latest_invoice']
                    }
                    if coupon_id:
                        create_kwargs['discounts'] = [{'coupon': coupon_id}]
                    subscription = stripe.Subscription.create(**create_kwargs)
                    
                    # Update user with trial information
                    user.plan = 'pro'
                    user.stripe_subscription_id = subscription.id
                    user.subscription_status = subscription.status
                    user.trial_start_date = datetime.utcnow()
                    user.trial_end_date = datetime.utcnow() + timedelta(days=14)
                    user.is_trial_active = True
                    user.subscription_start_date = datetime.fromtimestamp(subscription.created)
                    
                    # Handle next billing date
                    if hasattr(subscription, 'trial_end') and subscription.trial_end:
                        user.next_billing_date = datetime.fromtimestamp(subscription.trial_end)
                    elif hasattr(subscription, 'current_period_end') and subscription.current_period_end:
                        user.next_billing_date = datetime.fromtimestamp(subscription.current_period_end)
                    else:
                        user.next_billing_date = user.trial_end_date
                    
                    db.session.commit()
                    
                    return jsonify({
                        'success': True,
                        'subscription_id': subscription.id,
                        'status': subscription.status,
                        'trial_end': user.trial_end_date.isoformat(),
                        'next_billing_date': user.next_billing_date.isoformat(),
                        'message': 'Trial started successfully',
                        'coupon_id': coupon_id
                    })
                else:
                    return jsonify({
                        'success': False,
                        'error': f'Setup status: {setup_intent.status}',
                        'status': setup_intent.status
                    })
            else:
                return jsonify({'error': 'Invalid intent type'}), 400
        
    except Exception as e:
        app.logger.error(f"Error completing custom payment: {str(e)}")
        return jsonify({'error': f'Error completing payment: {str(e)}'}), 500

@subscription_bp.route('/api/subscription/customer-portal', methods=['POST'])
@token_required
def create_customer_portal(user_id):
    with app.app_context():
        db = app.extensions['sqlalchemy']
        user = db.session.query(User).get(user_id)
        if not user or not user.stripe_customer_id:
            return jsonify({'error': 'User not found or no Stripe customer'}), 404

        # Set your app's return URL here (web or deep link)
        return_url = os.environ.get('CUSTOMER_PORTAL_RETURN_URL', 'https://your-app.com/profile')
        session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=return_url
        )
        return jsonify({'url': session.url})

@subscription_bp.route('/api/subscription/validate-promocode', methods=['POST'])
@token_required
def validate_promocode(user_id):
    data = request.get_json()
    code = data.get('promo_code')
    if not code:
        return jsonify({'valid': False, 'message': 'No code provided'}), 400
    try:
        # Look up PromotionCode in Stripe
        # Stripe API: retrieve promotion codes by code string
        # Note: stripe.PromotionCode.list filters by coupon ID or promotion code? 
        # PromotionCode has 'code' attribute. We can list with active ones matching.
        resp = stripe.PromotionCode.list(code=code, limit=1)
        if resp.data and len(resp.data) > 0:
            promo = resp.data[0]
            if promo.active:
                # you can also inspect promo.expires_at, redeem_by, etc.
                return jsonify({
                    'valid': True,
                    'promotion_code_id': promo.id,
                    'coupon': promo.coupon.id,
                    'percent_off': getattr(promo.coupon, 'percent_off', None),
                    'amount_off': getattr(promo.coupon, 'amount_off', None),
                    'currency': getattr(promo.coupon, 'currency', None),
                    'expires_at': promo.expires_at,
                })
        return jsonify({'valid': False, 'message': 'Invalid or expired promocode'}), 200
    except Exception as e:
        app.logger.error(f"Error validating promocode {code}: {e}")
        return jsonify({'valid': False, 'message': 'Error validating promocode'}), 500
