import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// @firebase/auth exports getReactNativePersistence under the "react-native" conditional
// export. Metro bundler resolves this correctly at runtime; tsc resolves the bare
// "types" condition first and misses it — hence the @ts-ignore below.
// @ts-ignore
import { getReactNativePersistence } from '@firebase/auth';

// Same Firebase project as the web app
const firebaseConfig = {
  apiKey: "AIzaSyBGGPT6EW0aSR2PoW8WuGouJt8VcoI4BDQ",
  authDomain: "patr-4829d.firebaseapp.com",
  projectId: "patr-4829d",
  storageBucket: "patr-4829d.firebasestorage.app",
  messagingSenderId: "964264491610",
  appId: "1:964264491610:web:ccd38cb9d1f00e91a4f663",   // ✅ Web app ID
  measurementId: "G-86DQFB6D12",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// AsyncStorage gives us persistence across app restarts (replaces localStorage)
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export default app;
