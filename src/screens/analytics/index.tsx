import React, { useState, useCallback, useEffect, memo, useRef, useMemo } from 'react';
import { View, ScrollView, RefreshControl, Text, Pressable, StyleSheet, SafeAreaView, Modal, FlatList, TouchableOpacity, Dimensions, Animated, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons as Icon } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import api from '../../services/api';
import axios from 'axios';
import apiConfig from '../../config/api';

import { styles } from './styles';
import TotalSpentChart from './components/TotalSpentChart';
import TopProductsChart from './components/TopProductsChart';
import MostExpensiveProductsChart from './components/MostExpensiveProductsChart';
import ExpensesByCategoryChart from './components/ExpensesByCategoryChart';
import ShoppingDaysChart from './components/ShoppingDaysChart';
import BillStatsChart from './components/BillStatsChart';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from './contexts/CurrencyContext';
import { useReceipt } from '../../contexts/ReceiptContext';
import { useWidgetOrder, WidgetOrderProvider } from './contexts/WidgetOrderContext';
import { SpendData } from './types';
import { formatCurrency } from './utils/currency';
import jwtDecode from 'jwt-decode';
import AnalyticsHeader from '../../components/AnalyticsHeader';
import { exportAnalyticsAsPDF } from './utils/exportAnalytics';

