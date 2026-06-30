import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/useSession';
import {
  useProfile,
  useMyStats,
  useRecentResults,
  useMyAchievements,
  useFollowing,
  useFollowPlayer,
  useUnfollowPlayer,
  usePartnerRequests,
  useSendPartnerRequest,
  useFollowerCount,
  useFollowingCount,
  usePersonalRecords,
  useScrimIndex,
  scrimIndexLabel,
  useBlockedUsers,
  useBlockUser,
  useUnblockUser,
  useReportContent,
  useMyPosts,
  usePostsVibs,
  useToggleVib,
  type PostCardData,
} from '@/lib/queries';
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_TIERS, TIER_COLORS } from '@/constants/achievements';
import { ELO_PROVISIONAL_MATCHES, isEloProvisional } from '@/constants/elo';
import { theme, cardRadius, buttonRadius } from '@/constants/theme';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { MatchCard } from '@/components/MatchCard';
import { PostDetailModal } from '@/components/PostDetailModal';
import { divisionProgress } from '@/lib/pairDivisions';
import type { MatchResultWithProfiles, PartnerRequestWithProfiles } from '@/types/database';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MASONRY_GAP = 10;
const MASONRY_PADDING = 16;
const COL_WIDTH = (SCREEN_WIDTH - MASONRY_PADDING * 2 - MASONRY_GAP) / 2;

function cardHeightFor(id: string, index: number) {
  const seed = (id.charCodeAt(0) + index) % 3;
  return COL_WIDTH * (seed === 0 ? 1.5 : seed === 1 ? 1.2 : 1.35);
}

function didWin(result: MatchResultWithProfiles, userId: string) {
  const inTeamA = result.team_a_player1 === userId || result.team_a_player2 === userId;
  return (inTeamA && result.winner === 'a') || (!inTeamA && result.winner === 'b');
}

function opponentProfile(result: MatchResultWithProfiles, userId: string) {
  const inTeamA = result.team_a_player1 === userId || result.team_a_player2 === userId;
  return inTeamA
    ? (result.team_b_player1 === userId ? result.team_a_player1_profile : result.team_b_player1_profile)
    : (result.team_a_player1 === userId ? result.team_b_player1_profile : result.team_a_player1_profile);
}

function requestWith(requests: PartnerRequestWithProfiles[], meId: string, otherId: string) {
  return requests.find(
    (r) => (r.from_id === meId && r.to_id === otherId) || (r.from_id === otherId && r.to_id === meId)
  );
}

