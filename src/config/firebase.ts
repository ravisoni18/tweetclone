import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBGGPT6EW0aSR2PoW8WuGouJt8VcoI4BDQ",
  authDomain: "patr-4829d.firebaseapp.com",
  projectId: "patr-4829d",
  storageBucket: "patr-4829d.firebasestorage.app",
  messagingSenderId: "964264491610",
  appId: "1:964264491610:web:ccd38cb9d1f00e91a4f663",
  measurementId: "G-86DQFB6D12"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
