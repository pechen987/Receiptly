import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HistoryScreen from './src/screens/HistoryScreen';
import { CurrencyProvider } from './src/screens/analytics/contexts/CurrencyContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ReceiptProvider } from './src/contexts/ReceiptContext';
import ReceiptDetailScreen from './src/screens/ReceiptDetailScreen';
import AnalyticsScreen from './src/screens/analytics';
import ProfileScreen from './src/screens/ProfileScreen';
import AuthScreen from './src/screens/AuthScreen';
import apiConfig from './src/config/api';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ProOnboardingScreen from './src/screens/ProOnboardingScreen';
import CustomPaymentScreen from './src/screens/CustomPaymentScreen';
import { StripeProvider } from '@stripe/stripe-react-native';
import axios from 'axios';

// Define screen params
type RootStackParamList = {
  MainTabs: undefined;
  ReceiptDetail: { receipt: any };
  Auth: undefined;
  Onboarding: undefined;
  ProOnboarding: undefined;
  CustomPayment: { plan: 'monthly' | 'yearly' };
};

type TabParamList = {
  'My Receipts': undefined;
  Analytics: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// 🔧 Moved out of App to avoid redefinition on each render
function MainTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <CurrencyProvider>
      <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#16191f',
          borderTopColor: '#2d3748',
        },
        tabBarActiveTintColor: '#7e5cff',
        tabBarInactiveTintColor: '#a0aec0',
      }}
    >
      <Tab.Screen
        name="My Receipts"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      >
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
    </CurrencyProvider>
  );
}

function AppContent() {
  const { user, loading, signOut, completeOnboarding } = useAuth();
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  React.useEffect(() => {
    if (user && !user.has_completed_onboarding) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [user]);

  const handleOnboardingComplete = async (answers?: { goals: string[]; features: string[] }) => {
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      if (token) {
        await axios.post(
          `${apiConfig.API_BASE_URL}/api/user/profile/complete-onboarding`,
          answers ? { goals: answers.goals, features: answers.features } : {},
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        completeOnboarding(); // Update state in AuthContext
        setShowOnboarding(false);
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Optionally show an error to the user
    }
  };

  if (loading) {
    return null; // Or a loading spinner
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="MainTabs">
            {() => <MainTabs onLogout={signOut} />}
          </Stack.Screen>
          <Stack.Screen
            name="ReceiptDetail"
            component={ReceiptDetailScreen}
            options={{ title: 'Receipt Details' }}
          />
          <Stack.Screen
            name="ProOnboarding"
            component={ProOnboardingScreen}
            options={{ title: 'Go Pro' }}
          />
          <Stack.Screen
            name="CustomPayment"
            component={CustomPaymentScreen}
            options={{ title: 'Payment' }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth">
          {() => <AuthScreen />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const API_BASE_URL = apiConfig.API_BASE_URL;
  const STRIPE_PUBLISHABLE_KEY = 'pk_test_51RWzlWE9IYgVm0lSsdUPhjeqbjHZHatzyp8Wv2XouCBqJjOwCeg2R9fcfKqW2iP2Do6fFCoGmgb4vphnwzg2UhOb00T9X1yffI';
  // pk_live_51NqPP9CmfcezbXmU2SIYleIJ46oP1iS4K6AohfCekW0svZMZLPGexZ2U27c9aFmtYCzYYpjj5X4uTjJcSZib0TCv00iCWKnFJN

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={styles.container}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <AuthProvider>
          <CurrencyProvider>
            <ReceiptProvider>
              <NavigationContainer>
                <AppContent />
              </NavigationContainer>
            </ReceiptProvider>
          </CurrencyProvider>
        </AuthProvider>
      </StripeProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
