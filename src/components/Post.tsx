import React, { useState } from 'react';
import { Post as PostType, User } from '../types';
import { Heart, MessageCircle, Repeat2, Bookmark, Share, MoreHorizontal, Trash2, Play } from 'lucide-react';
import { postsService } from '../services/postsService';
import { useAuth } from '../contexts/AuthContext';
import HtmlEmbed from './HtmlEmbed';

interface PostProps {
  post: PostType;
  onPostUpdate?: (updatedPost: PostType) => void;
  onPostDelete?: (postId: string) => void;
  showThread?: boolean;
}

const Post: React.FC<PostProps> = ({ post, onPostUpdate, onPostDelete, showThread = false }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isRetweeted, setIsRetweeted] = useState(post.isRetweeted || false);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked || false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [retweetsCount, setRetweetsCount] = useState(post.retweetsCount);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || loading) return;

    try {
      setLoading(true);
      const result = await postsService.toggleLike(post.id);
      setIsLiked(result.liked);
      setLikesCount(result.likesCount);
      
      if (onPostUpdate) {
        onPostUpdate({ ...post, isLiked: result.liked, likesCount: result.likesCount });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetweet = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || loading) return;

    try {
      setLoading(true);
      const result = await postsService.toggleRetweet(post.id);
      setIsRetweeted(result.retweeted);
      setRetweetsCount(result.retweetsCount);
      
      if (onPostUpdate) {
        onPostUpdate({ ...post, isRetweeted: result.retweeted, retweetsCount: result.retweetsCount });
      }
    } catch (error) {
      console.error('Error toggling retweet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || loading) return;

    try {
      setLoading(true);
      const result = await postsService.toggleBookmark(post.id);
      setIsBookmarked(result.bookmarked);
      
      if (onPostUpdate) {
        onPostUpdate({ ...post, isBookmarked: result.bookmarked });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || user.id !== post.userId || loading) return;

    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        setLoading(true);
        await postsService.deletePost(post.id);
        if (onPostDelete) {
          onPostDelete(post.id);
        }
      } catch (error) {
        console.error('Error deleting post:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const renderContent = (content: string) => {
    // Simple hashtag and mention highlighting
    return content.split(' ').map((word, index) => {
      if (word.startsWith('#')) {
        return (
          <span key={index} className="text-blue-400 hover:underline cursor-pointer">
            {word}{' '}
          </span>
        );
      } else if (word.startsWith('@')) {
        return (
          <span key={index} className="text-blue-400 hover:underline cursor-pointer">
            {word}{' '}
          </span>
        );
      }
      return word + ' ';
    });
  };

  // Enhanced media rendering function for both images and videos
  const renderMedia = () => {
    const hasImage = post.imageUrl;
    const hasVideo = (post as any).videoUrl;

    if (!hasImage && !hasVideo) return null;

    return (
      <div className="mt-3">
        {/* Image rendering */}
        {hasImage && (
          <div
            className="w-full flex items-center justify-center rounded-2xl overflow-hidden border border-gray-700"
            style={{ background: 'var(--bg-secondary, #16181c)', maxHeight: '28rem' }}
          >
            <img
              src={post.imageUrl}
              alt="Post image"
              className="max-w-full max-h-[28rem] object-contain"
            />
          </div>
        )}

        {/* Video rendering */}
        {hasVideo && (
          <div
            className="relative w-full flex items-center justify-center rounded-2xl overflow-hidden border border-gray-700"
            style={{ background: 'var(--bg-secondary, #16181c)', maxHeight: '28rem' }}
          >
            {!videoError ? (
              <video
                className="max-w-full max-h-[28rem] object-contain"
                controls
                preload="metadata"
                onError={() => {
                  console.error('Video failed to load:', (post as any).videoUrl);
                  setVideoError(true);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <source src={(post as any).videoUrl} type="video/mp4" />
                <source src={(post as any).videoUrl} type="video/webm" />
                <source src={(post as any).videoUrl} type="video/ogg" />
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex items-center justify-center h-48 bg-gray-900 text-gray-400">
                <div className="text-center">
                  <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Video could not be loaded</p>
                  <a
                    href={(post as any).videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline text-sm"
                    onClick={(e) => e.stopPropagation()}
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

  return (
    <article className="border-b border-gray-800 hover:bg-[var(--hover)] transition-colors cursor-pointer">
      <div className="p-4">
        <div className="flex space-x-3">
          {/* Avatar */}
          <img
            src={post.user.profileImageUrl || `https://ui-avatars.com/api/?name=${post.user.displayName}&background=6366f1&color=ffffff`}
            alt={post.user.displayName}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-purple-500/20"
          />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white hover:underline cursor-pointer">
                  {post.user.displayName}
                </h3>
                {post.user.verified && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                <span className="text-gray-400">@{post.user.username || post.user.email? post.user.email.split('@')[0] : 'No Email'}</span>
                <span className="text-gray-500">·</span>
                <time className="text-gray-500 text-sm">{formatTimeAgo(post.createdAt)}</time>
              </div>

              {/* Menu */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-black border border-gray-700 rounded-lg shadow-lg py-1 z-10 min-w-32">
                    {user?.id === post.userId && (
                      <button
                        onClick={handleDelete}
                        className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-800 flex items-center space-x-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="mt-2">
              <p className="text-white text-lg leading-relaxed">{renderContent(post.content)}</p>

              {/* Enhanced Media Display */}
              {renderMedia()}

              {/* HTML5 content (sandboxed) */}
              {post.htmlContent && <HtmlEmbed html={post.htmlContent} />}

              {/* Quote Tweet */}
              {post.quoteTweet && (
                <div className="mt-3 border border-gray-700 rounded-2xl p-3 hover:bg-[var(--hover)] transition-colors">
                  <div className="flex space-x-2">
                    <img
                      src={post.quoteTweet.user.profileImageUrl || `https://ui-avatars.com/api/?name=${post.quoteTweet.user.displayName}&background=6366f1&color=ffffff`}
                      alt={post.quoteTweet.user.displayName}
                      className="w-6 h-6 rounded-full"
                    />
                    <div>
                      <div className="flex items-center space-x-1">
                        <span className="font-bold text-sm text-white">{post.quoteTweet.user.displayName}</span>
                        <span className="text-gray-400 text-sm">@{post.quoteTweet.user.username || post.quoteTweet.user.email.split('@')[0]}</span>
                        <span className="text-gray-500 text-sm">·</span>
                        <time className="text-gray-500 text-sm">{formatTimeAgo(post.quoteTweet.createdAt)}</time>
                      </div>
                      <p className="text-white text-sm mt-1">{post.quoteTweet.content}</p>
                      {post.quoteTweet.imageUrl && (
                        <img
                          src={post.quoteTweet.imageUrl}
                          alt="Quote tweet image"
                          className="rounded-lg mt-2 max-w-full max-h-48 object-cover"
                        />
                      )}
                      {/* Quote tweet video support */}
                      {(post.quoteTweet as any).videoUrl && (
                        <video
                          src={(post.quoteTweet as any).videoUrl}
                          controls
                          className="rounded-lg mt-2 max-w-full max-h-48 object-cover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 max-w-md">
              <button className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors group">
                <div className="p-2 rounded-full group-hover:bg-blue-400/10 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-sm">{post.repliesCount}</span>
              </button>

              <button
                onClick={handleRetweet}
                disabled={loading}
                className={`flex items-center space-x-2 transition-colors group ${
                  isRetweeted ? 'text-green-400' : 'text-gray-400 hover:text-green-400'
                }`}
              >
                <div className="p-2 rounded-full group-hover:bg-green-400/10 transition-colors">
                  <Repeat2 className="w-5 h-5" />
                </div>
                <span className="text-sm">{retweetsCount}</span>
              </button>

              <button
                onClick={handleLike}
                disabled={loading}
                className={`flex items-center space-x-2 transition-colors group ${
                  isLiked ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
                }`}
              >
                <div className="p-2 rounded-full group-hover:bg-red-400/10 transition-colors">
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                </div>
                <span className="text-sm">{likesCount}</span>
              </button>

              <div className="flex items-center space-x-1">
                <button
                  onClick={handleBookmark}
                  disabled={loading}
                  className={`p-2 rounded-full transition-colors ${
                    isBookmarked ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'
                  }`}
                >
                  <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
                </button>

                <button className="p-2 rounded-full text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
                  <Share className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Click away handler for menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(false);
          }}
        />
      )}
    </article>
  );
};

export default Post;