export interface User {
  id: string;
  email: string;
  displayName: string;
  username: string;
  bio: string;
  location: string;
  website: string;
  profileImageUrl: string;
  coverImageUrl: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  following?: boolean;
}

export interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  commentsCount: number;
  retweetsCount: number;
  repliesCount?: number;
  averageRating?: number;
  ratingCount?: number;
  user: User;
}

export interface Article {
  id: string;
  title: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  publishedAt?: string;
  createdAt: string;
  readingTimeMinutes?: number;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  user: User;
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string };
  ComposePost: undefined;
  ArticleDetail: { articleId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Notifications: undefined;
  Profile: undefined;
  Settings: undefined;
};
