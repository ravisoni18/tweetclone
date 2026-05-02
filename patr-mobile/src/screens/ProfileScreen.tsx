import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import PostCard from '../components/PostCard';
import { Post, User, RootStackParamList } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const API = 'https://patr.me/api';

type ProfileTab = 'posts' | 'media' | 'likes';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const { user: authUser, getToken } = useAuth();
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<User | null>(authUser);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('posts');

  // Edit profile state
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = () => {
    const u = profile || authUser;
    setEditName(u?.displayName || '');
    setEditBio(u?.bio || '');
    setEditLocation(u?.location || '');
    setEditWebsite(u?.website || '');
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!authUser) return;
    setEditSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/users/${authUser.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editName.trim(),
          bio: editBio.trim(),
          location: editLocation.trim(),
          website: editWebsite.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(prev => ({ ...prev!, ...updated }));
        setEditVisible(false);
      } else {
        Alert.alert('Error', 'Could not save profile. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    }
    setEditSaving(false);
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!authUser) return;
    if (!isRefresh) setLoading(true);
    try {
      const token = await getToken();
      const h = { Authorization: `Bearer ${token}` };

      // Fetch fresh profile stats
      const profileRes = await fetch(`${API}/users/${authUser.id}`, { headers: h });
      if (profileRes.ok) {
        const p = await profileRes.json();
        setProfile(p);
      }

      if (tab === 'likes') {
        // Try liked-posts endpoints
        const likeEndpoints = [
          `${API}/users/${authUser.id}/liked-posts?page=1&limit=30`,
          `${API}/posts/liked?userId=${authUser.id}&page=1&limit=30`,
        ];
        for (const url of likeEndpoints) {
          try {
            const res = await fetch(url, { headers: h });
            if (res.ok) {
              const data = await res.json();
              const p = data.posts || (Array.isArray(data) ? data : []);
              setPosts(p);
              if (p.length > 0) break;
            }
          } catch {}
        }
      } else {
        // Try all known post endpoints in order (matching web fallback strategy)
        const postEndpoints = [
          `${API}/posts/user/${authUser.id}?page=1&limit=30`,
          `${API}/users/${authUser.id}/posts?page=1&limit=30`,
          `${API}/posts/feed?type=user&userId=${authUser.id}&page=1&limit=30`,
          `${API}/posts/feed?type=all&page=1&limit=30`,
        ];
        for (const url of postEndpoints) {
          try {
            const res = await fetch(url, { headers: h });
            if (res.ok) {
              const data = await res.json();
              let fetchedPosts = data.posts || (Array.isArray(data) ? data : []);
              // For feed endpoints, filter to only this user's posts
              if (url.includes('/feed')) {
                fetchedPosts = fetchedPosts.filter((p: any) => p.user?.id === authUser.id || p.userId === authUser.id);
              }
              if (fetchedPosts.length > 0) {
                setPosts(fetchedPosts);
                break;
              }
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error('ProfileScreen fetchData error:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [authUser?.id, tab]);

  // Re-run whenever authUser loads OR tab changes
  useEffect(() => { fetchData(); }, [authUser?.id, tab]);

  const onRefresh = () => { setRefreshing(true); fetchData(true); };

  const s = styles(theme);
  const user = profile || authUser;
  if (!user) return null;

  const TABS: { key: ProfileTab; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'media', label: 'Media' },
    { key: 'likes', label: 'Likes' },
  ];

  const Header = () => (
    <View>
      {/* Cover image */}
      <View style={s.cover}>
        {user.coverImageUrl
          ? <Image source={{ uri: user.coverImageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.accent + '44' }]} />
        }
      </View>

      {/* Avatar row */}
      <View style={s.profileRow}>
        <View style={s.avatarWrap}>
          {user.profileImageUrl
            ? <Image source={{ uri: user.profileImageUrl }} style={s.avatar} />
            : <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarInit}>{user.displayName[0]?.toUpperCase()}</Text>
              </View>
          }
        </View>
        <TouchableOpacity style={s.editBtn} onPress={openEdit}>
          <Text style={s.editBtnText}>Edit profile</Text>
        </TouchableOpacity>
      </View>

      <View style={s.info}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.displayName}>{user.displayName}</Text>
          {user.verified && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
        </View>
        <Text style={s.username}>@{user.username}</Text>
        {user.bio ? <Text style={s.bio}>{user.bio}</Text> : null}
        {user.location ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Ionicons name="location-outline" size={14} color={theme.textDim} />
            <Text style={s.metaText}>{user.location}</Text>
          </View>
        ) : null}
        {user.website ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="link-outline" size={14} color={theme.accent} />
            <Text style={[s.metaText, { color: theme.accent }]}>{user.website}</Text>
          </View>
        ) : null}
        <View style={s.statsRow}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.statNum}>{user.followingCount ?? 0}</Text>
            <Text style={s.statLabel}> Following  </Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.statNum}>{user.followersCount ?? 0}</Text>
            <Text style={s.statLabel}> Followers</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            {tab === t.key && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const mediaPosts = posts.filter(p => !!p.imageUrl);
  const displayPosts = tab === 'media' ? mediaPosts : posts;

  return (
    <SafeAreaView style={s.container}>
      {loading ? (
        <>
          <Header />
          <View style={s.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        </>
      ) : (
        <FlatList
          data={displayPosts}
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
            <View style={s.center}>
              <Ionicons name="document-outline" size={40} color={theme.textDim} />
              <Text style={s.emptyText}>
                {tab === 'likes' ? 'No liked posts yet' : tab === 'media' ? 'No media posts yet' : 'No posts yet'}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

      {/* Edit Profile Modal */}
      <Modal
        visible={editVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={[s.editModal, { backgroundColor: theme.bg }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal toolbar */}
          <View style={s.editToolbar}>
            <TouchableOpacity onPress={() => setEditVisible(false)} style={s.editCancelBtn}>
              <Text style={[s.editCancelText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.editTitle, { color: theme.text }]}>Edit Profile</Text>
            <TouchableOpacity
              onPress={saveEdit}
              disabled={editSaving}
              style={[s.editSaveBtn, { backgroundColor: theme.accent, opacity: editSaving ? 0.6 : 1 }]}
            >
              {editSaving
                ? <ActivityIndicator size="small" color={theme.accentText} />
                : <Text style={[s.editSaveText, { color: theme.accentText }]}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.editContent}>
            {/* Name */}
            <View style={s.editField}>
              <Text style={[s.editLabel, { color: theme.textDim }]}>Name</Text>
              <TextInput
                style={[s.editInput, { color: theme.text, borderBottomColor: theme.border }]}
                value={editName}
                onChangeText={setEditName}
                maxLength={50}
                placeholderTextColor={theme.textDim}
                placeholder="Your name"
              />
            </View>

            {/* Bio */}
            <View style={s.editField}>
              <Text style={[s.editLabel, { color: theme.textDim }]}>Bio</Text>
              <TextInput
                style={[s.editInput, s.editBioInput, { color: theme.text, borderBottomColor: theme.border }]}
                value={editBio}
                onChangeText={setEditBio}
                maxLength={160}
                multiline
                numberOfLines={3}
                placeholderTextColor={theme.textDim}
                placeholder="Tell the world about yourself"
              />
              <Text style={[s.editCharCount, { color: theme.textDim }]}>{160 - editBio.length}</Text>
            </View>

            {/* Location */}
            <View style={s.editField}>
              <Text style={[s.editLabel, { color: theme.textDim }]}>Location</Text>
              <TextInput
                style={[s.editInput, { color: theme.text, borderBottomColor: theme.border }]}
                value={editLocation}
                onChangeText={setEditLocation}
                maxLength={50}
                placeholderTextColor={theme.textDim}
                placeholder="Where are you?"
              />
            </View>

            {/* Website */}
            <View style={s.editField}>
              <Text style={[s.editLabel, { color: theme.textDim }]}>Website</Text>
              <TextInput
                style={[s.editInput, { color: theme.text, borderBottomColor: theme.border }]}
                value={editWebsite}
                onChangeText={setEditWebsite}
                maxLength={100}
                placeholderTextColor={theme.textDim}
                placeholder="https://yoursite.com"
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  cover: { height: 130, backgroundColor: theme.bgSecondary },
  profileRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: -36, marginBottom: 4,
  },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: theme.bg, overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  avatarInit: { color: theme.accentText, fontSize: 32, fontWeight: '700' },
  editBtn: {
    borderWidth: 1.5, borderColor: theme.border, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  editBtnText: { color: theme.text, fontWeight: '700', fontSize: 14 },
  info: { paddingHorizontal: 16, paddingTop: 8 },
  displayName: { color: theme.text, fontSize: 20, fontWeight: '800' },
  username: { color: theme.textDim, fontSize: 15, marginBottom: 6 },
  bio: { color: theme.text, fontSize: 15, lineHeight: 22, marginTop: 4 },
  metaText: { color: theme.textDim, fontSize: 13 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 4 },
  statNum: { color: theme.text, fontWeight: '700', fontSize: 15 },
  statLabel: { color: theme.textDim, fontSize: 14 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
    marginTop: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, position: 'relative' },
  tabBtnActive: {},
  tabText: { color: theme.textDim, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: theme.text, fontWeight: '700' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 3, borderRadius: 2, backgroundColor: theme.accent,
  },
  center: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { color: theme.textDim, fontSize: 15 },
  // Edit modal
  editModal: { flex: 1 },
  editToolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  editCancelBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  editCancelText: { fontSize: 16 },
  editTitle: { fontSize: 17, fontWeight: '700' },
  editSaveBtn: {
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8,
    minWidth: 60, alignItems: 'center',
  },
  editSaveText: { fontWeight: '700', fontSize: 15 },
  editContent: { padding: 20, gap: 8 },
  editField: { marginBottom: 20 },
  editLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  editInput: {
    fontSize: 16, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  editBioInput: { minHeight: 60, textAlignVertical: 'top' },
  editCharCount: { fontSize: 12, textAlign: 'right', marginTop: 4 },
});
