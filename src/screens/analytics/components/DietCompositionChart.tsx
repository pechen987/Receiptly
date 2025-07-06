import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { styles as sharedStyles } from '../styles';
import axios from 'axios';
import { API_BASE_URL } from '../utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HintIcon } from './HintComponents';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { Svg, Polyline, Line, G, Text as SvgText, Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useButtonAnimation } from '../../../hooks/useButtonAnimation';
import { Animated } from 'react-native';

interface DietCompositionChartProps {
  userId?: string;
  refreshTrigger?: number;
  userPlan: string;
  selectedStore?: string | null;
  selectedCategory?: string | null;
}

const CHART_HEIGHT = 260;
const CHART_WIDTH = Dimensions.get('window').width - 32;
const COLORS = {
  fruits_veggies: '#27AE60', // Fruits & Veggies (use Fruits color)
  meat: '#C0392B', // Meat & poultry
  seafood: '#2980B9', // Seafood
  snacks: '#E67E22', // Snacks
  dairy: '#F1C40F', // Dairy & eggs
  axis: '#8ca0c6',
  grid: '#232632',
};

const DietCompositionChart: React.FC<DietCompositionChartProps> = ({
  userId,
  refreshTrigger,
  userPlan,
  selectedStore,
  selectedCategory,
}) => {
  const [interval, setInterval] = useState<'month' | '3months' | '6months'>('month');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [hasDataInAnyPeriod, setHasDataInAnyPeriod] = useState(false);
  const navigation = useNavigation();
  const goProButtonAnim = useButtonAnimation().createPressAnimation();

  const checkDataInAnyInterval = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const intervals: ('month' | '3months' | '6months')[] = ['month', '3months', '6months'];
      let found = false;
      for (const intv of intervals) {
        const res = await axios.get(`${API_BASE_URL}/api/analytics/diet-composition`, {
          params: {
            interval: intv,
            store_name: selectedStore,
            store_category: selectedCategory,
          },
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        // Check if data exists AND has meaningful spending data
        if (res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const hasSpendingData = res.data.data.some((item: any) => item.total_spent > 0);
          if (hasSpendingData) {
            found = true;
            break;
          }
        }
      }
      setHasDataInAnyPeriod(found);
    } catch (e: any) {
      setHasDataInAnyPeriod(false);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedStore, selectedCategory]);

  // Fetch data for the selected interval
  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const res = await axios.get(`${API_BASE_URL}/api/analytics/diet-composition`, {
        params: {
          interval,
          store_name: selectedStore,
          store_category: selectedCategory,
        },
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      setData(res.data.data || []);
      setCurrency(res.data.currency || 'USD');
    } catch (e: any) {
      let userMessage = 'Unable to load diet composition.';
      if (axios.isAxiosError(e)) {
        if (!e.response) {
          userMessage = 'No internet connection or the server is not responding.';
        }
      } else if (e.message && e.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      setError(userMessage);
      Alert.alert('Diet Composition', userMessage);
    } finally {
      setLoading(false);
    }
  }, [userId, interval, selectedStore, selectedCategory]);

  // On mount and when filters change, check if any interval has data
  useEffect(() => {
    checkDataInAnyInterval();
  }, [checkDataInAnyInterval, refreshTrigger]);

  // Fetch data for the selected interval
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger, interval, selectedStore, selectedCategory]);

  // Helper: Convert points to a smooth SVG path (cubic Bezier)
  function getSmoothLinePath(points: { x: number; y: number }[]) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      // Control points: halfway between points for smoothness
      const cpx1 = p0.x + (p1.x - p0.x) / 2;
      const cpy1 = p0.y;
      const cpx2 = p0.x + (p1.x - p0.x) / 2;
      const cpy2 = p1.y;
      d += ` C${cpx1},${cpy1} ${cpx2},${cpy2} ${p1.x},${p1.y}`;
    }
    return d;
  }

  // Chart rendering logic
  const renderLineChart = () => {
    if (!data || data.length === 0) return null;
    // X: days, Y: 0-100
    const points = data.length;
    const chartW = CHART_WIDTH;
    const chartH = CHART_HEIGHT;
    const paddingX = 56; // left/right
    const paddingYTop = 16;
    const paddingYBottom = 40;
    const axisY = chartH - paddingYBottom;
    const axisX = paddingX;
    const maxY = 100;
    const minY = 0;
    const stepX = (chartW - 2 * paddingX) / Math.max(points - 1, 1);
    const chartAreaHeight = chartH - paddingYTop - paddingYBottom;

    // Helper: Get all real data points (total_spent > 0) for a key
    const getLinePoints = (
      key: 'fruits_veggies_percent' | 'meat_percent' | 'seafood_percent' | 'snacks_percent' | 'dairy_percent'
    ) => {
      const points: { x: number, y: number }[] = [];
      data.forEach((d, i) => {
        if (d.total_spent > 0) {
          let value = 0;
          if (key === 'fruits_veggies_percent') {
            value = (d.fruits_percent || 0) + (d.vegetables_percent || 0);
          } else {
            value = d[key] || 0;
          }
          const x = axisX + i * stepX;
          const y = axisY - ((value - minY) / (maxY - minY)) * chartAreaHeight;
          points.push({ x, y });
        }
      });
      return points;
    };

    // X labels: show every 5th day for 30 days, every 14th for 3M, every 25th for 6M, do NOT always show first/last
    let xLabels: { x: number, label: string }[] = [];
    if (interval === 'month') {
      xLabels = data.map((d, i) => {
        if (i % 5 === 0) {
          const date = new Date(d.period);
          const label = `${date.getDate()}/${date.getMonth() + 1}`;
          return { x: axisX + i * stepX, label };
        }
        return null;
      }).filter(Boolean) as { x: number, label: string }[];
    } else if (interval === '3months') {
      xLabels = data.map((d, i) => {
        if (i % 14 === 0) {
          const date = new Date(d.period);
          const label = `${date.getDate()}/${date.getMonth() + 1}`;
          return { x: axisX + i * stepX, label };
        }
        return null;
      }).filter(Boolean) as { x: number, label: string }[];
    } else if (interval === '6months') {
      xLabels = data.map((d, i) => {
        if (i % 25 === 0) {
          const date = new Date(d.period);
          const label = `${date.getDate()}/${date.getMonth() + 1}`;
          return { x: axisX + i * stepX, label };
        }
        return null;
      }).filter(Boolean) as { x: number, label: string }[];
    }

    return (
      <Svg width={chartW} height={chartH}>
        {/* Y-axis labels (percentages) - move closer, thinner font, no grid lines */}
        {[0, 25, 50, 75, 100].map((yVal) => {
          const y = axisY - ((yVal - minY) / (maxY - minY)) * chartAreaHeight;
          return (
            <SvgText
              key={yVal}
              x={axisX - 8}
              y={y + 5}
              fontSize={14}
              fontWeight="500"
              fill={COLORS.axis}
              textAnchor="end"
            >
              {yVal}
            </SvgText>
          );
        })}
        {/* X axis */}
        <Line x1={axisX} y1={axisY} x2={chartW - paddingX} y2={axisY} stroke={COLORS.axis} strokeWidth={1.5} />
        {/* Y axis */}
        <Line x1={axisX} y1={paddingYTop} x2={axisX} y2={axisY} stroke={COLORS.axis} strokeWidth={1.5} />
        {/* Fruits & Veggies line */}
        {(() => {
          const points = getLinePoints('fruits_veggies_percent');
          if (points.length === 1) {
            return <Circle cx={points[0].x} cy={points[0].y} r={4} fill={COLORS.fruits_veggies} />;
          } else if (points.length > 1) {
            return <Path d={getSmoothLinePath(points)} fill="none" stroke={COLORS.fruits_veggies} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
          }
          return null;
        })()}
        {/* Meat & poultry line */}
        {(() => {
          const points = getLinePoints('meat_percent');
          if (points.length === 1) {
            return <Circle cx={points[0].x} cy={points[0].y} r={4} fill={COLORS.meat} />;
          } else if (points.length > 1) {
            return <Path d={getSmoothLinePath(points)} fill="none" stroke={COLORS.meat} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
          }
          return null;
        })()}
        {/* Seafood line */}
        {(() => {
          const points = getLinePoints('seafood_percent');
          if (points.length === 1) {
            return <Circle cx={points[0].x} cy={points[0].y} r={4} fill={COLORS.seafood} />;
          } else if (points.length > 1) {
            return <Path d={getSmoothLinePath(points)} fill="none" stroke={COLORS.seafood} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
          }
          return null;
        })()}
        {/* Snacks line */}
        {(() => {
          const points = getLinePoints('snacks_percent');
          if (points.length === 1) {
            return <Circle cx={points[0].x} cy={points[0].y} r={4} fill={COLORS.snacks} />;
          } else if (points.length > 1) {
            return <Path d={getSmoothLinePath(points)} fill="none" stroke={COLORS.snacks} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
          }
          return null;
        })()}
        {/* Dairy & eggs line */}
        {(() => {
          const points = getLinePoints('dairy_percent');
          if (points.length === 1) {
            return <Circle cx={points[0].x} cy={points[0].y} r={4} fill={COLORS.dairy} />;
          } else if (points.length > 1) {
            return <Path d={getSmoothLinePath(points)} fill="none" stroke={COLORS.dairy} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />;
          }
          return null;
        })()}
        {/* X labels (dates) */}
        {xLabels.map((x, i) => (
          <SvgText
            key={i}
            x={x.x}
            y={axisY + 18}
            fontSize={12}
            fontWeight='500'
            fill={COLORS.axis}
            textAnchor="middle"
          >
            {x.label}
          </SvgText>
        ))}
      </Svg>
    );
  };

  // Legend
  const renderLegend = () => (
    <View style={{ width: '100%', paddingHorizontal: 16, marginTop: 8, marginBottom: 8 }}>
      {/* Row 1 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20, marginBottom: 6 }}>
          <View style={{ width: 18, height: 4, backgroundColor: COLORS.fruits_veggies, borderRadius: 2, marginRight: 8 }} />
          <Text style={{ color: '#e6e9f0', fontWeight: '600', fontSize: 14 }}>Fruits & veggies</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20, marginBottom: 6 }}>
          <View style={{ width: 18, height: 4, backgroundColor: COLORS.meat, borderRadius: 2, marginRight: 8 }} />
          <Text style={{ color: '#e6e9f0', fontWeight: '600', fontSize: 14 }}>Meat & poultry</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20, marginBottom: 6 }}>
          <View style={{ width: 18, height: 4, backgroundColor: COLORS.seafood, borderRadius: 2, marginRight: 8 }} />
          <Text style={{ color: '#e6e9f0', fontWeight: '600', fontSize: 14 }}>Seafood</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20, marginBottom: 6 }}>
          <View style={{ width: 18, height: 4, backgroundColor: COLORS.snacks, borderRadius: 2, marginRight: 8 }} />
          <Text style={{ color: '#e6e9f0', fontWeight: '600', fontSize: 14 }}>Snacks</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View style={{ width: 18, height: 4, backgroundColor: COLORS.dairy, borderRadius: 2, marginRight: 8 }} />
          <Text style={{ color: '#e6e9f0', fontWeight: '600', fontSize: 14 }}>Dairy & eggs</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[sharedStyles.widgetBg, { position: 'relative', overflow: 'hidden', minHeight: 120 }]}> 
      <View style={sharedStyles.titleRow}>
        <View style={sharedStyles.titleWithIcon}>
          <Icon name="activity" size={22} color="#7e5cff" style={{ marginRight: 8 }} />
          <Text style={sharedStyles.title}>Diet index (%)</Text>
          <HintIcon hintText="This chart shows the percentage of your spending on different foods over time." />
        </View>
        {hasDataInAnyPeriod && !loading && !error && (
  <View style={sharedStyles.selector}>
    {[
      { label: 'M', value: 'month' },
      { label: '3M', value: '3months' },
      { label: '6M', value: '6months' },
    ].map(({ label, value }) => (
      <Pressable
        key={value}
        style={[sharedStyles.btn, interval === value && sharedStyles.btnActive, { paddingHorizontal: 10 }]}
        onPress={() => setInterval(value as 'month' | '3months' | '6months')}
      >
        <Text style={[sharedStyles.btnText, interval === value && sharedStyles.btnTextActive]}>{label}</Text>
      </Pressable>
    ))}
  </View>
)}
      </View>
      {loading ? (
        <View style={sharedStyles.emptyCompact}>
          <Text style={sharedStyles.message}>Loading diet composition...</Text>
        </View>
      ) : error ? (
        <View style={sharedStyles.emptyCompact}>
          <Text style={[sharedStyles.message, { color: 'red' }]}>{error}</Text>
        </View>
      ) : !hasDataInAnyPeriod ? (
        <View style={sharedStyles.emptyCompact}>
          <Text style={sharedStyles.message}>No data yet</Text>
        </View>
      ) : !data || data.length === 0 ? (
        <View style={sharedStyles.emptyCompact}>
          <Text style={sharedStyles.message}>No data for this interval</Text>
        </View>
      ) : (
        <>
          <View style={{ minHeight: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
            {renderLineChart()}
          </View>
          {renderLegend()}
        </>
      )}
      {userPlan === 'basic' && (
        Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFillObject, {zIndex: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 16, overflow: 'hidden', paddingHorizontal: 24}]}> 
            <View style={{ alignItems: 'center', width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <Icon name="activity" size={32} color="#7e5cff" style={{ marginRight: 10 }} />
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 32 }}>Diet composition</Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8, marginTop: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 20 }}>Upgrade to Pro to unlock this chart</Text>
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
                <Icon name="activity" size={32} color="#7e5cff" style={{ marginRight: 10 }} />
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 32 }}>Diet composition</Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 8, marginTop: 16, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 20 }}>Upgrade to Pro to unlock this chart</Text>
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
};

export default DietCompositionChart;