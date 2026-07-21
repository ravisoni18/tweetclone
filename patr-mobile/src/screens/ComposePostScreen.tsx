import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../config/firebase';

const API = 'https://patr.me/api';
const MAX_VIDEO_MB = 50;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export default function ComposePostScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();

  const [content, setContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  // Request permissions on mount
    useEffect(() => {
    // Permissions requested lazily on iOS 26 beta
  }, []);

  const remaining = 280 - content.length;
  const canPost = content.trim().length > 0 && remaining >= 0 && !loading;

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library access is required.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        setMediaUri(asset.uri);
        setMediaType('image');
        setMediaMimeType(asset.mimeType || 'image/jpeg');
        setMediaFilename(asset.fileName || null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access photo library. Please try again.');
      console.error('Photo library error:', error);
    }
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library access is required.');
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.8,
      });
      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
          const mb = (asset.fileSize / 1024 / 1024).toFixed(1);
          Alert.alert('Video Too Large', `Your video is ${mb}MB. Please select a video under ${MAX_VIDEO_MB}MB.`);
          return;
        }
        setMediaUri(asset.uri);
        setMediaType('video');
        setMediaMimeType(asset.mimeType || 'video/mp4');
        setMediaFilename(asset.fileName || null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access photo library. Please try again.');
      console.error('Photo library error:', error);
    }
  };

  const openCamera = async () => {
    try {
      // Request camera permission before opening
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus.status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is required to take photos or videos.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        const type = asset.type === 'video' ? 'video' : 'image';
        if (type === 'video' && asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
          const mb = (asset.fileSize / 1024 / 1024).toFixed(1);
          Alert.alert('Video Too Large', `Your video is ${mb}MB. Please record a shorter video under ${MAX_VIDEO_MB}MB.`);
          return;
        }
        setMediaUri(asset.uri);
        setMediaType(type);
        setMediaMimeType(asset.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg'));
        setMediaFilename(asset.fileName || null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open camera. Please try again.');
      console.error('Camera error:', error);
    }
  };

  const submit = async () => {
    if (!canPost) return;
    setLoading(true);
    try {
      // Mirror the web ComposePost: access auth.currentUser directly and
      // force-refresh the token so a stale cached token is never sent.
      await auth.authStateReady();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Not authenticated. Please log in again.');

      const token = await firebaseUser.getIdToken(true);

      const form = new FormData();
      form.append('content', content.trim());
      // Send user identity fields — the web sends these and the server uses them
      form.append('userId', firebaseUser.uid);
      form.append('userEmail', firebaseUser.email || '');
      form.append('userName', firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User');
      form.append('userPhoto', firebaseUser.photoURL || '');

      if (mediaUri && mediaType) {
        const mimeType = mediaMimeType || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
        const ext = mimeType.split('/')[1]?.split(';')[0] || (mediaType === 'video' ? 'mp4' : 'jpg');
        const filename = mediaFilename || `${mediaType}.${ext}`;
        form.append(mediaType === 'image' ? 'image' : 'video', { uri: mediaUri, name: filename, type: mimeType } as any);
        form.append('mediaType', mediaType);
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API}/posts`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Failed to post (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error. Please try again.'));
        xhr.send(form);
      });

      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create post');
    } finally {
      setLoading(false);
    }
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Toolbar */}
        <View style={s.toolbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.cancelBtn}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={submit}
            disabled={!canPost}
            style={[s.postBtn, !canPost && s.postBtnDisabled]}
          >
            {loading
              ? <ActivityIndicator color={theme.accentText} size="small" />
              : <Text style={s.postBtnText}>Post</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {/* User + input row */}
          <View style={s.row}>
            <View style={s.avatar}>
              {user?.profileImageUrl ? (
                <Image source={{ uri: user.profileImageUrl }} style={s.avatarImg} />
              ) : (
                <View style={[s.avatarImg, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>
                    {(user?.displayName || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <TextInput
              style={s.input}
              placeholder="What's happening?"
              placeholderTextColor={theme.textDim}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
              maxLength={300}
            />
          </View>

          {/* Media preview */}
          {mediaUri && (
            <View style={s.mediaWrap}>
              <Image source={{ uri: mediaUri }} style={s.mediaPreview} resizeMode="cover" />
              <TouchableOpacity
                style={s.removeMedia}
                onPress={() => { setMediaUri(null); setMediaType(null); setMediaMimeType(null); setMediaFilename(null); }}
              >
                <Ionicons name="close-circle" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Bottom actions */}
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity onPress={pickImage} style={s.mediaBtn} disabled={loading}>
            <Ionicons name="image-outline" size={24} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickVideo} style={s.mediaBtn} disabled={loading}>
            <Ionicons name="videocam-outline" size={24} color="#a855f7" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openCamera} style={s.mediaBtn} disabled={loading}>
            <Ionicons name="camera-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Text style={[s.counter, remaining < 20 && s.counterWarn, remaining < 0 && s.counterOver]}>
            {remaining}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    cancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
    cancelText: { color: theme.text, fontSize: 16 },
    postBtn: {
      backgroundColor: theme.accent,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 20,
      minWidth: 64,
      alignItems: 'center',
    },
    postBtnDisabled: { opacity: 0.4 },
    postBtnText: { color: theme.accentText, fontWeight: '700', fontSize: 15 },
    row: { flexDirection: 'row', padding: 16 },
    avatar: { marginRight: 12 },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },
    avatarFallback: { backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { color: '#fff', fontSize: 20, fontWeight: '700' },
    input: {
      flex: 1,
      color: theme.text,
      fontSize: 18,
      lineHeight: 26,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    mediaWrap: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
    mediaPreview: { width: '100%', height: 200 },
    removeMedia: {
      position: 'absolute', top: 8, right: 8,
      backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14,
    },
    bottomBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    mediaBtn: { padding: 4 },
    counter: { color: theme.textDim, fontSize: 14, fontWeight: '600' },
    counterWarn: { color: '#facc15' },
    counterOver: { color: '#ef4444' },
  });
