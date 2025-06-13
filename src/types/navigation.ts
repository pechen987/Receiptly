import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Receipt } from '../services/storageService';

export type RootStackParamList = {
  MainTabs: undefined;
  ReceiptDetail: { receiptData: Receipt };
  Auth: undefined;
  ProOnboarding: undefined;
};

export type AppNavigationProps<T extends keyof RootStackParamList> =
  NativeStackNavigationProp<RootStackParamList, T>;

export type ReceiptDetailParam = RootStackParamList['ReceiptDetail'];

// Extend the navigation event map to include our custom event
declare global {
  namespace ReactNavigation {
    interface RootParamList {
      MainTabs: undefined;
      ReceiptDetail: { receiptData: Receipt };
      Auth: undefined;
      ProOnboarding: undefined;
    }
  }
}

declare module '@react-navigation/core' {
  export interface NavigationEventsMap {
    receiptAdded: { target?: string };
  }
}
