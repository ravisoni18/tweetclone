import api from '../config/api';
import { User, Follow } from '../types';

export const usersService = {
  // Get user by ID or username
  getUser: async (identifier: string): Promise<User> => {
    const response = await api.get(`/users/${identifier}`);
    return response.data;
  },

  // Search users
  searchUsers: async (query: string): Promise<User[]> => {
    const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Follow/unfollow user
  toggleFollow: async (userId: string): Promise<{ following: boolean; followersCount: number }> => {
    const response = await api.post(`/users/${userId}/follow`);
    return response.data;
  },

  // Get user followers
  getFollowers: async (userId: string, page = 1, limit = 20): Promise<{ users: User[]; hasMore: boolean }> => {
    const response = await api.get(`/users/${userId}/followers?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get user following
  getFollowing: async (userId: string, page = 1, limit = 20): Promise<{ users: User[]; hasMore: boolean }> => {
    const response = await api.get(`/users/${userId}/following?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get suggested users to follow
  getSuggestedUsers: async (): Promise<User[]> => {
    const response = await api.get('/users/suggested');
    return response.data;
  },

  // Check if user is following another user
  isFollowing: async (userId: string): Promise<boolean> => {
    const response = await api.get(`/users/${userId}/is-following`);
    return response.data.following;
  },
};
