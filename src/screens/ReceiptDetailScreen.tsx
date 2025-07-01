import React from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { saveReceipt } from '../services/storageService';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { AppNavigationProps } from '../types/navigation';
import { formatCurrency, getCurrencySymbol } from '../screens/analytics/utils/currency';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import jwtDecode from 'jwt-decode';
import apiConfig from '../config/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = apiConfig.API_BASE_URL;

const STORE_CATEGORIES = [
  'Grocery', 'Restaurant', 'Fast food', 'Pet store', 'Beauty & cosmetics', 
  'Pharmacy', 'Electronics', 'Clothing', 'Home goods', 'Gas station', 
  'Convenience store', 'Entertainment', 'Online marketplace', 'Other'
];

export const categoryColors = {
  'Fruits': '#27AE60',
  'Vegetables': '#219653',
  'Meat & poultry': '#C0392B',
  'Seafood': '#2980B9',
  'Dairy & eggs': '#F1C40F',
  'Bakery': '#A0522D',
  'Snacks': '#E67E22',
  'Beverages': '#00BFFF',
  'Alcoholic beverages': '#8E44AD',
  'Frozen foods': '#5DADE2',
  'Canned & jarred goods': '#7F8C8D',
  'Dry & packaged goods': '#D35400',
  'Condiments & sauces': '#E74C3C',
  'Spices & seasonings': '#F39C12',
  'Breakfast foods': '#F39C12',
  'Baby products': '#FADBD8',
  'Household supplies': '#95A5A6',
  'Personal care': '#D2B4DE',
  'Pet supplies': '#48C9B0',
  'Ready-to-eat & prepared foods': '#F4D03F',
  'Organic & health foods': '#1E8449',
  'International foods': '#AF7AC5',
  'Baking supplies': '#F5CBA7',
  'Deli & cheese': '#FDEBD0',
  'Other': '#34495E',
};

// Helper function to get color by category with fallback
export const getCategoryColor = (category: keyof typeof categoryColors | string): string => {
  return categoryColors[category as keyof typeof categoryColors] || categoryColors['Other'];
};

