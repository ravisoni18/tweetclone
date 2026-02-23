import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreHorizontal, Search as SearchIcon, X, Star, Play, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Post } from '../types';
import ComposePost from './ComposePost';
import Profile from './Profile';
import PostDetail from './PostDetail';
import { auth } from '../config/firebase';
import ArticleEditor from './ArticleEditor';



interface FeedProps {
  type: 'home' | 'explore' | 'following' | 'discover';
  showCompose: boolean;
  onUserClick?: (userId: string) => void;
  onPostClick?: (postId: string) => void;
  onArticleClick?: (articleId: string) => void; // ADDED for article navigation
}

interface SearchUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  profileImageUrl?: string;
  followersCount: number;
  following: boolean;
}

const Feed: React.FC<FeedProps> = ({ type = 'home', showCompose = true, onUserClick, onPostClick, onArticleClick }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [articles, setArticles] = useState<any[]>([]); // ADDED for articles
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'following' | 'discover' | 'articles'>('following'); // UPDATED
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showArticleEditor, setShowArticleEditor] = useState(false);

  // Profile navigation state
  const [showProfile, setShowProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Post detail navigation state
  const [showPostDetail, setShowPostDetail] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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

  // Clean post data to ensure zero ratings are properly handled
  const cleanPostData = (post: any): Post => {
    return {
      ...post,
      averageRating: (post.averageRating && post.averageRating > 0) ? post.averageRating : undefined,
      ratingCount: (post.ratingCount && post.ratingCount > 0) ? post.ratingCount : undefined,
    };
  };

  const getFeedType = () => {
    if (type === 'home') return activeTab;
    if (type === 'explore') return 'discover';
    return type;
  };

  // Navigate to user profile
  const navigateToProfile = (userId: string) => {
    if (onUserClick) {
      onUserClick(userId);
    } else {
      setSelectedUserId(userId);
      setShowProfile(true);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
      setShowPostDetail(false);
      setSelectedPostId(null);
    }
  };

  // Navigate to post detail
  const navigateToPostDetail = (postId: string) => {
    if (onPostClick) {
      onPostClick(postId);
    } else {
      setSelectedPostId(postId);
      setShowPostDetail(true);
      setShowProfile(false);
      setSelectedUserId(null);
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  // ADDED: Navigate to article
  const navigateToArticle = (articleId: string) => {
    console.log('📰 Navigating to article:', articleId);
    if (onArticleClick) {
      onArticleClick(articleId);
    } else {
      window.location.href = `/patr/article/${articleId}`;
    }
  };

  // Go back to feed
  const backToFeed = () => {
    setShowProfile(false);
    setSelectedUserId(null);
    setShowPostDetail(false);
    setSelectedPostId(null);
  };

  const handleArticleCreated = (article: any) => {
    console.log('✅ Article created:', article);
    setShowArticleEditor(false);
    // Refresh articles list
    loadArticles();
  };
  

  const loadPosts = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        console.log('🔄 Refreshing feed...');
      } else {
        setLoading(true);
      }

      const feedType = getFeedType();
      const token = await getAuthToken();
      
      const cacheParams = new URLSearchParams({
        type: feedType,
        page: '1',
        limit: '20',
        t: Date.now().toString(),
        r: Math.random().toString(36).substring(7)
      });
      
      console.log('📡 Fetching posts with enhanced cache busting:', cacheParams.toString());
      
      const response = await fetch(`https://patr.me/api/posts/feed?${cacheParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      console.log('📡 Feed response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Feed data received:', data);
        
        if (data && data.posts) {
          const cleanedPosts = data.posts.map(cleanPostData);
          setPosts(cleanedPosts);
          console.log('✅ Feed updated with', cleanedPosts.length, 'posts');
        } else {
          console.log('📭 No posts in response');
          setPosts([]);
        }
      } else {
        console.error('❌ Failed to load posts:', response.status);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
        setPosts([]);
      }
    } catch (error) {
      console.error('❌ Error loading posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ADDED: Load articles function
  const loadArticles = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      console.log('📚 Loading articles...');
      
      const response = await fetch(`https://patr.me/api/articles?status=published&limit=50`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Articles loaded:', data);
        setArticles(data.articles || []);
      } else {
        console.error('❌ Failed to load articles:', response.status);
        setArticles([]);
      }
    } catch (error) {
      console.error('❌ Error loading articles:', error);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  // Search users
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch(`https://patr.me/api/users/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } else {
        console.error('Search failed:', response.status);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Follow/unfollow user
  const toggleFollow = async (userId: string) => {
    if (!user) return;

    try {
      const token = await getAuthToken();
      const userData = getCurrentUserData();
      
      const response = await fetch(`https://patr.me/api/follow/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        const result = await response.json();
        
        setSearchResults(prev => 
          prev.map(u => 
            u.id === userId 
              ? { ...u, following: result.following }
              : u
          )
        );

        console.log(`Successfully ${result.following ? 'followed' : 'unfollowed'} user`);

        if (activeTab === 'following') {
          loadPosts(true);
        }
      } else {
        console.error('Follow action failed:', response.status);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  // UPDATED: Load posts or articles based on active tab
  useEffect(() => {
    if (!showProfile && !showPostDetail) {
      if (activeTab === 'articles') {
        loadArticles();
      } else {
        loadPosts();
      }
    }
  }, [type, activeTab, showProfile, showPostDetail]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  const handlePostCreated = (newPost?: any) => {
    console.log('🔄 Post created callback received');
    
    if (isMobile) {
      console.log('📱 Mobile detected - using comprehensive refresh strategy');
      
      if (newPost) {
        setPosts(prevPosts => [newPost, ...prevPosts]);
      }
      
      setTimeout(() => loadPosts(true), 200);
      setTimeout(() => loadPosts(true), 1000);
      
    } else {
      console.log('🖥️ Desktop detected - using standard refresh');
      
      if (newPost) {
        setPosts(prevPosts => [newPost, ...prevPosts]);
      }
      
      loadPosts(true);
    }
  };

  // UPDATED: Handle tab change
  const handleTabChange = (tab: 'following' | 'discover' | 'articles') => {
    setActiveTab(tab);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

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

  const renderStarRating = (rating: number) => {
    if (!rating || rating <= 0) return null;
    
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating 
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-gray-600'
            }`}
          />
        ))}
        <span className="text-xs text-gray-400 ml-1">
          {rating.toFixed(1)}
        </span>
      </div>
    );
  };

  const renderPostMedia = (post: Post) => {
    const hasImage = post.imageUrl;
    const hasVideo = (post as any).videoUrl;

    if (!hasImage && !hasVideo) return null;

    return (
      <div className="mt-3 rounded-2xl overflow-hidden">
        {hasImage && (
          <img
            src={post.imageUrl}
            alt="Post image"
            className="w-full max-h-80 sm:max-h-96 object-cover"
          />
        )}

        {hasVideo && (
          <video
            className="w-full max-h-80 sm:max-h-96 object-contain bg-black"
            controls
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
          >
            <source src={(post as any).videoUrl} type="video/mp4" />
            <source src={(post as any).videoUrl} type="video/webm" />
            <source src={(post as any).videoUrl} type="video/ogg" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>
    );
  };

  // If showing profile, render profile component
  if (showProfile && selectedUserId) {
    return (
      <Profile 
        userId={selectedUserId}
        onBack={backToFeed}
        onArticleClick={navigateToArticle}
      />
    );
  }

  // If showing post detail, render post detail component
  if (showPostDetail && selectedPostId) {
    return (
      <PostDetail 
        postId={selectedPostId}
        onBack={backToFeed}
      />
    );
  }

  const renderSearchResults = () => (
    <div className="border-b border-gray-800">
      <div className="p-3 sm:p-4 bg-gray-950">
        <h3 className="text-lg font-bold text-white mb-4">
          {searchLoading ? 'Searching...' : `Search results${searchQuery ? ` for "${searchQuery}"` : ''}`}
        </h3>
        
        {searchLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-gray-400">
              {searchQuery ? 'No users found' : 'Start typing to search for users...'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {searchResults.map((searchUser) => (
              <div key={searchUser.id} className="flex items-center justify-between p-3 hover:bg-gray-900 rounded-lg touch-manipulation">
                <div 
                  className="flex items-center space-x-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => navigateToProfile(searchUser.id)}
                >
                  <div className="flex-shrink-0">
                    {searchUser.profileImageUrl ? (
                      <img
                        src={searchUser.profileImageUrl}
                        alt={searchUser.displayName}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
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
                      className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm ${searchUser.profileImageUrl ? 'hidden' : ''}`}
                    >
                      {getInitials(searchUser.displayName)}
                    </div>
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-white text-sm sm:text-base truncate hover:underline">{searchUser.displayName}</h4>
                    <p className="text-gray-400 text-xs sm:text-sm truncate">@{searchUser.username}</p>
                    <p className="text-gray-500 text-xs">{searchUser.followersCount} followers</p>
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFollow(searchUser.id);
                  }}
                  disabled={!user}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-semibold text-sm transition-colors touch-manipulation min-w-[80px] disabled:opacity-50 ${
                    searchUser.following
                      ? 'bg-transparent border border-gray-600 text-white hover:bg-red-600 hover:border-red-600'
                      : 'bg-white text-black hover:bg-gray-200'
                  }`}
                >
                  {searchUser.following ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderPost = (post: Post) => {
    const postUser = post.user;
    
    return (
      <div 
        key={post.id} 
        className="border-b border-gray-800 p-3 sm:p-4 hover:bg-gray-950/50 transition-colors touch-manipulation cursor-pointer"
        onClick={() => navigateToPostDetail(post.id)}
      >
        <div className="flex space-x-3">
          <div 
            className="flex-shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigateToProfile(postUser.id);
            }}
          >
            {postUser.profileImageUrl ? (
              <img
                src={postUser.profileImageUrl}
                alt={postUser.displayName}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover hover:opacity-90 transition-opacity"
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
              className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm hover:opacity-90 transition-opacity ${postUser.profileImageUrl ? 'hidden' : ''}`}
            >
              {getInitials(postUser.displayName)}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 
                className="font-bold text-white hover:underline cursor-pointer text-sm sm:text-base truncate"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToProfile(postUser.id);
                }}
              >
                {postUser.displayName}
              </h3>
              <span 
                className="text-gray-400 text-sm sm:text-base hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToProfile(postUser.id);
                }}
              >
                @{postUser.username}
              </span>
              <span className="text-gray-400 hidden sm:inline">·</span>
              <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">
                {formatTimeAgo(post.createdAt)}
              </span>
              <div className="ml-auto">
                <button 
                  className="p-2 rounded-full hover:bg-gray-800 transition-colors touch-manipulation"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="mt-1">
              <p className="text-white text-sm sm:text-base whitespace-pre-wrap break-words">{post.content}</p>
              
              {renderPostMedia(post)}

              {post.averageRating !== null && 
               post.averageRating !== undefined && 
               post.averageRating > 0 && 
               post.ratingCount !== null && 
               post.ratingCount !== undefined && 
               post.ratingCount > 0 && (
                <div className="mt-3 flex items-center space-x-2">
                  {renderStarRating(post.averageRating)}
                  <span className="text-xs text-gray-500">
                    ({post.ratingCount} rating{post.ratingCount !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3 max-w-xs sm:max-w-md">
              <button 
                className="flex items-center space-x-1 sm:space-x-2 text-gray-400 hover:text-blue-400 transition-colors group touch-manipulation"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm">{post.commentsCount || post.repliesCount || 0}</span>
              </button>

              <button 
                className="flex items-center space-x-1 sm:space-x-2 text-gray-400 hover:text-green-400 transition-colors group touch-manipulation"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 rounded-full group-hover:bg-green-500/10 transition-colors">
                  <Repeat2 className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm">{post.retweetsCount || 0}</span>
              </button>

              <button 
                className="flex items-center space-x-1 sm:space-x-2 text-gray-400 hover:text-red-400 transition-colors group touch-manipulation"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 rounded-full group-hover:bg-red-500/10 transition-colors">
                  <Heart className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm">{post.likesCount || 0}</span>
              </button>

              <button 
                className="text-gray-400 hover:text-blue-400 transition-colors group touch-manipulation"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <Bookmark className="w-4 h-4" />
                </div>
              </button>

              <button 
                className="text-gray-400 hover:text-blue-400 transition-colors group touch-manipulation"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
                  <Share className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ADDED: Render article card
  const renderArticle = (article: any) => {
    return (
      <div 
        key={article.id} 
        className="border-b border-gray-800 p-6 hover:bg-gray-950/50 transition-colors cursor-pointer"
        onClick={() => navigateToArticle(article.id)}
      >
        {article.coverImageUrl && (
          <img
            src={article.coverImageUrl}
            alt={article.title}
            className="w-full h-48 object-cover rounded-lg mb-4"
          />
        )}
        
        <div className="space-y-3">
          <div className="flex items-center space-x-3 mb-2">
            {article.user?.profileImageUrl ? (
              <img
                src={article.user.profileImageUrl}
                alt={article.user.displayName}
                className="w-10 h-10 rounded-full cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToProfile(article.user.id);
                }}
              />
            ) : (
              <div 
                className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToProfile(article.user?.id);
                }}
              >
                {article.user?.displayName ? article.user.displayName[0] : 'U'}
              </div>
            )}
            <div>
              <p 
                className="font-bold text-white hover:underline cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToProfile(article.user?.id);
                }}
              >
                {article.user?.displayName || 'Unknown User'}
              </p>
              <p className="text-sm text-gray-400">@{article.user?.username || 'user'}</p>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white hover:text-blue-400 transition-colors">
            {article.title}
          </h2>
          
          {article.excerpt && (
            <p className="text-gray-400 line-clamp-3">{article.excerpt}</p>
          )}
          
          <div className="flex items-center flex-wrap gap-3 text-sm text-gray-500">
            <span className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>{new Date(article.publishedAt || article.createdAt).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}</span>
            </span>
            
            {article.readingTimeMinutes && (
              <>
                <span>·</span>
                <span>{article.readingTimeMinutes} min read</span>
              </>
            )}
            
            <span>·</span>
            <span className="flex items-center space-x-1">
              <span>👁️</span>
              <span>{article.viewsCount || 0}</span>
            </span>
            
            {(article.likesCount > 0 || article.commentsCount > 0) && (
              <>
                <span>·</span>
                <span className="flex items-center space-x-3">
                  {article.likesCount > 0 && (
                    <span className="flex items-center space-x-1">
                      <span>❤️</span>
                      <span>{article.likesCount}</span>
                    </span>
                  )}
                  {article.commentsCount > 0 && (
                    <span className="flex items-center space-x-1">
                      <span>💬</span>
                      <span>{article.commentsCount}</span>
                    </span>
                  )}
                </span>
              </>
            )}
          </div>
          
          <button className="text-blue-400 hover:text-blue-300 font-semibold text-sm inline-flex items-center space-x-1">
            <span>Read article</span>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="flex-1 border-r border-gray-800 max-w-2xl">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-black/80 border-b border-gray-800">
        <div className="px-3 sm:px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg sm:text-xl font-bold text-white">
              {type === 'home' ? 'Home' : type === 'explore' ? 'Explore' : 'Feed'}
            </h1>
            
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 rounded-full hover:bg-gray-800 transition-colors touch-manipulation"
            >
              {showSearch ? (
                <X className="w-5 h-5 text-gray-400" />
              ) : (
                <SearchIcon className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="mb-4">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full bg-gray-900 text-white pl-10 sm:pl-12 pr-4 py-3 text-sm sm:text-base rounded-full border border-gray-700 focus:border-blue-400 focus:outline-none touch-manipulation"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* UPDATED: Feed tabs with Articles */}
          {type === 'home' && !showSearch && (
            <div className="flex border-b border-gray-700 -mx-3 sm:-mx-4">
              <button
                onClick={() => handleTabChange('following')}
                className={`flex-1 py-3 px-2 sm:px-4 text-center font-semibold transition-colors touch-manipulation text-sm sm:text-base ${
                  activeTab === 'following'
                    ? 'text-white border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Following
              </button>
              <button
                onClick={() => handleTabChange('discover')}
                className={`flex-1 py-3 px-2 sm:px-4 text-center font-semibold transition-colors touch-manipulation text-sm sm:text-base ${
                  activeTab === 'discover'
                    ? 'text-white border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Discover
              </button>
              <button
                onClick={() => handleTabChange('articles')}
                className={`flex-1 py-3 px-2 sm:px-4 text-center font-semibold transition-colors touch-manipulation text-sm sm:text-base ${
                  activeTab === 'articles'
                    ? 'text-white border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                📰 Articles
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search results */}
      {showSearch && renderSearchResults()}

      {/* Compose post */}
      {showCompose && !showSearch && activeTab !== 'articles' && <ComposePost onPostCreated={handlePostCreated} />}

      {/* Posts or Articles feed */}
      {!showSearch && (
        <div className="divide-y divide-gray-800">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : refreshing ? (
            <div className="flex justify-center py-4 border-b border-gray-800">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : null}

          {/* UPDATED: Render articles or posts based on active tab */}
          {activeTab === 'articles' ? (
            articles.length === 0 && !loading ? (
              <div className="text-center py-12 px-4">
                <div className="text-6xl mb-4">📰</div>
                <h3 className="text-xl font-bold text-white mb-2">



                  
                </h3>
                <p className="text-gray-400 max-w-sm mx-auto">
                  Be the first to write an article! Share your thoughts in long-form content.
                </p>
              </div>
            ) : (
              articles.map(renderArticle)
            )
          ) : (
            posts.length === 0 && !loading ? (
              <div className="text-center py-12 px-4">
                <div className="text-4xl sm:text-6xl mb-4">
                  {activeTab === 'following' ? '👥' : '🌟'}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
                  {activeTab === 'following' 
                    ? 'Welcome to your Following feed!' 
                    : 'Discover new voices'
                  }
                </h3>
                <p className="text-gray-400 max-w-sm mx-auto text-sm sm:text-base">
                  {activeTab === 'following'
                    ? 'Follow some users to see their posts here, or use the search to find people to follow.'
                    : 'Explore posts from users you don\'t follow yet. Find interesting people and follow them!'
                  }
                </p>
                <button
                  onClick={() => setShowSearch(true)}
                  className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-full font-semibold transition-colors touch-manipulation"
                >
                  Find people to follow
                </button>
              </div>
            ) : (
              posts.map(renderPost)
            )
          )}
        </div>
      )}
    </main>
  );
};

export default Feed;