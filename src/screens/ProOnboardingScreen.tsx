import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, StatusBar, Alert, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PaymentSheet, useStripe } from '@stripe/stripe-react-native';
import { useAuth } from '../contexts/AuthContext';
import { useReceipt } from '../contexts/ReceiptContext';
import { useButtonAnimation } from '../hooks/useButtonAnimation';

const BENEFITS = [
  {
    icon: <Ionicons name="infinite" size={32} color="#7e5cff" />,
    title: 'Unlimited scanning',
    description: 'Scan as many receipts as you want, with no monthly limits.'
  },
  {
    icon: <MaterialCommunityIcons name="chart-bar" size={32} color="#7e5cff" />,
    title: 'Premium analytics',
    description: 'Unlock all advanced charts and insights to track your spending.'
  },
  {
    icon: <Ionicons name="cloud-upload-outline" size={32} color="#7e5cff" />,
    title: 'Priority processing',
    description: 'Faster receipt scanning and priority support.'
  },
];

const FAQS = [
  {
    q: 'What do I get with Receiptly Pro?',
    a: 'Receiptly Pro unlocks unlimited receipt scanning and all premium analytics charts, giving you deeper insights into your spending.'
  },
  {
    q: 'How does the free trial work?',
    a: 'You get 14 days of full Pro access completely free. No payment required upfront. You can cancel anytime during the trial.'
  },
  {
    q: 'Is there a limit to how many receipts I can scan?',
    a: 'With Pro (including during your trial), you can scan as many receipts as you want. Free users have a monthly limit.'
  },
  {
    q: 'What premium analytics are included?',
    a: 'Pro users get access to advanced charts such as Most Popular Products, Most Expensive Purchases, Shopping Days, and more.'
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: "Yes, you can cancel your subscription at any time from your device's app store. Your Pro features will remain active until the end of the billing period."
  },
  {
    q: 'Will my data be safe and private?',
    a: 'Absolutely. Your receipt data is securely stored and never shared with third parties. We take privacy and security seriously.'
  },
];

