import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AnalyticsHeaderProps {
  onExportPress?: () => void;
}

const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({ onExportPress }) => {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.exportButton} onPress={onExportPress}>
        <Ionicons name="share-outline" size={26} color="#7e5cff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 20,
    borderBottomWidth: 0.4,
    borderBottomColor: '#2d3748',
    backgroundColor: '#16191f',
    zIndex: 10,
  },
  exportButton: {
    padding: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AnalyticsHeader; 