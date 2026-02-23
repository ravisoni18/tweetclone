import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../config/firebase';
import { useTheme, themes, ThemeName } from '../contexts/ThemeContext';

interface SearchUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  profileImageUrl?: string;
  followersCount: number;
  following: boolean;
}

interface TrendingTopic {
  tag: string;
  posts: number;
  category?: string;
}

interface SuggestedUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  profileImageUrl?: string;
  followersCount: number;
  postsCount?: number;  // Added for post count
  following: boolean;
}

interface RightSidebarProps {
  onUserClick?: (userId: string) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ onUserClick }) => {
  const { user } = useAuth();
  const { themeName, setTheme } = useTheme();  // ADD THIS LINE
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Real data states
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [suggestedLoading, setSuggestedLoading] = useState(true);

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

  // Load trending topics
  const loadTrending = async () => {
    try {
      setTrendingLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch('https://patr.me/api/posts/trending', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔥 Trending API response:', data);
        
        // Check if we got trending topics with counts
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'tag' in data[0]) {
          // We got trending topics with post counts
          setTrending(data);
        } else if (Array.isArray(data)) {
          // We got simple hashtag array, convert to trending topics
          const trendingWithCounts = data.map((tag: string) => ({
            tag: tag.startsWith('#') ? tag : `#${tag}`,
            posts: Math.floor(Math.random() * 500) + 100,
            category: 'Technology'
          }));
          setTrending(trendingWithCounts);
        } else {
          // Fallback to default trending
          setTrending([
            { tag: '#javascript', posts: Math.floor(Math.random() * 1000) + 500, category: 'Technology' },
            { tag: '#react', posts: Math.floor(Math.random() * 1000) + 500, category: 'Technology' },
            { tag: '#webdev', posts: Math.floor(Math.random() * 1000) + 500, category: 'Technology' },
            { tag: '#coding', posts: Math.floor(Math.random() * 1000) + 500, category: 'Technology' },
            { tag: '#tech', posts: Math.floor(Math.random() * 1000) + 500, category: 'Technology' }
          ]);
        }
      } else {
        console.error('Failed to load trending topics:', response.status);
        // Use fallback data
        setTrending([
          { tag: '#javascript', posts: 589, category: 'Technology' },
          { tag: '#react', posts: 985, category: 'Technology' },
          { tag: '#webdev', posts: 995, category: 'Technology' },
          { tag: '#coding', posts: 949, category: 'Technology' },
          { tag: '#tech', posts: 369, category: 'Technology' }
        ]);
      }
    } catch (error) {
      console.error('Error loading trending topics:', error);
      // Use fallback data
      setTrending([
        { tag: '#javascript', posts: 589, category: 'Technology' },
        { tag: '#react', posts: 985, category: 'Technology' },
        { tag: '#webdev', posts: 995, category: 'Technology' },
        { tag: '#coding', posts: 949, category: 'Technology' },
        { tag: '#tech', posts: 369, category: 'Technology' }
      ]);
    } finally {
      setTrendingLoading(false);
    }
  };

  // Load suggested users (top users by tweet count)
  const loadSuggestedUsers = async () => {
    try {
      setSuggestedLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch('https://patr.me/api/users/suggested', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('👥 Suggested users API response:', data);
        
        if (Array.isArray(data) && data.length > 0) {
          setSuggestedUsers(data);
        } else {
          console.log('No suggested users found, using fallback');
          // Fallback to demo users if no real users found
          setSuggestedUsers([
            {
              id: 'sample1',
              displayName: 'Start Following Users',
              username: 'getstarted',
              email: 'start@example.com',
              followersCount: 0,
              postsCount: 0,
              following: false
            }
          ]);
        }
      } else {
        console.error('Failed to load suggested users:', response.status);
        setSuggestedUsers([
          {
            id: 'error1',
            displayName: 'Error Loading Users',
            username: 'error',
            email: 'error@example.com',
            followersCount: 0,
            postsCount: 0,
            following: false
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading suggested users:', error);
      setSuggestedUsers([
        {
          id: 'error1',
          displayName: 'Network Error',
          username: 'networkerror',
          email: 'error@example.com',
          followersCount: 0,
          postsCount: 0,
          following: false
        }
      ]);
    } finally {
      setSuggestedLoading(false);
    }
  };

  // Load initial data on component mount
  useEffect(() => {
    loadTrending();
    loadSuggestedUsers();
  }, [user]);

  // Search users function
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    try {
      setSearchLoading(true);
      setShowResults(true);
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
        
        // Update search results
        setSearchResults(prev => 
          prev.map(u => 
            u.id === userId 
              ? { ...u, following: result.following, followersCount: result.following ? u.followersCount + 1 : Math.max(0, u.followersCount - 1) }
              : u
          )
        );

        // Update suggested users
        setSuggestedUsers(prev => 
          prev.map(u => 
            u.id === userId 
              ? { ...u, following: result.following, followersCount: result.following ? u.followersCount + 1 : Math.max(0, u.followersCount - 1) }
              : u
          )
        );

        console.log(`Successfully ${result.following ? 'followed' : 'unfollowed'} user`);
      } else {
        console.error('Follow action failed:', response.status);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  // Handle user click
  const handleUserClick = (userId: string) => {
    if (onUserClick && !userId.startsWith('sample') && !userId.startsWith('error')) {
      onUserClick(userId);
      // Close search when navigating to profile
      setShowResults(false);
      setSearchQuery('');
    }
  };

  // Debounced search
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <aside className="w-80 p-4 h-screen sticky top-0 overflow-y-auto hidden lg:block">
      {/* Search Section */}
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Patr"
            className="w-full bg-gray-900 text-white pl-12 pr-4 py-3 rounded-full border border-gray-700 focus:border-blue-400 focus:outline-none transition-colors"
          />
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-gray-700 rounded-2xl shadow-xl z-50 max-h-96 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-lg font-bold text-white mb-4">
                {searchLoading ? 'Searching...' : searchResults.length > 0 ? 'Users' : 'No results'}
              </h3>
              
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-gray-400">
                    {searchQuery ? `No users found for "${searchQuery}"` : 'Try searching for people'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((searchUser) => (
                    <div key={searchUser.id} className="flex items-center justify-between p-3 hover:bg-gray-900 rounded-lg transition-colors">
                      <div 
                        className="flex items-center space-x-3 min-w-0 flex-1 cursor-pointer"
                        onClick={() => handleUserClick(searchUser.id)}
                      >
                        <div className="flex-shrink-0">
                          {searchUser.profileImageUrl ? (
                            <img
                              src={searchUser.profileImageUrl}
                              alt={searchUser.displayName}
                              className="w-12 h-12 rounded-full object-cover hover:opacity-90 transition-opacity"
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
                            className={`w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm hover:opacity-90 transition-opacity ${searchUser.profileImageUrl ? 'hidden' : ''}`}
                          >
                            {getInitials(searchUser.displayName)}
                          </div>
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-white truncate hover:underline">{searchUser.displayName}</h4>
                          <p className="text-gray-400 text-sm truncate">@{searchUser.username}</p>
                          <p className="text-gray-500 text-xs">{searchUser.followersCount} followers</p>
                        </div>
                      </div>
                      
                      {user && searchUser.id !== user.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFollow(searchUser.id);
                          }}
                          className={`px-4 py-2 rounded-full font-semibold text-sm transition-colors min-w-[90px] ${
                            searchUser.following
                              ? 'bg-transparent border border-gray-600 text-white hover:bg-red-600 hover:border-red-600'
                              : 'bg-white text-black hover:bg-gray-200'
                          }`}
                        >
                          {searchUser.following ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backdrop to close search results */}
        {showResults && (
          <div 
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowResults(false);
              setSearchQuery('');
            }}
          />
        )}
      </div>

      {/* What's happening section */}
      {!showResults && (
        <>
          <div className="bg-gray-900 rounded-2xl p-4 mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <TrendingUp className="w-6 h-6 mr-2 text-blue-400" />
              What's happening
            </h2>
            
            {trendingLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {trending.map((trend, index) => (
                  <div key={index} className="hover:bg-gray-800 p-3 rounded-lg cursor-pointer transition-colors">
                    <p className="text-gray-400 text-sm">Trending in {trend.category || 'Technology'}</p>
                    <p className="font-bold text-white">{trend.tag}</p>
                    <p className="text-gray-400 text-sm">{trend.posts.toLocaleString()} posts</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Contributors section */}
          <div className="bg-gray-900 rounded-2xl p-4">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center">
              <UserPlus className="w-6 h-6 mr-2 text-blue-400" />
              Top Contributors
            </h2>
            
            {suggestedLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {suggestedUsers.map((suggestedUser, index) => (
                  <div key={suggestedUser.id} className="flex items-center justify-between">
                    <div 
                      className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                      onClick={() => handleUserClick(suggestedUser.id)}
                    >
                      <div className="flex-shrink-0 relative">
                        {/* Position indicator for real users */}
                        {!suggestedUser.id.startsWith('sample') && !suggestedUser.id.startsWith('error') && (
                          <div className="absolute -top-1 -left-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold z-10">
                            {index + 1}
                          </div>
                        )}
                        
                        {suggestedUser.profileImageUrl ? (
                          <img
                            src={suggestedUser.profileImageUrl}
                            alt={suggestedUser.displayName}
                            className="w-12 h-12 rounded-full object-cover hover:opacity-90 transition-opacity"
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
                          className={`w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity ${suggestedUser.profileImageUrl ? 'hidden' : ''}`}
                        >
                          {getInitials(suggestedUser.displayName)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white hover:underline truncate">{suggestedUser.displayName}</h3>
                        <p className="text-gray-400 text-sm truncate">@{suggestedUser.username || suggestedUser.email?.split('@')[0]}</p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span>{suggestedUser.followersCount} followers</span>
                          {suggestedUser.postsCount !== undefined && (
                            <span>• {suggestedUser.postsCount} posts</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {user && suggestedUser.id !== user.id && !suggestedUser.id.startsWith('sample') && !suggestedUser.id.startsWith('error') && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFollow(suggestedUser.id);
                        }}
                        className={`px-3 py-1.5 rounded-full font-bold transition-colors text-sm ${
                          suggestedUser.following
                            ? 'bg-transparent border border-gray-600 text-white hover:bg-red-600 hover:border-red-600'
                            : 'bg-white text-black hover:bg-gray-200'
                        }`}
                      >
                        {suggestedUser.following ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Show encouraging message if users have posted */}
                {suggestedUsers.length > 0 && suggestedUsers.some(u => (u.postsCount || 0) > 0) && (
                  <div className="text-center py-2 border-t border-gray-800 mt-4">
                    <p className="text-xs text-gray-500">
                      Most active users this week 🔥
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── THEME PICKER ── */}
      {!showResults && (
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '16px',
            padding: '16px',
            marginTop: '16px',
          }}
        >
          <h2 className="text-base font-bold mb-3" style={{ color: 'var(--text, #e7e9ea)' }}>
            🎨 Theme
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {(Object.entries(themes) as [ThemeName, typeof themes[ThemeName]][]).map(([key, t]) => (
              <button
                key={key}
                onClick={() => {
                  setTheme(key);
                  // Apply CSS variables directly to document root
                  const root = document.documentElement;
                  root.style.setProperty('--bg', t.bg);
                  root.style.setProperty('--bg-secondary', t.bgSecondary);
                  root.style.setProperty('--border', t.border);
                  root.style.setProperty('--text', t.text);
                  root.style.setProperty('--text-dim', t.textDim);
                  root.style.setProperty('--accent', t.accent);
                  root.style.setProperty('--accent-hover', t.accentHover);
                  root.style.setProperty('--accent-text', t.accentText);
                  root.style.setProperty('--hover', t.hover);
                  root.style.setProperty('--widget', t.widget);
                  root.style.setProperty('--search-bg', t.searchBg);
                  document.body.style.backgroundColor = t.bg;
                  document.body.style.color = t.text;
                  localStorage.setItem('patr-theme', key);
                }}
                style={{
                  background: t.bg,
                  border: `2px solid ${themeName === key ? t.accent : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px',
                  padding: '10px 8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left',
                  boxShadow: themeName === key ? `0 0 12px ${t.accent}40` : 'none',
                }}
              >
                {/* Color bar */}
                <div
                  style={{
                    height: '6px',
                    borderRadius: '3px',
                    background: `linear-gradient(90deg, ${t.accent}, ${t.bg === '#f9f7f4' ? '#c084fc' : t.bgSecondary})`,
                    marginBottom: '8px',
                  }}
                />
                {/* Theme name */}
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: t.text,
                    display: 'block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {t.name}
                </span>
                {/* Active checkmark */}
                {themeName === key && (
                  <span style={{ fontSize: '10px', color: t.accent }}>✓ Active</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

    
    </aside>
  );
};

export default RightSidebar;