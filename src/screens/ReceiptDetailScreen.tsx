import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Animated, // Import Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { AppNavigationProps } from '../types/navigation';
import { formatCurrency, getCurrencySymbol } from '../screens/analytics/utils/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import jwtDecode from 'jwt-decode';
import apiConfig from '../config/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useButtonAnimation } from '../hooks/useButtonAnimation'; // Import the animation hook

const API_BASE_URL = apiConfig.API_BASE_URL;

const STORE_CATEGORIES = [
  'Grocery', 'Restaurant', 'Fast food', 'Pet store', 'Beauty & cosmetics',
  'Pharmacy', 'Electronics', 'Clothing', 'Home goods', 'Gas station',
  'Convenience store', 'Entertainment', 'Online marketplace', 'Other'
];

export const categoryColors = {
  'Fruits': '#27AE60', 'Vegetables': '#219653', 'Meat & poultry': '#C0392B',
  'Seafood': '#2980B9', 'Dairy & eggs': '#F1C40F', 'Bakery': '#A0522D',
  'Snacks': '#E67E22', 'Beverages': '#00BFFF', 'Alcoholic beverages': '#8E44AD',
  'Frozen foods': '#5DADE2', 'Canned & jarred goods': '#7F8C8D', 'Dry & packaged goods': '#D35400',
  'Condiments & sauces': '#E74C3C', 'Spices & seasonings': '#F39C12', 'Breakfast foods': '#F39C12',
  'Baby products': '#FADBD8', 'Household supplies': '#95A5A6', 'Personal care': '#D2B4DE',
  'Pet supplies': '#48C9B0', 'Ready-to-eat & prepared foods': '#F4D03F', 'Organic & health foods': '#1E8449',
  'International foods': '#AF7AC5', 'Baking supplies': '#F5CBA7', 'Deli & cheese': '#FDEBD0',
  'Other': '#34495E',
};

export const getCategoryColor = (category: keyof typeof categoryColors | string): string => {
  return categoryColors[category as keyof typeof categoryColors] || categoryColors['Other'];
};

