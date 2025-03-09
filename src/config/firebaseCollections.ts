import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, orderBy, DocumentData, QuerySnapshot, DocumentSnapshot } from 'firebase/firestore';

// Collection names
export const USERS_COLLECTION = 'users';
export const ITEMS_COLLECTION = 'items';

// User interface
export interface User {
  uid: string;
  name: string;
  email: string;
  points: number;
  rank?: number; // Optional rank that can be calculated
  itemsUploaded: number;
  items: string[]; // Array of item IDs that the user has uploaded
  createdAt: Date;
  updatedAt: Date;
}

// Item interface
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface Item {
  id: string;
  userId: string;
  imageUrl: string;
  description?: string;
  recyclabilityScore?: number;
  resaleValue?: number;
  disposalInstructions?: string;
  classification?: 'e-waste' | 'waste' | 'recyclable';
  isVerified: boolean;
  verificationVideoUrl?: string;
  pointsAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to convert Firestore timestamp to Date
export function convertTimestampToDate(timestamp: FirestoreTimestamp | undefined): Date {
  if (!timestamp) return new Date();
  return new Date(timestamp.seconds * 1000);
}

// User Functions

/**
 * Create a new user in Firestore
 */
export const createUser = async (userData: Omit<User, 'createdAt' | 'updatedAt' | 'items'>) => {
  const userRef = doc(db, USERS_COLLECTION, userData.uid);
  const now = new Date();
  
  // Ensure all required fields are present with correct types
  const newUser: User = {
    uid: userData.uid,
    name: typeof userData.name === 'string' ? userData.name : 'Anonymous',
    email: typeof userData.email === 'string' ? userData.email : '',
    points: typeof userData.points === 'number' ? userData.points : 0,
    itemsUploaded: typeof userData.itemsUploaded === 'number' ? userData.itemsUploaded : 0,
    items: [], // Initialize with empty items array
    createdAt: now,
    updatedAt: now
  };
  
  // Save to Firestore, converting Date objects to Firestore timestamps
  await setDoc(userRef, {
    ...newUser,
    createdAt: now,
    updatedAt: now
  });
  
  return newUser;
};

/**
 * Get a user by their UID
 */
export const getUserById = async (uid: string): Promise<User | null> => {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data() as User;
  }
  
  return null;
};

/**
 * Update a user's information
 */
export const updateUser = async (uid: string, userData: Partial<Omit<User, 'uid' | 'createdAt'>>) => {
  const userRef = doc(db, USERS_COLLECTION, uid);
  
  // Get current user data
  const currentUserDoc = await getDoc(userRef);
  if (!currentUserDoc.exists()) {
    throw new Error(`User with ID ${uid} not found`);
  }
  
  const currentUserData = currentUserDoc.data();
  const now = new Date();
  
  // Merge current data with updates, ensuring type safety
  const updateData = {
    ...userData,
    name: typeof userData.name === 'string' ? userData.name : currentUserData.name || 'Anonymous',
    points: typeof userData.points === 'number' ? userData.points : currentUserData.points || 0,
    itemsUploaded: typeof userData.itemsUploaded === 'number' ? userData.itemsUploaded : currentUserData.itemsUploaded || 0,
    updatedAt: now
  };
  
  await updateDoc(userRef, updateData);
  
  // Return the updated user data
  const updatedUserDoc = await getDoc(userRef);
  if (!updatedUserDoc.exists()) {
    return null;
  }
  
  const updatedData = updatedUserDoc.data();
  return {
    ...updatedData,
    uid,
    name: updatedData.name || 'Anonymous',
    points: typeof updatedData.points === 'number' ? updatedData.points : 0,
    itemsUploaded: typeof updatedData.itemsUploaded === 'number' ? updatedData.itemsUploaded : 0,
    createdAt: convertTimestampToDate(updatedData.createdAt as FirestoreTimestamp),
    updatedAt: convertTimestampToDate(updatedData.updatedAt as FirestoreTimestamp)
  } as User;
};

/**
 * Add points to a user's account
 */
export const addPointsToUser = async (uid: string, pointsToAdd: number) => {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    throw new Error(`User with ID ${uid} not found`);
  }
  
  const userData = userSnap.data() as User;
  const newPoints = (userData.points || 0) + pointsToAdd;
  
  await updateDoc(userRef, {
    points: newPoints,
    updatedAt: new Date()
  });
  
  return { points: newPoints, itemsUploaded: userData.itemsUploaded };
};

/**
 * Get users sorted by points (for leaderboard)
 */
