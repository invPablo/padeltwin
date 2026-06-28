import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/lib/useSession';
import { useProfile, useClubLeaderboard } from '@/lib/queries';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { theme, cardRadius } from '@/constants/theme';

export default function ClubLeaderboardScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: leaderboard, isLoading } = useClubLeaderboard(profile?.club);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>KING OF THE COURT</Text>
      <Text style={styles.subtitle}>{profile?.club ?? 'Your club'}</Text>

      {isLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
      ) : !leaderboard || leaderboard.length === 0 ? (
        <Text style={styles.emptyText}>
          Nobody at {profile?.club ?? 'your club'} has played 5+ confirmed matches yet — be the first to claim the
          crown.
        </Text>
      ) : (
        <View style={styles.leaderboardContainer}>
          {leaderboard.map((p, index) => {
            const rank = index + 1;
            const isMe = p.id === userId;
            return (
              <View
                key={p.id}
                style={[
                  styles.leaderboardRow,
                  rank === leaderboard.length && { borderBottomWidth: 0 },
                  isMe && styles.leaderboardRowMe,
                  rank === 1 && styles.leaderboardRowChampion,
                ]}
              >
                <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>{rank === 1 ? '👑' : rank < 10 ? `0${rank}` : rank}</Text>
                <View style={styles.playerAvatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{(p.full_name ?? '?').slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.leaderboardName} numberOfLines={1}>
                  {isMe ? 'YOU' : (p.full_name ?? 'Player').toUpperCase()}
                </Text>
                {p.is_pro && <ProBadge size="sm" />}
                {p.coach_status === 'approved' && <CoachBadge size="sm" />}
                <Text style={styles.leaderboardElo}>
                  {p.elo} <Text style={{ fontSize: 9, color: theme.textMuted }}>ELO</Text>
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, gap: 4 },
  title: { fontFamily: 'Anton_400Regular', color: theme.text, fontSize: 24, letterSpacing: 0.5 },
  subtitle: { color: theme.accent, fontWeight: '800', fontSize: 13, marginBottom: 16 },
  emptyText: { color: theme.textMuted, fontSize: 13, lineHeight: 20, marginTop: 12 },
  leaderboardContainer: { backgroundColor: theme.card, borderRadius: cardRadius, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  leaderboardRowMe: { backgroundColor: 'rgba(198,255,51,0.06)' },
  leaderboardRowChampion: { backgroundColor: 'rgba(198,255,51,0.1)' },
  rankText: { color: theme.textMuted, fontWeight: '900', fontSize: 13, width: 24 },
  rankTextTop: { color: theme.accent },
  playerAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: theme.text, fontWeight: '800', fontSize: 12 },
  leaderboardName: { flex: 1, color: theme.text, fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  leaderboardElo: { color: theme.text, fontWeight: '900', fontSize: 13 },
});
