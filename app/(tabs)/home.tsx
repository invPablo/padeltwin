import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import {
  useProfile,
  useMyStats,
  useRecentResults,
  useLeaderboard,
  useMyUpcomingMatches,
  usePartnerRequests,
  useActivityFeed,
  useMyLeagues,
  useFollowing,
  useFollowPlayer,
  useCompatiblePlayers,
  useToggleVib,
  useFollowedLeaderboard,
  type FeedItem,
} from '@/lib/queries';
import { ACHIEVEMENT_LABELS, ACHIEVEMENT_ICONS } from '@/constants/achievements';
import type { MatchResultWithProfiles, Profile } from '@/types/database';
import { theme, cardRadius } from '@/constants/theme';
import { ELO_PROVISIONAL_MATCHES } from '@/constants/elo';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';

function didWin(result: MatchResultWithProfiles, userId: string) {
  const inTeamA = result.team_a_player1 === userId || result.team_a_player2 === userId;
  return (inTeamA && result.winner === 'a') || (!inTeamA && result.winner === 'b');
}

function opponents(result: MatchResultWithProfiles, userId: string) {
  const inTeamA = result.team_a_player1 === userId || result.team_a_player2 === userId;
  const rivals = inTeamA
    ? [result.team_b_player1_profile, result.team_b_player2_profile]
    : [result.team_a_player1_profile, result.team_a_player2_profile];
  return rivals.map((p) => p?.full_name ?? 'Player').join(' / ');
}

function teamLabel(p1: MatchResultWithProfiles['team_a_player1_profile'], p2: typeof p1) {
  return [p1?.full_name, p2?.full_name].filter(Boolean).join(' & ') || 'Players';
}