// The main component
export default function ReceiptDetailScreen() {
  const navigation = useNavigation<AppNavigationProps<'MainTabs'>>();
  const route = useRoute();
  const { receiptData: initialReceiptData } = route.params as { receiptData: any };
  const insets = useSafeAreaInsets();
  const { createPressAnimation } = useButtonAnimation(); // Instantiate the animation hook

  // State Management
  const [receipt, setReceipt] = useState(initialReceiptData);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const isFetchingRef = useRef(false);

  // State for Modals
  const [isModalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState<'storeName' | 'storeCategory' | 'date' | 'item' | null>(null);
  
  // State for Editing
  const [editingText, setEditingText] = useState('');
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingItemIndex, setEditingItemIndex] = useState<number | -1>(-1);

  // Fetch user currency on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded = jwtDecode<{ user_id: number }>(token);
          const response = await axios.get(`${API_BASE_URL}/api/user/profile`, {
            params: { user_id: decoded.user_id },
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.data?.currency) {
            setCurrency(response.data.currency);
          }
        }
      } catch (error) {
        console.log('Error fetching user currency:', error);
      }
    })();
  }, []);

  const fetchReceipt = useCallback(async () => {
    if (!receipt?.id || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await axios.get(`${API_BASE_URL}/api/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data && res.data.receipts) {
        const found = res.data.receipts.find((r: any) => r.id === receipt.id);
        if (found) {
          setReceipt(found);
        }
      }
    } catch (e) {
      console.error("Failed to fetch latest receipt data", e);
    } finally {
      isFetchingRef.current = false;
    }
  }, [receipt?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchReceipt();
    }, [fetchReceipt])
  );
  
  if (!receipt) {
    navigation.goBack();
    return null;
  }
  
  const handleFieldUpdate = async (field: string, value: any, itemIndex?: number) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      let endpoint = `${API_BASE_URL}/api/receipts/${receipt.id}/update-field`;
      let payload: any = { field, value };

      if (typeof itemIndex === 'number') {
        payload = { item_index: itemIndex, item_field: field, item_value: value };
      }
      
      if (field === 'price' && typeof itemIndex === 'number') {
        endpoint = `${API_BASE_URL}/api/receipts/${receipt.id}/item-price`;
        const normalized = value.toString().replace(',', '.');
        payload = { item_index: itemIndex, new_price: parseFloat(normalized) };
      }

      const res = await axios.patch(endpoint, payload, { headers: { Authorization: `Bearer ${token}` } });
      
      if (res.data && res.data.success) {
        setReceipt(res.data.receipt);
      } else {
        Alert.alert('Error', res.data?.error || `Failed to update ${field}.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || `An error occurred while updating ${field}.`);
    } finally {
      setLoading(false);
      // The modal is now closed by the save handler to ensure animation reset
    }
  };

  // --- Modal Opening/Closing Handlers ---
  const openModal = (type: 'storeName' | 'storeCategory' | 'date', data: any) => {
    setModalContent(type);
    setEditingText(data);
    setModalVisible(true);
  };

  const openItemModal = (item: any, index: number) => {
    setModalContent('item');
    setEditingItem({ ...item });
    setEditingItemIndex(index);
    setModalVisible(true);
  };
  
  const closeModal = () => {
    // FIX: Reset the button animation state whenever the modal is closed.
    setModalVisible(false);
    setEditingItem(null);
    setEditingItemIndex(-1);
  };

  // --- Save Handlers for Modals ---
  const onSaveStoreName = async () => {
    if (!editingText.trim()) {
      Alert.alert('Invalid name', 'Store name cannot be empty.');
      return;
    }
    await handleFieldUpdate('store_name', editingText.trim());
    closeModal(); // Close modal after update
  };
  
  const onSaveStoreCategory = async (category: string) => {
    await handleFieldUpdate('store_category', category);
    closeModal(); // Close modal after update
  };
  
  const onSaveDate = (event: any, selectedDate?: Date) => {
    // Hide picker immediately on any action
    if (Platform.OS === 'android') {
        closeModal();
    }
    if (event.type === 'set' && selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      handleFieldUpdate('date', formattedDate);
    }
  };

  const onSaveItemChanges = async () => {
    if (!editingItem) return;
    const originalItem = receipt.items[editingItemIndex];
    
    // Create a list of update promises
    const updatePromises = [];
    if (editingItem.name !== originalItem.name) {
      updatePromises.push(handleFieldUpdate('name', editingItem.name, editingItemIndex));
    }
    if (String(editingItem.quantity) !== String(originalItem.quantity)) {
      updatePromises.push(handleFieldUpdate('quantity', parseFloat(editingItem.quantity) || 0, editingItemIndex));
    }
    if (String(editingItem.price) !== String(originalItem.price)) {
      updatePromises.push(handleFieldUpdate('price', parseFloat(editingItem.price) || 0, editingItemIndex));
    }
    if (editingItem.category !== originalItem.category) {
      updatePromises.push(handleFieldUpdate('category', editingItem.category, editingItemIndex));
    }
    
    await Promise.all(updatePromises);
    closeModal();
  };

  // --- Modal Content Component ---
  type ReceiptEditModalContentProps = {
    modalContent: 'storeName' | 'storeCategory' | 'date' | 'item' | null;
    editingText: string;
    setEditingText: (text: string) => void;
    onSaveStoreName: () => void | Promise<void>;
    loading: boolean;
    receipt: any;
    onSaveStoreCategory: (category: string) => void | Promise<void>;
    closeModal: () => void;
    editingItem: any;
    setEditingItem: (item: any) => void;
    editingItemIndex: number;
    onSaveItemChanges: () => void | Promise<void>;
    onSaveDate: (event: any, selectedDate?: Date) => void;
    insets: { bottom: number };
    categoryColors: { [key: string]: string };
    getCategoryColor: (category: string) => string;
    STORE_CATEGORIES: string[];
    currency: string;
  };

  function ReceiptEditModalContent({
    modalContent,
    editingText,
    setEditingText,
    onSaveStoreName,
    loading,
    receipt,
    onSaveStoreCategory,
    closeModal,
    editingItem,
    setEditingItem,
    editingItemIndex,
    onSaveItemChanges,
    onSaveDate,
    insets,
    categoryColors,
    getCategoryColor,
    STORE_CATEGORIES,
    currency,
  }: ReceiptEditModalContentProps) {
    const { createPressAnimation } = useButtonAnimation();
    const saveButtonAnim = createPressAnimation();
    const modalHeader = (title: string) => (
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{title}</Text>
        <TouchableOpacity onPress={closeModal} style={styles.modalCloseButton}>
          <Ionicons name="close" size={24} color="#545d6f" />
        </TouchableOpacity>
      </View>
    );

    switch (modalContent) {
      case 'storeName':
        return (
          <View>
            {modalHeader('Edit store name')}
            <View style={styles.modalBody}>
              <TextInput
                style={styles.modalInput}
                value={editingText}
                onChangeText={setEditingText}
                autoFocus
                onSubmitEditing={onSaveStoreName}
              />
              <Animated.View style={{ transform: [{ scale: saveButtonAnim.scaleAnim }] }}>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={onSaveStoreName}
                  disabled={loading}
                  onPressIn={saveButtonAnim.handlePressIn}
                  onPressOut={saveButtonAnim.handlePressOut}
                  activeOpacity={1}
                >
                  <Text style={styles.modalButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        );
      case 'storeCategory':
        return (
          <View>
            {modalHeader('Select store category')}
            <FlatList
              data={STORE_CATEGORIES}
              keyExtractor={(item) => item}
              style={styles.modalBody}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalListItem} onPress={() => onSaveStoreCategory(item)}>
                  <Text style={styles.modalListText}>{item}</Text>
                  {receipt.store_category === item && <Ionicons name="checkmark-circle" size={24} color="#7e5cff" />}
                </TouchableOpacity>
              )}
            />
          </View>
        );
      case 'date':
        return (
          <View>
            {modalHeader('Select date')}
            <View style={styles.modalBody}>
              <DateTimePicker
                value={new Date(receipt.date || new Date())}
                mode="date"
                display="inline"
                onChange={onSaveDate}
                maximumDate={new Date()}
                themeVariant='dark'
              />
            </View>
          </View>
        );
      case 'item':
        if (!editingItem) return null;
        return (
          <View>
            {modalHeader('Edit item')}
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalInputLabel}>Item name</Text>
              <TextInput
                style={styles.modalInput}
                value={editingItem.name}
                onChangeText={(text) => setEditingItem({ ...editingItem, name: text })}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.modalInputLabel}>Quantity</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editingItem.quantity?.toString()}
                    onChangeText={(text) => setEditingItem({ ...editingItem, quantity: text.replace(/[^0-9.]/g, '') })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.modalInputLabel}>Price</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editingItem.price?.toString()}
                    onChangeText={(text) => setEditingItem({ ...editingItem, price: text.replace(/[^0-9.,]/g, '') })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <Text style={styles.modalInputLabel}>Category</Text>
              <FlatList
                data={Object.keys(categoryColors)}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item}
                renderItem={({item}) => (
                  <TouchableOpacity onPress={() => setEditingItem({ ...editingItem, category: item })}>
                    <Text style={[
                      styles.itemCategoryBadge,
                      { 
                        backgroundColor: getCategoryColor(item),
                        borderWidth: editingItem.category === item ? 2 : 0,
                        borderColor: '#fff',
                        marginRight: 8
                      }
                    ]}>{item}</Text>
                  </TouchableOpacity>
                )}
                style={{ marginVertical: 10, paddingLeft: 2 }}
              />
              <Animated.View style={{ transform: [{ scale: saveButtonAnim.scaleAnim }] }}>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={onSaveItemChanges}
                  disabled={loading}
                  onPressIn={saveButtonAnim.handlePressIn}
                  onPressOut={saveButtonAnim.handlePressOut}
                  activeOpacity={1}
                >
                  <Text style={styles.modalButtonText}>{loading ? 'Saving...' : 'Save changes'}</Text>
                </TouchableOpacity>
              </Animated.View>
            </ScrollView>
          </View>
        );
      default:
        return null;
    }
  }

  const modalContainerStyle = [
    styles.modalContainer,
    { paddingBottom: insets.bottom + 16 },
    modalContent === 'storeCategory' ? { maxHeight: '80%' as const } : undefined,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#e6e9f0" />
        </TouchableOpacity>
      </View>

      <View style={styles.scrollBorderTop} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.summaryCard}>
          <TouchableOpacity onPress={() => openModal('storeName', receipt.store_name || '')} style={styles.editableField}>
            <Text style={styles.storeName}>{receipt.store_name || 'Unknown Store'}</Text>
            <Ionicons name="create-outline" size={22} color="#8ca0c6" />
          </TouchableOpacity>
          <Text style={styles.totalAmount}>{formatCurrency(receipt.total, currency)}</Text>
          <View style={styles.metadataRow}>
            <TouchableOpacity onPress={() => openModal('date', receipt.date)} style={styles.metadataItem}>
              <Ionicons name="calendar-outline" size={16} color="#8ca0c6" />
              <Text style={styles.metadataText}>{receipt.date || 'Unknown Date'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openModal('storeCategory', receipt.store_category)} style={styles.metadataItem}>
              <Ionicons name="pricetag-outline" size={16} color="#8ca0c6" />
              <Text style={styles.metadataText}>{receipt.store_category || 'Other'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({receipt.items?.length || 0})</Text>
          {receipt.items?.map((item: any, index: number) => (
            <TouchableOpacity key={index} style={styles.itemRow} onPress={() => openItemModal(item, index)}>
                <View style={{flex: 1, paddingRight: 8}}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name || 'Unnamed Item'}</Text>
                    <Text style={styles.itemSubDetails}>
                        Qty: {item.quantity ?? '—'} | Price: {typeof item.price === 'number' ? formatCurrency(item.price, currency) : '—'}
                    </Text>
                    <Text style={[styles.itemCategoryBadge, {backgroundColor: getCategoryColor(item.category)}]}>
                        {item.category || 'Other'}
                    </Text>
                </View>
                <Text style={styles.itemPrice}>
                    {typeof item.total === 'number' ? formatCurrency(item.total, currency) : `${getCurrencySymbol(currency)}0.00`}
                </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            {typeof receipt.total_discount === 'number' && receipt.total_discount > 0 &&
                <SummaryRow label="Discounts" value={`-${formatCurrency(receipt.total_discount, currency)}`} color="#27AE60"/>
            }
            {typeof receipt.tax_amount === 'number' && receipt.tax_amount > 0 &&
                <SummaryRow label="Tax" value={formatCurrency(receipt.tax_amount, currency)} />
            }
            <View style={styles.totalRow}>
                 <SummaryRow label="Total" value={formatCurrency(receipt.total, currency)} isTotal />
            </View>
        </View>
      </ScrollView>
      <View style={styles.scrollBorderBottom} />

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={{flex: 1}}
        >
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={modalContainerStyle}>
                  {isModalVisible && (
                    <ReceiptEditModalContent
                      modalContent={modalContent}
                      editingText={editingText}
                      setEditingText={setEditingText}
                      onSaveStoreName={onSaveStoreName}
                      loading={loading}
                      receipt={receipt}
                      onSaveStoreCategory={onSaveStoreCategory}
                      closeModal={closeModal}
                      editingItem={editingItem}
                      setEditingItem={setEditingItem}
                      editingItemIndex={editingItemIndex}
                      onSaveItemChanges={onSaveItemChanges}
                      onSaveDate={onSaveDate}
                      insets={insets}
                      categoryColors={categoryColors}
                      getCategoryColor={getCategoryColor}
                      STORE_CATEGORIES={STORE_CATEGORIES}
                      currency={currency}
                    />
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const SummaryRow = ({ label, value, color, isTotal = false }: { label: string, value: string, color?: string, isTotal?: boolean }) => (
  <View style={styles.summaryRow}>
    <Text style={[styles.summaryLabel, isTotal && styles.totalLabel]}>{label}</Text>
    <Text style={[styles.summaryValue, { color: color || '#e6e9f0' }, isTotal && styles.totalValue]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  // Changed: Made the background a deeper, darker shade for more contrast.
  safeArea: { flex: 1, backgroundColor: '#0D1117' }, 
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: { padding: 4 },
  scrollContainer: { paddingHorizontal: 16, paddingBottom: 40 },
  summaryCard: {
    // Changed: Used a lighter gray to make the card stand out from the new background.
    backgroundColor: '#161B22', 
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    // Changed: Adjusted border color to match the new card style.
    borderColor: '#30363D', 
  },
  editableField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeName: { fontSize: 26, fontWeight: 'bold', color: '#ffffff', flex: 1 },
  totalAmount: { 
    fontSize: 42, 
    fontWeight: 'bold', 
    color: '#7e5cff', 
    marginVertical: 12, 
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1,
    // Changed: Adjusted border color.
    borderTopColor: '#30363D',
    paddingTop: 12,
  },
  metadataItem: { flexDirection: 'row', alignItems: 'center' },
  metadataText: { fontSize: 14, color: '#8ca0c6', marginLeft: 6 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#e6e9f0', marginBottom: 8, paddingLeft: 4 },
  itemRow: {
    // Changed: Used the same new card color for consistency.
    backgroundColor: '#161B22', 
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#e6e9f0', marginBottom: 4 },
  itemSubDetails: { fontSize: 14, color: '#8ca0c6' },
  itemPrice: { fontSize: 17, fontWeight: 'bold', color: '#ffffff' },
  itemCategoryBadge: {
    alignSelf: 'flex-start',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  summaryLabel: { fontSize: 16, color: '#8ca0c6' },
  summaryValue: { fontSize: 16, fontWeight: '600' },
  totalRow: {
    borderTopWidth: 1,
    // Changed: Adjusted border color.
    borderTopColor: '#30363D',
    marginTop: 8,
    paddingTop: 8,
  },
  totalLabel: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    // Changed: Matched modal background to the new card color.
    backgroundColor: '#161B22', 
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // Changed: Adjusted border color.
    borderColor: '#30363D'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    // Changed: Adjusted border color.
    borderBottomColor: '#30363D',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalCloseButton: {
    // Changed: Updated to a color that fits the new palette.
    backgroundColor: '#30363D',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalInputLabel: {
    color: '#8ca0c6',
    fontSize: 14,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    // Changed: Updated to a color that fits the new palette.
    backgroundColor: '#0D1117',
    color: '#e6e9f0',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  modalSaveButton: {
    backgroundColor: '#7e5cff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#9575ff',
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    // Changed: Adjusted border color.
    borderBottomColor: '#30363D'
  },
  modalListText: {
    fontSize: 16,
    color: '#e6e9f0',
  },
  scrollBorderTop: {
    height: 2,
    backgroundColor: '#232632',
    width: '100%',
  },
  scrollBorderBottom: {
    height: 2,
    backgroundColor: '#232632',
    width: '100%',
  },
});
