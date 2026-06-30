import { useState, useRef, useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View, Animated, Easing, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMatches, useJoinMatch, useRecentResults, MatchDateRange } from '@/lib/queries';
import { useSession } from '@/lib/useSession';
import type { MatchWithPlayers, MatchResultWithProfiles, PlayerLevel } from '@/types/database';
import { theme, cardRadius, chipRadius } from '@/constants/theme';
import { LEVELS, LEVEL_LABELS } from '@/constants/levels';
import { Card } from '@/components/Card';

function didWinResult(result: MatchResultWithProfiles, userId: string) {
  const inTeamA = result.team_a_player1 === userId || result.team_a_player2 === userId;
  return (inTeamA && result.winner === 'a') || (!inTeamA && result.winner === 'b');
}

function opponentsOf(result: MatchResultWithProfiles, userId: string) {
  const inTeamA = result.team_a_player1 === userId || result.team_a_player2 === userId;
  const rivals = inTeamA
    ? [result.team_b_player1_profile, result.team_b_player2_profile]
    : [result.team_a_player1_profile, result.team_a_player2_profile];
  return rivals.map((p) => p?.full_name ?? 'Player').join(' / ');
}

const DATE_RANGE_OPTIONS: { value: MatchDateRange; label: string }[] = [
  { value: 'today', label: 'TODAY' },
  { value: 'weekend', label: 'WEEKEND' },
  { value: 'week', label: 'THIS WEEK' },
];

