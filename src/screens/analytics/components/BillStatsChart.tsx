import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { styles } from '../styles';
import axios from 'axios';
import { API_BASE_URL } from '../utils';
import { formatCurrency } from '../utils/currency';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
// Import the reusable HintModal and styles
import { HintIcon, HintModal, modalStyles, HintIconProps, HintModalProps } from './HintComponents';

interface BillStatsChartProps {
  userId?: string;
  refreshTrigger: number;
  userCurrency: string;
}

interface BillStats {
  total_receipts: number;
  average_bill: number;
  average_bill_delta: number | null;
  currency: string;
  has_data: boolean;
}

const BillStatsChart: React.FC<BillStatsChartProps> = ({ userId, refreshTrigger, userCurrency }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<BillStats | null>(null);
  const [interval, setInterval] = useState<'M' | 'All'>('M');
  const [hasData, setHasData] = useState(false);

  const fetchStats = async () => {
    let currentUserId = userId;
    
    if (!currentUserId) {
      console.log('[BillStats] No user ID in props, checking token...');
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded: any = jwtDecode(token);
          currentUserId = decoded.user_id || decoded.id;
          console.log('[BillStats] Found user ID in token:', currentUserId);
        }
      } catch (error) {
        console.error('[BillStats] Error checking token:', error);
      }
    }

    if (!currentUserId) {
      console.log('[BillStats] Skipping fetch - no user ID available');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('[BillStats] Making API request to:', `${API_BASE_URL}/api/analytics/bill-stats`);
      console.log('[BillStats] Request params:', { 
        user_id: currentUserId, 
        interval 
      });

      const res = await axios.get(`${API_BASE_URL}/api/analytics/bill-stats`, {
        params: { 
          user_id: currentUserId,
          interval
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('jwt_token')}`
        }
      });

      console.log('[BillStats] API Response:', res.data);
      setStats(res.data);
      setHasData(res.data.has_data === true);
    } catch (e: any) {
      console.error('[BillStats] Error fetching bill stats:', e);
      let userMessage = 'Unable to load bill statistics.';
      if (axios.isAxiosError(e)) {
        if (!e.response) {
          userMessage = 'No internet connection or the server is not responding.';
        }
      } else if (e.message && e.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      setError(userMessage);
      Alert.alert('Bill Statistics', userMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [userId, interval, refreshTrigger]);

  if (loading) {
    return (
      <View style={[styles.widgetBg, { minHeight: 180 }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleWithIcon}>
            <Icon name="dollar-sign" size={20} color="#7e5cff" />
            <Text style={styles.title}>Bill statistics</Text>
            <HintIcon hintText="This chart displays the total number of receipts you've added and calculates your average bill amount. These statistics are for the last 30 days or all time, depending on the selected interval." />
          </View>
          <View style={styles.selector}>
            <Pressable
              style={[styles.btn, interval === 'M' && styles.btnActive]}
              onPress={() => setInterval('M')}
            >
              <Text style={[styles.btnText, interval === 'M' && styles.btnTextActive]}>M</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, interval === 'All' && styles.btnActive]}
              onPress={() => setInterval('All')}
            >
              <Text style={[styles.btnText, interval === 'All' && styles.btnTextActive]}>All</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ActivityIndicator color="#7e5cff" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.widgetBg, { minHeight: 180 }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleWithIcon}>
            <Icon name="dollar-sign" size={20} color="#7e5cff" />
            <Text style={styles.title}>Bill statistics</Text>
            <HintIcon hintText="This chart displays the total number of receipts you've added and calculates your average bill amount. These statistics are for the last 30 days or all time, depending on the selected interval." />
          </View>
        </View>
        <Text style={styles.message}>{error}</Text>
      </View>
    );
  }

  if (!hasData) {
    return (
      <View style={[styles.widgetBg, { minHeight: 180 }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleWithIcon}>
            <Icon name="dollar-sign" size={20} color="#7e5cff" />
            <Text style={styles.title}>Bill statistics</Text>
            <HintIcon hintText="This chart displays the total number of receipts you've added and calculates your average bill amount. These statistics are for the last 30 days or all time, depending on the selected interval." />
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.message}>No data yet</Text>
        </View>
      </View>
    );
  }

  if (!stats || stats.total_receipts === 0) {
  return (
      <View style={[styles.widgetBg, { minHeight: 180 }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleWithIcon}>
          <Icon name="dollar-sign" size={20} color="#7e5cff" />
          <Text style={styles.title}>Bill statistics</Text>
            <HintIcon hintText="This chart displays the total number of receipts you've added and calculates your average bill amount. These statistics are for the last 30 days or all time, depending on the selected interval." />
        </View>
          <View style={styles.selector}>
            <Pressable
              style={[styles.btn, interval === 'M' && styles.btnActive]}
              onPress={() => setInterval('M')}
            >
              <Text style={[styles.btnText, interval === 'M' && styles.btnTextActive]}>M</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, interval === 'All' && styles.btnActive]}
              onPress={() => setInterval('All')}
            >
              <Text style={[styles.btnText, interval === 'All' && styles.btnTextActive]}>All</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.message}>No data for this interval</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.widgetBg, { paddingBottom: 16, minHeight: 180 }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleWithIcon}>
          <Icon name="dollar-sign" size={20} color="#7e5cff" />
          <Text style={styles.title}>Bill statistics</Text>
          <HintIcon hintText="This chart displays the total number of receipts you've added and calculates your average bill amount. These statistics are for the last 30 days or all time, depending on the selected interval." />
        </View>
        <View style={styles.selector}>
          <Pressable
            style={[styles.btn, interval === 'M' && styles.btnActive]}
            onPress={() => setInterval('M')}
          >
            <Text style={[styles.btnText, interval === 'M' && styles.btnTextActive]}>M</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, interval === 'All' && styles.btnActive]}
            onPress={() => setInterval('All')}
          >
            <Text style={[styles.btnText, interval === 'All' && styles.btnTextActive]}>All</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        {/* Average Bill */}
        <View style={{ flex: 1, alignItems: 'center', marginRight: 8 }}>
          <Text style={{ color: '#8ca0c6', fontSize: 14, marginBottom: 4 }}>Average bill</Text>
          <Text style={{ color: '#e6e9f0', fontSize: 32, fontWeight: '700' }}>
            {formatCurrency(Number(stats.average_bill.toFixed(1)), stats.currency)}
          </Text>
          {stats.average_bill_delta !== null && stats.average_bill_delta !== 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Icon 
                name={stats.average_bill_delta > 0 ? "arrow-up" : "arrow-down"} 
                size={16} 
                color={stats.average_bill_delta > 0 ? "#4CAF50" : "#FF5252"} 
              />
              <Text style={{ 
                color: stats.average_bill_delta > 0 ? "#4CAF50" : "#FF5252",
                marginLeft: 4,
                fontSize: 14,
                fontWeight: '600'
              }}>
                {formatCurrency(Number(Math.abs(stats.average_bill_delta).toFixed(1)), stats.currency)}
              </Text>
            </View>
          )}
        </View>

        {/* Total Receipts */}
        <View style={{ flex: 1, alignItems: 'center', marginLeft: 8 }}>
          <Text style={{ color: '#8ca0c6', fontSize: 14, marginBottom: 4 }}>Total receipts</Text>
          <Text style={{ color: '#e6e9f0', fontSize: 32, fontWeight: '700' }}>
            {stats.total_receipts}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default BillStatsChart; 