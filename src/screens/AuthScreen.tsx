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
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

const API_BASE_URL = apiConfig.API_BASE_URL;

const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [checkingVerification, setCheckingVerification] = useState(false);
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Store the credentials when registering
  const [pendingVerification, setPendingVerification] = useState({
    email: '',
    password: '',
    isActive: false
  });

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState(''); // '', 'success', 'error'
  const [resetLoading, setResetLoading] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Add a touched state for email to show error on blur
  const [emailTouched, setEmailTouched] = useState(false);

  const { signIn, initializeFromToken } = useAuth(); // Get signIn and initializeFromToken from AuthContext

  // Email validation regex
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Check verification status by attempting to log in
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
        // Save token to AsyncStorage for global access
        try {
          await AsyncStorage.setItem('jwt_token', loginData.token);
          console.log('Token saved to AsyncStorage after polling login');
        } catch (storageErr) {
          console.error('Failed to save token to AsyncStorage:', storageErr);
        }
        // Stop checking and log in
        if (checkInterval.current) {
          clearInterval(checkInterval.current);
          checkInterval.current = null;
        }
        
        // *** FIX: Call initializeFromToken after successful polling login ***
        await initializeFromToken(loginData.token);
        
      } else if (loginRes.status === 403 && loginData.message === 'Please verify your email before logging in') {
        console.log('Email not verified yet, continuing to poll...');
        // Continue polling for unverified email
      } else {
        console.log('Login attempt failed with status:', loginRes.status, 'Message:', loginData.message || 'No message');
        // Continue polling for other errors except invalid credentials
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

  // Handle deep link for email confirmation
  const handleOpenURL = (event: { url?: string; launchURL?: string }) => {
    const url = event.url || event.launchURL;
    if (url && url.includes('/api/auth/confirm-email')) {
      // Extract token from URL
      const token = url.split('token=')[1];
      if (token) {
        // Call the confirm-email endpoint directly
        (async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/auth/confirm-email?token=${token}`);
            const data = await res.json();
            // Note: The backend's confirm-email currently returns a token that only contains email, not user_id and exp.
            // For a proper automatic login after clicking the confirmation link, the backend's /confirm-email
            // should ideally return a standard login token or redirect with necessary info.
            // As a workaround for now, we can attempt to log in the user with the pending credentials if they exist.
            // A better long-term solution would be to fix the backend /confirm-email endpoint.
            
              if (checkInterval.current) {
                clearInterval(checkInterval.current);
                checkInterval.current = null;
              }
            // Attempt to sign in using the stored pending credentials after confirmation
            if (pendingVerification.email && pendingVerification.password) {
                 console.log('Email confirmed via deep link. Attempting to sign in with pending credentials.');
                 await signIn(pendingVerification.email, pendingVerification.password);
                 // Clear pending verification state after successful sign-in attempt
                 setPendingVerification({ email: '', password: '', isActive: false });
            } else {
                console.log('Email confirmed via deep link, but no pending credentials found. User will need to log in manually.');
                // If no pending credentials, user will need to manually log in
                // We could potentially show a success message here.
            }

          } catch (error) {
            console.error('Email confirmation failed:', error);
            // Handle confirmation errors if needed
          }
        })();
      }
    }
  };

  // Set up deep link listener and polling when email is pending verification
  useEffect(() => {
    // Set up deep link listener for email confirmation
    const subscription = Linking.addEventListener('url', ({ url }) => handleOpenURL({ url }));

    
    // For Android (check initial URL if app was opened from a link)
    Linking.getInitialURL().then(url => {
      if (url) handleOpenURL({ url });
    });

    // Set up polling if we have a pending verification
    if (pendingVerification.email && pendingVerification.password) {
      console.log('Starting verification polling for:', pendingVerification.email);
      // Start polling every 3 seconds
      checkVerificationStatus(); // Check immediately first
      checkInterval.current = setInterval(checkVerificationStatus, 3000);
    }
      
    // Clean up interval and subscription on unmount
    return () => {
      console.log('Cleaning up verification polling');
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
        checkInterval.current = null;
      }
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [pendingVerification]);

  // Initial animation
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
        // *** FIX: Use signIn from AuthContext for login ***
        await signIn(email, password);
        setError(''); // Clear error on successful login
        setLoading(false); // Turn off loading
        // AuthContext's signIn handles saving token and updating user state
      } else {
        // Existing registration logic
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
        setLoading(false);
        console.log('Registration successful, showing confirmation modal for:', email);
        setPendingVerification({
          email,
          password,
          isActive: true
        });
        setPendingEmail(email);
        setShowConfirmationModal(true);
      } else {
          // Handle error cases for registration
          if (data.message && data.message.toLowerCase().includes('email')) {
            setEmailError(data.message);
          } else if (data.message && data.message.toLowerCase().includes('password')) {
            setPasswordError(data.message);
          } else {
            setError(data.message || 'Registration failed');
          }
        }
      }
    } catch (e: any) {
      // Catch errors from signIn or fetch
      console.error('Auth process failed:', e);
      if (e.response && e.response.data && e.response.data.message) {
        setError(e.response.data.message); // Display specific backend error
      } else if (e.message) {
         setError(e.message); // Display network or other error message
      } else {
         setError('An unexpected error occurred during authentication.');
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

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: '#16191f' }} // adjust if needed
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
                <TouchableOpacity
                  style={[styles.tab, mode === 'login' && styles.activeTab]}
                  onPress={() => {
                    setMode('login');
                    setError('');
                  }}
                >
                  <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, mode === 'register' && styles.activeTab]}
                  onPress={() => {
                    setMode('register');
                    setError('');
                  }}
                >
                  <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>Register</Text>
                </TouchableOpacity>
              </View>
  
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#888"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={text => {
                    setEmail(text);
                    if (mode === 'register') {
                      setEmailError('');
                    }
                  }}
                  onBlur={() => {
                    if (mode === 'register') {
                      setEmailTouched(true);
                      if (!email) {
                        setEmailError('Email is required.');
                      } else if (!isValidEmail(email)) {
                        setEmailError('Please enter a valid email address.');
                      } else {
                        setEmailError('');
                      }
                    }
                  }}
                  editable={!loading}
                  returnKeyType="next"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                />
              </View>
              {/* Email error below email field */}
              {mode === 'register' && (emailError && (emailTouched || emailError)) ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={18} color="#ff4a4a" style={{ marginRight: 6 }} />
                  <Text style={styles.error}>{emailError}</Text>
                </View>
              ) : null}
  
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#888"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#888" />
                </TouchableOpacity>
              </View>
  
              {!!error && (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={18} color="#ff4a4a" style={{ marginRight: 6 }} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              )}

              {mode === 'register' && (
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#888"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={text => {
                      setConfirmPassword(text);
                      if (passwordError) setPasswordError('');
                    }}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={styles.eyeIcon}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="#888" />
                  </TouchableOpacity>
                </View>
              )}
              {/* Password/confirmation errors below confirm password field */}
              {mode === 'register' && passwordError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={18} color="#ff4a4a" style={{ marginRight: 6 }} />
                  <Text style={styles.error}>{passwordError}</Text>
                </View>
              ) : null}

              {mode === 'register' && confirmPassword.length > 0 && password !== confirmPassword && (
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={18} color="#ff4a4a" style={{ marginRight: 6 }} />
                  <Text style={styles.error}>Passwords do not match</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  (loading || (mode === 'register' && (!email || !isValidEmail(email) || !password || !confirmPassword)) || (mode === 'login' && (!email || !password))) && styles.buttonDisabled,
                ]}
                onPress={handleAuth}
                disabled={
                  loading ||
                  (mode === 'register' && (!email || !isValidEmail(email) || !password || !confirmPassword)) ||
                  (mode === 'login' && (!email || !password))
                }
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

              {/* Forgot Password Button (now below the main button) */}
              {mode === 'login' && (
                <TouchableOpacity onPress={() => { setShowResetModal(true); setResetEmail(''); setResetStatus(''); }} style={{ alignSelf: 'center', marginTop: 8, marginBottom: 2 }}>
                  <Text style={{ color: '#7e5cff', fontWeight: '600', fontSize: 15 }}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
            </View>
  
            {/* Confirmation Modal */}
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
                      <Text style={styles.modalTitle}>Check Your Email</Text>
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
                      <TouchableOpacity
                        style={styles.modalButton}
                        onPress={() => {
                          setShowConfirmationModal(false);
                          setPendingVerification(prev => ({ ...prev, isActive: false }));
                        }}
                      >
                        <Text style={styles.primaryButtonText}>Got it!</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </View>
            </Modal>

            {/* Password Reset Modal */}
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
                        {/* Email input styled like registration */}
                        <View style={styles.inputWrapper}>
                          <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                          <TextInput
                            style={styles.input}
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
                          <TouchableOpacity
                            style={[styles.modalButton, (resetLoading || resetStatus === 'success') && { opacity: 0.6 }]}
                            onPress={handleSendReset}
                            disabled={resetLoading || !resetEmail || resetStatus === 'success'}
                          >
                            <Text style={styles.primaryButtonText}>
                              {resetLoading ? 'Sending...' : 'Send Reset Email'}
                            </Text>
                          </TouchableOpacity>
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
  separator: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 0,
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
  button: {
    flexDirection: 'row',
    backgroundColor: '#7e5cff',
    borderRadius: 10,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
    shadowColor: '#7e5cff',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
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
  // Modal styles
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
    backgroundColor: '#2a2f3d',
    borderRadius: 16,
    padding: 28,
    width: '90%',
    maxWidth: 400,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
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
    borderColor: '#7e5cff',
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#7e5cff',
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
    marginBottom: 4,
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
    marginTop: 16,
    width: '100%',
  },
  modalButton: {
    backgroundColor: '#7e5cff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  switch: {
    marginTop: 14,
    color: '#7e5cff',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  
  innerContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});