import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMatches, useRecentResults, MatchDateRange } from '@/lib/queries';
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
  const { data: recentResults, isLoading: recentLoading } = useRecentResults(userId, 20);

  const [activeTab, setActiveTab] = useState<'feed' | 'recent'>('feed');

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
                  {item.mode === 'pair' ? 'DOUBLES' : 'SINGLES'}
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
          <Text style={styles.tagline}>FIND A GAME</Text>
          <Text style={styles.title}>MATCHES</Text>
        </View>
        <Pressable style={styles.createMatchFab} onPress={() => router.push('/create-match')}>
          <Ionicons name="add" size={22} color={theme.onAccent} />
        </Pressable>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabSelector}>
        <Pressable
          style={[styles.tabButton, activeTab === 'feed' && styles.tabButtonActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Ionicons name="list" size={14} color={activeTab === 'feed' ? '#FFF' : theme.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'feed' && styles.tabButtonTextActive]}>OPEN MATCHES</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'recent' && styles.tabButtonActive]}
          onPress={() => setActiveTab('recent')}
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
              data={matches ?? []}
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
                          <Text style={styles.recentOpponent} numberOfLines={1}>{opponentsOf(r, userId!)}</Text>
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
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text, flex: 1, marginRight: 8 },
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
});
