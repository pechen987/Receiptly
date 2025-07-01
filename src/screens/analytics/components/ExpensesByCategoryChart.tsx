import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Modal, FlatList, Alert } from 'react-native';
import { Svg, G, Path, Circle, Text as SvgText } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import { memo } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
import { formatCurrency } from '../utils/currency';
import { styles } from '../styles';
import { ChartProps, CategoryData } from '../types';
import { API_BASE_URL, getProductColor, formatTotalInt } from '../utils';
import { HintIcon, HintModal, modalStyles, HintIconProps, HintModalProps } from './HintComponents';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const ExpensesByCategoryChart = memo(({ userId, refreshTrigger, navigation: propNavigation, selectedStore, selectedCategory }: ChartProps & { navigation?: any; selectedStore: string | null; selectedCategory: string | null }) => {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [data, setData] = useState<CategoryData[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasDataInAnyPeriod, setHasDataInAnyPeriod] = useState(false);
  // const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modal state for category receipts
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [modalReceipts, setModalReceipts] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const makeRequest = async (url: string, params: any, headers: any, retryCount: number = 0): Promise<any> => {
    try {
      const response = await axios.get(url, { params, headers });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`[CategoryExpenses] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          return makeRequest(url, params, headers, retryCount + 1);
        }
      }
      throw error;
    }
  };

  const fetchData = useCallback(async (force: boolean = false) => {
    let currentUserId = userId;
    
    if (!currentUserId) {
      console.log('[CategoryExpenses] No user ID in props, checking token...');
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded: any = jwtDecode(token);
          currentUserId = decoded.user_id || decoded.id;
          console.log('[CategoryExpenses] Found user ID in token:', currentUserId);
        }
      } catch (error) {
        console.error('[CategoryExpenses] Error checking token:', error);
      }
    }

    if (!currentUserId) {
      console.log('[CategoryExpenses] Skipping fetch - no user ID available');
      return;
    }

    // Prevent rapid consecutive calls
    // if (fetchTimeoutRef.current) {
    //   clearTimeout(fetchTimeoutRef.current);
    // }

    // fetchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('[CategoryExpenses] Making API request to:', `${API_BASE_URL}/api/analytics/expenses-by-category`);
        console.log('[CategoryExpenses] Request params:', { 
          user_id: currentUserId, 
          period,
          store_name: selectedStore,
          store_category: selectedCategory
        });

        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('jwt_token')}`
        };

        const res = await makeRequest(
          `${API_BASE_URL}/api/analytics/expenses-by-category`,
          { user_id: currentUserId, period, store_name: selectedStore, store_category: selectedCategory },
          headers
        );

        console.log('[CategoryExpenses] API Response:', res);
        const newData = res.categories || [];
        const newCurrency = res.currency || 'USD';
        
        setData(newData);
        setCurrency(newCurrency);

        // Check other periods for data
        console.log('[CategoryExpenses] Checking other periods for data...');
        const periods: ('week' | 'month' | 'all')[] = ['week', 'month', 'all'];
        let hasData = newData.length > 0;
        
        if (!hasData) {
          for (const p of periods) {
            if (p === period) continue;
            try {
              const periodRes = await makeRequest(
                `${API_BASE_URL}/api/analytics/expenses-by-category`,
                { user_id: currentUserId, period: p, store_name: selectedStore, store_category: selectedCategory },
                headers
              );
              
              if (periodRes.categories && periodRes.categories.length > 0) {
                hasData = true;
                break;
              }
            } catch (e) {
              console.error(`[CategoryExpenses] Error checking period ${p}:`, e);
            }
          }
        }
        
        setHasDataInAnyPeriod(hasData);
      } catch (e: any) {
        console.error('[CategoryExpenses] Error fetching category expenses:', e);
        let userMessage = 'Unable to load category expenses.';
        if (axios.isAxiosError(e)) {
          if (!e.response) {
            userMessage = 'No internet connection or the server is not responding.';
          }
        } else if (e.message && e.message.toLowerCase().includes('network')) {
          userMessage = 'No internet connection. Please check your connection and try again.';
        }
        setError(userMessage);
        setData([]);
        setHasDataInAnyPeriod(false);
        Alert.alert('Category Expenses', userMessage);
      } finally {
        setLoading(false);
      }
    // }, 300); // 300ms debounce
  }, [userId, period, selectedStore, selectedCategory]);

  useEffect(() => { 
    fetchData();
  }, [period, userId, fetchData, refreshTrigger]);

  useEffect(() => { 
    if (refreshTrigger !== undefined) {
      fetchData(true); // Force refresh on trigger
    }
  }, [refreshTrigger, fetchData]);

  // Pie chart math
  const chartSize = 220;
  const radius = chartSize / 2 - 18;
  const center = chartSize / 2;
  const donutRadius = radius * 0.5; // Donut hole size
  const total = data.reduce((sum, d) => sum + d.total, 0);
  const sliceGapDeg = 3; // degrees between slices

  // Pie slice generator with gap
  const getPieSlices = () => {
    let angleStart = 0;
    return data.map((d, i) => {
      const value = d.total;
      // For a single category, use full 360 degrees minus a small gap
      const angle = total === 0 ? 0 : data.length === 1 ? 357 : (value / total) * 360 - sliceGapDeg;
      const angleEnd = angleStart + Math.max(angle, 0);
      // Convert to radians
      const startRad = (Math.PI / 180) * angleStart;
      const endRad = (Math.PI / 180) * angleEnd;
      // Pie slice points
      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);
      const largeArc = angle > 180 ? 1 : 0;
      const pathData = [
        `M ${center} ${center}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');
      // Next slice starts after the gap only if there are multiple categories
      angleStart = angleEnd + (data.length > 1 ? sliceGapDeg : 0);
      return { pathData, color: getProductColor(d.category), value, category: d.category };
    });
  };

  const pieSlices = getPieSlices();

  // Fetch receipts for a category
  const handleLegendPress = useCallback(async (category: string) => {
    setModalCategory(category);
    setModalVisible(true);
    setModalLoading(true);
    setModalError(null);
    setModalReceipts([]);
    try {
      console.log('Fetching items for category:', category, 'period:', period);

      const token = await AsyncStorage.getItem('jwt_token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '' // Add token if available
      };

      const res = await axios.get(`${API_BASE_URL}/api/analytics/products-by-category`, {
        params: { 
          user_id: userId, 
          category, 
          period,
          store_name: selectedStore,
          store_category: selectedCategory
        },
        headers: headers // Add headers here
      });
      console.log('Items response:', res.data);
      if (res.data && Array.isArray(res.data.items)) {
        setModalReceipts(res.data.items);
        setCurrency(res.data.currency || 'USD');
      } else {
        console.log('Invalid response format:', res.data);
        setModalReceipts([]);
      }
    } catch (e: any) {
      console.error('Error fetching category items:', e);
      let userMessage = 'Unable to load items for this category.';
      if (axios.isAxiosError(e)) {
        if (!e.response) {
          userMessage = 'No internet connection or the server is not responding.';
        }
      } else if (e.message && e.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      setModalError(userMessage);
      setModalReceipts([]);
      Alert.alert('Category Items', userMessage);
    } finally {
      setModalLoading(false);
    }
  }, [userId, period, selectedStore, selectedCategory]);

  const hasData = data.length > 0 && total > 0;

  return (
    <View style={[styles.widgetBg, { paddingBottom: 16, minHeight: 180 }]}> 
      <View style={styles.titleRow}>
        <View style={styles.titleWithIcon}>
          <Icon name="pie-chart" size={22} color="#7e5cff" style={{ marginRight: 8 }} />
          <Text style={styles.title}>By category</Text>
          <HintIcon hintText="This chart shows the breakdown of your spending by category for the selected period (last 7 days, last 30 days, or all time). The totals are calculated from the items in your receipts. Click on a category in the legend below to view the purchased products in that category." />
        </View>
        {hasDataInAnyPeriod && (
          <View style={styles.selector}>
            {[
              { label: 'W', value: 'week' },
              { label: 'M', value: 'month' },
              { label: 'All', value: 'all' },
            ].map(({ label, value }) => (
              <Pressable
                key={value}
                style={[styles.btn, period === value && styles.btnActive, { paddingHorizontal: 10 }]}
                onPress={() => setPeriod(value as 'week' | 'month' | 'all')}
              >
                <Text style={[styles.btnText, period === value && styles.btnTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <View style={{ flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center' }}>
        {loading ? (
          <View style={styles.emptyCompact}>
            <Text style={styles.message}>Loading category expenses...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyCompact}>
            <Text style={[styles.message, { color: 'red' }]}>{error}</Text>
          </View>
        ) : !hasDataInAnyPeriod ? (
          <View style={styles.emptyCompact}>
            <Text style={styles.message}>No data yet</Text>
          </View>
        ) : !hasData ? (
          <View style={styles.emptyCompact}>
            <Text style={styles.message}>No data for this interval</Text>
          </View>
        ) : (
          <View style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={chartSize} height={chartSize}>
              {pieSlices.map((slice, i) => (
                <Path key={i} d={slice.pathData} fill={slice.color} stroke="#fff" strokeWidth={0.5} />
              ))}
              {/* Donut hole */}
              <Circle cx={center} cy={center} r={donutRadius} fill="#202338" />
              {/* Center label: total sum */}
              <SvgText
                x={center}
                y={center}
                fontSize={24}
                fill="#fff"
                fontWeight="700"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {formatTotalInt(total, currency)}
              </SvgText>
              {/* Center label: Total text */}
              <SvgText
                x={center}
                y={center + 18}
                fontSize={12}
                fill="#9ca3af"
                fontWeight="500"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                Total
              </SvgText>
            </Svg>
            {/* Legend */}
            <View style={{ marginTop: 18, paddingHorizontal: 16, paddingBottom: 8, width: '100%', alignSelf: 'center' }}>
              {data.slice(0, 7).map((d, i) => (
                <Pressable
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 6,
                    backgroundColor: '#2a2d47',
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    width: '100%',
                    alignSelf: 'stretch',
                  }}
                  onPress={() => handleLegendPress(d.category)}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: getProductColor(d.category), marginRight: 12, borderWidth: 1, borderColor: '#202338' }} />
                  <Text style={{ color: '#e6e9f0', fontWeight: '600', flex: 1, fontSize: 16 }} numberOfLines={1}>{d.category}</Text>
                  <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8, fontSize: 16 }}>{formatCurrency(d.total, currency)}</Text>
                  <Icon name="chevron-right" size={22} color="#8ca0c6" style={{ marginLeft: 8 }} />
                </Pressable>
              ))}
              {data.length > 7 && (
                <Text style={{ color: '#8ca0c6', marginTop: 4, fontSize: 13 }}>+{data.length - 7} more</Text>
              )}
            </View>
          </View>
        )}
      </View>
      {/* Modal for receipts by category */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent={true}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.modalContainer, { maxHeight: '80%' }]} onPress={e => e.stopPropagation()}>
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.modalTitle}>
                Products in {modalCategory}
              </Text>
            </View>
            {modalLoading ? (
              <Text style={styles.modalLoading}>Loading...</Text>
            ) : modalError ? (
              <Text style={[styles.modalEmpty, { color: 'red' }]}>{modalError}</Text>
            ) : modalReceipts.length === 0 ? (
              <Text style={styles.modalEmpty}>No items found for this category.</Text>
            ) : (
              <View style={{ flex: 1, minHeight: 100 }}>
                {/* Table header */}
                <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#232632', marginBottom: 4 }}>
                  <Text style={{ flex: 2, color: '#8ca0c6', fontWeight: '700', fontSize: 15 }}>Name</Text>
                  <Text style={{ flex: 1, color: '#8ca0c6', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>Qty</Text>
                  <Text style={{ flex: 1, color: '#8ca0c6', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>Price</Text>
                  <Text style={{ flex: 1, color: '#8ca0c6', fontWeight: '700', fontSize: 15, textAlign: 'right' }}>Total</Text>
                </View>
                <FlatList
                  data={modalReceipts}
                  keyExtractor={(_, idx) => idx.toString()}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                  renderItem={({ item }) => (
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderRadius: 8,
                        paddingVertical: 7,
                        paddingHorizontal: 8,
                        backgroundColor: '#232632', // Static background
                      }}
                    >
                      <Text style={{ flex: 2, color: '#e6e9f0', fontWeight: '500', fontSize: 15 }} numberOfLines={1}>{item.name}</Text>
                      <Text style={{ flex: 1, color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 15 }}>{item.quantity ?? '-'}</Text>
                      <Text style={{ flex: 1, color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 15 }}>{item.price !== undefined && item.price !== null ? formatCurrency(item.price, currency) : '-'}</Text>
                      <Text style={{ flex: 1, color: '#fff', textAlign: 'right', fontWeight: '700', fontSize: 15 }}>{item.total !== undefined && item.total !== null ? formatCurrency(item.total, currency) : '-'}</Text>
                    </Pressable>
                  )}
                />
              </View>
            )}
            <View style={{ marginTop: 'auto', paddingTop: 16 }}>
              <Pressable style={styles.closeModalBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.closeModalText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

export default ExpensesByCategoryChart; 