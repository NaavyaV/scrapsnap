import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createItem } from '../config/firebaseCollections';

const genAI = new GoogleGenerativeAI("AIzaSyASw6ErJZha2wRFE-nf-NfnYHRimdnLJ_Y");

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !currentUser) return;

    try {
      setLoading(true);
      setError('');

      // Compress and process image
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (reader.result) {
          // Create an image element to compress
          const img = new Image();
          img.src = reader.result as string;
          
          await new Promise((resolve) => {
            img.onload = resolve;
          });
          
          // Create a canvas to compress the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate new dimensions (max 800px width/height while maintaining aspect ratio)
          let width = img.width;
          let height = img.height;
          const maxDimension = 800;
          
          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw and compress image
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6); // Compress to JPEG with 60% quality
          
          // Get base64 data for Gemini API
          const base64data = compressedDataUrl.split(',')[1];

          const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-pro' });

          const result = await model.generateContent([
            {
              inlineData: {
                data: base64data,
                mimeType: "image/jpeg"
              }
            },
            `You are a lenient recycling assistant. Your goal is to encourage recycling whenever possible.

Analyze this image and classify it into one of these categories: "Recyclable", "E-Waste", or "Waste". Be generous in classification:
- If the item has ANY recyclable components (paper, cardboard, plastic, glass, metal), classify as "Recyclable"
- If it's any kind of electronics or contains electronic parts, classify as "E-Waste"
- Only classify as "Waste" if you're absolutely certain it cannot be recycled or contains hazardous materials

Provide your response in EXACTLY this format: "[Score] [Resale value] [Classification] [Disposal Instructions]". Include the square brackets in your answer.

Where:
- Score: A number 0-100 indicating recyclability (be generous, most items should score 50+)
- Resale value: Estimated value in dollars (0 if not resalable)
- Classification: ONLY use "Recyclable", "E-Waste", or "Waste"
- Disposal Instructions: 2-3 SPECIFIC, actionable steps for proper disposal

Here's what I see in the image: ${description}`
          ]);

          const classificationString = result.response.text();
          console.log(classificationString);
          // Parse the classification data
          const classificationData = classificationString.match(/\[(.*?)\]/g)?.map((s: string) => s.slice(1, -1)) || [];
          const score = parseInt(classificationData[0]) || 0;
          const resaleValue = parseFloat(classificationData[1]) || 0;
          
          // Ensure classification is one of the three allowed values (case insensitive)
          let classificationType = 'Waste'; // Default to Waste
          if (classificationData[2]) {
            const type = classificationData[2].trim().toLowerCase();
            if (type === 'e-waste' || type === 'ewaste') {
              classificationType = 'E-Waste';
            } else if (type === 'recyclable') {
              classificationType = 'Recyclable';
            } else {
              classificationType = 'Waste';
            }
          }
          
          const disposalInstructions = classificationData[3] || '';

          // Create item in Firestore with all data
          const itemData: any = {
            userId: currentUser.uid,
            imageUrl: compressedDataUrl,
            recyclabilityScore: score,
            disposalInstructions: disposalInstructions || '',
            classification: classificationType,
            pointsAwarded: 0,
            resaleValue: resaleValue || 0
          };
          
          if (description && description.trim() !== '') {
            itemData.description = description;
          }
          
          const newItem = await createItem(itemData);

          // Navigate to results page with just the ID
          navigate('/results', {
            state: {
              itemId: newItem.id
            }
          });
        } else {
          console.error('Failed to read file as base64.');
          setError('Failed to process image');
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to upload item');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {loading ? (
        <div className="text-center">
          <h2 className="text-lg font-semibold">Processing your image...</h2>
          <p>Please wait while we analyze the uploaded image.</p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Upload Item</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Upload a photo of your item and we'll help you determine how to properly recycle or dispose of it.</p>
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-6">
                <div
                  className="mt-1 flex justify-center rounded-md border-2 border-dashed border-gray-300 px-6 pt-5 pb-6"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer rounded-md bg-white font-medium text-green-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 hover:text-green-500"
                      >
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>

                {file && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">Selected file: {file.name}</p>
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="Image preview" 
                      className="mt-4 rounded-md w-full max-w-[400px] h-auto object-contain"
                    />

                  </div>
                )}

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description (optional)
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="description"
                      name="description"
                      rows={3}
                      className="block w-full rounded-lg border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-green-600 text-sm leading-6 bg-white/60 backdrop-blur-sm"
                      placeholder="Add any additional details about the item..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={!file || loading}
                    className="inline-flex justify-center rounded-md border border-transparent bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {loading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
