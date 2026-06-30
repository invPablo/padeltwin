import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSession } from '@/lib/useSession';
import { useCountryLeagueBoard, useProfile, useMyPairs } from '@/lib/queries';
import { divisionFromPairElo } from '@/lib/pairDivisions';
import { theme, cardRadius } from '@/constants/theme';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { BackHeader } from '@/components/BackHeader';
import { Card } from '@/components/Card';

export default function CountryLeagueScreen() {
  const { value } = useLocalSearchParams<{ value?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const countryValue = value ?? profile?.country ?? undefined;
  const { data: pairs, isLoading } = useCountryLeagueBoard(countryValue);
  const { data: myPairs } = useMyPairs(userId);
  const myPairIds = new Set((myPairs ?? []).map((p) => p.id));

  if (!countryValue) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <BackHeader title="Country League" />
        <View style={styles.center}>
          <Card style={{ padding: 24, alignSelf: 'center', width: '100%' }} contentStyle={{ alignItems: 'center' }}>
            <Text style={styles.emptyText}>Add your country in your profile to see your national ranking.</Text>
          </Card>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <BackHeader title="Country League" />
        <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, gap: 8, paddingBottom: 110 }}>
      <BackHeader title="Country League" />
      <Text style={styles.title}>{countryValue.toUpperCase()} LEAGUE</Text>
      <Text style={styles.subtitle}>
        Every pair in {countryValue} is here automatically — ranked by PS Score, grouped into divisions.
      </Text>

      <Card style={styles.leaderboardContainer} contentStyle={{ overflow: 'hidden' }}>
        {(pairs ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No pairs from this country yet.</Text>
        ) : (
          (pairs ?? []).map((pair, index) => {
            const rank = index + 1;
            const isMine = myPairIds.has(pair.id);
            const showDivisionHeader = index === 0 || divisionFromPairElo(pair.elo) !== divisionFromPairElo((pairs ?? [])[index - 1].elo);
            return (
              <View key={pair.id}>
                {showDivisionHeader && (
                  <View style={styles.divisionHeader}>
                    <Text style={styles.divisionHeaderText}>{divisionFromPairElo(pair.elo).toUpperCase()}</Text>
                  </View>
                )}
                <View style={[styles.row, rank <= 3 && styles.rowPodium, isMine && styles.rowMe]}>
                  <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                  </Text>
                  <Text style={styles.pairName} numberOfLines={1}>
                    {pair.player_a?.full_name ?? 'Player'} & {pair.player_b?.full_name ?? 'Player'}
                    {isMine ? ' (YOU)' : ''}
                  </Text>
                  {pair.player_a?.is_pro || pair.player_b?.is_pro ? <ProBadge size="sm" /> : null}
                  {pair.player_a?.coach_status === 'approved' || pair.player_b?.coach_status === 'approved' ? <CoachBadge size="sm" /> : null}
                  <Text style={styles.pairElo}>{pair.elo}</Text>
                </View>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: theme.text, fontSize: 22,  letterSpacing: -0.5 , textTransform: 'uppercase'},
  subtitle: { color: theme.textMuted, fontSize: 13, marginBottom: 8 },
  leaderboardContainer: {
    borderRadius: cardRadius,
    overflow: 'hidden',
  },
  divisionHeader: { backgroundColor: 'rgba(198, 255, 51, 0.1)', paddingHorizontal: 14, paddingVertical: 6 },
  divisionHeaderText: { color: theme.accent, fontWeight: '900', fontSize: 10, letterSpacing: 0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowMe: { backgroundColor: 'rgba(198, 255, 51, 0.08)' },
  rowPodium: { backgroundColor: 'rgba(255, 215, 0, 0.04)' },
  rankText: { width: 24, color: theme.textMuted, fontWeight: '800', fontSize: 13 },
  rankTextTop: { color: theme.accent },
  pairName: { flex: 1, color: theme.text, fontWeight: '700', fontSize: 12 },
  pairElo: { color: theme.text, fontWeight: '900', fontSize: 13 },
  emptyText: { color: theme.textMuted, fontSize: 13, textAlign: 'center', padding: 16, lineHeight: 18 },
});
