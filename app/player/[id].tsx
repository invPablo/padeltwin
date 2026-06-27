import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import { useQueryClient } from '@tanstack/react-query';
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
} from '@/lib/queries';
import { ACHIEVEMENT_LABELS, ACHIEVEMENT_ICONS } from '@/constants/achievements';
import { LEVEL_LABELS } from '@/constants/levels';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { ELO_PROVISIONAL_MATCHES, isEloProvisional } from '@/constants/elo';
import { theme, buttonRadius, cardRadius, chipRadius } from '@/constants/theme';
import type { PartnerRequestWithProfiles, Profile, MatchResultWithProfiles } from '@/types/database';

function requestWith(requests: PartnerRequestWithProfiles[], userId: string, otherId: string) {
  return requests.find(
    (r) => (r.from_id === userId && r.to_id === otherId) || (r.from_id === otherId && r.to_id === userId)
  );
}

function didWin(result: MatchResultWithProfiles, playerId: string) {
  const inTeamA = result.team_a_player1 === playerId || result.team_a_player2 === playerId;
  return (inTeamA && result.winner === 'a') || (!inTeamA && result.winner === 'b');
}

function opponents(result: MatchResultWithProfiles, playerId: string) {
  const inTeamA = result.team_a_player1 === playerId || result.team_a_player2 === playerId;
  const rivals = inTeamA
    ? [result.team_b_player1_profile, result.team_b_player2_profile]
    : [result.team_a_player1_profile, result.team_a_player2_profile];
  return rivals.map((p) => p?.full_name ?? 'Player').join(' / ');
}

