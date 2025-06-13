import apiConfig from '../../../config/api';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { API_BASE_URL } = apiConfig;
export { API_BASE_URL };

export const fetchShoppingDays = async (userId: number, period: 'month' | 'all'): Promise<any> => {
  try {
    // Retrieve the token from AsyncStorage
    const token = await AsyncStorage.getItem('jwt_token');

    // Define headers, including the Authorization header if token exists
    const headers = token ? {
      Authorization: `Bearer ${token}`,
    } : {};

    const response = await axios.get(`${API_BASE_URL}/api/analytics/shopping-days`, {
      params: {
        user_id: userId,
        period
      },
      headers: headers, // Include the headers in the request
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching shopping days:', error);
    throw error;
  }
}; 