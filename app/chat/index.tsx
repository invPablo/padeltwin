import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useSession } from '@/lib/useSession';
import { usePartnerRequests, useHiddenChats, useLastMessages } from '@/lib/queries';
import type { PartnerRequestWithProfiles } from '@/types/database';

function formatRelativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function ChatIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: requests, isLoading } = usePartnerRequests(userId);
  const { data: hiddenChats } = useHiddenChats(userId);

  const accepted = (requests ?? []).filter((r) => r.status === 'accepted' && !hiddenChats?.has(r.id));
  const { data: lastMessages } = useLastMessages(accepted.map((r) => r.id));

  function otherProfile(r: PartnerRequestWithProfiles) {
    return r.from_id === userId ? r.to_profile : r.from_profile;
  }

  const sorted = [...accepted].sort((a, b) => {
    const ta = lastMessages?.[a.id]?.created_at ?? a.created_at;
    const tb = lastMessages?.[b.id]?.created_at ?? b.created_at;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      ) : sorted.length > 0 ? (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => {
            const other = otherProfile(item);
            const last = lastMessages?.[item.id];
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/chat/[requestId]', params: { requestId: item.id } })}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              >
                {other?.avatar_url ? (
                  <Image source={{ uri: other.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={16} color="#FFF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{other?.full_name ?? 'Player'}</Text>
                  <Text style={styles.rowBody} numberOfLines={1}>
                    {last?.body ?? 'Say hello \u{1F44B}'}
                  </Text>
                </View>
                {last && <Text style={styles.rowTime}>{formatRelativeTime(last.created_at)}</Text>}
              </Pressable>
            );
          }}
        />
      ) : (
        <View style={styles.content}>
          <Ionicons name="chatbubbles-outline" size={64} color="rgba(255,255,255,0.1)" />
          <Text style={styles.emptyText}>No active chats</Text>
          <Text style={styles.emptySub}>When you connect with partners, your messages will appear here.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: theme.nav,
  },
  backButton: {
    paddingRight: 16,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Anton_400Regular',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySub: {
    color: theme.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { color: theme.text, fontWeight: '800', fontSize: 13 },
  rowBody: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  rowTime: { color: theme.textMuted, fontSize: 10, fontWeight: '600' },
});
