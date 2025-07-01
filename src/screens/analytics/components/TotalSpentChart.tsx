import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { styles } from '../styles';
import Icon from 'react-native-vector-icons/Feather';
import { memo } from 'react';
import { SpendData } from '../types';
import { fetchSpendData } from '../utils/api';
import { Svg, G, Rect, Text as SvgText } from 'react-native-svg';
import { formatCurrency } from '../utils/currency';
import { baseChartWidth, interpolateColor, formatLabel } from '../utils';
import { HintIcon, HintModal, modalStyles, HintIconProps, HintModalProps } from './HintComponents';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TotalSpentChartProps {
  userId?: string;
  onBarPress: (date: string, amount: number) => void;
  userCurrency: string;
  spendData: SpendData[];
  loading: boolean;
  error: string | null;
  interval: string;
  onIntervalChange: (interval: string) => void;
  refreshTrigger: number;
  selectedStore: string | null;
  selectedCategory: string | null;
}

const TotalSpentChart: React.FC<TotalSpentChartProps> = ({
  userId, 
  onBarPress, 
  userCurrency,
  spendData,
  loading,
  error,
  interval,
  onIntervalChange,
  refreshTrigger,
  selectedStore,
  selectedCategory
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const prevIntervalRef = useRef(interval);

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

  useEffect(() => {
    if (prevIntervalRef.current !== interval) {
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      prevIntervalRef.current = interval;
    }
  }, [interval]);

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
    <View style={styles.widgetBg}>
      <View style={styles.titleRow}>
        <View style={styles.titleWithIcon}>
          <Icon name="credit-card" size={22} color="#7e5cff" style={{ marginRight: 8 }} />
          <Text style={styles.title}>Total spent</Text>
          <HintIcon hintText="This chart shows your total spending over time, grouped by the selected interval (daily, weekly, or monthly). You can click on a bar to see the receipts for that period." />
        </View>
        {chartData.values.length > 0 && (
          <View style={styles.selector}>
            {['D', 'W', 'M'].map(label => {
              const mode = label === 'D' ? 'daily' : label === 'W' ? 'weekly' : 'monthly';
              const active = interval === mode;
              return (
                <Pressable
                  key={label}
                  style={[
                    styles.btn,
                    active && styles.btnActive
                  ]}
                  onPress={() => onIntervalChange(mode)}
                >
                  <Text style={[
                    styles.btnText,
                    active && styles.btnTextActive
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
            <Text style={[styles.message, { color: 'red' }]}>{error}</Text>
          </View>
        ) : chartData.values.length === 0 ? (
          <View style={styles.emptyCompact}>
            <Text style={styles.message}>No data yet</Text>
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