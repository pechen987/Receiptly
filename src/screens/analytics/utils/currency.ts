// Currency symbols mapping
export const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  RUB: '₽',
  UAH: '₴',
  PLN: 'zł',
  CZK: 'Kč',
  CHF: 'Fr',
  CAD: '$',
  AUD: '$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  HUF: 'Ft',
  SGD: '$',
  HKD: '$',
  INR: '₹',
  DEFAULT: ''
};

/**
 * Get the currency symbol for a given currency code
 * @param code - The currency code (e.g., 'USD', 'EUR')
 * @returns The currency symbol or the code itself if not found
 */
export function getCurrencySymbol(code?: string | null): string {
  if (!code) return currencySymbols.DEFAULT;
  return currencySymbols[code.toUpperCase()] || code;
}

/**
 * Format a monetary value with the appropriate currency symbol
 * @param amount - The amount to format
 * @param currencyCode - The currency code (e.g., 'USD', 'EUR')
 * @param decimalPlaces - Number of decimal places to show (default: 2)
 * @returns Formatted currency string (e.g., "$10.50")
 */
export function formatCurrency(
  amount: number | undefined | null,
  currencyCode?: string | null,
  decimalPlaces: number = 2
): string {
  if (amount === null || amount === undefined) return '';
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toFixed(decimalPlaces)}`;
} 