import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { TrophyIcon } from '@heroicons/react/24/outline';

interface UserScore {
  id: string;
  name: string;
  points: number;
  items: string[];
}

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState<UserScore[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        setError(null);

        // Fetch top 10 users
        const q = query(
          collection(db, 'users'),
          orderBy('points', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setTopUsers([]);
          return;
        }

        const users = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Anonymous',
            points: typeof data.points === 'number' ? data.points : 0,
            items: Array.isArray(data.items) ? data.items : []
          };
        }) as UserScore[];

        // Sort by points in descending order
        users.sort((a, b) => b.points - a.points);
        setTopUsers(users);
        console.log('Fetched leaderboard:', users);

        // Find current user's rank if logged in
        if (currentUser) {
          const allUsersQuery = query(
            collection(db, 'users'),
            orderBy('points', 'desc')
          );
          const allUsers = await getDocs(allUsersQuery);
          const rank = allUsers.docs.findIndex((doc) => doc.id === currentUser.uid) + 1;
          setUserRank(rank > 0 ? rank : null);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setError('Unable to load leaderboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [currentUser]);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <TrophyIcon className="h-6 w-6 text-yellow-400" />;
      case 2:
        return <TrophyIcon className="h-6 w-6 text-gray-400" />;
      case 3:
        return <TrophyIcon className="h-6 w-6 text-amber-700" />;
      default:
        return null;
    }
  };

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
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full">
        <div className="bg-white shadow rounded-xl">
          <div className="px-6 py-6">
            <div className="flex justify-between items-center border-b border-gray-200 pb-6">
              <div>
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:tracking-tight">
                  Leaderboard
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  Top recyclers making a difference in our community
                </p>
              </div>
              {currentUser && userRank && userRank > 10 && (
                <div className="flex items-center bg-green-50 rounded-lg px-4 py-2">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">Your Rank</p>
                    <p className="text-2xl font-bold text-green-600">#{userRank}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="overflow-hidden bg-gray-50 rounded-xl border border-gray-200">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 bg-white">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th scope="col" className="py-4 pl-6 pr-3 text-left text-sm font-semibold text-gray-900 w-24">
                        Rank
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-1/3">
                        User
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-900 w-1/4">
                        Points
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                        Items Recycled
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {topUsers.map((user, index) => (
                      <tr key={user.id} className={`${user.id === currentUser?.uid ? 'bg-green-50' : 'hover:bg-gray-50'} transition-colors duration-150`}>
                        <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm">

                          <div className="flex items-center">
                            {getRankBadge(index + 1)}
                            <span className={index < 3 ? 'ml-2 font-semibold' : ''}>#{index + 1}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {user.name}
                          {user.id === currentUser?.uid && ' (You)'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {user.points.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <span className="font-medium">{user.items.length.toLocaleString()}</span>
                            <span className="ml-1">{user.items.length === 1 ? 'item' : 'items'}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