type RootStackParamList = {
  MainTabs: undefined;
  ReceiptDetail: { receiptData: any };
  Auth: undefined;
  Receipts: { date: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MemoizedTotalSpentChart = memo(TotalSpentChart);
const MemoizedTopProductsChart = memo(TopProductsChart);
const MemoizedMostExpensiveProductsChart = memo(MostExpensiveProductsChart);
const MemoizedExpensesByCategoryChart = memo(ExpensesByCategoryChart);
const MemoizedShoppingDaysChart = memo(ShoppingDaysChart);
const MemoizedBillStatsChart = memo(BillStatsChart);

const AnalyticsScreenContent = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, lastLoginTimestamp, initializeFromToken } = useAuth();
  const { currency } = useCurrency();
  const { refreshTrigger, setRefreshTrigger, triggerRefresh } = useReceipt();
  const [refreshing, setRefreshing] = useState(false);
  const [spendData, setSpendData] = useState<SpendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const lastLoginRef = useRef<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const refreshThreshold = -100; // Only trigger refresh after pulling down 100 pixels
  const isRefreshing = useRef(false);
  const [totalSpentRefreshTrigger, setTotalSpentRefreshTrigger] = useState(0);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [isLoadingUserPlan, setIsLoadingUserPlan] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Use a ref to track if initial data has been loaded
  const hasLoadedInitialData = useRef(false);

  // Modal state for receipts by date
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalReceipts, setModalReceipts] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const { widgetOrder, updateWidgetOrder } = useWidgetOrder();

  const initializeUserId = useCallback(async () => {
    let userId = user?.id;
    
    if (!userId) {
      console.log('[Analytics] No user ID in context, checking token...');
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded: any = jwtDecode(token);
          userId = decoded.user_id;
          console.log('[Analytics] Found user ID in token:', userId);
          
          if (userId) {
            console.log('[Analytics] Setting current user ID:', userId);
            setCurrentUserId(userId.toString());
            return;
          }
        }
      } catch (error) {
        console.error('[Analytics] Error checking token:', error);
      }
    }

    if (userId) {
      console.log('[Analytics] Setting current user ID:', userId);
      setCurrentUserId(userId.toString());
    } else {
      console.log('[Analytics] No user ID available');
      setCurrentUserId(undefined);
    }
  }, [user?.id]);

  useEffect(() => {
    initializeUserId();
  }, [initializeUserId, user?.id]);

  const fetchSpendData = useCallback(async () => {
    if (!currentUserId) {
      console.log('[Analytics] Skipping fetch - no user ID available');
      return;
    }

    setLoading(true);
    setError(null);
    
    const maxRetries = 3;
    let retryCount = 0;
    
    const attemptFetch = async (): Promise<void> => {
      try {
        console.log('[Analytics] Making API request to:', '/api/analytics/spend');
        console.log('[Analytics] Request params:', { user_id: currentUserId, interval });
        
        const res = await api.get('/api/analytics/spend', {
          params: { 
            user_id: currentUserId,
            interval
          }
        });
        
        console.log('[Analytics] API Response status:', res.status);
        console.log('[Analytics] API Response data:', res.data);
        
        if (res.data.data && Array.isArray(res.data.data)) {
          setSpendData(res.data.data);
          setError(null);
          // Only trigger refresh for TotalSpentChart
          setTotalSpentRefreshTrigger(Date.now());
          // Mark initial data as loaded
          hasLoadedInitialData.current = true;
        } else {
          console.log('[Analytics] Invalid response format:', res.data);
          setSpendData([]);
          setError('Invalid data format received');
        }
        setLoading(false);
      } catch (e: any) {
        console.error('[Analytics] Error fetching spend data:', e);
        if (axios.isAxiosError(e)) {
          console.error('[Analytics] Axios error details:', {
            status: e.response?.status,
            statusText: e.response?.statusText,
            data: e.response?.data,
            headers: e.response?.headers
          });
          if (!e.response) {
            Alert.alert('Analytics', 'No internet connection or the server is not responding.');
          }
        } else if (e.message && e.message.toLowerCase().includes('network')) {
          Alert.alert('Analytics', 'No internet connection. Please check your connection and try again.');
        }
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[Analytics] Retrying fetch (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          return attemptFetch();
        }
        setError('Unable to load spend data');
        setSpendData([]);
        setLoading(false);
      }
    };

    await attemptFetch();
  }, [currentUserId, interval]);

  useEffect(() => {
    if (lastLoginTimestamp !== lastLoginRef.current) {
      console.log('[Analytics] Login timestamp changed, triggering refresh');
      console.log('[Analytics] Current user ID:', currentUserId);
      console.log('[Analytics] Last login timestamp:', lastLoginTimestamp);
      lastLoginRef.current = lastLoginTimestamp;
      fetchSpendData();
    }
  }, [lastLoginTimestamp, currentUserId, fetchSpendData]);

  // Add effect to refetch data when interval changes
  useEffect(() => {
    console.log('[Analytics] Interval changed to:', interval);
    if (currentUserId) {
      fetchSpendData();
    }
  }, [interval, currentUserId, fetchSpendData]);

  // Add effect to refetch data when the receipt refresh trigger changes
  useEffect(() => {
    console.log('[Analytics] Receipt refresh trigger changed, refetching spend data');
    fetchSpendData();
  }, [refreshTrigger, fetchSpendData]);

  const onRefresh = useCallback(async () => {
    // Prevent multiple refreshes
    if (isRefreshing.current) {
      return;
    }

    console.log('[Analytics] Manual refresh triggered');
    console.log('[Analytics] Current user ID:', currentUserId);
    
    isRefreshing.current = true;
    setRefreshing(true);
    
    try {
      await initializeUserId();
      await fetchSpendData();
      // Trigger refresh for all other charts
      triggerRefresh();
    } catch (error) {
      console.error('[Analytics] Error during manual refresh:', error);
    } finally {
      setRefreshing(false);
      setShouldRefresh(false);
      isRefreshing.current = false;
    }
  }, [fetchSpendData, currentUserId, initializeUserId, triggerRefresh]);

  // Add effect to handle refresh when shouldRefresh changes
  useEffect(() => {
    if (shouldRefresh && !isRefreshing.current) {
      onRefresh();
    }
  }, [shouldRefresh, onRefresh]);

  // Add effect to refetch data when the screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[Analytics] Screen focused');
      // Only fetch data on the first focus (initial load) or if explicitly triggered
      if (!hasLoadedInitialData.current) {
        console.log('[Analytics] Initial load on focus, fetching data');
        fetchSpendData();
      }
    });

    return unsubscribe;
  }, [navigation, fetchSpendData]);

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollY.setValue(offsetY);
    
    // Only update shouldRefresh if we're not already refreshing
    if (!isRefreshing.current) {
      if (offsetY < refreshThreshold && !shouldRefresh) {
        setShouldRefresh(true);
      } else if (offsetY >= refreshThreshold && shouldRefresh) {
        setShouldRefresh(false);
      }
    }
  }, [shouldRefresh]);

  const handleBarPress = useCallback(async (date: string) => {
    setModalDate(date);
    setModalVisible(true);
    setModalLoading(true);
    setModalError(null);
    setModalReceipts([]);
    try {
      console.log('Fetching receipts for date:', date, 'interval:', interval);
      const res = await api.get('/api/analytics/receipts-by-date', {
        params: { 
          user_id: currentUserId,
          date,
          interval
        }
      });
      console.log('Receipts response:', res.data);
      if (res.data && Array.isArray(res.data.receipts)) {
        setModalReceipts(res.data.receipts);
      } else {
        console.log('Invalid response format:', res.data);
        setModalReceipts([]);
      }
    } catch (e: any) {
      console.error('Error fetching receipts:', e);
      let userMessage = 'Unable to load receipts for this date.';
      if (axios.isAxiosError(e)) {
        if (!e.response) {
          userMessage = 'No internet connection or the server is not responding.';
        }
      } else if (e.message && e.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      setModalError(userMessage);
      setModalReceipts([]);
      Alert.alert('Receipts', userMessage);
    } finally {
      setModalLoading(false);
    }
  }, [currentUserId, interval]);

  // Fetch user plan (copied from HistoryScreen)
  const fetchUserPlan = useCallback(async () => {
    let token = await AsyncStorage.getItem('jwt_token');
    console.log('[Analytics] JWT token for plan fetch:', token);
    if (!token) {
      setUserPlan('basic');
      setIsLoadingUserPlan(false);
      return;
    }
    setIsLoadingUserPlan(true);
    try {
      const response = await fetch(`${apiConfig.API_BASE_URL}/api/subscription/receipt-count`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setUserPlan(data.user_plan);
      } else {
        setUserPlan('basic');
      }
    } catch (e) {
      setUserPlan('basic');
    } finally {
      setIsLoadingUserPlan(false);
    }
  }, []);

  useEffect(() => { fetchUserPlan(); }, [fetchUserPlan]);

  const handleExport = async () => {
    if (!currentUserId || !userPlan) return;
    setExporting(true);
    try {
      const success = await exportAnalyticsAsPDF(currentUserId, userPlan);
      if (!success) {
        alert('Failed to export analytics PDF.');
      }
    } catch (e) {
      alert('Failed to export analytics PDF.');
    } finally {
      setExporting(false);
    }
  };

  const renderItem = useCallback(({ item, drag, isActive }: { item: string, drag: () => void, isActive: boolean }) => {
    const renderWidget = () => {
      switch (item) {
        case 'total_spent':
          return (
            <MemoizedTotalSpentChart
              userId={currentUserId}
              onBarPress={handleBarPress}
              userCurrency={currency}
              spendData={spendData}
              loading={loading}
              error={error}
              interval={interval}
              onIntervalChange={setInterval}
              refreshTrigger={totalSpentRefreshTrigger}
            />
          );
        case 'top_products':
          return (
            <MemoizedTopProductsChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userCurrency={currency}
              userPlan={userPlan}
            />
          );
        case 'most_expensive':
          return (
            <MemoizedMostExpensiveProductsChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userCurrency={currency}
              userPlan={userPlan}
            />
          );
        case 'expenses_by_category':
          return (
            <MemoizedExpensesByCategoryChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userCurrency={currency}
            />
          );
        case 'shopping_days':
          return (
            <MemoizedShoppingDaysChart
              refreshTrigger={refreshTrigger}
              userPlan={userPlan}
            />
          );
        case 'bill_stats':
          return (
            <MemoizedBillStatsChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userCurrency={currency}
            />
          );
        default:
          return null;
      }
    };

    return (
      <ScaleDecorator>
        <View style={styles.widgetContainer}>
          <TouchableOpacity
            onLongPress={drag}
            disabled={isActive}
            style={styles.dragHandle}
            activeOpacity={0.7}
          >
            <Icon name="reorder-two" size={20} color="#7e5cff" />
          </TouchableOpacity>
          {renderWidget()}
        </View>
      </ScaleDecorator>
    );
  }, [currentUserId, currency, spendData, loading, error, interval, refreshTrigger, handleBarPress, totalSpentRefreshTrigger, userPlan]);

  const onDragEnd = useCallback(async ({ data }: { data: string[] }) => {
    try {
      // Add a small delay to ensure the animation completes
      await new Promise(resolve => setTimeout(resolve, 100));
      await updateWidgetOrder(data);
    } catch (error) {
      console.error('Failed to update widget order:', error);
    }
  }, [updateWidgetOrder]);

  const memoizedWidgetOrder = useMemo(() => widgetOrder, [widgetOrder]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#16191f' }}>
      <AnalyticsHeader onExportPress={handleExport} />
      <View style={{ flex: 1, backgroundColor: '#16191f' }}>
        <DraggableFlatList
          data={memoizedWidgetOrder}
          onDragEnd={onDragEnd}
          keyExtractor={(item) => item}
          renderItem={renderItem}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7e5cff"
              colors={['#7e5cff']}
              progressViewOffset={20}
              enabled={true}
            />
          }
          contentContainerStyle={{ padding: 16 }}
        />
        {/* Modal for receipts by date */}
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
                  Receipts for {modalDate}
                </Text>
              </View>
              {modalLoading ? (
                <Text style={styles.modalLoading}>Loading...</Text>
              ) : modalError ? (
                <Text style={[styles.modalEmpty, { color: 'red' }]}>{modalError}</Text>
              ) : modalReceipts.length === 0 ? (
                <Text style={styles.modalEmpty}>No receipts found for this date.</Text>
              ) : (
                <View style={{ flex: 1, minHeight: 100 }}>
                  <FlatList
                    data={modalReceipts}
                    keyExtractor={(item) => item.id.toString()}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 16 }}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    renderItem={({ item }) => (
                      <Pressable
                        style={({ pressed }) => [{
                          backgroundColor: '#2a2d47',
                          borderRadius: 8,
                          paddingTop: 6,
                          paddingBottom: 6,
                          paddingLeft: 8,  
                          paddingRight: 8,
                          marginBottom: 4
                        }]}
                        onPress={() => {
                          setModalVisible(false);
                          navigation.navigate('ReceiptDetail', { receiptData: item });
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={{ color: '#e6e9f0', fontWeight: '600', fontSize: 16 }}>{item.store_name}</Text>
                            <Text style={{ color: '#8ca0c6', fontSize: 14, marginTop: 2 }}>{item.store_category}</Text>
                          </View>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 8 }}>{formatCurrency(item.total, item.currency || currency)}</Text>
                          <Icon name="chevron-forward" size={22} color="#8ca0c6" />
                        </View>
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
    </SafeAreaView>
  );
};

const AnalyticsScreen = () => {
  return (
    <WidgetOrderProvider>
      <AnalyticsScreenContent />
    </WidgetOrderProvider>
  );
};

export default memo(AnalyticsScreen); 