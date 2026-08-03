import React, { useState, useEffect } from 'react';
import { 
  Heart, MessageCircle, Repeat2, Share, Bookmark, MoreHorizontal, 
  ArrowLeft, Star, Send, Reply, Trash2, X, Clock, Play
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../config/firebase';
import HtmlEmbed from './HtmlEmbed';

interface PostDetailProps {
  postId: string;
  onBack: () => void;
}

interface User {
  id: string;
  displayName: string;
  username: string;
  email: string;
  profileImageUrl?: string;
  verified?: boolean;
}

interface Comment {
  id: string;
  postId: string;
  content: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  replyCount: number;
  userHasLiked: boolean;
  user: User;
}

interface PostDetail {
  id: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string; // Add video URL support
  htmlContent?: string; // Self-contained HTML5 snippet, always rendered sandboxed
  createdAt: string;
  updatedAt: string;
  user: User;
  likesCount: number;
  retweetsCount: number;
  repliesCount: number;
  commentsCount: number;
  averageRating: number;
  ratingCount: number;
  userRating: number;
  userHasRated: boolean;
  viewsCount: number;
  isDeleted: boolean;
}

const PostDetail: React.FC<PostDetailProps> = ({ postId, onBack }) => {
  const { user } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Helper function to get auth token
  const getAuthToken = async (): Promise<string> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return '';
      
      const token = await currentUser.getIdToken(true);
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return '';
    }
  };

  // Helper function to get current user data for API calls
  const getCurrentUserData = () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return {};
    
    return {
      userId: currentUser.uid,
      userEmail: currentUser.email || '',
      userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
      userPhoto: currentUser.photoURL || ''
    };
  };

  // Helper function to safely parse JSON response
  const safeJsonParse = async (response: Response) => {
    const text = await response.text();
    
    // Check if response is empty
    if (!text || text.trim() === '') {
      throw new Error('Empty response from server');
    }
    
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse JSON:', text);
      throw new Error(`Invalid JSON response: ${text}`);
    }
  };

  // Load post details
  const loadPostDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      
      // Check if the endpoint exists first
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Post detail response status:', response.status);
      
      if (response.status === 404) {
        throw new Error('Post not found');
      }
      
      if (response.status === 500) {
        throw new Error('Server error - post detail endpoints may not be implemented yet');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await safeJsonParse(response);
      
      if (data && data.id) {
        setPost(data);
        setUserRating(data.userRating || 0);
      } else {
        // Fallback: If post detail endpoint doesn't exist, create a mock post
        console.warn('Post detail endpoint not implemented, using fallback');
        setPost({
          id: postId,
          content: 'Loading post content...',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: {
            id: user?.id || 'unknown',
            displayName: 'Unknown User',
            username: 'user',
            email: 'user@example.com'
          },
          likesCount: 0,
          retweetsCount: 0,
          repliesCount: 0,
          commentsCount: 0,
          averageRating: 0,
          ratingCount: 0,
          userRating: 0,
          userHasRated: false,
          viewsCount: 0,
          isDeleted: false
        });
      }
    } catch (error) {
      console.error('Error loading post:', error);
      setError(error instanceof Error ? error.message : 'Failed to load post');
      
      // Set a fallback post so the component doesn't break
      setPost({
        id: postId,
        content: 'Unable to load post content. The post detail feature may not be fully implemented yet.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: user?.id || 'unknown',
          displayName: 'Unknown User',
          username: 'user',
          email: 'user@example.com'
        },
        likesCount: 0,
        retweetsCount: 0,
        repliesCount: 0,
        commentsCount: 0,
        averageRating: 0,
        ratingCount: 0,
        userRating: 0,
        userHasRated: false,
        viewsCount: 0,
        isDeleted: false
      });
    } finally {
      setLoading(false);
    }
  };

  // Load comments
  const loadComments = async () => {
    try {
      setCommentsLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Comments response status:', response.status);

      if (response.status === 404) {
        console.warn('Comments endpoint not found, using empty comments array');
        setComments([]);
        return;
      }

      if (!response.ok) {
        console.warn('Comments endpoint error:', response.status, response.statusText);
        setComments([]);
        return;
      }

      const data = await safeJsonParse(response);
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]); // Set empty array instead of breaking
    } finally {
      setCommentsLoading(false);
    }
  };

  // Submit comment
  const submitComment = async () => {
    if (!user || !newComment.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      const token = await getAuthToken();
      const userData = getCurrentUserData();
      
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newComment.trim(),
          parent_comment_id: replyingTo,
          ...userData
        })
      });

      if (response.ok) {
        const newCommentData = await safeJsonParse(response);
        setComments(prev => [newCommentData, ...prev]);
        setNewComment('');
        setReplyingTo(null);
        
        // Update post comment count
        if (post) {
          setPost(prev => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null);
        }
      } else {
        console.error('Failed to submit comment:', response.status);
        alert('Failed to submit comment. The comments feature may not be fully implemented yet.');
      }
    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Failed to submit comment. Please try again later.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Submit rating
  const submitRating = async (rating: number) => {
    if (!user || submittingRating) return;

    try {
      setSubmittingRating(true);
      const token = await getAuthToken();
      const userData = getCurrentUserData();
      
      const response = await fetch(`/api/posts/${postId}/rating`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rating,
          ...userData
        })
      });

      if (response.ok) {
        const result = await safeJsonParse(response);
        setUserRating(rating);
        
        if (post) {
          setPost(prev => prev ? {
            ...prev,
            averageRating: result.averageRating,
            ratingCount: result.ratingCount,
            userRating: rating,
            userHasRated: true
          } : null);
        }
      } else {
        console.error('Failed to submit rating:', response.status);
        alert('Failed to submit rating. The rating feature may not be fully implemented yet.');
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating. Please try again later.');
    } finally {
      setSubmittingRating(false);
    }
  };

  // Toggle comment like
  const toggleCommentLike = async (commentId: string) => {
    if (!user) return;

    try {
      const token = await getAuthToken();
      const userData = getCurrentUserData();
      
      const response = await fetch(`/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        const result = await safeJsonParse(response);
        setComments(prev => 
          prev.map(comment => 
            comment.id === commentId 
              ? { ...comment, userHasLiked: result.liked, likesCount: result.likesCount }
              : comment
          )
        );
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  // Delete comment
  const deleteComment = async (commentId: string) => {
    if (!user || !window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const token = await getAuthToken();
      
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setComments(prev => prev.filter(comment => comment.id !== commentId));
        
        // Update post comment count
        if (post) {
          setPost(prev => prev ? { ...prev, commentsCount: Math.max(0, prev.commentsCount - 1) } : null);
        }
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  useEffect(() => {
    loadPostDetails();
    loadComments();
  }, [postId]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const renderStarRating = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const starSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
    
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= rating 
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-gray-600'
            }`}
          />
        ))}
        {rating > 0 && (
          <span className="text-sm text-gray-400 ml-2">
            {rating.toFixed(1)}
          </span>
        )}
      </div>
    );
  };

  const renderInteractiveStarRating = () => {
    if (!user) return null;

    return (
      <div className="flex items-center space-x-1">
        <span className="text-sm text-gray-400 mr-2">Rate this post:</span>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => submitRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            disabled={submittingRating}
            className="transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star
              className={`w-6 h-6 ${
                star <= (hoverRating || userRating)
                  ? 'text-yellow-400 fill-yellow-400' 
                  : 'text-gray-600 hover:text-yellow-300'
              }`}
            />
          </button>
        ))}
        {userRating > 0 && (
          <span className="text-sm text-yellow-400 ml-2">
            You rated: {userRating}/5
          </span>
        )}
      </div>
    );
  };

  // Enhanced media rendering for post detail
  const renderPostMedia = () => {
    if (!post) return null;

    const hasImage = post.imageUrl;
    const hasVideo = post.videoUrl;

    if (!hasImage && !hasVideo) return null;

    return (
      <div className="mb-4">
        {/* Image rendering */}
        {hasImage && (
          <div className="rounded-2xl overflow-hidden mb-4">
            <img
              src={post.imageUrl}
              alt="Post image"
              className="w-full max-h-96 object-cover"
            />
          </div>
        )}

        {/* Video rendering */}
        {hasVideo && (
          <div className="relative rounded-2xl overflow-hidden bg-black mb-4">
            {!videoError ? (
              <video
                className="w-full max-h-96 object-contain"
                controls
                preload="metadata"
                onError={() => {
                  console.error('Video failed to load:', post.videoUrl);
                  setVideoError(true);
                }}
              >
                <source src={post.videoUrl} type="video/mp4" />
                <source src={post.videoUrl} type="video/webm" />
                <source src={post.videoUrl} type="video/ogg" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex items-center justify-center h-64 bg-gray-900 text-gray-400">
                <div className="text-center">
                  <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">Video could not be loaded</p>
                  <a
                    href={post.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Try opening in new tab
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderComment = (comment: Comment) => (
    <div key={comment.id} className="border-b border-gray-800 p-4 hover:bg-[var(--hover)] transition-colors">
      <div className="flex space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {comment.user.profileImageUrl ? (
            <img
              src={comment.user.profileImageUrl}
              alt={comment.user.displayName}
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div 
            className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm ${comment.user.profileImageUrl ? 'hidden' : ''}`}
          >
            {getInitials(comment.user.displayName)}
          </div>
        </div>

        {/* Comment content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="font-bold text-white text-sm">{comment.user.displayName}</h4>
            <span className="text-gray-400 text-sm">@{comment.user.username}</span>
            <span className="text-gray-500 text-sm">·</span>
            <time className="text-gray-500 text-sm">{formatTimeAgo(comment.createdAt)}</time>
            
            {user && user.id === comment.user.id && (
              <div className="ml-auto">
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="p-1 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <p className="text-white text-sm leading-relaxed mb-3">{comment.content}</p>

          {/* Comment actions */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => toggleCommentLike(comment.id)}
              disabled={!user}
              className={`flex items-center space-x-1 text-sm transition-colors ${
                comment.userHasLiked 
                  ? 'text-red-400' 
                  : 'text-gray-400 hover:text-red-400 disabled:opacity-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${comment.userHasLiked ? 'fill-current' : ''}`} />
              <span>{comment.likesCount}</span>
            </button>

            <button
              onClick={() => setReplyingTo(comment.id)}
              disabled={!user}
              className="flex items-center space-x-1 text-sm text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
            >
              <Reply className="w-4 h-4" />
              <span>Reply</span>
            </button>
          </div>

          {/* Reply form */}
          {replyingTo === comment.id && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex space-x-3">
                <div className="flex-shrink-0">
                  {user?.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {user ? getInitials(user.displayName) : 'U'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={`Reply to @${comment.user.username}...`}
                    className="w-full bg-transparent text-white text-sm placeholder-gray-500 resize-none border-none outline-none"
                    rows={2}
                    maxLength={280}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">{280 - newComment.length} characters left</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setNewComment('');
                        }}
                        className="px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitComment}
                        disabled={!newComment.trim() || submittingComment}
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 text-white px-3 py-1 rounded-full text-sm font-semibold transition-colors"
                      >
                        {submittingComment ? 'Replying...' : 'Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading post...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😔</div>
          <h3 className="text-xl font-bold text-white mb-2">Post not found</h3>
          <p className="text-gray-400 mb-4">This post may have been deleted or doesn't exist.</p>
          {error && (
            <div className="text-red-400 text-sm mb-4 max-w-md">
              Error: {error}
            </div>
          )}
          <button
            onClick={onBack}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-semibold transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 border-r border-gray-800 max-w-2xl">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-black/80 border-b border-gray-800 p-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Post</h1>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">
              ⚠️ {error}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              The post detail feature may not be fully implemented in your backend yet.
            </p>
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="border-b border-gray-800 p-6">
        <div className="flex space-x-4 mb-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {post.user.profileImageUrl ? (
              <img
                src={post.user.profileImageUrl}
                alt={post.user.displayName}
                className="w-14 h-14 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  if (target.nextElementSibling) {
                    (target.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div 
              className={`w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold ${post.user.profileImageUrl ? 'hidden' : ''}`}
            >
              {getInitials(post.user.displayName)}
            </div>
          </div>

          {/* User info */}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-bold text-white text-lg">{post.user.displayName}</h3>
              {post.user.verified && (
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </div>
            <p className="text-gray-400">@{post.user.username}</p>
          </div>
        </div>

        {/* Post content */}
        <div className="mb-6">
          <p className="text-white text-xl leading-relaxed mb-4">{post.content}</p>
          
          {/* Enhanced Media Display */}
          {renderPostMedia()}

          {/* HTML5 content (sandboxed) */}
          {post.htmlContent && <HtmlEmbed html={post.htmlContent} />}
        </div>

        {/* Timestamp */}
        <div className="flex items-center space-x-2 text-gray-400 text-sm mb-6 pb-4 border-b border-gray-700">
          <Clock className="w-4 h-4" />
          <span>{new Date(post.createdAt).toLocaleString()}</span>
        </div>

        {/* Rating Section */}
        <div className="mb-6 p-3 rounded-lg" style={{ background: 'var(--hover, rgba(255,255,255,0.06))' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-semibold">Rating</h4>
            {post.ratingCount > 0 && (
              <span className="text-gray-400 text-sm">
                {post.ratingCount} rating{post.ratingCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {post.averageRating > 0 && (
            <div className="mb-3">
              {renderStarRating(post.averageRating, 'lg')}
            </div>
          )}
          
          {renderInteractiveStarRating()}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between py-4 border-b border-gray-700">
          <button className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors">
            <MessageCircle className="w-5 h-5" />
            <span>{post.commentsCount}</span>
          </button>

          <button className="flex items-center space-x-2 text-gray-400 hover:text-green-400 transition-colors">
            <Repeat2 className="w-5 h-5" />
            <span>{post.retweetsCount}</span>
          </button>

          <button className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors">
            <Heart className="w-5 h-5" />
            <span>{post.likesCount}</span>
          </button>

          <button className="text-gray-400 hover:text-blue-400 transition-colors">
            <Bookmark className="w-5 h-5" />
          </button>

          <button className="text-gray-400 hover:text-blue-400 transition-colors">
            <Share className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Comment Form */}
      {user && !replyingTo && (
        <div className="border-b border-gray-800 p-4">
          <div className="flex space-x-3">
            <div className="flex-shrink-0">
              {user.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={user.displayName}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                  {getInitials(user.displayName)}
                </div>
              )}
            </div>
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full bg-transparent text-white text-lg placeholder-gray-500 resize-none border-none outline-none"
                rows={3}
                maxLength={280}
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-500">{280 - newComment.length} characters left</span>
                <button
                  onClick={submitComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 text-white px-6 py-2 rounded-full font-semibold transition-colors flex items-center space-x-2"
                >
                  {submittingComment ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Comment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div className="divide-y divide-gray-800">
        {commentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No comments yet</h3>
            <p className="text-gray-400">Be the first to comment on this post!</p>
            {error && (
              <p className="text-gray-500 text-sm mt-2">
                Note: The comments feature may not be fully implemented yet.
              </p>
            )}
          </div>
        ) : (
          comments.map(renderComment)
        )}
      </div>
    </main>
  );
};

export default PostDetail;