// services/postsService.ts - Complete version with getTrendingHashtags

import { auth } from '../config/firebase';

const API_BASE_URL = '/api';

// Helper function to get authentication headers
const getAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const token = await user.getIdToken(true);
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

// Helper function to get auth headers for FormData
const getAuthHeadersForFormData = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const token = await user.getIdToken(true);
  return {
    'Authorization': `Bearer ${token}`,
    // Don't set Content-Type for FormData - browser sets it automatically
  };
};

export const postsService = {
  // Create a new post
  async createPost(content: string, imageFile?: File) {
    try {
      console.log('Creating post with content:', content);
      
      const headers = await getAuthHeadersForFormData();
      const formData = new FormData();
      formData.append('content', content);
      
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('Post created successfully:', result);
      return result;
    } catch (error) {
      console.error('Error in createPost:', error);
      throw error;
    }
  },

  // Get user feed - alias for getFeedPosts for compatibility
  async getFeed(page = 1, limit = 20) {
    return this.getFeedPosts(page, limit);
  },

  // Get feed posts (main method)
  async getFeedPosts(page = 1, limit = 20) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/feed?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting feed posts:', error);
      // Return empty feed on error instead of throwing
      return { posts: [], hasMore: false };
    }
  },

  // Get user posts
  async getUserPosts(userId: string, page = 1, limit = 20) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/user/${userId}?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting user posts:', error);
      return { posts: [], hasMore: false };
    }
  },

  // Get public posts (no auth required)
  async getPublicPosts(page = 1, limit = 20) {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/public?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting public posts:', error);
      return { posts: [], hasMore: false };
    }
  },

  // Get trending hashtags - main method
  async getTrendingHashtags() {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/trending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Return default trending topics on error
        return ['javascript', 'react', 'webdev', 'coding', 'tech'];
      }

      const result = await response.json();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error getting trending hashtags:', error);
      return ['javascript', 'react', 'webdev', 'coding', 'tech'];
    }
  },

  // Get trending - alias for getTrendingHashtags for compatibility
  async getTrending() {
    return this.getTrendingHashtags();
  },

  // Toggle like on a post
  async toggleLike(postId: string) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  },

  // Toggle retweet on a post
  async toggleRetweet(postId: string) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/retweet`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error toggling retweet:', error);
      throw error;
    }
  },

  // Toggle bookmark on a post
  async toggleBookmark(postId: string) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}/bookmark`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      throw error;
    }
  },

  // Delete a post
  async deletePost(postId: string) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },

  // Get a specific post
  async getPost(postId: string) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting post:', error);
      throw error;
    }
  },

  // Search posts
  async searchPosts(query: string, page = 1, limit = 20) {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/posts/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error searching posts:', error);
      return { posts: [], hasMore: false };
    }
  },

  // Upload image
  async uploadImage(file: File) {
    try {
      const headers = await getAuthHeadersForFormData();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/uploads`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }
};

// Debug function to check authentication
export const debugAuth = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No user authenticated');
      return false;
    }

    console.log('✅ User authenticated:', user.uid);
    console.log('📧 Email:', user.email);
    console.log('📛 Display Name:', user.displayName);

    const token = await user.getIdToken();
    console.log('🔑 Token (first 50 chars):', token.substring(0, 50) + '...');

    // Test API call
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🏥 API Health:', data);
        return true;
      } else {
        console.error('🚨 API Health Check Failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('🚨 API Health Check Failed:', error);
      return false;
    }
  } catch (error) {
    console.error('🚨 Auth Debug Error:', error);
    return false;
  }
};

export default postsService;