// types/index.ts - Complete type definitions for Twitter Clone with ratings and comments

export interface User {
  id: string;
  email: string;
  displayName: string;
  username: string;
  bio?: string;
  location?: string;
  website?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  verified?: boolean;
  createdAt: string;
  updatedAt: string;
  following?: boolean; // For follow status in API responses
}

export interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  user: User;
  userId: string; // Add userId for easier access
  likesCount: number;
  retweetsCount: number;
  repliesCount: number;
  commentsCount: number; // New field for comments
  averageRating?: number; // New field for average rating
  ratingCount?: number; // New field for number of ratings
  userRating?: number; // New field for current user's rating
  userHasRated?: boolean; // New field to check if user has rated
  viewsCount: number;
  isDeleted: boolean;
  isLiked?: boolean;
  isRetweeted?: boolean;
  isBookmarked?: boolean;
  quoteTweet?: Post;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  parentCommentId?: string; // For threaded replies
  createdAt: string;
  updatedAt: string;
  user: User;
  userId: string; // Add userId for easier access
  likesCount: number;
  replyCount: number; // Number of replies to this comment
  userHasLiked: boolean; // Whether current user has liked this comment
}

export interface Rating {
  id: string;
  postId: string;
  userId: string;
  rating: number; // 1-5 scale
  createdAt: string;
  updatedAt: string;
}

export interface CommentLike {
  id: string;
  commentId: string;
  userId: string;
  createdAt: string;
}

// API Response Types
export interface PostDetailResponse {
  id: string;
  content: string;
  imageUrl?: string;
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

export interface CommentResponse {
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

export interface RatingResponse {
  success: boolean;
  rating: number;
  averageRating: number;
  ratingCount: number;
  message: string;
}

export interface CommentLikeResponse {
  liked: boolean;
  likesCount: number;
  action: 'liked' | 'unliked';
}

export interface FeedResponse {
  posts: Post[];
  hasMore: boolean;
  page: number;
  total: number;
  feedType: string;
}

export interface SearchUserResponse {
  id: string;
  displayName: string;
  username: string;
  email: string;
  profileImageUrl?: string;
  followersCount: number;
  following: boolean;
}

// Form Data Types
export interface CreateCommentData {
  content: string;
  parent_comment_id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto: string;
}

export interface CreateRatingData {
  rating: number; // 1-5
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto: string;
}

export interface CreatePostData {
  content: string;
  image?: File;
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto: string;
}

export interface UpdateUserData {
  displayName?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
}

// Component Props Types
export interface PostDetailProps {
  postId: string;
  onBack: () => void;
}

export interface CommentProps {
  comment: Comment;
  onLike: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onReply: (commentId: string) => void;
  currentUser?: User;
}

export interface RatingComponentProps {
  rating: number;
  onRate: (rating: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export interface CommentFormProps {
  onSubmit: (content: string, parentId?: string) => void;
  placeholder?: string;
  parentCommentId?: string;
  loading?: boolean;
  onCancel?: () => void;
}

// Error Types
export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

// Enums
export enum FeedType {
  HOME = 'home',
  EXPLORE = 'explore',
  FOLLOWING = 'following',
  DISCOVER = 'discover'
}

export enum ViewType {
  FEED = 'feed',
  PROFILE = 'profile',
  POST_DETAIL = 'post_detail',
  SEARCH = 'search'
}

export enum RatingValue {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5
}

// Constants
export const RATING_SCALE = {
  MIN: 1,
  MAX: 5
} as const;

export const COMMENT_LIMITS = {
  MAX_LENGTH: 280,
  MAX_NESTED_LEVEL: 3
} as const;

export const POST_LIMITS = {
  MAX_CONTENT_LENGTH: 280,
  MAX_IMAGE_SIZE_MB: 2,
  MAX_IMAGES_PER_POST: 1
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
} as const;

// Validation helpers
export const isValidRating = (rating: number): rating is RatingValue => {
  return Number.isInteger(rating) && rating >= RATING_SCALE.MIN && rating <= RATING_SCALE.MAX;
};

export const isValidComment = (content: string): boolean => {
  return content.trim().length > 0 && content.length <= COMMENT_LIMITS.MAX_LENGTH;
};

export const isValidPost = (content: string): boolean => {
  return content.trim().length > 0 && content.length <= POST_LIMITS.MAX_CONTENT_LENGTH;
};

// Helper functions for UI
export const formatRating = (rating: number): string => {
  return rating.toFixed(1);
};

export const getRatingText = (rating: number): string => {
  if (rating >= 4.5) return 'Excellent';
  if (rating >= 3.5) return 'Good';
  if (rating >= 2.5) return 'Average';
  if (rating >= 1.5) return 'Poor';
  return 'Very Poor';
};

export const formatCommentCount = (count: number): string => {
  if (count === 0) return 'No comments';
  if (count === 1) return '1 comment';
  return `${count} comments`;
};

export const formatRatingCount = (count: number): string => {
  if (count === 0) return 'No ratings';
  if (count === 1) return '1 rating';
  return `${count} ratings`;
};

// Date formatting helpers
export const formatPostDate = (dateString: string): string => {
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

export const formatFullDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

// User avatar helpers
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

export const getAvatarUrl = (user: User): string => {
  return user.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=6366f1&color=ffffff&size=128`;
};

export type InviteStatus = 'idle' | 'pending' | 'rejected' | 'approved';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  inviteStatus: InviteStatus;
  pendingUserName: string;
  clearInviteStatus: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateUserData) => Promise<void>;
}











export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface Like {
  id: string;
  userId: string;
  postId: string;
  createdAt: string;
}

export interface Retweet {
  id: string;
  userId: string;
  postId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  type: 'like' | 'retweet' | 'follow' | 'reply' | 'mention';
  postId?: string;
  isRead: boolean;
  createdAt: string;
  actor: User;
  post?: Post;
}

export interface Bookmark {
  id: string;
  userId: string;
  postId: string;
  createdAt: string;
}

export interface Hashtag {
  id: string;
  tag: string;
  postsCount: number;
  createdAt: string;
}





