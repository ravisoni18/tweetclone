import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { GOOGLE_AUTH } from './src/config/googleAuth';
import AppNavigator from './src/navigation/AppNavigator';

function ThemedStatusBar() {
  const { themeName } = useTheme();
  return <StatusBar style={themeName === 'light' ? 'dark' : 'light'} />;
}

// Configure Google Sign-In at app startup
GoogleSignin.configure({
  webClientId: GOOGLE_AUTH.WEB_CLIENT_ID,
  iosClientId: GOOGLE_AUTH.IOS_CLIENT_ID,
  offlineAccess: true,
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <AppNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
