import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useMatch, useJoinMatch, useLeaveMatch, useMatchResult, useRecordMatchResult, useConfirmMatchResult, useDisputeMatchResult, useItemVibs, useToggleVib } from '@/lib/queries';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import { MatchShareCard } from '@/components/MatchShareCard';
import type { MatchPlayer, MatchResultWithProfiles, PlayerLevel, Profile, SetScore, Team } from '@/types/database';
import { theme, buttonRadius, cardRadius } from '@/constants/theme';
import { LEVEL_LABELS } from '@/constants/levels';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: match, isLoading: matchLoading } = useMatch(id);
  const { data: existingResult, isLoading: resultLoading } = useMatchResult(id);

  const joinMatch = useJoinMatch();
  const leaveMatch = useLeaveMatch();
  const recordResult = useRecordMatchResult();
  const confirmResult = useConfirmMatchResult();
  const disputeResult = useDisputeMatchResult();
  const { data: resultVibs } = useItemVibs('match_result', existingResult?.id, userId);
  const toggleVib = useToggleVib();

  function handleToggleResultVib() {
    if (!userId || !existingResult) return;
    toggleVib.mutate({
      profileId: userId,
      itemType: 'match_result',
      itemId: existingResult.id,
      currentlyVibbed: !!resultVibs?.vibbedByMe,
    });
  }

  const shareCardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShareResult() {
    if (!shareCardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
    } finally {
      setSharing(false);
    }
  }

  const [showResultForm, setShowResultForm] = useState(false);
  const [teamA, setTeamA] = useState<string[]>([]);
  const [sets, setSets] = useState<SetScore[]>([{ a: 0, b: 0 }]);
  const [winner, setWinner] = useState<Team | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  if (matchLoading || !match || resultLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const players = (match.match_players ?? []) as (MatchPlayer & { profiles: Profile | null })[];
  const isJoined = players.some((p) => p.player_id === userId);
  const isFull = players.length >= match.max_players;
  const matchId = match.id;
  const isPast = new Date(match.date_time).getTime() < Date.now();
  const canRecordResult = isPast && players.length === 4 && !existingResult && isJoined;

  const recorderInTeamA =
    !!existingResult &&
    (existingResult.recorded_by === existingResult.team_a_player1 ||
      existingResult.recorded_by === existingResult.team_a_player2);
  const userInTeamA =
    !!existingResult &&
    (userId === existingResult.team_a_player1 || userId === existingResult.team_a_player2);
  const canConfirmOrDispute =
    !!existingResult &&
    existingResult.status === 'pending' &&
    existingResult.recorded_by !== userId &&
    !!userId &&
    userInTeamA !== recorderInTeamA;

  function handleJoin() {
    if (!userId) return;
    joinMatch.mutate({ matchId, playerId: userId });
  }

  function handleLeave() {
    if (!userId) return;
    leaveMatch.mutate({ matchId, playerId: userId });
  }

  function toggleTeamA(playerId: string) {
    setTeamA((current) => {
      if (current.includes(playerId)) return current.filter((p) => p !== playerId);
      if (current.length >= 2) return current;
      return [...current, playerId];
    });
  }

  function updateSet(index: number, key: 'a' | 'b', value: string) {
    setSets((current) =>
      current.map((s, i) => (i === index ? { ...s, [key]: Number(value) || 0 } : s))
    );
  }

  function addSet() {
    if (sets.length >= 5) return;
    setSets((current) => [...current, { a: 0, b: 0 }]);
  }

  function handleSubmitResult() {
    setResultError(null);
    if (teamA.length !== 2) {
      setResultError('Pick the 2 players for team A.');
      return;
    }
    if (!winner) {
      setResultError('Pick which team won.');
      return;
    }
    if (!userId) return;

    const teamBIds = players.map((p) => p.player_id).filter((pid) => !teamA.includes(pid));

    recordResult.mutate(
      {
        matchId,
        teamAPlayer1: teamA[0],
        teamAPlayer2: teamA[1],
        teamBPlayer1: teamBIds[0],
        teamBPlayer2: teamBIds[1],
        sets,
        winner,
        recordedBy: userId,
      },
      {
        onSuccess: () => setShowResultForm(false),
        onError: (err: any) => setResultError(err.message ?? 'Could not record the result'),
      }
    );
  }

  function handleConfirmResult() {
    if (!userId || !existingResult) return;
    confirmResult.mutate({ resultId: existingResult.id, matchId, userId });
  }

  function handleDisputeResult() {
    if (!userId || !existingResult) return;
    disputeResult.mutate({ resultId: existingResult.id, matchId, userId });
  }

  return (
    <>
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.tagline}>MATCH DETAILS</Text>
        <Text style={styles.title}>{match.location}</Text>
        <Text style={styles.subtitle}>
          📅 {new Date(match.date_time).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' })} • {new Date(match.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>REQUIRED LEVEL</Text>
          <Text style={styles.infoValue}>{LEVEL_LABELS[match.level as PlayerLevel].toUpperCase()}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>AVAILABILITY</Text>
          <View style={styles.slotsRow}>
            <View style={styles.dotsRow}>
              {Array.from({ length: match.max_players }).map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.slotDot, 
                    i < players.length ? styles.slotDotFilled : styles.slotDotEmpty
                  ]} 
                />
              ))}
            </View>
            <Text style={styles.infoValue}>{players.length}/{match.max_players} PLAYERS</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>MATCH ROSTER</Text>
        {players.length > 0 ? (
          players.map((item, index) => {
            const isMe = item.player_id === userId;
            const isHost = item.player_id === match.created_by;
            return (
              <View
                key={item.player_id}
                style={[
                  styles.playerRow,
                  index === players.length - 1 && { borderBottomWidth: 0 },
                  isMe && styles.playerRowMe,
                ]}
              >
                <View style={[styles.playerAvatar, isMe && styles.playerAvatarMe]}>
                  {item.profiles?.avatar_url ? (
                    <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Image source={require('@/assets/images/icon.png')} style={styles.playerAvatarLogo} resizeMode="contain" />
                  )}
                </View>
                <View style={styles.playerInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.playerName}>{isMe ? 'YOU' : (item.profiles?.full_name ?? 'Player')}</Text>
                    {isHost && (
                      <View style={styles.hostBadge}>
                        <Ionicons name="star" size={9} color={theme.accent} />
                        <Text style={styles.hostBadgeText}>HOST</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.playerSub}>{item.profiles?.level ? LEVEL_LABELS[item.profiles.level].toUpperCase() : 'NO LEVEL'}</Text>
                </View>
                <Text style={styles.playerElo}>{item.profiles?.elo ?? '—'} <Text style={{ fontSize: 9, color: theme.textMuted }}>PS</Text></Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>No players have joined this match roster yet.</Text>
        )}
      </View>

      {existingResult && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SCOREBOARD</Text>
          <View style={styles.scoreBoard}>
            <View style={styles.scoreRow}>
              <View style={styles.scoreTeamInfo}>
                <Text style={styles.scoreTeamName}>TEAM A</Text>
                <Text style={styles.scoreTeamPlayers}>
                  {existingResult.team_a_player1_profile?.full_name?.split(' ')[0]} • {existingResult.team_a_player2_profile?.full_name?.split(' ')[0]}
                </Text>
              </View>
              <View style={styles.setsWrapper}>
                {existingResult.sets.map((s, idx) => (
                  <View key={idx} style={[styles.setScoreBox, existingResult.winner === 'a' && styles.setScoreBoxWinner]}>
                    <Text style={[styles.setText, existingResult.winner === 'a' && styles.setTextWinner]}>{s.a}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.scoreRow, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#2C2C35', paddingTop: 12 }]}>
              <View style={styles.scoreTeamInfo}>
                <Text style={styles.scoreTeamName}>TEAM B</Text>
                <Text style={styles.scoreTeamPlayers}>
                  {existingResult.team_b_player1_profile?.full_name?.split(' ')[0]} • {existingResult.team_b_player2_profile?.full_name?.split(' ')[0]}
                </Text>
              </View>
              <View style={styles.setsWrapper}>
                {existingResult.sets.map((s, idx) => (
                  <View key={idx} style={[styles.setScoreBox, existingResult.winner === 'b' && styles.setScoreBoxWinner]}>
                    <Text style={[styles.setText, existingResult.winner === 'b' && styles.setTextWinner]}>{s.b}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.scoreboardFooter}>
            <Text style={styles.winnerTag}>🏆 WINNER: TEAM {existingResult.winner.toUpperCase()}</Text>
            {existingResult.status === 'pending' && (
              <Text style={styles.statusPending}>⏳ AWAITING CONFIRMATION FROM THE OTHER TEAM</Text>
            )}
            {existingResult.status === 'disputed' && (
              <Text style={styles.statusDisputed}>⚠️ DISPUTED — UNDER REVIEW</Text>
            )}
          </View>

          {existingResult.status === 'confirmed' && (
            <View style={styles.postMatchRow}>
              <Pressable
                style={({ pressed }) => [styles.shareButton, { flex: 1 }, pressed && { opacity: 0.9 }]}
                onPress={handleShareResult}
                disabled={sharing}
              >
                {sharing ? <ActivityIndicator color={theme.text} /> : <Text style={styles.shareButtonText}>📤 Share Result</Text>}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.kudosButton,
                  resultVibs?.vibbedByMe && styles.kudosButtonActive,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleToggleResultVib}
              >
                <Ionicons
                  name={resultVibs?.vibbedByMe ? 'heart' : 'heart-outline'}
                  size={16}
                  color={resultVibs?.vibbedByMe ? theme.primary : theme.textMuted}
                />
                {!!resultVibs?.count && (
                  <Text style={[styles.kudosCount, resultVibs?.vibbedByMe && { color: theme.primary }]}>
                    {resultVibs.count}
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {canConfirmOrDispute && (
            <View style={styles.confirmRow}>
              <Pressable
                style={({ pressed }) => [styles.button, styles.joinButton, { flex: 1 }, pressed && { opacity: 0.9 }]}
                onPress={handleConfirmResult}
                disabled={confirmResult.isPending || disputeResult.isPending}
              >
                {confirmResult.isPending ? <ActivityIndicator color={theme.onAccent} /> : <Text style={[styles.buttonText, { color: theme.onAccent }]}>Confirm Result</Text>}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, styles.leaveButton, { flex: 1 }, pressed && { opacity: 0.9 }]}
                onPress={handleDisputeResult}
                disabled={confirmResult.isPending || disputeResult.isPending}
              >
                {disputeResult.isPending ? <ActivityIndicator color={theme.danger} /> : <Text style={[styles.buttonText, { color: theme.danger }]}>Dispute</Text>}
              </Pressable>
            </View>
          )}
        </View>
      )}

      {match.status === 'cancelled' ? (
        <View style={styles.cancelledContainer}>
          <Text style={styles.cancelled}>This match has been cancelled by host.</Text>
        </View>
      ) : (
        <View style={styles.actionsContainer}>
          {isJoined ? (
            <Pressable 
              style={({ pressed }) => [
                styles.button, 
                styles.leaveButton, 
                pressed && { opacity: 0.9 }
              ]} 
              onPress={handleLeave} 
              disabled={leaveMatch.isPending}
            >
              {leaveMatch.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Leave Match Roster</Text>}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.button, 
                styles.joinButton,
                isFull && styles.buttonDisabled,
                pressed && !isFull && { scale: 0.98 } as any
              ]}
              onPress={handleJoin}
              disabled={isFull || joinMatch.isPending}
            >
              {joinMatch.isPending ? (
                <ActivityIndicator color={isFull ? '#fff' : theme.onAccent} />
              ) : (
                <Text style={[styles.buttonText, { color: isFull ? '#fff' : theme.onAccent }]}>{isFull ? 'Match Roster Full' : 'Join Match Roster'}</Text>
              )}
            </Pressable>
          )}

          {canRecordResult && !showResultForm && (
            <Pressable 
              style={({ pressed }) => [
                styles.button, 
                styles.secondaryButton,
                pressed && { opacity: 0.9 }
              ]} 
              onPress={() => setShowResultForm(true)}
            >
              <Text style={styles.buttonText}>Submit Score Sheet</Text>
            </Pressable>
          )}
        </View>
      )}

      {showResultForm && (
        <View style={[styles.section, { marginTop: 16 }]}>
          <Text style={styles.sectionHeader}>RECORD SCORE SHEET</Text>

          <Text style={styles.label}>SELECT TEAM A ATHLETES (PICK 2)</Text>
          <View style={styles.chipRow}>
            {players.map((p) => (
              <Pressable
                key={p.player_id}
                style={({ pressed }) => [
                  styles.playerChip, 
                  teamA.includes(p.player_id) && styles.playerChipActive,
                  pressed && { scale: 0.96 } as any
                ]}
                onPress={() => toggleTeamA(p.player_id)}>
                <Text
                  style={[
                    styles.playerChipText,
                    teamA.includes(p.player_id) && styles.playerChipTextActive,
                  ]}>
                  {p.profiles?.full_name?.split(' ')[0] ?? 'Player'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>SET SCORES</Text>
          {sets.map((s, i) => (
            <View key={i} style={styles.setRow}>
              <Text style={styles.setLabel}>SET {i + 1}</Text>
              <TextInput
                style={styles.setInput}
                keyboardType="number-pad"
                value={String(s.a)}
                onChangeText={(v) => updateSet(i, 'a', v)}
              />
              <Text style={styles.setDash}>-</Text>
              <TextInput
                style={styles.setInput}
                keyboardType="number-pad"
                value={String(s.b)}
                onChangeText={(v) => updateSet(i, 'b', v)}
              />
            </View>
          ))}
          <Pressable 
            style={({ pressed }) => [
              styles.addSetButton,
              pressed && { opacity: 0.7 }
            ]} 
            onPress={addSet}
          >
            <Text style={styles.addSet}>+ ADD EXTRA SET</Text>
          </Pressable>

          <Text style={[styles.label, { marginTop: 18 }]}>WINNING TEAM</Text>
          <View style={styles.chipRow}>
            <Pressable
              style={[styles.playerChip, winner === 'a' && styles.playerChipActive]}
              onPress={() => setWinner('a')}>
              <Text style={[styles.playerChipText, winner === 'a' && styles.playerChipTextActive]}>
                TEAM A
              </Text>
            </Pressable>
            <Pressable
              style={[styles.playerChip, winner === 'b' && styles.playerChipActive]}
              onPress={() => setWinner('b')}>
              <Text style={[styles.playerChipText, winner === 'b' && styles.playerChipTextActive]}>
                TEAM B
              </Text>
            </Pressable>
          </View>

          {resultError && <Text style={styles.error}>{resultError}</Text>}

          <Pressable 
            style={({ pressed }) => [
              styles.button, 
              styles.joinButton,
              pressed && styles.buttonPressed,
              recordResult.isPending && styles.buttonDisabled
            ]} 
            onPress={handleSubmitResult}
            disabled={recordResult.isPending}
          >
            {recordResult.isPending ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.onAccent }]}>Save Results</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
    {existingResult && (
      <View style={styles.offscreenCard} pointerEvents="none">
        <MatchShareCard ref={shareCardRef} result={existingResult as MatchResultWithProfiles} />
      </View>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
  scrollContainer: { flex: 1, backgroundColor: theme.background },
  offscreenCard: { position: 'absolute', top: -9999, left: -9999 },
  shareButton: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: buttonRadius,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareButtonText: { color: theme.text, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  postMatchRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  kudosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: buttonRadius,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  kudosButtonActive: { borderColor: theme.primary, backgroundColor: 'rgba(198, 255, 51, 0.08)' },
  kudosCount: { fontSize: 12, fontWeight: '800', color: theme.textMuted },
  container: { padding: 20, gap: 16, paddingBottom: 32 },
  headerContainer: { marginTop: 12, marginBottom: 4 },
  tagline: { fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26,  color: theme.text, textTransform: 'uppercase', letterSpacing: -0.5},
  subtitle: { color: theme.textMuted, fontSize: 13, marginTop: 4, fontWeight: '700' },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 14,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  infoCell: { flex: 1, paddingHorizontal: 16 },
  infoDivider: { width: 1, height: '100%', backgroundColor: theme.border },
  infoLabel: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 1, marginBottom: 4 },
  infoValue: { fontSize: 13,  color: theme.text, textTransform: 'uppercase'},
  slotsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dotsRow: { flexDirection: 'row', gap: 3 },
  slotDot: { width: 6, height: 6, borderRadius: 1.5 },
  slotDotFilled: { backgroundColor: theme.primary },
  slotDotEmpty: { backgroundColor: '#22242E' },
  section: { backgroundColor: theme.card, borderRadius: cardRadius, padding: 16, borderWidth: 1, borderColor: theme.border },
  sectionHeader: { fontSize: 10,  color: theme.primary, letterSpacing: 1.5, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 6, textTransform: 'uppercase'},
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  playerRowMe: { backgroundColor: 'rgba(198, 255, 51, 0.06)', borderBottomColor: 'transparent' },
  hostBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(198, 255, 51, 0.12)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  hostBadgeText: { fontSize: 8, fontWeight: '900', color: theme.accent, letterSpacing: 0.3 },
  playerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#22242E', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: theme.border, justifyContent: 'center' },
  playerAvatarMe: { borderColor: theme.primary, borderWidth: 1.5 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 15 },
  playerAvatarLogo: { width: 14, height: 14, opacity: 0.5 },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, fontWeight: '700', color: theme.text },
  playerSub: { fontSize: 9, color: theme.textMuted, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 },
  playerElo: { fontSize: 13, fontWeight: '900', color: theme.text },
  empty: { color: theme.textMuted, fontSize: 12, fontWeight: '700' },
  scoreBoard: { backgroundColor: '#0B0C10', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreTeamInfo: { flex: 1, marginRight: 12 },
  scoreTeamName: { fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 0.5 },
  scoreTeamPlayers: { fontSize: 13, fontWeight: '700', color: theme.text, marginTop: 2 },
  setsWrapper: { flexDirection: 'row', gap: 6 },
  setScoreBox: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#22242E', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  setScoreBoxWinner: { backgroundColor: 'rgba(198, 255, 51, 0.12)', borderColor: theme.primary },
  setText: { fontSize: 12, fontWeight: '900', color: theme.textMuted },
  setTextWinner: { color: theme.primary },
  scoreboardFooter: { marginTop: 12, alignItems: 'center' },
  winnerTag: { fontSize: 10,  color: theme.primary, letterSpacing: 0.5, textTransform: 'uppercase'},
  statusPending: { fontSize: 10,  color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6},
  statusDisputed: { fontSize: 10,  color: theme.danger, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 6},
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelledContainer: { backgroundColor: 'rgba(255, 59, 48, 0.1)', borderWidth: 1, borderColor: theme.danger, borderRadius: cardRadius, padding: 14, alignItems: 'center' },
  cancelled: { color: theme.danger,  fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase'},
  actionsContainer: { gap: 12, marginTop: 4 },
  button: { borderRadius: buttonRadius, padding: 14, alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  joinButton: { backgroundColor: theme.primary, shadowColor: theme.primary },
  secondaryButton: { backgroundColor: theme.secondary, shadowColor: theme.secondary },
  leaveButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.danger },
  buttonDisabled: { backgroundColor: '#22242E', shadowOpacity: 0, elevation: 0 },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonText: { color: '#fff', fontSize: 14,  textTransform: 'uppercase', letterSpacing: 0.8},
  label: { fontSize: 9,  color: theme.textMuted, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase'},
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  playerChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: theme.card },
  playerChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  playerChipText: { color: theme.textMuted, fontWeight: '800', fontSize: 11 },
  playerChipTextActive: { color: theme.onAccent, fontWeight: '900' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  setLabel: { width: 50, fontSize: 10,  color: theme.textMuted, textTransform: 'uppercase'},
  setInput: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, width: 60, textAlign: 'center', backgroundColor: '#22242E', color: theme.text, fontSize: 14, fontWeight: '900' },
  setDash: { fontSize: 16, color: theme.text, fontWeight: '900' },
  addSetButton: { marginTop: 10, alignSelf: 'flex-start' },
  addSet: { color: theme.primary,  fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase'},
  error: { color: theme.danger,  fontSize: 12, marginTop: 12, textAlign: 'center', textTransform: 'uppercase'},
});
