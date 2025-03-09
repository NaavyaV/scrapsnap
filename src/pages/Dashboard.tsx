import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserItems, getLeaderboard, FirestoreTimestamp, convertTimestampToDate, getUserById } from '../config/firebaseCollections';
import {
  ChartBarIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  TrashIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  FolderIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
// Edit Profile Modal component
const EditProfileModal = ({ isOpen, onClose, userData, onSave }: { 
  isOpen: boolean; 
  onClose: () => void; 
  userData: any; 
  onSave: (name: string) => void;
 }) => {
  const [name, setName] = useState(userData?.name || '');
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave(name);
    setIsSaving(false);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface UserStats {
  totalPoints: number;
  itemsRecycled: number;
  rank: number;
  recentItems: {
    id: string;
    type: string;
    points: number;
    timestamp: Date;
    imageUrl?: string;
  }[];
}

const ITEM_TYPE_ICONS = {
  'e-waste': DevicePhoneMobileIcon,
  'electronics': ComputerDesktopIcon,
  'recyclable': TrashIcon,
};

export default function Dashboard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{ uid: string; name: string; points: number; itemsUploaded: number }>>([]);
  const { currentUser, userData, updateUser } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Separate effect for leaderboard
  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        console.log('Starting leaderboard fetch...');
        const leaderboardData = await getLeaderboard(10);
        console.log('Raw leaderboard data:', leaderboardData);
        
        if (!Array.isArray(leaderboardData)) {
          console.error('Invalid leaderboard data format');
          return;
        }
        
        // Ensure we have all required fields and sort by points
        const validatedData = leaderboardData
          .map(user => ({
            uid: user.uid || '',
            name: typeof user.name === 'string' ? user.name : 'Anonymous',
            points: typeof user.points === 'number' ? user.points : 0,
            itemsUploaded: typeof user.itemsUploaded === 'number' ? user.itemsUploaded : 0
          }))
          .sort((a, b) => b.points - a.points);
        
        console.log('Validated and sorted leaderboard data:', validatedData);
        setLeaderboard(validatedData);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      }
    }
    
    // Initial fetch
    fetchLeaderboard();
    
    // Refresh leaderboard every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchUserStats() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Fetch user's items using our new collection function
        const fetchedItems = await getUserItems(currentUser.uid);
        setItems(fetchedItems);
        
        // Filter for verified items only
        const verifiedItems = fetchedItems.filter(item => item.isVerified);
        
        // Get leaderboard to determine rank
        const leaderboard = await getLeaderboard(100);
        const userRank = leaderboard.findIndex(user => user.uid === currentUser.uid) + 1;
        
        // Get fresh user data to ensure we have the latest points
        const freshUserData = await getUserById(currentUser.uid);
        const totalPoints = freshUserData?.points || 0;
        
        // Get recent items, sorted by creation date
        const recentItems = fetchedItems
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 5)
          .map(item => ({
            id: item.id,
            type: item.classification || 'waste',
            points: item.pointsAwarded || 0,
            timestamp: item.createdAt,
            imageUrl: item.imageUrl
          }));

        setStats({
          totalPoints,
          itemsRecycled: verifiedItems.length,
          rank: userRank || 1,
          recentItems,
        });
      } catch (error) {
        console.error('Error fetching user stats:', error);
        // Set default stats in case of error
        setStats({
          totalPoints: 0,
          itemsRecycled: 0,
          rank: 1,
          recentItems: [],
        });
      } finally {
        setLoading(false);
      }
    }

    fetchUserStats();
  }, [currentUser, userData]);

  const handleEditProfileClick = () => {
    setIsModalOpen(true);
  };
  
  const handleSaveProfile = async (name: string) => {
    if (!currentUser) return;
    
    try {
      await updateUser(currentUser.uid, { name });
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };
  
  const handleViewItem = (itemId: string) => {
    navigate(`/results`, { state: { itemId } });
  };

  if (loading && currentUser && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 flex flex-col space-y-6">
      {/* Full-width User Info Section */}
      <div className="bg-white shadow rounded-lg p-6 w-full">
        {userData ? (
          <div className="flex justify-between items-start">
            <div>
              <p className="text-2xl font-semibold">Hi, {userData.name || 'User'}</p>
              <p className="text-gray-600">{userData.email}</p>
            </div>
            <button 
              onClick={handleEditProfileClick}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Edit Profile
            </button>
          </div>
        ) : (
          <p>No user is signed in.</p>
        )}
        <EditProfileModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          userData={userData} 
          onSave={handleSaveProfile} 
        />
      </div>
  
      {/* Bottom Section: Grid Layout with Scrollable Views */}
      <div className="grid grid-cols-3 gap-6 h-[60vh]">
        {/* Leaderboard Section */}
        <div className="bg-white shadow rounded-lg p-6 overflow-y-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Recyclers</h3>
          <div className="space-y-4">
            {leaderboard.map((user, index) => (
              <div
                key={user.uid || index}
                className={`flex items-center justify-between p-4 rounded-lg 
                  ${index === 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold 
                    ${index === 0 ? 'bg-yellow-100 text-yellow-800' : 
                      index === 1 ? 'bg-gray-100 text-gray-800' : 
                      index === 2 ? 'bg-orange-100 text-orange-800' : 'bg-gray-200 text-gray-600'}`}
                  >
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name || 'Anonymous'}</p>
                    <p className="text-sm text-gray-500">
                      <span className="font-medium">{user.itemsUploaded || 0}</span> {(user.itemsUploaded || 0) === 1 ? 'item' : 'items'} recycled
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-green-600">
                  {user.points.toLocaleString()} points
                </p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Stats Section */}
        <div className="bg-white shadow rounded-lg p-6 overflow-y-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Your Stats</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-green-50 p-4 rounded-lg flex items-center">
              <TrophyIcon className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Total Points</p>
                <p className="text-xl font-semibold">{stats?.totalPoints || 0}</p>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg flex items-center">
              <ChartBarIcon className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-500">{(stats?.itemsRecycled || 0) === 1 ? 'Item' : 'Items'} Recycled</p>
                <p className="text-xl font-semibold">{stats?.itemsRecycled || 0}</p>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg flex items-center">
              <ClockIcon className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Current Rank</p>
                <p className="text-xl font-semibold">#{stats?.rank || '-'}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Activity Section */}
        <div className="bg-white shadow rounded-lg p-6 overflow-y-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {stats?.recentItems?.map((item) => (
              <div
                key={item.id}
                className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                onClick={() => handleViewItem(item.id)}
              >
                <img
                  src={item.imageUrl || 'https://via.placeholder.com/48?text=No+Image'}
                  alt={item.type}
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.type}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {item.points > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    +{item.points} points
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
