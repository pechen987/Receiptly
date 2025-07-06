import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, ActivityIndicator, Text, TouchableOpacity, Platform, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomPaymentForm from '../components/CustomPaymentForm';
import { createStripeSubscriptionSetup, validatePromocode } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useReceipt } from '../contexts/ReceiptContext';
import api from '../services/api';

interface CustomPaymentScreenProps {
  navigation: any;
  route: {
    params: {
      plan: 'monthly' | 'yearly';
    };
  };
}

export default function CustomPaymentScreen({ navigation, route }: CustomPaymentScreenProps) {
  const { triggerPlanRefresh } = useAuth();
  const { triggerRefresh } = useReceipt();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const { plan } = route.params;
  const scrollViewRef = useRef<ScrollView>(null);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [promoMessage, setPromoMessage] = useState<string>('');
  const [promotionCodeId, setPromotionCodeId] = useState<string | null>(null);
  const [discountInfo, setDiscountInfo] = useState<any>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async (promotionCodeIdToUse?: string, isPromoApply = false) => {
    if (!isPromoApply) setLoading(true);
    setError(null);
    try {
      const setupData = await createStripeSubscriptionSetup(plan, {}, promotionCodeIdToUse);
      setPaymentData(setupData);
      if (setupData.discount_info) {
        setDiscountInfo(setupData.discount_info);
      } else {
        setDiscountInfo(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to initialize payment');
    } finally {
      if (!isPromoApply) setLoading(false);
    }
  };

  const validatePromo = async () => {
    if (!promoCode.trim()) {
      setPromoValid(false);
      setPromoMessage('Enter a code');
      setPromotionCodeId(null);
      setDiscountInfo(null);
      return;
    }
    setPromoLoading(true);
    try {
      const res = await validatePromocode(promoCode.trim());
      if (res.valid) {
        setPromoValid(true);
        setPromoMessage(`Applied: ${promoCode.trim()}`);
        setPromotionCodeId(res.promotion_code_id);
        setDiscountInfo(res);
        await initializePayment(res.promotion_code_id, true);
      } else {
        setPromoValid(false);
        setPromoMessage(res.message || 'Invalid code');
        setPromotionCodeId(null);
        setDiscountInfo(null);
        await initializePayment(undefined, true);
      }
    } catch (e: any) {
      setPromoValid(false);
      setPromoMessage('Error validating');
      setPromotionCodeId(null);
      setDiscountInfo(null);
      await initializePayment(undefined, true);
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = async () => {
    setPromoCode('');
    setPromoValid(null);
    setPromoMessage('');
    setPromotionCodeId(null);
    setDiscountInfo(null);
    setPromoLoading(true);
    try {
      await initializePayment(undefined, true);
    } finally {
      setPromoLoading(false);
    }
  };
  

  const handleCardFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const handlePaymentSuccess = () => {
    triggerPlanRefresh();
    triggerRefresh();
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          state: {
            index: 0,
            routes: [{ name: 'My Receipts' }],
          },
        },
      ],
    });
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleRetry = () => {
    setError(null);
    initializePayment();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#16191f" />
        <ActivityIndicator size="large" color="#7e5cff" />
        <Text style={styles.loadingText}>Setting up payment...</Text>
      </SafeAreaView>
    );
  }

  if (error && !paymentData) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#16191f" />
        <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
        <Text style={styles.errorTitle}>Payment Setup Failed</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#16191f" />
      {/* Header - match onboarding style, chevron left, no title */}
      <View style={styles.topHeader}> 
        <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
          <Ionicons name="chevron-back" size={32} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}></View>
      </View>
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
      {/* Payment Form */}
      {paymentData && (
        <StripeProvider
          publishableKey="pk_test_51RWzlWE9IYgVm0lSsdUPhjeqbjHZHatzyp8Wv2XouCBqJjOwCeg2R9fcfKqW2iP2Do6fFCoGmgb4vphnwzg2UhOb00T9X1yffI"
          merchantIdentifier="merchant.com.Recipta.app"
        >
          <CustomPaymentForm
            clientSecret={paymentData.client_secret}
            hasTrial={paymentData.has_trial}
            intentType={paymentData.intent_type}
            plan={plan}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            onCancel={handleCancel}
            onCardFocus={handleCardFocus}
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            promoValid={promoValid}
            promoMessage={promoMessage}
            onApplyPromo={validatePromo}
            onRemovePromo={handleRemovePromo}
            discountInfo={discountInfo}
            promoLoading={promoLoading}
          />
        </StripeProvider>
      )}
      {/* Error Display */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  scrollContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 200, 
  },
  topHeader: {
    width: '100%',
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#232632',
    zIndex: 200,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0D1117',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#16191f',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#7e5cff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#666',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#ff6b6b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorBannerText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
}); 