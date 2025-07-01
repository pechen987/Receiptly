import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface BasicPlanHeaderProps {
  monthlyReceiptCount: number | null; // For compatibility, but will be used as current month count
  limit: number;
  userPlan: string | null;
}

const BasicPlanHeader: React.FC<BasicPlanHeaderProps> = ({
  monthlyReceiptCount,
  limit,
  userPlan,
}) => {
  // Ensure monthlyReceiptCount and limit are valid numbers for calculation
  const currentCount = monthlyReceiptCount !== null && monthlyReceiptCount > 0 ? monthlyReceiptCount : 0;
  const basicLimit = limit > 0 ? limit : 1; // Avoid division by zero

  const progressPercentage = Math.min(100, (currentCount / basicLimit) * 100);
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {userPlan === 'basic' && (
        <>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              Receipts this month: {currentCount} / {limit}
            </Text>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
            </View>
          </View>
          <TouchableOpacity style={styles.goProButton} onPress={() => navigation.navigate('ProOnboarding')}>
            <Text style={styles.goProButtonText}>Go Pro</Text>
          </TouchableOpacity>
        </>
      )}
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
    borderBottomWidth: 0.4,
    borderBottomColor: '#2d3748',
  },
  progressContainer: {
    flex: 1,
    marginRight: 10,
  },
  progressText: {
    fontSize: 14,
    color: '#c1c6d9',
    marginBottom: 4,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#4a5568',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#7e5cff',
    borderRadius: 3,
  },
  goProButton: {
    backgroundColor: '#FFBF00',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goProButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BasicPlanHeader; 