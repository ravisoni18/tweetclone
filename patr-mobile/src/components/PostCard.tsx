import React, { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Post } from '../types';
import ImageViewer from './MediaViewer';

const API = 'https://patr.me/api';

interface Props {
  post: Post;
  onUserPress: (userId: string) => void;
  onPostPress: (postId: string) => void;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function fmtCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function PostCard({ post, onUserPress, onPostPress }: Props) {
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const s = styles(theme);
  const u = post.user;

  const [liked, setLiked] = useState(!!(post as any).isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [retweeted, setRetweeted] = useState(!!(post as any).isRetweeted);
  const [retweetsCount, setRetweetsCount] = useState(post.retweetsCount || 0);
  const [bookmarked, setBookmarked] = useState(!!(post as any).isBookmarked);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  const handleLike = async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount(c => wasLiked ? Math.max(0, c - 1) : c + 1);
    try {
      const token = await getToken();
      await fetch(`${API}/posts/${post.id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setLiked(wasLiked);
      setLikesCount(c => wasLiked ? c + 1 : Math.max(0, c - 1));
    }
  };

  const handleRetweet = async () => {
    const wasRetweeted = retweeted;
    setRetweeted(!wasRetweeted);
    setRetweetsCount(c => wasRetweeted ? Math.max(0, c - 1) : c + 1);
    try {
      const token = await getToken();
      await fetch(`${API}/posts/${post.id}/retweet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setRetweeted(wasRetweeted);
      setRetweetsCount(c => wasRetweeted ? c + 1 : Math.max(0, c - 1));
    }
  };

  const handleBookmark = async () => {
    const wasBookmarked = bookmarked;
    setBookmarked(!wasBookmarked);
    try {
      const token = await getToken();
      await fetch(`${API}/posts/${post.id}/bookmark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setBookmarked(wasBookmarked);
    }
  };

  return (
    <TouchableOpacity style={s.card} onPress={() => onPostPress(post.id)} activeOpacity={0.92}>
      {/* Avatar */}
      <TouchableOpacity onPress={() => onUserPress(u.id)} style={s.avatarWrap}>
        {u.profileImageUrl ? (
          <Image source={{ uri: u.profileImageUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitials}>{getInitials(u.displayName)}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Content */}
      <View style={s.body}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => onUserPress(u.id)}>
            <Text style={s.displayName} numberOfLines={1}>{u.displayName}</Text>
          </TouchableOpacity>
          {u.verified && (
            <Ionicons name="checkmark-circle" size={14} color={theme.accent} style={{ marginLeft: 3 }} />
          )}
          <Text style={s.username} numberOfLines={1}> @{u.username}</Text>
          <Text style={s.dot}> · </Text>
          <Text style={s.time}>{formatTime(post.createdAt)}</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.textDim} />
        </View>

        {/* Post text */}
        <Text style={s.content}>{post.content}</Text>

        {/* Image */}
        {post.imageUrl ? (
          <>
            <TouchableOpacity onPress={() => setImageViewerOpen(true)} activeOpacity={0.95}>
              <Image
                source={{ uri: post.imageUrl }}
                style={s.media}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <ImageViewer
              uri={post.imageUrl}
              visible={imageViewerOpen}
              onClose={() => setImageViewerOpen(false)}
            />
          </>
        ) : null}

        {/* Video — tap to open in system player (no native module needed) */}
        {!post.imageUrl && post.videoUrl ? (
          <TouchableOpacity
            style={s.videoThumb}
            onPress={() => Linking.openURL(post.videoUrl!)}
            activeOpacity={0.85}
          >
            <View style={s.playBtn}>
              <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.92)" />
            </View>
            <Text style={s.videoLabel}>Tap to play video</Text>
          </TouchableOpacity>
        ) : null}

        {/* Star rating */}
        {!!post.averageRating && post.averageRating > 0 && (
          <View style={s.rating}>
            {[1, 2, 3, 4, 5].map(i => (
              <Ionicons
                key={i}
                name={i <= Math.round(post.averageRating!) ? 'star' : 'star-outline'}
                size={14}
                color="#facc15"
              />
            ))}
            <Text style={s.ratingText}>
              {post.averageRating.toFixed(1)} ({post.ratingCount || 0})
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={s.actions}>
          {/* Comment */}
          <TouchableOpacity style={s.action} onPress={() => onPostPress(post.id)}>
            <Ionicons name="chatbubble-outline" size={18} color={theme.textDim} />
            {!!post.commentsCount && post.commentsCount > 0 && (
              <Text style={[s.actionCount, { color: theme.textDim }]}>{fmtCount(post.commentsCount)}</Text>
            )}
          </TouchableOpacity>

          {/* Retweet */}
          <TouchableOpacity style={s.action} onPress={handleRetweet}>
            <Ionicons
              name={retweeted ? 'repeat' : 'repeat-outline'}
              size={18}
              color={retweeted ? '#22c55e' : theme.textDim}
            />
            {retweetsCount > 0 && (
              <Text style={[s.actionCount, { color: retweeted ? '#22c55e' : theme.textDim }]}>
                {fmtCount(retweetsCount)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Like */}
          <TouchableOpacity style={s.action} onPress={handleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={18}
              color={liked ? '#ef4444' : theme.textDim}
            />
            {likesCount > 0 && (
              <Text style={[s.actionCount, { color: liked ? '#ef4444' : theme.textDim }]}>
                {fmtCount(likesCount)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Bookmark */}
          <TouchableOpacity style={s.action} onPress={handleBookmark}>
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={bookmarked ? theme.accent : theme.textDim}
            />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={s.action}>
            <Ionicons name="share-outline" size={18} color={theme.textDim} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      padding: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border || '#2f3336',
      backgroundColor: theme.bg || '#000',
    },
    avatarWrap: { marginRight: 12, paddingTop: 2 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarFallback: {
      backgroundColor: '#6366f1',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: { color: '#fff', fontWeight: '700', fontSize: 16 },
    body: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', marginBottom: 4 },
    displayName: {
      color: theme.text || '#e7e9ea',
      fontWeight: '700',
      fontSize: 15,
      maxWidth: 110,
    },
    username: { color: theme.textDim || '#71767b', fontSize: 13, maxWidth: 80 },
    dot: { color: theme.textDim || '#71767b', fontSize: 14 },
    time: { color: theme.textDim || '#71767b', fontSize: 12 },
    content: {
      color: theme.text || '#e7e9ea',
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 10,
    },
    media: {
      width: '100%',
      height: 200,
      borderRadius: 14,
      marginBottom: 10,
    },
    videoThumb: {
      width: '100%',
      height: 180,
      borderRadius: 14,
      marginBottom: 10,
      backgroundColor: '#111',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    playBtn: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoLabel: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 13,
      marginTop: 8,
    },
    rating: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 2,
    },
    ratingText: {
      color: theme.textDim || '#71767b',
      fontSize: 12,
      marginLeft: 6,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
      maxWidth: 300,
    },
    action: { flexDirection: 'row', alignItems: 'center', padding: 6 },
    actionCount: { fontSize: 13, marginLeft: 4 },
  });
