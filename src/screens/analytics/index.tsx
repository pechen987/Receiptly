import React, { useState, useCallback, useEffect, memo, useRef, useMemo } from 'react';
import { View, ScrollView, RefreshControl, Text, Pressable, Modal, FlatList, TouchableOpacity, Dimensions, Animated, Alert, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import DietCompositionChart from './components/DietCompositionChart';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from './contexts/CurrencyContext';
import { useReceipt } from '../../contexts/ReceiptContext';
import { useWidgetOrder, WidgetOrderProvider } from './contexts/WidgetOrderContext';
import { formatCurrency } from './utils/currency';
import jwtDecode from 'jwt-decode';
import AnalyticsHeader from '../../components/AnalyticsHeader';
import { exportAnalyticsAsPDF } from './utils/exportAnalytics';
import FilterScreen from './components/FilterScreen';

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
const MemoizedDietCompositionChart = memo(DietCompositionChart);

const AnalyticsScreenContent = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, lastLoginTimestamp, initializeFromToken, planRefreshTrigger } = useAuth();
  const { currency } = useCurrency();
  const { refreshTrigger, setRefreshTrigger, triggerRefresh } = useReceipt();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLoginRef = useRef<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const refreshThreshold = -100; // Only trigger refresh after pulling down 100 pixels
  const isRefreshing = useRef(false);
  const [userPlan, setUserPlan] = useState<string>('basic');
  const [isLoadingUserPlan, setIsLoadingUserPlan] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
        console.log('[Analytics] Error checking token:', error);
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

  useEffect(() => {
    if (lastLoginTimestamp !== lastLoginRef.current) {
      console.log('[Analytics] Login timestamp changed, triggering refresh');
      console.log('[Analytics] Current user ID:', currentUserId);
      console.log('[Analytics] Last login timestamp:', lastLoginTimestamp);
      lastLoginRef.current = lastLoginTimestamp;
    }
  }, [lastLoginTimestamp, currentUserId]);

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
      // Trigger refresh for all charts
      triggerRefresh();
    } catch (error) {
      console.log('[Analytics] Error during manual refresh:', error);
    } finally {
      setRefreshing(false);
      setShouldRefresh(false);
      isRefreshing.current = false;
    }
  }, [currentUserId, initializeUserId, triggerRefresh]);

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
        onRefresh();
      }
    });

    return unsubscribe;
  }, [navigation, onRefresh]);

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
      console.log('Fetching receipts for date:', date);
      const res = await api.get('/api/analytics/receipts-by-date', {
        params: { 
          user_id: currentUserId,
          date,
          interval: 'daily' // Default to daily for now
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
      console.log('Error fetching receipts:', e);
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
  }, [currentUserId]);

  // Effect to fetch user plan
  useEffect(() => {
    const fetchUserPlan = async () => {
      if (!user) {
        setUserPlan('basic');
        setIsLoadingUserPlan(false);
        return;
      }

      setIsLoadingUserPlan(true);
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (!token) {
          setUserPlan('basic');
          return;
        }

        const response = await fetch(`${apiConfig.API_BASE_URL}/api/subscription/receipt-count`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setUserPlan(data.user_plan || 'basic');
        } else {
          setUserPlan('basic');
        }
      } catch (error) {
        console.log('Error fetching user plan:', error);
        setUserPlan('basic');
      } finally {
        setIsLoadingUserPlan(false);
      }
    };

    fetchUserPlan();
  }, [user, planRefreshTrigger]);

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

  const handleFilterPress = () => {
    setShowFilterModal(true);
  };

  const handleCloseFilter = () => {
    setShowFilterModal(false);
  };

  const handleStoreSelect = (store: string | null) => {
    setSelectedStore(store);
    // Trigger refresh for all charts
    setRefreshTrigger(Date.now());
    setShowFilterModal(false);
  };

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
    // Trigger refresh for all charts
    setRefreshTrigger(Date.now());
    setShowFilterModal(false);
  };

  const renderWidget = useCallback(({ item, drag, isActive }: { item: string, drag: () => void, isActive: boolean }) => {
    const renderChart = () => {
      switch (item) {
        case 'total_spent':
          return (
            <MemoizedTotalSpentChart
              onBarPress={handleBarPress}
              userCurrency={currency}
              refreshTrigger={refreshTrigger}
              selectedStore={selectedStore}
              selectedCategory={selectedCategory}
            />
          );
        case 'top_products':
          return (
            <MemoizedTopProductsChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userPlan={userPlan}
              selectedStore={selectedStore}
              selectedCategory={selectedCategory}
            />
          );
        case 'most_expensive':
          return (
            <MemoizedMostExpensiveProductsChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userPlan={userPlan}
              selectedStore={selectedStore}
              selectedCategory={selectedCategory}
            />
          );
        case 'expenses_by_category':
          return (
            <MemoizedExpensesByCategoryChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userPlan={userPlan}
              selectedStore={selectedStore}
              selectedCategory={selectedCategory}
            />
          );
        case 'diet_composition':
          return (
            <MemoizedDietCompositionChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userPlan={userPlan}
              selectedStore={selectedStore}
              selectedCategory={selectedCategory}
            />
          );
        case 'shopping_days':
          return (
            <MemoizedShoppingDaysChart
              refreshTrigger={refreshTrigger}
              userPlan={userPlan}
              selectedStore={selectedStore}
              selectedCategory={selectedCategory}
            />
          );
        case 'bill_stats':
          return (
            <MemoizedBillStatsChart
              userId={currentUserId}
              refreshTrigger={refreshTrigger}
              userCurrency={currency}
              selectedStore={selectedStore}
              selectedCategory={selectedCategory}
            />
          );
        default:
          return null;
      }
    };

    return (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          style={[
            styles.widgetContainer,
            {
              transform: [{ scale: isActive ? 1.02 : 1 }],
              zIndex: isActive ? 1000 : 1,
              elevation: isActive ? 5 : 1,
            },
          ]}
        >
          <View style={styles.dragHandle}>
            <Icon name="reorder-two" size={20} color="#7e5cff" />
          </View>
          {renderChart()}
        </Pressable>
      </ScaleDecorator>
    );
  }, [currentUserId, currency, refreshTrigger, handleBarPress, selectedStore, selectedCategory]);

  const onDragEnd = useCallback(async ({ data }: { data: string[] }) => {
    try {
      // Add a small delay to ensure the animation completes
      await new Promise(resolve => setTimeout(resolve, 100));
      await updateWidgetOrder(data);
    } catch (error) {
      console.log('Failed to update widget order:', error);
    }
  }, [updateWidgetOrder]);

  const memoizedWidgetOrder = useMemo(() => widgetOrder, [widgetOrder]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0D1117', paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" />
      <AnalyticsHeader 
        onExportPress={handleExport} 
        onFilterPress={handleFilterPress}
      />
      <View style={{ flex: 1, backgroundColor: '#0D1117' }}>
        <DraggableFlatList
          data={memoizedWidgetOrder}
          onDragEnd={onDragEnd}
          keyExtractor={(item) => item}
          renderItem={renderWidget}
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 32, paddingBottom: 16 + insets.bottom }}
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
                          backgroundColor: '#161B22',
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: '#30363D',
                          paddingTop: 8,
                          paddingBottom: 8,
                          paddingLeft: 10,  
                          paddingRight: 10,
                          marginBottom: 6
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
        {/* Filter Screen */}
        <FilterScreen 
          visible={showFilterModal}
          onClose={handleCloseFilter}
          onStoreSelect={handleStoreSelect}
          onCategorySelect={handleCategorySelect}
          selectedStore={selectedStore}
          selectedCategory={selectedCategory}
        />
      </View>
    </View>
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