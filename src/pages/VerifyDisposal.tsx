import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { VideoCameraIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { verifyItem, getItemById } from '../config/firebaseCollections';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface LocationState {
  itemId: string;
}

const genAI = new GoogleGenerativeAI("AIzaSyASw6ErJZha2wRFE-nf-NfnYHRimdnLJ_Y");

export default function VerifyDisposal() {
  const [video, setVideo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; reason?: string } | null>(null);
  const [item, setItem] = useState<any>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const { itemId } = location.state as LocationState;

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setLoading(true);
        setError('');
        const itemData = await getItemById(itemId);
        if (!itemData) {
          setError('Item not found');
          return;
        }
        if (!itemData.disposalInstructions || !itemData.classification) {
          setError('Item data is incomplete. Please try uploading the item again.');
          return;
        }
        setItem(itemData);
      } catch (err) {
        console.error('Error fetching item:', err);
        setError('Failed to fetch item details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [itemId]);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideo(e.target.files[0]);
    }
  };

  const MAX_VIDEO_DURATION = 30; // 30 seconds max

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!video || !currentUser) {
      setError('Please select a video to upload');
      return;
    }
  
    // Check video duration
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.src = URL.createObjectURL(video);
  
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        URL.revokeObjectURL(videoElement.src);
        if (videoElement.duration > MAX_VIDEO_DURATION) {
          setError(`Video is too long. Please upload a video shorter than ${MAX_VIDEO_DURATION} seconds.`);
          resolve(false);
        } else {
          resolve(true);
        }
      };
      videoElement.onerror = () => {
        URL.revokeObjectURL(videoElement.src);
        setError('Error reading video file. Please try again.');
        resolve(false);
      };
    });
  
    if (videoElement.duration > MAX_VIDEO_DURATION) {
      return;
    }
    if (!item) {
      setError('Item data is not loaded yet. Please try again.');
      return;
    }
    if (!item.disposalInstructions || !item.classification) {
      setError('Item data is incomplete. Please try uploading the item again.');
      return;
    }
  
    try {
      setLoading(true);
      setError('');
      setVerificationResult(null);
  
      // Convert video to base64
      const videoReader = new FileReader();
      videoReader.onloadend = async () => {
        if (videoReader.result) {
          const videoBase64 = (videoReader.result as string).split(',')[1];
  
          const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-pro' });
  
          if (!video.type.startsWith('video/')) {
            setVerificationResult({
              success: false,
              reason: 'Please upload a video file (MP4, MOV, etc.), not an image or other file type.',
            });
            setLoading(false);
            return;
          }
  
          // Check video size
          const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
          if (video.size > MAX_VIDEO_SIZE) {
            setVerificationResult({
              success: false,
              reason: 'Video file is too large. Please upload a video smaller than 100MB.',
            });
            setLoading(false);
            return;
          }
  
          // Check if item data is available
          if (!item?.imageUrl) {
            setError('Item image is missing. Please try uploading the item again.');
            setLoading(false);
            return;
          }
  
          // Show loading message
          setVerificationResult({
            success: false,
            reason: 'Analyzing your video... This may take a few moments. Please be patient!',
          });
  
          // Add a timeout to prevent hanging if the analysis takes too long
          const analysisTimeout = setTimeout(() => {
            if (!verificationResult?.success) {
              setError('Video analysis is taking longer than expected. Please try again with a shorter video.');
              setLoading(false);
            }
          }, 30000); // 30 second timeout
  
          try {
            const result = await model.generateContent([
              {
                inlineData: {
                  data: videoBase64,
                  mimeType: video.type,
                },
              },
              {
                inlineData: {
                  data: item?.imageUrl?.split(',')[1] || '',
                  mimeType: 'image/jpeg',
                },
              },
              `You are verifying if this video shows proper disposal of an item. The item should be disposed of SOMEWHAT according to these instructions: ${item.disposalInstructions}\n\nIt is ok if they put it in trash OR recycle, as long as they vaguely represent disposing of the very item they described. Be VERY lenient in your verification. If the video shows a reasonable attempt to follow the disposal instructions, even if not EVERYTHING is followed, consider it valid.\n\nIf the disposal shown in the video is acceptable, respond with exactly: "[YES]"\nIf not, respond with exactly: "[NO]" followed by a clear explanation of why the disposal was not acceptable. Write the explanation as a normal sentence without any brackets.`,
            ]);
  
            const verificationText = result.response.text().trim();
            console.log(verificationText);
  
            clearTimeout(analysisTimeout);
  
            // Extract the verification result
            const isSuccess = verificationText.toLowerCase().includes('[yes]');
            let reason = '';
            
            if (!isSuccess) {
              // Extract the reason from [NO] [reason] format
              // Extract everything after [NO]
              const match = verificationText.match(/\[NO\]\s*(.*)/i);
              reason = match ? match[1].trim() : verificationText;
            }
            
            if (isSuccess) {
              let pointsToAward = 0;
              switch (item.classification.toLowerCase()) {
                case 'e-waste':
                  pointsToAward = 50;
                  break;
                case 'recyclable':
                  pointsToAward = 20;
                  break;
                default:
                  pointsToAward = 5;
              }
  
              await verifyItem(itemId, 'verified', pointsToAward);
  
              setVerificationResult({ success: true });
              setSuccess(true);
              setTimeout(() => {
                setLoading(false);
              }, 3000);
            } else {
              setVerificationResult({
                success: false,
                reason: reason,
              });
              setLoading(false);
            }
          } catch (error) {
            console.error('Error during video verification:', error);
            setError('An error occurred during video verification. Please try again.');
            setLoading(false);
          }
        }
      };
  
      videoReader.readAsDataURL(video);
    } catch (err) {
      console.error('Error during disposal verification:', err);
      setError('Failed to verify disposal. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-center">
                <XCircleIcon className="mx-auto h-12 w-12 text-red-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">{error}</h3>
                <div className="mt-6">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-center">
                <h3 className="text-sm font-medium text-gray-900">Loading item data...</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Verify Disposal</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <div className="space-y-2">
                <p>Upload a short video (max 100MB) showing how you disposed of or recycled the item.</p>
                <ul className="list-disc list-inside text-sm text-gray-600 pl-4">
                  <li>The video should show you actively handling and disposing of the item</li>
                  <li>Don't worry about being perfect - we just want to see a reasonable attempt!</li>
                  <li>Make sure to follow the basic disposal instructions: {item?.disposalInstructions}</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative" role="alert">
                {error}
              </div>
            )}

            {verificationResult ? (
              verificationResult.success ? (
                <div className="mt-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded relative">
                  <div className="flex items-center">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <span>Verification successful! You may return to the dashboard.</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative mb-4">
                    <div className="flex items-center">
                      <XCircleIcon className="h-5 w-5 mr-2" />
                      <span>{verificationResult.reason}</span>
                    </div>
                  </div>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => {
                        setVerificationResult(null);
                        setVideo(null);
                        if (videoInputRef.current) {
                          videoInputRef.current.value = '';
                        }
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </div>
              )
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-6">
                <div className="mt-1 flex justify-center rounded-md border-2 border-dashed border-gray-300 px-6 pt-5 pb-6">
                  <div className="space-y-1 text-center">
                    <VideoCameraIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="video-upload"
                        className="relative cursor-pointer rounded-md bg-white font-medium text-green-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 hover:text-green-500"
                      >
                        <span>Upload a video</span>
                        <input
                          id="video-upload"
                          name="video-upload"
                          type="file"
                          className="sr-only"
                          accept="video/*"
                          ref={videoInputRef}
                          onChange={handleVideoChange}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">MP4, MOV up to 100MB</p>
                  </div>
                </div>

                {video && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">Selected video: {video.name}</p>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={!video || loading}
                    className="inline-flex justify-center rounded-md border border-transparent bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Submit for Verification'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
