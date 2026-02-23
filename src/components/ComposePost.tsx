import React, { useState, useEffect } from 'react';
import { Image, Video, X, Globe, Users, Lock, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../config/firebase';
import ArticleEditor from './ArticleEditor';

interface ComposePostProps {
  onPostCreated?: (newPost: any) => void;
  autoFocus?: boolean;
}

// Media resizing utility functions
const resizeImage = (file: File, maxSizeMB: number = 2, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = document.createElement('img');
    
    img.onload = () => {
      // Calculate new dimensions to maintain aspect ratio
      let { width, height } = img;
      const maxDimension = 1920; // Max width or height
      
      if (width > height && width > maxDimension) {
        height = (height * maxDimension) / width;
        width = maxDimension;
      } else if (height > maxDimension) {
        width = (width * maxDimension) / height;
        height = maxDimension;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Convert to blob with quality compression
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            
            console.log(`📷 Image resized: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(resizedFile.size / 1024 / 1024).toFixed(2)}MB`);
            
            // Check if still too large, reduce quality further
            if (resizedFile.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
              console.log('🔄 Still too large, reducing quality further...');
              resizeImage(file, maxSizeMB, quality - 0.2).then(resolve).catch(reject);
            } else {
              resolve(resizedFile);
            }
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type,
        quality
      );
      
      // Clean up object URL
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// Video compression utility (basic)
const compressVideo = async (file: File, maxSizeMB: number = 10): Promise<File> => {
  // For now, we'll just validate size and return as-is
  // In a real app, you might use libraries like ffmpeg.wasm for video compression
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`Video file is too large. Maximum size is ${maxSizeMB}MB`);
  }
  
  console.log(`🎥 Video accepted: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
  return file;
};

const ComposePost: React.FC<ComposePostProps> = ({ onPostCreated, autoFocus = false }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [privacy, setPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [isMobile, setIsMobile] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showArticleEditor, setShowArticleEditor] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Clear validation error when content changes
  useEffect(() => {
    if (validationError && content.trim()) {
      setValidationError(null);
    }
  }, [content, validationError]);

  // Helper function to get Firebase auth token
  const getAuthToken = async (): Promise<string> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log('No Firebase user found');
        return '';
      }
      
      const token = await currentUser.getIdToken(true);
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return '';
    }
  };

  // Auto-focus the textarea when autoFocus is true (desktop only)
  useEffect(() => {
    if (autoFocus && !isMobile) {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        setTimeout(() => textarea.focus(), 100);
      }
    }
  }, [autoFocus, isMobile]);

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingMedia(true);
      console.log(`📁 ${type} selected: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type}`);

      let processedFile = file;
      
      if (type === 'image') {
        // Validate image type
        if (!file.type.startsWith('image/')) {
          throw new Error('Please select a valid image file');
        }
        
        // Process image if needed
        const maxSizeMB = 5; // Increased for better quality
        if (file.size > maxSizeMB * 1024 * 1024) {
          console.log('🔄 Image too large, resizing...');
          processedFile = await resizeImage(file, maxSizeMB);
          console.log(`✅ Image resized to: ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
        } else {
          console.log('✅ Image size OK, no resizing needed');
        }
      } else if (type === 'video') {
        // Validate video type
        const allowedVideoTypes = [
          'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 
          'video/ogg', 'video/3gpp', 'video/x-msvideo'
        ];
        
        if (!allowedVideoTypes.includes(file.type)) {
          throw new Error('Please select a valid video file (MP4, WebM, MOV, AVI, etc.)');
        }
        
        // Process video
        const maxSizeMB = 50; // 50MB limit for videos
        processedFile = await compressVideo(file, maxSizeMB);
      }

      setSelectedMedia(processedFile);
      setMediaType(type);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(processedFile);

    } catch (error) {
      console.error(`❌ Error processing ${type}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : `Failed to process ${type}. Please try a different file.`;
      if (isMobile) {
        alert(errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsProcessingMedia(false);
      // Clear the input so the same file can be selected again
      e.target.value = '';
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
    setMediaType(null);
  };

  const resetForm = () => {
    setContent('');
    setSelectedMedia(null);
    setMediaPreview(null);
    setMediaType(null);
    setIsLoading(false);
    setValidationError(null);
  };

  const showValidationError = (message: string) => {
    setValidationError(message);
    
    // Show prominent error dialog
    alert(`❌ Validation Error\n\n${message}`);
    
    // Focus on textarea to guide user
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.focus();
    }
  };

  // Handle button click with validation before submission
  const handlePostButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🖱️ Post button clicked, validating...');
    
    // Clear any existing validation errors
    setValidationError(null);
    
    if (!user) {
      console.error('❌ User not authenticated');
      showValidationError('Please log in to post');
      return;
    }

    // MANDATORY TEXT VALIDATION: Show error dialog if no text
    if (!content.trim()) {
      console.error('❌ Text content is required for all posts');
      
      // Show contextual error dialog
      const message = selectedMedia 
        ? 'Please add some text to describe your image/video'
        : 'Please write something for your post';
      
      showValidationError(message);
      return;
    }

    // Additional validation: minimum character count
    if (content.trim().length < 1) {
      showValidationError('Post must contain at least 1 character');
      return;
    }

    // Check character limit
    if (content.length > 300) {
      showValidationError('Post is too long. Maximum 300 characters allowed.');
      return;
    }

    console.log('✅ All validations passed, proceeding with submission');
    
    // If all validations pass, proceed with form submission
    onSubmit(e as any);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Additional null check for user
    if (!user) {
      console.error('❌ User not authenticated in onSubmit');
      showValidationError('Please log in to post');
      return;
    }
    
    try {
      setIsLoading(true);
      
      console.log('🚀 Starting post creation...');
      console.log('📝 Content:', content.substring(0, 50) + '...');
      console.log('🎬 Has media:', !!selectedMedia, 'Type:', mediaType);
      if (selectedMedia) {
        console.log('📷 Media size:', (selectedMedia.size / 1024 / 1024).toFixed(2) + 'MB');
      }
      // FIXED: Safe access to user properties with null checks
      console.log('👤 User:', user?.id, user?.email);

      // Get current Firebase user data
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error('Firebase user not found');
      }

      console.log('🔥 Firebase User:', firebaseUser.uid, firebaseUser.email);

      // Get fresh token
      const token = await getAuthToken();
      console.log('🔑 Got fresh token, length:', token.length);

      // Create FormData with current user information
      const formData = new FormData();
      
      // Add the validated content (guaranteed to have text now)
      formData.append('content', content.trim());
      
      // Add current user data to the request
      formData.append('userId', firebaseUser.uid);
      formData.append('userEmail', firebaseUser.email || '');
      formData.append('userName', firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User');
      formData.append('userPhoto', firebaseUser.photoURL || '');
      
      if (selectedMedia) {
        // Use different field names for different media types
        const fieldName = mediaType === 'video' ? 'video' : 'image';
        formData.append(fieldName, selectedMedia);
        formData.append('mediaType', mediaType || 'image');
        console.log(`🎬 Media attached: ${selectedMedia.name} (${(selectedMedia.size / 1024 / 1024).toFixed(2)}MB) as ${fieldName}`);
      }

      // Send request with Authorization header
      const response = await fetch('https://patr.me/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log('❌ API Error:', response.status, errorData);
        
        if (response.status === 401) {
          throw new Error('Authentication failed. Please try logging out and back in.');
        } else if (response.status === 400) {
          throw new Error(errorData.error || 'Invalid request. Please check your input.');
        } else if (response.status === 413) {
          throw new Error('File too large. Please try a smaller file.');
        } else {
          throw new Error(errorData.error || `Server error (${response.status})`);
        }
      }

      const result = await response.json();
      console.log('✅ Post created successfully:', result);

      // Reset form immediately
      resetForm();
      
      // Mobile-aware refresh strategy
      if (onPostCreated) {
        console.log('🔄 Post created, executing refresh strategy');
        
        if (isMobile) {
          console.log('📱 Mobile detected - using enhanced refresh');
          
          // Immediate callback
          onPostCreated(result);
          
          // Backup refresh for mobile
          setTimeout(() => {
            console.log('📱 Mobile backup refresh');
            onPostCreated(result);
          }, 500);
          
        } else {
          // Desktop - immediate callback
          console.log('🖥️ Desktop detected - immediate callback');
          onPostCreated(result);
        }
      }

      console.log('🎉 Post created and form reset');

    } catch (error) {
      console.error('❌ Error creating post:', error);
      setIsLoading(false);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to create post. Please try again.';
      showValidationError(errorMessage);
    }
  };

  const getPrivacyIcon = () => {
    switch (privacy) {
      case 'public':
        return <Globe className="w-4 h-4" />;
      case 'followers':
        return <Users className="w-4 h-4" />;
      case 'private':
        return <Lock className="w-4 h-4" />;
    }
  };

  const getPrivacyText = () => {
    switch (privacy) {
      case 'public':
        return 'Everyone can reply';
      case 'followers':
        return 'People you follow can reply';
      case 'private':
        return 'Only you can reply';
    }
  };

  if (!user) {
    return (
      <div className="bg-gray-900/50 rounded-2xl p-4 sm:p-6 border border-gray-800 mx-3 sm:mx-0">
        <p className="text-gray-400 text-center text-sm sm:text-base">Please log in to compose posts</p>
      </div>
    );
  }

  const remainingChars = 280 - content.length;
  const isNearLimit = remainingChars <= 20;
  const isOverLimit = remainingChars < 0;
  const isButtonDisabled = isLoading || isProcessingMedia || !content.trim() || isOverLimit;

  // Safe access to user profile image with null checks
  const userProfileImage = user?.profileImageUrl || (user as any)?.photoURL || null;
  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  return (
    <>
      <div className={`bg-black border-b border-gray-800 ${isMobile ? 'p-3' : 'p-4'}`}>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className={`flex ${isMobile ? 'space-x-3' : 'space-x-4'}`}>
            {/* User Avatar */}
            <div className="flex-shrink-0">
              {userProfileImage ? (
                <img
                  src={userProfileImage}
                  alt={userDisplayName}
                  className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-full object-cover`}
                  onError={(e) => {
                    // Hide image and show initials if image fails to load
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div 
                className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold ${isMobile ? 'text-sm' : ''}`}
                style={{ display: userProfileImage ? 'none' : 'flex' }}
              >
                {userDisplayName[0].toUpperCase()}
              </div>
            </div>

            {/* Compose Area */}
            <div className="flex-1 min-w-0">
              {/* Privacy Setting - Hidden on mobile in compact mode */}
              {!isMobile && (
                <div className="flex items-center space-x-2 mb-3">
                  {getPrivacyIcon()}
                  <span className="text-blue-400 text-sm">{getPrivacyText()}</span>
                </div>
              )}

              {/* Text Input */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening?"
                className={`w-full bg-transparent text-white ${isMobile ? 'text-lg' : 'text-xl'} placeholder-gray-500 resize-none border-none outline-none touch-manipulation ${validationError && !content.trim() ? 'border-red-500 border rounded-lg p-2' : ''}`}
                rows={isMobile ? 4 : 3}
                maxLength={300}
                disabled={isLoading}
                autoFocus={autoFocus && !isMobile}
              />

              {/* Validation Error Message */}
              {validationError && (
                <div className="mt-2 p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-red-400 text-sm font-medium">{validationError}</span>
                  </div>
                </div>
              )}

              {/* Character count and requirements hint */}
              {!content.trim() && !validationError && (
                <div className="mt-2 text-gray-500 text-sm">
                  <span className="text-red-400">*</span> Text content is required for all posts
                </div>
              )}

              {/* Media Processing Indicator */}
              {isProcessingMedia && (
                <div className="flex items-center space-x-2 mt-3 p-3 bg-gray-800 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-blue-400 text-sm">Processing {mediaType}...</span>
                </div>
              )}

              {/* Media Preview */}
              {mediaPreview && (
                <div className="relative mt-3">
                  {mediaType === 'image' ? (
                    <img
                      src={mediaPreview}
                      alt="Selected media"
                      className="max-w-full h-auto rounded-2xl border border-gray-700"
                    />
                  ) : mediaType === 'video' ? (
                    <video
                      src={mediaPreview}
                      controls
                      className="max-w-full h-auto rounded-2xl border border-gray-700"
                      style={{ maxHeight: '400px' }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : null}
                  
                  <button
                    type="button"
                    onClick={removeMedia}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 rounded-full p-2 transition-colors touch-manipulation"
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  
                  {selectedMedia && (
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                      {mediaType?.toUpperCase()} - {(selectedMedia.size / 1024 / 1024).toFixed(2)}MB
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Actions */}
              <div className={`flex items-center justify-between ${isMobile ? 'mt-3 pt-3' : 'mt-4 pt-4'} border-t border-gray-800`}>
                <div className="flex items-center space-x-3 sm:space-x-4">
                  {/* Image Upload */}
                  <label className={`cursor-pointer text-blue-400 hover:text-blue-300 transition-colors touch-manipulation ${isMobile ? 'p-2' : ''} ${isProcessingMedia || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Image className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleMediaSelect(e, 'image')}
                      className="hidden"
                      disabled={isLoading || isProcessingMedia}
                    />
                  </label>

                  {/* Video Upload */}
                  <label className={`cursor-pointer text-purple-400 hover:text-purple-300 transition-colors touch-manipulation ${isMobile ? 'p-2' : ''} ${isProcessingMedia || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Video className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleMediaSelect(e, 'video')}
                      className="hidden"
                      disabled={isLoading || isProcessingMedia}
                    />
                  </label>

                  {/* Article Button */}
                  <button
                    type="button"
                    onClick={() => setShowArticleEditor(true)}
                    disabled={isLoading || isProcessingMedia}
                    className={`text-green-400 hover:text-green-300 transition-colors touch-manipulation ${isMobile ? 'p-2' : ''} ${isProcessingMedia || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Write Article"
                  >
                    <FileText className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
                  </button>

                  {/* File size limits indicator */}
                  {!isMobile && (
                    <span className="text-xs text-gray-500">
                      Images: 5MB • Videos: 50MB
                    </span>
                  )}

                  {/* Character Count */}
                  <div className="flex items-center space-x-2">
                    {content.length > 0 && (
                      <>
                        <div className={`relative ${isMobile ? 'w-7 h-7' : 'w-8 h-8'}`}>
                          <svg className={`transform -rotate-90 ${isMobile ? 'w-7 h-7' : 'w-8 h-8'}`}>
                            <circle
                              cx={isMobile ? "14" : "16"}
                              cy={isMobile ? "14" : "16"}
                              r={isMobile ? "12" : "14"}
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="transparent"
                              className="text-gray-700"
                            />
                            <circle
                              cx={isMobile ? "14" : "16"}
                              cy={isMobile ? "14" : "16"}
                              r={isMobile ? "12" : "14"}
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="transparent"
                              strokeDasharray={`${2 * Math.PI * (isMobile ? 12 : 14)}`}
                              strokeDashoffset={`${2 * Math.PI * (isMobile ? 12 : 14) * (1 - Math.min(content.length / 280, 1))}`}
                              className={`transition-all duration-300 ${
                                isOverLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-blue-500'
                              }`}
                            />
                          </svg>
                          <span className={`absolute inset-0 flex items-center justify-center ${isMobile ? 'text-xs' : 'text-xs'} font-medium ${
                            isOverLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-gray-400'
                          }`}>
                            {remainingChars < 0 ? Math.abs(remainingChars) : ''}
                          </span>
                        </div>
                        {remainingChars <= 40 && (
                          <span className={`text-sm ${
                            isOverLimit ? 'text-red-500' : isNearLimit ? 'text-yellow-500' : 'text-gray-400'
                          }`}>
                            {remainingChars}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* FIXED Post Button - Truly unclickable when disabled with error dialog */}
                <button
                  type="button"
                  onClick={isButtonDisabled ? undefined : handlePostButtonClick}
                  className={`${isMobile ? 'px-5 py-2 text-sm' : 'px-6 py-2'} rounded-full font-semibold transition-colors touch-manipulation ${
                    isButtonDisabled
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed pointer-events-none'
                      : 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                  }`}
                  style={{
                    pointerEvents: isButtonDisabled ? 'none' : 'auto'
                  }}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className={`animate-spin rounded-full ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} border-2 border-white border-t-transparent`}></div>
                      <span>{isMobile ? 'Posting...' : 'Posting...'}</span>
                    </div>
                  ) : isProcessingMedia ? (
                    <div className="flex items-center space-x-2">
                      <div className={`animate-spin rounded-full ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} border-2 border-white border-t-transparent`}></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    'Post'
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Article Editor Modal */}
      {showArticleEditor && (
        <ArticleEditor
          onClose={() => setShowArticleEditor(false)}
          onPublish={(article) => {
            console.log('📰 Article created:', article);
            setShowArticleEditor(false);
            // Optionally refresh feed or show success message
            if (onPostCreated) {
              onPostCreated(article);
            }
          }}
        />
      )}
    </>
  );
};

export default ComposePost;