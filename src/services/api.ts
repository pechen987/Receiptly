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

// Subscription setup function for Stripe payments
export const createStripeSubscriptionSetup = async (plan: string, billingDetails: any) => {
  try {
    console.log(`Creating subscription setup for plan: ${plan}`);
    
    const response = await api.post('/api/subscription/create-subscription-setup', {
      plan: plan,
      billing_details: billingDetails
    });
    
    console.log('Subscription setup response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating subscription setup:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to create subscription setup');
  }
};

// Complete subscription payment after Stripe payment sheet
export const completeSubscriptionPayment = async (paymentIntentId: string) => {
  try {
    console.log(`Completing subscription payment for: ${paymentIntentId}`);
    
    const response = await api.post('/api/subscription/complete-subscription-payment', {
      payment_intent_id: paymentIntentId
    });
    
    console.log('Complete payment response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error completing subscription payment:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || 'Failed to complete subscription payment');
  }
};

// Get user's receipt count and plan info
export const getReceiptCount = async () => {
  try {
    const response = await api.get('/api/subscription/receipt-count');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching receipt count:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to fetch receipt count');
  }
};

export default api;