export default function ReceiptDetailScreen() {
  const navigation = useNavigation<AppNavigationProps<'MainTabs'>>();
  const route = useRoute();
  const { receiptData } = route.params as { receiptData: any };
  const [currency, setCurrency] = React.useState('USD');
  const [editMode, setEditMode] = React.useState(false);
  const [items, setItems] = React.useState<any[]>([]);
  const [priceInput, setPriceInput] = React.useState<string>('');
  const [total, setTotal] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const isFetchingRef = React.useRef(false);
  const [storeName, setStoreName] = React.useState(receiptData.store_name || '');
  const [editingStoreName, setEditingStoreName] = React.useState(false);
  const [date, setDate] = React.useState(receiptData.date || '');
  const [editingItemIndex, setEditingItemIndex] = React.useState<number | null>(null);
  const [editingField, setEditingField] = React.useState<'name' | 'quantity' | 'price' | null>(null);
  const [fieldInput, setFieldInput] = React.useState<string>('');
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [storeCategory, setStoreCategory] = React.useState(receiptData.store_category || 'Other');
  const [editingCategory, setEditingCategory] = React.useState(false);
  const [categoryDropdownVisible, setCategoryDropdownVisible] = React.useState(false);
  const [itemCategoryModalVisible, setItemCategoryModalVisible] = React.useState(false);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded = jwtDecode<{ user_id: number }>(token);
          const response = await axios.get(`${API_BASE_URL}/api/user/profile`, {
            params: { user_id: decoded.user_id },
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.data?.currency) {
            setCurrency(response.data.currency);
          }
        } else {
            console.warn('No JWT token found on ReceiptDetailScreen currency fetch.');
        }
      } catch (error) {
        console.log('Error fetching user currency:', error);
      }
    })();
  }, []);

  React.useEffect(() => {
    if (receiptData?.items) {
      setItems(receiptData.items);
      setTotal(receiptData.total);
    }
  }, [receiptData]);

  const fetchReceipt = React.useCallback(async () => {
    if (!receiptData?.id || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await axios.get(`${API_BASE_URL}/api/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data && res.data.receipts) {
        const found = res.data.receipts.find((r: any) => r.id === receiptData.id);
        if (found) {
          setItems(found.items);
          setTotal(found.total);
        }
      }
    } catch (e) {
      // Optionally handle error
    } finally {
      isFetchingRef.current = false;
    }
  }, [receiptData?.id]);

  useFocusEffect(
    React.useCallback(() => {
      fetchReceipt();
    }, [fetchReceipt])
  );

  React.useEffect(() => {
    if (!editMode) {
      fetchReceipt();
    }
  }, [editMode, fetchReceipt]);

  if (!receiptData) {
    console.warn('No receipt data provided to ReceiptDetailScreen');
    navigation.goBack();
    return null;
  }

  const handleEditPress = () => {
    if (editMode && editingItemIndex !== null && editingField !== null) {
      handleItemFieldSave(editingItemIndex, editingField, fieldInput);
    }
    setEditMode((v) => !v);
  };

  const handlePricePress = (index: number) => {
    if (!editMode) return;
    setEditingItemIndex(index);
    setEditingField('price');
    setFieldInput(items[index]?.price !== undefined && items[index]?.price !== null ? items[index].price.toString() : '');
  };

  const handlePriceChange = (text: string) => {
    // Allow numbers, dot, and comma
    if (/^[0-9.,]*$/.test(text)) {
      setPriceInput(text);
    }
  };

  const handlePriceSubmit = async (index: number) => {
    if (!priceInput) return;
    // Convert comma to dot for float parsing
    const normalized = priceInput.replace(',', '.');
    const newPrice = parseFloat(normalized);
    if (isNaN(newPrice) || newPrice < 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.');
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await axios.patch(
        `${API_BASE_URL}/api/receipts/${receiptData.id}/item-price`,
        { item_index: index, new_price: newPrice }, // always a float!
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data && res.data.success) {
        setItems(res.data.receipt.items);
        setTotal(res.data.receipt.total);
        setEditingItemIndex(null);
        setEditingField(null);
        setFieldInput('');
        // No event emission needed; history screen will refresh on focus
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to update price.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update price.');
    } finally {
      setLoading(false);
    }
  };

  // Store name edit handlers
  const handleStoreNameSave = async () => {
    if (!storeName.trim()) {
      Alert.alert('Invalid store name', 'Store name cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await axios.patch(
        `${API_BASE_URL}/api/receipts/${receiptData.id}/update-field`,
        { field: 'store_name', value: storeName.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data && res.data.success) {
        setStoreName(res.data.receipt.store_name);
        setEditingStoreName(false);
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to update store name.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update store name.');
    } finally {
      setLoading(false);
    }
  };

  // Date edit handlers (fallback to TextInput)
  const handleDateSave = async (val: string) => {
    // Accept YYYY-MM-DD only
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      Alert.alert('Invalid date', 'Date must be in YYYY-MM-DD format.');
      return;
    }
    setDate(val);
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await axios.patch(
        `${API_BASE_URL}/api/receipts/${receiptData.id}/update-field`,
        { field: 'date', value: val },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data && res.data.success) {
        setDate(res.data.receipt.date);
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to update date.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update date.');
    } finally {
      setLoading(false);
    }
  };

  // Item field edit handlers (name, quantity, price, category)
  const handleItemFieldSave = async (index: number, field: 'name' | 'quantity' | 'price' | 'category', value: string) => {
    if (field === 'name' && !value.trim()) {
      Alert.alert('Invalid item name', 'Item name cannot be empty.');
      return;
    }
    if (field === 'quantity') {
      const qty = parseFloat(value);
      if (isNaN(qty) || qty <= 0) {
        Alert.alert('Invalid quantity', 'Quantity must be a positive number.');
        return;
      }
    }
    if (field === 'price') {
      const normalized = value.replace(',', '.');
      const price = parseFloat(normalized);
      if (isNaN(price) || price < 0) {
        Alert.alert('Invalid price', 'Please enter a valid price.');
        return;
      }
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      let res;
      if (field === 'price') {
        // Use the dedicated endpoint for price updates
        const normalized = value.replace(',', '.');
        res = await axios.patch(
          `${API_BASE_URL}/api/receipts/${receiptData.id}/item-price`,
          { item_index: index, new_price: parseFloat(normalized) },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        // Use update-field for name and quantity
        let patchData;
        if (field === 'quantity') {
          patchData = { item_index: index, item_field: 'quantity', item_value: parseFloat(value) };
        } else if (field === 'category') {
          patchData = { item_index: index, item_field: 'category', item_value: value };
        } else {
          patchData = { item_index: index, item_field: field, item_value: value };
        }
        res = await axios.patch(
          `${API_BASE_URL}/api/receipts/${receiptData.id}/update-field`,
          patchData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      if (res.data && res.data.success) {
        setItems(res.data.receipt.items);
        setTotal(res.data.receipt.total);
        setEditingItemIndex(null);
        setEditingField(null);
        setFieldInput('');
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to update item.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update item.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemCategorySave = async (category: string) => {
    if (editingItemIndex === null) return;
    await handleItemFieldSave(editingItemIndex, 'category', category);
    setItemCategoryModalVisible(false);
  };

  // Store category edit handler
  const handleStoreCategorySave = async (val: string) => {
    setStoreCategory(val);
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await axios.patch(
        `${API_BASE_URL}/api/receipts/${receiptData.id}/update-field`,
        { field: 'store_category', value: val },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data && res.data.success) {
        setStoreCategory(res.data.receipt.store_category);
        setEditingCategory(false);
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to update store category.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed to update store category.');
    } finally {
      setLoading(false);
      setCategoryDropdownVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Fixed Header with Border */}
      <View style={[styles.headerContainer, {
        paddingTop: Platform.OS === 'android' ? insets.top || 16 : 8,
        borderTopWidth: 1,
        borderTopColor: '#2d3748',
      }]}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            {/* Store Name Editable */}
            {editMode && editingStoreName ? (
              <TextInput
                style={[styles.storeName, styles.editInput]}
                value={storeName}
                onChangeText={setStoreName}
                onBlur={handleStoreNameSave}
                onSubmitEditing={handleStoreNameSave}
                editable={!loading}
                autoFocus
              />
            ) : (
              <TouchableOpacity disabled={!editMode} onPress={() => editMode && setEditingStoreName(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.storeName, editMode && styles.editableField]}>{storeName || 'Unknown Store'}</Text>
                  {editMode && <Icon name="edit-2" size={18} color="#7e5cff" style={{ marginLeft: 6 }} />}
                </View>
              </TouchableOpacity>
            )}
            <View style={styles.categoryRow}>
              <Icon name="tag" size={16} color={editMode ? '#7e5cff' : '#8ca0c6'} style={styles.icon} />
              {editMode ? (
                <>
                  <TouchableOpacity
                    style={[styles.dropdownButton, loading && { opacity: 0.5 }]}
                    onPress={() => !loading && setCategoryDropdownVisible(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownText}>
                      {storeCategory || 'Select Category'}
                    </Text>
                    <Ionicons 
                      name={categoryDropdownVisible ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color={"#7e5cff"} 
                    />
                  </TouchableOpacity>
                  <Modal
                    visible={categoryDropdownVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setCategoryDropdownVisible(false)}
                  >
                    <TouchableOpacity
                      style={styles.modalOverlay}
                      activeOpacity={1}
                      onPress={() => setCategoryDropdownVisible(false)}
                    >
                      <View style={styles.dropdownModal}>
                        <View style={styles.dropdownHeader}>
                          <Text style={styles.dropdownHeaderText}>Select Category</Text>
                          <TouchableOpacity
                            onPress={() => setCategoryDropdownVisible(false)}
                            style={styles.closeButton}
                          >
                            <Ionicons name="close" size={24} color="#fff" />
                          </TouchableOpacity>
                        </View>
                        <FlatList
                          data={STORE_CATEGORIES}
                          keyExtractor={(item) => item}
                          style={styles.dropdownList}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[
                                styles.dropdownItem,
                                storeCategory === item && styles.dropdownItemSelected
                              ]}
                              onPress={() => handleStoreCategorySave(item)}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.dropdownItemText,
                                storeCategory === item && styles.dropdownItemTextSelected
                              ]}>
                                {item}
                              </Text>
                              {storeCategory === item && (
                                <Ionicons name="checkmark" size={20} color="#7e5cff" />
                              )}
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    </TouchableOpacity>
                  </Modal>
                </>
              ) : (
                <Text style={styles.storeCategory}>{storeCategory || 'Other'}</Text>
              )}
            </View>
            {editMode ? (
              <View style={{ width: '100%', marginTop: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="calendar" size={16} color="#7e5cff" />
                <DateTimePicker
                  value={date ? new Date(date) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    if (event.type === 'set' && selectedDate) {
                      // Format to YYYY-MM-DD
                      const y = selectedDate.getFullYear();
                      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const d = String(selectedDate.getDate()).padStart(2, '0');
                      const formatted = `${y}-${m}-${d}`;
                      setDate(formatted);
                      handleDateSave(formatted);
                    }
                  }}
                  maximumDate={new Date()}
                  style={{ width: '100%' }}
                />
              </View>
            ) : (
              <View style={styles.dateRow}>
                <Icon name="calendar" size={16} color="#8ca0c6" style={styles.icon} />
                <Text style={styles.date}>{date || 'Unknown Date'}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={styles.closeButton} onPress={handleEditPress}>
              <Icon name={editMode ? 'check' : 'edit-2'} size={22} color="#8ca0c6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
              <Icon name="x" size={24} color="#8ca0c6" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={{
          paddingBottom: insets.bottom || 24,
        }}
      >
        {/* Items Section */}
        <View style={styles.itemsContainer}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.map((item: any, index: number) => (
            <View key={index} style={styles.item}>
              <View style={styles.itemDetails}>
                {/* Item Name Editable */}
                {editMode && editingItemIndex === index && editingField === 'name' ? (
                  <TextInput
                    style={[styles.itemName, styles.editInput]}
                    value={fieldInput}
                    onChangeText={val => setFieldInput(val)}
                    onBlur={() => handleItemFieldSave(index, 'name', fieldInput)}
                    onSubmitEditing={() => handleItemFieldSave(index, 'name', fieldInput)}
                    editable={!loading}
                    autoFocus
                  />
                ) : (
                  <TouchableOpacity
                    disabled={!editMode}
                    onPress={() => {
                      if (editMode) {
                        setEditingItemIndex(index);
                        setEditingField('name');
                        setFieldInput(item.name ?? '');
                      }
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.itemName, editMode && styles.editableField]}>{item.name || 'Unnamed Item'}</Text>
                      {editMode && <Icon name="edit-2" size={14} color="#7e5cff" style={{ marginLeft: 4 }} />}
                    </View>
                  </TouchableOpacity>
                )}
                {/* Quantity and Price Editable */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {editMode && editingItemIndex === index && editingField === 'quantity' ? (
                    <TextInput
                      style={[styles.itemMeta, styles.editInput, { width: 50 }]}
                      value={fieldInput}
                      onChangeText={val => setFieldInput(val.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      onBlur={() => handleItemFieldSave(index, 'quantity', fieldInput)}
                      onSubmitEditing={() => handleItemFieldSave(index, 'quantity', fieldInput)}
                      editable={!loading}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity
                      disabled={!editMode}
                      onPress={() => {
                        if (editMode) {
                          setEditingItemIndex(index);
                          setEditingField('quantity');
                          setFieldInput(item.quantity?.toString() ?? '');
                        }
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.itemMeta, editMode && styles.editableField]}>Qty: {item.quantity ?? '—'}</Text>
                        {editMode && <Icon name="edit-2" size={13} color="#7e5cff" style={{ marginLeft: 2 }} />}
                      </View>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.itemMeta, { marginHorizontal: 6 }]}>|</Text>
                  {editMode && editingItemIndex === index && editingField === 'price' ? (
                    <TextInput
                      style={[styles.itemMeta, styles.editInput, { width: 70 }]}
                      value={fieldInput}
                      onChangeText={val => setFieldInput(val.replace(/[^0-9.,]/g, ''))}
                      keyboardType="decimal-pad"
                      onBlur={() => handleItemFieldSave(index, 'price', fieldInput)}
                      onSubmitEditing={() => handleItemFieldSave(index, 'price', fieldInput)}
                      editable={!loading}
                      autoFocus
                    />
                  ) : (
                    <TouchableOpacity
                      disabled={!editMode}
                      onPress={() => {
                        if (editMode) {
                          setEditingItemIndex(index);
                          setEditingField('price');
                          setFieldInput(item.price?.toString() ?? '');
                        }
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.itemMeta, editMode && styles.editableField]}>Price: {typeof item.price === 'number' ? formatCurrency(item.price, currency) : '\u2014'}</Text>
                        {editMode && <Icon name="edit-2" size={13} color="#7e5cff" style={{ marginLeft: 2 }} />}
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
                {typeof item.discount === 'number' && item.discount > 0 && (
                  <Text style={styles.itemDiscount}>
                    <Icon name="arrow-down-right" size={14} color="#00C851" /> Discount: -{formatCurrency(item.discount, currency)}
                  </Text>
                )}
                {editMode ? (
                  <TouchableOpacity
                    disabled={loading}
                    style={{ alignSelf: 'flex-start' }}
                    onPress={() => {
                      setEditingItemIndex(index);
                      setItemCategoryModalVisible(true);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text
                        style={[
                          styles.itemCategoryBadge,
                          { 
                            backgroundColor: getCategoryColor(item.category),
                            borderWidth: 1,
                            borderColor: '#7e5cff',
                          }
                        ]}
                      >
                        {item.category || 'Other'}
                      </Text>
                      <Icon name="edit-2" size={14} color="#7e5cff" style={{ marginLeft: 4 }} />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={[
                      styles.itemCategoryBadge,
                      { backgroundColor: getCategoryColor(item.category) }
                    ]}
                  >
                    {item.category || 'Other'}
                  </Text>
                )}
              </View>
              {/* Total price is always calculated and not editable */}
              <View style={{ minWidth: 70, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={styles.itemPrice}>
                  {typeof item.total === 'number' ? formatCurrency(item.total, currency) : `${getCurrencySymbol(currency)}0.00`}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary Section */}
        <View style={styles.summaryContainer}>
          {typeof receiptData.total_discount === 'number' && receiptData.total_discount !== 0 && (
            <SummaryRow
              label="Total Discount"
              value={`-${formatCurrency(receiptData.total_discount, currency)}`}
              color="#00C851"
              icon="percent"
            />
          )}
          {typeof receiptData.tax_amount === 'number' && receiptData.tax_amount !== 0 && (
            <SummaryRow
              label="Tax Amount"
              value={formatCurrency(receiptData.tax_amount, currency)}
              color="#ff4444"
              icon="dollar-sign"
            />
          )}
          <SummaryRow
            label="Total"
            value={formatCurrency(total !== null ? total : receiptData.total, currency)}
            color="#ffffff"
            icon="credit-card"
            isTotal
          />
        </View>
      </ScrollView>

      {/* Item Category Modal */}
      <Modal
        visible={itemCategoryModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setItemCategoryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setItemCategoryModalVisible(false)}
        >
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownHeaderText}>Select Item Category</Text>
              <TouchableOpacity
                onPress={() => setItemCategoryModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={Object.keys(categoryColors)}
              keyExtractor={(item) => item}
              style={styles.dropdownList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    items[editingItemIndex ?? -1]?.category === item && styles.dropdownItemSelected
                  ]}
                  onPress={() => handleItemCategorySave(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    items[editingItemIndex ?? -1]?.category === item && styles.dropdownItemTextSelected
                  ]}>
                    {item}
                  </Text>
                  {items[editingItemIndex ?? -1]?.category === item && (
                    <Ionicons name="checkmark" size={20} color="#7e5cff" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Minimal Footer with Border */}
      <View style={styles.footerContainer} />
    </SafeAreaView>
  );
};

// SummaryRow with Icon and Color Support
const SummaryRow = ({
  label,
  value,
  color = '#ffffff',
  icon,
  isTotal = false,
}: {
  label: string;
  value: string;
  color?: string;
  icon?: string;
  isTotal?: boolean;
}) => (
  <View style={[styles.summaryRow, isTotal && styles.totalRow]}>
    <View style={styles.summaryLabelRow}>
      {icon && <Icon name={icon} size={16} color={color} style={styles.icon} />}
      <Text style={[styles.summaryLabel, { color }, isTotal && styles.totalLabel]}>{label}</Text>
    </View>
    <Text style={[styles.summaryValue, { color }, isTotal && styles.totalValue]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#16191f',
  },
  headerContainer: {
    backgroundColor: '#16191f',
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
    paddingBottom: 16,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  headerContent: {
    flex: 1,
    paddingRight: 16,
  },
  closeButton: {
    padding: 4,
    top: 0,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#16191f',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  storeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e6e9f0',
  },
  storeCategory: {
    fontSize: 14,
    color: '#8ca0c6',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  icon: {
    marginRight: 6,
  },
  date: {
    fontSize: 14,
    color: '#8ca0c6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#e6e9f0',
  },
  itemsContainer: {
    marginBottom: 24,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#232632',
  },
  itemDetails: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e6e9f0',
  },
  itemMeta: {
    fontSize: 14,
    color: '#8ca0c6',
    marginTop: 4,
  },
  itemDiscount: {
    fontSize: 14,
    color: '#00C851',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  summaryContainer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#232632',
    paddingBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 16,
  },
  totalRow: {
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  itemCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2E86DE',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 4,
  },
  footerContainer: {
    height: 1,
    backgroundColor: '#2d3748',
    borderTopWidth: 1,
    borderTopColor: '#2d3748',
  },
  editableField: {
    color: '#7e5cff',
    fontWeight: '600',
  },
  editInput: {
    backgroundColor: '#232632',
    borderRadius: 6,
    paddingHorizontal: 6,
    color: '#7e5cff',
    borderWidth: 1,
    borderColor: '#7e5cff',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#3a3d4a',
    backgroundColor: '#2a2d47',
    borderRadius: 8,
    flex: 1,
  },
  dropdownText: {
    fontSize: 14,
    color: '#e6e9f0',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModal: {
    backgroundColor: '#232632',
    borderRadius: 16,
    width: '100%',
    maxWidth: 350,
    maxHeight: '70%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3d4a',
  },
  dropdownHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  dropdownList: {
    maxHeight: 300,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2d3a',
  },
  dropdownItemSelected: {
    backgroundColor: '#7e5cff15',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#e6e9f0',
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: '#7e5cff',
    fontWeight: '600',
  },
});
