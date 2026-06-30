import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import { useLeague, useLeagueMembers, useLeaveLeague, useRemoveLeagueMember, useDeleteLeague } from '@/lib/queries';
import { theme, buttonRadius, cardRadius } from '@/constants/theme';

export default function LeagueDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: league, isLoading: leagueLoading } = useLeague(id);
  const { data: members, isLoading: membersLoading } = useLeagueMembers(id);
  const leaveLeague = useLeaveLeague();
  const removeMember = useRemoveLeagueMember();
  const deleteLeague = useDeleteLeague();

  const isCreator = league?.created_by === userId;

  async function handleShareCode() {
    if (!league) return;
    await Share.share({ message: `Join my padel league "${league.name}" on PadelScrim! Invite code: ${league.invite_code}` });
  }

  function handleLeave() {
    if (!userId || !league) return;
    Alert.alert('Leave league?', `You'll need a new invite to rejoin "${league.name}".`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leaveLeague.mutate({ leagueId: league.id, profileId: userId }, { onSuccess: () => router.back() }),
      },
    ]);
  }

  function handleDelete() {
    if (!league) return;
    Alert.alert('Delete league?', 'This removes the league for everyone. This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteLeague.mutate(league.id, { onSuccess: () => router.back() }),
      },
    ]);
  }

  function handleRemoveMember(profileId: string, name: string) {
    if (!league) return;
    Alert.alert('Remove player?', `Remove ${name} from "${league.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMember.mutate({ leagueId: league.id, profileId }),
      },
    ]);
  }

  if (leagueLoading || !league) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.leagueName}>{league.name}</Text>

      <Pressable style={({ pressed }) => [styles.codeCard, pressed && { opacity: 0.9 }]} onPress={handleShareCode}>
        <View>
          <Text style={styles.codeLabel}>INVITE CODE • TAP TO SHARE</Text>
          <Text style={styles.codeValue}>{league.invite_code}</Text>
        </View>
        <Ionicons name="share-outline" size={20} color={theme.accent} />
      </Pressable>

      <Text style={styles.sectionTitle}>LEADERBOARD</Text>
      {membersLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 16 }} />
      ) : members && members.length > 0 ? (
        <View style={styles.leaderboardContainer}>
          {members.map((m, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            const isMe = m.profile_id === userId;
            return (
              <View
                key={m.profile_id}
                style={[styles.row, rank === members.length && { borderBottomWidth: 0 }, isMe && styles.rowMe]}
              >
                <Text style={[styles.rankText, isTop3 && styles.rankTextTop]}>{rank}</Text>
                <View style={styles.avatarPlaceholder}>
                  <Image source={require('@/assets/images/icon.png')} style={styles.avatarPlaceholderLogo} resizeMode="contain" />
                </View>
                <Text style={styles.playerName} numberOfLines={1}>
                  {m.profiles?.full_name ?? 'Player'} {isMe ? '(YOU)' : ''}
                </Text>
                <Text style={styles.playerElo}>{m.profiles?.elo ?? 1200}</Text>
                {isCreator && !isMe && (
                  <Pressable onPress={() => handleRemoveMember(m.profile_id, m.profiles?.full_name ?? 'this player')} style={{ marginLeft: 8 }}>
                    <Ionicons name="close-circle" size={18} color={theme.danger} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>No members yet.</Text>
      )}

      {isCreator ? (
        <Pressable style={({ pressed }) => [styles.dangerButton, pressed && { opacity: 0.8 }]} onPress={handleDelete}>
          <Text style={styles.dangerButtonText}>DELETE LEAGUE</Text>
        </Pressable>
      ) : (
        <Pressable style={({ pressed }) => [styles.dangerButton, pressed && { opacity: 0.8 }]} onPress={handleLeave}>
          <Text style={styles.dangerButtonText}>LEAVE LEAGUE</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 8 },
  leagueName: { color: theme.text, fontSize: 24,  letterSpacing: -0.5 , textTransform: 'uppercase'},
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginTop: 12,
  },
  codeLabel: { color: theme.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  codeValue: { color: theme.accent, fontSize: 20, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  sectionTitle: { fontSize: 11,  marginTop: 20, color: theme.accent, letterSpacing: 1.5 , textTransform: 'uppercase'},
  leaderboardContainer: {
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowMe: { backgroundColor: 'rgba(198, 255, 51, 0.06)' },
  rankText: { width: 20, color: theme.textMuted, fontWeight: '800', fontSize: 13 },
  rankTextTop: { color: theme.accent },
  avatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderLogo: { width: 16, height: 16, opacity: 0.5 },
  playerName: { flex: 1, color: theme.text, fontWeight: '700', fontSize: 12 },
  playerElo: { color: theme.text, fontWeight: '900', fontSize: 13 },
  emptyText: { color: theme.textMuted, fontSize: 13, marginTop: 16 },
  dangerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: buttonRadius,
    borderWidth: 1,
    borderColor: theme.danger,
    padding: 14,
    marginTop: 28,
    marginBottom: 20,
  },
  dangerButtonText: { color: theme.danger, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
