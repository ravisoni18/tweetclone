import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ActivityIndicator,
  FlatList, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';
import { RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'PostDetail'>;
const API = 'https://patr.me/api';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  likesCount: number;
  userHasLiked?: boolean;
  user: {
    id: string;
    displayName: string;
    username: string;
    profileImageUrl?: string;
    verified?: boolean;
  };
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

export default function PostDetailScreen() {
  const { theme } = useTheme();
  const { getToken, user: me } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { postId } = route.params;
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const h = { Authorization: `Bearer ${token}` };
        const [postRes] = await Promise.all([
          fetch(`${API}/posts/${postId}`, { headers: h }),
        ]);
        if (postRes.ok) setPost(await postRes.json());
      } catch {}
      setLoading(false);
      loadComments();
    })();
  }, [postId]);

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/posts/${postId}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : (data.comments || []));
      }
    } catch {}
    setCommentsLoading(false);
  };

  const submitComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => [newComment, ...prev]);
        setCommentText('');
        setPost((p: any) => p ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p);
      }
    } catch {}
    setSubmitting(false);
  };

  const toggleCommentLike = async (commentId: string) => {
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, userHasLiked: !c.userHasLiked, likesCount: c.userHasLiked ? Math.max(0, c.likesCount - 1) : c.likesCount + 1 }
        : c
    ));
    try {
      const token = await getToken();
      await fetch(`${API}/comments/${commentId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const s = styles(theme);

  const CommentItem = ({ item }: { item: Comment }) => (
    <View style={s.commentRow}>
      <TouchableOpacity onPress={() => (navigation as any).navigate('UserProfile', { userId: item.user.id })}>
        {item.user.profileImageUrl
          ? <Image source={{ uri: item.user.profileImageUrl }} style={s.commentAvatar} />
          : <View style={[s.commentAvatar, s.commentAvatarFallback]}>
              <Text style={s.commentAvatarText}>{item.user.displayName?.[0] || 'U'}</Text>
            </View>
        }
      </TouchableOpacity>
      <View style={s.commentBody}>
        <View style={s.commentHeader}>
          <TouchableOpacity onPress={() => (navigation as any).navigate('UserProfile', { userId: item.user.id })}>
            <Text style={s.commentName}>{item.user.displayName}</Text>
          </TouchableOpacity>
          {item.user.verified && <Ionicons name="checkmark-circle" size={12} color={theme.accent} />}
          <Text style={s.commentHandle}> @{item.user.username}</Text>
          <Text style={s.commentDot}> · </Text>
          <Text style={s.commentTime}>{formatTime(item.createdAt)}</Text>
        </View>
        <Text style={s.commentContent}>{item.content}</Text>
        <TouchableOpacity style={s.commentLike} onPress={() => toggleCommentLike(item.id)}>
          <Ionicons
            name={item.userHasLiked ? 'heart' : 'heart-outline'}
            size={14}
            color={item.userHasLiked ? '#ef4444' : theme.textDim}
          />
          {item.likesCount > 0 && (
            <Text style={[s.commentLikeCount, { color: item.userHasLiked ? '#ef4444' : theme.textDim }]}>
              {item.likesCount}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Post</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={theme.accent} /></View>
        ) : post ? (
          <FlatList
            data={comments}
            keyExtractor={i => i.id}
            ListHeaderComponent={
              <>
                <PostCard
                  post={post}
                  onUserPress={id => (navigation as any).navigate('UserProfile', { userId: id })}
                  onPostPress={() => {}}
                />
                <View style={s.commentsDivider}>
                  <Text style={s.commentsTitle}>
                    {post.commentsCount || comments.length} {post.commentsCount === 1 ? 'Comment' : 'Comments'}
                  </Text>
                </View>
                {commentsLoading && <ActivityIndicator color={theme.accent} style={{ padding: 16 }} />}
              </>
            }
            renderItem={({ item }) => <CommentItem item={item} />}
            ListEmptyComponent={
              !commentsLoading ? (
                <View style={s.emptyComments}>
                  <Ionicons name="chatbubble-outline" size={32} color={theme.textDim} />
                  <Text style={s.emptyCommentsText}>No comments yet. Be the first!</Text>
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        ) : (
          <View style={s.center}>
            <Text style={s.errorText}>Post not found</Text>
          </View>
        )}

        {/* Comment input */}
        {post && (
          <View style={s.inputBar}>
            {me?.profileImageUrl
              ? <Image source={{ uri: me.profileImageUrl }} style={s.inputAvatar} />
              : <View style={[s.inputAvatar, { backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{me?.displayName?.[0] || 'U'}</Text>
                </View>
            }
            <TextInput
              ref={inputRef}
              style={s.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor={theme.textDim}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[s.sendBtn, { opacity: commentText.trim() ? 1 : 0.4 }]}
              onPress={submitComment}
              disabled={!commentText.trim() || submitting}
            >
              {submitting
                ? <ActivityIndicator size="small" color={theme.accent} />
                : <Ionicons name="send" size={20} color={theme.accent} />
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  backBtn: { padding: 2 },
  headerTitle: { color: theme.text, fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: theme.textDim, fontSize: 16 },
  commentsDivider: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  commentsTitle: { color: theme.text, fontWeight: '700', fontSize: 16 },
  commentRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentAvatarFallback: { backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', marginBottom: 3 },
  commentName: { color: theme.text, fontWeight: '700', fontSize: 14 },
  commentHandle: { color: theme.textDim, fontSize: 12 },
  commentDot: { color: theme.textDim, fontSize: 12 },
  commentTime: { color: theme.textDim, fontSize: 12 },
  commentContent: { color: theme.text, fontSize: 14, lineHeight: 20 },
  commentLike: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  commentLikeCount: { fontSize: 12 },
  emptyComments: { alignItems: 'center', padding: 40, gap: 10 },
  emptyCommentsText: { color: theme.textDim, fontSize: 15, textAlign: 'center' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border,
    backgroundColor: theme.bg,
  },
  inputAvatar: { width: 34, height: 34, borderRadius: 17, marginBottom: 4 },
  commentInput: {
    flex: 1, color: theme.text, fontSize: 15,
    maxHeight: 100, paddingTop: 8, paddingBottom: 8,
    paddingHorizontal: 12, backgroundColor: theme.bgSecondary || theme.widget,
    borderRadius: 20, lineHeight: 20,
  },
  sendBtn: { padding: 8, marginBottom: 2 },
});
