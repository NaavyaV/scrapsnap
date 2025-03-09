import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBGYedksSbQg1AZWXmReyZXBA5VfvWANlg",
  authDomain: "scrapsnap-c5eca.firebaseapp.com",
  projectId: "scrapsnap-c5eca",
  storageBucket: "scrapsnap-c5eca.firebasestorage.app",
  messagingSenderId: "293205373517",
  appId: "1:293205373517:web:a27b881b429f4b053b2204"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Enable persistent auth state
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting auth persistence:', error);
});
export const db = getFirestore(app);
export const storage = getStorage(app);

// Sign Up Function
export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

// Sign In Function
export const signIn = async (email: string, password: string) => {
  try {
    // Ensure persistence is set before signing in
    await setPersistence(auth, browserLocalPersistence);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

// Logout Function
export const logout = async () => {
  try {
    await signOut(auth);
    console.log('User signed out');
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};
