import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Image, ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';
import { RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const API = 'https://patr.me/api';

type ExploreTab = 'trending' | 'people' | 'posts';

function UserRow({ item, onPress, theme }: { item: any; onPress: () => void; theme: any }) {
  const s = styles(theme);
  return (
    <TouchableOpacity style={s.userRow} onPress={onPress}>
      {item.profileImageUrl
        ? <Image source={{ uri: item.profileImageUrl }} style={s.avatar} />
        : <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInit}>{item.displayName?.[0] || 'U'}</Text>
          </View>
      }
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={s.userName} numberOfLines={1}>{item.displayName}</Text>
          {item.verified && <Ionicons name="checkmark-circle" size={13} color={theme.accent} />}
        </View>
        <Text style={s.userHandle} numberOfLines={1}>@{item.username}</Text>
        {item.bio ? <Text style={s.userBio} numberOfLines={1}>{item.bio}</Text> : null}
      </View>
      <View style={s.followerBadge}>
        <Text style={s.followerCount}>{item.followersCount ?? 0}</Text>
        <Text style={s.followerLabel}>followers</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const { theme } = useTheme();
  const { getToken } = useAuth();
  const navigation = useNavigation<Nav>();
  const searchTimer = useRef<any>(null);

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ExploreTab>('trending');

  // Discover data
  const [trending, setTrending] = useState<string[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search results
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [searchPosts, setSearchPosts] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadDiscoverData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setDiscoverLoading(true);
    try {
      const token = await getToken();
      const h = { Authorization: `Bearer ${token}` };

      const [trendRes, usersRes, postsRes] = await Promise.allSettled([
        fetch(`${API}/posts/trending`, { headers: h }),
        fetch(`${API}/users/suggested`, { headers: h }),
        fetch(`${API}/posts/feed?type=discover&page=1&limit=20`, { headers: h }),
      ]);

      if (trendRes.status === 'fulfilled' && trendRes.value.ok) {
        const t = await trendRes.value.json();
        setTrending(Array.isArray(t) ? t : []);
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const u = await usersRes.value.json();
        setSuggestedUsers(Array.isArray(u) ? u : (u.users || []));
      }
      if (postsRes.status === 'fulfilled' && postsRes.value.ok) {
        const p = await postsRes.value.json();
        setDiscoverPosts(p.posts || []);
      }
    } catch {}
    setDiscoverLoading(false);
    setRefreshing(false);
  }, [getToken]);

  useEffect(() => { loadDiscoverData(); }, []);

  const onRefresh = () => { setRefreshing(true); loadDiscoverData(true); };

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchUsers([]); setSearchPosts([]); return; }
    setSearchLoading(true);
    try {
      const token = await getToken();
      const h = { Authorization: `Bearer ${token}` };
      const [uRes, pRes] = await Promise.allSettled([
        fetch(`${API}/users/search?q=${encodeURIComponent(q)}`, { headers: h }),
        fetch(`${API}/posts/search?q=${encodeURIComponent(q)}&page=1&limit=20`, { headers: h }),
      ]);
      if (uRes.status === 'fulfilled' && uRes.value.ok) {
        const u = await uRes.value.json();
        setSearchUsers(Array.isArray(u) ? u : (u.users || []));
      }
      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const p = await pRes.value.json();
        setSearchPosts(p.posts || []);
      }
    } catch {}
    setSearchLoading(false);
  }, [getToken]);

  const onQueryChange = (q: string) => {
    setQuery(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(q), 400);
  };

  const clearSearch = () => {
    setQuery('');
    setSearchUsers([]);
    setSearchPosts([]);
  };

  const s = styles(theme);
  const isSearching = query.length > 0;

  const TABS: { key: ExploreTab; label: string; icon: string }[] = [
    { key: 'trending', label: 'Trending', icon: 'trending-up' },
    { key: 'people', label: 'People', icon: 'people-outline' },
    { key: 'posts', label: 'Posts', icon: 'newspaper-outline' },
  ];

  const renderDiscover = () => {
    if (discoverLoading) {
      return <View style={s.center}><ActivityIndicator color={theme.accent} /></View>;
    }

    if (activeTab === 'trending') {
      return (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        >
          {trending.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={s.sectionTitle}>Trending Hashtags</Text>
              {trending.map((tag, idx) => (
                <TouchableOpacity key={idx} style={s.trendRow} onPress={() => onQueryChange(`#${tag}`)}>
                  <View style={s.trendRank}><Text style={s.trendRankText}>{idx + 1}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.trendTag}>#{typeof tag === 'string' ? tag : (tag as any).tag || tag}</Text>
                    <Text style={s.trendCount}>Trending</Text>
                  </View>
                  <Ionicons name="trending-up-outline" size={16} color={theme.textDim} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {suggestedUsers.length > 0 && (
            <View>
              <Text style={s.sectionTitle}>Who to Follow</Text>
              {suggestedUsers.slice(0, 5).map(u => (
                <UserRow
                  key={u.id}
                  item={u}
                  theme={theme}
                  onPress={() => navigation.navigate('UserProfile', { userId: u.id })}
                />
              ))}
            </View>
          )}
          {trending.length === 0 && suggestedUsers.length === 0 && (
            <View style={s.center}>
              <Ionicons name="trending-up-outline" size={40} color={theme.textDim} />
              <Text style={s.emptyText}>No trending content yet</Text>
            </View>
          )}
        </ScrollView>
      );
    }

    if (activeTab === 'people') {
      return (
        <FlatList
          data={suggestedUsers}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <UserRow
              item={item}
              theme={theme}
              onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="people-outline" size={40} color={theme.textDim} />
              <Text style={s.emptyText}>No suggested users</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      );
    }

    // Posts tab
    return (
      <FlatList
        data={discoverPosts}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onUserPress={id => navigation.navigate('UserProfile', { userId: id })}
            onPostPress={id => navigation.navigate('PostDetail', { postId: id })}
          />
        )}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="newspaper-outline" size={40} color={theme.textDim} />
            <Text style={s.emptyText}>No posts to discover yet</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    );
  };

  const renderSearchResults = () => {
    if (searchLoading) {
      return <View style={s.center}><ActivityIndicator color={theme.accent} /></View>;
    }
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {searchUsers.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>People</Text>
            {searchUsers.map(u => (
              <UserRow
                key={u.id}
                item={u}
                theme={theme}
                onPress={() => navigation.navigate('UserProfile', { userId: u.id })}
              />
            ))}
          </View>
        )}
        {searchPosts.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Posts</Text>
            {searchPosts.map(p => (
              <PostCard
                key={p.id}
                post={p}
                onUserPress={id => navigation.navigate('UserProfile', { userId: id })}
                onPostPress={id => navigation.navigate('PostDetail', { postId: id })}
              />
            ))}
          </View>
        )}
        {searchUsers.length === 0 && searchPosts.length === 0 && (
          <View style={s.center}>
            <Ionicons name="search-outline" size={40} color={theme.textDim} />
            <Text style={s.emptyText}>No results for "{query}"</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Explore</Text>
      </View>

      {/* Search bar */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color={theme.textDim} style={{ marginRight: 8 }} />
        <TextInput
          style={s.input}
          placeholder="Search people, posts, hashtags..."
          placeholderTextColor={theme.textDim}
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
          onSubmitEditing={() => doSearch(query)}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch}>
            <Ionicons name="close-circle" size={18} color={theme.textDim} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs (only when not searching) */}
      {!isSearching && (
        <View style={s.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, activeTab === t.key && s.tabBtnActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
              {activeTab === t.key && <View style={s.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isSearching ? renderSearchResults() : renderDiscover()}
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
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.searchBg || theme.bgSecondary, borderRadius: 20,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  input: { flex: 1, color: theme.text, fontSize: 15 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabBtnActive: {},
  tabText: { color: theme.textDim, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: theme.text, fontWeight: '700' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '15%', right: '15%',
    height: 3, borderRadius: 2, backgroundColor: theme.accent,
  },
  sectionTitle: {
    color: theme.text, fontWeight: '700', fontSize: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  trendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  trendRank: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.accent + '22', alignItems: 'center', justifyContent: 'center',
  },
  trendRankText: { color: theme.accent, fontWeight: '700', fontSize: 12 },
  trendTag: { color: theme.text, fontWeight: '700', fontSize: 15 },
  trendCount: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  avatarInit: { color: theme.accentText || '#fff', fontWeight: '700', fontSize: 18 },
  userName: { color: theme.text, fontWeight: '700', fontSize: 15 },
  userHandle: { color: theme.textDim, fontSize: 13 },
  userBio: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  followerBadge: { alignItems: 'center' },
  followerCount: { color: theme.text, fontWeight: '700', fontSize: 14 },
  followerLabel: { color: theme.textDim, fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { color: theme.textDim, fontSize: 15, textAlign: 'center' },
});
