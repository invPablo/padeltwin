import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  useApplyToCoach,
  useStopCoaching,
  useMyCoachLeads,
  useUpdateLeadStatus,
  useBlockedProfiles,
  useUnblockUser,
  useDeleteAccount,
  useMyKopStatus,
} from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { PartnerRequestWithProfiles, PlayerLevel } from '@/types/database';
import { theme, buttonRadius, cardRadius } from '@/constants/theme';
import { VerifiedLocation } from '@/components/VerifiedLocation';
import { Card } from '@/components/Card';
import { BackHeader } from '@/components/BackHeader';

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: kopStatus } = useMyKopStatus(userId);
  const updateProfile = useUpdateProfile();
  const { data: requests } = usePartnerRequests(userId);
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
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const pendingReceived = (requests ?? []).filter((r) => r.status === 'pending' && r.to_id === userId);
  const accepted = (requests ?? []).filter((r) => r.status === 'accepted' && !hiddenChats?.has(r.id));

  function otherProfile(r: PartnerRequestWithProfiles) {
    return r.from_id === userId ? r.to_profile : r.from_profile;
  }

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [zone, setZone] = useState('');
  const [country, setCountry] = useState('');
  const [level, setLevel] = useState<PlayerLevel | null>(null);
  const [club, setClub] = useState('');
  const [lookingForPartner, setLookingForPartner] = useState(true);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setBio(profile.bio ?? '');
      setZone(profile.zone ?? '');
      setCountry(profile.country ?? '');
      setLevel(profile.level);
      setClub(profile.club ?? '');
      setLookingForPartner(profile.looking_for_partner);
    }
  }, [profile]);

  if (!userId || !profile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  function handleSave() {
    updateProfile.mutate({
      id: userId!,
      full_name: fullName,
      bio: bio.trim() || null,
      zone,
      country: country || null,
      level,
      club: club || null,
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.contentBody} showsVerticalScrollIndicator={false}>
        {/* ATHLETE DETAILS */}
        <Card style={styles.section} contentStyle={{ padding: 16 }}>
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

          <Text style={[styles.label, { marginTop: 14 }]}>BIO</Text>
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }, focusedInput === 'bio' && styles.inputFocused]}
            value={bio}
            onChangeText={setBio}
            placeholder="A short line about you and your game"
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={120}
            onFocus={() => setFocusedInput('bio')}
            onBlur={() => setFocusedInput(null)}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>LOCATION</Text>
          <VerifiedLocation
            city={zone || null}
            country={country || null}
            onDetected={(loc) => {
              setZone(loc.city);
              setCountry(loc.country);
            }}
          />

          <Pressable style={styles.linkRow} onPress={() => router.push('/pairs' as any)}>
            <Text style={styles.linkRowText}>👥 MY PAIR — Manage your fixed partner</Text>
            <Text style={styles.linkRowArrow}>{'>'}</Text>
          </Pressable>
        </Card>

        {/* KOP STATUS */}
        <Card style={styles.section} contentStyle={{ padding: 16 }}>
          <Text style={styles.sectionHeader}>KOP STATUS</Text>
          <Text style={styles.helperText}>
            KOP is contested by your ranked pair, not solo — join a club's board from the KOP tab.
          </Text>

          <Pressable style={styles.kopCrownRow} onPress={() => router.push('/club-leaderboard' as any)}>
            <Ionicons name="trophy" size={28} color={theme.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.kopCrownValue}>
                {kopStatus?.crownedClubs.length ?? 0} CROWN{(kopStatus?.crownedClubs.length ?? 0) === 1 ? '' : 'S'}
              </Text>
              <Text style={styles.kopCrownSub}>
                {kopStatus && kopStatus.joinedClubs.length > 0
                  ? `Held across ${kopStatus.joinedClubs.length} joined club${kopStatus.joinedClubs.length === 1 ? '' : 's'}`
                  : 'Not contesting any club yet'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>

          <Text style={[styles.label, { marginTop: 14 }]}>HOME CLUB</Text>
          <TextInput
            style={[styles.input, focusedInput === 'club' && styles.inputFocused]}
            value={club}
            onChangeText={setClub}
            placeholder="Your club or court"
            placeholderTextColor={theme.textMuted}
            onFocus={() => setFocusedInput('club')}
            onBlur={() => setFocusedInput(null)}
          />
          <Text style={styles.helperText}>Shown on your profile — doesn't by itself enter you into KOP.</Text>
        </Card>

        <Card style={styles.section} contentStyle={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
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
        </Card>

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
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Save Changes</Text>
          )}
        </Pressable>

        {/* COACH */}
        {profile.coach_status === 'approved' ? (
          <Card style={styles.section} contentStyle={{ padding: 16 }}>
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
          </Card>
        ) : profile.coach_status === 'pending' ? (
          <Card style={styles.section} contentStyle={{ padding: 16 }}>
            <Text style={styles.sectionHeader}>COACH APPLICATION</Text>
            <Text style={styles.helperText}>
              Your application is under review. We'll list you in the coach directory once it's approved.
            </Text>
          </Card>
        ) : !profile.is_pro ? (
          <Card style={styles.section} contentStyle={{ padding: 16 }}>
            <Text style={styles.sectionHeader}>ARE YOU A PADEL COACH?</Text>
            <Text style={styles.helperText}>
              Listing as a coach is a Pro feature. Upgrade to Pro to apply for a spot in the coach directory.
            </Text>
            <Text style={[styles.label, { color: theme.textMuted, marginTop: 10 }]}>PRO REQUIRED</Text>
          </Card>
        ) : (
          <Card style={styles.section} contentStyle={{ padding: 16 }}>
            <Pressable
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
              onPress={() => setCoachModalVisible(true)}
            >
              <Text style={styles.sectionHeader}>ARE YOU A PADEL COACH?</Text>
              <Text style={styles.helperText}>Apply to be listed in the coach directory and get lesson requests from players near you. Subject to review.</Text>
              <Text style={[styles.label, { color: theme.accent, marginTop: 10 }]}>APPLY TO BECOME A COACH →</Text>
            </Pressable>
          </Card>
        )}

        {/* PARTNER REQUESTS / CHATS */}
        {pendingReceived.length > 0 && (
          <View style={styles.partnersSection}>
            <Text style={styles.sectionTitle}>PARTNER REQUESTS</Text>
            {pendingReceived.map((r) => (
              <Card key={r.id} style={styles.requestCard} contentStyle={{ padding: 16 }}>
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
              </Card>
            ))}
          </View>
        )}

        {accepted.length > 0 && (
          <View style={styles.partnersSection}>
            <Text style={styles.sectionTitle}>MY PARTNERS</Text>
            {accepted.map((r) => (
              <Card key={r.id} style={styles.partnerRequestCard}>
                <Pressable
                  style={({ pressed }) => [
                    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
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
              </Card>
            ))}
          </View>
        )}

        {/* PRIVACY & SAFETY */}
        <Card style={styles.section} contentStyle={{ padding: 16 }}>
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
                  <Pressable onPress={() => userId && unblockUser.mutate({ blockerId: userId, blockedId: b.id })}>
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
        </Card>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
          onPress={() => supabase.auth.signOut()}
        >
          <Ionicons name="log-out-outline" size={16} color={theme.danger} />
          <Text style={styles.logoutBtnText}>LOG OUT</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={coachModalVisible} transparent animationType="fade" onRequestClose={() => setCoachModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ gap: 10 }}>
            <Text style={styles.modalTitle}>Coach application</Text>
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
                {applyToCoach.isPending ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.modalConfirmText}>SUBMIT</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  contentBody: { padding: 20, gap: 16, paddingBottom: 60 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12, padding: 14,
  },
  linkRowText: { color: theme.text, fontWeight: '700', fontSize: 13 },
  linkRowArrow: { color: theme.textMuted, fontWeight: '700' },
  kopCrownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 12, padding: 14,
  },
  kopCrownValue: { color: theme.text, fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  kopCrownSub: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  section: { borderRadius: 16 },
  sectionHeader: {
    fontSize: 12, fontWeight: '800', color: theme.secondary, letterSpacing: 1.5, marginBottom: 16,
    borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 6,
  },
  sectionTitle: { fontSize: 16, color: theme.text, textTransform: 'uppercase' },
  label: { fontSize: 11, fontWeight: '700', color: theme.text, letterSpacing: 0.8, marginBottom: 6 },
  helperText: { color: theme.textMuted, fontSize: 12, marginTop: 6, lineHeight: 16 },
  input: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: 'rgba(255, 255, 255, 0.03)', color: theme.text },
  inputFocused: { borderColor: theme.accent, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  button: {
    backgroundColor: theme.primary, borderRadius: buttonRadius, padding: 16, alignItems: 'center',
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: theme.onAccent, fontSize: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  partnersSection: { gap: 8 },
  requestCard: { borderRadius: cardRadius },
  partnerRequestCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: cardRadius },
  partnerInfo: { flex: 1, marginRight: 12 },
  partnerCity: { color: theme.textMuted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  requestName: { fontSize: 15, fontWeight: '700', color: theme.text },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallButton: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  smallButtonText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  acceptButton: { backgroundColor: theme.success },
  rejectButton: { backgroundColor: theme.danger },
  chatLinkBadge: { backgroundColor: 'rgba(198, 255, 51, 0.15)', borderWidth: 1, borderColor: theme.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  deleteChatBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  chatLinkText: { color: theme.accent, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  leadCard: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 12, marginTop: 10 },
  leadStatus: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 0.5 },
  leadStatusPending: { color: theme.accent },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: theme.danger, borderRadius: buttonRadius, paddingVertical: 14, marginTop: 4,
  },
  logoutBtnText: { color: theme.danger, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxHeight: '80%', backgroundColor: theme.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: theme.border },
  modalTitle: { color: theme.text, fontWeight: '700', fontSize: 15, marginBottom: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: buttonRadius, borderWidth: 1, borderColor: theme.border },
  modalCancelText: { color: theme.textMuted, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  modalConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: buttonRadius, backgroundColor: theme.accent },
  modalConfirmText: { color: theme.onAccent, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
});
