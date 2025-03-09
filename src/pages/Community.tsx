import { useState, useEffect } from 'react';
import { collection, query, orderBy, addDoc, getDocs, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ChatBubbleLeftIcon, HandThumbUpIcon, HandThumbDownIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface Post {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Timestamp;
  likes: number;  // Required with default 0
  dislikes: number;  // Required with default 0
  likedBy: string[];  // Required with default []
  dislikedBy: string[];  // Required with default []
  imageUrl?: string;
}

export default function Community() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    try {
      const q = query(
        collection(db, 'posts'),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const fetchedPosts = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure all required fields are present
        if (!data.userId || !data.username || !data.content || !data.timestamp) {
          console.error('Post is missing required fields:', doc.id);
          return null;
        }
        
        // Create a properly typed Post object
        const post: Post = {
          id: doc.id,
          userId: data.userId as string,
          username: data.username as string,
          content: data.content as string,
          timestamp: data.timestamp as Timestamp,
          likes: typeof data.likes === 'number' ? data.likes : 0,
          dislikes: typeof data.dislikes === 'number' ? data.dislikes : 0,
          likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
          dislikedBy: Array.isArray(data.dislikedBy) ? data.dislikedBy : [],
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined
        };
        return post;
      })
      .filter((post): post is Post => post !== null);
      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
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
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(compressedDataUrl);
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      setSelectedImage(file);
      compressImage(file)
        .then(compressedDataUrl => {
          setImagePreview(compressedDataUrl);
        })
        .catch(err => {
          console.error('Error compressing image:', err);
          setError('Error processing image. Please try again.');
        });
    }
  };

  async function handleSubmitPost(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if ((!newPost.trim() && !selectedImage) || !currentUser) {
      setError('Please enter a message or select an image');
      return;
    }

    try {
      let imageUrl: string | undefined;
      
      if (selectedImage && imagePreview) {
        // Use the compressed image preview instead of reading the file again
        imageUrl = imagePreview;
      }

      const postData: Omit<Post, 'id'> = {
        userId: currentUser.uid,
        username: currentUser.email?.split('@')[0] || 'Anonymous',
        content: newPost.trim(),
        timestamp: Timestamp.now(),
        likes: 0,
        dislikes: 0,
        likedBy: [],
        dislikedBy: []
      };

      // Only add imageUrl if we successfully converted the image
      if (imageUrl) {
        postData.imageUrl = imageUrl;
      }
      
      await addDoc(collection(db, 'posts'), postData);
      console.log('Post created successfully with image:', !!imageUrl);

      setNewPost('');
      setSelectedImage(null);
      setImagePreview(null);
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      setError('Failed to create post. Please try again.');
    }
  }

  const handleLike = async (post: Post) => {
    if (!currentUser) return;
    
    try {
      const postRef = doc(db, 'posts', post.id);
      const hasLiked = post.likedBy?.includes(currentUser.uid) || false;
      const hasDisliked = post.dislikedBy?.includes(currentUser.uid) || false;
      
      let newLikes = post.likes || 0;
      let newDislikes = post.dislikes || 0;
      let newLikedBy = [...(post.likedBy || [])];
      let newDislikedBy = [...(post.dislikedBy || [])];

      if (hasLiked) {
        // Unlike
        newLikes--;
        newLikedBy = newLikedBy.filter(id => id !== currentUser.uid);
      } else {
        // Like
        newLikes++;
        newLikedBy.push(currentUser.uid);
        if (hasDisliked) {
          // Remove dislike if exists
          newDislikes--;
          newDislikedBy = newDislikedBy.filter(id => id !== currentUser.uid);
        }
      }

      await updateDoc(postRef, {
        likes: newLikes,
        dislikes: newDislikes,
        likedBy: newLikedBy,
        dislikedBy: newDislikedBy
      });

      fetchPosts();
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleDislike = async (post: Post) => {
    if (!currentUser) return;
    
    try {
      const postRef = doc(db, 'posts', post.id);
      const hasDisliked = post.dislikedBy?.includes(currentUser.uid) || false;
      const hasLiked = post.likedBy?.includes(currentUser.uid) || false;
      
      let newDislikes = post.dislikes || 0;
      let newLikes = post.likes || 0;
      let newDislikedBy = [...(post.dislikedBy || [])];
      let newLikedBy = [...(post.likedBy || [])];

      if (hasDisliked) {
        // Remove dislike
        newDislikes--;
        newDislikedBy = newDislikedBy.filter(id => id !== currentUser.uid);
      } else {
        // Add dislike
        newDislikes++;
        newDislikedBy.push(currentUser.uid);
        if (hasLiked) {
          // Remove like if exists
          newLikes--;
          newLikedBy = newLikedBy.filter(id => id !== currentUser.uid);
        }
      }

      await updateDoc(postRef, {
        likes: newLikes,
        dislikes: newDislikes,
        likedBy: newLikedBy,
        dislikedBy: newDislikedBy
      });

      fetchPosts();
    } catch (error) {
      console.error('Error updating dislike:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Community
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Share your recycling tips and experiences with the community
            </p>

            {currentUser && (
              <form onSubmit={handleSubmitPost} className="mt-6">
                <div>
                  <label htmlFor="post" className="sr-only">
                    Post content
                  </label>
                  <textarea
                    id="post"
                    name="post"
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-base p-3 placeholder:text-gray-400"
                    placeholder="Share your recycling tip or experience..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                  />
                </div>
                <div className="mt-3">
                  {error && (
                    <div className="mb-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                  <label htmlFor="image" className="block text-sm font-medium text-gray-700">
                    Add an image (max 5MB)
                  </label>
                  <div className="mt-1 flex items-center space-x-4">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                      <PhotoIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                      Upload Image
                      <input
                        type="file"
                        id="image"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                    </label>
                    {imagePreview && (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="h-20 w-20 object-cover rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setImagePreview(null);
                          }}
                          className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 text-xs"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    Post
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 flow-root">
              <ul role="list" className="-mb-8">
                {posts.map((post, postIdx) => (
                  <li key={post.id}>
                    <div className="relative pb-8">
                      {postIdx !== posts.length - 1 ? (
                        <span
                          className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex items-start space-x-3">
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500">
                            <ChatBubbleLeftIcon className="h-5 w-5 text-white" aria-hidden="true" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <div className="text-sm">
                              <span className="font-medium text-gray-900">{post.username}</span>
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500">
                              {post.timestamp.toDate().toLocaleDateString()}
                            </p>
                          </div>
                          <div className="mt-2 text-sm text-gray-700">
                            <p>{post.content}</p>
                            {post.imageUrl && (
                              <img
                                src={post.imageUrl}
                                alt="Post image"
                                className="mt-2 max-h-96 rounded-lg object-cover"
                              />
                            )}
                          </div>
                          <div className="mt-2 flex items-center space-x-4">
                            <button
                              type="button"
                              onClick={() => handleLike(post)}
                              className={`inline-flex items-center space-x-1 ${
                                currentUser && post.likedBy?.includes(currentUser.uid)
                                  ? 'text-green-600' 
                                  : 'text-gray-400 hover:text-gray-500'
                              }`}
                            >
                              <HandThumbUpIcon className="h-5 w-5" />
                              <span className="font-medium">{post.likes}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDislike(post)}
                              className={`inline-flex items-center space-x-1 ${
                                currentUser && post.dislikedBy?.includes(currentUser.uid)
                                  ? 'text-red-600' 
                                  : 'text-gray-400 hover:text-gray-500'
                              }`}
                            >
                              <HandThumbDownIcon className="h-5 w-5" />
                              <span className="font-medium">{post.dislikes}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
