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
  userId?: string;
  refreshTrigger?: number;
  userCurrency?: string;
  userPlan: string;
  selectedStore?: string | null;
  selectedCategory?: string | null;
}

export interface TotalSpentChartProps extends ChartProps {
  onBarPress: (date: string, amount: number) => void;
  spendData: SpendData[];
  loading: boolean;
  error: string | null;
  interval: string;
  onIntervalChange: (interval: string) => void;
}

export interface TopProductsChartProps extends ChartProps {}

export interface MostExpensiveProductsChartProps extends ChartProps {}

export interface ExpensesByCategoryChartProps extends ChartProps {}

export interface ShoppingDaysChartProps extends ChartProps {}

export interface BillStatsChartProps extends ChartProps {}

export interface ShoppingDay {
  day: string;
  count: number;
}

export interface ShoppingDaysData {
  period: string;
  data: ShoppingDay[];
} 