import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFollowers, useFollowedProfiles } from '@/lib/queries';
import { LEVEL_LABELS } from '@/constants/levels';
import { theme, cardRadius } from '@/constants/theme';
import type { Profile } from '@/types/database';

export default function SocialListScreen() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const isFollowers = type === 'followers';

  const followers = useFollowers(isFollowers ? id : undefined);
  const following = useFollowedProfiles(!isFollowers ? id : undefined);

  const { data, isLoading } = isFollowers ? followers : following;
  const profiles = (data ?? []) as Profile[];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isFollowers ? 'FOLLOWERS' : 'FOLLOWING'}</Text>

      {isLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
      ) : profiles.length > 0 ? (
        <View style={styles.listContainer}>
          {profiles.map((p, index) => (
            <Pressable
              key={p.id}
              style={[styles.row, index === profiles.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => router.push(`/player/${p.id}` as any)}
            >
              {p.avatar_url ? (
                <Image source={{ uri: p.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Image source={require('@/assets/images/icon.png')} style={styles.avatarPlaceholderLogo} resizeMode="contain" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {p.full_name ?? 'Player'}
                </Text>
                <Text style={styles.playerLevel}>{p.level ? LEVEL_LABELS[p.level] : 'Level not set'}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {isFollowers ? 'No followers yet.' : 'Not following anyone yet.'}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, gap: 8 },
  title: { color: theme.text, fontSize: 20,  letterSpacing: -0.3 , textTransform: 'uppercase'},
  listContainer: {
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderLogo: { width: 18, height: 18, opacity: 0.5 },
  playerName: { color: theme.text, fontWeight: '700', fontSize: 14 },
  playerLevel: { color: theme.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  emptyText: { color: theme.textMuted, fontSize: 13, marginTop: 16 },
});
