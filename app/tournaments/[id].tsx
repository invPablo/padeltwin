import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/lib/useSession';
import {
  useJoinTournament,
  useLeaveTournament,
  usePartnerRequests,
  useTournament,
  useTournamentMatches,
  useTournamentParticipants,
} from '@/lib/queries';
import { theme, cardRadius, chipRadius } from '@/constants/theme';
import type { PartnerRequestWithProfiles, TournamentMatch, TournamentParticipantWithProfiles } from '@/types/database';

function entrantName(participants: TournamentParticipantWithProfiles[], entrantId: string | null) {
  if (!entrantId) return 'TBD';
  const p = participants.find((x) => x.id === entrantId);
  if (!p) return 'TBD';
  const a = p.profile?.full_name ?? 'Player';
  return p.partner ? `${a} / ${p.partner.full_name ?? 'Partner'}` : a;
}

function MatchRow({
  match,
  participants,
  myEntrantId,
}: {
  match: TournamentMatch;
  participants: TournamentParticipantWithProfiles[];
  myEntrantId: string | null;
}) {
  const involvesMe = myEntrantId && (match.entrant_a_id === myEntrantId || match.entrant_b_id === myEntrantId);

  if (match.status === 'bye') {
    return <Text style={styles.byeText}>{entrantName(participants, match.entrant_a_id)} advanced (bye)</Text>;
  }

  return (
    <View style={[styles.matchRow, involvesMe && styles.matchRowMine]}>
      <Text style={[styles.matchText, match.winner_entrant_id === match.entrant_a_id && styles.matchTextWinner]}>
        {entrantName(participants, match.entrant_a_id)}
      </Text>
      <Text style={styles.matchVs}>
        {match.status === 'completed' ? (match.sets ?? []).map((s) => `${s.a}-${s.b}`).join(', ') : 'vs'}
      </Text>
      <Text style={[styles.matchText, match.winner_entrant_id === match.entrant_b_id && styles.matchTextWinner]}>
        {entrantName(participants, match.entrant_b_id)}
      </Text>
    </View>
  );
}

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: tournament } = useTournament(id);
  const { data: participants } = useTournamentParticipants(id);
  const { data: matches, isLoading } = useTournamentMatches(id);
  const { data: requests } = usePartnerRequests(userId);
  const joinTournament = useJoinTournament();
  const leaveTournament = useLeaveTournament();

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  if (!tournament || isLoading) return <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />;

  const myPartners = (requests ?? [])
    .filter((r): r is PartnerRequestWithProfiles => r.status === 'accepted')
    .map((r) => (r.from_id === userId ? r.to_profile : r.from_profile))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const myParticipant = participants?.find((p) => p.profile_id === userId || p.partner_id === userId);
  const myEntrantId = myParticipant?.id ?? null;
  const isOpen = tournament.status === 'open';

  const rounds = Array.from(new Set((matches ?? []).map((m) => m.round))).sort((a, b) => a - b);

  function handleJoin() {
    if (!userId || !tournament) return;
    joinTournament.mutate(
      { tournamentId: tournament.id, profileId: userId, partnerId: selectedPartnerId },
      {
        onError: (e) => Alert.alert('Could not join', e instanceof Error ? e.message : 'Please try again.'),
      }
    );
  }

  function handleLeave() {
    if (!myParticipant || !tournament) return;
    Alert.alert('Leave tournament?', 'You can rejoin later while registration is still open.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leaveTournament.mutate({ participantId: myParticipant.id, tournamentId: tournament.id }),
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View>
        <Text style={styles.title}>{tournament.name}</Text>
        <Text style={styles.subtitle}>
          {tournament.format === 'bracket' ? 'Knockout bracket' : 'Round robin'} ·{' '}
          {tournament.status === 'completed' ? 'Completed' : tournament.status === 'open' ? 'Registration open' : 'In progress'}
        </Text>
      </View>

      {isOpen && (
        <View style={styles.section}>
          {myParticipant ? (
            <>
              <Text style={styles.sectionTitle}>YOU'RE IN</Text>
              <Text style={styles.participantText}>{entrantName(participants ?? [], myEntrantId)}</Text>
              <Pressable
                style={[styles.outlineBtn, leaveTournament.isPending && { opacity: 0.6 }]}
                onPress={handleLeave}
                disabled={leaveTournament.isPending}
              >
                <Text style={styles.outlineBtnText}>{leaveTournament.isPending ? 'Leaving…' : 'Leave Tournament'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>JOIN THIS TOURNAMENT</Text>
              <Text style={styles.helperText}>
                Padel tournaments are played in pairs. Pick an accepted partner to register as a team, or join solo and
                we'll pair you up.
              </Text>
              {myPartners.length > 0 && (
                <View style={styles.chipRow}>
                  <Pressable
                    style={[styles.chip, selectedPartnerId === null && styles.chipActive]}
                    onPress={() => setSelectedPartnerId(null)}
                  >
                    <Text style={[styles.chipText, selectedPartnerId === null && styles.chipTextActive]}>Solo</Text>
                  </Pressable>
                  {myPartners.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.chip, selectedPartnerId === p.id && styles.chipActive]}
                      onPress={() => setSelectedPartnerId(p.id)}
                    >
                      <Text style={[styles.chipText, selectedPartnerId === p.id && styles.chipTextActive]}>
                        {p.full_name ?? 'Partner'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable
                style={[styles.joinBtn, joinTournament.isPending && { opacity: 0.6 }]}
                onPress={handleJoin}
                disabled={joinTournament.isPending}
              >
                {joinTournament.isPending ? (
                  <ActivityIndicator color={theme.onAccent} />
                ) : (
                  <Text style={styles.joinBtnText}>
                    {selectedPartnerId ? 'Join as a Pair' : 'Join Solo'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PLAYERS ({participants?.length ?? 0})</Text>
        {(participants ?? []).map((p) => (
          <Text key={p.id} style={[styles.participantText, p.id === myEntrantId && styles.participantTextMine]}>
            {entrantName(participants ?? [], p.id)}
            {!p.partner_id ? ' (solo)' : ''}
          </Text>
        ))}
      </View>

      {rounds.map((round) => (
        <View key={round} style={styles.section}>
          <Text style={styles.sectionTitle}>{tournament.format === 'bracket' ? `ROUND ${round}` : 'MATCHES'}</Text>
          {(matches ?? [])
            .filter((m) => m.round === round)
            .map((m) => (
              <MatchRow key={m.id} match={m} participants={participants ?? []} myEntrantId={myEntrantId} />
            ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  title: { color: theme.text, fontSize: 22, fontWeight: '900' },
  subtitle: { color: theme.textMuted, fontSize: 13, marginTop: 4 },
  section: { backgroundColor: theme.card, borderRadius: cardRadius, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 8 },
  sectionTitle: { color: theme.accent, fontWeight: '900', fontSize: 12, letterSpacing: 0.5, marginBottom: 4 },
  helperText: { color: theme.textMuted, fontSize: 12, lineHeight: 18 },
  participantText: { color: theme.text, fontSize: 13 },
  participantTextMine: { color: theme.accent, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: chipRadius, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: theme.background },
  chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { color: theme.textMuted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: theme.onAccent },
  joinBtn: { backgroundColor: theme.accent, borderRadius: chipRadius, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  joinBtnText: { color: theme.onAccent, fontWeight: '900', fontSize: 14 },
  outlineBtn: { borderWidth: 1, borderColor: theme.danger, borderRadius: chipRadius, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  outlineBtnText: { color: theme.danger, fontWeight: '800', fontSize: 13 },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    gap: 8,
  },
  matchRowMine: { borderColor: theme.accent },
  matchText: { flex: 1, color: theme.textMuted, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  matchTextWinner: { color: theme.text },
  matchVs: { color: theme.textMuted, fontSize: 11, fontWeight: '800' },
  byeText: { color: theme.textMuted, fontSize: 13, fontStyle: 'italic' },
});