export default function MatchSearchScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const [zone, setZone] = useState('');
  const [level, setLevel] = useState<PlayerLevel | undefined>(undefined);
  const [dateRange, setDateRange] = useState<MatchDateRange | undefined>(undefined);
  const [focusedInput, setFocusedInput] = useState(false);
  const { data: matches, isLoading, refetch, isRefetching } = useMatches({ zone, level, dateRange });
  const joinMatch = useJoinMatch();
  const [joinError, setJoinError] = useState<string | null>(null);
  const { data: recentResults, isLoading: recentLoading } = useRecentResults(userId, 20);

  // Matchmaking State Machine
  // 'idle' | 'queue' | 'found' | 'accepted'
  const [activeTab, setActiveTab] = useState<'feed' | 'radar' | 'recent'>('feed');
  const [queueState, setQueueState] = useState<'idle' | 'queue' | 'found' | 'accepted'>('idle');
  const [queueTime, setQueueTime] = useState(0);
  const [countdownTime, setCountdownTime] = useState(10);
  const [acceptedPlayers, setAcceptedPlayers] = useState<boolean[]>([false, false, false, false]);
  const [foundMatch, setFoundMatch] = useState<MatchWithPlayers | null>(null);

  // Animations
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownBarAnim = useRef(new Animated.Value(1)).current;

  // Timers and references
  const queueTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  const simulationTimeoutsRef = useRef<any[]>([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, []);

  const clearAllTimers = () => {
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    simulationTimeoutsRef.current.forEach(t => clearTimeout(t));
    simulationTimeoutsRef.current = [];
  };

  // Start Queue Mode
  const startQueue = () => {
    clearAllTimers();
    setJoinError(null);
    setQueueState('queue');
    setQueueTime(0);

    // Rotation Loop for Radar Sweeper
    rotationAnim.setValue(0);
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulsing Loop
    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1000,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();

    // Start Queue Time Counter
    queueTimerRef.current = setInterval(() => {
      setQueueTime(prev => prev + 1);
    }, 1000);

    // Match Found simulation (trigger after 4 seconds)
    const foundTimeout = setTimeout(() => {
      const match = (matches ?? []).find(
        (m) =>
          (m.match_players?.length ?? 0) < m.max_players &&
          !(m.match_players ?? []).some((p) => p.player_id === userId)
      );
      if (match) {
        setFoundMatch(match);
        triggerMatchFound();
      } else {
        cancelQueue();
      }
    }, 4000);
    simulationTimeoutsRef.current.push(foundTimeout);
  };

  const cancelQueue = () => {
    clearAllTimers();
    setQueueState('idle');
    setFoundMatch(null);
  };

  // Trigger Match Found LoL Popup
  const triggerMatchFound = () => {
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    setQueueState('found');
    setCountdownTime(10);
    // Player 2 is already accepted to simulate activity
    setAcceptedPlayers([false, true, false, false]);

    // Countdown Bar Animation (10 seconds to 0)
    countdownBarAnim.setValue(1);
    Animated.timing(countdownBarAnim, {
      toValue: 0,
      duration: 10000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Countdown Timer decrements every second
    countdownTimerRef.current = setInterval(() => {
      setCountdownTime(prev => {
        if (prev <= 1) {
          declineMatch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Accept Match Logic
  // Only the current user's acceptance is real (it actually joins match_players in
  // the DB); the other 3 player slots are a visual simulation of queue activity.
  const acceptMatch = () => {
    if (!foundMatch || !userId) return;
    setJoinError(null);
    const matchId = foundMatch.id;

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    joinMatch.mutate(
      { matchId, playerId: userId },
      {
        onSuccess: () => {
          setQueueState('accepted');
          // Set user (index 0) to true
          setAcceptedPlayers([true, true, false, false]);

          // Simulate Player 3 accepting after 0.8 seconds
          const p3Timeout = setTimeout(() => {
            setAcceptedPlayers([true, true, true, false]);
          }, 800);

          // Simulate Player 4 accepting after 1.8 seconds
          const p4Timeout = setTimeout(() => {
            setAcceptedPlayers([true, true, true, true]);

            // Navigate to match details after success delay — the user is
            // already a real participant at this point (joined above).
            const successTimeout = setTimeout(() => {
              clearAllTimers();
              setQueueState('idle');
              setFoundMatch(null);
              router.push(`/match/${matchId}`);
            }, 1000);
            simulationTimeoutsRef.current.push(successTimeout);
          }, 1800);

          simulationTimeoutsRef.current.push(p3Timeout, p4Timeout);
        },
        onError: (err: any) => {
          // "Already joined" (duplicate key) just means the user is already a
          // participant — treat that as success instead of failing the flow.
          if (err?.code === '23505') {
            setQueueState('accepted');
            setAcceptedPlayers([true, true, true, true]);
            const successTimeout = setTimeout(() => {
              clearAllTimers();
              setQueueState('idle');
              setFoundMatch(null);
              router.push(`/match/${matchId}`);
            }, 1000);
            simulationTimeoutsRef.current.push(successTimeout);
            return;
          }
          // Real failure (e.g. match filled up while in queue) — kick back to idle.
          setJoinError(err?.message ?? 'Could not join that match. It may have just filled up.');
          cancelQueue();
        },
      }
    );
  };

  // Decline Match / Timeout Logic
  const declineMatch = () => {
    clearAllTimers();
    setQueueState('idle');
    setFoundMatch(null);
  };

  // Format Queue Timer to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const sweepAngle = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  function renderItem({ item }: { item: MatchWithPlayers }) {
    const joinedPlayers = item.match_players ?? [];
    const joinedCount = joinedPlayers.length;
    const maxPlayers = item.max_players ?? 4;
    const isFull = joinedCount >= maxPlayers;
    const emptySlots = Math.max(0, maxPlayers - joinedCount);

    return (
      <Card style={styles.card} contentStyle={{ padding: 0, flexDirection: 'row' }}>
        <Pressable 
          style={({ pressed }) => [
            { flex: 1, flexDirection: 'row' },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
          ]} 
          onPress={() => router.push(`/match/${item.id}`)}
        >
          <View style={styles.cardAccentBar} />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.location}</Text>
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>
                  {item.mode === 'pair' ? '⚔️ DOUBLES' : '⚔️ SINGLES'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.cardSubtitle}>
              📅 {new Date(item.date_time).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()} • {new Date(item.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </Text>

            <View style={styles.cardRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{LEVEL_LABELS[item.level].toUpperCase()}</Text>
              </View>

              <View style={styles.rosterContainer}>
                <View style={styles.avatarStack}>
                  {joinedPlayers.map((player, idx) => (
                    <View 
                      key={player.profiles?.id || idx} 
                      style={[styles.playerAvatar, { marginLeft: idx === 0 ? 0 : -8 }]}
                    >
                      <Text style={styles.avatarInitial}>
                        {(player.profiles?.full_name ?? '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  ))}
                  {Array.from({ length: emptySlots }).map((_, idx) => (
                    <View 
                      key={idx} 
                      style={[
                        styles.emptyAvatar, 
                        { marginLeft: joinedCount === 0 && idx === 0 ? 0 : -8 }
                      ]}
                    >
                      <Ionicons name="add" size={10} color={theme.textMuted} />
                    </View>
                  ))}
                </View>
                <Text style={[styles.slotsText, isFull && { color: theme.danger }]}>
                  {isFull ? 'FULL' : `${joinedCount}/${maxPlayers} JOINED`}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.headerContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }]}>
        <View>
          <Text style={styles.tagline}>LIVE MATCHMAKING</Text>
          <Text style={styles.title}>MATCH FEED</Text>
        </View>
        <Pressable style={styles.createMatchFab} onPress={() => router.push('/create-match')}>
          <Ionicons name="add" size={22} color={theme.onAccent} />
        </Pressable>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabSelector}>
        <Pressable 
          style={[styles.tabButton, activeTab === 'feed' && styles.tabButtonActive]}
          onPress={() => {
            cancelQueue();
            setActiveTab('feed');
          }}
        >
          <Ionicons name="list" size={14} color={activeTab === 'feed' ? '#FFF' : theme.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'feed' && styles.tabButtonTextActive]}>LIST VIEW</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'radar' && styles.tabButtonActive]}
          onPress={() => setActiveTab('radar')}
        >
          <Ionicons name="radio" size={14} color={activeTab === 'radar' ? '#FFF' : theme.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'radar' && styles.tabButtonTextActive]}>RADAR JOIN</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'recent' && styles.tabButtonActive]}
          onPress={() => {
            cancelQueue();
            setActiveTab('recent');
          }}
        >
          <Ionicons name="time" size={14} color={activeTab === 'recent' ? '#FFF' : theme.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'recent' && styles.tabButtonTextActive]}>RECENT</Text>
        </Pressable>
      </View>

      {activeTab === 'feed' ? (
        <>
          {/* Search bar */}
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={16} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.input, focusedInput && styles.inputFocused]}
              placeholder="FILTER BY CITY (E.G. MADRID)..."
              placeholderTextColor={theme.textMuted}
              value={zone}
              onChangeText={setZone}
              onFocus={() => setFocusedInput(true)}
              onBlur={() => setFocusedInput(false)}
            />
            {zone.length > 0 && (
              <Pressable onPress={() => setZone('')} style={styles.clearIcon}>
                <Ionicons name="close-circle" size={16} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Filters */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>SKILL LEVEL</Text>
            <View style={styles.levelRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.levelChip,
                  !level && styles.levelChipActive,
                  pressed && { scale: 0.96 } as any
                ]}
                onPress={() => setLevel(undefined)}>
                <Text style={[styles.levelChipText, !level && styles.levelChipTextActive]}>ALL LEVELS</Text>
              </Pressable>
              {LEVELS.map((l) => (
                <Pressable
                  key={l}
                  style={({ pressed }) => [
                    styles.levelChip,
                    level === l && styles.levelChipActive,
                    pressed && { scale: 0.96 } as any
                  ]}
                  onPress={() => setLevel(l)}>
                  <Text style={[styles.levelChipText, level === l && styles.levelChipTextActive]}>
                    {LEVEL_LABELS[l].toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>WHEN</Text>
            <View style={styles.levelRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.levelChip,
                  !dateRange && styles.levelChipActive,
                  pressed && { scale: 0.96 } as any
                ]}
                onPress={() => setDateRange(undefined)}>
                <Text style={[styles.levelChipText, !dateRange && styles.levelChipTextActive]}>ANY TIME</Text>
              </Pressable>
              {DATE_RANGE_OPTIONS.map((o) => (
                <Pressable
                  key={o.value}
                  style={({ pressed }) => [
                    styles.levelChip,
                    dateRange === o.value && styles.levelChipActive,
                    pressed && { scale: 0.96 } as any
                  ]}
                  onPress={() => setDateRange(o.value)}>
                  <Text style={[styles.levelChipText, dateRange === o.value && styles.levelChipTextActive]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* List content */}
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={theme.primary} size="large" />
          ) : (
            <FlatList
              data={matches && matches.length > 0 ? matches : [
                {
                  id: 'mock1',
                  created_by: 'mock',
                  date_time: new Date(Date.now() + 86400000).toISOString(),
                  location: 'Premier Padel Center, Madrid',
                  level: 'intermedio',
                  mode: 'pair',
                  status: 'open',
                  visibility: 'open',
                  max_players: 4,
                  match_players: [{ player_id: 'mock_p1', profiles: { full_name: 'Alejandro G.' } }]
                },
                {
                  id: 'mock2',
                  created_by: 'mock',
                  date_time: new Date(Date.now() + 86400000 * 2).toISOString(),
                  location: 'Club de Campo Villa de Madrid',
                  level: 'avanzado',
                  mode: 'pair',
                  status: 'open',
                  visibility: 'open',
                  max_players: 4,
                  match_players: [
                    { player_id: 'mock_p1', profiles: { full_name: 'Arturo C.' } },
                    { player_id: 'mock_p2', profiles: { full_name: 'Fede C.' } }
                  ]
                }
              ] as any}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              onRefresh={refetch}
              refreshing={isRefetching}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.empty}>NO COURTS FOUND</Text>
                  <Text style={styles.emptySub}>No matches found matching your filters. Set up your own match to start.</Text>
                  <Pressable style={styles.emptyCreateButton} onPress={() => router.push('/create-match')}>
                    <Ionicons name="add-circle" size={14} color={theme.onAccent} />
                    <Text style={styles.emptyCreateButtonText}>CREATE MATCH</Text>
                  </Pressable>
                </View>
              }
            />
          )}
        </>
      ) : activeTab === 'radar' ? (
        /* Radar Matchmaking View */
        <View style={styles.radarContainer}>
          {queueState === 'idle' && (
            <View style={styles.radarCenter}>
              <View style={styles.radarGraphicOuter}>
                <Ionicons name="radio-outline" size={80} color="rgba(198, 255, 51, 0.15)" />
              </View>
              <Text style={styles.radarStatusTitle}>AUTO-MATCHMAKER</Text>
              <Text style={styles.radarStatusDesc}>
                Enter the live queue to find active courts and teammates matching your skill rating.
              </Text>
              {joinError && <Text style={styles.joinErrorText}>{joinError}</Text>}
              <Pressable style={styles.radarButton} onPress={startQueue}>
                <Ionicons name="navigate" size={16} color={theme.onAccent} />
                <Text style={styles.radarButtonText}>FIND A MATCH</Text>
              </Pressable>
            </View>
          )}

          {queueState === 'queue' && (
            <View style={styles.radarCenter}>
              <View style={styles.radarActiveWrapper}>
                <Animated.View 
                  style={[
                    styles.radarPulsingRing, 
                    { transform: [{ scale: pulseAnim }] }
                  ]} 
                />
                <View style={styles.radarScannerDisc}>
                  <Animated.View 
                    style={[
                      styles.radarSweeper, 
                      { transform: [{ rotate: sweepAngle }] }
                    ]} 
                  />
                  <Text style={styles.queueTimerText}>{formatTime(queueTime)}</Text>
                </View>
              </View>
              <Text style={[styles.radarStatusTitle, { color: theme.primary }]}>SEARCHING FOR MATCH...</Text>
              <Text style={styles.radarStatusDesc}>
                Scanning local lobbies in {zone ? zone.toUpperCase() : 'YOUR ZONE'} matching {level ? LEVEL_LABELS[level].toUpperCase() : 'YOUR RATING'}...
              </Text>
              <Pressable style={styles.cancelButton} onPress={cancelQueue}>
                <Text style={styles.cancelButtonText}>LEAVE QUEUE</Text>
              </Pressable>
            </View>
          )}

          {/* LoL Match Ready Popup Modal */}
          <Modal
            visible={queueState === 'found' || queueState === 'accepted'}
            transparent={true}
            animationType="fade"
          >
            <View style={styles.modalOverlay}>
              <View style={styles.lolModalCard}>
                <View style={styles.lolGlowHeader} />
                
                <Ionicons 
                  name={queueState === 'accepted' ? 'sparkles' : 'trophy-outline'} 
                  size={42} 
                  color={theme.primary} 
                  style={{ alignSelf: 'center', marginBottom: 12 }} 
                />
                
                <Text style={styles.lolTitle}>
                  {queueState === 'accepted' ? 'MATCH ACCEPTED' : 'MATCH FOUND!'}
                </Text>
                
                <Text style={styles.lolSubtitle}>
                  {foundMatch ? foundMatch.location.toUpperCase() : 'MULTIPLAYER LOBBY'}
                </Text>

                <View style={styles.lolDivider} />

                {/* Level / Mode metadata */}
                <View style={styles.lolMetaRow}>
                  <View style={styles.lolBadge}>
                    <Text style={styles.lolBadgeText}>
                      {foundMatch ? LEVEL_LABELS[foundMatch.level].toUpperCase() : 'ALL LEVEL'}
                    </Text>
                  </View>
                  <View style={[styles.lolBadge, { borderColor: theme.secondary }]}>
                    <Text style={[styles.lolBadgeText, { color: theme.secondary }]}>
                      {foundMatch?.mode === 'pair' ? '2V2 DOUBLES' : '1V1 SINGLES'}
                    </Text>
                  </View>
                </View>

                {/* Player acceptance grid */}
                <View style={styles.acceptGrid}>
                  {acceptedPlayers.map((accepted, idx) => (
                    <View key={idx} style={styles.playerSlotContainer}>
                      <View 
                        style={[
                          styles.playerSlotCircle, 
                          accepted ? styles.playerSlotCircleAccepted : styles.playerSlotCirclePending
                        ]}
                      >
                        <Ionicons 
                          name={accepted ? "checkmark" : "person"} 
                          size={14} 
                          color={accepted ? "#FFF" : theme.textMuted} 
                        />
                      </View>
                      <Text style={styles.playerSlotLabel}>
                        {idx === 0 ? 'YOU' : `PLAYER 0${idx + 1}`}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Countdown Time Text */}
                {queueState === 'found' && (
                  <Text style={styles.countdownText}>
                    DECIDE IN <Text style={{ color: theme.primary, fontWeight: '900' }}>{countdownTime}S</Text>
                  </Text>
                )}

                {queueState === 'accepted' && (
                  <Text style={styles.waitingText}>
                    WAITING FOR OTHERS TO ACCEPT...
                  </Text>
                )}

                {/* Actions */}
                <View style={styles.lolActionsContainer}>
                  {queueState === 'found' ? (
                    <>
                      <Pressable style={styles.lolAcceptButton} onPress={acceptMatch}>
                        <Text style={styles.lolAcceptButtonText}>ACCEPT</Text>
                      </Pressable>
                      <Pressable style={styles.lolDeclineButton} onPress={declineMatch}>
                        <Text style={styles.lolDeclineButtonText}>DECLINE</Text>
                      </Pressable>
                    </>
                  ) : (
                    <View style={styles.lolAcceptedBadge}>
                      <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.lolAcceptedBadgeText}>LOBBY READYING...</Text>
                    </View>
                  )}
                </View>

                {/* Countdown Shrinking Bar */}
                {queueState === 'found' && (
                  <View style={styles.lolCountdownContainer}>
                    <Animated.View 
                      style={[
                        styles.lolCountdownBar, 
                        {
                          width: countdownBarAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        }
                      ]} 
                    />
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </View>
      ) : (
        /* Recent Matches View */
        <View style={{ flex: 1 }}>
          {recentLoading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={theme.primary} size="large" />
          ) : (
            <FlatList
              data={recentResults ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: r }) => {
                const win = didWinResult(r, userId!);
                const dateLabel = new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
                return (
                  <Pressable onPress={() => router.push(`/match/${r.match_id || r.id}` as any)} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
                    <Card style={[styles.recentCard, { borderLeftWidth: 3, borderLeftColor: win ? theme.success : theme.border }]} contentStyle={{ padding: 16 }}>
                      <View style={styles.recentRow}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                          <Text style={styles.recentVs}>VS</Text>
                          <Text style={styles.recentOpponent} numberOfLines={1}>{opponentsOf(r, userId!).toUpperCase()}</Text>
                        </View>
                        <View style={[styles.recentBadge, win ? styles.recentBadgeWin : styles.recentBadgeLoss]}>
                          <Text style={[styles.recentBadgeText, { color: win ? theme.success : theme.textMuted }]}>{win ? 'WIN' : 'LOSS'}</Text>
                        </View>
                      </View>
                      <View style={styles.recentFooter}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {r.sets.map((s, idx) => (
                            <View key={idx} style={[styles.recentScoreBox, win && { borderColor: theme.success }]}>
                              <Text style={[styles.recentScoreText, win && { color: theme.success }]}>{s.a}-{s.b}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={styles.recentDate}>{dateLabel}</Text>
                      </View>
                    </Card>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.empty}>NO MATCHES YET</Text>
                  <Text style={styles.emptySub}>Play and record a result to see your match history here.</Text>
                </View>
              }
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: 'transparent' },
  headerContainer: { marginBottom: 14, marginTop: 12 },
  createMatchFab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: { fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 28,  color: theme.text, letterSpacing: -0.5 , textTransform: 'uppercase'},
  
  // Tab selector styles
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabButtonTextActive: {
    color: '#FFF',
    fontWeight: '900',
  },
  
  // Search input styles
  searchWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  clearIcon: {
    position: 'absolute',
    right: 16,
    zIndex: 1,
  },
  input: { 
    flex: 1,
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.1)', 
    borderRadius: 14, 
    paddingLeft: 42,
    paddingRight: 42,
    paddingVertical: 14, 
    fontSize: 12, 
    fontWeight: '800',
    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
    color: theme.text,
    letterSpacing: 0.5,
  },
  inputFocused: {
    borderColor: theme.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  
  // Filter styles
  filterSection: { marginBottom: 16 },
  filterLabel: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  levelRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  levelChip: { 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)', 
    borderRadius: chipRadius, 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    backgroundColor: 'rgba(255, 255, 255, 0.04)' 
  },
  levelChipActive: { 
    backgroundColor: 'rgba(198, 255, 51, 0.15)', 
    borderColor: theme.primary 
  },
  levelChipText: { color: theme.textMuted, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  levelChipTextActive: { color: theme.primary, fontWeight: '900' },
  
  // List & Card styles
  listContent: { gap: 12, paddingBottom: 110 },
  card: { 
    flexDirection: 'row',
    borderRadius: cardRadius, 
    overflow: 'hidden',
  },
  cardAccentBar: {
    width: 3,
    backgroundColor: theme.primary,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15,  color: theme.text, flex: 1, marginRight: 8, textTransform: 'uppercase', letterSpacing: 0.2},
  modeBadge: { 
    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)', 
    borderRadius: 6, 
    paddingHorizontal: 8, 
    paddingVertical: 4 
  },
  modeBadgeText: { color: theme.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  cardSubtitle: { color: theme.textMuted, marginTop: 6, fontSize: 11, fontWeight: '800' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  badge: { backgroundColor: 'rgba(198, 255, 51, 0.08)', borderWidth: 1, borderColor: 'rgba(198, 255, 51, 0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: theme.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  
  // Roster avatar stack
  rosterContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  playerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.text,
  },
  emptyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotsText: { color: theme.textMuted, fontWeight: '900', fontSize: 9, letterSpacing: 0.5 },

  recentCard: { borderRadius: cardRadius, marginBottom: 12 },
  recentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentVs: { fontSize: 9, fontWeight: '900', color: theme.primary, letterSpacing: 0.5 },
  recentOpponent: { fontSize: 14, fontWeight: '800', color: theme.text, letterSpacing: 0.2, marginTop: 2 },
  recentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  recentBadgeWin: { backgroundColor: 'rgba(0, 230, 118, 0.1)', borderColor: theme.success },
  recentBadgeLoss: { backgroundColor: 'rgba(110, 112, 126, 0.1)', borderColor: theme.border },
  recentBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  recentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 },
  recentScoreBox: { backgroundColor: '#1E1E28', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: theme.border },
  recentScoreText: { fontSize: 12, fontWeight: '800', color: theme.textMuted },
  recentDate: { fontSize: 9, fontWeight: '700', color: theme.textMuted },
  emptyContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  empty: { textAlign: 'center', color: theme.text, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  emptySub: { textAlign: 'center', color: theme.textMuted, fontSize: 11, marginTop: 6, fontWeight: '700', lineHeight: 18 },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  emptyCreateButtonText: { color: theme.onAccent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // Radar View Styles
  radarContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  radarCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  radarGraphicOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 24,
  },
  radarActiveWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 24,
  },
  radarPulsingRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: 'rgba(198, 255, 51, 0.2)',
  },
  radarScannerDisc: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  radarSweeper: {
    position: 'absolute',
    width: 70,
    height: 70,
    top: 0,
    left: 70,
    backgroundColor: 'rgba(198, 255, 51, 0.08)',
    borderLeftWidth: 1.5,
    borderLeftColor: theme.primary,
    transformOrigin: 'bottom left',
  },
  queueTimerText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  radarStatusTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  radarStatusDesc: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  joinErrorText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.danger,
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  radarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  radarButtonText: {
    color: theme.onAccent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cancelButtonText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // League of Legends Match Found Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 8, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lolModalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(21, 22, 31, 0.9)',
    borderRadius: cardRadius,
    borderWidth: 1.5,
    borderColor: theme.primary, // Glowing accent outline
    padding: 24,
    alignItems: 'stretch',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  lolGlowHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: theme.primary,
  },
  lolTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 1,
  },
  lolSubtitle: {
    fontSize: 11,
    
    color: theme.primary,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: 'uppercase',},
  lolDivider: {
    height: 1,
    backgroundColor: 'rgba(198, 255, 51, 0.25)',
    marginVertical: 16,
    alignSelf: 'stretch',
  },
  lolMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  lolBadge: {
    borderWidth: 1,
    borderColor: theme.primary,
    backgroundColor: 'rgba(198, 255, 51, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lolBadgeText: {
    color: theme.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  acceptGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  playerSlotContainer: {
    alignItems: 'center',
    gap: 6,
  },
  playerSlotCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  playerSlotCirclePending: {
    borderColor: theme.border,
    backgroundColor: '#1E1E28',
  },
  playerSlotCircleAccepted: {
    borderColor: theme.success,
    backgroundColor: 'rgba(0, 230, 118, 0.2)',
  },
  playerSlotLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: theme.textMuted,
    letterSpacing: 0.5,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.secondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  lolActionsContainer: {
    gap: 10,
    marginBottom: 10,
  },
  lolAcceptButton: {
    backgroundColor: theme.success,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: theme.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lolAcceptButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  lolDeclineButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  lolDeclineButtonText: {
    color: theme.danger,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  lolAcceptedBadge: {
    flexDirection: 'row',
    backgroundColor: 'rgba(46, 157, 255, 0.15)',
    borderWidth: 1,
    borderColor: theme.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lolAcceptedBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  lolCountdownContainer: {
    height: 3,
    backgroundColor: 'rgba(198, 255, 51, 0.15)',
    borderRadius: 1.5,
    marginTop: 12,
    overflow: 'hidden',
  },
  lolCountdownBar: {
    height: '100%',
    backgroundColor: theme.primary,
  },
});
