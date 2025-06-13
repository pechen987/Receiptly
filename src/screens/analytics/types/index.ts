export interface Receipt {
  id: string;
  date: string;
  store_name: string;
  total: number;
  currency?: string;
}

export interface TopProduct {
  name: string;
  count: number;
  percentage: number;
  category: string;
}

export interface ExpensiveProduct {
  name: string;
  price: number;
  count: number;
  category: string;
}

export interface CategoryData {
  category: string;
  total: number;
}

export interface MonthData {
  month: string;
  total: number;
}

export interface SpendData {
  period: string;
  total_spent: number;
}

export interface ChartProps {
  userId: string | undefined;
  refreshTrigger: number;
  userCurrency?: string;
  navigation?: any;
}

export interface TotalSpentChartProps extends ChartProps {
  onBarPress: (date: string) => void;
  spendData: SpendData[];
  loading: boolean;
  error: string | null;
  interval: 'daily' | 'weekly' | 'monthly';
  onIntervalChange: (interval: 'daily' | 'weekly' | 'monthly') => void;
}

export interface ShoppingDay {
  day: string;
  count: number;
}

export interface ShoppingDaysData {
  period: string;
  data: ShoppingDay[];
} 