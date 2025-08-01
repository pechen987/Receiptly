import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

// Styles for the modal and icon
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#161B22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#30363D',
    padding: 20,
    marginHorizontal: 20,
    alignItems: 'center',

  },
  modalText: {
    fontSize: 16,
    color: '#e6e9f0',
    textAlign: 'left',
  },
  hintIcon: {
    top: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintIconHitbox: { // Larger pressable area for easier tapping
    padding: 0, // Add padding to increase touch area
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    position: 'absolute',
    top: -5,
    right: -5,
    padding: 8,
    zIndex: 1,
  },
});

// Reusable Hint Modal Component Props
interface HintModalProps {
  visible: boolean;
  text: string;
  onClose: () => void;
}

// Reusable Hint Modal Component
const HintModal: React.FC<HintModalProps> = ({ visible, text, onClose }) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <View style={modalStyles.modalContainer}>
          <Pressable onPress={onClose} style={modalStyles.closeIcon}>
            <Icon name="x" size={20} color="#8ca0c6" />
          </Pressable>
          <Text style={modalStyles.modalText}>{text}</Text>
        </View>
      </Pressable>
    </Modal>
  );
};

// Reusable Hint Icon Component Props
interface HintIconProps {
  hintText: string;
}

// Reusable Hint Icon Component
const HintIcon: React.FC<HintIconProps> = ({ hintText }) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <Pressable onPress={() => setModalVisible(true)} style={modalStyles.hintIconHitbox}>
        <Icon name="info" size={16} color="#8ca0c6" style={modalStyles.hintIcon} />
      </Pressable>
      <HintModal visible={modalVisible} text={hintText} onClose={() => setModalVisible(false)} />
    </>
  );
};

export { HintIcon, HintModal, modalStyles, HintIconProps, HintModalProps }; 