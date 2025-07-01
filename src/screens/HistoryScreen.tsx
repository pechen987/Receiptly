import React, { useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCurrency } from '../screens/analytics/contexts/CurrencyContext';
import { useReceipt } from '../contexts/ReceiptContext';
import axios from 'axios';
import {
  AppState,
  Animated,
  StatusBar,
  StyleSheet,
  View,
  Text,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { getReceipts, deleteReceipt } from '../services/storageService';
import { normalizeDateToYMD } from '../services/storageService';
import { useNavigation } from '@react-navigation/native';
import type { Receipt } from '../services/storageService';
import { processReceipt } from '../services/receiptService';
import { saveReceiptFromOpenAI } from '../services/storageService';
import { AppNavigationProps, RootStackParamList } from '../types/navigation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { formatCurrency, getCurrencySymbol } from '../screens/analytics/utils/currency';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import apiConfig from '../config/api';
import BasicPlanHeader from '../components/BasicPlanHeader';
import ArrowSvg from '../../assets/arrow.svg';
import { useButtonAnimation } from '../hooks/useButtonAnimation';

const API_BASE_URL = apiConfig.API_BASE_URL;

type NavigationProp = StackNavigationProp<RootStackParamList> & {
  emit: (event: string) => void;
};

// Utility: Sort receipts by date descending (newest first)
export function sortReceiptsByDate(receipts: Receipt[]): Receipt[] {
  return receipts.slice().sort((a, b) => {
    const da = new Date(normalizeDateToYMD(a.date));
    const db = new Date(normalizeDateToYMD(b.date));
    // Fallback: If date is invalid, treat as oldest
    if (isNaN(da.getTime())) return 1;
    if (isNaN(db.getTime())) return -1;
    return db.getTime() - da.getTime();
  });
}

// Add this type for sectioned data
type SectionData = {
  title: string;
  data: Receipt[];
};

// Add this helper function to group receipts by month
function groupReceiptsByMonth(receipts: Receipt[]): SectionData[] {
  const groupedReceipts = receipts.reduce((acc: { [key: string]: Receipt[] }, receipt) => {
    const date = new Date(normalizeDateToYMD(receipt.date));
    const monthYear = date.toLocaleString('default', { month: 'long', year: 'numeric' });

    if (!acc[monthYear]) {
      acc[monthYear] = [];
    }
    acc[monthYear].push(receipt);
    return acc;
  }, {});

  return Object.entries(groupedReceipts)
    .map(([title, data]) => ({
      title,
      data: data.sort((a, b) => {
        const da = new Date(normalizeDateToYMD(a.date));
        const db = new Date(normalizeDateToYMD(b.date));
        return db.getTime() - da.getTime();
      })
    }))
    .sort((a, b) => {
      const da = new Date(a.title);
      const db = new Date(b.title);
      return db.getTime() - da.getTime();
    });
}

// Re-introduce the local BASIC_MONTHLY_LIMIT constant for frontend check
const BASIC_MONTHLY_LIMIT = 8; // Note: Backend is the source of truth, keep this value consistent

export default function HistoryScreen() {
  const { currency } = useCurrency();
  const { triggerRefresh } = useReceipt();
  const { user, planRefreshTrigger } = useAuth();
  const insets = useSafeAreaInsets();
  const { createPressAnimation } = useButtonAnimation();

  // Update currency if changed in profile (when app comes to foreground)
  useEffect(() => {
    loadReceipts(); // reload receipts whenever currency changes
  }, [currency]);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const isFocused = useIsFocused();
  const [scanningMessage, setScanningMessage] = useState('');
  const messageInterval = useRef<NodeJS.Timeout | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [pendingAction, setPendingAction] = useState<'camera' | 'gallery' | null>(null);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Add state for plan and monthly count for frontend check
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [currentMonthReceiptCount, setCurrentMonthReceiptCount] = useState<number | null>(null);
  const [isLoadingReceiptCount, setIsLoadingReceiptCount] = useState(true);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shadowOpacityAnim = useRef(new Animated.Value(0.25)).current;
  const elevationAnim = useRef(new Animated.Value(12)).current;

  const scanningMessages = [
    "Scanning your receipt... 📝",
    "Counting items... 🔢",
    "Calculating total... 💰",
    "Categorizing products... 🏷️",
    "Almost there... ⚡️",
    "Making sense of it all... 🧠",
    "Organizing your purchase... 📦",
    "Just a moment longer... ⏳",
    "Adding some magic... ✨",
    "Finalizing your receipt... 🎯"
  ];

  // Effect for scanning message animation
  useEffect(() => {
    if (loading) {
      let index = 0;
      setScanningMessage(scanningMessages[0]);

      messageInterval.current = setInterval(() => {
        index += 1;
        if (index < scanningMessages.length) {
          setScanningMessage(scanningMessages[index]);
        } else {
          if (messageInterval.current) {
            clearInterval(messageInterval.current);
          }
        }
      }, 3000);
    } else {
      if (messageInterval.current) {
        clearInterval(messageInterval.current);
      }
    }

    return () => {
      if (messageInterval.current) {
        clearInterval(messageInterval.current);
      }
    };
  }, [loading]);

  // Effect to load receipts and fetch plan/count when screen is focused or plan changes
  useEffect(() => {
    console.log('[HistoryScreen] Loading data due to refresh, user change, or plan change');
    loadReceipts();
    fetchReceiptCountAndPlan(); // Fetch plan and count
  }, [user, triggerRefresh, planRefreshTrigger]); // Add planRefreshTrigger as a dependency

  // Modified fetch function to get both plan and count
  const fetchReceiptCountAndPlan = async () => {
    if (!user) { // Only need user to know if authenticated
      setIsLoadingReceiptCount(false);
      return;
    }

    // Retrieve token directly from AsyncStorage for API call
    const token = await AsyncStorage.getItem('jwt_token');
    if (!token) {
      setIsLoadingReceiptCount(false);
      console.log('No token found for fetching receipt count and plan.');
      return; // Cannot fetch without a token
    }

    setIsLoadingReceiptCount(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/subscription/receipt-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setUserPlan(data.user_plan);
        setCurrentMonthReceiptCount(data.current_month_receipt_count); // Use new field for current month
        console.log('Fetched plan and counts:', data);
      } else {
        console.log('Failed to fetch receipt count and plan:', response.status, data.message);
        setUserPlan('basic'); // Default to basic on error
        setCurrentMonthReceiptCount(null); // Assume no count on error
      }
    } catch (error) {
      console.log('Error fetching receipt count and plan:', error);
      setUserPlan('basic'); // Default to basic on network error
      setCurrentMonthReceiptCount(null); // Assume no count on network error
    } finally {
      setIsLoadingReceiptCount(false);
    }
  };

  const loadReceipts = async () => {
    try {
      const storedReceipts = await getReceipts();
      const sortedReceipts = sortReceiptsByDate(storedReceipts);
      setReceipts(sortedReceipts);
      setSections(groupReceiptsByMonth(sortedReceipts));
    } catch (error: any) {
      console.log('Error loading receipts:', error);
      alert('Error loading receipts: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReceipts();
    await fetchReceiptCountAndPlan(); // Refresh plan and count on pull down
  };

  const handleScan = () => {
    console.log('handleScan pressed. States:', {
      isLoadingReceiptCount,
      userPlan,
      currentMonthReceiptCount // now using current month count
    });

    // Check if the user can scan based on plan and monthly count (Frontend Check)
    const canScan = !isLoadingReceiptCount && (userPlan === 'premium' || (userPlan === 'basic' && currentMonthReceiptCount !== null && currentMonthReceiptCount < BASIC_MONTHLY_LIMIT));

    if (!isLoadingReceiptCount && userPlan === 'basic' && currentMonthReceiptCount !== null && currentMonthReceiptCount >= BASIC_MONTHLY_LIMIT) {
      // Show alert immediately if limit is reached and data is loaded
      Alert.alert(
        'Monthly Limit Reached',
        `You have reached your monthly limit of ${BASIC_MONTHLY_LIMIT} receipts for the basic plan. Upgrade to premium to scan more.`
      );
      return; // Stop further execution if limit is reached
    }

    // If still loading or not on a basic plan with limit reached, proceed to show modal (or wait for loading)
    if (!isLoadingReceiptCount) { // Only show modal if loading is complete
      showModal();
    } else {
      console.log('Loading plan and count. Cannot proceed with scan yet.');
      // Optionally show a loading indicator or toast while loading plan info
    }
  };

  const showModal = () => {
    setScanModalVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setScanModalVisible(false);
    });
  };

  const handleCloseModal = () => {
    hideModal();
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to make this work!');
      return;
    }
    setHasPermissions(true);
    setPendingAction('camera');
    hideModal();
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }
    setHasPermissions(true);
    setPendingAction('gallery');
    hideModal();
  };

  // Reusable animation functions
  const scanButtonAnim = createPressAnimation();
  const cameraButtonAnim = createPressAnimation();
  const galleryButtonAnim = createPressAnimation();

  const handleModalDismiss = async () => {
    if (!hasPermissions) {
      setPendingAction(null);
      return;
    }

    if (pendingAction === 'camera') {
      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
        base64: true,
      });
      if (!result.canceled) {
        processImage(result.assets[0].uri);
      }
    } else if (pendingAction === 'gallery') {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        base64: true,
      });
      if (!result.canceled) {
        processImage(result.assets[0].uri);
      }
    }
    setPendingAction(null);
    setHasPermissions(null);
  };

  const processImage = async (uri: string) => {
    let appState = AppState.currentState;
    let appStateListener: any = null;
    try {
      setLoading(true);

      // Warn user if app is backgrounded during processing
      appStateListener = AppState.addEventListener('change', nextAppState => {
        if (appState.match(/active/) && nextAppState.match(/inactive|background/)) {
          Alert.alert(
            'Do not close the app',
            'Please keep the app open while your receipt is being processed. Closing or backgrounding the app will cause the process to fail.'
          );
        }
        appState = nextAppState;
      });

      const result = await processReceipt(uri);

      if (!result || typeof result !== 'object') {
        Alert.alert('Invalid Receipt', 'The image does not appear to be a valid receipt.');
        return;
      }

      console.log('Processed receipt:', result);

      const savedReceipt = await saveReceiptFromOpenAI(result);

      if (savedReceipt) {
        // After saving, refetch the plan to update the UI state if needed (e.g., limit change)
        await fetchReceiptCountAndPlan();
        const updatedReceipts = sortReceiptsByDate([...receipts, savedReceipt]);
        setReceipts(updatedReceipts);
        setSections(groupReceiptsByMonth(updatedReceipts));

        // Add a longer delay to ensure backend processing is complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Trigger refresh for analytics screen
        triggerRefresh();

        // Add another small delay before navigation
        await new Promise(resolve => setTimeout(resolve, 500));

        // Navigate after ensuring data is processed
        navigation.navigate('ReceiptDetail', { receiptData: savedReceipt });
      } else {
        // Do nothing here, the alert for limit reached or other backend errors is shown in saveReceipt
      }
    } catch (error: any) {
      // Generic error handling for scan process itself (not backend save)
      let message = 'Failed to process receipt. Please try again.';
      if (error.message?.includes('OpenAI Error')) {
        message = error.message;
      } else if (error.message?.includes('timed out')) {
        message = 'The request to OpenAI API timed out. Please try again.';
      } else if (error.message?.includes('Failed to encode image')) {
        message = 'Failed to process the image. Please make sure it is a valid receipt image.';
      }
      Alert.alert('Processing Failed', message);
    } finally {
      setLoading(false);
      if (appStateListener && appStateListener.remove) appStateListener.remove();
    }
  };

  const renderItem = ({ item }: { item: Receipt }) => (
    <TouchableOpacity
      style={styles.receiptCard}
      onPress={() => navigation.navigate('ReceiptDetail', { receiptData: item })}
      activeOpacity={0.85}
    >
      <View style={styles.rowBetween}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.receiptTitle}>{item.store_name || 'Unknown Store'}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Icon name="calendar" size={14} color="#8ca0c6" />
            <Text style={styles.receiptDate}> {item.date || 'Unknown Date'}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Icon name="tag" size={14} color="#8ca0c6" />
            <Text style={styles.itemCount}> {item.items.length} items</Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={styles.receiptAmount}>
            {formatCurrency(item.total, currency)}
          </Text>
          <TouchableOpacity
            style={styles.cardDeleteFabSubtle}
            onPress={() => {
              Alert.alert('Delete Receipt', 'Are you sure you want to delete this receipt?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item.id) },
              ]);
            }}
          >
            <Icon name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteReceipt(id);
      await loadReceipts();
      triggerRefresh(); // Trigger refresh for analytics screen after deletion
    } catch (error) {
      console.log('Error deleting receipt:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to delete receipt. Please try again.'
      );
    }
  };

  const renderSectionHeader = ({ section: { title } }: { section: SectionData }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const loadReceiptsFromBackend = async () => {
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await axios.get(`${API_BASE_URL}/api/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data && res.data.receipts) {
        const sortedReceipts = sortReceiptsByDate(res.data.receipts);
        setReceipts(sortedReceipts);
        setSections(groupReceiptsByMonth(sortedReceipts));
      }
    } catch (error: any) {
      console.log('Error loading receipts from backend:', error);
      alert('Error loading receipts: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadReceiptsFromBackend();
    }, [])
  );

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#16191f"
        translucent={false}
      />
      {!isLoadingReceiptCount && (userPlan === 'basic' || userPlan === 'pro') && (
        <BasicPlanHeader
          monthlyReceiptCount={currentMonthReceiptCount}
          limit={BASIC_MONTHLY_LIMIT}
          userPlan={userPlan}
        />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="receipt-outline" size={64} color="#7e5cff" />
          <Text style={styles.overlayText}>{scanningMessage}</Text>
          <Text style={styles.loadingSubtext}>
            This may take a few moments. Please keep the app open until processing is complete.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.listContent,
            sections.length === 0 && styles.emptyListContent,
            { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }
          ]}
          style={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7e5cff"
              colors={['#7e5cff']}
              progressViewOffset={0}
              progressBackgroundColor="transparent"
              style={{ backgroundColor: 'transparent' }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyStateContent}>
                <Text style={styles.emptyText}>Ready to scan your first receipt?</Text>
                <Text style={styles.emptyText}>Tap the camera button below!</Text>
                <ArrowSvg width={220} height={220} style={styles.arrow} fill="#8ca0c6" />
              </View>
            </View>
          }
        />
      )}
      {!loading && (
        <Animated.View
          style={[
            styles.fabContainer,
            {
              transform: [{ scale: scanButtonAnim.scaleAnim }],
            }
          ]}
        >
          <Animated.View
            style={[
              styles.fabShadow,
              {
                shadowOpacity: scanButtonAnim.shadowOpacityAnim,
                elevation: scanButtonAnim.elevationAnim,
              }
            ]}
          >
            <TouchableOpacity
              style={styles.fab}
              onPress={handleScan}
              onPressIn={scanButtonAnim.handlePressIn}
              onPressOut={scanButtonAnim.handlePressOut}
              activeOpacity={1}
            >
              <Icon name="camera" size={28} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      <Modal
        visible={scanModalVisible}
        transparent
        animationType="none"
        onRequestClose={handleCloseModal}
        onDismiss={handleModalDismiss}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            { opacity: fadeAnim }
          ]}
        >
          <Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
            <View style={styles.modalContent}>
              <View style={styles.modalButtonsRow}>
                <Animated.View
                  style={[
                    styles.modalButtonContainer,
                    {
                      transform: [{ scale: galleryButtonAnim.scaleAnim }],
                    }
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.modalButtonShadow,
                      {
                        shadowOpacity: galleryButtonAnim.shadowOpacityAnim,
                        elevation: galleryButtonAnim.elevationAnim,
                      }
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.modalButton} 
                      onPress={handleGallery}
                      onPressIn={galleryButtonAnim.handlePressIn}
                      onPressOut={galleryButtonAnim.handlePressOut}
                      activeOpacity={1}
                    >
                      <View style={styles.iconBackground}>
                        <Icon name="image" size={70} color="rgba(255,255,255,0.15)" />
                      </View>
                      <Text style={styles.modalButtonText}>Upload</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.modalButtonContainer,
                    {
                      transform: [{ scale: cameraButtonAnim.scaleAnim }],
                    }
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.modalButtonShadow,
                      {
                        shadowOpacity: cameraButtonAnim.shadowOpacityAnim,
                        elevation: cameraButtonAnim.elevationAnim,
                      }
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.modalButton} 
                      onPress={handleCamera}
                      onPressIn={cameraButtonAnim.handlePressIn}
                      onPressOut={cameraButtonAnim.handlePressOut}
                      activeOpacity={1}
                    >
                      <View style={styles.iconBackground}>
                        <Icon name="camera" size={70} color="rgba(255,255,255,0.15)" />
                      </View>
                      <Text style={styles.modalButtonText}>Scan</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 400,
  },
  emptyStateContent: {
    marginTop: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#16191f',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7e5cff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    width: 220,
    justifyContent: 'flex-start',
    borderWidth: 1.2,
    borderColor: '#232632',
  },
  scanOptionText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 0,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  receiptCard: {
    backgroundColor: '#202338',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
    marginHorizontal: 16,
    marginTop: 4,
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e6e9f0',
  },
  receiptDate: {
    color: '#8ca0c6',
    fontSize: 14,
    marginTop: 2,
  },
  receiptAmount: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontSize: 16,
    marginTop: 2,
  },
  itemCount: {
    fontSize: 14,
    color: '#8ca0c6',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7e5cff',
    borderWidth: 2,
    borderColor: '#9575ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  modalContent: {
    width: '100%',
    paddingRight: 40,
    paddingLeft: 40,
    paddingTop: 30,
    paddingBottom: 30,
    borderRadius: 16,
    alignItems: 'center',
  },
  overlayText: {
    fontSize: 18,
    color: '#7e5cff',
    fontWeight: 'bold',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#8ca0c6',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDeleteFabSubtle: {
    marginTop: 10,
    backgroundColor: '#3a3d45',
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1.5,
    elevation: 2,
    zIndex: 10,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8ca0c6',
    textTransform: 'capitalize',
  },
  arrowContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  arrow: {
    transform: [{ rotate: '12deg' }],
    left: 20,
    top: 40,
  },
  fabContainer: {
    position: 'absolute',
    right: 24,
    bottom: 36,
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    zIndex: 100,
  },
  fabShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    borderRadius: 32,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  modalButtonContainer: {
    width: '45%',
    aspectRatio: 1,
  },
  modalButtonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 12,
    flex: 1,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7e5cff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#9575ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    elevation: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  modalButtonText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    zIndex: 2,
    position: 'relative',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