export default function PlayerProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const currentUserId = session?.user.id;

  const { data: profile, isLoading } = useProfile(id);
  const { data: stats } = useMyStats(id);
  const { data: scrimIndex } = useScrimIndex(id);
  const { data: recentResults, isLoading: resultsLoading } = useRecentResults(id, 20);
  const { data: achievements } = useMyAchievements(id);
  const { data: following } = useFollowing(currentUserId);
  const { data: requests } = usePartnerRequests(currentUserId);
  const { data: followerCount } = useFollowerCount(id);
  const { data: followingCount } = useFollowingCount(id);
  const { data: records } = usePersonalRecords(id);
  const { data: blockedUsers } = useBlockedUsers(currentUserId);
  const { data: playerPosts, isLoading: postsLoading } = useMyPosts(id);

  const postIds = (playerPosts ?? []).map((p) => p.id);
  const { data: postsVibs } = usePostsVibs(postIds, currentUserId);
  const toggleVib = useToggleVib();

  const [activeTab, setActiveTab] = useState<'posts' | 'matches'>('posts');
  const [viewingPost, setViewingPost] = useState<PostCardData | null>(null);

  const followPlayer = useFollowPlayer();
  const unfollowPlayer = useUnfollowPlayer();
  const sendRequest = useSendPartnerRequest();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const reportContent = useReportContent();

  if (isLoading || !profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  const isSelf = id === currentUserId;
  const isFollowing = following?.has(id);
  const followPending = followPlayer.isPending || unfollowPlayer.isPending;
  const existing = currentUserId && requests ? requestWith(requests, currentUserId, id) : undefined;
  const isConnected = existing?.status === 'accepted';
  const isBlocked = blockedUsers?.has(id);

  function handleFollowPress() {
    if (!currentUserId || followPending || isSelf) return;
    if (isFollowing) {
      unfollowPlayer.mutate(
        { followerId: currentUserId, followedId: id },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['following'] }); queryClient.invalidateQueries({ queryKey: ['activityFeed'] }); } }
      );
    } else {
      followPlayer.mutate(
        { followerId: currentUserId, followedId: id },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['following'] }); queryClient.invalidateQueries({ queryKey: ['activityFeed'] }); } }
      );
    }
  }

  function handleConnectPress() {
    if (!currentUserId || existing || sendRequest.isPending || isSelf) return;
    sendRequest.mutate({ fromId: currentUserId, toId: id });
  }

  function handleMessagePress() {
    if (existing?.status === 'accepted') {
      router.push({ pathname: '/chat/[requestId]', params: { requestId: existing.id } });
    }
  }

  function handleMorePress() {
    if (!currentUserId) return;
    Alert.alert('More options', undefined, [
      {
        text: isBlocked ? 'Unblock' : 'Block',
        style: 'destructive',
        onPress: () => {
          if (isBlocked) {
            unblockUser.mutate({ blockerId: currentUserId, blockedId: id });
          } else {
            Alert.alert('Block this player?', "You won't see each other in discovery anymore.", [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block', style: 'destructive', onPress: () => blockUser.mutate({ blockerId: currentUserId, blockedId: id }) },
            ]);
          }
        },
      },
      {
        text: 'Report',
        onPress: () =>
          Alert.alert('Report this player', 'What is the issue?', [
            { text: 'Cancel', style: 'cancel' },
            ...['Inappropriate profile', 'Harassment', 'Fake account', 'Other'].map((reason) => ({
              text: reason,
              onPress: () =>
                reportContent.mutate(
                  { reporterId: currentUserId, targetType: 'profile', targetId: id, reason },
                  { onSuccess: () => Alert.alert('Reported', "Thanks — we'll review it.") }
                ),
            })),
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ] as any);
  }

  const rank = divisionProgress(profile.elo);
  const isCalibrating = isEloProvisional(stats?.played ?? 0);

  const recordItems: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }[] = [];
  if (records?.longestWinStreak)
    recordItems.push({ icon: 'flame', value: `${records.longestWinStreak} wins`, label: 'Longest streak' });
  if (records?.busiestMonth)
    recordItems.push({ icon: 'calendar', value: `${records.busiestMonth.count} matches`, label: records.busiestMonth.label });
  if (records?.bestEloGain)
    recordItems.push({ icon: 'flash', value: `+${records.bestEloGain.delta} PS`, label: 'Best PS Score gain' });

  let connectLabel = 'CONNECT';
  let connectStyle = styles.connectBtn;
  if (existing?.status === 'pending') { connectLabel = 'PENDING'; connectStyle = styles.connectBtnMuted; }
  else if (existing?.status === 'accepted') { connectLabel = 'CONNECTED'; connectStyle = styles.connectBtnSuccess; }
  else if (existing?.status === 'rejected') { connectLabel = 'DECLINED'; connectStyle = styles.connectBtnMuted; }

  return (
    <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={[styles.headerWrapper, { paddingTop: insets.top + 24 }]}>

        {/* Top icons: back (left) + more (right) */}
        <View style={[styles.topIconsRow, { top: insets.top + 16 }]}>
          <Pressable style={({ pressed }) => [styles.topIconBtn, pressed && { opacity: 0.7 }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          {!isSelf && (
            <Pressable style={({ pressed }) => [styles.topIconBtn, pressed && { opacity: 0.7 }]} onPress={handleMorePress}>
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
            </Pressable>
          )}
        </View>

        {/* Avatar — no camera badge */}
        <View style={styles.avatarCircleWrap}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarCircle} />
          ) : (
            <View style={styles.avatarCirclePlaceholder}>
              <Image source={require('@/assets/images/icon.png')} style={styles.avatarCirclePlaceholderLogo} resizeMode="contain" />
            </View>
          )}
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.playerName}>{profile.full_name ?? 'Player'}</Text>
          {profile.is_pro && <ProBadge />}
          {profile.coach_status === 'approved' && <CoachBadge />}
        </View>
        {profile.zone ? <Text style={styles.locationSub}>📍 {profile.zone}</Text> : null}
        {(profile as any).bio ? <Text style={styles.bioText}>{(profile as any).bio}</Text> : null}

        <View style={styles.badgeChipsRow}>
          {rank && (
            <View style={styles.rankChip}>
              <Ionicons name="ribbon-outline" size={12} color={theme.accent} />
              <Text style={styles.rankChipText}>{rank.division}</Text>
            </View>
          )}
          {profile.looking_for_partner && (
            <View style={styles.outlinedBadge}>
              <Text style={styles.outlinedBadgeText}>LOOKING FOR PARTNER</Text>
            </View>
          )}
        </View>

        {/* Action row: Follow / Connect / Message */}
        {!isSelf && (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.followBtn, isFollowing && styles.followBtnActive]}
              onPress={handleFollowPress}
              disabled={followPending}
            >
              <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
              </Text>
            </Pressable>
            <Pressable
              style={[connectStyle, existing?.status === 'pending' && styles.connectBtnDisabled]}
              onPress={handleConnectPress}
              disabled={!!existing || sendRequest.isPending}
            >
              {sendRequest.isPending
                ? <ActivityIndicator size="small" color={theme.onAccent} />
                : <Text style={styles.connectBtnText}>{connectLabel}</Text>}
            </Pressable>
            <Pressable
              style={[styles.messageBtn, !isConnected && { opacity: 0.3 }]}
              onPress={handleMessagePress}
              disabled={!isConnected}
            >
              <Ionicons name="chatbubble-outline" size={16} color={theme.text} />
            </Pressable>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{playerPosts?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <Pressable style={styles.statColumn} onPress={() => router.push(`/social/${id}?type=followers` as any)}>
            <Text style={styles.statValue}>{followerCount ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <Pressable style={styles.statColumn} onPress={() => router.push(`/social/${id}?type=following` as any)}>
            <Text style={styles.statValue}>{followingCount ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
          <View style={styles.statColumn}>
            <Text style={[styles.statValue, { color: theme.accent }]}>
              {isCalibrating ? `${stats?.played ?? 0}/${ELO_PROVISIONAL_MATCHES}` : profile.elo}
            </Text>
            <Text style={styles.statLabel}>{isCalibrating ? 'Calibrating' : 'PS Score'}</Text>
          </View>
        </View>

        <View style={styles.secondaryStatsRow}>
          <Text style={styles.secondaryStat}>{stats?.played ?? 0} matches · {stats?.winRate ?? 0}% win rate</Text>
          {scrimIndex != null && (
            <View style={[styles.scrimPill, { borderColor: scrimIndex >= 7 ? theme.success : scrimIndex >= 5 ? theme.accent : theme.danger }]}>
              <Text style={styles.scrimPillText}>{scrimIndex.toFixed(1)} {scrimIndexLabel(scrimIndex)}</Text>
            </View>
          )}
        </View>

        {recordItems.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recordsRow}>
            {recordItems.map((item) => (
              <View key={item.label} style={styles.recordChip}>
                <Ionicons name={item.icon} size={13} color={theme.accent} />
                <Text style={styles.recordChipText}>{item.value}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {achievements && achievements.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementsRow}>
            {achievements.map((item) => {
              const iconName = ACHIEVEMENT_ICONS[item.type] || 'trophy';
              const tier = ACHIEVEMENT_TIERS[item.type] || 'bronze';
              const tierColor = TIER_COLORS[tier];
              return (
                <View key={item.id} style={[styles.achievementBadge, { borderColor: tierColor, backgroundColor: `${tierColor}1A` }]}>
                  <Ionicons name={iconName as any} size={16} color={tierColor} />
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, activeTab === 'posts' && styles.tabBtnActive]} onPress={() => setActiveTab('posts')}>
          <Ionicons name="albums-outline" size={18} color={activeTab === 'posts' ? theme.text : theme.textMuted} />
        </Pressable>
        <Pressable style={[styles.tabBtn, activeTab === 'matches' && styles.tabBtnActive]} onPress={() => setActiveTab('matches')}>
          <Ionicons name="tennisball-outline" size={18} color={activeTab === 'matches' ? theme.text : theme.textMuted} />
        </Pressable>
      </View>

      {activeTab === 'posts' ? (
        postsLoading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 30 }} />
        ) : playerPosts && playerPosts.length > 0 ? (
          <View style={styles.masonryRow}>
            <View style={styles.masonryCol}>
              {playerPosts.filter((_, i) => i % 2 === 0).map((p, i) => (
                <MatchCard
                  key={p.id}
                  post={p}
                  posterId={id}
                  width={COL_WIDTH}
                  height={cardHeightFor(p.id, i)}
                  onPress={() => setViewingPost(p)}
                  vibCount={postsVibs?.[p.id]?.count}
                  vibbedByMe={postsVibs?.[p.id]?.vibbedByMe}
                  onToggleVib={() => currentUserId && toggleVib.mutate({ profileId: currentUserId, itemType: 'post', itemId: p.id, currentlyVibbed: postsVibs?.[p.id]?.vibbedByMe ?? false })}
                />
              ))}
            </View>
            <View style={styles.masonryCol}>
              {playerPosts.filter((_, i) => i % 2 === 1).map((p, i) => (
                <MatchCard
                  key={p.id}
                  post={p}
                  posterId={id}
                  width={COL_WIDTH}
                  height={cardHeightFor(p.id, i + 1)}
                  onPress={() => setViewingPost(p)}
                  vibCount={postsVibs?.[p.id]?.count}
                  vibbedByMe={postsVibs?.[p.id]?.vibbedByMe}
                  onToggleVib={() => currentUserId && toggleVib.mutate({ profileId: currentUserId, itemType: 'post', itemId: p.id, currentlyVibbed: postsVibs?.[p.id]?.vibbedByMe ?? false })}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyTab}>
            <Ionicons name="camera-outline" size={32} color={theme.textMuted} />
            <Text style={styles.emptyTabText}>No posts yet</Text>
          </View>
        )
      ) : resultsLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 30 }} />
      ) : recentResults && recentResults.length > 0 ? (
        <View style={styles.matchesList}>
          {recentResults.map((r) => {
            const win = didWin(r, id);
            const opp = opponentProfile(r, id);
            return (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/match/${r.match_id || r.id}` as any)}
                style={({ pressed }) => [styles.matchRow, pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.matchResultDot, { backgroundColor: win ? theme.success : theme.danger }]} />
                <Text style={styles.matchOpponent} numberOfLines={1}>vs {opp?.full_name ?? 'Player'}</Text>
                <Text style={styles.matchScore}>{r.sets.map((s) => `${s.a}-${s.b}`).join(', ')}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyTab}>
          <Ionicons name="tennisball-outline" size={32} color={theme.textMuted} />
          <Text style={styles.emptyTabText}>No matches recorded yet</Text>
        </View>
      )}

      <PostDetailModal post={viewingPost} userId={currentUserId} onClose={() => setViewingPost(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centerContainer: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  headerWrapper: { alignItems: 'center', paddingBottom: 16, paddingHorizontal: 24 },
  topIconsRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  topIconBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCircleWrap: { width: 96, height: 96, marginBottom: 10 },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: theme.accent },
  avatarCirclePlaceholder: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: theme.accent,
    backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center',
  },
  avatarCirclePlaceholderLogo: { width: 48, height: 48, opacity: 0.5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  playerName: { fontFamily: 'Anton_400Regular', fontSize: 20, color: theme.text, letterSpacing: -0.3 },
  locationSub: { fontSize: 12, fontWeight: '600', color: theme.textMuted, marginBottom: 6 },
  bioText: { color: theme.text, fontSize: 12, textAlign: 'center', marginBottom: 8, lineHeight: 17, paddingHorizontal: 16 },
  badgeChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  rankChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1,
    borderColor: 'rgba(198, 255, 51, 0.3)', backgroundColor: 'rgba(198, 255, 51, 0.08)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  rankChipText: { color: theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  outlinedBadge: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  outlinedBadgeText: { color: theme.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'center' },
  followBtn: {
    flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
  },
  followBtnActive: { backgroundColor: theme.card, borderColor: theme.accent },
  followBtnText: { color: theme.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  followBtnTextActive: { color: theme.accent },
  connectBtn: {
    flex: 1, backgroundColor: theme.accent, borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
  },
  connectBtnMuted: {
    flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    borderRadius: 10, paddingVertical: 9, alignItems: 'center',
  },
  connectBtnSuccess: {
    flex: 1, backgroundColor: `${theme.success}22`, borderWidth: 1, borderColor: theme.success,
    borderRadius: 10, paddingVertical: 9, alignItems: 'center',
  },
  connectBtnDisabled: { opacity: 0.6 },
  connectBtnText: { color: theme.onAccent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  messageBtn: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginBottom: 10 },
  statColumn: { alignItems: 'center' },
  statValue: { fontFamily: 'Anton_400Regular', fontSize: 18, color: theme.text },
  statLabel: { fontSize: 10, color: theme.textMuted, marginTop: 2, fontWeight: '600' },
  secondaryStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  secondaryStat: { color: theme.textMuted, fontSize: 11, fontWeight: '600' },
  scrimPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  scrimPillText: { color: theme.text, fontSize: 10, fontWeight: '800' },
  recordsRow: { gap: 8, marginBottom: 8 },
  recordChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.card, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6,
  },
  recordChipText: { color: theme.text, fontSize: 10, fontWeight: '700' },
  achievementsRow: { gap: 8 },
  achievementBadge: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: theme.accent },
  masonryRow: { flexDirection: 'row', gap: MASONRY_GAP, paddingHorizontal: MASONRY_PADDING, paddingTop: 4 },
  masonryCol: { flex: 1, gap: MASONRY_GAP },
  emptyTab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 10 },
  emptyTabText: { color: theme.textMuted, fontSize: 12, fontWeight: '600' },
  matchesList: { paddingBottom: 40 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  matchResultDot: { width: 8, height: 8, borderRadius: 4 },
  matchOpponent: { flex: 1, color: theme.text, fontSize: 13, fontWeight: '700' },
  matchScore: { color: theme.textMuted, fontSize: 12, fontWeight: '600' },
});
