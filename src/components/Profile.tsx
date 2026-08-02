import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Link as LinkIcon, Edit3, Camera, ArrowLeft } from 'lucide-react';
import { User, Post as PostType, UpdateUserData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Post from './Post';
import { auth } from '../config/firebase';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';

interface ProfileProps {
  userId?: string;
  onBack?: () => void;
  onArticleClick?: (articleId: string) => void; // ADDED for article navigation
}

const Profile: React.FC<ProfileProps> = ({ userId, onBack, onArticleClick }) => {
  const { user: currentUser, updateProfile } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [replies, setReplies] = useState<PostType[]>([]);
  const [mediaPosts, setMediaPosts] = useState<PostType[]>([]);
  const [likedPosts, setLikedPosts] = useState<PostType[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [editData, setEditData] = useState<UpdateUserData>({});
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'likes' | 'articles'>('posts');

  const targetUserId = userId || currentUser?.id;
  const isOwnProfile = targetUserId === currentUser?.id;

  // Helper function to get auth token
  const getAuthToken = async (): Promise<string> => {
    try {
      const authUser = auth.currentUser;
      if (!authUser) return '';
      
      const token = await authUser.getIdToken(true);
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return '';
    }
  };

  // Helper function to get current user data for API calls
  const getCurrentUserData = () => {
    const authUser = auth.currentUser;
    if (!authUser) return {};
    
    return {
      userId: authUser.uid,
      userEmail: authUser.email || '',
      userName: authUser.displayName || authUser.email?.split('@')[0] || 'User',
      userPhoto: authUser.photoURL || ''
    };
  };

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!targetUserId) {
        console.log('❌ No target user ID provided');
        return;
      }

      try {
        setLoading(true);
        const token = await getAuthToken();
        
        console.log('🔍 Loading profile for:', targetUserId);
        
        const response = await fetch(`/api/users/${targetUserId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        console.log('📡 Profile API response:', response.status);

        if (response.ok) {
          const userData = await response.json();
          console.log('✅ Profile data received:', userData);
          
          const processedUser: User = {
            id: userData.id || targetUserId,
            displayName: userData.displayName || userData.name || 'User',
            username: userData.username || userData.email?.split('@')[0] || 'user',
            email: userData.email || '',
            profileImageUrl: userData.profileImageUrl || userData.profileImage || userData.photoURL,
            coverImageUrl: userData.coverImageUrl || userData.coverImage,
            bio: userData.bio || userData.description || '',
            location: userData.location || '',
            website: userData.website || '',
            createdAt: userData.createdAt || userData.joinedDate || new Date().toISOString(),
            updatedAt: userData.updatedAt || userData.lastModified || new Date().toISOString(),
            followersCount: userData.followersCount || userData.followers || 0,
            followingCount: userData.followingCount || userData.following || 0,
            postsCount: userData.postsCount || userData.posts || 0,
            following: userData.isFollowing || userData.following === true,
            verified: userData.verified || false
          };
          
          setProfileUser(processedUser);
          
          if (!isOwnProfile && currentUser) {
            setIsFollowing(processedUser.following === true);
          }
        } else {
          const errorText = await response.text();
          console.error('❌ Profile API error:', response.status, errorText);
        }
        
      } catch (error) {
        console.error('❌ Profile loading error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [targetUserId, isOwnProfile, currentUser]);

  // Load posts
  useEffect(() => {
    const loadPosts = async () => {
      if (!targetUserId) return;

      try {
        setPostsLoading(true);
        const token = await getAuthToken();
        const userData = getCurrentUserData();
        
        console.log('🔍 Loading posts for user:', targetUserId);
        
        const endpoints = [
          `/api/users/${targetUserId}/posts`,
          `/api/posts/user/${targetUserId}`,
          `/api/posts/feed?type=user&userId=${targetUserId}`,
          `/api/posts/feed?type=all`
        ];

        let postsData = null;

        for (let i = 0; i < endpoints.length; i++) {
          const endpoint = endpoints[i];
          console.log(`🔄 Trying endpoint ${i + 1}/${endpoints.length}: ${endpoint}`);

          try {
            let response = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            if (!response.ok && i < 3) {
              response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
              });
            }

            if (response.ok) {
              const data = await response.json();
              
              let posts = null;
              if (data.posts && Array.isArray(data.posts)) {
                posts = data.posts;
              } else if (Array.isArray(data)) {
                posts = data;
              } else if (data.data && Array.isArray(data.data)) {
                posts = data.data;
              }

              if (posts && Array.isArray(posts)) {
                const userOnlyPosts = posts.filter((post: PostType) => {
                  const postUserId = post.user?.id || (post as any).userId || (post as any).user_id;
                  return postUserId === targetUserId;
                });

                if (userOnlyPosts.length > 0) {
                  postsData = userOnlyPosts;
                  console.log(`✅ Found ${userOnlyPosts.length} user posts`);
                  break;
                }
              }
            }
          } catch (error) {
            console.error(`❌ Error with ${endpoint}:`, error);
          }
        }

        if (postsData && Array.isArray(postsData)) {
          setPosts(postsData);
          
          const repliesData = postsData.filter((post: PostType) => 
            (post as any).parentId || 
            (post as any).in_reply_to || 
            (post as any).replyToId ||
            (post as any).isReply ||
            post.content.startsWith('@')
          );
          setReplies(repliesData);

          const mediaData = postsData.filter((post: PostType) => 
            post.imageUrl || (post as any).videoUrl
          );
          setMediaPosts(mediaData);
        } else {
          setPosts([]);
          setReplies([]);
          setMediaPosts([]);
        }

      } catch (error) {
        console.error('❌ Posts loading error:', error);
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };

    if (targetUserId && (activeTab === 'posts' || posts.length === 0)) {
      loadPosts();
    }
  }, [targetUserId, activeTab]);

  // Load articles
  useEffect(() => {
    const loadArticles = async () => {
      if (!targetUserId) return;

      try {
        setPostsLoading(true);
        const token = await getAuthToken();
        
        console.log('📚 Loading articles for user:', targetUserId);
        
        const response = await fetch(`/api/articles?userId=${targetUserId}&status=published`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
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
        setPostsLoading(false);
      }
    };

    if (targetUserId && activeTab === 'articles') {
      loadArticles();
    }
  }, [targetUserId, activeTab]);

  const handleFollow = async () => {
    if (!profileUser || followLoading || !currentUser) return;

    try {
      setFollowLoading(true);
      const token = await getAuthToken();
      const userData = getCurrentUserData();
      
      const response = await fetch(`/api/follow/${profileUser.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        const result = await response.json();
        setIsFollowing(result.following === true);
        
        setProfileUser(prev => prev ? {
          ...prev,
          followersCount: result.following ? 
            (prev.followersCount || 0) + 1 : 
            Math.max(0, (prev.followersCount || 0) - 1)
        } : null);
      }
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser || !targetUserId) return;

    try {
      setUpdateLoading(true);
      const token = await getAuthToken();
      
      const updatePayload = {
        userId: currentUser.id,
        displayName: editData.displayName?.trim() || profileUser?.displayName,
        username: editData.username?.trim() || profileUser?.username,
        bio: editData.bio?.trim() || profileUser?.bio || '',
        location: editData.location?.trim() || profileUser?.location || '',
        website: editData.website?.trim() || profileUser?.website || '',
      };

      const response = await fetch(`/api/users/${targetUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (response.ok) {
        const result = await response.json();
        
        if (profileUser) {
          const updatedProfile: User = {
            ...profileUser,
            displayName: updatePayload.displayName || profileUser.displayName,
            username: updatePayload.username || profileUser.username,
            bio: updatePayload.bio,
            location: updatePayload.location,
            website: updatePayload.website,
            updatedAt: new Date().toISOString()
          };
          
          setProfileUser(updatedProfile);
        }

        try {
          const authUser = auth.currentUser;
          if (authUser && updatePayload.displayName) {
            await updateFirebaseProfile(authUser, {
              displayName: updatePayload.displayName
            });
          }
        } catch (firebaseError) {
          console.warn('⚠️ Firebase profile update failed (non-critical):', firebaseError);
        }

        setIsEditing(false);
        setEditData({});
        alert('Profile updated successfully!');
      } else {
        const errorText = await response.text();
        console.error('❌ Profile update failed:', response.status, errorText);
        alert('Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      alert('An error occurred while updating your profile. Please try again.');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleTabChange = (tab: 'posts' | 'replies' | 'media' | 'likes' | 'articles') => {
    console.log(`🔄 Switching to ${tab} tab`);
    setActiveTab(tab);
  };

  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'posts':
        return posts;
      case 'replies':
        return replies;
      case 'media':
        return mediaPosts;
      case 'likes':
        return likedPosts;
      case 'articles':
        return articles;
      default:
        return [];
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <div className="flex-1 border-r border-gray-800">
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex-1 border-r border-gray-800">
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Profile not found</h2>
          <p className="text-gray-400">This user doesn't exist or couldn't be loaded.</p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full font-semibold transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentTabData = getCurrentTabData();
  const isCurrentTabLoading = postsLoading && activeTab === 'posts';

  return (
    <div className="flex-1 border-r border-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-black/80 border-b border-gray-800 p-4">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{profileUser.displayName}</h1>
            <p className="text-sm text-gray-400">{profileUser.postsCount || posts.length} posts</p>
          </div>
        </div>
      </div>

      {/* Cover image */}
      <div className="relative h-48 bg-gradient-to-r from-purple-600 to-blue-600">
        {profileUser.coverImageUrl && (
          <img
            src={profileUser.coverImageUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        {isOwnProfile && isEditing && (
          <button className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition-colors">
            <Camera className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Profile info */}
      <div className="px-4 pb-4">
        <div className="relative flex justify-between items-end -mt-16 mb-4">
          {/* Profile picture */}
          <div className="relative">
            {profileUser.profileImageUrl ? (
              <img
                src={profileUser.profileImageUrl}
                alt={profileUser.displayName}
                className="w-32 h-32 rounded-full border-4 border-black object-cover"
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
              className={`w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full border-4 border-black flex items-center justify-center text-white font-bold text-2xl ${profileUser.profileImageUrl ? 'hidden' : ''}`}
            >
              {getInitials(profileUser.displayName)}
            </div>
            {isOwnProfile && isEditing && (
              <button className="absolute bottom-2 right-2 p-2 bg-black/70 backdrop-blur-sm rounded-full hover:bg-black/80 transition-colors">
                <Camera className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex space-x-2">
            {isOwnProfile ? (
              <>
                {isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({});
                    }}
                    className="bg-transparent border border-gray-600 text-white font-bold px-6 py-2 rounded-full hover:bg-gray-900 transition-colors"
                    disabled={updateLoading}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => {
                    if (isEditing) {
                      handleSaveProfile();
                    } else {
                      setIsEditing(true);
                      setEditData({
                        displayName: profileUser.displayName,
                        username: profileUser.username,
                        bio: profileUser.bio || '',
                        location: profileUser.location || '',
                        website: profileUser.website || '',
                      });
                    }
                  }}
                  disabled={updateLoading}
                  className="bg-transparent border border-gray-600 text-white font-bold px-6 py-2 rounded-full hover:bg-gray-900 transition-colors flex items-center space-x-2"
                >
                  {updateLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="w-4 h-4" />
                      <span>{isEditing ? 'Save profile' : 'Edit profile'}</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`font-bold px-6 py-2 rounded-full transition-colors ${
                  isFollowing
                    ? 'bg-transparent border border-gray-600 text-white hover:bg-red-600 hover:border-red-600'
                    : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {followLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </div>
                ) : (
                  isFollowing ? 'Following' : 'Follow'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Profile details */}
        <div className="space-y-3">
          {/* Name and username */}
          <div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editData.displayName || ''}
                  onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                  className="w-full bg-transparent border-b border-gray-600 text-xl font-bold text-white pb-1 focus:outline-none focus:border-blue-400"
                  placeholder="Display name"
                  maxLength={50}
                />
                <input
                  type="text"
                  value={editData.username || ''}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  className="w-full bg-transparent border-b border-gray-600 text-gray-400 pb-1 focus:outline-none focus:border-blue-400"
                  placeholder="Username"
                  maxLength={30}
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-white">{profileUser.displayName}</h2>
                  {profileUser.verified && (
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-400">@{profileUser.username}</p>
              </div>
            )}
          </div>

          {/* Bio */}
          <div>
            {isEditing ? (
              <textarea
                value={editData.bio || ''}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                className="w-full bg-transparent border border-gray-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-none"
                placeholder="Tell the world about yourself"
                rows={3}
                maxLength={160}
              />
            ) : (
              profileUser.bio && <p className="text-white">{profileUser.bio}</p>
            )}
          </div>

          {/* Additional info */}
          <div className="flex flex-wrap items-center gap-4 text-gray-400 text-sm">
            {isEditing ? (
              <div className="flex flex-wrap gap-4 w-full">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <input
                    type="text"
                    value={editData.location || ''}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    className="bg-transparent border-b border-gray-600 text-white focus:outline-none focus:border-blue-400"
                    placeholder="Location"
                    maxLength={50}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <LinkIcon className="w-4 h-4" />
                  <input
                    type="url"
                    value={editData.website || ''}
                    onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                    className="bg-transparent border-b border-gray-600 text-white focus:outline-none focus:border-blue-400"
                    placeholder="Website (https://...)"
                    maxLength={100}
                  />
                </div>
              </div>
            ) : (
              <>
                {profileUser.location && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{profileUser.location}</span>
                  </div>
                )}
                {profileUser.website && (
                  <div className="flex items-center space-x-1">
                    <LinkIcon className="w-4 h-4" />
                    <a
                      href={profileUser.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {profileUser.website}
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {formatDate(profileUser.createdAt)}</span>
                </div>
              </>
            )}
          </div>

          {/* Following/Followers */}
          <div className="flex space-x-4 text-sm">
            <button className="hover:underline">
              <span className="font-bold text-white">{profileUser.followingCount || 0}</span>
              <span className="text-gray-400 ml-1">Following</span>
            </button>
            <button className="hover:underline">
              <span className="font-bold text-white">{profileUser.followersCount || 0}</span>
              <span className="text-gray-400 ml-1">Followers</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex">
          <button 
            onClick={() => handleTabChange('posts')}
            className={`flex-1 py-4 text-center font-bold transition-colors ${
              activeTab === 'posts' 
                ? 'text-white border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Posts
          </button>
          <button 
            onClick={() => handleTabChange('replies')}
            className={`flex-1 py-4 text-center font-bold transition-colors ${
              activeTab === 'replies' 
                ? 'text-white border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Replies
          </button>
          <button 
            onClick={() => handleTabChange('media')}
            className={`flex-1 py-4 text-center font-bold transition-colors ${
              activeTab === 'media' 
                ? 'text-white border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Media
          </button>
          <button 
            onClick={() => handleTabChange('articles')}
            className={`flex-1 py-4 text-center font-bold transition-colors ${
              activeTab === 'articles' 
                ? 'text-white border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Articles
          </button>
          <button 
            onClick={() => handleTabChange('likes')}
            className={`flex-1 py-4 text-center font-bold transition-colors ${
              activeTab === 'likes' 
                ? 'text-white border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Likes
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {isCurrentTabLoading ? (
        <div className="p-8 text-center">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading {activeTab}...</p>
        </div>
      ) : currentTabData.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-6xl mb-4">
            {activeTab === 'posts' && '📝'}
            {activeTab === 'replies' && '💬'}
            {activeTab === 'media' && '🎬'}
            {activeTab === 'articles' && '📰'}
            {activeTab === 'likes' && '❤️'}
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            {activeTab === 'posts' && 'No posts yet'}
            {activeTab === 'replies' && 'No replies yet'}
            {activeTab === 'media' && 'No media yet'}
            {activeTab === 'articles' && 'No articles yet'}
            {activeTab === 'likes' && 'No likes yet'}
          </h3>
          <p className="text-gray-400">
            {isOwnProfile 
              ? `You haven't ${
                  activeTab === 'posts' ? 'posted anything' : 
                  activeTab === 'replies' ? 'replied to anything' : 
                  activeTab === 'media' ? 'shared any media' : 
                  activeTab === 'articles' ? 'written any articles' :
                  'liked anything'
                } yet.`
              : `${profileUser.displayName} hasn't ${
                  activeTab === 'posts' ? 'posted anything' : 
                  activeTab === 'replies' ? 'replied to anything' : 
                  activeTab === 'media' ? 'shared any media' : 
                  activeTab === 'articles' ? 'written any articles' :
                  'liked anything'
                } yet.`
            }
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800">
          {activeTab === 'articles' ? (
            /* UPDATED: Render Articles with click handler */
            currentTabData.map((article: any) => (
              <div 
                key={article.id} 
                className="p-6 hover:bg-gray-950/50 transition-colors cursor-pointer"
                onClick={() => {
                  console.log('📰 Article clicked:', article.id);
                  if (onArticleClick) {
                    onArticleClick(article.id);
                  }
                }}
              >
                {article.coverImageUrl && (
                  <img
                    src={article.coverImageUrl}
                    alt={article.title}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
                
                <div className="space-y-3">
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
                  
                  <button 
                    className="text-blue-400 hover:text-blue-300 font-semibold text-sm inline-flex items-center space-x-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onArticleClick) {
                        onArticleClick(article.id);
                      }
                    }}
                  >
                    <span>Read article</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            currentTabData.map((post) => (
              <Post
                key={post.id}
                post={post}
                onPostUpdate={(updatedPost) => {
                  switch (activeTab) {
                    case 'posts':
                      setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
                      break;
                    case 'replies':
                      setReplies(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
                      break;
                    case 'media':
                      setMediaPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
                      break;
                    case 'likes':
                      setLikedPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
                      break;
                  }
                }}
                onPostDelete={(postId) => {
                  switch (activeTab) {
                    case 'posts':
                      setPosts(prev => prev.filter(p => p.id !== postId));
                      break;
                    case 'replies':
                      setReplies(prev => prev.filter(p => p.id !== postId));
                      break;
                    case 'media':
                      setMediaPosts(prev => prev.filter(p => p.id !== postId));
                      break;
                    case 'likes':
                      setLikedPosts(prev => prev.filter(p => p.id !== postId));
                      break;
                  }
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;