from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.ext.mutable import MutableList

db = SQLAlchemy()  # Only create the instance, do not bind to app

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    email_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    currency = db.Column(db.String(3), default='USD')
    plan = db.Column(db.String(50), default='basic', nullable=False)
    stripe_customer_id = db.Column(db.String(64), nullable=True)  # For Stripe integration
    stripe_subscription_id = db.Column(db.String(64), nullable=True)
    subscription_start_date = db.Column(db.DateTime, nullable=True)
    next_billing_date = db.Column(db.DateTime, nullable=True)
    subscription_end_date = db.Column(db.DateTime, nullable=True)  # For cancelled subscriptions
    subscription_status = db.Column(db.String(20), nullable=True)  # active, cancelled, etc.

    trial_start_date = db.Column(db.DateTime, nullable=True)
    trial_end_date = db.Column(db.DateTime, nullable=True)
    is_trial_active = db.Column(db.Boolean, default=False)

    has_completed_onboarding = db.Column(db.Boolean, default=False, nullable=False)
    onboarding_goals = db.Column(db.JSON, nullable=True)
    onboarding_features = db.Column(db.JSON, nullable=True)
    onboarding_completed_at = db.Column(db.DateTime, nullable=True)

    # Optional: One-to-many relationship
    receipts = db.relationship('Receipt', backref='user', lazy=True)
    widget_order = db.relationship('WidgetOrder', backref='user', uselist=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password, method='pbkdf2:sha256')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Receipt(db.Model):
    __table_args__ = (
        db.UniqueConstraint('user_id', 'fingerprint', name='uix_user_fingerprint'),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    store_category = db.Column(db.String(100))
    store_name = db.Column(db.String(120))
    date = db.Column(db.Date)
    total = db.Column(db.Float)
    tax_amount = db.Column(db.Float)
    total_discount = db.Column(db.Float)

    items = db.Column(MutableList.as_mutable(JSON))  # Stores list of {"name", "quantity", "price", "category", "total", "discount"} and tracks mutations
    fingerprint = db.Column(db.String(64), nullable=False, index=True)  # SHA256 hex string

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WidgetOrder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    order = db.Column(db.JSON, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, user_id, order):
        self.user_id = user_id
        self.order = order
