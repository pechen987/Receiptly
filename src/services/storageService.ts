import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
import apiConfig from '../config/api';

// Helper to get user ID from stored JWT token
export const getUserIdFromToken = async (): Promise<number | null> => {
  try {
    const token = await AsyncStorage.getItem('jwt_token');
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    return decoded.user_id || decoded.id || null;
  } catch (e) {
    console.error('Error decoding JWT for user id', e);
    return null;
  }
};

export interface ReceiptItem {
  name: string | null;
  quantity: number | null;
  category: string | null;
  price: number | null;
  total: number | null;
  discount: number | null;
}

export interface Receipt {
  id: string;
  fingerprint: string;
  store_category: string | null;
  store_name: string | null;
  date: string;
  total: number | null;
  tax_amount: number | null;
  total_discount: number | null;
  items: ReceiptItem[];
  timestamp: number;
}

const BACKEND_URL = apiConfig.API_BASE_URL;

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const generateFingerprint = async (receipt: Omit<Receipt, 'id' | 'timestamp' | 'fingerprint'>): Promise<string> => {
  const canonical = JSON.stringify({
    store_category: receipt.store_category,
    store_name: receipt.store_name,
    date: receipt.date,
    total: receipt.total,
    tax_amount: receipt.tax_amount,
    total_discount: receipt.total_discount,
    items: receipt.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      category: item.category,
      price: item.price,
      total: item.total,
      discount: item.discount
    }))
  });
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
};

export const getReceipts = async (): Promise<Receipt[]> => {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) {
      console.error('No user ID found - user might not be authenticated');
      throw new Error('No user id found');
    }

    console.log('Fetching receipts for user:', userId);
    console.log('API URL:', `${BACKEND_URL}/api/receipts?user_id=${userId}`);

    // Get the JWT token from AsyncStorage
    const token = await AsyncStorage.getItem('jwt_token');

    // Create headers object, including Authorization if token exists
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BACKEND_URL}/api/receipts?user_id=${userId}`, {
      method: 'GET',
      headers: headers, // Include the headers in the fetch request
    });
    
    if (response.status === 429) {
      Alert.alert(
        'Rate Limit Reached',
        'You\'ve made too many requests. Please wait a while before trying again.'
      );
      return [];
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Failed to fetch receipts: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.receipts || [];
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      console.error('Network error details:', error);
      Alert.alert(
        'Network Error',
        'Could not connect to backend. Please check your connection and make sure the server is running.'
      );
    } else {
      console.error('Error fetching receipts:', error);
      Alert.alert(
        'Error',
        'Failed to load receipts. Please try again later.'
      );
    }
    return [];
  }
};

export const deleteReceipt = async (id: string): Promise<void> => {
  try {
    const token = await AsyncStorage.getItem('jwt_token');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${BACKEND_URL}/api/receipts/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || 'Failed to delete receipt';
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Error deleting receipt:', error);
    Alert.alert('Error', 'Failed to delete receipt');
  }
};

export const saveReceipt = async (receipt: Omit<Receipt, 'id' | 'timestamp' | 'fingerprint'>): Promise<Receipt | null> => {
  try {
    const fingerprint = await generateFingerprint(receipt);
    const now = Date.now();

    const newReceipt: Receipt = {
      ...receipt,
      id: generateUUID(),
      timestamp: now,
      fingerprint,
    };

    let response;
    try {
      const userId = await getUserIdFromToken();
      if (!userId) throw new Error('No user id found');
      // Validate total and date
      if (receipt.total == null || !receipt.date) throw new Error('Receipt must have total and date');
      
      // Retrieve token directly from AsyncStorage for API call
      const token = await AsyncStorage.getItem('jwt_token');
      if (!token) {
        console.error('No token found for saving receipt.');
        Alert.alert('Authentication Error', 'Could not save receipt. Please log in again.');
        return null;
      }

      response = await apiConfig.axios.post(`${BACKEND_URL}/api/receipts`, {
        user_id: userId,
        ...receipt,
        fingerprint
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
    } catch (netError: any) {
      if (netError instanceof TypeError && netError.message.includes('Network request failed')) {
        Alert.alert('Network Error', 'Could not connect to backend. Check your connection.');
        return null;
      }
       // Handle backend errors, including the 403 Forbidden for limit reached
      if (netError.response && netError.response.status) {
          const status = netError.response.status;
          const errorMessage = netError.response.data?.error || `Request failed with status ${status}`;

          if (status === 403) {
             Alert.alert('Limit Reached', errorMessage);
          } else if (status === 409) {
             // Duplicate receipt handled below, do nothing here
             console.log('Duplicate receipt detected by backend.');
          } else {
              Alert.alert('Backend Error', errorMessage);
          }
           // For 403 and other backend errors, don't throw, just return null after showing alert
          return null;

      }
      throw netError; // Re-throw if it's an unhandled error
    }

    if (response.status === 409) {
      // Duplicate receipt: do nothing visible to user
      console.log('Duplicate receipt detected by frontend status check.');
      return null;
    }
    // *** FIX: Accept 201 Created as a success status ***
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Failed to save receipt to backend. Status: ${response.status}`);
    }

    const saved = response.data;
    return { ...newReceipt, id: saved.id }; // Update with backend ID if needed
  } catch (error: any) {
    console.error('Error saving receipt:', error);
    // Only show a generic error if a specific one wasn't handled earlier
    if (!error.response) { // Check if it's not an axios error with a response
         Alert.alert('Error', error.message || 'Failed to save receipt.');
    }
    return null;
  }
};

export function normalizeDateToYMD(dateStr: string): string {
  // Handles DD-MM-YYYY or YYYY-MM-DD, returns YYYY-MM-DD
  if (!dateStr) return '';
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  }
  // If already in YYYY-MM-DD, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  // Try to parse with Date for other formats
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return dateStr;
}

// Utility function to normalize strings
const normalizeString = (str: string | null): string | null => {
  if (!str) return null;
  const words = str.toLowerCase().split(' ');
  if (words.length === 0) return null;
  
  // Capitalize only the first word
  const firstWord = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  // Keep all other words lowercase
  const restOfWords = words.slice(1);
  
  return [firstWord, ...restOfWords].join(' ');
};

export const saveReceiptFromOpenAI = async (openAIReceipt: any): Promise<Receipt | null> => {
  try {
    if (!openAIReceipt || openAIReceipt.error === 'Image does not appear to be a receipt.') {
      console.log('Skipping save: Not a receipt.');
      return null;
    }

    const receipt: Omit<Receipt, 'id' | 'timestamp' | 'fingerprint'> = {
      store_category: normalizeString(openAIReceipt.store_category),
      store_name: normalizeString(openAIReceipt.store_name),
      date: normalizeDateToYMD(openAIReceipt.date),
      total: openAIReceipt.total,
      tax_amount: openAIReceipt.tax_amount,
      total_discount: openAIReceipt.total_discount,
      items: openAIReceipt.items.map((item: ReceiptItem) => ({
        ...item,
        name: normalizeString(item.name),
        category: normalizeString(item.category)
      }))
    };
    return await saveReceipt(receipt);
  } catch (error) {
    console.error('Error saving OpenAI receipt:', error);
    Alert.alert('Error', 'Failed to save receipt.');
    return null;
  }
};
