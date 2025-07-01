import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, FlatList, Linking, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCurrency } from './analytics/contexts/CurrencyContext';
import jwtDecode from 'jwt-decode';
import apiConfig from '../config/api';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useButtonAnimation } from '../hooks/useButtonAnimation';

interface JwtPayload {
  email: string;
}

interface SubscriptionDetails {
  next_billing_date: string | null;
  subscription_end_date: string | null;
  subscription_start_date: string | null;
  subscription_status: string | null;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  is_trial_active?: boolean;
}

import axios from 'axios';

const CURRENCY_OPTIONS = [
  { label: 'US Dollar (USD)', value: 'USD' },
  { label: 'Euro (EUR)', value: 'EUR' },
  { label: 'British Pound (GBP)', value: 'GBP' },
  { label: 'Japanese Yen (JPY)', value: 'JPY' },
  { label: 'Canadian Dollar (CAD)', value: 'CAD' },
  { label: 'Australian Dollar (AUD)', value: 'AUD' },
  { label: 'Swiss Franc (CHF)', value: 'CHF' },
  { label: 'Indian Rupee (INR)', value: 'INR' },
  { label: 'Chinese Yuan (CNY)', value: 'CNY' },
  { label: 'Russian Ruble (RUB)', value: 'RUB' },
];

const API_BASE_URL = apiConfig.API_BASE_URL;

