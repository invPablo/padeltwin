import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import {
  useProfile,
  useUpdateProfile,
  usePartnerRequests,
  useRespondPartnerRequest,
  useHiddenChats,
  useHideChat,
  useMyAchievements,
  useMyStats,
  useRecentResults,
  useApplyToCoach,
  useStopCoaching,
  useMyCoachLeads,
  useUpdateLeadStatus,
  useFollowerCount,
  useFollowingCount,
  usePersonalRecords,
  useBlockedProfiles,
  useUnblockUser,
  useDeleteAccount,
} from '@/lib/queries';
import { ACHIEVEMENT_LABELS, ACHIEVEMENT_ICONS } from '@/constants/achievements';
import { supabase } from '@/lib/supabase';
import { pickAndUploadAvatar } from '@/lib/uploadAvatar';
import type { PartnerRequestWithProfiles, PlayerLevel, MatchResultWithProfiles } from '@/types/database';
import { theme, buttonRadius, cardRadius, chipRadius } from '@/constants/theme';
import { LEVELS, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from '@/constants/levels';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { ELO_PROVISIONAL_MATCHES, isEloProvisional } from '@/constants/elo';

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

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile, isLoading } = useProfile(userId);
  const updateProfile = useUpdateProfile();
  const { data: requests } = usePartnerRequests(userId);
  const { data: myAchievements, isLoading: achievementsLoading } = useMyAchievements(userId);
  const { data: stats, isLoading: statsLoading } = useMyStats(userId);
  const { data: recentResults, isLoading: resultsLoading } = useRecentResults(userId, 8);
  const { data: followerCount } = useFollowerCount(userId);
  const { data: followingCount } = useFollowingCount(userId);
  const { data: records } = usePersonalRecords(userId);
  const respondRequest = useRespondPartnerRequest();
  const { data: hiddenChats } = useHiddenChats(userId);
  const hideChat = useHideChat();
  const { data: blockedProfiles } = useBlockedProfiles(userId);
  const unblockUser = useUnblockUser();
  const deleteAccount = useDeleteAccount();
  const applyToCoach = useApplyToCoach();
  const stopCoaching = useStopCoaching();
  const { data: leads, isLoading: leadsLoading } = useMyCoachLeads(profile?.coach_status === 'approved' ? userId : undefined);
  const updateLeadStatus = useUpdateLeadStatus();
  const [coachModalVisible, setCoachModalVisible] = useState(false);
  const [coachBio, setCoachBio] = useState('');
  const [coachRate, setCoachRate] = useState('');
  const [coachExperience, setCoachExperience] = useState('');
  const [coachSpecialties, setCoachSpecialties] = useState('');
  const isCalibrating = isEloProvisional(stats?.played ?? 0);

  const recordItems: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string }[] = [];
  if (records?.longestWinStreak) {
    recordItems.push({ icon: 'flame', value: `${records.longestWinStreak} wins`, label: 'Longest streak' });
  }
  if (records?.busiestMonth) {
    recordItems.push({ icon: 'calendar', value: `${records.busiestMonth.count} matches`, label: records.busiestMonth.label });
  }
  if (records?.bestEloGain) {
    recordItems.push({ icon: 'flash', value: `+${records.bestEloGain.delta} ELO`, label: 'Best ELO gain' });
  }

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const pendingReceived = (requests ?? []).filter((r) => r.status === 'pending' && r.to_id === userId);
  const accepted = (requests ?? []).filter((r) => r.status === 'accepted' && !hiddenChats?.has(r.id));

  function otherProfile(r: PartnerRequestWithProfiles) {
    return r.from_id === userId ? r.to_profile : r.from_profile;
  }

  const [fullName, setFullName] = useState('');
  const [zone, setZone] = useState('');
  const [level, setLevel] = useState<PlayerLevel | null>(null);
  const [club, setClub] = useState('');
  const [racket, setRacket] = useState('');
  const [apparelBrand, setApparelBrand] = useState('');
  const [lookingForPartner, setLookingForPartner] = useState(true);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setZone(profile.zone ?? '');
      setLevel(profile.level);
      setClub(profile.club ?? '');
      setRacket(profile.racket ?? '');
      setApparelBrand(profile.apparel_brand ?? '');
      setLookingForPartner(profile.looking_for_partner);
    }
  }, [profile]);

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

  function handleSave() {
    updateProfile.mutate({
      id: userId!,
      full_name: fullName,
      zone,
      level,
      club: club || null,
      racket: racket || null,
      apparel_brand: apparelBrand || null,
      looking_for_partner: lookingForPartner,
    });
  }

  function handleBecomeCoach() {
    if (!userId || !coachBio.trim()) return;
    applyToCoach.mutate(
      {
        id: userId,
        bio: coachBio.trim(),
        hourlyRate: coachRate.trim() ? Number(coachRate.trim()) : null,
        yearsExperience: coachExperience.trim() ? Number(coachExperience.trim()) : null,
        specialties: coachSpecialties.trim(),
      },
      {
        onSuccess: () => {
          setCoachModalVisible(false);
          setCoachBio('');
          setCoachRate('');
          setCoachExperience('');
          setCoachSpecialties('');
        },
        onError: (err: any) => Alert.alert('Could not save listing', err.message ?? 'Try again.'),
      }
    );
  }

  const initials = (fullName || 'Player').slice(0, 2).toUpperCase();

  return (
    <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
      {/* CURVED PHOTO COVER */}
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
        </View>

        {/* THREE FLOATING BUTTONS: change photo / save / log out */}
        <View style={styles.actionRowFloating}>
          <Pressable
            style={({ pressed }) => [styles.smallActionBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="camera" size={20} color="#FFF" />
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.largeActionBtn,
              { backgroundColor: theme.accent },
              updateProfile.isPending && { opacity: 0.9 },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
            onPress={handleSave}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="checkmark" size={26} color="#FFF" />
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.smallActionBtn, pressed && { transform: [{ scale: 0.95 }] }]}
            onPress={() => supabase.auth.signOut()}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.contentBody}>
        {/* BADGES */}
        <View style={styles.badgeRow}>
          <View style={styles.outlinedBadge}>
            <Text style={styles.outlinedBadgeText}>
              {profile.level ? LEVEL_LABELS[profile.level].toUpperCase() : 'NO LEVEL'}
            </Text>
          </View>
          {lookingForPartner && (
            <View style={styles.outlinedBadge}>
              <Text style={styles.outlinedBadgeText}>LOOKING FOR PARTNER</Text>
            </View>
          )}
        </View>

        {/* SOCIAL */}
        <View style={styles.socialStatsRow}>
          <Pressable
            style={({ pressed }) => [styles.socialStatColumn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(`/social/${userId}?type=followers` as any)}
          >
            <Text style={styles.socialStatValue}>{followerCount ?? 0}</Text>
            <Text style={styles.socialStatLabel}>Followers</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.socialStatColumn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(`/social/${userId}?type=following` as any)}
          >
            <Text style={styles.socialStatValue}>{followingCount ?? 0}</Text>
            <Text style={styles.socialStatLabel}>Following</Text>
          </Pressable>
        </View>

        {/* NAME */}
        <View style={styles.nameRow}>
          <Text style={styles.playerName}>{profile.full_name ?? 'Player'}</Text>
          {profile.is_pro && <ProBadge />}
          {profile.coach_status === 'approved' && <CoachBadge />}
        </View>

        {profile.zone ? <Text style={styles.locationSub}>📍 {profile.zone.toUpperCase()}</Text> : null}

        {/* STATS */}
        <View style={styles.statsCardContainer}>
          {statsLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <>
              <View style={styles.statColumn}>
                <Text style={styles.statHugeText}>{profile.elo}</Text>
                <Text style={styles.statSubLabel}>
                  {isCalibrating ? `Provisional • ${stats?.played ?? 0}/${ELO_PROVISIONAL_MATCHES}` : 'ELO Rating'}
                </Text>
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
            </>
          )}
        </View>

        {/* RECORDS */}
        {recordItems.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Personal records</Text>
            <View style={styles.recordsCardContainer}>
              {recordItems.map((item, index) => (
                <View key={item.label} style={styles.recordItem}>
                  {index > 0 && <View style={styles.statDivider} />}
                  <View style={styles.recordColumn}>
                    <Ionicons name={item.icon} size={18} color={theme.accent} />
                    <Text style={styles.recordValue}>{item.value}</Text>
                    <Text style={styles.recordLabel}>{item.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* RECENT MATCHES */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent matches</Text>
        </View>

        {resultsLoading ? (
          <ActivityIndicator color={theme.accent} style={{ marginBottom: 12 }} />
        ) : recentResults && recentResults.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
            {recentResults.map((r) => {
              const win = didWin(r, userId);
              const opponent = opponentProfile(r, userId);
              const opponentName = opponent?.full_name ?? 'Padel Player';
              const opponentAvatar = opponent?.avatar_url;
              const scoreString = r.sets.map((s) => `${s.a}-${s.b}`).join(', ');

              return (
                <View key={r.id} style={styles.horizontalReviewCard}>
                  <View style={styles.cardHeaderRow}>
                    {opponentAvatar ? (
                      <Image source={{ uri: opponentAvatar }} style={styles.smallAvatar} />
                    ) : (
                      <View style={styles.smallAvatarPlaceholder}>
                        <Text style={styles.smallAvatarPlaceholderText}>
                          {opponentName.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.cardInfoCol}>
                      <Text style={styles.cardOpponentName} numberOfLines={1}>
                        vs {opponentName}
                      </Text>
                      <View style={styles.cardRatingRow}>
                        <Ionicons name="trophy" size={11} color={theme.accent} style={{ marginRight: 4 }} />
                        <Text style={styles.cardResultText}>
                          {win ? 'Won' : 'Lost'} {scoreString}
                        </Text>
                        <Text style={styles.cardTimeText}>
                          {'  '}•{'  '}
                          {formatRelativeTime(r.created_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No match results recorded yet — play one and record the result.</Text>
        )}

        {/* ACHIEVEMENTS */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MY ACHIEVEMENTS</Text>
          {achievementsLoading ? (
            <ActivityIndicator color={theme.accent} />
          ) : myAchievements && myAchievements.length > 0 ? (
            <View style={styles.achievementsRow}>
              {myAchievements.map((item) => {
                const iconName = ACHIEVEMENT_ICONS[item.type] || 'trophy';
                const labelText = ACHIEVEMENT_LABELS[item.type] || 'New Achievement';
                return (
                  <View key={item.id} style={styles.achievementBadgeContainer}>
                    <View style={styles.achievementBadgeCircle}>
                      <Ionicons name={iconName as any} size={20} color={theme.accent} />
                    </View>
                    <Text style={styles.achievementBadgeLabel} numberOfLines={2}>
                      {labelText.toUpperCase()}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.helperText}>Play matches and win games to unlock exclusive player badges!</Text>
          )}
        </View>

        {/* ATHLETE DETAILS */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ATHLETE DETAILS</Text>

          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={[styles.input, focusedInput === 'name' && styles.inputFocused]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor={theme.textMuted}
            onFocus={() => setFocusedInput('name')}
            onBlur={() => setFocusedInput(null)}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>CITY</Text>
          <TextInput
            style={[styles.input, focusedInput === 'city' && styles.inputFocused]}
            value={zone}
            onChangeText={setZone}
            placeholder="e.g. Edinburgh"
            placeholderTextColor={theme.textMuted}
            onFocus={() => setFocusedInput('city')}
            onBlur={() => setFocusedInput(null)}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>SKILL LEVEL</Text>
          <View style={styles.row}>
            {LEVELS.map((l) => (
              <Pressable
                key={l}
                style={({ pressed }) => [
                  styles.chip,
                  level === l && styles.chipActive,
                  pressed && ({ transform: [{ scale: 0.96 }] } as any),
                ]}
                onPress={() => setLevel(l)}
              >
                <Text style={[styles.chipText, level === l && styles.chipTextActive]}>{LEVEL_LABELS[l]}</Text>
              </Pressable>
            ))}
          </View>
          {level && <Text style={styles.helperText}>{LEVEL_DESCRIPTIONS[level]}</Text>}
        </View>

        {/* EQUIPMENT */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>EQUIPMENT CONFIG</Text>

          <Text style={styles.label}>CLUB OR COURT</Text>
          <TextInput
            style={[styles.input, focusedInput === 'club' && styles.inputFocused]}
            value={club}
            onChangeText={setClub}
            placeholder="Your club or team"
            placeholderTextColor={theme.textMuted}
            onFocus={() => setFocusedInput('club')}
            onBlur={() => setFocusedInput(null)}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>RACKET MODEL</Text>
          <TextInput
            style={[styles.input, focusedInput === 'racket' && styles.inputFocused]}
            value={racket}
            onChangeText={setRacket}
            placeholder="Brand / model"
            placeholderTextColor={theme.textMuted}
            onFocus={() => setFocusedInput('racket')}
            onBlur={() => setFocusedInput(null)}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>PREFERRED APPAREL BRAND</Text>
          <TextInput
            style={[styles.input, focusedInput === 'apparel' && styles.inputFocused]}
            value={apparelBrand}
            onChangeText={setApparelBrand}
            placeholder="e.g. Nike, Asics"
            placeholderTextColor={theme.textMuted}
            onFocus={() => setFocusedInput('apparel')}
            onBlur={() => setFocusedInput(null)}
          />
        </View>

        <View style={[styles.section, styles.switchRow]}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={[styles.label, { marginTop: 0 }]}>PARTNER SEARCH</Text>
            <Text style={styles.helperText}>Make profile visible in the matchmaking pool.</Text>
          </View>
          <Switch
            value={lookingForPartner}
            onValueChange={setLookingForPartner}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={lookingForPartner ? theme.secondary : '#7F7F8F'}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            updateProfile.isPending && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={updateProfile.isPending}
        >
          {updateProfile.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save Changes</Text>
          )}
        </Pressable>

        {profile.coach_status === 'approved' ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>COACH LISTING</Text>
            <Text style={styles.helperText}>
              You're listed in the coach directory. {leads && leads.length > 0 ? `${leads.length} lesson request${leads.length > 1 ? 's' : ''} received.` : 'No requests yet.'}
            </Text>
            {leadsLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginTop: 10 }} />
            ) : leads && leads.length > 0 ? (
              leads.map((lead) => (
                <View key={lead.id} style={styles.leadCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.requestName}>{lead.requester?.full_name ?? 'Player'}</Text>
                    <Text style={[styles.leadStatus, lead.status === 'pending' && styles.leadStatusPending]}>
                      {lead.status.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.helperText}>{lead.message}</Text>
                  {lead.status === 'pending' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Pressable
                        style={[styles.smallButton, styles.acceptButton]}
                        onPress={() => updateLeadStatus.mutate({ leadId: lead.id, status: 'contacted' })}
                      >
                        <Text style={styles.smallButtonText}>MARK CONTACTED</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallButton, styles.rejectButton]}
                        onPress={() => updateLeadStatus.mutate({ leadId: lead.id, status: 'closed' })}
                      >
                        <Text style={styles.smallButtonText}>CLOSE</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.deleteChatBtn, { alignSelf: 'flex-start', width: 'auto', paddingHorizontal: 14, marginTop: 12 }, pressed && { opacity: 0.7 }]}
              onPress={() => userId && stopCoaching.mutate(userId)}
            >
              <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 11 }}>STOP COACHING</Text>
            </Pressable>
          </View>
        ) : profile.coach_status === 'pending' ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>COACH APPLICATION</Text>
            <Text style={styles.helperText}>
              Your application is under review. We'll list you in the coach directory once it's approved.
            </Text>
          </View>
        ) : !profile.is_pro ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>ARE YOU A PADEL COACH?</Text>
            <Text style={styles.helperText}>
              Listing as a coach is a Pro feature. Upgrade to Pro to apply for a spot in the coach directory.
            </Text>
            <Text style={[styles.label, { color: theme.textMuted, marginTop: 10 }]}>PRO REQUIRED</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.section, pressed && { opacity: 0.9 }]}
            onPress={() => setCoachModalVisible(true)}
          >
            <Text style={styles.sectionHeader}>ARE YOU A PADEL COACH?</Text>
            <Text style={styles.helperText}>Apply to be listed in the coach directory and get lesson requests from players near you. Subject to review.</Text>
            <Text style={[styles.label, { color: theme.accent, marginTop: 10 }]}>APPLY TO BECOME A COACH →</Text>
          </Pressable>
        )}

        {pendingReceived.length > 0 && (
          <View style={styles.partnersSection}>
            <Text style={styles.sectionTitle}>PARTNER REQUESTS</Text>
            {pendingReceived.map((r) => (
              <View key={r.id} style={styles.requestCard}>
                <Text style={styles.requestName}>{otherProfile(r)?.full_name ?? 'Player'}</Text>
                <View style={styles.requestActions}>
                  <Pressable
                    style={({ pressed }) => [styles.smallButton, styles.acceptButton, pressed && { opacity: 0.8 }]}
                    onPress={() => respondRequest.mutate({ requestId: r.id, status: 'accepted' })}
                  >
                    <Text style={styles.smallButtonText}>ACCEPT</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.smallButton, styles.rejectButton, pressed && { opacity: 0.8 }]}
                    onPress={() => respondRequest.mutate({ requestId: r.id, status: 'rejected' })}
                  >
                    <Text style={styles.smallButtonText}>DECLINE</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {accepted.length > 0 && (
          <View style={styles.partnersSection}>
            <Text style={styles.sectionTitle}>MY PARTNERS</Text>
            {accepted.map((r) => (
              <Pressable
                key={r.id}
                style={({ pressed }) => [
                  styles.partnerRequestCard,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
                ]}
                onPress={() => router.push({ pathname: '/chat/[requestId]', params: { requestId: r.id } })}
              >
                <View style={styles.partnerInfo}>
                  <Text style={styles.requestName}>{otherProfile(r)?.full_name ?? 'Player'}</Text>
                  <Text style={styles.partnerCity}>{otherProfile(r)?.zone ?? 'Madrid'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={styles.chatLinkBadge}>
                    <Text style={styles.chatLinkText}>CHAT</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.deleteChatBtn, pressed && { opacity: 0.7 }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      Alert.alert(
                        'Delete chat?',
                        `This removes the chat from your list only — ${otherProfile(r)?.full_name ?? 'this player'} will still see it.`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => userId && hideChat.mutate({ requestId: r.id, profileId: userId }),
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.danger} />
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRIVACY & SAFETY</Text>

          <Pressable onPress={() => router.push('/privacy' as any)}>
            <Text style={[styles.label, { color: theme.accent, marginTop: 0 }]}>PRIVACY POLICY →</Text>
          </Pressable>

          {blockedProfiles && blockedProfiles.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>BLOCKED PLAYERS</Text>
              {blockedProfiles.map((b) => (
                <View key={b.id} style={[styles.leadCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={styles.requestName}>{b.full_name ?? 'Player'}</Text>
                  <Pressable
                    onPress={() => userId && unblockUser.mutate({ blockerId: userId, blockedId: b.id })}
                  >
                    <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 11 }}>UNBLOCK</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          <Pressable
            style={{ marginTop: 16 }}
            onPress={() =>
              Alert.alert(
                'Delete account?',
                "This permanently deletes your profile, matches, messages, and stats. This can't be undone.",
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete my account',
                    style: 'destructive',
                    onPress: () =>
                      deleteAccount.mutate(undefined, {
                        onSuccess: () => supabase.auth.signOut(),
                        onError: (err: any) => Alert.alert('Could not delete account', err.message ?? 'Try again.'),
                      }),
                  },
                ]
              )
            }
          >
            <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 }}>DELETE MY ACCOUNT</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={coachModalVisible} transparent animationType="fade" onRequestClose={() => setCoachModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ gap: 10 }}>
            <Text style={styles.modalTitle}>COACH APPLICATION</Text>
            <Text style={styles.label}>BIO</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={coachBio}
              onChangeText={setCoachBio}
              placeholder="Tell players about your coaching style and background."
              placeholderTextColor={theme.textMuted}
              multiline
            />
            <Text style={styles.label}>HOURLY RATE (£, optional)</Text>
            <TextInput
              style={styles.input}
              value={coachRate}
              onChangeText={setCoachRate}
              placeholder="e.g. 35"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
            />
            <Text style={styles.label}>YEARS OF EXPERIENCE (optional)</Text>
            <TextInput
              style={styles.input}
              value={coachExperience}
              onChangeText={setCoachExperience}
              placeholder="e.g. 8"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
            />
            <Text style={styles.label}>SPECIALTIES (optional)</Text>
            <TextInput
              style={styles.input}
              value={coachSpecialties}
              onChangeText={setCoachSpecialties}
              placeholder="e.g. Beginners, footwork, competitive prep"
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setCoachModalVisible(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, (!coachBio.trim() || applyToCoach.isPending) && { opacity: 0.5 }]}
                onPress={handleBecomeCoach}
                disabled={!coachBio.trim() || applyToCoach.isPending}
              >
                {applyToCoach.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>SUBMIT</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centerContainer: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  headerWrapper: { position: 'relative', width: '100%', zIndex: 10, backgroundColor: theme.background },
  bannerContainer: { height: 280, width: '100%', backgroundColor: '#1C1C1E', borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
  bannerImage: { width: '100%', height: '100%', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E24',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  bannerPlaceholderText: { fontSize: 72, fontWeight: '900', color: 'rgba(255, 255, 255, 0.15)', letterSpacing: 2 },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
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
  largeActionBtn: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  contentBody: { backgroundColor: theme.background, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  badgeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  outlinedBadge: {
    borderWidth: 1.5,
    borderColor: theme.border,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  outlinedBadgeText: { color: theme.text, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  playerName: { fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5, textAlign: 'center' },
  locationSub: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, textAlign: 'center', marginBottom: 8 },
  statsCardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statColumn: { flex: 1, alignItems: 'center' },
  statHugeText: { fontSize: 22, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  statSubLabel: { fontSize: 11, fontWeight: '500', color: theme.textMuted, marginTop: 4 },
  statDivider: { width: 1.5, height: 32, backgroundColor: theme.border },
  socialStatsRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 10 },
  socialStatColumn: { alignItems: 'center' },
  socialStatValue: { fontSize: 15, fontWeight: '800', color: theme.text },
  socialStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  recordsCardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 10,
  },
  recordItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  recordColumn: { flex: 1, alignItems: 'center' },
  recordValue: { fontSize: 13, fontWeight: '800', color: theme.text, marginTop: 6, textAlign: 'center' },
  recordLabel: { fontSize: 10, fontWeight: '500', color: theme.textMuted, marginTop: 2, textAlign: 'center' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
  horizontalScroll: { gap: 12, paddingBottom: 4 },
  horizontalReviewCard: { width: 220, backgroundColor: theme.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: theme.border },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  smallAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
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
  smallAvatarPlaceholderText: { fontSize: 14, fontWeight: '800', color: theme.textMuted },
  cardInfoCol: { flex: 1 },
  cardOpponentName: { fontSize: 13, fontWeight: '800', color: theme.text },
  cardRatingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  cardResultText: { fontSize: 10, fontWeight: '700', color: theme.text },
  cardTimeText: { fontSize: 9, fontWeight: '500', color: theme.textMuted },
  emptyText: { color: theme.textMuted, fontSize: 12, fontStyle: 'italic' },
  section: { backgroundColor: theme.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.secondary,
    letterSpacing: 1.5,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingBottom: 6,
  },
  label: { fontSize: 11, fontWeight: '700', color: theme.text, letterSpacing: 0.8, marginBottom: 6 },
  helperText: { color: theme.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16 },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#191922', color: theme.text },
  inputFocused: { borderColor: theme.borderActive, backgroundColor: '#1c1c28' },
  row: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: chipRadius, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#1a1a24' },
  chipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  chipText: { color: theme.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#fff', fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: {
    backgroundColor: theme.primary,
    borderRadius: buttonRadius,
    padding: 16,
    alignItems: 'center',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  partnersSection: { gap: 8 },
  requestCard: { borderRadius: cardRadius, padding: 16, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  partnerRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: cardRadius,
    padding: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  partnerInfo: { flex: 1, marginRight: 12 },
  partnerCity: { color: theme.textMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  requestName: { fontSize: 15, fontWeight: '800', color: theme.text, textTransform: 'uppercase', letterSpacing: 0.2 },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallButton: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  smallButtonText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  acceptButton: { backgroundColor: theme.success },
  rejectButton: { backgroundColor: theme.danger },
  chatLinkBadge: { backgroundColor: 'rgba(255, 83, 27, 0.15)', borderWidth: 1, borderColor: theme.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  deleteChatBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatLinkText: { color: theme.accent, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  achievementsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  achievementBadgeContainer: { width: '28%', alignItems: 'center', marginBottom: 8 },
  achievementBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 92, 0, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 92, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  achievementBadgeLabel: { color: theme.text, fontSize: 8, fontWeight: '900', textAlign: 'center', letterSpacing: 0.2, lineHeight: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxHeight: '80%', backgroundColor: theme.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: theme.border },
  modalTitle: { color: theme.text, fontWeight: '900', fontSize: 13, letterSpacing: 1, marginBottom: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: buttonRadius, borderWidth: 1, borderColor: theme.border },
  modalCancelText: { color: theme.textMuted, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  modalConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: buttonRadius, backgroundColor: theme.accent },
  modalConfirmText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  leadCard: { borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: '#191922', padding: 12, marginTop: 10 },
  leadStatus: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 0.5 },
  leadStatusPending: { color: theme.accent },
});
