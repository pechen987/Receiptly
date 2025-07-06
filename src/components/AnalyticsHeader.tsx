import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useButtonAnimation } from '../hooks/useButtonAnimation';

interface AnalyticsHeaderProps {
  onExportPress?: () => void;
  onFilterPress?: () => void;
}

const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({ onExportPress, onFilterPress }) => {
  const { createPressAnimation } = useButtonAnimation();

  // Create separate animation instances for each button
  const filterButtonAnim = createPressAnimation();
  const exportButtonAnim = createPressAnimation();

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [{ scale: filterButtonAnim.scaleAnim }],
          }
        ]}
      >
        <Animated.View
          style={[
            {
              shadowOpacity: filterButtonAnim.shadowOpacityAnim,
              elevation: filterButtonAnim.elevationAnim,
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.button} 
            onPress={onFilterPress}
            onPressIn={filterButtonAnim.handlePressIn}
            onPressOut={filterButtonAnim.handlePressOut}
            activeOpacity={1}
          >
            <Text style={styles.buttonText}>Filter</Text>
            <Ionicons name="filter-outline" size={20} color="#ffffff" style={styles.buttonIcon} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [{ scale: exportButtonAnim.scaleAnim }],
          }
        ]}
      >
        <Animated.View
          style={[
            {
              shadowOpacity: exportButtonAnim.shadowOpacityAnim,
              elevation: exportButtonAnim.elevationAnim,
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.button} 
            onPress={onExportPress}
            onPressIn={exportButtonAnim.handlePressIn}
            onPressOut={exportButtonAnim.handlePressOut}
            activeOpacity={1}
          >
            <Text style={styles.buttonText}>Export</Text>
            <Ionicons name="share-outline" size={20} color="#ffffff" style={styles.buttonIcon} />
          </TouchableOpacity>
        </Animated.View>
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
    paddingTop: Platform.OS === 'android' ? 12 : 12,
    borderBottomWidth: 0.4,
    borderBottomColor: '#2d3748',
    backgroundColor: '#0D1117',
    zIndex: 10,
  },
  buttonContainer: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6.5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#7e5cff',
    borderWidth: 1.2,
    borderColor: '#9575ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  buttonIcon: {
    marginLeft: 2,
  },
});

export default AnalyticsHeader; 