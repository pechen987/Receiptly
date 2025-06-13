import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './api';
import { Buffer } from 'buffer';

// Helper to fetch with JWT
async function fetchWithAuth(url: string, params: any = {}) {
  const token = await AsyncStorage.getItem('jwt_token');
  return axios.get(url, {
    params,
    headers: { 'Authorization': `Bearer ${token}` },
  });
}

// Main export function
export async function exportAnalyticsAsPDF(userId: string, userPlan: string) {
  // 1. Determine endpoints and intervals
  const endpoints: { [key: string]: { url: string, intervals: string[] } } = {
    bill_stats: { url: '/api/analytics/bill-stats', intervals: ['M', 'All'] },
    total_spent: { url: '/api/analytics/spend', intervals: ['daily', 'weekly', 'monthly'] },
    by_category: { url: '/api/analytics/expenses-by-category', intervals: ['week', 'month', 'all'] },
    top_products: { url: '/api/analytics/top-products', intervals: ['month', 'year', 'all'] },
    most_expensive: { url: '/api/analytics/most-expensive-products', intervals: ['month', 'year', 'all'] },
    shopping_days: { url: '/api/analytics/shopping-days', intervals: ['month', 'all'] },
  };

  // 2. Filter endpoints by plan
  const chartsToExport = userPlan === 'basic'
    ? ['bill_stats', 'total_spent', 'by_category']
    : Object.keys(endpoints);

  // 3. Fetch all data
  const analyticsData: any = {};
  for (const chart of chartsToExport) {
    analyticsData[chart] = {};
    for (const interval of endpoints[chart].intervals) {
      let params: any = { user_id: userId };
      // Map interval param names
      if (chart === 'bill_stats') params.interval = interval;
      if (chart === 'total_spent') params.interval = interval;
      if (chart === 'by_category') params.period = interval;
      if (chart === 'top_products' || chart === 'most_expensive') params.period = interval;
      if (chart === 'shopping_days') params.period = interval;
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}${endpoints[chart].url}`, params);
        analyticsData[chart][interval] = res.data;
      } catch (e) {
        analyticsData[chart][interval] = { error: true };
      }
    }
  }

  // 4. Send to backend for PDF generation
  try {
    const token = await AsyncStorage.getItem('jwt_token');
    const res = await axios.post(
      `${API_BASE_URL}/api/analytics/export-pdf`,
      {
        user_plan: userPlan,
        data: analyticsData,
        export_date: new Date().toISOString(),
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );
    // Convert ArrayBuffer to base64
    const base64 = Buffer.from(res.data, 'binary').toString('base64');
    const fileUri = FileSystem.cacheDirectory + `analytics_export_${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
    return true;
  } catch (e) {
    return false;
  }
} 