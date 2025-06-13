import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Svg, G, Rect, Text as SvgText } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import { useAuth } from '../../../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { interpolateColor, baseChartWidth, formatLabel } from '../utils';
import { ShoppingDaysData, ShoppingDay } from '../types';
import { fetchShoppingDays } from '../utils/api';
import { styles as sharedStyles } from '../styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
import { HintIcon, HintModal, modalStyles, HintIconProps, HintModalProps } from './HintComponents';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';

interface ShoppingDaysChartProps {
    refreshTrigger: number;
    userPlan?: string | null;
}


const ShoppingDaysChart: React.FC<ShoppingDaysChartProps & { navigation?: any }> = ({ refreshTrigger, userPlan, navigation: propNavigation }) => {
  const { user } = useAuth();
  const [data, setData] = useState<ShoppingDaysData | null>(null);
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const navigation = propNavigation || useNavigation();

  useEffect(() => {
    const loadData = async () => {
      let currentUserId = user?.id;
      
      if (!currentUserId) {
        console.log('[ShoppingDays] No user ID in auth context, checking token...');
        try {
          const token = await AsyncStorage.getItem('jwt_token');
          if (token) {
            const decoded: any = jwtDecode(token);
            currentUserId = decoded.user_id || decoded.id;
            console.log('[ShoppingDays] Found user ID in token:', currentUserId);
          }
        } catch (error) {
          console.error('[ShoppingDays] Error checking token:', error);
        }
      }

      if (!currentUserId) {
        console.log('[ShoppingDays] Skipping fetch - no user ID available');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        console.log('[ShoppingDays] Making API request with user ID:', currentUserId);
        const response = await fetchShoppingDays(currentUserId, period);
        console.log('[ShoppingDays] API Response:', response);
        // Ensure data is sorted Mon-Sun (0-6)
        const sortedData = response.data.sort((a: ShoppingDay, b: ShoppingDay) => {
            const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            return daysOrder.indexOf(a.day) - daysOrder.indexOf(b.day);
        });
        setData({...response, data: sortedData});
        setHasData(response.has_data === true);
      } catch (e: any) {
        console.error('[ShoppingDays] Error fetching shopping days:', e);
        let userMessage = 'Failed to load shopping days data.';
        if (e.message && e.message.toLowerCase().includes('network')) {
          userMessage = 'No internet connection. Please check your connection and try again.';
        }
        setError(userMessage);
        Alert.alert('Shopping Days', userMessage);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.id, period, refreshTrigger]);

  // Add debug logging for data state
  useEffect(() => {
    console.log('Current data state:', data);
  }, [data]);

  const renderChart = () => {
    if (!data?.data) return null;

    const chartHeight = 200;
    const bottomPadding = 40;
    const topPadding = 32;
    const barChartHeight = chartHeight - bottomPadding - topPadding;
    
    const max = Math.max(...data.data.map(item => item.count));
    
    const barWidth = (baseChartWidth / data.data.length) * 0.4;
    const barSpacing = 1;

    return (
      <View style={{ width: baseChartWidth, height: chartHeight, alignSelf: 'center', marginLeft: 35 }}>
        <Svg width={baseChartWidth} height={chartHeight}>
          {data.data.map((item, index) => {
            const barHeight = (item.count / max) * barChartHeight;
            const x = (index * (baseChartWidth / (data.data.length + 1))) + (barSpacing);
            const y = topPadding + (barChartHeight - barHeight);
            const color = interpolateColor(item.count, 0, max);
            
            return (
              <G key={index}>
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx={6}
                  ry={6}
                />
                
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 8}
                  fontSize={14}
                  fill="#fff"
                  fontWeight="600"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {item.count}
                </SvgText>
                
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight - 10}
                  fontSize={13}
                  fill="#8ca0c6"
                  fontWeight="500"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {item.day}
                </SvgText>
              </G>
            );
          })}
        </Svg>
        
        {/* Overlay invisible pressable views for bar interaction */}
        {data.data.map((item, index) => {
          const x = (index * (baseChartWidth / data.data.length)) + (barSpacing / 2);
          return (
            <Pressable
              key={index}
              style={{
                position: 'absolute',
                left: x,
                top: topPadding,
                width: barWidth,
                height: barChartHeight,
              }}
              onPress={() => {
                // Handle bar press if needed
              }}
            />
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={sharedStyles.widgetBg}>
        <View style={sharedStyles.titleRow}>
          <View style={sharedStyles.titleWithIcon}>
            <Icon name="calendar" size={22} color="#7e5cff" style={styles.titleIcon} />
            <Text style={sharedStyles.title}>Shopping days</Text>
            <HintIcon hintText="This chart shows the number of receipts you have for each day of the week. The statistics are for the last 30 days or all time, depending on the selected interval." />
          </View>
          <View style={sharedStyles.selector}>
            {['M', 'All'].map(label => {
              const mode = label === 'M' ? 'month' : 'all';
              const active = period === mode;
              return (
                <Pressable
                  key={label}
                  style={[sharedStyles.btn, active && sharedStyles.btnActive]}
                  onPress={() => setPeriod(mode)}
                >
                  <Text style={[sharedStyles.btnText, active && sharedStyles.btnTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={[styles.loadingContainer, { minHeight: 200 }]}>
          <Text style={sharedStyles.message}>Loading Shopping Days...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={sharedStyles.widgetBg}>
        <View style={sharedStyles.titleRow}>
          <View style={sharedStyles.titleWithIcon}>
            <Icon name="calendar" size={22} color="#7e5cff" style={styles.titleIcon} />
            <Text style={sharedStyles.title}>Shopping days</Text>
          </View>
        </View>
        <View style={[styles.errorContainer, { minHeight: 200 }]}>
          <Text style={[sharedStyles.message, { color: 'red' }]}>{error}</Text>
        </View>
      </View>
    );
  }

  const hasDataForInterval = data && data.data && data.data.length > 0 && data.data.some(item => item.count > 0);

  return (
    <View style={[sharedStyles.widgetBg, { position: 'relative', overflow: 'hidden' }]}>
      <View style={sharedStyles.titleRow}>
        <View style={sharedStyles.titleWithIcon}>
          <Icon name="calendar" size={22} color="#7e5cff" style={styles.titleIcon} />
          <Text style={sharedStyles.title}>Shopping days</Text>
          <HintIcon hintText="This chart shows the number of receipts you have for each day of the week. The statistics are for the last 30 days or all time, depending on the selected interval." />
        </View>
        {hasData && (
          <View style={sharedStyles.selector}>
            {['M', 'All'].map(label => {
              const mode = label === 'M' ? 'month' : 'all';
              const active = period === mode;
              return (
                <Pressable
                  key={label}
                  style={[sharedStyles.btn, active && sharedStyles.btnActive]}
                  onPress={() => setPeriod(mode)}
                >
                  <Text style={[sharedStyles.btnText, active && sharedStyles.btnTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      {!hasData ? (
        <View style={[styles.emptyContainer, { minHeight: 200 }]}>
          <Text style={sharedStyles.message}>No data yet</Text>
        </View>
      ) : !hasDataForInterval ? (
        <View style={[styles.emptyContainer, { minHeight: 200 }]}>
          <Text style={sharedStyles.message}>No data for this interval</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: (sharedStyles.widgetBg.paddingHorizontal || 0),
            flexGrow: 1,
            justifyContent: 'center'
          }}
          keyboardShouldPersistTaps="handled"
        >
          {renderChart()}
        </ScrollView>
      )}
      {userPlan === 'basic' && (
        <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFillObject, {zIndex: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 16, overflow: 'hidden', paddingHorizontal: 24}]}> 
          <View style={{ alignItems: 'center', width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <Icon name="calendar" size={32} color="#7e5cff" style={{ marginRight: 10 }} />
              <Text style={[{ color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 32 }]}>Shopping days</Text>
            </View>
            <Text style={[{ color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8, marginTop: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 20 }]}>Upgrade to Pro to unlock this chart</Text>
            <TouchableOpacity style={{ backgroundColor: '#FFBF00', paddingVertical: 12, paddingHorizontal: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}
              onPress={() => navigation.navigate('ProOnboarding')}
            >
              <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Go Pro</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
   loadingContainer: {
       justifyContent: 'center',
       alignItems: 'center',
       minHeight: 200,
   },
   errorContainer: {
       justifyContent: 'center',
       alignItems: 'center',
       minHeight: 200,
   },
    emptyContainer: {
       justifyContent: 'center',
       alignItems: 'center',
       minHeight: 200,
   },
  chart: {
    marginVertical: 8,
  },
    titleIcon: {
        marginRight: 8,
    }
});

export default ShoppingDaysChart; 