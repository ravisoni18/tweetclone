import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';
import { RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'UserProfile'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;
const API = 'https://patr.me/api';

export default function UserProfileScreen() {
  const { theme } = useTheme();
  const { user: me, getToken } = useAuth();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { userId } = route.params;

  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const h = { Authorization: `Bearer ${token}` };
        const [uRes, pRes] = await Promise.all([
          fetch(`${API}/users/${userId}`, { headers: h }),
          fetch(`${API}/posts/user/${userId}?page=1&limit=30`, { headers: h }),
        ]);
        if (uRes.ok) { const u = await uRes.json(); setProfile(u); setFollowing(!!u.following); }
        if (pRes.ok) { const p = await pRes.json(); setPosts(p.posts || p || []); }
      } catch {}
      setLoading(false);
    })();
  }, [userId]);

  const toggleFollow = async () => {
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    if (profile) {
      setProfile({
        ...profile,
        followersCount: wasFollowing ? Math.max(0, (profile.followersCount || 0) - 1) : (profile.followersCount || 0) + 1,
      });
    }
    try {
      const token = await getToken();
      // Try both endpoint variants for compatibility
      const res = await fetch(`${API}/users/${userId}/follow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const d = await res.json();
        setFollowing(!!d.following);
        if (profile) setProfile({ ...profile, followersCount: d.followersCount ?? profile.followersCount });
      } else {
        // revert
        setFollowing(wasFollowing);
        if (profile) setProfile({ ...profile, followersCount: profile.followersCount });
      }
    } catch {
      setFollowing(wasFollowing);
    }
  };

  const s = styles(theme);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.backRow}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
        <View style={s.center}><ActivityIndicator color={theme.accent} /></View>
      </SafeAreaView>
    );
  }

  const Header = () => (
    <View>
      <View style={s.backRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={s.headerName}>{profile?.displayName || ''}</Text>
      </View>
      <View style={s.cover}>
        {profile?.coverImageUrl
          ? <Image source={{ uri: profile.coverImageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: (theme.accent || '#6366f1') + '44' }]} />
        }
      </View>
      <View style={s.profileRow}>
        <View style={s.avatarWrap}>
          {profile?.profileImageUrl
            ? <Image source={{ uri: profile.profileImageUrl }} style={s.avatar} />
            : <View style={[s.avatar, { backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: theme.accentText, fontSize: 28, fontWeight: '700' }}>
                  {profile?.displayName?.[0] || 'U'}
                </Text>
              </View>
          }
        </View>
        {me?.id !== userId && (
          <TouchableOpacity
            onPress={toggleFollow}
            style={[s.followBtn, following && s.followingBtn]}
          >
            <Text style={[s.followBtnText, following && s.followingBtnText]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={s.info}>
        <Text style={s.displayName}>{profile?.displayName}</Text>
        <Text style={s.username}>@{profile?.username}</Text>
        {profile?.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
        <View style={s.statsRow}>
          <Text style={s.statNum}>{profile?.followingCount || 0}</Text>
          <Text style={s.statLabel}> Following  </Text>
          <Text style={s.statNum}>{profile?.followersCount || 0}</Text>
          <Text style={s.statLabel}> Followers</Text>
        </View>
      </View>
      <View style={s.divider} />
    </View>
  );

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={posts}
        keyExtractor={i => i.id}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onUserPress={id => navigation.navigate('UserProfile', { userId: id })}
            onPostPress={id => navigation.navigate('PostDetail', { postId: id })}
          />
        )}
        ListEmptyComponent={
          <View style={s.center}><Text style={s.emptyText}>No posts yet</Text></View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />
    </SafeAreaView>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerName: { color: theme.text, fontSize: 17, fontWeight: '700' },
  cover: { height: 100, backgroundColor: theme.bgSecondary },
  profileRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -36,
  },
  avatarWrap: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: theme.bg, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  followBtn: {
    borderWidth: 1.5, borderColor: theme.text, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  followingBtn: { backgroundColor: theme.accent, borderColor: theme.accent },
  followBtnText: { color: theme.text, fontWeight: '700', fontSize: 14 },
  followingBtnText: { color: theme.accentText },
  info: { paddingHorizontal: 16, paddingTop: 10 },
  displayName: { color: theme.text, fontSize: 19, fontWeight: '800' },
  username: { color: theme.textDim, fontSize: 14, marginBottom: 6 },
  bio: { color: theme.text, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  statNum: { color: theme.text, fontWeight: '700', fontSize: 14 },
  statLabel: { color: theme.textDim, fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginTop: 12 },
  emptyText: { color: theme.textDim, fontSize: 15 },
});
