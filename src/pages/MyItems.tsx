import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserItems, FirestoreTimestamp, convertTimestampToDate } from '../config/firebaseCollections';
import {
  DevicePhoneMobileIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface Item {
  id: string;
  userId: string;
  classification?: string;
  recyclabilityScore?: number;
  disposalInstructions?: string;
  isVerified: boolean;
  imageUrl: string;
  description?: string;
  resaleValue?: number;
  verificationVideoUrl?: string;
  pointsAwarded: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function MyItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchItems() {
      if (!currentUser) {
        setLoading(false);
        setError('Please log in to view your items');
        return;
      }

      try {
        setError(null);
        const fetchedItems = await getUserItems(currentUser.uid);
        // Sort by creation date (newest first)
        const sortedItems = fetchedItems.sort((a, b) => {
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        console.log('Fetched items:', fetchedItems);
        setItems(sortedItems);
      } catch (error) {
        console.error('Error fetching items:', error);
        setError('Failed to load items. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, [currentUser]);

  const handleViewItem = (itemId: string) => {
    navigate('/results', { state: { itemId } });
  };

  const handleVerifyItem = (itemId: string) => {
    navigate('/verify', { state: { itemId } });
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please log in to view your items</p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-8">My Items</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-200"
            >
              <div className="aspect-w-16 aspect-h-9">
                <img
                  src={item.imageUrl}
                  alt="Item"
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = 'https://via.placeholder.com/300x200?text=No+Image';
                  }}
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    (item.classification || '').toLowerCase() === 'e-waste' 
                      ? 'bg-red-100 text-red-800'
                      : (item.classification || '').toLowerCase() === 'recyclable'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.classification || 'Unclassified'}
                  </span>
                  <span className="text-sm text-gray-500">
                    Score: {item.recyclabilityScore || 0}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2 mb-4">
                  {item.isVerified ? (
                    <div className="flex items-center text-green-600 text-sm">
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      <span>Verified ({item.pointsAwarded || 0} points)</span>
                    </div>
                  ) : (item.classification || '').toLowerCase() !== 'waste' ? (
                    <div className="flex items-center text-yellow-600 text-sm">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      <span>Pending Verification</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-600 text-sm">
                      <TrashIcon className="h-4 w-4 mr-1" />
                      <span>Cannot be verified</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => handleViewItem(item.id)}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    View Details
                  </button>
                  {!item.isVerified && (item.classification || '').toLowerCase() !== 'waste' && (
                    <button
                      onClick={() => handleVerifyItem(item.id)}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      Verify Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No items found. Start by uploading some items!</p>
            <button
              onClick={() => navigate('/upload')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            >
              Upload Item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
