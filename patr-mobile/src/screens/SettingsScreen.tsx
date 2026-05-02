import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, themes, ThemeName } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const THEME_ORDER: ThemeName[] = ['dark', 'aurora', 'sunset', 'forest', 'light', 'cyber'];
const API = 'https://patr.me/api';

export default function SettingsScreen() {
  const { theme, themeName, setTheme } = useTheme();
  const { user, getToken, logout } = useAuth();
  const [stats, setStats] = useState({
    postsCount: user?.postsCount ?? 0,
    followingCount: user?.followingCount ?? 0,
    followersCount: user?.followersCount ?? 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/users/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats({
            postsCount: data.postsCount ?? 0,
            followingCount: data.followingCount ?? 0,
            followersCount: data.followersCount ?? 0,
          });
        }
      } catch {}
      setStatsLoading(false);
    })();
  }, [user]);

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Settings</Text>
        </View>

        {/* Account section */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.card}>
          <View style={s.row}>
            <Ionicons name="person-circle-outline" size={22} color={theme.accent} />
            <View style={s.rowText}>
              <Text style={s.rowTitle}>{user?.displayName}</Text>
              <Text style={s.rowSub}>@{user?.username}</Text>
            </View>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Ionicons name="mail-outline" size={22} color={theme.textDim} />
            <Text style={s.rowMono}>{user?.email}</Text>
          </View>
        </View>

        {/* Theme section */}
        <Text style={s.sectionLabel}>APPEARANCE</Text>
        <View style={s.card}>
          <Text style={s.cardTitle}>Theme</Text>
          <View style={s.themeGrid}>
            {THEME_ORDER.map(name => {
              const t = themes[name];
              const active = themeName === name;
              return (
                <TouchableOpacity
                  key={name}
                  style={[s.themeChip, active && { borderColor: theme.accent, borderWidth: 2 }]}
                  onPress={() => setTheme(name)}
                >
                  <View style={[s.themePreview, { backgroundColor: t.bg }]}>
                    <View style={[s.themeAccentDot, { backgroundColor: t.accent }]} />
                  </View>
                  <Text style={[s.themeLabel, active && { color: theme.accent }]}>
                    {t.name}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark-circle" size={16} color={theme.accent} style={s.checkIcon} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stats */}
        <Text style={s.sectionLabel}>STATS</Text>
        <View style={s.card}>
          {statsLoading ? (
            <ActivityIndicator color={theme.accent} style={{ paddingVertical: 12 }} />
          ) : (
            [
              { label: 'Posts',     value: stats.postsCount },
              { label: 'Following', value: stats.followingCount },
              { label: 'Followers', value: stats.followersCount },
            ].map(({ label, value }) => (
              <View key={label} style={[s.row, s.statRow]}>
                <Text style={s.rowTitle}>{label}</Text>
                <Text style={s.statValue}>{value}</Text>
              </View>
            ))
          )}
        </View>

        {/* Logout */}
        <Text style={s.sectionLabel}>ACCOUNT ACTIONS</Text>
        <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border,
  },
  title: { color: theme.text, fontSize: 22, fontWeight: '800' },
  sectionLabel: {
    color: theme.textDim, fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  card: {
    backgroundColor: theme.widget,
    marginHorizontal: 16, borderRadius: 14, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
  },
  cardTitle: { color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  statRow: { justifyContent: 'space-between', paddingVertical: 10 },
  rowText: { flex: 1 },
  rowTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: theme.textDim, fontSize: 13 },
  rowMono: { color: theme.textDim, fontSize: 14 },
  statValue: { color: theme.accent, fontWeight: '700', fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: 10 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeChip: {
    width: '30%', borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: theme.border, position: 'relative',
  },
  themePreview: { height: 40, alignItems: 'flex-end', padding: 8 },
  themeAccentDot: { width: 10, height: 10, borderRadius: 5 },
  themeLabel: { color: theme.textDim, fontSize: 11, fontWeight: '600', padding: 6 },
  checkIcon: { position: 'absolute', top: 4, left: 4 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.widget, marginHorizontal: 16, borderRadius: 14,
    padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border,
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
