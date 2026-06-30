import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '@/lib/useSession';
import {
  useProfile,
  useMyPairs,
  usePairClubBoard,
  useMyPairClubs,
  useJoinPairClub,
} from '@/lib/queries';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { theme, cardRadius, chipRadius } from '@/constants/theme';
import { Card } from '@/components/Card';

const FREE_CLUB_LIMIT = 1;
const PRO_CLUB_LIMIT = 5;

export default function ClubLeaderboardScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: pairs } = useMyPairs(userId);
  const activePair = pairs && pairs.length > 0 ? [...pairs].sort((a, b) => b.elo - a.elo)[0] : null;
  const { data: myClubs } = useMyPairClubs(activePair?.id);
  const joinClub = useJoinPairClub();
  const [clubInput, setClubInput] = useState(profile?.club ?? '');
  const [viewingClub, setViewingClub] = useState<string | null>(null);

  const activeClub = viewingClub ?? myClubs?.[0]?.club ?? null;
  const { data: leaderboard, isLoading } = usePairClubBoard(activeClub);

  const isPro = !!(activePair?.player_a?.is_pro || activePair?.player_b?.is_pro);
  const cap = isPro ? PRO_CLUB_LIMIT : FREE_CLUB_LIMIT;
  const joinedCount = myClubs?.length ?? 0;
  const atCap = joinedCount >= cap;

  function handleJoin() {
    if (!activePair || !clubInput.trim()) return;
    joinClub.mutate(
      { pairId: activePair.id, club: clubInput.trim() },
      {
        onSuccess: () => setViewingClub(clubInput.trim()),
        onError: (e) => Alert.alert('Could not join club', e instanceof Error ? e.message : 'Try again.'),
      }
    );
  }

  if (!activePair) {
    return (
      <View style={styles.center}>
        <Card style={{ padding: 24, alignSelf: 'center', width: '100%' }} contentStyle={{ alignItems: 'center' }}>
          <Text style={styles.emptyText}>
            KOP is contested by ranked pairs — declare a fixed pair first to compete for a club's crown.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>KING OF THE COURT</Text>
      <Text style={styles.subtitle}>{activeClub ?? 'Join a club to contest the throne'}</Text>

      {(myClubs ?? []).length > 1 && (
        <View style={styles.clubChipsRow}>
          {(myClubs ?? []).map((c) => (
            <Pressable
              key={c.id}
              style={[styles.clubChip, activeClub === c.club && styles.clubChipActive]}
              onPress={() => setViewingClub(c.club)}
            >
              <Text style={[styles.clubChipText, activeClub === c.club && styles.clubChipTextActive]}>{c.club}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.joinRow}>
        <TextInput
          style={styles.joinInput}
          value={clubInput}
          onChangeText={setClubInput}
          placeholder="Club or court name"
          placeholderTextColor={theme.textMuted}
        />
        <Pressable
          style={[styles.joinBtn, atCap && { opacity: 0.5 }]}
          onPress={() => (atCap ? Alert.alert('Limit reached', `${isPro ? 'Pro' : 'Free'} pairs can join up to ${cap} club${cap === 1 ? '' : 's'}.`) : handleJoin())}
          disabled={joinClub.isPending}
        >
          <Text style={styles.joinBtnText}>JOIN</Text>
        </Pressable>
      </View>
      <Text style={styles.capText}>{joinedCount}/{cap} clubs joined {isPro ? '(Pro)' : '(Free)'}</Text>

      {isLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
      ) : !activeClub ? null : !leaderboard || leaderboard.length === 0 ? (
        <Text style={styles.emptyText}>No pairs have joined this club yet — be the first to claim the crown.</Text>
      ) : (
        <Card style={styles.leaderboardContainer} contentStyle={{ overflow: 'hidden' }}>
          {leaderboard.map((pair, index) => {
            const rank = index + 1;
            const isMine = pair.id === activePair.id;
            return (
              <View
                key={pair.id}
                style={[
                  styles.leaderboardRow,
                  rank === leaderboard.length && { borderBottomWidth: 0 },
                  isMine && styles.leaderboardRowMe,
                  rank === 1 && styles.leaderboardRowChampion,
                ]}
              >
                <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>
                  {rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank < 10 ? `0${rank}` : rank}
                </Text>
                <Text style={styles.leaderboardName} numberOfLines={1}>
                  {pair.player_a?.full_name ?? 'Player'} & {pair.player_b?.full_name ?? 'Player'}
                  {isMine ? ' (YOU)' : ''}
                </Text>
                {pair.player_a?.is_pro || pair.player_b?.is_pro ? <ProBadge size="sm" /> : null}
                {pair.player_a?.coach_status === 'approved' || pair.player_b?.coach_status === 'approved' ? <CoachBadge size="sm" /> : null}
                <Text style={styles.leaderboardElo}>
                  {pair.elo} <Text style={{ fontSize: 9, color: theme.textMuted }}>PS</Text>
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, gap: 4, paddingBottom: 110 },
  title: { fontFamily: 'Anton_400Regular', color: theme.text, fontSize: 24, letterSpacing: 0.5 , textTransform: 'uppercase' },
  subtitle: { color: theme.accent, fontWeight: '800', fontSize: 13, marginBottom: 8 },
  clubChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  clubChip: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: chipRadius, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  clubChipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  clubChipText: { color: theme.textMuted, fontSize: 11, fontWeight: '700' },
  clubChipTextActive: { color: theme.onAccent },
  joinRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  joinInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: chipRadius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: theme.text,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    fontSize: 13,
  },
  joinBtn: { backgroundColor: theme.accent, borderRadius: chipRadius, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  joinBtnText: { color: theme.onAccent, fontWeight: '900', fontSize: 12 },
  capText: { color: theme.textMuted, fontSize: 11, marginTop: 6, marginBottom: 16 },
  emptyText: { color: theme.textMuted, fontSize: 13, lineHeight: 20, marginTop: 12, textAlign: 'center' },
  leaderboardContainer: { borderRadius: cardRadius, overflow: 'hidden' },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  leaderboardRowMe: { backgroundColor: 'rgba(198,255,51,0.06)' },
  leaderboardRowChampion: { backgroundColor: 'rgba(198,255,51,0.1)' },
  rankText: { color: theme.textMuted, fontWeight: '900', fontSize: 13, width: 24 },
  rankTextTop: { color: theme.accent },
  leaderboardName: { flex: 1, color: theme.text, fontWeight: '700', fontSize: 12 },
  leaderboardElo: { color: theme.text, fontWeight: '900', fontSize: 13 },
});
