import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';
import { User } from '../types';

const API_BASE = 'https://patr.me/api';
const USER_STORAGE_KEY = 'patr_user';
const TOKEN_STORAGE_KEY = 'authToken';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
  getToken: async () => '',
});

const saveUser = async (user: User) => {
  await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};

const loadUser = async (): Promise<User | null> => {
  try {
    const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearStorage = async () => {
  await AsyncStorage.multiRemove([USER_STORAGE_KEY, TOKEN_STORAGE_KEY]);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const handlingSignInRef = useRef(false);
  const userLoadedRef = useRef(false);

  // Restore session from AsyncStorage on mount
  useEffect(() => {
    loadUser().then(cached => {
      if (cached) {
        setUser(cached);
        userLoadedRef.current = true;
      }
      setLoading(false);
    });
  }, []);

  // Listen for Firebase auth changes (background token refresh)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (handlingSignInRef.current) return;

      if (firebaseUser) {
        // Refresh the cached token
        try {
          const token = await firebaseUser.getIdToken();
          await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
        } catch {}
      } else {
        // Firebase fired null — only log out if we have no cached user
        if (!userLoadedRef.current) {
          setUser(null);
          setLoading(false);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Called from the Login screen after Google Sign-In succeeds natively
  const signInWithGoogle = useCallback(async (idToken: string) => {
    handlingSignInRef.current = true;
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      const firebaseUser = result.user;

      const token = await firebaseUser.getIdToken();
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);

      // Check if user exists in our DB — fall back to Firebase profile if API is unavailable
      let userData: any = {};
      try {
        const checkRes = await fetch(`${API_BASE}/auth/check-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          }),
        });

        const text = await checkRes.text();
        if (text) userData = JSON.parse(text);

        if (userData.status === 'pending' || userData.status === 'rejected') {
          await signOut(auth);
          await clearStorage();
          throw new Error(
            userData.status === 'pending'
              ? 'Your account is pending approval. Please wait for an admin to approve it.'
              : 'Your invitation was declined.'
          );
        }
      } catch (apiErr: any) {
        // If the error is a pending/rejected status, re-throw it
        if (apiErr.message?.includes('pending') || apiErr.message?.includes('declined')) {
          throw apiErr;
        }
        // Otherwise fall through using Firebase profile data only
        console.warn('check-user API error, using Firebase profile:', apiErr.message);
      }

      const appUser: User = {
        id: userData.id || firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: userData.displayName || firebaseUser.displayName || '',
        username: userData.username || firebaseUser.email?.split('@')[0] || '',
        bio: userData.bio || '',
        location: userData.location || '',
        website: userData.website || '',
        profileImageUrl: userData.profileImageUrl || firebaseUser.photoURL || '',
        coverImageUrl: userData.coverImageUrl || '',
        followersCount: userData.followersCount || 0,
        followingCount: userData.followingCount || 0,
        postsCount: userData.postsCount || 0,
        verified: userData.verified || false,
        createdAt: userData.createdAt || new Date().toISOString(),
        updatedAt: userData.updatedAt || new Date().toISOString(),
      };

      await saveUser(appUser);
      userLoadedRef.current = true;
      setUser(appUser);
    } finally {
      handlingSignInRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    userLoadedRef.current = false;
    setUser(null);
    await clearStorage();
    await signOut(auth);
  }, []);

  const getToken = useCallback(async (): Promise<string> => {
    // Wait for Firebase to finish restoring auth state — on Android this is
    // async and currentUser is null until ready.
    await auth.authStateReady();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error('Not authenticated. Please log in again.');
    }
    // Force-refresh matches the web service behaviour and ensures a stale
    // cached token is never sent to the server.
    const token = await firebaseUser.getIdToken(true);
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    return token;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