function formatRelativeTime(dateString: string) {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function PlayerProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const currentUserId = session?.user.id;

  // Queries
  const { data: profile, isLoading: profileLoading } = useProfile(id);
  const { data: stats, isLoading: statsLoading } = useMyStats(id);
  const { data: recentResults, isLoading: resultsLoading } = useRecentResults(id, 8);
  const { data: achievements } = useMyAchievements(id);
  const { data: following } = useFollowing(currentUserId);
  const { data: requests } = usePartnerRequests(currentUserId);
  const { data: followerCount } = useFollowerCount(id);
  const { data: followingCount } = useFollowingCount(id);

  // Mutations
  const followPlayer = useFollowPlayer();
  const unfollowPlayer = useUnfollowPlayer();
  const sendRequest = useSendPartnerRequest();

  const isCalibrating = isEloProvisional(stats?.played ?? 0);
  const miniAnimatedHeights = useRef(Array.from({ length: 4 }).map(() => new Animated.Value(4))).current;

  useEffect(() => {
    if (!isCalibrating) return;
    const animations = miniAnimatedHeights.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 80),
          Animated.timing(anim, { toValue: 28, duration: 400, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 4, duration: 400, useNativeDriver: false }),
        ])
      )
    );
    Animated.parallel(animations).start();
    return () => miniAnimatedHeights.forEach((anim) => anim.stopAnimation());
  }, [isCalibrating]);

  if (profileLoading || !profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF7F37" />
      </View>
    );
  }

  const isSelf = id === currentUserId;
  const isFollowing = following?.has(id);
  const followPending = followPlayer.isPending || unfollowPlayer.isPending;

  const handleFollowPress = () => {
    if (!currentUserId || followPending) return;
    if (isFollowing) {
      unfollowPlayer.mutate(
        { followerId: currentUserId, followedId: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["following"] });
            queryClient.invalidateQueries({ queryKey: ["followedProfiles"] });
            queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
          },
        }
      );
    } else {
      followPlayer.mutate(
        { followerId: currentUserId, followedId: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["following"] });
            queryClient.invalidateQueries({ queryKey: ["followedProfiles"] });
            queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
          },
        }
      );
    }
  };

  // Connection Request status
  const existing = currentUserId && requests ? requestWith(requests, currentUserId, id) : undefined;
  let connectLabel = 'CONNECT';
  let connectDisabled = false;
  let connectColor = '#FF7F37';
  let isConnected = false;

  if (existing) {
    if (existing.status === 'pending') {
      connectLabel = 'PENDING';
      connectDisabled = true;
      connectColor = '#8E8E93';
    } else if (existing.status === 'accepted') {
      connectLabel = 'CONNECTED';
      connectDisabled = true;
      connectColor = '#34C759';
      isConnected = true;
    } else {
      connectLabel = 'DECLINED';
      connectDisabled = true;
      connectColor = '#8E8E93';
    }
  }

  const handleConnectPress = () => {
    if (!currentUserId || existing || sendRequest.isPending || isSelf) return;
    sendRequest.mutate({ fromId: currentUserId, toId: id });
  };

  const handleMessagePress = () => {
    if (existing?.status === 'accepted') {
      router.push({
        pathname: '/chat/[requestId]',
        params: { requestId: existing.id },
      });
    }
  };

  const initials = (profile.full_name ?? 'Player').slice(0, 2).toUpperCase();

  return (
    <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
      
      {/* 1. CURVED PHOTO COVER */}
      <View style={styles.headerWrapper}>
        <View style={styles.bannerContainer}>
          {profile.avatar_url ? (
            <ImageBackground 
              source={{ uri: profile.avatar_url }} 
              style={styles.bannerImage}
              imageStyle={{ borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }}
            >
              <View style={styles.bannerOverlay} />
            </ImageBackground>
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Text style={styles.bannerPlaceholderText}>{initials}</Text>
              <View style={styles.bannerOverlay} />
            </View>
          )}

          {/* Top Bar Navigation Icons */}
          <View style={styles.headerNav}>
            <Pressable style={styles.navIconBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color="#FFF" />
            </Pressable>

            {isSelf ? (
              <Pressable style={styles.navIconBtn} onPress={() => router.navigate('/profile')}>
                <Ionicons name="settings-sharp" size={18} color="#FFF" />
              </Pressable>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
        </View>

        {/* 2. THREE FLOATING BUTTONS */}
        <View style={styles.actionRowFloating}>
          {/* Left Button: Heart (Follow) */}
          <Pressable 
            style={({ pressed }) => [
              styles.smallActionBtn,
              pressed && { scale: 0.95 } as any
            ]} 
            disabled={followPending || isSelf}
            onPress={handleFollowPress}
          >
            <Ionicons 
              name={isFollowing ? "heart" : "heart-outline"} 
              size={20} 
              color={isFollowing ? "#FF7F37" : "#FFF"} 
            />
          </Pressable>

          {/* Center Button: Connect (Primary Phone-Style Icon) */}
          <Pressable 
            style={({ pressed }) => [
              styles.largeActionBtn,
              { backgroundColor: connectColor },
              (connectDisabled || isSelf) && { opacity: 0.9 },
              pressed && !(connectDisabled || isSelf) && { scale: 0.95 } as any
            ]}
            disabled={connectDisabled || sendRequest.isPending || isSelf}
            onPress={handleConnectPress}
          >
            {sendRequest.isPending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="people" size={26} color="#FFF" />
            )}
          </Pressable>

          {/* Right Button: Message (Chat) */}
          <Pressable 
            style={({ pressed }) => [
              styles.smallActionBtn,
              !isConnected && styles.smallActionBtnDisabled,
              pressed && isConnected && { scale: 0.95 } as any
            ]}
            disabled={!isConnected}
            onPress={handleMessagePress}
          >
            <Ionicons 
              name="chatbubble" 
              size={20} 
              color={isConnected ? "#FF7F37" : "rgba(255, 255, 255, 0.25)"} 
            />
          </Pressable>
        </View>
      </View>

      {/* WHITE HIGH-CONTRAST BODY */}
      <View style={styles.contentBody}>
        
        {/* 3. TWO BADGES / PILLS */}
        <View style={styles.badgeRow}>
          <View style={styles.outlinedBadge}>
            <Text style={styles.outlinedBadgeText}>
              {profile.level ? LEVEL_LABELS[profile.level].toUpperCase() : 'NO LEVEL'}
            </Text>
          </View>
          {profile.looking_for_partner && (
            <View style={styles.outlinedBadge}>
              <Text style={styles.outlinedBadgeText}>LOOKING FOR PARTNER</Text>
            </View>
          )}
        </View>

        {/* 4. NAME */}
        <View style={styles.nameRow}>
          <Text style={styles.playerName}>
            {profile.full_name ?? 'Player'}
          </Text>
          {profile.is_pro && <ProBadge />}
          {profile.coach_status === 'approved' && <CoachBadge />}
        </View>

        {profile.zone && (
          <Text style={styles.locationSub}>
            📍 {profile.zone.toUpperCase()}
          </Text>
        )}

        {/* 5. SPLIT STATS CARD */}
        <View style={styles.statsCardContainer}>
          <View style={styles.statColumn}>
            {isCalibrating ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 }}>
                  {miniAnimatedHeights.map((anim, index) => (
                    <Animated.View
                      key={index}
                      style={{ width: 4, height: anim, backgroundColor: theme.accent, borderRadius: 2 }}
                    />
                  ))}
                </View>
                <Text style={styles.statSubLabel}>
                  Calibrating • {stats?.played ?? 0}/{ELO_PROVISIONAL_MATCHES}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.statHugeText}>{profile.elo ?? 1200}</Text>
                <Text style={styles.statSubLabel}>ELO Rating</Text>
              </>
            )}
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statColumn}>
            <Text style={styles.statHugeText}>{stats?.played ?? 0}</Text>
            <Text style={styles.statSubLabel}>Matches Played</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statColumn}>
            <Text style={styles.statHugeText}>{stats?.winRate ?? 0}%</Text>
            <Text style={styles.statSubLabel}>Win Rate</Text>
          </View>
        </View>

        {/* SOCIAL */}
        <View style={styles.socialStatsRow}>
          <Pressable
            style={({ pressed }) => [styles.socialStatColumn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(`/social/${id}?type=followers` as any)}
          >
            <Text style={styles.socialStatValue}>{followerCount ?? 0}</Text>
            <Text style={styles.socialStatLabel}>Followers</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.socialStatColumn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(`/social/${id}?type=following` as any)}
          >
            <Text style={styles.socialStatValue}>{followingCount ?? 0}</Text>
            <Text style={styles.socialStatLabel}>Following</Text>
          </Pressable>
        </View>

        {/* 6. REVIEWS / RECENT MATCHES SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent matches</Text>
          <Text style={styles.seeAllBtn}>See All</Text>
        </View>

        {/* Horizontal scroll of reviews / match cards */}
        {resultsLoading ? (
          <ActivityIndicator color="#FF7F37" style={{ marginTop: 12 }} />
        ) : recentResults && recentResults.length > 0 ? (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.horizontalScroll}
          >
            {recentResults.slice(0, 5).map((r) => {
              const win = didWin(r, id);
              const opponentProfile = win 
                ? (r.team_b_player1 === id ? r.team_a_player1_profile : r.team_b_player1_profile)
                : (r.team_a_player1 === id ? r.team_b_player1_profile : r.team_a_player1_profile);
              
              const opponentName = opponentProfile?.full_name ?? 'Padel Player';
              const opponentAvatar = opponentProfile?.avatar_url;
              const scoreString = r.sets.map(s => `${s.a}-${s.b}`).join(', ');

              return (
                <View key={r.id} style={styles.horizontalReviewCard}>
                  <View style={styles.cardHeaderRow}>
                    {/* Small avatar on left */}
                    {opponentAvatar ? (
                      <Image source={{ uri: opponentAvatar }} style={styles.smallAvatar} />
                    ) : (
                      <View style={styles.smallAvatarPlaceholder}>
                        <Text style={styles.smallAvatarPlaceholderText}>
                          {opponentName.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    
                    {/* Name & Details Column */}
                    <View style={styles.cardInfoCol}>
                      <Text style={styles.cardOpponentName} numberOfLines={1}>
                        {opponentName}
                      </Text>
                      <View style={styles.cardRatingRow}>
                        <Ionicons name="trophy" size={11} color="#FF7F37" style={{ marginRight: 4 }} />
                        <Text style={styles.cardResultText}>
                          {win ? 'Won' : 'Lost'} {scoreString}
                        </Text>
                        <Text style={styles.cardTimeText}>
                          {"  "}•{"  "}{formatRelativeTime(r.created_at)}
                        </Text>
                      </View>
                    </View>

                    {/* Three dots button */}
                    <Ionicons name="ellipsis-vertical" size={16} color="#8E8E93" />
                  </View>

                  {/* Comment/vs text */}
                  <Text style={styles.cardBodyText} numberOfLines={3}>
                    Played a competitive doubles match in {profile.zone ?? 'local zone'}. {win ? 'Great performance securing a solid victory with consistent points.' : 'Tough match, fought hard but opponent played key points better.'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No match results recorded yet.</Text>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background, // Dark Theme background
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrapper: {
    position: 'relative',
    width: '100%',
    zIndex: 10,
    backgroundColor: theme.background,
  },
  bannerContainer: {
    height: 320,
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E24',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  bannerPlaceholderText: {
    fontSize: 72,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.15)',
    letterSpacing: 2,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  headerNav: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  navIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  actionRowFloating: {
    position: 'absolute',
    bottom: -28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 30,
  },
  smallActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  smallActionBtnDisabled: {
    opacity: 0.3,
  },
  largeActionBtn: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7F37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  contentBody: {
    flex: 1,
    backgroundColor: theme.background,
    paddingTop: 48,
    paddingBottom: 40,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  outlinedBadge: {
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  outlinedBadgeText: {
    color: theme.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  locationSub: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 24,
  },
  statsCardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginHorizontal: 24,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statHugeText: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
  },
  statSubLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1.5,
    height: 32,
    backgroundColor: theme.border,
  },
  socialStatsRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 10 },
  socialStatColumn: { alignItems: 'center' },
  socialStatValue: { fontSize: 15, fontWeight: '800', color: theme.text },
  socialStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
  },
  seeAllBtn: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF7F37',
  },
  horizontalScroll: {
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 24,
  },
  horizontalReviewCard: {
    width: 290,
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  smallAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  smallAvatarPlaceholderText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.textMuted,
  },
  cardInfoCol: {
    flex: 1,
  },
  cardOpponentName: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
  },
  cardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cardResultText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.text,
  },
  cardTimeText: {
    fontSize: 9,
    fontWeight: '500',
    color: theme.textMuted,
  },
  cardBodyText: {
    fontSize: 11,
    color: theme.textMuted,
    lineHeight: 16,
  },
  emptyText: {
    paddingHorizontal: 24,
    color: theme.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
