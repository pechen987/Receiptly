import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'USD',
  setCurrency: () => {},
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState('USD');

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('currency');
      if (stored) setCurrencyState(stored);
    })();
  }, []);

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency);
    AsyncStorage.setItem('currency', newCurrency);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}; 