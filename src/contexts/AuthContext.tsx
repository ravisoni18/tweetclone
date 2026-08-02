import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User as FirebaseUser, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { User, AuthContextType, UpdateUserData, InviteStatus } from '../types';
import api from '../config/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ─── localStorage helpers ───────────────────────────────────────────────────
const STORAGE_USER_KEY = 'patr_user';
const STORAGE_TOKEN_KEY = 'authToken';

const saveUserToStorage = (user: User, token: string) => {
  try {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
  } catch {}
};

const loadUserFromStorage = (): User | null => {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const clearStorage = () => {
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_TOKEN_KEY);
};
// ────────────────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Restore user instantly from localStorage — no loading spinner on F5
  const [user, setUser] = useState<User | null>(() => loadUserFromStorage());
  const [loading, setLoading] = useState<boolean>(() => !loadUserFromStorage());
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('idle');
  const [pendingUserName, setPendingUserName] = useState('');

  // Blocks onAuthStateChanged from touching state while signInWithGoogle runs
  const handlingSignInRef = useRef(false);

  const clearInviteStatus = () => {
    setInviteStatus('idle');
    setPendingUserName('');
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (handlingSignInRef.current) return;

      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          localStorage.setItem(STORAGE_TOKEN_KEY, token);

          const response = await api.get(`/users/${firebaseUser.uid}`);
          const userData: User = response.data;

          saveUserToStorage(userData, token);
          setInviteStatus('approved');
          setUser(userData);
        } catch {
          // API failed — if we already have a cached user, keep them logged in.
          // Only clear if we have no cached session at all.
          if (!loadUserFromStorage()) {
            clearStorage();
            setUser(null);
          }
        }
        setLoading(false);

      } else {
        // Firebase fired null.
        // If we have a user cached in localStorage, ignore this null event —
        // it could be a spurious Firebase init/token-refresh event.
        // Only an explicit logout() call may clear a cached session.
        if (loadUserFromStorage()) {
          setLoading(false);
          return;
        }

        // No cached user — genuinely logged out
        clearStorage();
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // signInWithGoogle: handles the full sign-in flow including invite gate
  const signInWithGoogle = async () => {
    handlingSignInRef.current = true;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      const token = await firebaseUser.getIdToken();
      localStorage.setItem(STORAGE_TOKEN_KEY, token);

      // ── STEP 1: Existing user? Restore immediately ──
      try {
        const response = await api.get(`/users/${firebaseUser.uid}`);
        const userData: User = response.data;
        saveUserToStorage(userData, token);
        setInviteStatus('approved');
        setUser(userData);
        setLoading(false);
        return;
      } catch {
        // Not in DB yet — fall through to invite gate
      }

      // ── STEP 2: New user — check invite gate ──
      const email = firebaseUser.email!;
      const displayName = firebaseUser.displayName || email.split('@')[0] || '';

      let inviteDbStatus = 'not_found';
      try {
        const invRes = await fetch(
          `/admin/admin.php/invite-status?email=${encodeURIComponent(email)}`
        );
        if (invRes.ok) {
          inviteDbStatus = (await invRes.json()).status ?? 'not_found';
        }
      } catch { /* treat as not_found */ }

      if (inviteDbStatus === 'rejected') {
        setInviteStatus('rejected');
        await signOut(auth);
        return;
      }

      if (inviteDbStatus === 'approved') {
        const response = await api.post('/users', {
          id: firebaseUser.uid,
          email,
          displayName,
          profileImageUrl: firebaseUser.photoURL,
        });
        const userData: User = response.data;
        saveUserToStorage(userData, token);
        setInviteStatus('approved');
        setUser(userData);
        setLoading(false);
        return;
      }

      // pending or not_found
      if (inviteDbStatus === 'not_found') {
        try {
          await fetch('/admin/admin.php/invite-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name: displayName }),
          });
        } catch { /* non-fatal */ }
      }

      setPendingUserName(displayName);
      setInviteStatus('pending');
      await signOut(auth);

    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    } finally {
      handlingSignInRef.current = false;
    }
  };

  const logout = async () => {
    try {
      // Clear storage BEFORE signOut so the null event sees no cached user
      clearStorage();
      setUser(null);
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const updateProfile = async (data: UpdateUserData) => {
    if (!user) return;

    try {
      const formData = new FormData();

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'profileImageFile' || key === 'coverImageFile') {
            formData.append(key, value as File);
          } else {
            formData.append(key, value as string);
          }
        }
      });

      const response = await api.put(`/users/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updatedUser: User = response.data;
      const token = localStorage.getItem(STORAGE_TOKEN_KEY) || '';
      saveUserToStorage(updatedUser, token);
      setUser(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    inviteStatus,
    pendingUserName,
    clearInviteStatus,
    signInWithGoogle,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
