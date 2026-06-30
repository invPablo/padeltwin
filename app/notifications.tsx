import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useSession } from '@/lib/useSession';
import { useNotifications, useMarkNotificationsRead, type AppNotification } from '@/lib/queries';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  message: 'chatbubble',
  partner_request: 'people',
  partner_accepted: 'checkmark-circle',
  follow: 'person-add',
  vib: 'heart',
};

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

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: notifications, isLoading } = useNotifications(userId);
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    if (userId && notifications && notifications.some((n) => !n.read)) {
      markRead.mutate({ userId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, notifications?.length]);

  function handlePress(item: AppNotification) {
    const data = item.data as any;
    if (item.type === 'message' && data?.requestId) {
      router.push({ pathname: '/chat/[requestId]', params: { requestId: data.requestId } });
    } else if (item.type === 'partner_request' || item.type === 'partner_accepted') {
      router.push('/profile' as any);
    } else if (item.type === 'follow' && data?.profileId) {
      router.push(`/player/${data.profileId}` as any);
    } else if (item.type === 'vib' && data?.itemType === 'match_result' && data?.itemId) {
      router.push(`/match/${data.itemId}` as any);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      ) : notifications && notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.iconCircle}>
                <Ionicons name={TYPE_ICON[item.type] ?? 'notifications'} size={16} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowBody} numberOfLines={2}>{item.body}</Text>
              </View>
              <Text style={styles.rowTime}>{formatRelativeTime(item.created_at)}</Text>
            </Pressable>
          )}
        />
      ) : (
        <View style={styles.content}>
          <Ionicons name="notifications-off-outline" size={64} color="rgba(255,255,255,0.1)" />
          <Text style={styles.emptyText}>You're all caught up!</Text>
          <Text style={styles.emptySub}>No new notifications right now.</Text>
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
  rowUnread: { borderColor: theme.accent },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(198, 255, 51, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { color: theme.text, fontWeight: '800', fontSize: 13 },
  rowBody: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  rowTime: { color: theme.textMuted, fontSize: 10, fontWeight: '600' },
});