function scoreline(result: MatchResultWithProfiles) {
  return result.sets.map((s) => `${s.a}-${s.b}`).join(', ');
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

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: stats, isLoading: statsLoading } = useMyStats(userId);
  const { data: recentResults, isLoading: resultsLoading } = useRecentResults(userId, 8);
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard(profile?.zone);
  const { data: upcomingMatches, isLoading: upcomingLoading } = useMyUpcomingMatches(userId);
  const { data: partnerRequests } = usePartnerRequests(userId);
  const { data: activityFeed, isLoading: feedLoading } = useActivityFeed(userId, 5);
  const { data: myLeagues, isLoading: leaguesLoading } = useMyLeagues(userId);
  const { data: following } = useFollowing(userId);
  const { data: compatiblePlayers } = useCompatiblePlayers(userId, profile);
  const { data: followedLeaderboard } = useFollowedLeaderboard(userId);
  const followPlayer = useFollowPlayer();
  const toggleVib = useToggleVib();
  const pendingRequestsCount = (partnerRequests ?? []).filter((r) => r.status === 'pending' && r.to_id === userId).length;

  const suggestedFollows: Profile[] = (compatiblePlayers ?? [])
    .filter((p) => !following?.has(p.id))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 6);

  function handleToggleVib(item: FeedItem) {
    if (!userId) return;
    toggleVib.mutate({ profileId: userId, itemType: item.kind, itemId: item.id, currentlyVibbed: item.vibbedByMe });
  }

  function handleQuickFollow(followedId: string) {
    if (!userId) return;
    followPlayer.mutate({ followerId: userId, followedId });
  }

  const animatedHeights = useRef(Array.from({ length: 8 }).map(() => new Animated.Value(8))).current;
  const miniAnimatedHeights = useRef(Array.from({ length: 4 }).map(() => new Animated.Value(4))).current;

  // Reconstruct player ELO history from recent results
  const currentElo = profile?.elo ?? 1200;
  const historyPoints: number[] = [currentElo];
  if (userId && recentResults) {
    let tempElo = currentElo;
    const delta = 15; // standard Elo step per match
    for (let i = 0; i < recentResults.length; i++) {
      const res = recentResults[i];
      const won = didWin(res, userId);
      if (won) {
        tempElo -= delta;
      } else {
        tempElo += delta;
      }
      historyPoints.push(tempElo);
    }
  }

  // Reverse so historyPoints flows chronologically (oldest to newest)
  historyPoints.reverse();

  // Pad to ensure we have exactly 8 elements for the chart bars
  while (historyPoints.length < 8) {
    const first = historyPoints[0] ?? 1200;
    historyPoints.unshift(first);
  }

  const last8Points = historyPoints.slice(-8);
  const minElo = Math.min(...last8Points);
  const maxElo = Math.max(...last8Points);
  const eloRange = maxElo - minElo;

  const minHeight = 8;
  const maxHeight = 54;
  const chartBars = last8Points.map((val, idx) => {
    let height = 24; // default height if no range/fluctuation exists
    if (eloRange > 0) {
      height = minHeight + ((val - minElo) / eloRange) * (maxHeight - minHeight);
    }
    const isUpward = idx > 0 && val > last8Points[idx - 1];
    return {
      height,
      color: isUpward ? theme.primary : '#22242E'
    };
  });

  // Calculate Streak
  let streak = 0;
  let streakType: 'W' | 'L' | null = null;
  if (userId && recentResults && recentResults.length > 0) {
    for (let i = 0; i < recentResults.length; i++) {
      const won = didWin(recentResults[i], userId);
      if (i === 0) {
        streakType = won ? 'W' : 'L';
        streak = 1;
      } else {
        const currentType = won ? 'W' : 'L';
        if (currentType === streakType) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  // Find next upcoming match
  const nextMatch = upcomingMatches && upcomingMatches.length > 0 ? upcomingMatches[0] : null;
  
  // Calculate win probability for the next match
  let winProb = 50;
  if (profile && nextMatch) {
    const nextMatchPlayers = nextMatch.match_players ?? [];
    const otherElos = nextMatchPlayers
      .map((p: any) => p.profiles?.elo)
      .filter((e: any) => typeof e === 'number' && e > 0);
    if (otherElos.length > 0) {
      const avgOtherElo = otherElos.reduce((a: number, b: number) => a + b, 0) / otherElos.length;
      const diff = (profile.elo ?? 1200) - avgOtherElo;
      winProb = Math.max(20, Math.min(80, Math.round(50 + diff / 8)));
    }
  }

  // Dynamic Badges configuration
  // 1. Total Matches Badge
  const playedCount = stats?.played ?? 0;
  const isCalibrating = playedCount < ELO_PROVISIONAL_MATCHES;

  useEffect(() => {
    if (!isCalibrating) return;
    const animations = animatedHeights.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.timing(anim, {
            toValue: 36,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 8,
            duration: 500,
            useNativeDriver: false,
          }),
        ])
      );
    });

    const miniAnimations = miniAnimatedHeights.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 80),
          Animated.timing(anim, {
            toValue: 28,
            duration: 400,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 4,
            duration: 400,
            useNativeDriver: false,
          }),
        ])
      );
    });

    Animated.parallel([...animations, ...miniAnimations]).start();
    return () => {
      animatedHeights.forEach((anim) => anim.stopAnimation());
      miniAnimatedHeights.forEach((anim) => anim.stopAnimation());
    };
  }, [isCalibrating]);

  let matchesBadgeText = '💤 INACTIVE';
  let matchesBadgeColor = 'rgba(110, 112, 126, 0.1)';
  let matchesBadgeTextColor = theme.textMuted;
  if (playedCount > 0 && playedCount < ELO_PROVISIONAL_MATCHES) {
    matchesBadgeText = '🌱 STARTING';
    matchesBadgeColor = 'rgba(46, 157, 255, 0.1)';
    matchesBadgeTextColor = theme.secondary;
  } else if (playedCount >= 5 && playedCount < 15) {
    matchesBadgeText = '🔥 ACTIVE';
    matchesBadgeColor = 'rgba(46, 157, 255, 0.1)';
    matchesBadgeTextColor = theme.secondary;
  } else if (playedCount >= 15) {
    matchesBadgeText = '⚡ VETERAN';
    matchesBadgeColor = 'rgba(255, 92, 0, 0.15)';
    matchesBadgeTextColor = theme.primary;
  }

  // 2. Win Rate Badge
  const winRate = stats?.winRate ?? 0;
  let winRateBadgeText = '⚔️ CONTENDING';
  let winRateBadgeColor = 'rgba(110, 112, 126, 0.1)';
  let winRateBadgeTextColor = theme.textMuted;
  if (playedCount > 0) {
    if (winRate >= 60) {
      winRateBadgeText = '🏆 DOMINATING';
      winRateBadgeColor = 'rgba(0, 230, 118, 0.1)';
      winRateBadgeTextColor = theme.success;
    } else if (winRate >= 45) {
      winRateBadgeText = '⚖️ BALANCED';
      winRateBadgeColor = 'rgba(46, 157, 255, 0.1)';
      winRateBadgeTextColor = theme.secondary;
    } else {
      winRateBadgeText = '⚠️ CHALLENGED';
      winRateBadgeColor = 'rgba(255, 92, 0, 0.1)';
      winRateBadgeTextColor = theme.primary;
    }
  }

  // 3. Zone Percentile Badge
  let percentileBadgeText = '⚓ CHALLENGER';
  let percentileBadgeColor = 'rgba(110, 112, 126, 0.1)';
  let percentileBadgeTextColor = theme.textMuted;
  if (isCalibrating) {
    percentileBadgeText = '⚓ CALIBRATING';
  } else if (leaderboard && profile) {
    const userIdx = leaderboard.findIndex((p) => p.id === userId);
    const topElo = leaderboard[0]?.elo ?? 1500;
    const userElo = profile.elo ?? 1200;
    const ratio = userElo / topElo;
    if (userIdx !== -1 && userIdx < 3) {
      percentileBadgeText = '👑 ELITE';
      percentileBadgeColor = 'rgba(255, 92, 0, 0.15)';
      percentileBadgeTextColor = theme.primary;
    } else if (ratio >= 0.85) {
      percentileBadgeText = '🎯 ADVANCED';
      percentileBadgeColor = 'rgba(255, 92, 0, 0.1)';
      percentileBadgeTextColor = theme.primary;
    } else if (ratio >= 0.70) {
      percentileBadgeText = '🛡️ COMPETITIVE';
      percentileBadgeColor = 'rgba(46, 157, 255, 0.1)';
      percentileBadgeTextColor = theme.secondary;
    }
  }

  // Calculate Zone Percentile or Rank Label
  let rankLabel = "TOP 25%";
  if (isCalibrating) {
    rankLabel = "UNRANKED";
  } else if (leaderboard && profile) {
    const userIdx = leaderboard.findIndex((p) => p.id === userId);
    if (userIdx !== -1) {
      rankLabel = `#${userIdx + 1} REG`;
    } else {
      const topElo = leaderboard[0]?.elo ?? 1500;
      const userElo = profile.elo ?? 1200;
      const ratio = userElo / topElo;
      if (ratio >= 0.95) rankLabel = "TOP 5%";
      else if (ratio >= 0.90) rankLabel = "TOP 10%";
      else if (ratio >= 0.80) rankLabel = "TOP 15%";
      else rankLabel = "TOP 50%";
    }
  }

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.welcomeTag}>PADEL PERFORMANCE TRACKER</Text>
        <Text style={styles.title}>HI{profile?.full_name ? `, ${profile.full_name.split(' ')[0].toUpperCase()}` : ''} 👋</Text>
      </View>

      {/* Partner Requests Alert Notification */}
      {pendingRequestsCount > 0 && (
        <Pressable 
          style={({ pressed }) => [
            styles.partnerAlertBanner,
            pressed && { opacity: 0.95 }
          ]}
          onPress={() => router.push('/profile')}
        >
          <View style={styles.partnerAlertLeft}>
            <Ionicons name="people" size={18} color={theme.secondary} />
            <Text style={styles.partnerAlertText}>
              ⚡ {pendingRequestsCount} PENDING PARTNER REQUEST{pendingRequestsCount > 1 ? 'S' : ''}
            </Text>
          </View>
          <View style={styles.partnerAlertRight}>
            <Text style={styles.partnerAlertActionText}>REVIEW</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.secondary} style={{ marginLeft: 2 }} />
          </View>
        </Pressable>
      )}

      {/* Next Match Deployment Widget */}
      {upcomingLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: 10 }} />
      ) : nextMatch ? (
        <Pressable 
          style={({ pressed }) => [
            styles.nextMatchCard,
            pressed && { opacity: 0.9 }
          ]}
          onPress={() => router.push(`/match/${nextMatch.id}`)}
        >
          <View style={styles.nextMatchHeader}>
            <Text style={styles.nextMatchTag}>⚡ NEXT MATCH</Text>
            <View style={[styles.gridBadge, { backgroundColor: 'rgba(255, 92, 0, 0.15)', marginTop: 0 }]}>
              <Text style={[styles.gridBadgeText, { color: theme.primary }]}>CONFIRMED</Text>
            </View>
          </View>
          <Text style={styles.nextMatchLocation}>{nextMatch.location}</Text>
          <Text style={styles.nextMatchTime}>
            📅 {new Date(nextMatch.date_time).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }).toUpperCase()} • {new Date(nextMatch.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.nextMatchFooter}>
            <Text style={styles.nextMatchProbability}>
              WIN PROBABILITY: <Text style={{ color: '#fff', fontWeight: '900' }}>{winProb}%</Text>
            </Text>
            <Text style={styles.nextMatchRosterText}>
              PLAYERS: <Text style={{ color: '#fff', fontWeight: '900' }}>{(nextMatch.match_players?.length ?? 0)}/{(nextMatch.max_players ?? 4)} SIGNED UP</Text>
            </Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.nextMatchCardEmpty}>
          <Text style={styles.nextMatchTagEmpty}>NO UPCOMING MATCHES</Text>
          <Text style={styles.nextMatchTextEmpty}>Your court schedule is clear. Check the match feed to join an active game or set up a new match request.</Text>
          <View style={styles.emptyCardActions}>
            <Pressable 
              style={[styles.emptyCardButton, { backgroundColor: theme.primary }]} 
              onPress={() => router.push('/')}
            >
              <Ionicons name="search" size={13} color={theme.onAccent} />
              <Text style={styles.emptyCardButtonText}>FIND A MATCH</Text>
            </Pressable>
            <Pressable 
              style={[styles.emptyCardButton, { borderColor: theme.border, borderWidth: 1 }]} 
              onPress={() => router.push('/create-match')}
            >
              <Ionicons name="add-circle" size={13} color={theme.textMuted} />
              <Text style={[styles.emptyCardButtonText, { color: theme.textMuted }]}>CREATE MATCH</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Main ELO Performance Widget */}
      <View style={styles.eloPerformanceCard}>
        <View style={styles.eloHeader}>
          <Text style={styles.widgetTag}>CURRENT RANKING</Text>
          <View style={isCalibrating ? { backgroundColor: 'rgba(110, 112, 126, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 } : styles.badgeOrange}>
            <Text style={isCalibrating ? { color: theme.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 } : styles.badgeOrangeText}>
              {isCalibrating ? 'CALIBRATING' : 'PRO LEVEL'}
            </Text>
          </View>
        </View>
        <View style={styles.eloContent}>
          {isCalibrating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48 }}>
              <Text style={[styles.eloHuge, { fontSize: 26, letterSpacing: -0.5, lineHeight: 48 }]}>CALIBRATING</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 30, paddingBottom: 6 }}>
                {miniAnimatedHeights.map((anim, index) => (
                  <Animated.View 
                    key={index} 
                    style={{
                      width: 5,
                      height: anim,
                      backgroundColor: theme.primary,
                      borderRadius: 2.5,
                    }}
                  />
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.eloHuge}>{profile?.elo ?? '1200'}</Text>
          )}
          <Text style={styles.eloLabel}>
            {isCalibrating ? `CALIBRATING ELO • ${playedCount}/${ELO_PROVISIONAL_MATCHES} MATCHES` : 'PADEL ELO RATING'}
          </Text>
        </View>
        <View style={styles.chartSimulation}>
          {/* Stylized telemetry bar chart representing ELO fluctuations */}
          {chartBars.map((bar, index) => {
            const barHeight = isCalibrating ? animatedHeights[index] : bar.height;
            return (
              <Animated.View 
                key={index} 
                style={[
                  styles.chartBar, 
                  { 
                    height: barHeight, 
                    backgroundColor: isCalibrating ? 'rgba(255, 92, 0, 0.4)' : bar.color 
                  }
                ]} 
              />
            );
          })}
        </View>
      </View>

      {/* Stats Detail Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.gridCard}>
          <Text style={styles.gridCardLabel}>TOTAL MATCHES</Text>
          {statsLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={styles.gridCardValue}>{stats?.played ?? 0}</Text>
          )}
          <View style={[styles.gridBadge, { backgroundColor: matchesBadgeColor }]}>
            <Text style={[styles.gridBadgeText, { color: matchesBadgeTextColor }]}>{matchesBadgeText}</Text>
          </View>
        </View>

        <View style={styles.gridCard}>
          <Text style={styles.gridCardLabel}>WINNING RATE</Text>
          {statsLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={styles.gridCardValue}>{stats?.winRate ?? 0}%</Text>
          )}
          <View style={[styles.gridBadge, { backgroundColor: winRateBadgeColor }]}>
            <Text style={[styles.gridBadgeText, { color: winRateBadgeTextColor }]}>{winRateBadgeText}</Text>
          </View>
        </View>
      </View>

      {/* Performance Insights - Stats Grid Row 2 */}
      <View style={[styles.statsGrid, { marginTop: -4 }]}>
        <View style={styles.gridCard}>
          <Text style={styles.gridCardLabel}>CURRENT STREAK</Text>
          {resultsLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={styles.gridCardValue}>{streak}{streakType ?? 'W'}</Text>
          )}
          <View 
            style={[
              styles.gridBadge, 
              { 
                backgroundColor: streakType === 'W' ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 59, 48, 0.1)' 
              }
            ]}
          >
            <Text 
              style={[
                styles.gridBadgeText, 
                { 
                  color: streakType === 'W' ? theme.success : theme.danger 
                }
              ]}
            >
              {streakType === 'W' ? '📈 WINNING STREAK' : '📉 ADJUSTING'}
            </Text>
          </View>
        </View>

        <View style={styles.gridCard}>
          <Text style={styles.gridCardLabel}>ZONE PERCENTILE</Text>
          {leaderboardLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Text style={styles.gridCardValue}>{rankLabel}</Text>
          )}
          <View style={[styles.gridBadge, { backgroundColor: percentileBadgeColor }]}>
            <Text style={[styles.gridBadgeText, { color: percentileBadgeTextColor }]}>{percentileBadgeText}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>RECENT MATCHES</Text>
      {resultsLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
      ) : recentResults && recentResults.length > 0 ? (
        recentResults.slice(0, 5).map((r) => {
          const win = didWin(r, userId!);
          return (
            <View key={r.id} style={styles.resultCard}>
              <View style={styles.resultRow}>
                <View style={styles.opponentWrapper}>
                  <Text style={styles.vsTag}>VS</Text>
                  <Text style={styles.resultOpponent} numberOfLines={1}>
                    {opponents(r, userId!).toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.resultBadge, win ? styles.winBadge : styles.lossBadge]}>
                  <Text style={[styles.resultBadgeText, win ? styles.winText : styles.lossText]}>
                    {win ? 'WIN' : 'LOSS'}
                  </Text>
                </View>
              </View>
              <View style={styles.resultCardFooter}>
                <View style={styles.setScoresRow}>
                  {r.sets.map((s, idx) => (
                    <View key={idx} style={[styles.scoreBox, win ? styles.scoreBoxWin : null]}>
                      <Text style={[styles.scoreText, win ? styles.scoreTextWin : null]}>{s.a}-{s.b}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.matchTypeTag}>DOUBLES MATCH</Text>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.empty}>No recorded match results found in your zone.</Text>
      )}

      <Text style={styles.sectionTitle}>ACTIVITY FEED</Text>
      {feedLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
      ) : activityFeed && activityFeed.length > 0 ? (
        <View style={styles.feedContainer}>
          {activityFeed.map((item) => {
            let iconName: string;
            let avatarProfile: Profile | null | undefined;
            let primaryText: string;
            let secondaryText: string;

            if (item.kind === 'achievement') {
              iconName = ACHIEVEMENT_ICONS[item.type] || 'trophy';
              avatarProfile = item.profiles;
              primaryText = (item.profiles?.full_name ?? 'Player').toUpperCase();
              secondaryText = ACHIEVEMENT_LABELS[item.type] || 'New Achievement';
            } else {
              iconName = 'medal';
              avatarProfile = item.winner === 'a' ? item.team_a_player1_profile : item.team_b_player1_profile;
              primaryText = (
                item.winner === 'a'
                  ? teamLabel(item.team_a_player1_profile, item.team_a_player2_profile)
                  : teamLabel(item.team_b_player1_profile, item.team_b_player2_profile)
              ).toUpperCase();
              secondaryText = `beat ${
                item.winner === 'a'
                  ? teamLabel(item.team_b_player1_profile, item.team_b_player2_profile)
                  : teamLabel(item.team_a_player1_profile, item.team_a_player2_profile)
              } ${scoreline(item)}`;
            }
            const playerName = avatarProfile?.full_name ?? 'Player';

            return (
              <View key={`${item.kind}-${item.id}`} style={styles.feedRow}>
                <View style={styles.feedAvatar}>
                  {avatarProfile?.avatar_url ? (
                    <Image source={{ uri: avatarProfile.avatar_url }} style={styles.feedAvatarImg} />
                  ) : (
                    <View style={styles.feedAvatarPlaceholder}>
                      <Text style={styles.feedAvatarText}>{playerName.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedText} numberOfLines={1}>
                    <Text style={styles.feedPlayerName}>{primaryText}</Text>
                    <Text style={styles.feedLabelSeparator}> • </Text>
                    <Text style={styles.feedAchievementText}>{secondaryText}</Text>
                  </Text>
                  <Text style={styles.feedTime}>{formatRelativeTime(item.created_at)}</Text>
                </View>
                <View style={styles.feedTrailing}>
                  <View style={styles.feedIconContainer}>
                    <Ionicons name={iconName as any} size={14} color={theme.primary} />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.vibButton, item.vibbedByMe && styles.vibButtonActive, pressed && { opacity: 0.8 }]}
                    onPress={() => handleToggleVib(item)}
                  >
                    <Ionicons name={item.vibbedByMe ? 'heart' : 'heart-outline'} size={14} color={item.vibbedByMe ? theme.primary : theme.textMuted} />
                    {item.vibCount > 0 && <Text style={[styles.vibCount, item.vibbedByMe && styles.vibCountActive]}>{item.vibCount}</Text>}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : suggestedFollows.length > 0 ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.emptyFeedSubtitle}>
            Follow other players to see their achievements and match results here.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedScroll}>
            {suggestedFollows.map((p) => (
              <View key={p.id} style={styles.suggestedCard}>
                <Pressable onPress={() => router.push(`/player/${p.id}` as any)}>
                  {p.avatar_url ? (
                    <Image source={{ uri: p.avatar_url }} style={styles.suggestedAvatarImg} />
                  ) : (
                    <View style={styles.suggestedAvatarPlaceholder}>
                      <Text style={styles.feedAvatarText}>{(p.full_name ?? '?').slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                </Pressable>
                <Text style={styles.suggestedName} numberOfLines={1}>{(p.full_name ?? 'Player').toUpperCase()}</Text>
                <Text style={styles.suggestedMeta}>{p.elo} ELO</Text>
                <Pressable
                  style={({ pressed }) => [styles.suggestedFollowButton, pressed && { opacity: 0.8 }]}
                  onPress={() => handleQuickFollow(p.id)}
                >
                  <Text style={styles.suggestedFollowButtonText}>FOLLOW</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.emptyFeedContainer}>
          <Ionicons name="people-outline" size={32} color={theme.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyFeedTitle}>FOLLOW OTHER PLAYERS</Text>
          <Text style={styles.emptyFeedSubtitle}>
            Follow other padel players to see their live achievements and match milestones in your home feed.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.emptyFeedButton,
              pressed && { opacity: 0.8 }
            ]}
            onPress={() => router.push('/partners')}
          >
            <Text style={styles.emptyFeedButtonText}>FIND PLAYERS</Text>
          </Pressable>
        </View>
      )}

      {followedLeaderboard && followedLeaderboard.length > 1 && (
        <>
          <Text style={styles.sectionTitle}>RANKING AMONG FRIENDS</Text>
          <View style={styles.leaderboardContainer}>
            {followedLeaderboard.map((p, index) => {
              const rank = index + 1;
              const isMe = p.id === userId;
              return (
                <View
                  key={p.id}
                  style={[
                    styles.leaderboardRow,
                    rank === followedLeaderboard.length && { borderBottomWidth: 0 },
                    isMe && styles.leaderboardRowMe,
                  ]}
                >
                  <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>{rank < 10 ? `0${rank}` : rank}</Text>
                  <View style={styles.playerAvatarPlaceholder}>
                    <Text style={styles.avatarLetter}>{(p.full_name ?? '?').slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.leaderboardName} numberOfLines={1}>
                    {isMe ? 'YOU' : (p.full_name ?? 'Player').toUpperCase()}
                  </Text>
                  {p.is_pro && <ProBadge size="sm" />}
                  {p.coach_status === 'approved' && <CoachBadge size="sm" />}
                  <Text style={styles.leaderboardElo}>{p.elo} <Text style={{ fontSize: 9, color: theme.textMuted }}>ELO</Text></Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {profile?.club && (
        <Pressable style={styles.clubBanner} onPress={() => router.push('/club-leaderboard' as any)}>
          <Ionicons name="trophy" size={18} color={theme.accent} />
          <Text style={styles.clubBannerText}>KING OF THE COURT — {profile.club.toUpperCase()}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </Pressable>
      )}

      <Pressable style={styles.clubBanner} onPress={() => router.push('/tournaments' as any)}>
        <Ionicons name="medal" size={18} color={theme.secondary} />
        <Text style={styles.clubBannerText}>TOURNAMENTS</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>

      <View style={styles.leaguesSectionHeader}>
        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>MY LEAGUES</Text>
        <Pressable onPress={() => router.push('/leagues' as any)}>
          <Text style={styles.leaguesSeeAll}>SEE ALL</Text>
        </Pressable>
      </View>
      {leaguesLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
      ) : myLeagues && myLeagues.length > 0 ? (
        myLeagues.map((league) => (
          <Pressable
            key={league.id}
            style={({ pressed }) => [styles.leagueCard, pressed && { opacity: 0.9 }]}
            onPress={() => router.push(`/league/${league.id}` as any)}
          >
            <View style={styles.leagueCardIcon}>
              <Ionicons name="trophy" size={18} color={theme.primary} />
            </View>
            <Text style={styles.leagueCardName} numberOfLines={1}>
              {league.name.toUpperCase()}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>
        ))
      ) : (
        <Pressable
          style={({ pressed }) => [styles.emptyFeedContainer, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/leagues' as any)}
        >
          <Ionicons name="trophy-outline" size={32} color={theme.textMuted} style={{ marginBottom: 8 }} />
          <Text style={styles.emptyFeedTitle}>START A PRIVATE LEAGUE</Text>
          <Text style={styles.emptyFeedSubtitle}>
            Create a league with your friends and compete on your own private leaderboard.
          </Text>
          <View style={styles.emptyFeedButton}>
            <Text style={styles.emptyFeedButtonText}>CREATE OR JOIN</Text>
          </View>
        </Pressable>
      )}

      <Pressable
        style={({ pressed }) => [styles.coachBanner, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/coaches' as any)}
      >
        <View style={styles.coachBannerIcon}>
          <Ionicons name="school" size={20} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.coachBannerTitle}>FIND A PADEL COACH</Text>
          <Text style={styles.coachBannerSubtitle}>Book a lesson with a coach near you</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>

      <Text style={styles.sectionTitle}>LEADERBOARD {profile?.zone ? `• ${profile.zone.toUpperCase()}` : ''}</Text>
      {leaderboardLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
      ) : (
        <View style={styles.leaderboardContainer}>
          {leaderboard?.map((p, index) => {
            const rank = index + 1;
            const isTop3 = rank <= 3;
            const rankStr = rank < 10 ? `0${rank}` : `${rank}`;
            return (
              <View key={p.id} style={[styles.leaderboardRow, rank === leaderboard.length && { borderBottomWidth: 0 }]}>
                <Text style={[styles.rankText, isTop3 && styles.rankTextTop]}>{rankStr}</Text>
                <View style={styles.playerAvatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{(p.full_name ?? '?').slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.leaderboardName} numberOfLines={1}>
                  {(p.full_name ?? 'Player').toUpperCase()}
                </Text>
                {p.is_pro && <ProBadge size="sm" />}
                {p.coach_status === 'approved' && <CoachBadge size="sm" />}
                <Text style={styles.leaderboardElo}>{p.elo} <Text style={{ fontSize: 9, color: theme.textMuted }}>ELO</Text></Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1, backgroundColor: theme.background },
  clubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
  },
  clubBannerText: { flex: 1, color: theme.text, fontWeight: '800', fontSize: 11, letterSpacing: 0.4 },
  container: { padding: 20, gap: 16, paddingBottom: 32 },
  headerContainer: { marginBottom: 4, marginTop: 12 },
  welcomeTag: { fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 2, marginBottom: 4 },
  title: { fontFamily: 'Coubra', fontSize: 28, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
  eloPerformanceCard: {
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
    overflow: 'hidden',
  },
  eloHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  widgetTag: { fontSize: 10, fontWeight: '800', color: theme.textMuted, letterSpacing: 1 },
  badgeOrange: { backgroundColor: 'rgba(255, 92, 0, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeOrangeText: { color: theme.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  eloContent: { marginTop: 14, marginBottom: 8 },
  eloHuge: { fontSize: 44, fontWeight: '900', color: theme.text, letterSpacing: -1 },
  eloLabel: { fontSize: 9, fontWeight: '800', color: theme.textMuted, letterSpacing: 1, marginTop: 2 },
  chartSimulation: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 60, marginTop: 10, alignSelf: 'stretch', opacity: 0.8 },
  chartBar: { flex: 1, backgroundColor: '#22242E', borderRadius: 3, minHeight: 4 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  gridCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'flex-start',
  },
  gridCardLabel: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 1, marginBottom: 8 },
  gridCardValue: { fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
  gridBadge: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  gridBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: '900', marginTop: 14, color: theme.primary, letterSpacing: 1.5 },
  leaguesSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  leaguesSeeAll: { fontSize: 10, fontWeight: '800', color: theme.secondary, letterSpacing: 0.5 },
  leagueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginTop: 8,
  },
  leagueCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 92, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leagueCardName: { flex: 1, color: theme.text, fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
  coachBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginTop: 16,
  },
  coachBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 92, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachBannerTitle: { color: theme.text, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  coachBannerSubtitle: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  resultCard: { 
    backgroundColor: theme.card, 
    borderRadius: cardRadius, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: theme.border 
  },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opponentWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  vsTag: { fontSize: 9, fontWeight: '900', color: theme.primary, backgroundColor: 'rgba(255, 92, 0, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  resultOpponent: { fontSize: 14, fontWeight: '800', color: theme.text, letterSpacing: 0.2 },
  resultBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  winBadge: { backgroundColor: 'rgba(0, 230, 118, 0.1)', borderWidth: 1, borderColor: theme.success },
  lossBadge: { backgroundColor: 'rgba(110, 112, 126, 0.1)', borderWidth: 1, borderColor: theme.border },
  resultBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  winText: { color: theme.success },
  lossText: { color: theme.textMuted },
  resultCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 },
  setScoresRow: { flexDirection: 'row', gap: 6 },
  scoreBox: { backgroundColor: '#1E1E28', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: theme.border },
  scoreBoxWin: { backgroundColor: 'rgba(0, 230, 118, 0.1)', borderColor: theme.success },
  scoreText: { fontSize: 12, fontWeight: '800', color: theme.textMuted },
  scoreTextWin: { color: theme.success },
  matchTypeTag: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 0.5 },
  empty: { color: theme.textMuted, textAlign: 'center', marginTop: 8, fontSize: 13 },
  leaderboardContainer: {
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rankText: { fontSize: 13, fontWeight: '900', color: theme.textMuted, width: 24, marginRight: 8 },
  rankTextTop: { color: theme.primary },
  playerAvatarPlaceholder: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#22242E', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: theme.border },
  avatarLetter: { fontSize: 11, fontWeight: '900', color: theme.text },
  leaderboardName: { flex: 1, color: theme.text, fontWeight: '800', fontSize: 13, letterSpacing: 0.2 },
  leaderboardElo: { color: theme.text, fontWeight: '900', fontSize: 13 },
  nextMatchCard: { 
    backgroundColor: theme.card, 
    borderRadius: cardRadius, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: theme.border, 
    borderLeftWidth: 4, 
    borderLeftColor: theme.primary,
    marginBottom: 4,
  },
  nextMatchCardEmpty: { 
    backgroundColor: theme.card, 
    borderRadius: cardRadius, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    opacity: 0.8,
  },
  nextMatchHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  nextMatchTag: { 
    fontSize: 10, 
    fontWeight: '900', 
    color: theme.primary, 
    letterSpacing: 2 
  },
  nextMatchTagEmpty: { 
    fontSize: 10, 
    fontWeight: '900', 
    color: theme.textMuted, 
    letterSpacing: 2,
    marginBottom: 4
  },
  nextMatchLocation: { 
    fontSize: 15, 
    fontWeight: '900', 
    color: theme.text, 
    textTransform: 'uppercase',
    letterSpacing: 0.2
  },
  nextMatchTime: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: theme.textMuted, 
    marginTop: 4 
  },
  nextMatchTextEmpty: { 
    fontSize: 12, 
    color: theme.textMuted, 
    textAlign: 'center', 
    lineHeight: 18, 
    paddingHorizontal: 8 
  },
  nextMatchFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: theme.border, 
    paddingTop: 10 
  },
  nextMatchProbability: { 
    fontSize: 9, 
    fontWeight: '900', 
    color: theme.secondary, 
    letterSpacing: 0.5 
  },
  nextMatchRosterText: { 
    fontSize: 9, 
    fontWeight: '900', 
    color: theme.textMuted, 
    letterSpacing: 0.5 
  },
  chartLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 16, 22, 0.85)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22242E',
  },
  chartLockText: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.primary,
    letterSpacing: 1.2,
  },
  emptyCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  emptyCardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
  },
  emptyCardButtonText: {
    color: theme.onAccent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  partnerAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(46, 157, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46, 157, 255, 0.25)',
    borderRadius: cardRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  partnerAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerAlertText: {
    color: theme.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  partnerAlertRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partnerAlertActionText: {
    color: theme.secondary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feedContainer: {
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 4,
    marginBottom: 20,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E28',
  },
  feedAvatar: {
    marginRight: 12,
  },
  feedAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  feedAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E1E28',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  feedAvatarText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: '900',
  },
  feedInfo: {
    flex: 1,
    marginRight: 8,
  },
  feedText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  feedPlayerName: {
    color: theme.text,
    fontWeight: '900',
  },
  feedLabelSeparator: {
    color: theme.borderActive,
    fontWeight: '900',
  },
  feedAchievementText: {
    color: theme.text,
    fontWeight: '700',
  },
  feedTime: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  feedTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vibButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  vibButtonActive: {
    borderColor: theme.primary,
    backgroundColor: 'rgba(255, 92, 0, 0.08)',
  },
  vibCount: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.textMuted,
  },
  vibCountActive: {
    color: theme.primary,
  },
  suggestedScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  suggestedCard: {
    width: 96,
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 10,
    alignItems: 'center',
  },
  suggestedAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 6,
  },
  suggestedAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E28',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 6,
  },
  suggestedName: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.text,
    marginBottom: 2,
    textAlign: 'center',
  },
  suggestedMeta: {
    fontSize: 9,
    color: theme.textMuted,
    marginBottom: 8,
  },
  suggestedFollowButton: {
    backgroundColor: 'rgba(255, 92, 0, 0.1)',
    borderWidth: 1,
    borderColor: theme.primary,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  suggestedFollowButtonText: {
    color: theme.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  leaderboardRowMe: {
    backgroundColor: 'rgba(255, 92, 0, 0.06)',
  },
  feedIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 92, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFeedContainer: {
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyFeedTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: 1,
    marginBottom: 6,
  },
  emptyFeedSubtitle: {
    fontSize: 10,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  emptyFeedButton: {
    backgroundColor: 'rgba(255, 92, 0, 0.1)',
    borderWidth: 1,
    borderColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  emptyFeedButtonText: {
    color: theme.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
