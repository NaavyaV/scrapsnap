import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { User, getUserById, createUser, updateUser as updateUserInFirestore } from '../config/firebaseCollections';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (uid: string, userData: Partial<Omit<User, 'uid' | 'createdAt'>>) => Promise<User | null>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  // Fetch user data from Firestore when Firebase Auth user changes
  useEffect(() => {
    if (!initializing && currentUser) {
      const fetchUserData = async () => {
        try {
          console.log('Fetching user data for:', currentUser.uid);
          const userDoc = await getUserById(currentUser.uid);
          
          if (userDoc) {
            console.log('User data found:', userDoc);
            setUserData(userDoc);
          } else {
            // If user doesn't exist in Firestore yet, create a basic record
            console.log('User data not found in Firestore, creating default record');
            const newUser = await createUser({
              uid: currentUser.uid,
              name: currentUser.displayName || 'User',
              email: currentUser.email || '',
              points: 0,
              itemsUploaded: 0
            });
            setUserData(newUser);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchUserData();
    } else if (!initializing) {
      setUserData(null);
      setLoading(false);
    }
  }, [currentUser]);

  async function signup(email: string, password: string, name: string) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    setCurrentUser(userCredential.user);
    
    // Create user document in Firestore
    await createUser({
      uid: userCredential.user.uid,
      name,
      email,
      points: 0,
      itemsUploaded: 0
    });
  }

  async function login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    setCurrentUser(userCredential.user);
  }

  async function logout() {
    await signOut(auth);
    setCurrentUser(null);
    setUserData(null);
  }
  
  async function updateUser(uid: string, userData: Partial<Omit<User, 'uid' | 'createdAt'>>) {
    const updatedUser = await updateUserInFirestore(uid, userData);
    if (updatedUser && currentUser?.uid === uid) {
      setUserData(updatedUser as User);
    }
    return updatedUser;
  }

  // Handle Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'logged in' : 'logged out');
      setCurrentUser(user);
      setInitializing(false);
      if (!user) {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    signup,
    login,
    logout,
    updateUser,
    loading
  };

  // Only show loading state during initial auth check
  if (initializing) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
    </div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