// Custom Dropdown Component
const CurrencyDropdown = ({ 
  selectedValue, 
  onValueChange, 
  enabled = true 
}: { 
  selectedValue: string; 
  onValueChange: (value: string) => void;
  enabled?: boolean;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  const selectedOption = CURRENCY_OPTIONS.find(opt => opt.value === selectedValue);
  
  const handleSelect = (value: string) => {
    onValueChange(value);
    setIsVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdownButton, !enabled && styles.dropdownButtonDisabled]}
        onPress={() => enabled && setIsVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, !enabled && styles.dropdownTextDisabled]}>
          {selectedOption?.label || 'Select Currency'}
        </Text>
        <Ionicons 
          name={isVisible ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={enabled ? "#7e5cff" : "#555"} 
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownHeaderText}>Select Currency</Text>
              <TouchableOpacity
                onPress={() => setIsVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={CURRENCY_OPTIONS}
              keyExtractor={(item) => item.value}
              style={styles.dropdownList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    selectedValue === item.value && styles.dropdownItemSelected
                  ]}
                  onPress={() => handleSelect(item.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    selectedValue === item.value && styles.dropdownItemTextSelected
                  ]}>
                    {item.label}
                  </Text>
                  {selectedValue === item.value && (
                    <Ionicons name="checkmark" size={20} color="#7e5cff" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { currency, setCurrency } = useCurrency();
  const [userId, setUserId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const navigation = useNavigation();
  const { planRefreshTrigger } = useAuth();
  const { createPressAnimation } = useButtonAnimation();
  
  // Create animation instance for the sign out button
  const signOutButtonAnim = createPressAnimation();

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded = jwtDecode<any>(token);
          setEmail(decoded.email);
          if (decoded.user_id) setUserId(decoded.user_id);
          
          const res = await axios.get(`${API_BASE_URL}/api/user/profile`, {
            params: { user_id: decoded.user_id },
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (res.data && res.data.currency) setCurrency(res.data.currency);
          
          // Fetch user plan and subscription details
          setIsLoadingPlan(true);
          try {
            const planRes = await fetch(`${API_BASE_URL}/api/subscription/receipt-count`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            const planData = await planRes.json();
            if (planRes.ok) {
              setUserPlan(planData.user_plan || 'basic');
              setSubscriptionDetails(planData.subscription_details || null);
            } else {
              setUserPlan('basic');
            }
          } catch (e) {
            setUserPlan('basic');
          } finally {
            setIsLoadingPlan(false);
          }
        } else {
          console.warn('No JWT token found on loading profile.');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, [planRefreshTrigger]);

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency);
    if (!userId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      if (!token) {
        console.error('No token found for updating currency.');
        setSaveMsg('Authentication error.');
        setSaving(false);
        return;
      }

      await axios.post(`${API_BASE_URL}/api/user/profile`, {
        user_id: userId,
        currency: newCurrency
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (e) {
      console.error('Error updating currency:', e);
      setSaveMsg('Failed to update currency');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 2000);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await fetch(`${API_BASE_URL}/api/subscription/customer-portal`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        Linking.openURL(data.url);
      } else {
        Alert.alert('Error', 'Could not open subscription portal.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open subscription portal.');
    }
  };

  const renderSubscriptionInfo = () => {
    if (userPlan === 'basic') return null;
    if (!subscriptionDetails) return null;

    const { next_billing_date, subscription_end_date, subscription_status, trial_end_date, is_trial_active } = subscriptionDetails;

    // Show trial end date if trial is active
    if (is_trial_active && trial_end_date) {
      return (
        <View style={styles.infoSection}>
          <Text style={styles.label}>Trial ends on</Text>
          <Text style={styles.value}>{formatDate(trial_end_date)}</Text>
        </View>
      );
    }

    // Show end date if subscription is cancelled or will end
    if (subscription_end_date && subscription_status === 'cancelled') {
      return (
        <View style={styles.infoSection}>
          <Text style={styles.label}>Subscription Ends</Text>
          <Text style={[styles.value, { color: '#ff6b6b' }]}>{formatDate(subscription_end_date)}</Text>
        </View>
      );
    }

    // Show next billing date for active subscriptions
    if (next_billing_date && subscription_status === 'active') {
      return (
        <View style={styles.infoSection}>
          <Text style={styles.label}>Next Billing Date</Text>
          <Text style={styles.value}>{formatDate(next_billing_date)}</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle-outline" size={64} color="#7e5cff" />
        </View>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Manage your account and settings</Text>
        
        <View style={styles.infoSection}>
          <Text style={styles.label}>Email</Text>
          {isLoading ? (
            <ActivityIndicator color="#7e5cff" size="small" />
          ) : (
            <Text style={styles.value}>{email}</Text>
          )}
        </View>
        
        <View style={styles.infoSection}>
          <Text style={styles.label}>Plan</Text>
          {isLoadingPlan ? (
            <ActivityIndicator color="#7e5cff" size="small" />
          ) : (
            <>
              <View>
                <Text style={[styles.value, { textTransform: 'capitalize', fontWeight: '700' }]}>
                  {userPlan === 'basic' ? 'Basic' : userPlan === 'premium' || userPlan === 'pro' ? 'Pro' : userPlan}
                </Text>
              </View>
              {userPlan === 'basic' && (
                  <TouchableOpacity 
                    style={{ backgroundColor: '#FFBF00', paddingVertical: 6, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12, alignSelf: 'flex-start' }}
                    onPress={() => navigation.navigate('ProOnboarding')}
                  >
                    <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>Go Pro</Text>
                  </TouchableOpacity>
              )}
              {/* Add subscription status row */}
              {subscriptionDetails?.subscription_status && userPlan !== 'basic' && (
                <Text style={[styles.value, { marginTop: 8, color: (subscriptionDetails.subscription_status === 'active' || subscriptionDetails.subscription_status === 'trialing') ? '#4caf50' : '#ff6b6b' }]}>
                  Status: {subscriptionDetails.subscription_status.charAt(0).toUpperCase() + subscriptionDetails.subscription_status.slice(1)}
                </Text>
              )}
              {userPlan !== 'basic' && (
                <View style={{ alignItems: 'flex-start', width: '100%' }}>
                  <TouchableOpacity
                    style={[styles.manageButton, { marginTop: 12, marginLeft: 0 }]}
                    onPress={handleManageSubscription}
                  >
                    <Text style={styles.manageButtonText}>Manage Subscription</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Subscription billing information */}
        {!isLoadingPlan && renderSubscriptionInfo()}
        
        <View style={styles.infoSection}>
          <Text style={styles.label}>Currency</Text>
          {isLoading ? (
            <ActivityIndicator color="#7e5cff" size="small" />
          ) : (
            <CurrencyDropdown
              selectedValue={currency}
              onValueChange={handleCurrencyChange}
              enabled={!saving}
            />
          )}
          {!!saveMsg && <Text style={{ color: '#7e5cff', marginTop: 4 }}>{saveMsg}</Text>}
        </View>
        
        <Animated.View
          style={[
            styles.signOutButtonContainer,
            {
              transform: [{ scale: signOutButtonAnim.scaleAnim }],
            }
          ]}
        >
          <Animated.View
            style={[
              styles.signOutButtonShadow,
              {
                shadowOpacity: signOutButtonAnim.shadowOpacityAnim,
                elevation: signOutButtonAnim.elevationAnim,
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.signOutButton} 
              onPress={onLogout}
              onPressIn={signOutButtonAnim.handlePressIn}
              onPressOut={signOutButtonAnim.handlePressOut}
              activeOpacity={1}
            >
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16191f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#232632',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7e5cff10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  infoSection: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  value: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#7e5cff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 2,
    borderColor: '#9575ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownButton: {
    backgroundColor: '#2a2d3a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3d4a',
  },
  dropdownButtonDisabled: {
    opacity: 0.5,
  },
  dropdownText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  dropdownTextDisabled: {
    color: '#555',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModal: {
    backgroundColor: '#232632',
    borderRadius: 16,
    width: '100%',
    maxWidth: 350,
    maxHeight: '70%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3d4a',
  },
  dropdownHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2d3a',
  },
  dropdownItemSelected: {
    backgroundColor: '#7e5cff15',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#7e5cff',
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#232632',
    borderWidth: 1,
    borderColor: '#7e5cff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonText: {
    color: '#7e5cff',
    fontSize: 15,
    fontWeight: '700',
  },
  signOutButtonContainer: {
    width: '100%',
  },
  signOutButtonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 12,
  },
});