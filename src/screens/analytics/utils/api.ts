import apiConfig from '../../../config/api';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { API_BASE_URL } = apiConfig;
export { API_BASE_URL };

export const fetchShoppingDays = async (userId: number, period: 'month' | 'all', store_name?: string | null, store_category?: string | null): Promise<any> => {
    const token = await AsyncStorage.getItem('jwt_token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

    const response = await axios.get(`${API_BASE_URL}/api/analytics/shopping-days`, {
      params: {
        user_id: userId,
      period,
      store_name,
      store_category
      },
    headers
  });

  return response.data;
};

export const fetchSpendData = async (userId: number, interval: 'daily' | 'weekly' | 'monthly', store_name?: string | null, store_category?: string | null): Promise<any> => {
  const token = await AsyncStorage.getItem('jwt_token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const response = await axios.get(`${API_BASE_URL}/api/analytics/spend`, {
    params: { 
      user_id: userId,
      interval,
      store_name,
      store_category
    },
    headers
  });

  return response.data;
};

export const fetchTopProducts = async (userId: number, period: 'week' | 'month' | 'all', store_name?: string | null, store_category?: string | null): Promise<any> => {
  const token = await AsyncStorage.getItem('jwt_token');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const response = await axios.get(`${API_BASE_URL}/api/analytics/top-products`, {
    params: { 
      user_id: userId,
      period,
      store_name,
      store_category
    },
    headers
  });

  return response.data;
}; 