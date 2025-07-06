import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Svg, G, Rect, Text as SvgText } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import { memo } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
import { styles } from '../styles';
import { ChartProps, TopProduct } from '../types';
import { API_BASE_URL, getProductColor } from '../utils';
import { HintIcon, HintModal, modalStyles, HintIconProps, HintModalProps } from './HintComponents';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useButtonAnimation } from '../../../hooks/useButtonAnimation';
import { Animated } from 'react-native';

const TopProductsChart = memo(({ userId, refreshTrigger, userPlan, navigation: propNavigation, selectedStore, selectedCategory }: ChartProps & { userPlan?: string | null; navigation?: any; selectedStore: string | null; selectedCategory: string | null }) => {
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [productsPeriod, setProductsPeriod] = useState<'month' | 'year' | 'all'>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalReceipts, setTotalReceipts] = useState(0);
  const [hasData, setHasData] = useState(false);

  const navigation = propNavigation || useNavigation();

  const goProButtonAnim = useButtonAnimation().createPressAnimation();

  // Fetch top products
  const fetchTopProducts = useCallback(async () => {
    let currentUserId = userId;
    
    if (!currentUserId) {
      console.log('[TopProducts] No user ID in props, checking token...');
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded: any = jwtDecode(token);
          currentUserId = decoded.user_id || decoded.id;
          console.log('[TopProducts] Found user ID in token:', currentUserId);
        }
      } catch (error) {
        console.log('[TopProducts] Error checking token:', error);
      }
    }

    if (!currentUserId) {
      console.log('[TopProducts] Skipping fetch - no user ID available');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log('[TopProducts] Making API request to:', `${API_BASE_URL}/api/analytics/top-products`);
      console.log('[TopProducts] Request params:', { 
        user_id: currentUserId, 
        period: productsPeriod,
        limit: 6,
        store_name: selectedStore,
        store_category: selectedCategory
      });

      const res = await axios.get(`${API_BASE_URL}/api/analytics/top-products`, {
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

      console.log('[TopProducts] API Response:', res.data);
      setTopProducts(res.data.products || []);
      setTotalReceipts(res.data.total_receipts || 0);
      setHasData(res.data.has_data === true);
    } catch (e: any) {
      console.log('[TopProducts] Error fetching top products:', e);
      let userMessage = 'Unable to load top products.';
      if (axios.isAxiosError(e)) {
        if (!e.response) {
          userMessage = 'No internet connection or the server is not responding.';
        }
      } else if (e.message && e.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      setError(userMessage);
      Alert.alert('Popular Products', userMessage);
    } finally {
      setLoading(false);
    }
  }, [userId, productsPeriod, selectedStore, selectedCategory]);

  // Fetch data when component mounts or when period changes
  useEffect(() => {
    fetchTopProducts();
  }, [fetchTopProducts, productsPeriod]);

  // Refresh when refreshTrigger changes (new receipt added)
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      fetchTopProducts();
    }
  }, [refreshTrigger, fetchTopProducts]);

  const renderBarChart = () => {
    if (topProducts.length === 0) return null;

    const chartWidth = 280;
    const barHeight = 32;
    const barSpacing = 12;
    const chartHeight = topProducts.length * (barHeight + barSpacing) - barSpacing;

    return (
      <View style={{ alignItems: 'center' }}>
        <Svg width={chartWidth + 100} height={chartHeight + 40} viewBox={`0 0 ${chartWidth + 70} ${chartHeight + 20}`}>
          {topProducts.map((product, index) => {
            const barWidth = (product.percentage / 100) * chartWidth;
            const y = index * (barHeight + barSpacing);
            const color = getProductColor(product.category);
            
            return (
              <G key={index}>
                {/* Background bar */}
                <Rect
                  x={10}
                  y={y}
                  width={chartWidth}
                  height={barHeight}
                  fill="#2a2d47"
                  rx={4}
                />
                
                {/* Progress bar */}
                <Rect
                  x={10}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx={4}
                />
                
                {/* Product name */}
                <SvgText
                  x={15}
                  y={y + barHeight / 2}
                  fill="white"
                  fontSize="12"
                  fontWeight="600"
                  alignmentBaseline="central"
                >
                  {product.name.length > 25 ? `${product.name.substring(0, 25)}...` : product.name}
                </SvgText>
                
                {/* Percentage and count */}
                <SvgText
                  x={chartWidth + 15}
                  y={y + barHeight / 2 - 6}
                  fill="#ffffff"
                  fontSize="13"
                  fontWeight="600"
                  alignmentBaseline="central"
                >
                  {product.percentage}%
                </SvgText>
                
                <SvgText
                  x={chartWidth + 15}
                  y={y + barHeight / 2 + 8}
                  fill="#9ca3af"
                  fontSize="11"
                  alignmentBaseline="central"
                >
                  {product.count} / {totalReceipts}
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
          <Icon name="shopping-bag" size={22} color="#7e5cff" style={{ marginRight: 8 }} />
          <Text style={styles.title}>Most popular</Text>
          <HintIcon hintText="This chart shows your most frequently purchased products based on the number of receipts they appear in. The list is for the period you select (last 30 days, last 365 days, or all time)." />
        </View>
        {hasData && (
          <View style={styles.selector}>
            {[
              { label: 'M', value: 'month' },
              { label: 'Y', value: 'year' },
              { label: 'All', value: 'all' }
            ].map(({ label, value }) => (
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
          <Text style={styles.message}>Loading top products...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyCompact}>
          <Text style={[styles.message, { color: 'red' }]}>{error}</Text>
        </View>
      ) : !hasData ? (
        <View style={styles.emptyCompact}>
          <Text style={styles.message}>No data yet</Text>
        </View>
      ) : topProducts.length === 0 ? (
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
                <Icon name="shopping-bag" size={32} color="#7e5cff" style={{ marginRight: 10 }} />
                <Text style={[{ color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 32 }]}>Most popular products</Text>
              </View>
              <Text style={[{ color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8, marginTop: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30 }]}>Upgrade to Pro to unlock this chart</Text>
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
                <Icon name="shopping-bag" size={32} color="#7e5cff" style={{ marginRight: 10 }} />
                <Text style={[{ color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 32 }]}>Most popular products</Text>
              </View>
              <Text style={[{ color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8, marginTop: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 30 }]}>Upgrade to Pro to unlock this chart</Text>
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

export default TopProductsChart; 