import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';
import { Post, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FeedTab = 'following' | 'discover';

const API = 'https://patr.me/api';

export default function HomeScreen() {
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const navigation = useNavigation<Nav>();

  const [tab, setTab] = useState<FeedTab>('following');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async (feedTab = tab, isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await getToken();
      const res = await fetch(
        `${API}/posts/feed?type=${feedTab}&page=1&limit=20&t=${Date.now()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, getToken]);

  useEffect(() => { fetchPosts(tab); }, [tab]);

  useFocusEffect(useCallback(() => { fetchPosts(tab, true); }, [tab]));

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts(tab, true);
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Home</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ComposePost')} style={s.composeBtn}>
          <Ionicons name="create-outline" size={22} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['following', 'discover'] as FeedTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
            {tab === t && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Feed */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : posts.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>{tab === 'following' ? '👥' : '🌟'}</Text>
          <Text style={s.emptyTitle}>
            {tab === 'following' ? 'Your Following feed is empty' : 'Nothing to discover yet'}
          </Text>
          <Text style={s.emptyText}>
            {tab === 'following'
              ? 'Follow people to see their posts here.'
              : 'Check back later for new content!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onUserPress={id => navigation.navigate('UserProfile', { userId: id })}
              onPostPress={id => navigation.navigate('PostDetail', { postId: id })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accent}
            />
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    headerTitle: { color: theme.text, fontSize: 20, fontWeight: '800' },
    composeBtn: { padding: 4 },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      position: 'relative',
    },
    tabBtnActive: {},
    tabText: { color: theme.textDim, fontWeight: '600', fontSize: 15 },
    tabTextActive: { color: theme.text, fontWeight: '700' },
    tabIndicator: {
      position: 'absolute',
      bottom: 0,
      left: '20%',
      right: '20%',
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.accent,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
    emptyText: { color: theme.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  });
