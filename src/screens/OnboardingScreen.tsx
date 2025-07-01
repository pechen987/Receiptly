import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiConfig from '../config/api'; // This import assumes apiConfig.ts is in your project's config folder

// Define the options for user goals
const GOAL_OPTIONS = [
  'Effortless Expense Tracking',
  'Smart Savings & Budgeting',
  'Insightful Spending Habits',
  'Price Change Monitoring',
  'Something unique (tell us more!)',
];

// Define the options for app features
const FEATURE_OPTIONS = [
  'Dynamic Spending Trends & Charts',
  'Secure Receipt Storage & History',
  'Detailed Product-Level Insights',
  'Organized Product Categories',
  'Exclusive Discounts & Savings Tracker',
];

// Total number of onboarding steps
const STEPS = 3;

const OnboardingScreen = ({ onComplete }: { onComplete: (answers: { goals: string[]; features: string[] }) => void }) => {
  // State variables for managing the onboarding flow
  const [step, setStep] = useState(0); // Current step of the onboarding
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]); // User's selected goals
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]); // User's selected features
  const [loading, setLoading] = useState(false); // Loading state for API calls

  // Animation values for various UI elements
  const chevronScale = useState(new Animated.Value(1))[0]; // Scale for the next step chevron
  const [optionScales, setOptionScales] = useState([
    GOAL_OPTIONS.map(() => new Animated.Value(1)), // Scales for goal options
    FEATURE_OPTIONS.map(() => new Animated.Value(1)), // Scales for feature options
  ]);
  const [startScale] = useState(new Animated.Value(1)); // Scale for the start button
  const [fadeAnim] = useState(new Animated.Value(1)); // Opacity for fade animation

  // Removed fadeAnim for immediate screen switching as requested.
  // useEffect for step transitions is no longer needed for fade.

  // Function to toggle selection of an option
  const handleToggle = (option: string, selected: string[], setSelected: (v: string[]) => void, idx: number) => {
    // Update the selection state immediately for instant visual feedback
    if (selected.includes(option)) {
      setSelected(selected.filter(o => o !== option));
    } else {
      setSelected([...selected, option]);
    }

    // Animate the option press after state update
    Animated.sequence([
      Animated.timing(optionScales[step][idx], { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(optionScales[step][idx], { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
    ]).start();
  };

  // Function to move to the next onboarding step
  const handleNext = () => {
    // Fade out, switch step, then fade in
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setStep(s => {
        const nextStep = Math.min(s + 1, STEPS - 1);
        // After step changes, fade in
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
        return nextStep;
      });
    });
    // Also animate chevron as before
    Animated.sequence([
      Animated.timing(chevronScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(chevronScale, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }),
    ]).start();
  };

  // Handlers for chevron press animations
  const handleChevronPressIn = () => {
    Animated.spring(chevronScale, { toValue: 0.85, useNativeDriver: true }).start();
  };
  const handleChevronPressOut = () => {
    Animated.spring(chevronScale, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }).start();
  };

  // Handlers for start button press animations
  const handleStartPressIn = () => {
    Animated.spring(startScale, { toValue: 0.93, useNativeDriver: true }).start();
  };
  const handleStartPressOut = () => {
    Animated.spring(startScale, { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }).start();
  };

  // API call for onboarding completion
  const handleStart = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      if (token) {
        await axios.post(
          `${apiConfig.API_BASE_URL}/api/user/profile/complete-onboarding`,
          { goals: selectedGoals, features: selectedFeatures },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      onComplete({ goals: selectedGoals, features: selectedFeatures });
    } catch (e) {
      console.error("Onboarding API call failed:", e); // Log error for debugging
      // Optionally show a user-friendly error message
    } finally {
      setLoading(false);
    }
  };

  // Render progress dots
  const renderProgress = () => (
    <View style={styles.progressRow}>
      {[...Array(STEPS)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            step === i && styles.progressDotActive
          ]}
        />
      ))}
    </View>
  );

  // Determine screen height for dynamic styling
  const { height } = Dimensions.get('window');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Fade animation wrapper for step switching */}
        <Animated.View style={{ opacity: fadeAnim, flex: 1, width: '100%' }}>
          {/* Removed Animated.View wrapper for immediate step switching */}
          <View style={styles.flexGrowCenter}>
            {step === 0 && (
              <View style={styles.stepContainer}>
                <Text style={styles.title}>Welcome to Receiptly!</Text>
                <Text style={styles.explanation}>
                  Let's tailor your experience. A couple of quick questions will help us make Receiptly perfect for you!
                </Text>
                <View style={styles.questionRow}>
                  <Text style={styles.question}>What's your primary goal with Receiptly?</Text>
                </View>
                {/* Removed ScrollView for options as requested */}
                <View style={styles.optionsContainer}>
                  {GOAL_OPTIONS.map((option, idx) => (
                    <Animated.View key={option} style={{ transform: [{ scale: optionScales[0][idx] }] }}>
                      <TouchableOpacity
                        style={[styles.option, selectedGoals.includes(option) && styles.optionSelected]}
                        onPress={() => handleToggle(option, selectedGoals, setSelectedGoals, idx)}
                        onPressIn={() => Animated.spring(optionScales[0][idx], { toValue: 0.95, useNativeDriver: true }).start()}
                        onPressOut={() => Animated.spring(optionScales[0][idx], { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }).start()}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={selectedGoals.includes(option) ? 'checkmark-circle' : 'radio-button-off'}
                          size={24}
                          color={selectedGoals.includes(option) ? '#9575ff' : '#888'}
                          style={styles.optionIcon}
                        />
                        <Text style={styles.optionText}>{option}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
                <View style={styles.bottomRow}>
                  <View style={{ flex: 1 }} />
                  <Animated.View style={[styles.progressChevronGroup, { transform: [{ scale: chevronScale }] }]}>
                    {renderProgress()}
                    <TouchableOpacity
                      onPress={handleNext}
                      onPressIn={handleChevronPressIn}
                      onPressOut={handleChevronPressOut}
                      activeOpacity={0.8}
                      style={styles.chevronTouchable}
                    >
                      <Ionicons name="arrow-forward-circle" size={64} color="#9575ff" />
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
            )}
            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={styles.title}>Almost there!</Text>
                <Text style={styles.explanation}>
                  Help us highlight what matters most to you. Select the features you're excited about.
                </Text>
                <View style={styles.questionRow}>
                  <Text style={styles.question}>Which features are most important to you?</Text>
                </View>
                {/* Removed ScrollView for options as requested */}
                <View style={styles.optionsContainer}>
                  {FEATURE_OPTIONS.map((option, idx) => (
                    <Animated.View key={option} style={{ transform: [{ scale: optionScales[1][idx] }] }}>
                      <TouchableOpacity
                        style={[styles.option, selectedFeatures.includes(option) && styles.optionSelected]}
                        onPress={() => handleToggle(option, selectedFeatures, setSelectedFeatures, idx)}
                        onPressIn={() => Animated.spring(optionScales[1][idx], { toValue: 0.95, useNativeDriver: true }).start()}
                        onPressOut={() => Animated.spring(optionScales[1][idx], { toValue: 1, friction: 3, tension: 120, useNativeDriver: true }).start()}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={selectedFeatures.includes(option) ? 'checkmark-circle' : 'radio-button-off'}
                          size={24}
                          color={selectedFeatures.includes(option) ? '#9575ff' : '#888'}
                          style={styles.optionIcon}
                        />
                        <Text style={styles.optionText}>{option}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
                <View style={styles.bottomRow}>
                  <View style={{ flex: 1 }} />
                  <Animated.View style={[styles.progressChevronGroup, { transform: [{ scale: chevronScale }] }]}>
                    {renderProgress()}
                    <TouchableOpacity
                      onPress={handleNext}
                      onPressIn={handleChevronPressIn}
                      onPressOut={handleChevronPressOut}
                      activeOpacity={0.8}
                      style={styles.chevronTouchable}
                    >
                      <Ionicons name="arrow-forward-circle" size={64} color="#9575ff" />
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
            )}
            {step === 2 && (
              <View style={[styles.lastStepContainer, { minHeight: height * 0.7 }]}>
                <Text style={styles.title}>Unlock Your Financial Superpowers!</Text>
                <Text style={styles.explanation}>
                  Receiptly simplifies your financial life with powerful, intelligent features.
                </Text>
                <View style={styles.onboardingSteps}>
                  <View style={styles.onboardingStepBlock}>
                    <View style={styles.onboardingStepCircle}><Text style={styles.onboardingStepNumber}>1</Text></View>
                    <Text style={styles.onboardingStepText}>
                      Simply snap a photo of your receipt, and our advanced AI handles the rest.
                    </Text>
                  </View>
                  <View style={styles.onboardingStepBlock}>
                    <View style={styles.onboardingStepCircle}><Text style={styles.onboardingStepNumber}>2</Text></View>
                    <Text style={styles.onboardingStepText}>
                      Effortlessly review and edit your receipt details for perfect accuracy.
                    </Text>
                  </View>
                  <View style={styles.onboardingStepBlock}>
                    <View style={styles.onboardingStepCircle}><Text style={styles.onboardingStepNumber}>3</Text></View>
                    <Text style={styles.onboardingStepText}>
                      Gain powerful insights and smart analytics from your spending, automatically.
                    </Text>
                  </View>
                </View>
                <Text style={styles.slogan}>Scan. Analyze. Thrive.</Text>
                <Animated.View style={[styles.startButton, { transform: [{ scale: startScale }] }]}>
                  <TouchableOpacity
                    onPress={handleStart}
                    onPressIn={handleStartPressIn}
                    onPressOut={handleStartPressOut}
                    activeOpacity={0.9}
                    style={styles.startTouchable}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.startButtonText}>Get Started</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#16191f', // Dark background for sleek look
  },
  container: {
    flex: 1,
    backgroundColor: '#16191f',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  flexGrowCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 20, // Add padding to the bottom for spacing
  },
  lastStepContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800', // Bolder title
    color: '#e6e9f0', // Light text for contrast
    marginBottom: 15,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  explanation: {
    color: '#bbb', // Slightly lighter grey for explanation
    fontSize: 17,
    marginBottom: 25,
    textAlign: 'center',
    marginHorizontal: 10,
    lineHeight: 24,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
    marginTop: 10,
  },
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9575ff', // Vibrant purple for questions
    textAlign: 'left',
    flex: 1,
  },
  optionsContainer: { // New style for options container, replacing ScrollView
    width: '100%',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2e3a', // Slightly darker background for options
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
    width: '100%',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000', // Add subtle shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8, // Android shadow
  },
  optionSelected: {
    borderColor: '#9575ff', // Purple border when selected
    backgroundColor: 'rgba(149, 117, 255, 0.15)', // Light purple tint when selected
  },
  optionIcon: {
    marginRight: 15,
  },
  optionText: {
    color: '#e6e9f0',
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: 30,
    minHeight: 80,
  },
  progressChevronGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2e3a',
    borderRadius: 38, // More rounded
    borderWidth: 2,
    borderColor: '#9575ff',
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10, // Android shadow
    minWidth: 220,
    maxWidth: 360,
    justifyContent: 'space-between',
  },
  chevronTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flex: 1, // Allow dots to take available space
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3e4455', // Darker grey for inactive dots
    marginHorizontal: 3,
  },
  progressDotActive: {
    backgroundColor: '#9575ff', // Vibrant purple for active dot
    width: 16, // Slightly larger active dot
    height: 16,
    borderRadius: 8,
  },
  onboardingSteps: {
    width: '100%',
    marginTop: 30,
    marginBottom: 30,
    gap: 20, // Increased gap between steps
  },
  onboardingStepBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2e3a',
    borderRadius: 20, // More rounded corners
    borderWidth: 2,
    borderColor: '#9575ff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    width: '100%',
    minHeight: 80,
    elevation: 8, // Android shadow
  },
  onboardingStepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#9575ff', // Purple circle
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
    shadowColor: '#9575ff', // Reduced glow effect
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, // Reduced opacity
    shadowRadius: 5, // Reduced radius
    elevation: 5, // Android shadow
  },
  onboardingStepNumber: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  onboardingStepText: {
    color: '#e6e9f0',
    fontSize: 17,
    fontWeight: '500',
    flex: 1,
    lineHeight: 24,
  },
  slogan: {
    color: '#9575ff',
    fontWeight: '800',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 15,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(149, 117, 255, 0.2)', // Reduced opacity for text shadow
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3, // Reduced radius for text shadow
  },
  startButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200, // Slightly wider button
    borderRadius: 16, // More rounded
    borderWidth: 2,
    borderColor: '#9575ff',
    backgroundColor: '#7e5cff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15, // Android shadow
    marginTop: 10,
  },
  startTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
});

export default OnboardingScreen;
