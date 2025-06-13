import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import { Alert } from 'react-native';

type WidgetOrderContextType = {
  widgetOrder: string[];
  updateWidgetOrder: (newOrder: string[]) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

const WidgetOrderContext = createContext<WidgetOrderContextType | undefined>(undefined);

export const useWidgetOrder = () => {
  const context = useContext(WidgetOrderContext);
  if (!context) {
    throw new Error('useWidgetOrder must be used within a WidgetOrderProvider');
  }
  return context;
};

export const WidgetOrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWidgetOrder = useCallback(async () => {
    try {
      const response = await api.get('/api/analytics/widget-order');
      if (response.data && response.data.order) {
        setWidgetOrder(response.data.order);
      }
    } catch (err) {
      console.error('Error fetching widget order:', err);
      let userMessage = 'Failed to load widget order.';
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      setError(userMessage);
      Alert.alert('Widget Order', userMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateWidgetOrder = useCallback(async (newOrder: string[]) => {
    // Optimistically update the UI
    setWidgetOrder(newOrder);
    
    try {
      // Make the API call in the background
      await api.post('/api/analytics/widget-order', { order: newOrder });
    } catch (err) {
      console.error('Error updating widget order:', err);
      let userMessage = 'Failed to save widget order.';
      if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message.toLowerCase().includes('network')) {
        userMessage = 'No internet connection. Please check your connection and try again.';
      }
      await fetchWidgetOrder();
      setError(userMessage);
      Alert.alert('Widget Order', userMessage);
    }
  }, [fetchWidgetOrder]);

  useEffect(() => {
    fetchWidgetOrder();
  }, [fetchWidgetOrder]);

  return (
    <WidgetOrderContext.Provider
      value={{
        widgetOrder,
        updateWidgetOrder,
        isLoading,
        error,
      }}
    >
      {children}
    </WidgetOrderContext.Provider>
  );
}; 