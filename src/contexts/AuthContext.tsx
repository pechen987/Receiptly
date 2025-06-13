import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
import axios from 'axios';
import { API_BASE_URL } from '../screens/analytics/utils';

interface User {
  id: number;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  lastLoginTimestamp: number | null;
  initializeFromToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoginTimestamp, setLastLoginTimestamp] = useState<number | null>(null);

  const initializeFromToken = async (token: string) => {
    try {
      console.log('[Auth] initializeFromToken: Start');
      console.log('[Auth] Initializing from token');
      const decoded: any = jwtDecode(token);
      console.log('[Auth] initializeFromToken: jwtDecode successful', decoded);
      console.log('[Auth] Decoded token:', decoded);
      
      const userId = decoded.user_id || decoded.id;
      console.log('[Auth] initializeFromToken: Extracted user ID', userId);
      console.log('[Auth] Extracted user ID:', userId);
      
      if (!userId) {
        console.log('[Auth] initializeFromToken: No user ID found, throwing error.');
        throw new Error('No user ID found in token');
      }
      
      // Fetch user profile
      console.log('[Auth] initializeFromToken: Fetching user profile...');
      console.log('[Auth] Fetching user profile for ID:', userId);
      let response;
      try {
        response = await axios.get(`${API_BASE_URL}/api/user/profile`, {
          params: { user_id: userId },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error: any) {
        if (
          axios.isAxiosError(error) &&
          error.response &&
          (error.response.status === 404 || error.response.status === 401 || error.response.status === 403 || error.response.status === 500)
        ) {
          // User not found or unauthorized/expired: treat as logged out, clear token and user, do not throw
          console.warn('[Auth] initializeFromToken: User not found or unauthorized/expired. Clearing token and user state.');
          setUser(null);
          setLastLoginTimestamp(null);
          await AsyncStorage.removeItem('jwt_token');
          return;
        } else {
          // Other errors: throw
          throw error;
        }
      }
      console.log('[Auth] initializeFromToken: Profile response received', response.status);
      console.log('[Auth] Profile response:', response.data);
      
      console.log('[Auth] initializeFromToken: Setting user state...');
      setUser({
        id: userId,
        email: response.data.email,
      });
      console.log('[Auth] initializeFromToken: Setting lastLoginTimestamp...');
      setLastLoginTimestamp(Date.now());
      console.log('[Auth] initializeFromToken: User initialized successfully.');
      console.log('[Auth] User initialized successfully from token');
      console.log('[Auth] initializeFromToken: End (Success)');
    } catch (error) {
      // On any error, treat as logged out (clear token, user, etc.)
      console.log('[Auth] initializeFromToken: Error occurred', error);
      console.error('[Auth] Error initializing from token:', error);
      setUser(null);
      setLastLoginTimestamp(null);
      await AsyncStorage.removeItem('jwt_token');
      console.log('[Auth] initializeFromToken: End (Error, user logged out)');
      // Do not throw error, just return
      return;
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      console.log('[Auth] loadUser: Start');
      console.log('[Auth] Attempting to load token from storage...');
      console.log('[Auth] loadUser: Calling AsyncStorage.getItem...');
      const token = await AsyncStorage.getItem('jwt_token');
      console.log('[Auth] loadUser: AsyncStorage.getItem returned.');
      console.log('[Auth] Result of AsyncStorage.getItem:', token ? 'Token found' : 'Token not found');
      
      if (token) {
        console.log('[Auth] loadUser: Token found. Calling initializeFromToken...');
        console.log('[Auth] Token found, initializing user...');
        await initializeFromToken(token);
        console.log('[Auth] User initialized from loaded token.');
        console.log('[Auth] loadUser: initializeFromToken finished.');
      } else {
        console.log('[Auth] loadUser: No token found.');
        console.log('[Auth] No token found in storage.');
      }
    } catch (error) {
      console.log('[Auth] loadUser: Error occurred', error);
      console.error('[Auth] Error loading user or token from storage:', error);
    } finally {
      console.log('[Auth] loadUser: Finally block. Setting loading to false.');
      setLoading(false);
      console.log('[Auth] Loading finished.');
      console.log('[Auth] loadUser: End');
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[Auth] signIn: Start');
      console.log('[Auth] Attempting login for:', email);
      console.log('[Auth] signIn: Making POST request to login endpoint...');
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
      });
      console.log('[Auth] signIn: Login response received', response.status);
      console.log('[Auth] Login response received');
      
      const token = response.data.token;
      console.log('[Auth] signIn: Token extracted from response', token ? 'exists' : 'not found');
      console.log('[Auth] Token received:', token ? 'exists' : 'not found');
      
      console.log('[Auth] signIn: Calling AsyncStorage.setItem...');
      await AsyncStorage.setItem('jwt_token', token);
      console.log('[Auth] Token saved to storage');
      console.log('[Auth] signIn: AsyncStorage.setItem finished.');
      
      // Verification: Check if token is immediately retrievable after setting
      console.log('[Auth] signIn: Verifying immediate AsyncStorage retrieval...');
      const storedTokenCheck = await AsyncStorage.getItem('jwt_token');
      console.log('[Auth] signIn: Verification Result:', storedTokenCheck ? 'Found' : 'Not Found', storedTokenCheck ? 'Length: ' + storedTokenCheck.length : '');

      console.log('[Auth] signIn: About to call initializeFromToken...');
      await initializeFromToken(token);
      console.log('[Auth] signIn: initializeFromToken call finished.');
      console.log('[Auth] signIn: initializeFromToken finished.');
      console.log('[Auth] Login completed successfully');
      console.log('[Auth] signIn: End (Success)');
    } catch (error) {
      console.log('[Auth] signIn: Error occurred', error);
      console.error('[Auth] Error signing in:', error);
      console.log('[Auth] signIn: End (Error)');
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    console.log('[Auth] signUp: Start');
    try {
      console.log('[Auth] signUp: Making POST request to register endpoint...');
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        email,
        password,
        name
      });
      console.log('[Auth] signUp: Registration response received', response.status);
      // After registration, sign in the user
      console.log('[Auth] signUp: Calling signIn after registration...');
      await signIn(email, password);
      console.log('[Auth] signUp: signIn finished after registration.');
      console.log('[Auth] signUp: End (Success)');
    } catch (error) {
      console.log('[Auth] signUp: Error occurred', error);
      console.error('[Auth] Error signing up:', error);
      console.log('[Auth] signUp: End (Error)');
      throw error;
    }
  };

  const signOut = async () => {
    console.log('[Auth] signOut: Start');
    setUser(null);
    setLastLoginTimestamp(null);
    console.log('[Auth] signOut: Calling AsyncStorage.removeItem...');
    await AsyncStorage.removeItem('jwt_token');
    console.log('[Auth] signOut: AsyncStorage.removeItem finished.');
    console.log('[Auth] signOut: End');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, lastLoginTimestamp, initializeFromToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 