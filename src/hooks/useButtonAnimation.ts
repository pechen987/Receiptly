import { useRef } from 'react';
import { Animated } from 'react-native';

export const useButtonAnimation = () => {
  const createPressAnimation = () => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const shadowOpacityAnim = useRef(new Animated.Value(0.25)).current;
    const elevationAnim = useRef(new Animated.Value(12)).current;

    const handlePressIn = () => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.92,
          useNativeDriver: true,
          tension: 150,
          friction: 4,
        }),
        Animated.spring(shadowOpacityAnim, {
          toValue: 0.1,
          useNativeDriver: false,
          tension: 150,
          friction: 4,
        }),
        Animated.spring(elevationAnim, {
          toValue: 4,
          useNativeDriver: false,
          tension: 150,
          friction: 4,
        })
      ]).start();
    };

    const handlePressOut = () => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 150,
          friction: 4,
        }),
        Animated.spring(shadowOpacityAnim, {
          toValue: 0.25,
          useNativeDriver: false,
          tension: 150,
          friction: 4,
        }),
        Animated.spring(elevationAnim, {
          toValue: 12,
          useNativeDriver: false,
          tension: 150,
          friction: 4,
        })
      ]).start();
    };

    return { scaleAnim, shadowOpacityAnim, elevationAnim, handlePressIn, handlePressOut };
  };

  return { createPressAnimation };
}; 