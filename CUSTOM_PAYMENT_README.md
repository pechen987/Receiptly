# Custom Payment Form Implementation

This document describes the custom payment form implementation using Stripe Elements in React Native.

## Overview

The custom payment form replaces the Stripe PaymentSheet with a custom UI using Stripe's CardField component. This provides full control over the payment form's appearance and behavior.

## Components

### 1. CustomPaymentForm (`src/components/CustomPaymentForm.tsx`)
- Uses Stripe's `CardField` component for card input
- Handles payment confirmation with Stripe
- Calls backend API to complete payment/subscription setup
- Supports both PaymentIntents and SetupIntents

### 2. CustomPaymentScreen (`src/screens/CustomPaymentScreen.tsx`)
- Wraps the payment form in a full screen
- Handles payment initialization and error states
- Provides navigation and user feedback

## Backend Changes

### 1. Updated Subscription Setup (`backend/routes/subscription.py`)
- Added `intent_type` field to response
- Returns either 'payment_intent' or 'setup_intent' based on trial eligibility

### 2. New Custom Payment Endpoint (`backend/routes/subscription.py`)
- `/api/subscription/complete-custom-payment`
- Handles both PaymentIntent and SetupIntent completion
- Creates Stripe subscriptions with proper trial periods
- Updates user plan and subscription details

## API Changes

### 1. New API Function (`src/services/api.ts`)
- `completeCustomPayment(clientSecret, intentType)`
- Calls the new backend endpoint to complete payments

## How to Test

1. **Start the app** and navigate to the Pro Onboarding screen
2. **Click "Test Custom Payment (Monthly)"** button
3. **Enter test card details**:
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
4. **Submit the payment** to test the flow

## Test Cards

Use these Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Authentication**: `4000 0025 0000 3155`

## Flow

1. User clicks "Test Custom Payment"
2. App calls `/api/subscription/create-subscription-setup`
3. Backend creates PaymentIntent or SetupIntent
4. Frontend displays custom payment form
5. User enters card details
6. Stripe confirms payment/setup
7. Frontend calls `/api/subscription/complete-custom-payment`
8. Backend creates subscription and updates user plan
9. User is redirected back with success

## Key Features

- ✅ Custom UI with full control over styling
- ✅ Supports both trial and paid subscriptions
- ✅ Proper error handling and user feedback
- ✅ Integration with existing auth and receipt contexts
- ✅ TypeScript support with proper typing

## Next Steps

1. **Test the implementation** with the test button
2. **Replace PaymentSheet** in ProOnboardingScreen with custom form
3. **Add more styling** and animations
4. **Implement additional payment methods** (Apple Pay, Google Pay)
5. **Add payment confirmation screens**

## Troubleshooting

- **Stripe not initialized**: Check publishable key configuration
- **Payment confirmation fails**: Verify backend endpoint is working
- **Card validation errors**: Check CardField configuration
- **Navigation issues**: Ensure CustomPayment screen is added to navigation stack 