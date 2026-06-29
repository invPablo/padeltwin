import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as d3 from 'd3-shape';
import { useSession } from '@/lib/useSession';
import {
  useProfile,
  useMyStats,
  useRecentResults,
  useLeaderboard,
  useMyUpcomingMatches,
  usePartnerRequests,
  useActivityFeed,
  useFollowing,
  useFollowPlayer,
  useCompatiblePlayers,
  useToggleVib,
  useFollowedLeaderboard,
  useMyKopStatus,
  useScrimIndex,
  scrimIndexLabel,
  type FeedItem,
} from '@/lib/queries';
import { ACHIEVEMENT_LABELS, ACHIEVEMENT_ICONS } from '@/constants/achievements';
import type { MatchResultWithProfiles, Profile } from '@/types/database';
import { theme, cardRadius } from '@/constants/theme';
import { ELO_PROVISIONAL_MATCHES } from '@/constants/elo';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { Card } from '@/components/Card';
import { AppButton } from '@/components/AppButton';

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
  const { data: kopStatus } = useMyKopStatus(userId);
  const { data: scrimIndex } = useScrimIndex(userId);
  const [scrimInfoOpen, setScrimInfoOpen] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const { data: stats, isLoading: statsLoading } = useMyStats(userId);
  const { data: realRecentResults, isLoading: resultsLoading } = useRecentResults(userId, 100);
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard(profile?.zone);
  const { data: upcomingMatches, isLoading: upcomingLoading } = useMyUpcomingMatches(userId);
  const { data: partnerRequests } = usePartnerRequests(userId);
  const { data: realActivityFeed, isLoading: feedLoading } = useActivityFeed(userId, 5);

  const isMock = !realRecentResults || realRecentResults.length === 0;

  const displayResults = !isMock ? realRecentResults : [
    {
      id: 'mock1', match_id: 'mock_match_1', team_a_player1: userId, team_a_player2: 'mock_p2', team_b_player1: 'mock_p3', team_b_player2: 'mock_p4',
      winner: 'a', sets: [{ a: 6, b: 4 }, { a: 6, b: 2 }], created_at: new Date().toISOString(), team_b_player1_profile: { full_name: 'Alejandro Galán' }
    },
    {
      id: 'mock2', match_id: 'mock_match_2', team_a_player1: userId, team_a_player2: 'mock_p2', team_b_player1: 'mock_p3', team_b_player2: 'mock_p4',
      winner: 'a', sets: [{ a: 7, b: 5 }, { a: 6, b: 4 }], created_at: new Date(Date.now() - 86400000).toISOString(), team_b_player1_profile: { full_name: 'Arturo Coello' }
    },
    {
      id: 'mock3', match_id: 'mock_match_3', team_a_player1: userId, team_a_player2: 'mock_p2', team_b_player1: 'mock_p3', team_b_player2: 'mock_p4',
      winner: 'b', sets: [{ a: 4, b: 6 }, { a: 2, b: 6 }], created_at: new Date(Date.now() - 86400000 * 3).toISOString(), team_b_player1_profile: { full_name: 'Fede Chingotto' }
    },
    {
      id: 'mock4', match_id: 'mock_match_4', team_a_player1: userId, team_a_player2: 'mock_p2', team_b_player1: 'mock_p3', team_b_player2: 'mock_p4',
      winner: 'a', sets: [{ a: 6, b: 1 }, { a: 6, b: 2 }], created_at: new Date(Date.now() - 86400000 * 5).toISOString(), team_b_player1_profile: { full_name: 'Juan Lebrón' }
    },
    {
      id: 'mock5', match_id: 'mock_match_5', team_a_player1: userId, team_a_player2: 'mock_p2', team_b_player1: 'mock_p3', team_b_player2: 'mock_p4',
      winner: 'b', sets: [{ a: 5, b: 7 }, { a: 6, b: 3 }, { a: 4, b: 6 }], created_at: new Date(Date.now() - 86400000 * 10).toISOString(), team_b_player1_profile: { full_name: 'Paquito Navarro' }
    },
    {
      id: 'mock6', match_id: 'mock_match_6', team_a_player1: userId, team_a_player2: 'mock_p2', team_b_player1: 'mock_p3', team_b_player2: 'mock_p4',
      winner: 'a', sets: [{ a: 6, b: 3 }, { a: 6, b: 4 }], created_at: new Date(Date.now() - 86400000 * 20).toISOString(), team_b_player1_profile: { full_name: 'Martin Di Nenno' }
    },
    {
      id: 'mock7', match_id: 'mock_match_7', team_a_player1: userId, team_a_player2: 'mock_p2', team_b_player1: 'mock_p3', team_b_player2: 'mock_p4',
      winner: 'a', sets: [{ a: 6, b: 0 }, { a: 6, b: 1 }], created_at: new Date(Date.now() - 86400000 * 40).toISOString(), team_b_player1_profile: { full_name: 'Sanyo Gutierrez' }
    }
  ] as any[];

  const activityFeed = (realActivityFeed && realActivityFeed.length > 0) ? realActivityFeed : [
    {
      id: 'mockf1', kind: 'match', winner: 'a', created_at: new Date().toISOString(), vibbedByMe: false, vibCount: 3,
      team_a_player1_profile: { full_name: 'You' }, team_a_player2_profile: { full_name: 'J. Lebron' },
      team_b_player1_profile: { full_name: 'A. Galán' }, team_b_player2_profile: { full_name: 'A. Coello' },
      sets: [{ a: 6, b: 4 }, { a: 6, b: 2 }]
    },
    {
      id: 'mockf2', kind: 'achievement', type: 'first_match', created_at: new Date(Date.now() - 86400000).toISOString(), vibbedByMe: true, vibCount: 12,
      profiles: { full_name: 'You' }
    }
  ] as unknown as FeedItem[];
  const { data: following } = useFollowing(userId);
  const { data: compatiblePlayers } = useCompatiblePlayers(userId, profile);
  const { data: followedLeaderboard } = useFollowedLeaderboard(userId);
  const followPlayer = useFollowPlayer();
  const toggleVib = useToggleVib();
  const pendingRequestsCount = (partnerRequests ?? []).filter((r) => r.status === 'pending' && r.to_id === userId).length;

  const actualElo = isMock ? 1350 : profile?.elo ?? 1200;
  const actualScrim = isMock ? 7.8 : scrimIndex;

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


  const currentElo = actualElo;
  const historyPoints: number[] = [currentElo];
  if (userId && displayResults) {
    let tempElo = currentElo;
    const delta = 15; // standard Elo step per match
    for (let i = 0; i < displayResults.length; i++) {
      const res = displayResults[i];
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

  // Pad to ensure we have exactly 10 elements for the chart bars
  while (historyPoints.length < 10) {
    const first = historyPoints[0] ?? 1200;
    historyPoints.unshift(first);
  }

  const last10Points = historyPoints.slice(-10);
  const minElo = Math.min(...last10Points);
  const maxElo = Math.max(...last10Points);
  const eloRange = maxElo - minElo || 1;

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 180;
  const chartHeight = 40;
  
  const linePath = d3.line<number>()
    .x((d, i) => (i / (last10Points.length - 1)) * chartWidth)
    .y((d) => chartHeight - ((d - minElo) / eloRange) * (chartHeight - 4) - 2)
    .curve(d3.curveMonotoneX)(last10Points);

  const areaPath = d3.area<number>()
    .x((d, i) => (i / (last10Points.length - 1)) * chartWidth)
    .y0(chartHeight)
    .y1((d) => chartHeight - ((d - minElo) / eloRange) * (chartHeight - 4) - 2)
    .curve(d3.curveMonotoneX)(last10Points);

  const eloDiff = last10Points[last10Points.length - 1] - last10Points[0];
  const isPositiveTrend = eloDiff >= 0;
  const trendColor = isPositiveTrend ? theme.accent : '#FF3B30'; // theme.accent for up, standard red for down

  // Calculate Streak
  let streak = 0;
  let streakType: 'W' | 'L' | null = null;
  if (userId && displayResults && displayResults.length > 0) {
    for (let i = 0; i < displayResults.length; i++) {
      const won = didWin(displayResults[i], userId);
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

  // Longest win streak within the loaded match history
  let bestWinStreak = 0;
  if (userId && displayResults && displayResults.length > 0) {
    let run = 0;
    for (let i = 0; i < displayResults.length; i++) {
      if (didWin(displayResults[i], userId)) {
        run++;
        bestWinStreak = Math.max(bestWinStreak, run);
      } else {
        run = 0;
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

  const playedCount = stats?.played ?? 0;
  const isCalibrating = playedCount < ELO_PROVISIONAL_MATCHES;

  // Rank Label (used by the trophy badge in the PS Score hero)
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

  // Weekly activity bars (last 8 weeks, oldest → newest)
  const weeklyBars = Array.from({ length: 8 }, () => ({ wins: 0, losses: 0 }));
  if (userId && displayResults) {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    for (const r of displayResults) {
      const weeksAgo = Math.floor((now - new Date(r.created_at).getTime()) / weekMs);
      if (weeksAgo < 8) {
        const idx = 7 - weeksAgo;
        if (didWin(r, userId)) weeklyBars[idx].wins++;
        else weeklyBars[idx].losses++;
      }
    }
  }
  const maxWeekTotal = Math.max(...weeklyBars.map(w => w.wins + w.losses), 1);

  // This month vs last month
  const nowDate = new Date();
  let thisMonthMatches = 0, thisMonthWins = 0, lastMonthMatches = 0;
  if (userId && displayResults) {
    const m = nowDate.getMonth(), y = nowDate.getFullYear();
    const lm = m === 0 ? 11 : m - 1;
    const ly = m === 0 ? y - 1 : y;
    for (const r of displayResults) {
      const d = new Date(r.created_at);
      if (d.getMonth() === m && d.getFullYear() === y) {
        thisMonthMatches++;
        if (didWin(r, userId)) thisMonthWins++;
      } else if (d.getMonth() === lm && d.getFullYear() === ly) {
        lastMonthMatches++;
      }
    }
  }
  const monthDelta = thisMonthMatches - lastMonthMatches;

  // Most active day of week
  const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  if (userId && displayResults) {
    for (const r of displayResults) dayCounts[new Date(r.created_at).getDay()]++;
  }
  const mostActiveDay = dayCounts.every(c => c === 0) ? '—' : DAY_NAMES[dayCounts.indexOf(Math.max(...dayCounts))];

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>

      {/* Partner Requests Alert Notification */}
      {pendingRequestsCount > 0 && (
        <Pressable onPress={() => router.push('/profile')}>
          {({ pressed }) => (
            <Card style={[styles.partnerAlertBanner, pressed && { opacity: 0.95 }]} contentStyle={styles.partnerAlertContent}>
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
            </Card>
          )}
        </Pressable>
      )}

      {/* Next Match Deployment Widget */}
      {upcomingLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: 10 }} />
      ) : nextMatch ? (
        <Pressable onPress={() => router.push(`/match/${nextMatch.id}`)}>
          {({ pressed }) => (
            <Card style={[styles.nextMatchCard, pressed && { opacity: 0.9 }]}>
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
            </Card>
          )}
        </Pressable>
      ) : null}

      {/* PS Score Hero Carousel */}
      <View style={{ marginBottom: 8, height: 300 }}>
        <Animated.ScrollView 
          horizontal 
          pagingEnabled 
          showsHorizontalScrollIndicator={false} 
          decelerationRate="fast"
          snapToInterval={screenWidth}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {/* Slide 1: Score & Trend Chart */}
          <Animated.View style={{ 
            width: screenWidth, 
            height: '100%',
            opacity: scrollX.interpolate({
              inputRange: [-screenWidth, 0, screenWidth],
              outputRange: [0.5, 1, 0.5],
              extrapolate: 'clamp'
            }),
            transform: [{
              scale: scrollX.interpolate({
                inputRange: [-screenWidth, 0, screenWidth],
                outputRange: [0.9, 1, 0.9],
                extrapolate: 'clamp'
              })
            }]
          }}>
            <Card style={[styles.heroCard, { borderLeftWidth: 4, borderLeftColor: theme.primary, flex: 1 }]}>
              <View style={styles.heroHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>PS SCORE (LONG TERM)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={styles.eloScore}>{actualElo}</Text>
                    
                    {linePath && areaPath && (
                      <View style={{ marginLeft: 16, flex: 1, height: chartHeight }}>
                        <Svg width="100%" height={chartHeight} preserveAspectRatio="none" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                          <Defs>
                            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                              <Stop offset="0%" stopColor={trendColor} stopOpacity={0.4} />
                              <Stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                            </LinearGradient>
                          </Defs>
                          <Path d={areaPath} fill="url(#fade)" />
                          <Path d={linePath} stroke={trendColor} strokeWidth={2} fill="none" />
                        </Svg>
                        <Text style={{ position: 'absolute', right: 0, bottom: -16, color: trendColor, fontSize: 10, fontWeight: '700' }}>
                          {isPositiveTrend ? '+' : ''}{eloDiff} PS
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.rankBadge}>
                  <Ionicons name="trophy-outline" size={12} color={theme.accent} />
                  <Text style={styles.rankBadgeText}>{rankLabel}</Text>
                </View>
                <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>
                  {stats?.played ?? 0} PARTIDAS
                </Text>
              </View>
            </Card>
          </Animated.View>

          {/* Slide 2: Claude Code Style Dashboard */}
          <Animated.View style={{ 
            width: screenWidth, 
            height: '100%',
            opacity: scrollX.interpolate({
              inputRange: [0, screenWidth, screenWidth * 2],
              outputRange: [0.5, 1, 0.5],
              extrapolate: 'clamp'
            }),
            transform: [{
              scale: scrollX.interpolate({
                inputRange: [0, screenWidth, screenWidth * 2],
                outputRange: [0.9, 1, 0.9],
                extrapolate: 'clamp'
              })
            }]
          }}>
            <Card style={[styles.heroCard, { flex: 1 }]}>
              {/* Month summary */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={styles.heroLabel}>ESTE MES</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                    <Text style={[styles.eloScore, { fontSize: 30 }]}>{thisMonthMatches}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: '600' }}>partidas</Text>
                  </View>
                  <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 }}>
                    {thisMonthWins}W · {thisMonthMatches - thisMonthWins}L{thisMonthMatches > 0 ? ` · ${Math.round((thisMonthWins / thisMonthMatches) * 100)}%` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.heroLabel}>VS MES ANT.</Text>
                  <Text style={{ fontSize: 26, fontFamily: 'Anton_400Regular', color: monthDelta >= 0 ? theme.accent : '#FF3B30', marginTop: 4 }}>
                    {monthDelta > 0 ? '+' : ''}{monthDelta}
                  </Text>
                </View>
              </View>

              {/* Weekly activity bars */}
              <View style={styles.weeklyBarsContainer}>
                {weeklyBars.map((week, i) => {
                  const total = week.wins + week.losses;
                  const barH = total > 0 ? Math.max(6, Math.round((total / maxWeekTotal) * 54)) : 0;
                  const winH = total > 0 ? Math.round((week.wins / total) * barH) : 0;
                  const lossH = barH - winH;
                  return (
                    <View key={i} style={styles.weeklyBarCol}>
                      <View style={{ height: 54, justifyContent: 'flex-end' }}>
                        {total > 0 ? (
                          <View style={{ height: barH, borderRadius: 3, overflow: 'hidden' }}>
                            <View style={{ height: winH, backgroundColor: theme.accent }} />
                            <View style={{ height: lossH, backgroundColor: '#2A2A2E' }} />
                          </View>
                        ) : (
                          <View style={{ height: 2, borderRadius: 1, backgroundColor: '#1C1C1F' }} />
                        )}
                      </View>
                      <Text style={[styles.weeklyBarLabel, i === 7 ? { color: theme.accent } : {}]}>
                        {i === 7 ? 'HOY' : i === 0 ? '-7S' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={[styles.divider, { marginVertical: 10, backgroundColor: '#222' }]} />

              {/* Personal records */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={styles.prItem}>
                  <Text style={styles.prLabel}>PEAK PS</Text>
                  <Text style={styles.prValue}>{maxElo}</Text>
                </View>
                <View style={[styles.prItem, { alignItems: 'center' }]}>
                  <Text style={styles.prLabel}>MEJOR RACHA</Text>
                  <Text style={styles.prValue}>{bestWinStreak > 0 ? `${bestWinStreak}W` : '—'}</Text>
                </View>
                <View style={[styles.prItem, { alignItems: 'flex-end' }]}>
                  <Text style={styles.prLabel}>DÍA ACTIVO</Text>
                  <Text style={styles.prValue}>{mostActiveDay}</Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        </Animated.ScrollView>
        
        {/* Pagination Dots */}
        <View style={styles.paginationDots}>
          <Animated.View 
            style={[
              styles.dot, 
              {
                width: scrollX.interpolate({
                  inputRange: [-screenWidth, 0, screenWidth],
                  outputRange: [6, 16, 6],
                  extrapolate: 'clamp'
                }),
                backgroundColor: scrollX.interpolate({
                  inputRange: [-screenWidth, 0, screenWidth],
                  outputRange: [theme.border, theme.primary, theme.border],
                  extrapolate: 'clamp'
                })
              }
            ]} 
          />
          <Animated.View 
            style={[
              styles.dot, 
              {
                width: scrollX.interpolate({
                  inputRange: [0, screenWidth, screenWidth * 2],
                  outputRange: [6, 16, 6],
                  extrapolate: 'clamp'
                }),
                backgroundColor: scrollX.interpolate({
                  inputRange: [0, screenWidth, screenWidth * 2],
                  outputRange: [theme.border, theme.primary, theme.border],
                  extrapolate: 'clamp'
                })
              }
            ]} 
          />
        </View>
      </View>

      {/* Scrim Index */}
      <Card style={{ borderLeftWidth: 3, borderLeftColor: theme.accent }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.heroLabel}>SCRIM INDEX (CURRENT FORM)</Text>
              <Pressable onPress={() => setScrimInfoOpen((v) => !v)}>
                <Ionicons name="information-circle-outline" size={12} color={theme.textMuted} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 4 }}>
              <Text style={[styles.eloScore, { fontSize: 32 }]}>{actualScrim == null ? '—' : actualScrim.toFixed(1)}</Text>
              {userId && displayResults && (
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                  {displayResults.slice(0, 5).reverse().map((m: any, i: number) => (
                    <View key={m.id || i} style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: didWin(m, userId) ? theme.primary : '#22242E' }} />
                  ))}
                </View>
              )}
            </View>
          </View>
          <View style={[styles.gridBadge, { backgroundColor: 'rgba(198, 255, 51, 0.12)', marginTop: 0 }]}>
            <Text style={[styles.gridBadgeText, { color: theme.accent, fontSize: 10 }]}>
              {actualScrim == null ? 'NO FORM YET' : scrimIndexLabel(actualScrim)}
            </Text>
          </View>
        </View>
        {scrimInfoOpen && (
          <Text style={[styles.scrimInfoText, { marginTop: 10 }]}>
            Tu Scrim Index es tu forma AHORA MISMO (1.0–10.0). Se basa en tus últimas 5 partidas confirmadas.
          </Text>
        )}
      </Card>

      <View style={styles.leaguesSectionHeader}>
        <Text style={[styles.sectionTitle, { marginBottom: 0, fontSize: 18 }]}>LEAGUES</Text>
        <Pressable onPress={() => router.push('/leagues' as any)}>
          <Text style={styles.leaguesSeeAll}>SEE ALL</Text>
        </Pressable>
      </View>

      <View style={styles.leagueTilesRow}>
        <Pressable style={{ flex: 1 }} onPress={() => router.push('/leagues' as any)}>
          {({ pressed }) => (
            <Card style={[styles.leagueTile, pressed && { opacity: 0.9 }]} contentStyle={styles.leagueTileContent}>
              <View style={styles.leagueTileRankBadge}>
                <MaterialCommunityIcons name="podium" size={18} color={theme.accent} />
              </View>
              <Text style={styles.leagueTileTitle}>LEAGUE</Text>
              <Text style={styles.leagueTileSub} numberOfLines={1}>
                Ranked by pair
              </Text>
            </Card>
          )}
        </Pressable>

        <Pressable style={{ flex: 1 }} onPress={() => router.push('/club-leaderboard' as any)}>
          {({ pressed }) => (
            <Card style={[styles.leagueTile, pressed && { opacity: 0.9 }]} contentStyle={styles.leagueTileContent}>
              <View style={styles.kopTileHeader}>
                <MaterialCommunityIcons name="crown" size={26} color="#FFD700" />
                <View style={styles.proTag}>
                  <Text style={styles.proTagText}>PRO</Text>
                </View>
              </View>
              <Text style={styles.leagueTileTitle}>KOP</Text>
              <Text style={styles.leagueTileSub} numberOfLines={1}>
                {kopStatus ? `${kopStatus.crownedClubs.length} crown${kopStatus.crownedClubs.length === 1 ? '' : 's'} held` : 'No crowns yet'}
              </Text>
            </Card>
          )}
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>RECENT MATCHES</Text>
      {resultsLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
      ) : (
        displayResults.slice(0, 5).map((r) => {
          const win = didWin(r, userId!);
          return (
            <Pressable key={r.id} onPress={() => router.push(`/match/${r.match_id || r.id}` as any)} style={({pressed}) => [pressed && {opacity: 0.8}]}>
            <Card style={styles.resultCard} contentStyle={{ padding: 16 }}>
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
                {r.sets.map((s: any, idx: number) => (
                  <View key={idx} style={[styles.scoreBox, win ? styles.scoreBoxWin : null]}>
                <Text style={[styles.scoreText, win ? styles.scoreTextWin : null]}>{s.a}-{s.b}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.matchTypeTag}>DOUBLES MATCH</Text>
              </View>
            </Card>
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>ACTIVITY FEED</Text>
      {feedLoading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 12 }} />
      ) : activityFeed && activityFeed.length > 0 ? (
        <Card style={styles.feedContainer} contentStyle={{ paddingVertical: 4 }}>
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
                      <Image source={require('@/assets/images/icon.png')} style={styles.feedAvatarPlaceholderLogo} resizeMode="contain" />
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
        </Card>
      ) : suggestedFollows.length > 0 ? (
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.emptyFeedSubtitle}>
            Follow other players to see their achievements and match results here.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedScroll}>
            {suggestedFollows.map((p) => (
              <Card key={p.id} style={styles.suggestedCard} contentStyle={{ padding: 10, alignItems: 'center' }}>
                <Pressable onPress={() => router.push(`/player/${p.id}` as any)}>
                  {p.avatar_url ? (
                    <Image source={{ uri: p.avatar_url }} style={styles.suggestedAvatarImg} />
                  ) : (
                    <View style={styles.suggestedAvatarPlaceholder}>
                      <Image source={require('@/assets/images/icon.png')} style={styles.suggestedAvatarPlaceholderLogo} resizeMode="contain" />
                    </View>
                  )}
                </Pressable>
                <Text style={styles.suggestedName} numberOfLines={1}>{(p.full_name ?? 'Player').toUpperCase()}</Text>
                <Text style={styles.suggestedMeta}>{p.elo} PS</Text>
                <Pressable
                  style={({ pressed }) => [styles.suggestedFollowButton, pressed && { opacity: 0.8 }]}
                  onPress={() => handleQuickFollow(p.id)}
                >
                  <Text style={styles.suggestedFollowButtonText}>FOLLOW</Text>
                </Pressable>
              </Card>
            ))}
          </ScrollView>
        </View>
      ) : (
        <Card style={styles.emptyFeedContainer} contentStyle={{ padding: 20, alignItems: 'center', justifyContent: 'center' }}>
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
        </Card>
      )}

      {followedLeaderboard && followedLeaderboard.length > 1 && (
        <>
          <Text style={styles.sectionTitle}>RANKING AMONG FRIENDS</Text>
          <Card style={styles.leaderboardContainer} contentStyle={{ padding: 0 }}>
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
                    <Image source={require('@/assets/images/icon.png')} style={styles.avatarLetterLogo} resizeMode="contain" />
                  </View>
                  <Text style={styles.leaderboardName} numberOfLines={1}>
                    {isMe ? 'YOU' : (p.full_name ?? 'Player').toUpperCase()}
                  </Text>
                  {p.is_pro && <ProBadge size="sm" />}
                  {p.coach_status === 'approved' && <CoachBadge size="sm" />}
                  <Text style={styles.leaderboardElo}>{p.elo} <Text style={{ fontSize: 9, color: theme.textMuted }}>PS</Text></Text>
                </View>
              );
            })}
          </Card>
        </>
      )}

      <View style={styles.leaguesSectionHeader}>
        <Text style={[styles.sectionTitle, { marginBottom: 0, fontSize: 18 }]}>LEARNING</Text>
      </View>

      <Pressable onPress={() => router.push('/coaches' as any)}>
        {({ pressed }) => (
          <Card style={[styles.coachBanner, pressed && { opacity: 0.9 }]} contentStyle={styles.coachBannerContent}>
            <View style={styles.coachBannerIcon}>
              <Ionicons name="school" size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coachBannerTitle}>FIND A PADEL COACH</Text>
              <Text style={styles.coachBannerSubtitle}>Book a lesson with a coach near you</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Card>
        )}
      </Pressable>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  leagueTilesRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  leagueTile: { minHeight: 110, flex: 1 },
  leagueTileContent: { padding: 16, gap: 8 },
  leagueTileRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(198, 255, 51, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leagueTileRankBadgeText: { fontFamily: 'Anton_400Regular', color: theme.accent, fontSize: 18 },
  kopTileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proTag: { backgroundColor: 'rgba(255, 215, 0, 0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  proTagText: { color: '#FFD700', fontWeight: '900', fontSize: 9, letterSpacing: 0.5 },
  leagueTileTitle: { fontFamily: 'Anton_400Regular', color: theme.text, fontSize: 18, marginTop: 4 , textTransform: 'uppercase' },
  leagueTileSub: { color: theme.textMuted, fontSize: 11, fontWeight: '600' },
  container: { paddingBottom: 110, gap: 8, backgroundColor: theme.background },

  heroCard: { position: 'relative' },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: 1 },
  eloScore: { fontFamily: 'Anton_400Regular', fontSize: 42, color: theme.text, marginTop: 2, letterSpacing: -1 },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(198, 255, 51, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(198, 255, 51, 0.25)',
  },
  rankBadgeText: { color: theme.accent, fontSize: 12, fontWeight: '800' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 18 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10 },
  statItem: { alignItems: 'center' },
  statVal: { fontFamily: 'Anton_400Regular', fontSize: 18, color: theme.text, marginTop: 4 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: '500' },
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 60, paddingHorizontal: 10, marginTop: 10 },
  chartBarWrapper: { alignItems: 'center', width: 24 },
  chartBar: { width: 12, borderRadius: 4 },
  chartPeakDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary, marginBottom: 4, shadowColor: theme.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 },

  claudeStatsGrid: { gap: 6, paddingHorizontal: 4 },
  claudeStatBox: { backgroundColor: '#1C1C1F', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#2A2A2E' },
  claudeStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 4 },
  claudeStatValue: { fontSize: 16, color: '#FFF', fontWeight: '800', fontFamily: 'Anton_400Regular' },
  
  weeklyBarsContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 14, paddingHorizontal: 2 },
  weeklyBarCol: { flex: 1, alignItems: 'center', gap: 4 },
  weeklyBarLabel: { fontSize: 8, color: theme.textMuted, fontWeight: '700', letterSpacing: 0.3 },
  prItem: { gap: 3 },
  prLabel: { fontSize: 9, color: theme.textMuted, fontWeight: '700', letterSpacing: 0.8 },
  prValue: { fontSize: 18, fontFamily: 'Anton_400Regular', color: theme.text, letterSpacing: -0.5 },

  gridCard: { flex: 1 },
  gridCardContent: { padding: 16, alignItems: 'flex-start' },
  zoneCardContent: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scrimIndexLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  scrimInfoText: { color: theme.textMuted, fontSize: 12, lineHeight: 18 },
  gridCardLabel: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 1, marginBottom: 8 },
  gridCardValue: { fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
  gridBadge: { marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  gridBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11,  marginTop: 16, paddingHorizontal: 16, color: theme.textMuted, letterSpacing: 1.5 , textTransform: 'uppercase', marginBottom: 8 },
  leaguesSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingHorizontal: 16, marginBottom: 8 },
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
  leagueCardName: { flex: 1, color: theme.text,  fontSize: 13, letterSpacing: 0.2 , textTransform: 'uppercase'},
  coachBanner: { marginTop: 16 },
  coachBannerContent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  coachBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 92, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachBannerTitle: { color: theme.text,  fontSize: 12, letterSpacing: 0.5 , textTransform: 'uppercase'},
  coachBannerSubtitle: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  resultCard: { 
    borderRadius: cardRadius, 
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
    borderRadius: cardRadius,
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
  avatarLetterLogo: { width: 16, height: 16, opacity: 0.5 },
  leaderboardName: { flex: 1, color: theme.text,  fontSize: 13, letterSpacing: 0.2 , textTransform: 'uppercase'},
  leaderboardElo: { color: theme.text, fontWeight: '900', fontSize: 13 },
  nextMatchCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
    marginBottom: 4,
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
  nextMatchLocation: {
    fontSize: 15, 
     
    color: theme.text, 
    textTransform: 'uppercase',
    letterSpacing: 0.2},
  nextMatchTime: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: theme.textMuted, 
    marginTop: 4 
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
  partnerAlertBanner: { borderColor: 'rgba(46, 157, 255, 0.25)', marginBottom: 16 },
  partnerAlertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  suggestedAvatarPlaceholderLogo: { width: 18, height: 18, opacity: 0.5 },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  feedContainer: {
    paddingVertical: 8,
    borderRadius: cardRadius,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  feedAvatar: {
    marginRight: 12,
  },
  feedAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  feedAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1E28',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  feedAvatarPlaceholderLogo: {
    width: 16,
    height: 16,
    opacity: 0.5,
  },
  feedInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  feedText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  feedPlayerName: {
    color: theme.text,
    
   textTransform: 'uppercase'},
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
    borderRadius: cardRadius,
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
    
    color: theme.text,
    marginBottom: 2,
    textAlign: 'center',
   textTransform: 'uppercase'},
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
    borderRadius: cardRadius,
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
