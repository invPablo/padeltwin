import { useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import {
  useProfile,
  useUpdateProfile,
  useMyAchievements,
  useMyStats,
  useRecentResults,
  useMyPosts,
  useFollowerCount,
  useFollowingCount,
  usePersonalRecords,
  useScrimIndex,
  scrimIndexLabel,
} from '@/lib/queries';
import { ACHIEVEMENT_ICONS, ACHIEVEMENT_TIERS, TIER_COLORS } from '@/constants/achievements';
import { pickAndUploadAvatar } from '@/lib/uploadAvatar';
import type { MatchResultWithProfiles } from '@/types/database';
import { theme, cardRadius } from '@/constants/theme';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { MatchCard } from '@/components/MatchCard';
import { PhotoViewerModal } from '@/components/PhotoViewerModal';
import type { PostCardData } from '@/lib/queries';
import { divisionProgress } from '@/lib/pairDivisions';

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

const SCREEN_WIDTH = Dimensions.get('window').width;
const MASONRY_GAP = 10;
const MASONRY_PADDING = 16;
const COL_WIDTH = (SCREEN_WIDTH - MASONRY_PADDING * 2 - MASONRY_GAP) / 2;
// Simple deterministic height variation (tall/short alternating-ish by id) so
// the grid reads as Pinterest-style masonry instead of uniform tiles.
function cardHeightFor(id: string, index: number) {
  const seed = (id.charCodeAt(0) + index) % 3;
  return COL_WIDTH * (seed === 0 ? 1.5 : seed === 1 ? 1.2 : 1.35);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isLoading } = useProfile(userId);
  const { data: scrimIndex } = useScrimIndex(userId);
  const updateProfile = useUpdateProfile();
  const { data: myAchievements } = useMyAchievements(userId);
  const { data: stats } = useMyStats(userId);
  const { data: recentResults, isLoading: resultsLoading } = useRecentResults(userId, 20);
  const { data: myPosts, isLoading: postsLoading } = useMyPosts(userId);
  const { data: followerCount } = useFollowerCount(userId);
  const { data: followingCount } = useFollowingCount(userId);
  const { data: records } = usePersonalRecords(userId);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'matches'>('posts');
  const [viewingPhoto, setViewingPhoto] = useState<PostCardData | null>(null);

  function handlePostPress(post: PostCardData) {
    if (post.match_id) {
      router.push(`/match/${post.match_id}` as any);
    } else {
      setViewingPhoto(post);
    }
  }

  if (isLoading || !userId || !profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  async function handlePickAvatar() {
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(userId!);
      if (url) updateProfile.mutate({ id: userId!, avatar_url: url });
    } finally {
      setUploadingAvatar(false);
    }
  }

  const rank = profile ? divisionProgress(profile.elo) : null;

  // "Best" post pinned to the top: most recent win if you have one, else just
  // the most recent post — no separate "likes" data is fetched for the grid.
  const bestPost = myPosts && myPosts.length > 0
    ? myPosts.find((p) => p.matchResult && didWin(p.matchResult, userId!)) ?? myPosts[0]
    : null;
  const restPosts = bestPost ? myPosts!.filter((p) => p.id !== bestPost.id) : myPosts ?? [];

  const recordItems: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }[] = [];
  if (records?.longestWinStreak) {
    recordItems.push({ icon: 'flame', value: `${records.longestWinStreak} wins`, label: 'Longest streak' });
  }
  if (records?.busiestMonth) {
    recordItems.push({ icon: 'calendar', value: `${records.busiestMonth.count} matches`, label: records.busiestMonth.label });
  }
  if (records?.bestEloGain) {
    recordItems.push({ icon: 'flash', value: `+${records.bestEloGain.delta} PS`, label: 'Best PS Score gain' });
  }

  return (
    <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={styles.headerWrapper}>
        <Pressable
          style={({ pressed }) => [styles.settingsCorner, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/settings' as any)}
        >
          <Ionicons name="settings-outline" size={20} color={theme.text} />
        </Pressable>

        <View style={styles.avatarCircleWrap}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarCircle} />
          ) : (
            <View style={styles.avatarCirclePlaceholder}>
              <Image source={require('@/assets/images/icon.png')} style={styles.avatarCirclePlaceholderLogo} resizeMode="contain" />
            </View>
          )}
          <Pressable
            style={({ pressed }) => [styles.cameraBadge, pressed && { transform: [{ scale: 0.95 }] }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={theme.onAccent} />
            ) : (
              <Ionicons name="camera" size={14} color={theme.onAccent} />
            )}
          </Pressable>
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.playerName}>{profile.full_name ?? 'Player'}</Text>
          {profile.is_pro && <ProBadge />}
          {profile.coach_status === 'approved' && <CoachBadge />}
        </View>
        {profile.zone ? <Text style={styles.locationSub}>📍 {profile.zone}</Text> : null}
        {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

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

        <Pressable style={styles.editProfileBtn} onPress={() => router.push('/settings' as any)}>
          <Text style={styles.editProfileBtnText}>EDIT PROFILE</Text>
        </Pressable>

        {/* Stat row */}
        <View style={styles.statsRow}>
          <View style={styles.statColumn}>
            <Text style={styles.statValue}>{myPosts?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <Pressable style={styles.statColumn} onPress={() => router.push(`/social/${userId}?type=followers` as any)}>
            <Text style={styles.statValue}>{followerCount ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <Pressable style={styles.statColumn} onPress={() => router.push(`/social/${userId}?type=following` as any)}>
            <Text style={styles.statValue}>{followingCount ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
          <View style={styles.statColumn}>
            <Text style={[styles.statValue, { color: theme.accent }]}>{profile.elo}</Text>
            <Text style={styles.statLabel}>PS Score</Text>
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

        {myAchievements && myAchievements.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementsRow}>
            {myAchievements.map((item) => {
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
        ) : myPosts && myPosts.length > 0 ? (
          <>
            {bestPost && (
              <View style={styles.pinnedWrap}>
                <View style={styles.pinnedLabel}>
                  <Ionicons name="star" size={11} color={theme.accent} />
                  <Text style={styles.pinnedLabelText}>PINNED</Text>
                </View>
                <MatchCard
                  post={bestPost}
                  posterId={userId}
                  width={SCREEN_WIDTH - MASONRY_PADDING * 2}
                  height={260}
                  onPress={() => handlePostPress(bestPost)}
                />
              </View>
            )}
            <View style={styles.masonryRow}>
              <View style={styles.masonryCol}>
                {restPosts.filter((_, i) => i % 2 === 0).map((p, i) => (
                  <MatchCard
                    key={p.id}
                    post={p}
                    posterId={userId}
                    width={COL_WIDTH}
                    height={cardHeightFor(p.id, i)}
                    onPress={() => handlePostPress(p)}
                  />
                ))}
              </View>
              <View style={styles.masonryCol}>
                {restPosts.filter((_, i) => i % 2 === 1).map((p, i) => (
                  <MatchCard
                    key={p.id}
                    post={p}
                    posterId={userId}
                    width={COL_WIDTH}
                    height={cardHeightFor(p.id, i + 1)}
                    onPress={() => handlePostPress(p)}
                  />
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyTab}>
            <Ionicons name="camera-outline" size={32} color={theme.textMuted} />
            <Text style={styles.emptyTabText}>Share a photo from your last match</Text>
            <Pressable style={styles.emptyTabBtn} onPress={() => router.push('/post/new' as any)}>
              <Text style={styles.emptyTabBtnText}>NEW POST</Text>
            </Pressable>
          </View>
        )
      ) : resultsLoading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: 30 }} />
      ) : recentResults && recentResults.length > 0 ? (
        <View style={styles.matchesList}>
          {recentResults.map((r) => {
            const win = didWin(r, userId);
            const opponent = opponentProfile(r, userId);
            return (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/match/${r.match_id || r.id}` as any)}
                style={({ pressed }) => [styles.matchRow, pressed && { opacity: 0.8 }]}
              >
                <View style={[styles.matchResultDot, { backgroundColor: win ? theme.success : theme.danger }]} />
                <Text style={styles.matchOpponent} numberOfLines={1}>vs {opponent?.full_name ?? 'Player'}</Text>
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
      <PhotoViewerModal
        visible={!!viewingPhoto}
        photoUrl={viewingPhoto?.photo_url ?? null}
        caption={viewingPhoto?.caption}
        onClose={() => setViewingPhoto(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centerContainer: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  headerWrapper: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  settingsCorner: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  avatarCircleWrap: { width: 96, height: 96, marginBottom: 10 },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: theme.accent },
  avatarCirclePlaceholder: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: theme.accent,
    backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center',
  },
  avatarCirclePlaceholderLogo: { width: 48, height: 48, opacity: 0.5 },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 12,
    backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: theme.background,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  playerName: { fontFamily: 'Anton_400Regular', fontSize: 20, color: theme.text, letterSpacing: -0.3 },
  locationSub: { fontSize: 12, fontWeight: '600', color: theme.textMuted, marginBottom: 6 },
  bioText: { color: theme.text, fontSize: 12, textAlign: 'center', marginBottom: 8, lineHeight: 17, paddingHorizontal: 16 },
  badgeChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  rankChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(198, 255, 51, 0.3)',
    backgroundColor: 'rgba(198, 255, 51, 0.08)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  rankChipText: { color: theme.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  outlinedBadge: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  outlinedBadgeText: { color: theme.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  editProfileBtn: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 24,
    marginBottom: 14,
  },
  editProfileBtnText: { color: theme.text, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  pinnedWrap: { paddingHorizontal: MASONRY_PADDING, marginBottom: MASONRY_GAP },
  pinnedLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  pinnedLabelText: { color: theme.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
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
  achievementBadge: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.border },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: theme.accent },
  masonryRow: { flexDirection: 'row', gap: MASONRY_GAP, paddingHorizontal: MASONRY_PADDING, paddingTop: 4 },
  masonryCol: { flex: 1, gap: MASONRY_GAP },
  emptyTab: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, gap: 10 },
  emptyTabText: { color: theme.textMuted, fontSize: 12, fontWeight: '600' },
  emptyTabBtn: { backgroundColor: theme.primary, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 8, marginTop: 4 },
  emptyTabBtnText: { color: theme.onAccent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  matchesList: { paddingBottom: 110 },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  matchResultDot: { width: 8, height: 8, borderRadius: 4 },
  matchOpponent: { flex: 1, color: theme.text, fontSize: 13, fontWeight: '700' },
  matchScore: { color: theme.textMuted, fontSize: 12, fontWeight: '600' },
});
