import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from 'jwt-decode';
import axios from 'axios';
import apiConfig from '../config/api';

interface User {
  id: number;
  email: string;
  name?: string;
  has_completed_onboarding: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  lastLoginTimestamp: number | null;
  initializeFromToken: (token: string) => Promise<void>;
  planRefreshTrigger: number;
  triggerPlanRefresh: () => void;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoginTimestamp, setLastLoginTimestamp] = useState<number | null>(null);
  const [planRefreshTrigger, setPlanRefreshTrigger] = useState(0);

  const triggerPlanRefresh = useCallback(() => {
    setPlanRefreshTrigger(prev => prev + 1);
  }, []);

  const completeOnboarding = () => {
    if (user) {
      setUser({ ...user, has_completed_onboarding: true });
    }
  };

  const initializeFromToken = async (token: string) => {
    try {
      const decoded: any = jwtDecode(token);
      const userId = decoded.user_id || decoded.id;
      
      if (!userId) {
        throw new Error('No user ID found in token');
      }
      
      // Fetch user profile
      let response;
      try {
        response = await axios.get(`${apiConfig.API_BASE_URL}/api/user/profile`, {
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
          setUser(null);
          setLastLoginTimestamp(null);
          await AsyncStorage.removeItem('jwt_token');
          return;
        } else {
          // Other errors: throw
          throw error;
        }
      }
      
      setUser({
        id: userId,
        email: response.data.email,
        has_completed_onboarding: response.data.has_completed_onboarding,
      });
      setLastLoginTimestamp(Date.now());
    } catch (error) {
      // On any error, treat as logged out (clear token, user, etc.)
      setUser(null);
      setLastLoginTimestamp(null);
      await AsyncStorage.removeItem('jwt_token');
      // Do not throw error, just return
      return;
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      
      if (token) {
        await initializeFromToken(token);
      }
    } catch (error) {
      console.error('Error loading user or token from storage:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${apiConfig.API_BASE_URL}/api/auth/login`, {
        email,
        password
      });
      
      const token = response.data.token;
      await AsyncStorage.setItem('jwt_token', token);
      await initializeFromToken(token);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        // Log detailed error for debugging, but throw a more user-friendly error.
        console.error('Failed login attempt - Status:', error.response.status, 'Data:', error.response.data);
        const message = error.response.data?.message || 'Invalid credentials';
        throw new Error(message);
      } else {
        // Handle non-Axios errors or network issues
        console.error('Error signing in:', error);
        throw new Error('A network error occurred. Please try again.');
      }
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const response = await axios.post(`${apiConfig.API_BASE_URL}/api/auth/register`, {
        email,
        password,
        name
      });
      // After registration, sign in the user
      await signIn(email, password);
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signOut = async () => {
    setUser(null);
    setLastLoginTimestamp(null);
    await AsyncStorage.removeItem('jwt_token');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signUp, 
      signOut, 
      lastLoginTimestamp, 
      initializeFromToken,
      planRefreshTrigger,
      triggerPlanRefresh,
      completeOnboarding
    }}>
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