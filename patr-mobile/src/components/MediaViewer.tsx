import React, { useState } from 'react';
import {
  Modal, View, Image, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SW, height: SH } = Dimensions.get('window');

interface Props {
  uri: string;
  visible: boolean;
  onClose: () => void;
}

export default function ImageViewer({ uri, visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.97)" />
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1}>
          <Image
            source={{ uri }}
            style={s.fullImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    width: SW,
    height: SH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: SW,
    height: SH * 0.85,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
});
