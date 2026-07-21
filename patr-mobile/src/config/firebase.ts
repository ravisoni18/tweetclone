import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// @firebase/auth exports getReactNativePersistence under the "react-native" conditional
// export. Metro bundler resolves this correctly at runtime; tsc resolves the bare
// "types" condition first and misses it — hence the @ts-ignore below.
// @ts-ignore
import { getReactNativePersistence } from '@firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBGGPT6EW0aSR2PoW8WuGouJt8VcoI4BDQ",
  authDomain: "patr-4829d.firebaseapp.com",
  projectId: "patr-4829d",
  storageBucket: "patr-4829d.firebasestorage.app",
  messagingSenderId: "964264491610",
  appId: "1:964264491610:web:ccd38cb9d1f00e91a4f663",
  measurementId: "G-86DQFB6D12",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// initializeAuth throws if called again on the same app (e.g. Fast Refresh in dev).
// Fall back to getAuth() which safely returns the already-initialized instance.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export default app;