export default function ProOnboardingScreen({ navigation }: any) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [plansSectionY, setPlansSectionY] = useState(0);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createPressAnimation } = useButtonAnimation();
  
  // Create animation instances for the buttons
  const upgradeButtonAnim = createPressAnimation();
  const monthlyButtonAnim = createPressAnimation();
  const yearlyButtonAnim = createPressAnimation();
  const dismissButtonAnim = createPressAnimation();

  // Top button: scroll to plans section
  const handleScrollToPlans = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: plansSectionY, animated: true });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#16191f' }}>
      <StatusBar barStyle="light-content" backgroundColor="#16191f" />
      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7e5cff" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        </View>
      )}
      
      {/* Main content */}
      <View style={{ flex: 1, position: 'relative' }}>
        {/* Top Header with Back Arrow */}
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={32} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {/* You can put a title here if you want, or leave it empty for now */}
          </View>
        </View>
        
        <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.content}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.proTitleRow}>
              <Ionicons name="receipt-outline" size={36} color="#7e5cff" style={{ marginRight: 10 }} />
              <Text style={styles.proTitle}>
                Receiptly <Text style={styles.proTitleGold}>Pro</Text>
              </Text>
            </View>
            <Text style={styles.heroTitle}>Take full control of your expenses</Text>
            <Text style={styles.heroSubtitle}>
              Enjoy unlimited scanning and all premium analytics!
            </Text>
            <Animated.View
              style={[
                styles.upgradeButtonContainer,
                {
                  transform: [{ scale: upgradeButtonAnim.scaleAnim }],
                }
              ]}
            >
              <Animated.View
                style={[
                  styles.upgradeButtonShadow,
                  {
                    shadowOpacity: upgradeButtonAnim.shadowOpacityAnim,
                    elevation: upgradeButtonAnim.elevationAnim,
                  }
                ]}
              >
                <TouchableOpacity 
                  style={styles.upgradeButton} 
                  onPress={handleScrollToPlans}
                  onPressIn={upgradeButtonAnim.handlePressIn}
                  onPressOut={upgradeButtonAnim.handlePressOut}
                  activeOpacity={1}
                >
                  <Text style={styles.upgradeButtonText}>Choose your plan</Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>

          {/* Benefits Section */}
          <View style={styles.benefitsSection}>
            {BENEFITS.map((benefit, idx) => (
              <View key={idx} style={styles.benefitCard}>
                <View style={styles.benefitIcon}>{benefit.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDesc}>{benefit.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Plans Section */}
          <View
            style={styles.plansSection}
            onLayout={e => setPlansSectionY(e.nativeEvent.layout.y)}
          >
            <Text style={styles.plansTitle}>Choose your plan</Text>
            <View style={styles.plansColumn}>
              {/* Monthly Plan Block */}
              <View style={styles.planRow}> 
                <View style={{ flex: 1 }}>
                  <Text style={styles.planLabel}>Monthly</Text>
                  <Text style={styles.trialText}>14-day free trial</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={styles.planPrice}>$3.90</Text>
                  </View>
                  <Text style={styles.planSubtext}>per month</Text>
                </View>
                <Animated.View
                  style={[
                    styles.upgradeButtonSmallContainer,
                    {
                      transform: [{ scale: monthlyButtonAnim.scaleAnim }],
                    }
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.upgradeButtonSmallShadow,
                      {
                        shadowOpacity: monthlyButtonAnim.shadowOpacityAnim,
                        elevation: monthlyButtonAnim.elevationAnim,
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.upgradeButtonSmall, loading && styles.buttonDisabled]}
                      onPress={() => navigation.navigate('CustomPayment', { plan: 'monthly' })}
                      onPressIn={monthlyButtonAnim.handlePressIn}
                      onPressOut={monthlyButtonAnim.handlePressOut}
                      disabled={loading}
                      activeOpacity={1}
                    >
                      <Text style={styles.upgradeButtonText}>
                        Start trial
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              </View>
              {/* Yearly Plan Block */}
              <View style={[styles.planRow, styles.planRowYearlySelected]}> 
                <View style={{ flex: 1 }}>
                  <Text style={styles.planLabel}>Yearly</Text>
                  <Text style={styles.freeMonthsText}>(2 months free)</Text>
                  <Text style={styles.trialText}>14-day free trial</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={styles.planPrice}>$40</Text>
                  </View>
                  <Text style={styles.planSubtext}>per year</Text>
                </View>
                <Animated.View
                  style={[
                    styles.upgradeButtonSmallContainer,
                    {
                      transform: [{ scale: yearlyButtonAnim.scaleAnim }],
                    }
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.upgradeButtonSmallShadow,
                      {
                        shadowOpacity: yearlyButtonAnim.shadowOpacityAnim,
                        elevation: yearlyButtonAnim.elevationAnim,
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.upgradeButtonSmall, loading && styles.buttonDisabled]}
                      onPress={() => navigation.navigate('CustomPayment', { plan: 'yearly' })}
                      onPressIn={yearlyButtonAnim.handlePressIn}
                      onPressOut={yearlyButtonAnim.handlePressOut}
                      disabled={loading}
                      activeOpacity={1}
                    >
                      <Text style={styles.upgradeButtonText}>
                        Start trial
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              </View>
            </View>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Animated.View
                style={[
                  styles.dismissButtonContainer,
                  {
                    transform: [{ scale: dismissButtonAnim.scaleAnim }],
                  }
                ]}
              >
                <Animated.View
                  style={[
                    styles.dismissButtonShadow,
                    {
                      shadowOpacity: dismissButtonAnim.shadowOpacityAnim,
                      elevation: dismissButtonAnim.elevationAnim,
                    }
                  ]}
                >
                  <TouchableOpacity 
                    style={styles.dismissButton} 
                    onPress={() => setError(null)}
                    onPressIn={dismissButtonAnim.handlePressIn}
                    onPressOut={dismissButtonAnim.handlePressOut}
                    activeOpacity={1}
                  >
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
            </View>
          )}

          {/* FAQ Section */}
          <View style={styles.faqSection}>
            <Text style={styles.faqTitle}>FAQ</Text>
            {FAQS.map((item, idx) => (
              <View key={idx} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestionRow}
                  onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <Ionicons
                    name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#7e5cff"
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
                {expandedFaq === idx && (
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
        
        {/* Fixed bottom border */}
        <View style={styles.bottomBorder} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16191f',
    paddingTop: 32,
  },
  content: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 32,
    width: '100%',
  },
  proTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  proTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
  },
  proTitleGold: {
    color: '#FFBF00',
    fontWeight: '800',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 0,
  },
  heroSubtitle: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  upgradeButton: {
    backgroundColor: '#7e5cff',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9575ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  benefitsSection: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 32,
    gap: 16,
    marginBottom: 32,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232632',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  benefitIcon: {
    marginRight: 18,
  },
  benefitTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitDesc: {
    color: '#aaa',
    fontSize: 15,
  },
  plansSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
    paddingHorizontal: 32,
  },
  plansTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  plansColumn: {
    width: '100%',
    gap: 16,
    flexDirection: 'column',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232632',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 0,
    marginHorizontal: 0,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    marginTop: 0,
    width: '100%',
  },
  planRowYearlySelected: {
    borderColor: '#FFBF00',
  },
  upgradeButtonSmall: {
    backgroundColor: '#7e5cff',
    paddingVertical: 12,
    paddingHorizontal: 24,
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
  planLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  planPrice: {
    color: '#7e5cff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  planSubtext: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  topHeader: {
    width: '100%',
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#16191f',
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
  freeMonthsText: {
    color: '#FFBF00',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 22,
  },
  faqSection: {
    width: '100%',
    marginTop: 32,
    marginBottom: 32,
    paddingHorizontal: 32,
  },
  faqTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  faqItem: {
    marginBottom: 14,
    backgroundColor: '#232632',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  faqAnswer: {
    color: '#aaa',
    fontSize: 15,
    marginTop: 10,
    lineHeight: 21,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingContainer: {
    backgroundColor: '#16191f',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorContainer: {
    backgroundColor: '#232632',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  dismissButton: {
    backgroundColor: '#7e5cff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9575ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  dismissButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  trialText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  upgradeButtonContainer: {
    width: 'auto',
  },
  upgradeButtonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 14,
  },
  upgradeButtonSmallContainer: {
    width: 'auto',
  },
  upgradeButtonSmallShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 12,
  },
  dismissButtonContainer: {
    width: 'auto',
  },
  dismissButtonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 8,
  },
  bottomBorder: {
    height: 0.5,
    backgroundColor: '#232632',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
}); 