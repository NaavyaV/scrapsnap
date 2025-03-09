import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { getItemById } from '../config/firebaseCollections';

interface LocationState {
  itemId: string;
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  
  // Extract itemId from location state
  const itemId = location.state?.itemId;

  useEffect(() => {
    const fetchItem = async () => {
      if (!itemId) {
        console.error('No item ID provided');
        setLoading(false);
        return;
      }
      
      try {
        // Fetch the item from Firestore to ensure we have the latest data
        const itemData = await getItemById(itemId);
        if (itemData) {
          setItem(itemData);
        } else {
          console.error('Item not found');
        }
      } catch (error) {
        console.error('Error fetching item:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchItem();
  }, [itemId]);

  if (loading) {
    return (
      <div className="flex justify-center mt-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  if (!itemId) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-red-600">Error</h2>
          <p className="mt-2">No item ID was provided. Please return to the dashboard and try again.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  if (!item) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-red-600">Item Not Found</h2>
          <p className="mt-2">The requested item could not be found. It may have been deleted.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'e-waste':
        return 'bg-red-100 text-red-800';
      case 'recyclable':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Use the item data from Firestore
  const score = item?.recyclabilityScore || 0;
  const resaleValue = item?.resaleValue || 0;
  const classificationType = item?.classification || 'Waste';
  const disposalInstructions = item?.disposalInstructions || 'No disposal instructions available.';
  
  // Check if item is waste (case insensitive)
  const isWaste = classificationType.toLowerCase() === 'waste';

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-2xl mb-6 text-center font-semibold">Classification Result</h2>
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Gemini API Results</h3>
              <span
                className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium ${getTypeColor(
                  classificationType
                )}`}
              >
                {classificationType}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <img
                  src={item?.imageUrl}
                  alt="Uploaded item"
                  className="w-full rounded-lg object-contain shadow-lg"
                  style={{ maxHeight: '300px', maxWidth: '100%' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = 'https://via.placeholder.com/300x200?text=No+Image+Available';
                  }}
                />
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Recyclability Score</h4>
                  <p className={`mt-1 text-3xl font-semibold ${getScoreColor(score)}`}>
                    {score}/100
                  </p>
                </div>

                {resaleValue > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Estimated Resale Value</h4>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">${resaleValue}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-500">Disposal Instructions</h4>
                  <div className="mt-2 rounded-md bg-blue-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <InformationCircleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-blue-700">{disposalInstructions}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  {isWaste ? (
                    <div className="text-gray-500 mb-2">
                      <p className="text-sm italic">Verification is not available for waste items.</p>
                    </div>
                  ) : null}
                  <button
                    onClick={() => navigate('/verify', { state: { itemId } })}
                    className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isWaste || item?.isVerified 
                        ? 'border-gray-300 bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'border-transparent bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                    }`}
                    disabled={isWaste || item?.isVerified}
                  >
                    <CheckCircleIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                    {item?.isVerified 
                      ? 'Already Verified' 
                      : isWaste 
                        ? 'Cannot Verify Waste' 
                        : 'Verify Disposal'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
