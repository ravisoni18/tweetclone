import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const { theme } = useTheme();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);

      // Check if Google Play Services is available
      await GoogleSignin.hasPlayServices();

      // Sign in with native Google account picker
      console.log('Starting native Google Sign-In...');
      const response = await GoogleSignin.signIn();

      // v13+ of @react-native-google-signin/google-signin returns a discriminated
      // union: { type: 'success', data: User } | { type: 'cancelled', data: null }
      if (response.type === 'cancelled') {
        console.log('Sign-in cancelled by user');
        setLoading(false);
        return;
      }

      const idToken = response.data?.idToken;

      if (!idToken) {
        console.error('Response:', response);
        Alert.alert('Sign-in failed', 'No ID token returned from Google.');
        setLoading(false);
        return;
      }

      console.log('Got id_token from Google Sign-In');
      console.log('Calling signInWithGoogle...');

      // Pass the ID token to Firebase Auth
      await signInWithGoogle(idToken);
      console.log('signInWithGoogle succeeded');
    } catch (error: any) {
      setLoading(false);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Sign-in cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Sign-in in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available');
      } else {
        console.error('Sign-in error:', error);
        Alert.alert('Sign-in failed', error.message || 'Could not complete sign-in.');
      }
    }
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoText}>P</Text>
          </View>
          <Text style={s.appName}>Patr</Text>
          <Text style={s.tagline}>Share your world</Text>
        </View>

        {/* Sign-in card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Welcome to Patr</Text>
          <Text style={s.cardSubtitle}>
            Sign in with your Google account to get started.
          </Text>

          <TouchableOpacity
            style={[s.googleBtn, loading && s.googleBtnDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <>
                {/* Simple "G" icon */}
                <View style={s.gIconWrap}>
                  <Text style={s.gIcon}>G</Text>
                </View>
                <Text style={s.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.disclaimer}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    inner: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    logoWrap: { alignItems: 'center', marginBottom: 48 },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      shadowColor: theme.accent,
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
    logoText: { color: theme.accentText, fontSize: 36, fontWeight: '800' },
    appName: { color: theme.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
    tagline: { color: theme.textDim, fontSize: 16, marginTop: 4 },
    card: {
      width: '100%',
      backgroundColor: theme.widget,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 8,
    },
    cardSubtitle: {
      color: theme.textDim,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 24,
    },
    googleBtn: {
      backgroundColor: theme.accent,
      borderRadius: 50,
      paddingVertical: 14,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    googleBtnDisabled: {
      opacity: 0.45,
    },
    gIconWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gIcon: {
      color: theme.accentText,
      fontSize: 14,
      fontWeight: '800',
    },
    googleBtnText: {
      color: theme.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    disclaimer: {
      color: theme.textDim,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 18,
    },
  });