export const getLeaderboard = async (limit: number = 10) => {
  try {
    console.log('Fetching leaderboard data...');
    const usersRef = collection(db, USERS_COLLECTION);
    
    // Query users and order by points in descending order
    // Only fetch users who have points or items uploaded
    const q = query(
      usersRef,
      where('points', '>', 0),
      orderBy('points', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} users with points`);
    
    const users: Array<{
      uid: string;
      name: string;
      points: number;
      itemsUploaded: number;
      rank?: number;
    }> = [];

    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      console.log('Processing user data:', { id: doc.id, ...userData });
      
      // Extract user data with strict type checking
      if (typeof userData.points === 'number' || typeof userData.itemsUploaded === 'number') {
        const user = {
          uid: doc.id,
          name: typeof userData.name === 'string' ? userData.name : 'Anonymous',
          points: typeof userData.points === 'number' ? userData.points : 0,
          itemsUploaded: typeof userData.itemsUploaded === 'number' ? userData.itemsUploaded : 0
        };
        users.push(user);
      }
    });
    
    // Sort by points (in case Firestore order was not respected)
    users.sort((a, b) => b.points - a.points);
    
    // Add rank to each user
    users.forEach((user, index) => {
      user.rank = index + 1;
    });
    
    console.log('Final leaderboard data:', users);
    return users.slice(0, limit);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
};

// Item Functions

/**
 * Create a new item
 */
export const createItem = async (itemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'isVerified'>) => {
  const itemsRef = collection(db, ITEMS_COLLECTION);
  const newItemRef = doc(itemsRef);
  const now = new Date();
  
  const newItem: Item = {
    ...itemData,
    id: newItemRef.id,
    isVerified: false, // Items are unverified by default
    createdAt: now,
    updatedAt: now
  };
  
  await setDoc(newItemRef, newItem);
  
  // Update the user's items array to include this new item
  const userRef = doc(db, USERS_COLLECTION, itemData.userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data() as User;
    const updatedItems = [...(userData.items || []), newItem.id];
    const updatedItemsUploaded = (userData.itemsUploaded || 0) + 1;
    
    await updateDoc(userRef, {
      items: updatedItems,
      itemsUploaded: updatedItemsUploaded,
      updatedAt: now
    });
  }
  
  return newItem;
};

/**
 * Get an item by its ID
 */
export const getItemById = async (id: string): Promise<Item | null> => {
  const itemRef = doc(db, ITEMS_COLLECTION, id);
  const itemSnap = await getDoc(itemRef);
  
  if (itemSnap.exists()) {
    return itemSnap.data() as Item;
  }
  
  return null;
};

/**
 * Get all items for a specific user
 */
export const getUserItems = async (userId: string): Promise<Item[]> => {
  const itemsRef = collection(db, ITEMS_COLLECTION);
  const q = query(itemsRef, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  const items: Item[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const itemData: Item = {
      id: doc.id,
      userId: data.userId,
      imageUrl: data.imageUrl || '',
      description: data.description,
      recyclabilityScore: data.recyclabilityScore,
      resaleValue: data.resaleValue,
      disposalInstructions: data.disposalInstructions,
      classification: data.classification,
      isVerified: data.isVerified || false,
      verificationVideoUrl: data.verificationVideoUrl,
      pointsAwarded: data.pointsAwarded || 0,
      createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : new Date()
    };
    items.push(itemData);
  });
  
  return items;
};

/**
 * Update an item's information
 */
export const updateItem = async (id: string, itemData: Partial<Omit<Item, 'id' | 'userId' | 'createdAt'>>) => {
  const itemRef = doc(db, ITEMS_COLLECTION, id);
  const updateData = {
    ...itemData,
    updatedAt: new Date()
  };
  
  await updateDoc(itemRef, updateData);
  return updateData;
};

/**
 * Verify an item
 */
export const verifyItem = async (id: string, verificationVideoUrl: string, pointsAwarded: number) => {
  const itemRef = doc(db, ITEMS_COLLECTION, id);
  const itemSnap = await getDoc(itemRef);
  
  if (!itemSnap.exists()) {
    throw new Error(`Item with ID ${id} not found`);
  }
  
  const itemData = itemSnap.data() as Item;
  
  // Update the item
  await updateDoc(itemRef, {
    isVerified: true,
    verificationVideoUrl,
    pointsAwarded,
    updatedAt: new Date()
  });
  
  // Add points to the user
  await addPointsToUser(itemData.userId, pointsAwarded);
  
  return { success: true, pointsAwarded };
};

/**
 * Get all unverified items (for admin verification)
 */
export const getUnverifiedItems = async (limit: number = 20) => {
  const itemsRef = collection(db, ITEMS_COLLECTION);
  const q = query(itemsRef, where('isVerified', '==', false));
  const querySnapshot = await getDocs(q);
  
  const items: Item[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const itemData: Item = {
      id: doc.id,
      userId: data.userId,
      imageUrl: data.imageUrl || '',
      description: data.description,
      recyclabilityScore: data.recyclabilityScore,
      resaleValue: data.resaleValue,
      disposalInstructions: data.disposalInstructions,
      classification: data.classification,
      isVerified: data.isVerified || false,
      verificationVideoUrl: data.verificationVideoUrl,
      pointsAwarded: data.pointsAwarded || 0,
      createdAt: convertTimestampToDate(data.createdAt as FirestoreTimestamp),
      updatedAt: convertTimestampToDate(data.updatedAt as FirestoreTimestamp)
    };
    items.push(itemData);
  });
  
  // Sort by creation date (newest first)
  items.sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });
  
  return items.slice(0, limit);
};
