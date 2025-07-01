import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Animated, Easing, Modal, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import apiConfig from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useButtonAnimation } from '../hooks/useButtonAnimation';

const API_BASE_URL = apiConfig.API_BASE_URL;

const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mode, setMode] = useState('register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [checkingVerification, setCheckingVerification] = useState(false);
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [pendingVerification, setPendingVerification] = useState({
    email: '',
    password: '',
    isActive: false
  });

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  const { signIn, initializeFromToken } = useAuth();
  const { createPressAnimation } = useButtonAnimation();
  
  // Create animation instance for the auth button
  const authButtonAnim = createPressAnimation();
  
  // Create animation instances for the tab buttons
  const loginTabAnim = createPressAnimation();
  const registerTabAnim = createPressAnimation();
  
  // Create animation instance for the reset email button
  const resetEmailButtonAnim = createPressAnimation();

  // Create animation instance for the 'Got It' button in the confirmation modal
  const gotItButtonAnim = createPressAnimation();

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const checkVerificationStatus = async () => {
    if (!pendingVerification.email || checkingVerification || !pendingVerification.password) {
      console.log('Skipping verification check - missing required data');
      return;
    }
    
    try {
      console.log('Attempting login for:', pendingVerification.email);
      setCheckingVerification(true);
      const loginRes = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: pendingVerification.email, 
          password: pendingVerification.password 
        }),
      });
      
      let loginData;
      try {
        loginData = await loginRes.json();
        console.log('Login response:', loginRes.status, loginData);
      } catch (e) {
        console.error('Failed to parse login response:', e);
        throw new Error('Invalid response from server');
      }
      
      if (loginRes.ok && loginData.token) {
        console.log('Login successful, stopping polling');
        try {
          await AsyncStorage.setItem('jwt_token', loginData.token);
          console.log('Token saved to AsyncStorage after polling login');
        } catch (storageErr) {
          console.error('Failed to save token to AsyncStorage:', storageErr);
        }
        if (checkInterval.current) {
          clearInterval(checkInterval.current);
          checkInterval.current = null;
        }
        
        await initializeFromToken(loginData.token);
        
      } else if (loginRes.status === 403 && loginData.message === 'Please verify your email before logging in') {
        console.log('Email not verified yet, continuing to poll...');
      } else {
        console.log('Login attempt failed with status:', loginRes.status, 'Message:', loginData.message || 'No message');
        if (loginRes.status === 401) {
          console.log('Invalid credentials, stopping polling');
          if (checkInterval.current) {
            clearInterval(checkInterval.current);
            checkInterval.current = null;
          }
          setError('Invalid credentials. Please try again.');
          setShowConfirmationModal(false);
        }
      }
    } catch (error) {
      console.error('Verification check failed:', error);
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleOpenURL = (event: { url?: string; launchURL?: string }) => {
    const url = event.url || event.launchURL;
    if (url && url.includes('/api/auth/confirm-email')) {
      const token = url.split('token=')[1];
      if (token) {
        (async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/auth/confirm-email?token=${token}`);
            const data = await res.json();
            
            if (checkInterval.current) {
              clearInterval(checkInterval.current);
              checkInterval.current = null;
            }
            if (pendingVerification.email && pendingVerification.password) {
               console.log('Email confirmed via deep link. Attempting to sign in with pending credentials.');
               await signIn(pendingVerification.email, pendingVerification.password);
               setPendingVerification({ email: '', password: '', isActive: false });
            } else {
                console.log('Email confirmed via deep link, but no pending credentials found. User will need to log in manually.');
            }

          } catch (error) {
            console.error('Email confirmation failed:', error);
          }
        })();
      }
    }
  };

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => handleOpenURL({ url }));

    Linking.getInitialURL().then(url => {
      if (url) handleOpenURL({ url });
    });

    if (pendingVerification.email && pendingVerification.password) {
      console.log('Starting verification polling for:', pendingVerification.email);
      checkVerificationStatus();
      checkInterval.current = setInterval(checkVerificationStatus, 3000);

      timeoutRef.current = setTimeout(() => {
        console.log('Verification polling timed out after 10 minutes');
        if (checkInterval.current) {
          clearInterval(checkInterval.current);
          checkInterval.current = null;
        }
        setShowConfirmationModal(false);
        setPendingVerification(prev => ({ ...prev, isActive: false }));
      }, 10 * 60 * 1000);
    }
      
    return () => {
      console.log('Cleaning up verification polling');
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
        checkInterval.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [pendingVerification]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAuth = async () => {
    setEmailError('');
    setPasswordError('');
    setError('');
    
    if (mode === 'register') {
      if (!email) {
        setEmailError('Email is required.');
        return;
      }
      if (!isValidEmail(email)) {
        setEmailError('Please enter a valid email address.');
        return;
      }
      if (!password) {
        setPasswordError('Password is required.');
        return;
      }
      if (!confirmPassword) {
        setPasswordError('Please confirm your password.');
        return;
      }
      if (password !== confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setPasswordError('Password must be at least 6 characters.');
        return;
      }
    }
    
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
        setError('');
      } else {
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      
        let data;
        try {
          data = await res.json();
          console.log('Auth response:', res.status, data);
        } catch (e) {
          console.error('Failed to parse auth response:', e);
          throw new Error('Invalid response from server');
        }
      
        if (res.ok) {
          setError('');
          console.log('Registration successful, showing confirmation modal for:', email);
          setPendingVerification({
            email,
            password,
            isActive: true
          });
          setPendingEmail(email);
          setShowConfirmationModal(true);
        } else {
            const error = new Error(data.message || 'Registration failed');
            throw error;
        }
      }
    } catch (e: any) {
      const isLogin = mode === 'login';
      let errorMessage = 'An unexpected error occurred.';

      if (e.response && e.response.data && e.response.data.message) {
        errorMessage = e.response.data.message;
      } else if (e.message) {
        errorMessage = e.message;
      } else {
        console.error('An unexpected error object was caught:', e);
      }
      
      const logMessage = isLogin ? 'Login' : 'Registration';
      console.log(`${logMessage} attempt failed: ${errorMessage}`);

      if (!isLogin && errorMessage.toLowerCase().includes('email')) {
        setEmailError(errorMessage);
      } else if (errorMessage.toLowerCase().includes('password')) {
        setPasswordError(errorMessage);
      } else if (isLogin && (errorMessage.toLowerCase().includes('invalid credentials') || errorMessage.toLowerCase().includes('invalid email or password'))) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async () => {
    setResetStatus('');
    setResetLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      if (res.ok) {
        setResetStatus('success');
      } else {
        setResetStatus('error');
      }
    } catch (e) {
      setResetStatus('error');
    } finally {
      setResetLoading(false);
    }
  };

  // Fixed email validation with better autofill handling
  const handleEmailBlur = () => {
    if (mode === 'register') {
      setEmailTouched(true);
      // Longer delay to allow autofill to complete properly
      setTimeout(() => {
        const currentEmail = email.trim();
        if (!currentEmail) {
          setEmailError('Email is required.');
        } else if (!isValidEmail(currentEmail)) {
          setEmailError('Please enter a valid email address.');
        } else {
          setEmailError('');
        }
      }, 300);
    }
  };

  // Handle email change with autofill consideration
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (mode === 'register') {
      // Clear email error when user starts typing
      if (emailError) {
        setEmailError('');
      }
    }
  };

  // Handle password change
  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError) {
      setPasswordError('');
    }
  };

  // Handle confirm password change
  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (text.length > 0) {
      setConfirmPasswordTouched(true);
    }
    if (passwordError) {
      setPasswordError('');
    }
  };

  // Check if passwords match for display
  const passwordsMatch = password === confirmPassword;
  const shouldShowPasswordMismatch = mode === 'register' && 
    confirmPasswordFocused && 
    confirmPassword.length > 0 && 
    password.length > 0 && 
    !passwordsMatch;

  // Debug logging
  if (mode === 'register' && password.length > 0) {
    console.log('Password mismatch debug:', {
      mode,
      confirmPasswordFocused,
      confirmPasswordLength: confirmPassword.length,
      passwordLength: password.length,
      passwordsMatch,
      shouldShowPasswordMismatch
    });
  }

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: '#16191f' }}
      contentContainerStyle={{ flexGrow: 1 }}
      enableOnAndroid={true}
      extraScrollHeight={128}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.bg}>
          <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <Ionicons name="receipt-outline" size={48} color="#7e5cff" style={{ marginBottom: 12 }} />
            <Text style={styles.title}>Receiptly</Text>
            <Text style={styles.subtitle}>
              {mode === 'login' ? 'Welcome back! Please sign in.' : 'Create a new account.'}
            </Text>
  
            <View style={styles.formCard}>
              <View style={styles.tabContainer}>
                <Animated.View
                  style={[
                    styles.tabButtonContainer,
                    {
                      transform: [{ scale: loginTabAnim.scaleAnim }],
                    }
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.tabButtonShadow,
                      {
                        shadowOpacity: loginTabAnim.shadowOpacityAnim,
                        elevation: loginTabAnim.elevationAnim,
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.tab, mode === 'login' && styles.activeTab]}
                      onPress={() => {
                        setMode('login');
                        setError('');
                        setEmailError('');
                        setPasswordError('');
                        setConfirmPasswordTouched(false);
                      }}
                      onPressIn={loginTabAnim.handlePressIn}
                      onPressOut={loginTabAnim.handlePressOut}
                      activeOpacity={1}
                    >
                      <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>Login</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.tabButtonContainer,
                    {
                      transform: [{ scale: registerTabAnim.scaleAnim }],
                    }
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.tabButtonShadow,
                      {
                        shadowOpacity: registerTabAnim.shadowOpacityAnim,
                        elevation: registerTabAnim.elevationAnim,
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.tab, mode === 'register' && styles.activeTab]}
                      onPress={() => {
                        setMode('register');
                        setError('');
                        setEmailError('');
                        setPasswordError('');
                        setConfirmPasswordTouched(false);
                      }}
                      onPressIn={registerTabAnim.handlePressIn}
                      onPressOut={registerTabAnim.handlePressOut}
                      activeOpacity={1}
                    >
                      <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>Register</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              </View>
  
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputNoAutofill]}
                  placeholder="Email"
                  placeholderTextColor="#888"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={handleEmailChange}
                  onBlur={handleEmailBlur}
                  editable={!loading}
                  returnKeyType="next"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              </View>
              {mode === 'register' && emailError && (emailTouched || emailError) ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={18} color="#ff4a4a" style={{ marginRight: 6 }} />
                  <Text style={styles.error}>{emailError}</Text>
                </View>
              ) : null}
  
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputNoAutofill]}
                  placeholder="Password"
                  placeholderTextColor="#888"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={handlePasswordChange}
                  editable={!loading}
                  textContentType="password"
                  autoComplete="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#888" />
                </TouchableOpacity>
              </View>

              {mode === 'register' && (
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputNoAutofill]}
                    placeholder="Confirm Password"
                    placeholderTextColor="#888"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    onFocus={() => setConfirmPasswordFocused(true)}
                    onBlur={() => setConfirmPasswordFocused(false)}
                    editable={!loading}
                    textContentType="newPassword"
                    autoComplete="new-password"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={styles.eyeIcon}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#888" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Show password error only once, below confirm password field */}
              {mode === 'register' && passwordError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={18} color="#ff4a4a" style={{ marginRight: 6 }} />
                  <Text style={styles.error}>{passwordError}</Text>
                </View>
              ) : null}

              {/* Show password mismatch only once, below confirm password field */}
              {shouldShowPasswordMismatch ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={18} color="#ff4a4a" style={{ marginRight: 6 }} />
                  <Text style={styles.error}>Passwords do not match</Text>
                </View>
              ) : null}

              {/* General error messages */}
              {!!error && (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={18} color="#ff4a4a" style={{ marginRight: 6 }} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              )}

              <Animated.View
                style={[
                  styles.buttonContainer,
                  {
                    transform: [{ scale: authButtonAnim.scaleAnim }],
                  }
                ]}
              >
                <Animated.View
                  style={[
                    styles.buttonShadow,
                    {
                      shadowOpacity: authButtonAnim.shadowOpacityAnim,
                      elevation: authButtonAnim.elevationAnim,
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.button,
                      (loading || (mode === 'register' && (!email || !isValidEmail(email) || !password || !confirmPassword)) || (mode === 'login' && (!email || !password))) && styles.buttonDisabled,
                    ]}
                    onPress={handleAuth}
                    onPressIn={authButtonAnim.handlePressIn}
                    onPressOut={authButtonAnim.handlePressOut}
                    disabled={
                      loading ||
                      (mode === 'register' && (!email || !isValidEmail(email) || !password || !confirmPassword)) ||
                      (mode === 'login' && (!email || !password))
                    }
                    activeOpacity={1}
                  >
                    {loading ? (
                      <Ionicons name="reload" size={20} color="#fff" style={{ marginRight: 6, transform: [{ rotate: '90deg' }] }} />
                    ) : (
                      <Ionicons
                        name={mode === 'login' ? 'log-in-outline' : 'person-add-outline'}
                        size={20}
                        color="#fff"
                        style={{ marginRight: 6 }}
                      />
                    )}
                    <Text style={styles.buttonText}>
                      {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>

              {mode === 'login' && (
                <TouchableOpacity onPress={() => { setShowResetModal(true); setResetEmail(''); setResetStatus(''); }} style={{ alignSelf: 'center', marginTop: 8, marginBottom: 2 }}>
                  <Text style={{ color: '#7e5cff', fontWeight: '600', fontSize: 15 }}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
            </View>
  
            <Modal
              animationType="fade"
              transparent={true}
              visible={showConfirmationModal && pendingVerification.isActive}
              onRequestClose={() => setShowConfirmationModal(false)}
              statusBarTranslucent={true}
            >
              <View style={styles.modalOverlay}>
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.keyboardAvoidingView}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                >
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Ionicons name="mail-open-outline" size={42} color="#7e5cff" />
                      <Text style={styles.modalTitle}>Check your email</Text>
                    </View>
                    <Text style={styles.modalText}>
                      We've sent a confirmation email to:
                    </Text>
                    <Text style={styles.emailText} numberOfLines={1} ellipsizeMode="tail">
                      {pendingEmail}
                    </Text>
                    <Text style={[styles.modalText, { marginBottom: 8 }]}>
                      Please check your inbox and click the confirmation link to verify your email address.
                    </Text>
                    <View style={styles.modalButtons}>
                      <Animated.View
                        style={[
                          styles.modalButtonContainer,
                          {
                            transform: [{ scale: gotItButtonAnim.scaleAnim }],
                          },
                        ]}
                      >
                        <Animated.View
                          style={[
                            styles.modalButtonShadow,
                            {
                              shadowOpacity: gotItButtonAnim.shadowOpacityAnim,
                              elevation: gotItButtonAnim.elevationAnim,
                            },
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => {
                              setShowConfirmationModal(false);
                              setPendingVerification(prev => ({ ...prev, isActive: false }));
                            }}
                            onPressIn={gotItButtonAnim.handlePressIn}
                            onPressOut={gotItButtonAnim.handlePressOut}
                            activeOpacity={1}
                          >
                            <Text style={styles.primaryButtonText}>Got it!</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      </Animated.View>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </View>
            </Modal>

            <Modal
              animationType="fade"
              transparent={true}
              visible={showResetModal}
              onRequestClose={() => setShowResetModal(false)}
              statusBarTranslucent={true}
            >
              <TouchableWithoutFeedback onPress={() => setShowResetModal(false)}>
                <View style={styles.modalOverlay}>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoidingView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                  >
                    <TouchableWithoutFeedback onPress={() => {}}>
                      <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                          <Ionicons name="key-outline" size={42} color="#7e5cff" />
                          <Text style={styles.modalTitle}>Reset Password</Text>
                        </View>
                        <Text style={styles.modalText}>
                          Enter your email address and we'll send you a link to reset your password.
                        </Text>
                        <View style={styles.inputWrapper}>
                          <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                          <TextInput
                            style={[styles.input, styles.inputNoAutofill]}
                            placeholder="Email"
                            placeholderTextColor="#888"
                            autoCapitalize="none"
                            value={resetEmail}
                            onChangeText={setResetEmail}
                            editable={!resetLoading && resetStatus !== 'success'}
                            keyboardType="email-address"
                          />
                        </View>
                        {resetStatus === 'success' && (
                          <Text style={{ color: '#4caf50', textAlign: 'center', marginBottom: 12 }}>
                            If this email is registered, a reset link has been sent.
                          </Text>
                        )}
                        {resetStatus === 'error' && (
                          <Text style={{ color: '#ff4a4a', textAlign: 'center', marginBottom: 12 }}>
                            Failed to send reset email. Please try again.
                          </Text>
                        )}
                        <View style={styles.modalButtons}>
                          <Animated.View
                            style={[
                              styles.modalButtonContainer,
                              {
                                transform: [{ scale: resetEmailButtonAnim.scaleAnim }],
                              }
                            ]}
                          >
                            <Animated.View
                              style={[
                                styles.modalButtonShadow,
                                {
                                  shadowOpacity: resetEmailButtonAnim.shadowOpacityAnim,
                                  elevation: resetEmailButtonAnim.elevationAnim,
                                }
                              ]}
                            >
                              <TouchableOpacity
                                style={[
                                  styles.modalButton, 
                                  (resetLoading || resetStatus === 'success' || !resetEmail.trim()) && styles.buttonDisabled
                                ]}
                                onPress={handleSendReset}
                                onPressIn={resetEmailButtonAnim.handlePressIn}
                                onPressOut={resetEmailButtonAnim.handlePressOut}
                                disabled={resetLoading || !resetEmail.trim() || resetStatus === 'success'}
                                activeOpacity={1}
                              >
                                <Text style={styles.primaryButtonText}>
                                  {resetLoading ? 'Sending...' : 'Send Reset Email'}
                                </Text>
                              </TouchableOpacity>
                            </Animated.View>
                          </Animated.View>
                          <TouchableOpacity
                            style={{
                              backgroundColor: 'transparent',
                              marginTop: 10,
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingVertical: 8,
                              borderRadius: 8,
                            }}
                            onPress={() => setShowResetModal(false)}
                          >
                            <Text style={{ color: '#7e5cff', fontSize: 16, fontWeight: '600' }}>Close</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableWithoutFeedback>
                  </KeyboardAvoidingView>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAwareScrollView>
  );
};

export default AuthScreen;

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#16191f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    alignItems: 'center',
    padding: 0,
    backgroundColor: '#16191f',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#e6e9f0',
    letterSpacing: 1,
    marginBottom: 2,
    fontFamily: 'System',
  },
  subtitle: {
    color: '#8ca0c6',
    fontSize: 16,
    marginBottom: 24,
    fontWeight: '400',
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#232632',
    borderRadius: 18,
    padding: 22,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232632',
    borderRadius: 9,
    borderWidth: 1.2,
    borderColor: '#333',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  inputIcon: {
    marginRight: 7,
  },
  input: {
    flex: 1,
    color: '#e6e9f0',
    fontSize: 17,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    fontFamily: 'System',
  },
  eyeIcon: {
    marginLeft: 5,
    padding: 3,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: -4,
  },
  error: {
    color: '#ff4a4a',
    fontSize: 15,
    fontWeight: '500',
  },
  buttonContainer: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 10,
  },
  buttonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 10,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#7e5cff',
    borderRadius: 10,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9575ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
  },
  keyboardAvoidingView: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#232632',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    margin: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'System',
  },
  tabContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 24,
    backgroundColor: '#232632',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#333333',
    overflow: 'hidden',
  },
  tabButtonContainer: {
    flex: 1,
  },
  tabButtonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 10,
    flex: 1,
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 10,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  activeTab: {
    backgroundColor: '#7e5cff',
    borderColor: '#9575ff',
  },
  tabText: {
    color: '#8ca0c6',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'System',
  },
  activeTabText: {
    color: '#ffffff',
  },
  modalText: {
    color: '#c1c6d9',
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'System',
  },
  emailText: {
    color: '#7e5cff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 4,
    padding: 16,
    backgroundColor: 'rgba(126, 92, 255, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7e5cff',
    overflow: 'hidden',
    fontFamily: 'System',
  },
  modalButtons: {
    width: '100%',
  },
  modalButton: {
    backgroundColor: '#7e5cff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
    borderWidth: 2,
    borderColor: '#9575ff',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  inputNoAutofill: {
    fontFamily: 'System',
  },
  modalButtonContainer: {
    width: '100%',
  },
  modalButtonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 10,
  },
});