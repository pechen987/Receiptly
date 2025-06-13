import { API_BASE_URL } from '@env';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback to a default value if environment variable is not set
const API_URL = API_BASE_URL;

// Create and configure axios instance
const axiosInstance = axios.create();

// Add axios interceptor for auth token
axiosInstance.interceptors.request.use(
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

// API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: `${API_URL}/api/auth/login`,
    REGISTER: `${API_URL}/api/auth/register`,
    CONFIRM_EMAIL: `${API_URL}/api/auth/confirm-email`,
  },
  
  // User endpoints
  USER: {
    PROFILE: `${API_URL}/api/user/profile`,
    UPDATE_CURRENCY: `${API_URL}/api/user/update-currency`,
  },
  
  // Receipts endpoints
  RECEIPTS: {
    BASE: `${API_URL}/api/receipts`,
    BY_ID: (id: string) => `${API_URL}/api/receipts/${id}`,
  },
  
  // Analytics endpoints
  ANALYTICS: {
    SPEND: `${API_URL}/api/analytics/spend`,
  },
};

// Helper function to format API URLs
export const getApiUrl = (endpoint: string) => `${API_URL}${endpoint}`;

export default {
  API_BASE_URL: API_URL,
  API_ENDPOINTS,
  getApiUrl,
  axios: axiosInstance,
};
