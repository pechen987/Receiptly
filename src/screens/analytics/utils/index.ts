import { Dimensions } from 'react-native';
import { formatCurrency } from './currency';
import { getCategoryColor } from '../../ReceiptDetailScreen';
import apiConfig from '../../../config/api';

export const API_BASE_URL = apiConfig.API_BASE_URL;
export const screenWidth = Dimensions.get('window').width;
export const baseChartWidth = screenWidth - 32;

export const interpolateColor = (value: number, min: number, max: number): string => {
  if (max === min) return '#27AE60'; // all same value: green
  let t = (value - min) / (max - min);
  t = Math.pow(t, 1); // Sharpen curve for more color distinction

  // Green: #27AE60 (39,174,96)
  // Yellow: #FFD600 (255,214,0)
  // Red: #e74c3c (231,76,60)
  let r, g, b;
  if (t < 0.5) {
    // Green to Yellow
    const t2 = t / 0.5;
    r = Math.round(39 + (255 - 39) * t2);
    g = Math.round(174 + (214 - 174) * t2);
    b = Math.round(96 + (0 - 96) * t2);
  } else {
    // Yellow to Red
    const t2 = (t - 0.5) / 0.5;
    r = Math.round(255 + (231 - 255) * t2);
    g = Math.round(214 + (76 - 214) * t2);
    b = Math.round(0 + (60 - 0) * t2);
  }
  return `rgb(${r},${g},${b})`;
};

export const formatLabel = (label: string) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [y, m, d] = label.split('-');
    return `${d}-${monthNames[+m - 1]}`;
  }
  if (/^\d{4}-W\d{2}$/.test(label)) {
    return 'W' + label.split('-W')[1];
  }
  if (/^\d{4}-\d{2}$/.test(label)) {
    return monthNames[+label.split('-')[1] - 1];
  }
  return label;
};

export const getProductColor = (category: string) => {
  return getCategoryColor(category);
};

export const formatTotalInt = (value: number, currency: string) => {
  const rounded = Math.round(value);
  const formatted = formatCurrency(rounded, currency);
  return formatted.replace(/\.?00$/, '');
}; 