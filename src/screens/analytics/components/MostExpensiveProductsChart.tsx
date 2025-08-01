import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Svg, G, Rect, Text as SvgText } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import { memo } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
import { formatCurrency } from '../utils/currency';
import { styles } from '../styles';
import { ChartProps, ExpensiveProduct } from '../types';
import { API_BASE_URL, getProductColor } from '../utils';
import { HintIcon, HintModal, modalStyles, HintIconProps, HintModalProps } from './HintComponents';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useButtonAnimation } from '../../../hooks/useButtonAnimation';
import { Animated } from 'react-native';

const MostExpensiveProductsChart = memo(({ userId, refreshTrigger, userPlan, navigation: propNavigation, selectedStore, selectedCategory }: ChartProps & { userPlan?: string | null; navigation?: any; selectedStore: string | null; selectedCategory: string | null }) => {
  const [expensiveProducts, setExpensiveProducts] = useState<ExpensiveProduct[]>([]);
  const [productsPeriod, setProductsPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [hasData, setHasData] = useState(false);

  const navigation = propNavigation || useNavigation();

  const goProButtonAnim = useButtonAnimation().createPressAnimation();

  // Fetch most expensive products
  const fetchExpensiveProducts = useCallback(async () => {
    let currentUserId = userId;
    
    if (!currentUserId) {
      console.log('[ExpensiveProducts] No user ID in props, checking token...');
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded: any = jwtDecode(token);
          currentUserId = decoded.user_id || decoded.id;
          console.log('[ExpensiveProducts] Found user ID in token:', currentUserId);
        }
      } catch (error) {
        console.log('[ExpensiveProducts] Error checking token:', error);
      }
    }

    if (!currentUserId) {
      console.log('[ExpensiveProducts] Skipping fetch - no user ID available');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('[ExpensiveProducts] Making API request to:', `${API_BASE_URL}/api/analytics/most-expensive-products`);
      console.log('[ExpensiveProducts] Request params:', { 
        user_id: currentUserId, 
        period: productsPeriod,
        limit: 6,
        store_name: selectedStore,
        store_category: selectedCategory
      });

      const res = await axios.get(`${API_BASE_URL}/api/analytics/most-expensive-products`, {
        params: { 
          user_id: currentUserId, 
          period: productsPeriod,
          limit: 6,
          store_name: selectedStore,
          store_category: selectedCategory
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('jwt_token')}`
        }
      });

      console.log('[ExpensiveProducts] API Response:', res.data);
      setExpensiveProducts(res.data.products || []);
      setCurrency(res.data.currency || 'USD');
      setHasData(res.data.has_data === true);
    } catch (e: any) {
      console.log('[ExpensiveProducts] Error fetching expensive products:', e);
      let userMessage = 'Unable to load most expensive products.';
      if (axios.isAxiosError(e)) {
        if (!e.response) {
          userMessage = 'No internet connection or the server is not responding.';
        }
      } else if (e.message && e.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      setError(userMessage);
      Alert.alert('Expensive Products', userMessage);
    } finally {
      setLoading(false);
    }
  }, [userId, productsPeriod, selectedStore, selectedCategory]);

  // Fetch data when component mounts or when period changes
  useEffect(() => {
    fetchExpensiveProducts();
  }, [fetchExpensiveProducts, productsPeriod]);

  // Refresh when refreshTrigger changes (new receipt added)
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      fetchExpensiveProducts();
    }
  }, [refreshTrigger, fetchExpensiveProducts]);

  const renderBarChart = () => {
    if (expensiveProducts.length === 0) return null;

    const chartWidth = 280;
    const barHeight = 32;
    const barSpacing = 12;
    const chartHeight = expensiveProducts.length * (barHeight + barSpacing) - barSpacing;

    // Find max price for scaling
    const maxPrice = Math.max(...expensiveProducts.map(p => p.price));

    return (
      <View style={{ alignItems: 'center'}}>
        <Svg width={chartWidth + 100} height={chartHeight + 40} viewBox={`0 0 ${chartWidth + 80} ${chartHeight + 10}`}>
          {expensiveProducts.map((product, index) => {
            const barWidth = (product.price / maxPrice) * chartWidth;
            const y = index * (barHeight + barSpacing);
            const color = getProductColor(product.category);
            return (
              <G key={index}>
                {/* Background bar */}
                <Rect
                  x={15}
                  y={y}
                  width={chartWidth}
                  height={barHeight}
                  fill="#2a2d47"
                  rx={4}
                />
                {/* Progress bar */}
                <Rect
                  x={15}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx={4}
                />
                {/* Product name */}
                <SvgText
                  x={20}
                  y={y + barHeight / 2}
                  fill="white"
                  fontSize="12"
                  fontWeight="600"
                  alignmentBaseline="central"
                >
                  {product.name.length > 25 ? `${product.name.substring(0, 25)}...` : product.name}
                </SvgText>
                {/* Price */}
                <SvgText
                  x={chartWidth + 20}
                  y={y + barHeight / 2 - 6}
                  fill="#ffffff"
                  fontSize="13"
                  fontWeight="600"
                  alignmentBaseline="central"
                >
                  {formatCurrency(product.price, currency)}
                </SvgText>
                {/* Count - displayed below the price */}
                <SvgText
                  x={chartWidth + 20}
                  y={y + barHeight / 2 + 8}
                  fill="#9ca3af"
                  fontSize="11"
                  alignmentBaseline="central"
                >
                  {product.count} time{product.count !== 1 ? 's' : ''}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
    );
  };

  return (
    <View style={[styles.widgetBg, { position: 'relative', overflow: 'hidden' }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleWithIcon}>
          <Icon name="trending-up" size={22} color="#7e5cff" style={{ marginRight: 8 }} />
          <Text style={styles.title}>Most expensive</Text>
          <HintIcon hintText="This chart shows your most expensive products based on their individual price. The list is for the period you select (last 30 days, last 365 days, or all time)." />
        </View>
        {hasData && (
          <View style={styles.selector}>
            {[{ label: 'M', value: 'month' }, { label: 'Y', value: 'year' }, { label: 'All', value: 'all' }].map(({ label, value }) => (
              <Pressable
                key={value}
                style={[
                  styles.btn,
                  productsPeriod === value && styles.btnActive,
                  { paddingHorizontal: 10 }
                ]}
                onPress={() => setProductsPeriod(value as 'month' | 'year' | 'all')}
              >
                <Text style={[styles.btnText, productsPeriod === value && styles.btnTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {loading ? (
        <View style={styles.emptyCompact}>
          <Text style={styles.message}>Loading most expensive products...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyCompact}>
          <Text style={[styles.message, { color: 'red' }]}>{error}</Text>
        </View>
      ) : !hasData ? (
        <View style={styles.emptyCompact}>
          <Text style={styles.message}>No data yet</Text>
        </View>
      ) : expensiveProducts.length === 0 ? (
        <View style={styles.emptyCompact}>
          <Text style={styles.message}>No data for this interval</Text>
        </View>
      ) : (
        <View style={{ minHeight: 220 }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderBarChart()}
          </ScrollView>
        </View>
      )}
      {userPlan === 'basic' && (
        Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFillObject, {zIndex: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 16, overflow: 'hidden', paddingHorizontal: 24}]}> 
            <View style={{ alignItems: 'center', width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Icon name="trending-up" size={32} color="#7e5cff" style={{ marginRight: 10 }} />
                <Text style={[{ color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 32 }]}>Most expensive products</Text>
              </View>
              <Text style={[{ color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8, marginTop: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 20 }]}>Upgrade to Pro to unlock this chart</Text>
              <Animated.View style={{ transform: [{ scale: goProButtonAnim.scaleAnim }] }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProOnboarding')}
                  onPressIn={goProButtonAnim.handlePressIn}
                  onPressOut={goProButtonAnim.handlePressOut}
                  activeOpacity={1}
                >
                  <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: '#FFD700', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 }}
                  >
                    <Ionicons name="star" size={16} color="#000" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>Go Pro</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </BlurView>
        ) : (
          <View style={[StyleSheet.absoluteFillObject, {backgroundColor: 'rgba(20,20,30,0.95)', zIndex: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 16, overflow: 'hidden', paddingHorizontal: 24}]}> 
            <View style={{ alignItems: 'center', width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Icon name="trending-up" size={32} color="#7e5cff" style={{ marginRight: 10 }} />
                <Text style={[{ color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 32 }]}>Most expensive products</Text>
              </View>
              <Text style={[{ color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8, marginTop: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 20 }]}>Upgrade to Pro to unlock this chart</Text>
              <Animated.View style={{ transform: [{ scale: goProButtonAnim.scaleAnim }] }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ProOnboarding')}
                  onPressIn={goProButtonAnim.handlePressIn}
                  onPressOut={goProButtonAnim.handlePressOut}
                  activeOpacity={1}
                >
                  <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, shadowColor: '#FFD700', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 5 }}
                  >
                    <Ionicons name="star" size={16} color="#000" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>Go Pro</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        )
      )}
    </View>
  );
});

export default MostExpensiveProductsChart;