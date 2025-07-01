import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../screens/analytics/utils';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
// Store pending requests
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is not 401 or request has already been retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // If token refresh is in progress, add request to queue
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Get current token
      const currentToken = await AsyncStorage.getItem('jwt_token');
      if (!currentToken) {
        throw new Error('No token found');
      }

      // Call refresh token endpoint
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      });

      const newToken = response.data.token;
      if (!newToken) {
        throw new Error('No new token received');
      }

      // Save new token
      await AsyncStorage.setItem('jwt_token', newToken);

      // Update authorization header
      api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      // Process queued requests
      processQueue(null, newToken);

      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Validate promocode
export const validatePromocode = async (promoCode: string) => {
  try {
    const response = await api.post('/api/subscription/validate-promocode', { promo_code: promoCode });
    return response.data;
  } catch (error: any) {
    console.log('Error validating promocode:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to validate promocode');
  }
};

// Subscription setup function for Stripe payments
export const createStripeSubscriptionSetup = async (plan: string, billingDetails: any, promotionCodeId?: string) => {
  try {
    console.log(`Creating subscription setup for plan: ${plan}`);
    const response = await api.post('/api/subscription/create-subscription-setup', {
      plan: plan,
      billing_details: billingDetails,
      promotion_code_id: promotionCodeId || undefined
    });
    console.log('Subscription setup response:', response.data);
    return response.data;
  } catch (error: any) {
    console.log('Error creating subscription setup:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to create subscription setup');
  }
};

// Complete trial setup function
export const completeTrialSetup = async (setupIntentId: string) => {
  try {
    console.log(`Completing trial setup for setup intent: ${setupIntentId}`);
    
    const response = await api.post('/api/subscription/complete-trial-setup', {
      setup_intent_id: setupIntentId
    });
    
    console.log('Trial setup completion response:', response.data);
    return response.data;
  } catch (error: any) {
    console.log('Error completing trial setup:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to complete trial setup');
  }
};

// Complete subscription payment function
export const completeSubscriptionPayment = async (paymentIntentId: string) => {
  try {
    console.log(`Completing subscription payment for: ${paymentIntentId}`);
    
    const response = await api.post('/api/subscription/complete-subscription-payment', {
      payment_intent_id: paymentIntentId
    });
    
    console.log('Complete payment response:', response.data);
    return response.data;
  } catch (error: any) {
    console.log('Error completing subscription payment:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to complete subscription payment');
  }
};

// Complete custom payment function
export const completeCustomPayment = async (clientSecret: string, intentType: string) => {
  try {
    console.log(`Completing custom payment for intent type: ${intentType}`);
    
    const response = await api.post('/api/subscription/complete-custom-payment', {
      client_secret: clientSecret,
      intent_type: intentType
    });
    
    console.log('Custom payment completion response:', response.data);
    return response.data;
  } catch (error: any) {
    console.log('Error completing custom payment:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to complete custom payment');
  }
};

export default api;