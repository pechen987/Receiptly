import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useButtonAnimation } from '../hooks/useButtonAnimation';

interface BasicPlanHeaderProps {
  monthlyReceiptCount: number | null;
  limit: number;
  userPlan: string | null;
}

const BasicPlanHeader: React.FC<BasicPlanHeaderProps> = ({
  monthlyReceiptCount,
  limit,
  userPlan,
}) => {
  const isLoading = monthlyReceiptCount === null || monthlyReceiptCount === undefined;
  const currentCount = !isLoading ? monthlyReceiptCount : '-';
  const basicLimit = limit > 0 ? limit : 1;
  const progressPercentage = !isLoading ? Math.min(100, (Number(monthlyReceiptCount) / basicLimit) * 100) : 0;
  const navigation = useNavigation();
  const { createPressAnimation } = useButtonAnimation();
  const goProButtonAnim = createPressAnimation();

  if (userPlan !== 'basic') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Monthly scans: {currentCount} / {limit}
        </Text>
        <View style={styles.progressBarBackground}>
          <Animated.View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
        </View>
      </View>
      <Animated.View style={{ transform: [{ scale: goProButtonAnim.scaleAnim }] }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('ProOnboarding')}
          onPressIn={goProButtonAnim.handlePressIn}
          onPressOut={goProButtonAnim.handlePressOut}
          activeOpacity={1}
        >
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.goProButton}
          >
            <Ionicons name="star" size={16} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.goProButtonText}>Go Pro</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  progressContainer: {
    flex: 1,
    marginRight: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#c1c6d9',
    marginBottom: 6,
    fontWeight: '500',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#4a5568',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#7e5cff',
    borderRadius: 4,
  },
  goProButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  goProButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default BasicPlanHeader;