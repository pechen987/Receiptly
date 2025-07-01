import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_BASE_URL } from '../utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useButtonAnimation } from '../../../hooks/useButtonAnimation';

interface FilterScreenProps {
  visible: boolean;
  onClose: () => void;
  onStoreSelect: (store: string | null) => void;
  onCategorySelect: (category: string | null) => void;
  selectedStore: string | null;
  selectedCategory: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FILTER_WIDTH = SCREEN_WIDTH * 0.85; // 85% of screen width

const FilterScreen: React.FC<FilterScreenProps> = ({ 
  visible, 
  onClose, 
  onStoreSelect,
  onCategorySelect,
  selectedStore,
  selectedCategory
}) => {
  const { createPressAnimation } = useButtonAnimation();
  
  // Create separate animation instances for each button
  const resetButtonAnim = createPressAnimation();
  const applyButtonAnim = createPressAnimation();

  const slideAnim = React.useRef(new Animated.Value(-FILTER_WIDTH)).current;
  const [storeNames, setStoreNames] = useState<string[]>([]);
  const [storeCategories, setStoreCategories] = useState<string[]>([]);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [tempSelectedStore, setTempSelectedStore] = useState<string | null>(selectedStore || 'All stores');
  const [tempSelectedCategory, setTempSelectedCategory] = useState<string | null>(selectedCategory || 'All categories');

  // Update temp values when props change
  useEffect(() => {
    setTempSelectedStore(selectedStore || 'All stores');
    setTempSelectedCategory(selectedCategory || 'All categories');
  }, [selectedStore, selectedCategory]);

  // Fetch store names and categories when the filter screen becomes visible
  useEffect(() => {
    if (visible) {
      fetchStoreNames();
      fetchStoreCategories();
    }
  }, [visible]);

  const fetchStoreNames = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/store-names`, {
        headers: {
          'Authorization': `Bearer ${await AsyncStorage.getItem('jwt_token')}`
        }
      });
      if (response.data.success) {
        setStoreNames(response.data.store_names);
      }
    } catch (error) {
      console.log('Error fetching store names:', error);
    }
  };

  const fetchStoreCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/store-categories`, {
        headers: {
          'Authorization': `Bearer ${await AsyncStorage.getItem('jwt_token')}`
        }
      });
      if (response.data.success) {
        setStoreCategories(response.data.store_categories);
      }
    } catch (error) {
      console.log('Error fetching store categories:', error);
    }
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          slideAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -FILTER_WIDTH / 3) {
          Animated.timing(slideAnim, {
            toValue: -FILTER_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
            tension: 40,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : -FILTER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const handleStoreSelect = (store: string) => {
    const actualStore = store === 'All stores' ? null : store;
    setTempSelectedStore(store);
    setShowStoreDropdown(false);
  };

  const handleCategorySelect = (category: string) => {
    const actualCategory = category === 'All categories' ? null : category;
    setTempSelectedCategory(category);
    setShowCategoryDropdown(false);
  };

  const handleApply = () => {
    const actualStore = tempSelectedStore === 'All stores' ? null : tempSelectedStore;
    const actualCategory = tempSelectedCategory === 'All categories' ? null : tempSelectedCategory;
    onStoreSelect(actualStore);
    onCategorySelect(actualCategory);
    onClose();
  };

  const handleReset = () => {
    setTempSelectedStore('All stores');
    setTempSelectedCategory('All categories');
    onStoreSelect(null);
    onCategorySelect(null);
    onClose();
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
          width: FILTER_WIDTH,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Filters</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#7e5cff" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <Text style={styles.filterTitle}>Store name</Text>
            <Text style={styles.equalsSign}>=</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowStoreDropdown(!showStoreDropdown)}
            >
              <Text style={styles.dropdownButtonText}>
                {tempSelectedStore || 'All stores'}
              </Text>
              <Ionicons 
                name={showStoreDropdown ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#7e5cff" 
              />
            </TouchableOpacity>
          </View>
          
          {showStoreDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView 
                style={styles.dropdownScrollView}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
              >
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => handleStoreSelect('All stores')}
                >
                  <Text style={styles.dropdownItemText}>All stores</Text>
                </TouchableOpacity>
                {storeNames.map((store, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dropdownItem}
                    onPress={() => handleStoreSelect(store)}
                  >
                    <Text style={styles.dropdownItemText}>{store}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <Text style={styles.filterTitle}>Store category</Text>
            <Text style={styles.equalsSign}>=</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
            >
              <Text style={styles.dropdownButtonText}>
                {tempSelectedCategory || 'All categories'}
              </Text>
              <Ionicons 
                name={showCategoryDropdown ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#7e5cff" 
              />
            </TouchableOpacity>
          </View>
          
          {showCategoryDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView 
                style={styles.dropdownScrollView}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
              >
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => handleCategorySelect('All categories')}
                >
                  <Text style={styles.dropdownItemText}>All categories</Text>
                </TouchableOpacity>
                {storeCategories.map((category, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dropdownItem}
                    onPress={() => handleCategorySelect(category)}
                  >
                    <Text style={styles.dropdownItemText}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Animated.View
          style={[
            styles.individualButtonContainer,
            {
              transform: [{ scale: resetButtonAnim.scaleAnim }],
            }
          ]}
        >
          <Animated.View
            style={[
              styles.buttonShadow,
              {
                shadowOpacity: resetButtonAnim.shadowOpacityAnim,
                elevation: resetButtonAnim.elevationAnim,
              }
            ]}
          >
            <TouchableOpacity 
              style={[styles.button, styles.resetButton]} 
              onPress={handleReset}
              onPressIn={resetButtonAnim.handlePressIn}
              onPressOut={resetButtonAnim.handlePressOut}
              activeOpacity={1}
            >
              <Text style={styles.resetButtonText}>Reset filters</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.individualButtonContainer,
            {
              transform: [{ scale: applyButtonAnim.scaleAnim }],
            }
          ]}
        >
          <Animated.View
            style={[
              styles.buttonShadow,
              {
                shadowOpacity: applyButtonAnim.shadowOpacityAnim,
                elevation: applyButtonAnim.elevationAnim,
              }
            ]}
          >
            <TouchableOpacity 
              style={[styles.button, styles.applyButton]} 
              onPress={handleApply}
              onPressIn={applyButtonAnim.handlePressIn}
              onPressOut={applyButtonAnim.handlePressOut}
              activeOpacity={1}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#16191f',
    borderRightWidth: 1,
    borderRightColor: '#2d3748',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3748',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#e6e9f0',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e6e9f0',
  },
  equalsSign: {
    fontSize: 16,
    color: '#7e5cff',
    marginHorizontal: 8,
  },
  dropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2d47',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3d4a',
  },
  dropdownButtonText: {
    color: '#e6e9f0',
    fontSize: 16,
  },
  dropdownList: {
    borderRadius: 8,
    borderColor: '#3a3d4a',
    marginTop: 4,
    maxHeight: 200,
    borderWidth: 1,
    backgroundColor: '#2a2d47',
  },
  dropdownScrollView: {
    borderRadius: 8,
  },
  dropdownItem: {
    backgroundColor: '#2a2d47',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3d4a',
    paddingHorizontal: 12,
  },
  dropdownItemText: {
    color: '#e6e9f0',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 50,
    borderTopColor: '#2d3748',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 0,
    zIndex: 5,
    minHeight: 48,
  },
  resetButton: {
    backgroundColor: '#2a2d47',
    borderWidth: 2,
    borderColor: '#3a3d4a',
  },
  applyButton: {
    backgroundColor: '#7e5cff',
    borderWidth: 2,
    borderColor: '#9575ff',
  },
  resetButtonText: {
    color: '#e6e9f0',
    fontSize: 16,
    fontWeight: '600',
    zIndex: 10,
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    zIndex: 10,
  },
  buttonShadow: {
    shadowColor: '#7e5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    borderRadius: 8,
  },
  individualButtonContainer: {
    flex: 1,
  },
});

export default FilterScreen; 