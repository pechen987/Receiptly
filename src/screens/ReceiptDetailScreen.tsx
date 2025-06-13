import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { saveReceipt } from '../services/storageService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppNavigationProps } from '../types/navigation';
import { formatCurrency, getCurrencySymbol } from '../screens/analytics/utils/currency';

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import jwtDecode from 'jwt-decode';
import apiConfig from '../config/api';

const API_BASE_URL = apiConfig.API_BASE_URL;

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
  const [currency, setCurrency] = React.useState('USD');

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
        console.error('Error fetching user currency:', error);
      }
    })();
  }, []);

  const navigation = useNavigation<AppNavigationProps<'MainTabs'>>();
  const route = useRoute();
  const { receiptData } = route.params as { receiptData: any };

  if (!receiptData) {
    console.warn('No receipt data provided to ReceiptDetailScreen');
    navigation.goBack();
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>

        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.storeName}>{receiptData.store_name || 'Unknown Store'}</Text>
          <View style={styles.categoryRow}>
            <Icon name="tag" size={16} color="#8ca0c6" style={styles.icon} />
            <Text style={styles.storeCategory}>{receiptData.store_category || 'other'}</Text>
          </View>
          <View style={styles.dateRow}>
            <Icon name="calendar" size={16} color="#8ca0c6" style={styles.icon} />
            <Text style={styles.date}>{receiptData.date || 'Unknown Date'}</Text>
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.itemsContainer}>
          <Text style={styles.sectionTitle}>Items</Text>
          {receiptData.items.map((item: any, index: number) => (
            <View key={index} style={styles.item}>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.name || 'Unnamed Item'}</Text>
                <Text style={styles.itemMeta}>
                  Qty: {item.quantity ?? '—'} | Price: {typeof item.price === 'number' ? formatCurrency(item.price, currency) : '\u2014'}
                </Text>
                {typeof item.discount === 'number' && item.discount > 0 && (
                  <Text style={styles.itemDiscount}>
                    <Icon name="arrow-down-right" size={14} color="#00C851" /> Discount: -{formatCurrency(item.discount, currency)}
                  </Text>
                )}
                <Text
                  style={[
                    styles.itemCategoryBadge,
                    { backgroundColor: categoryColors[item.category as keyof typeof categoryColors] || '#7F8C8D' }
                  ]}
                >
                  {item.category || 'Other'}
                </Text>
              </View>
              <Text style={styles.itemPrice}>
                {typeof item.total === 'number' ? formatCurrency(item.total, currency) : `${getCurrencySymbol(currency)}0.00`}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary Section */}
        <View style={styles.summaryContainer}>
          {typeof receiptData.total_discount === 'number' && (
            <SummaryRow
              label="Total Discount"
              value={`-${formatCurrency(receiptData.total_discount, currency)}`}
              color="#00C851"
              icon="percent"
            />
          )}
          {typeof receiptData.tax_amount === 'number' && (
            <SummaryRow
              label="Tax Amount"
              value={formatCurrency(receiptData.tax_amount, currency)}
              color="#ff4444"
              icon="dollar-sign"
            />
          )}
          <SummaryRow
            label="Total"
            value={formatCurrency(receiptData.total, currency)}
            color="#ffffff"
            icon="credit-card"
            isTotal
          />
        </View>

        {/* Close Button */}
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.saveButtonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
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
  container: {
    flex: 1,
    backgroundColor: '#16191f',
    padding: 16,
  },
  header: {
    marginBottom: 24,
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
  saveButton: {
    backgroundColor: '#7e5cff',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
    shadowColor: '#4f8cff',
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  itemCategory: {
    fontSize: 14,
    color: '#8ca0c6',
    marginTop: 4,
  },
  itemCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2E86DE', // Or any color by category
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 4,
  },
});
