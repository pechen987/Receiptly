import React, { useEffect, useState, useCallback, memo, useRef, useMemo } from 'react';
import { View, ScrollView, Text, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Svg, G, Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons as Icon } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { interpolateColor, baseChartWidth, formatLabel } from '../utils';
import { SpendData } from '../types';
import { formatCurrency } from '../utils/currency';
import { styles as sharedStyles } from '../styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
import { HintIcon } from './HintComponents';
import axios from 'axios';
import apiConfig from '../../../config/api';

const API_BASE_URL = apiConfig.API_BASE_URL;

interface TotalSpentChartProps {
  onBarPress: (date: string, amount: number) => void;
  userCurrency: string;
  refreshTrigger: number;
  selectedStore: string | null;
  selectedCategory: string | null;
}

const TotalSpentChart: React.FC<TotalSpentChartProps> = ({
  onBarPress,
  userCurrency,
  refreshTrigger,
  selectedStore,
  selectedCategory
}) => {
  const { user } = useAuth();
  const [spendData, setSpendData] = useState<SpendData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const scrollViewRef = useRef<ScrollView>(null);
  const prevIntervalRef = useRef(interval);

  const fetchSpendData = useCallback(async () => {
    let currentUserId = user?.id;
    
    if (!currentUserId) {
      console.log('[TotalSpent] No user ID in auth context, checking token...');
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        if (token) {
          const decoded: any = jwtDecode(token);
          currentUserId = decoded.user_id || decoded.id;
          console.log('[TotalSpent] Found user ID in token:', currentUserId);
        }
      } catch (error) {
        console.error('[TotalSpent] Error checking token:', error);
      }
    }

    if (!currentUserId) {
      console.log('[TotalSpent] Skipping fetch - no user ID available');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('[TotalSpent] Making API request to:', `${API_BASE_URL}/api/analytics/spend`);
      console.log('[TotalSpent] Request params:', { 
        user_id: currentUserId, 
        interval,
        store_name: selectedStore,
        store_category: selectedCategory
      });

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await AsyncStorage.getItem('jwt_token')}`
      };

      const response = await axios.get(`${API_BASE_URL}/api/analytics/spend`, {
        params: { 
          user_id: currentUserId, 
          interval,
          store_name: selectedStore,
          store_category: selectedCategory
        },
        headers
      });

      console.log('[TotalSpent] Raw API response:', response.data);
      console.log('[TotalSpent] Data type:', typeof response.data);
      console.log('[TotalSpent] Data keys:', Object.keys(response.data || {}));
      
      // Handle both possible response formats
      let spendDataArray = [];
      if (response.data && response.data.data && Array.isArray(response.data.data)) {
        // Backend returns { currency: "USD", data: [...] }
        spendDataArray = response.data.data;
        console.log('[TotalSpent] Using data.data format, found', spendDataArray.length, 'items');
      } else if (response.data && Array.isArray(response.data)) {
        // Backend returns data array directly
        spendDataArray = response.data;
        console.log('[TotalSpent] Using direct data format, found', spendDataArray.length, 'items');
      } else {
        console.log('[TotalSpent] Unexpected data format:', response.data);
        spendDataArray = [];
      }
      
      console.log('[TotalSpent] Final spend data array:', spendDataArray);
      setSpendData(spendDataArray);
    } catch (error: any) {
      console.log('[TotalSpent] Error fetching spend data:', error);
      let userMessage = 'Unable to load spend data.';
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          userMessage = 'No internet connection or the server is not responding.';
        }
      } else if (error.message && error.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      setError(userMessage);
      setSpendData([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, interval, selectedStore, selectedCategory]);

  useEffect(() => {
    fetchSpendData();
  }, [fetchSpendData]);

  // Refetch data when refreshTrigger changes (e.g., after receipt deletion)
  useEffect(() => {
    fetchSpendData();
  }, [refreshTrigger]);

  useEffect(() => {
    if (prevIntervalRef.current !== interval) {
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      prevIntervalRef.current = interval;
    }
  }, [interval]);

  const handleIntervalChange = (newInterval: string) => {
    setInterval(newInterval as 'daily' | 'weekly' | 'monthly');
  };

  // Memoize chart data calculations
  const chartData = useMemo(() => {
    const values = spendData.map(d => d.total_spent);
    const labels = spendData.map(d => d.period);
    const chartWidth = Math.max(values.length * 60, baseChartWidth);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      values,
      labels,
      chartWidth,
      min,
      max
    };
  }, [spendData]);

  const renderCustomBarChart = useMemo(() => {
    if (chartData.values.length === 0) return null;

    const chartHeight = 200;
    const bottomPadding = 40; // Space for labels
    const topPadding = 32;
    const barChartHeight = chartHeight - bottomPadding - topPadding;
    
    const barWidth = (chartData.chartWidth / chartData.values.length) * 0.65; // 65% width, 35% spacing
    const barSpacing = (chartData.chartWidth / chartData.values.length) * 0.35;

    return (
      <View style={{ width: chartData.chartWidth, height: chartHeight }}>
        <Svg width={chartData.chartWidth} height={chartHeight}>
          {chartData.values.map((value, index) => {
            const barHeight = (value / chartData.max) * barChartHeight;
            const x = (index * (chartData.chartWidth / chartData.values.length)) + (barSpacing / 2);
            const y = topPadding + (barChartHeight - barHeight);
            const color = interpolateColor(value, chartData.min, chartData.max);
            
            return (
              <G key={index}>
                {/* Bar with rounded corners */}
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx={6} // Border radius
                  ry={6}
                />
                
                {/* Value label above bar */}
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 8}
                  fontSize={14}
                  fill="#fff"
                  fontWeight="600"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {formatCurrency(value, userCurrency || 'USD', 1)}
                </SvgText>
                
                {/* X-axis label */}
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight - 10}
                  fontSize={13}
                  fill="#8ca0c6"
                  fontWeight="500"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {formatLabel(chartData.labels[index])}
                </SvgText>
              </G>
            );
          })}
        </Svg>
        
        {/* Overlay invisible pressable views for bar interaction */}
        <View 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            height: chartHeight - bottomPadding, 
            width: chartData.chartWidth, 
            flexDirection: 'row' 
          }} 
          pointerEvents="box-none"
        >
          {chartData.values.map((_, index) => {
            const x = (index * (chartData.chartWidth / chartData.values.length)) + (barSpacing / 2);
            return (
              <Pressable
                key={index}
                style={{ 
                  position: 'absolute',
                  left: x,
                  width: barWidth,
                  height: chartHeight - bottomPadding
                }}
                onPress={() => onBarPress(chartData.labels[index], chartData.values[index])}
              />
            );
          })}
        </View>
      </View>
    );
  }, [chartData, userCurrency, onBarPress]);

  return (
    <View style={sharedStyles.widgetBg}>
      <View style={sharedStyles.titleRow}>
        <View style={sharedStyles.titleWithIcon}>
          <Icon name="card" size={22} color="#7e5cff" style={{ marginRight: 8 }} />
          <Text style={sharedStyles.title}>Total spent</Text>
          <HintIcon hintText="This chart shows your total spending over time, grouped by the selected interval (daily, weekly, or monthly). You can click on a bar to see the receipts for that period." />
        </View>
        {chartData.values.length > 0 && (
          <View style={sharedStyles.selector}>
            {['D', 'W', 'M'].map(label => {
              const mode = label === 'D' ? 'daily' : label === 'W' ? 'weekly' : 'monthly';
              const active = interval === mode;
              return (
                <Pressable
                  key={label}
                  style={[
                    sharedStyles.btn,
                    active && sharedStyles.btnActive
                  ]}
                  onPress={() => handleIntervalChange(mode)}
                >
                  <Text style={[
                    sharedStyles.btnText,
                    active && sharedStyles.btnTextActive
                  ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ height: 200, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#7e5cff" />
        </View>
      ) : error ? (
        <View style={{ height: 200, justifyContent: 'center' }}>
          <Text style={[sharedStyles.message, { color: 'red' }]}>{error}</Text>
        </View>
      ) : chartData.values.length === 0 ? (
        <View style={sharedStyles.emptyCompact}>
          <Text style={sharedStyles.message}>No data yet</Text>
        </View>
      ) : (
        <ScrollView 
          ref={scrollViewRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {renderCustomBarChart}
        </ScrollView>
      )}
    </View>
  );
};

export default memo(TotalSpentChart); 