import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Keyboard, TouchableWithoutFeedback, Modal, ActivityIndicator, Animated, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useStripe, CardField, CardFieldInput } from '@stripe/stripe-react-native';
import { completeCustomPayment } from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useButtonAnimation } from '../hooks/useButtonAnimation';

interface CustomPaymentFormProps {
  clientSecret: string;
  hasTrial: boolean;
  intentType: string;
  plan: 'monthly' | 'yearly';
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
  onCardFocus: () => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  promoValid: boolean | null;
  promoMessage: string;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  discountInfo: any;
  promoLoading: boolean;
}

export default function CustomPaymentForm({
  clientSecret,
  hasTrial,
  intentType,
  plan,
  onSuccess,
  onError,
  onCancel,
  onCardFocus,
  promoCode,
  setPromoCode,
  promoValid,
  promoMessage,
  onApplyPromo,
  onRemovePromo,
  discountInfo,
  promoLoading,
}: CustomPaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const stripe = useStripe();
  const { createPressAnimation } = useButtonAnimation();
  const scrollViewRef = React.useRef<ScrollView>(null);
  
  // Create animation instances for the buttons
  const submitButtonAnim = createPressAnimation();
  const promoButtonAnim = createPressAnimation();

  // Use plan prop directly
  let planLabel = plan === 'yearly' ? 'Yearly' : 'Monthly';
  let basePrice = plan === 'yearly' ? 40.0 : 3.9;
  let price = `$${basePrice.toFixed(2)}`;
  let discountedPrice = price;
  let discountText = '';
  if (discountInfo) {
    if (discountInfo.percent_off) {
      discountedPrice = `$${(basePrice * (1 - discountInfo.percent_off / 100)).toFixed(2)}`;
      discountText = `-${discountInfo.percent_off}%`;
    } else if (discountInfo.amount_off) {
      let off = discountInfo.amount_off / 100;
      discountedPrice = `$${Math.max(0, basePrice - off).toFixed(2)}`;
      discountText = `-$${off.toFixed(2)}`;
    }
  }

  // Handle promo code field focus
  const handlePromoCodeFocus = () => {
    // Add a small delay to ensure the keyboard is shown before scrolling
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const handleSubmit = async () => {
    console.log('handleSubmit called');
    if (!stripe) {
      onError('Stripe not initialized');
      console.log('Stripe not initialized');
      return;
    }
    // Validate CardField
    if (!cardDetails?.complete) {
      onError('Card details not complete');
      console.log('Card details not complete:', cardDetails);
      return;
    }
    setLoading(true);
    try {
      // 1. Create PaymentMethod with CardField data
      console.log('Creating PaymentMethod with CardField data:', cardDetails);
      const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
        paymentMethodType: 'Card',
        paymentMethodData: {
          // Optionally add billingDetails here if you collect them
        },
      });
      if (pmError) {
        onError(pmError.message || 'Failed to create payment method');
        console.log('PaymentMethod creation error:', pmError);
        setLoading(false);
        return;
      }
      console.log('PaymentMethod created:', paymentMethod?.id);
      let result;
      if (intentType === 'setup_intent') {
        result = await stripe.confirmSetupIntent(clientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: { paymentMethodId: paymentMethod.id },
        });
      } else {
        result = await stripe.confirmPayment(clientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: { paymentMethodId: paymentMethod.id },
        });
      }
      console.log('Stripe result:', result);
      const { error } = result;
      if (error) {
        onError(error.message || 'Payment failed');
        console.log('Stripe error:', error);
        return;
      }
      // Payment confirmed with Stripe, now complete with our backend
      const apiResult = await completeCustomPayment(clientSecret, intentType);
      console.log('Backend completeCustomPayment result:', apiResult);
      if (apiResult.success) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          onSuccess();
        }, 2200);
      } else {
        onError(apiResult.error || 'Payment completion failed');
        console.log('Backend error:', apiResult.error);
      }
    } catch (e: any) {
      onError(e.message || 'Payment failed');
      console.log('Exception in handleSubmit:', e);
    } finally {
      setLoading(false);
      console.log('handleSubmit finished');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ref={scrollViewRef}
      >
        <View style={styles.container}>
          {/* Header: Receiptly Pro. Free trial. */}
          <Text style={styles.proHeader}>
            Receiptly <Text style={styles.proHeaderGold}>Pro</Text>
          </Text>
          <Text style={styles.cardInfoHeader}>Your Pro plan includes:</Text>
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#4caf50" style={{ marginRight: 8 }} />
              <Text style={styles.benefitText}>Unlimited receipt scanning</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#4caf50" style={{ marginRight: 8 }} />
              <Text style={styles.benefitText}>All premium analytics</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={18} color="#4caf50" style={{ marginRight: 8 }} />
              <Text style={styles.benefitText}>Faster receipt processing</Text>
            </View>
          </View>
          {/* Plan summary table (below title) */}
          <Text style={styles.cardInfoHeader}>Summary</Text>
          <View style={styles.summaryTable}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Plan</Text>
              <Text style={styles.summaryValue}>{planLabel}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Trial period</Text>
              <Text style={styles.summaryValue}>14 days</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Price after trial</Text>
              <Text style={styles.summaryValue}>
                {discountInfo ? (
                  <>
                    <Text style={{ textDecorationLine: 'line-through', color: '#aaa', marginRight: 6 }}>{price}</Text>
                    <Text style={{ color: '#4caf50', fontWeight: '700' }}>{discountedPrice}</Text>
                    {discountText && <Text style={{ color: '#4caf50', marginLeft: 6 }}>{discountText}</Text>}
                  </>
                ) : (
                  `${price} / ${planLabel === 'Monthly' ? 'month' : 'year'}`
                )}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total due now</Text>
              <Text style={[styles.summaryValue, { color: '#4caf50', fontWeight: '700' }]}>$0.00</Text>
            </View>
          </View>
          {/* Objection Handling Box */}
          <View style={styles.objectionBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#7e5cff" style={{ marginRight: 8 }} />
            <Text style={styles.objectionText}>
              Cancel anytime. You won't be charged now.
            </Text>
          </View>
          {/* Promocode Input */}
          <Text style={styles.cardInfoHeader}>Promocode</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <TextInput
              placeholder="Enter promocode"
              value={promoCode}
              onChangeText={setPromoCode}
              placeholderTextColor="#aaa"
              style={{
                flex: 1,
                backgroundColor: '#232632',
                color: '#fff',
                padding: 12,
                borderRadius: 10,
                fontSize: 16,
                borderWidth: 1,
                borderColor: promoValid === false ? '#ff4a4a' : '#35384a',
                marginRight: 8,
              }}
              autoCapitalize="characters"
              editable={!promoLoading && !promoValid}
              onFocus={handlePromoCodeFocus}
            />
            <Animated.View
              style={[
                styles.promoButtonContainer,
                {
                  transform: [{ scale: promoButtonAnim.scaleAnim }],
                }
              ]}
            >
              <Animated.View
                style={[
                  styles.promoButtonShadow,
                  {
                    shadowOpacity: promoButtonAnim.shadowOpacityAnim,
                    elevation: promoButtonAnim.elevationAnim,
                  }
                ]}
              >
                <TouchableOpacity
                  style={{
                    backgroundColor: promoValid ? '#ff4a4a' : '#7e5cff',
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderRadius: 10,
                    opacity: promoLoading ? 0.6 : 1,
                    borderWidth: 2,
                    borderColor: promoValid ? '#ff6b6b' : '#9575ff',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 0,
                  }}
                  onPress={promoValid ? onRemovePromo : onApplyPromo}
                  onPressIn={promoButtonAnim.handlePressIn}
                  onPressOut={promoButtonAnim.handlePressOut}
                  disabled={promoLoading}
                  activeOpacity={1}
                >
                  {promoLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : promoValid ? (
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Remove</Text>
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Apply</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
          {promoMessage ? (
            <Text style={{ color: promoValid ? '#4caf50' : '#ff4a4a', marginBottom: 12, fontWeight: '600' }}>{promoMessage}</Text>
          ) : null}
          {/* Card information header */}
          <Text style={styles.cardInfoHeader}>Card information</Text>
          {/* CardField for card input */}
          <CardField
            postalCodeEnabled={false}
            placeholders={{ number: '1234 5678 9012 3456' }}
            cardStyle={{
              backgroundColor: '#232632',
              textColor: '#ffffff',
              borderRadius: 10,
              fontSize: 18,
              placeholderColor: '#aaaaaa',
              borderColor: '#35384a',
              borderWidth: 1,
            }}
            style={{
              width: '100%',
              height: 56,
              marginBottom: 16,
              justifyContent: 'center',
            }}
            onFocus={onCardFocus}
            onCardChange={(details) => {
              setCardDetails(details);
              console.log('CardField changed:', details);
            }}
          />
          <Animated.View
            style={[
              styles.submitButtonContainer,
              {
                transform: [{ scale: submitButtonAnim.scaleAnim }],
              }
            ]}
          >
            <Animated.View
              style={[
                styles.submitButtonShadow,
                {
                  shadowOpacity: submitButtonAnim.shadowOpacityAnim,
                  elevation: submitButtonAnim.elevationAnim,
                }
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (loading || !cardDetails) && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                onPressIn={submitButtonAnim.handlePressIn}
                onPressOut={submitButtonAnim.handlePressOut}
                disabled={loading || !cardDetails}
                activeOpacity={1}
              >
                {loading ? (
                  <Text style={styles.submitButtonText}>Processing...</Text>
                ) : hasTrial ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={styles.submitButtonText}>Start trial</Text>
                    <Ionicons name="lock-closed" size={18} color="#fff" style={{ marginLeft: 6 }} />
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>Subscribe</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* Powered by Stripe text */}
          <Text style={styles.poweredByStripe}>Powered by Stripe</Text>

          {/* Success Modal */}
          <Modal
            visible={showSuccess}
            transparent
            animationType="fade"
          >
            <View style={styles.successModalOverlay}>
              <View style={styles.successModalContent}>
                <Ionicons name="checkmark-circle" size={64} color="#4caf50" style={{ marginBottom: 16 }} />
                <Text style={styles.successTitle}>Success!</Text>
                <Text style={styles.successMessage}>Your free trial is now active. Enjoy Receiptly Pro features for 14 days!</Text>
              </View>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#232632',
    borderRadius: 16,
    padding: 24,
    margin: 16,
  },
  benefitsContainer: {
    gap: 8,
    marginBottom: 24,
    backgroundColor: '#2a2d47',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#7e5cff',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '500',
  },
  summaryTable: {
    backgroundColor: '#232632',
    borderRadius: 10,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#35384a',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    color: '#aaa',
    fontSize: 15,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  objectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#2a2d47',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#7e5cff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  objectionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    lineHeight: 18,
    fontWeight: '600',
  },
  cardInfoHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  proHeader: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 0,
  },
  proHeaderGold: {
    color: '#FFBF00',
    fontWeight: '800',
  },
  submitButton: {
    backgroundColor: '#7e5cff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9575ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  successModalContent: {
    backgroundColor: '#232632',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
    marginHorizontal: 24,
  },
  successTitle: {
    color: '#4caf50',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  successMessage: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  poweredByStripe: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  promoButtonContainer: {
    width: 'auto',
  },
  promoButtonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 10,
  },
  submitButtonContainer: {
    width: '100%',
  },
  submitButtonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 12,
  },
});