import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import { useProfile, useCoaches } from '@/lib/queries';
import { theme, cardRadius } from '@/constants/theme';

export default function CoachesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: coaches, isLoading } = useCoaches(profile?.zone);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        {profile?.zone ? `Coaches in ${profile.zone}` : 'Padel coaches'}
      </Text>

      {isLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
      ) : coaches && coaches.length > 0 ? (
        coaches.map((coach) => (
          <Pressable
            key={coach.id}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            onPress={() => router.push(`/coach/${coach.id}` as any)}
          >
            {coach.avatar_url ? (
              <Image source={{ uri: coach.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Image source={require('@/assets/images/icon.png')} style={styles.avatarPlaceholderLogo} resizeMode="contain" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.coachName}>{coach.full_name ?? 'Coach'}</Text>
                {coach.coach_featured && (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>FEATURED</Text>
                  </View>
                )}
              </View>
              {coach.coach_years_experience != null && (
                <Text style={styles.coachMeta}>{coach.coach_years_experience} yrs experience</Text>
              )}
              {coach.coach_specialties && (
                <Text style={styles.coachMeta} numberOfLines={1}>
                  {coach.coach_specialties}
                </Text>
              )}
            </View>
            {coach.coach_hourly_rate != null && (
              <Text style={styles.rate}>£{coach.coach_hourly_rate}/hr</Text>
            )}
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="school-outline" size={32} color={theme.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>No coaches listed yet</Text>
          <Text style={styles.emptySubtitle}>Are you a padel coach? Add your listing from your profile.</Text>
          <Pressable style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.9 }]} onPress={() => router.push('/profile')}>
            <Text style={styles.emptyButtonText}>BECOME A COACH</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, gap: 10 },
  subtitle: { color: theme.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderLogo: { width: 22, height: 22, opacity: 0.5 },
  coachName: { color: theme.text, fontWeight: '700', fontSize: 15 },
  coachMeta: { color: theme.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  featuredBadge: { backgroundColor: 'rgba(198, 255, 51, 0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  featuredBadgeText: { color: theme.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  rate: { color: theme.accent, fontWeight: '800', fontSize: 13, marginRight: 4 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 },
  emptyTitle: { color: theme.text, fontWeight: '800', fontSize: 15, marginBottom: 4 },
  emptySubtitle: { color: theme.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 16 },
  emptyButton: { backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  emptyButtonText: { color: theme.onAccent, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
});
