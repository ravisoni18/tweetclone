import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const API = 'https://patr.me/api';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'retweet' | 'mention' | string;
  message?: string;
  read: boolean;
  createdAt: string;
  actor?: {
    id: string;
    displayName: string;
    username: string;
    profileImageUrl?: string;
  };
  post?: { id: string; content: string };
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function notifIcon(type: string): { name: string; color: string } {
  switch (type) {
    case 'like': return { name: 'heart', color: '#ef4444' };
    case 'comment': return { name: 'chatbubble', color: '#3b82f6' };
    case 'follow': return { name: 'person-add', color: '#22c55e' };
    case 'retweet': return { name: 'repeat', color: '#22c55e' };
    case 'mention': return { name: 'at', color: '#a855f7' };
    default: return { name: 'notifications', color: '#6366f1' };
  }
}

function notifMessage(n: Notification): string {
  if (n.message) return n.message;
  const name = n.actor?.displayName || 'Someone';
  switch (n.type) {
    case 'like': return `${name} liked your post`;
    case 'comment': return `${name} commented on your post`;
    case 'follow': return `${name} followed you`;
    case 'retweet': return `${name} retweeted your post`;
    case 'mention': return `${name} mentioned you`;
    default: return `${name} interacted with you`;
  }
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const navigation = useNavigation<Nav>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/notifications?page=1&limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : (data.notifications || []));
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [getToken]);

  useEffect(() => { fetchNotifications(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchNotifications(true); };

  const markAsRead = async (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    try {
      const token = await getToken();
      await fetch(`${API}/notifications/${notifId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const s = styles(theme);

  const renderItem = ({ item }: { item: Notification }) => {
    const icon = notifIcon(item.type);
    return (
      <TouchableOpacity
        style={[s.notifRow, !item.read && s.notifUnread]}
        onPress={() => {
          markAsRead(item.id);
          if (item.post?.id) navigation.navigate('PostDetail', { postId: item.post.id });
          else if (item.actor?.id && item.type === 'follow') navigation.navigate('UserProfile', { userId: item.actor.id });
        }}
      >
        <View style={[s.iconWrap, { backgroundColor: icon.color + '22' }]}>
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>
        {item.actor?.profileImageUrl ? (
          <Image source={{ uri: item.actor.profileImageUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarText}>{item.actor?.displayName?.[0] || '?'}</Text>
          </View>
        )}
        <View style={s.notifContent}>
          <Text style={[s.notifMessage, !item.read && { color: theme.text }]}>
            {notifMessage(item)}
          </Text>
          {item.post?.content && (
            <Text style={s.notifPostPreview} numberOfLines={1}>{item.post.content}</Text>
          )}
          <Text style={s.notifTime}>{formatTime(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={s.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={theme.accent} /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textDim} />
              <Text style={s.emptyTitle}>No notifications yet</Text>
              <Text style={s.emptyText}>When people like or reply to your posts, you'll see it here.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  title: { color: theme.text, fontSize: 20, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '700' },
  emptyText: { color: theme.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  notifUnread: { backgroundColor: theme.accent + '08' },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  notifContent: { flex: 1 },
  notifMessage: { color: theme.textDim, fontSize: 14, lineHeight: 20 },
  notifPostPreview: {
    color: theme.textDim, fontSize: 13, fontStyle: 'italic',
    marginTop: 2, opacity: 0.7,
  },
  notifTime: { color: theme.textDim, fontSize: 12, marginTop: 2, opacity: 0.6 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent,
  },
});
