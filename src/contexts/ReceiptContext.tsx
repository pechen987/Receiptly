import React, { createContext, useContext, useState, useCallback } from 'react';

interface ReceiptContextType {
  refreshTrigger: number;
  triggerRefresh: () => void;
  setRefreshTrigger: (value: number) => void;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export const ReceiptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <ReceiptContext.Provider value={{ refreshTrigger, triggerRefresh, setRefreshTrigger }}>
      {children}
    </ReceiptContext.Provider>
  );
};

export const useReceipt = () => {
  const context = useContext(ReceiptContext);
  if (context === undefined) {
    throw new Error('useReceipt must be used within a ReceiptProvider');
  }
  return context;
}; 