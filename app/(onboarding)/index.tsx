import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import { useSession } from '@/lib/useSession';
import { useProfile, useUpdateProfile } from '@/lib/queries';
import { pickAndUploadAvatar } from '@/lib/uploadAvatar';
import { VerifiedLocation } from '@/components/VerifiedLocation';
import { theme, buttonRadius, chipRadius, cardRadius } from '@/constants/theme';
import { LEVELS, LEVEL_LABELS, LEVEL_DESCRIPTIONS } from '@/constants/levels';
import {
  COMPETITION_OPTIONS,
  FREQUENCY_OPTIONS,
  YEARS_PLAYING_OPTIONS,
  computeStartingElo,
  type CompetitionExperience,
  type WeeklyFrequency,
  type YearsPlaying,
} from '@/lib/eloPlacement';
import type { DominantHand, PlayerLevel, Sex } from '@/types/database';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const HAND_OPTIONS: { value: DominantHand; label: string }[] = [
  { value: 'right', label: 'Right-handed' },
  { value: 'left', label: 'Left-handed' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const updateProfile = useUpdateProfile();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [level, setLevel] = useState<PlayerLevel>('intermedio');
  const [yearsPlaying, setYearsPlaying] = useState<YearsPlaying>('1to3');
  const [competition, setCompetition] = useState<CompetitionExperience>('none');
  const [frequency, setFrequency] = useState<WeeklyFrequency>('oneToTwo');
  const [heightCm, setHeightCm] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [dominantHand, setDominantHand] = useState<DominantHand | null>(null);
  const [club, setClub] = useState('');
  const [racket, setRacket] = useState('');
  const [apparelBrand, setApparelBrand] = useState('');
  const [zone, setZone] = useState('');
  const [country, setCountry] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lookingForPartner, setLookingForPartner] = useState(true);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setAvatarUrl(profile.avatar_url);
    if (profile.level) setLevel(profile.level);
    if (profile.height_cm) setHeightCm(String(profile.height_cm));
    setSex(profile.sex);
    setDominantHand(profile.dominant_hand);
    setClub(profile.club ?? '');
    setRacket(profile.racket ?? '');
    setApparelBrand(profile.apparel_brand ?? '');
    setZone(profile.zone ?? '');
    setCountry(profile.country ?? '');
    setLookingForPartner(profile.looking_for_partner);
  }, [profile]);

  async function handlePickAvatar() {
    if (!userId) return;
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadAvatar(userId);
      if (url) setAvatarUrl(url);
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleFinish() {
    if (!userId) return;
    if (!zone || !country) {
      setLocationError('Verify your location to continue — this keeps City/Country rankings honest.');
      return;
    }
    setLocationError(null);
    updateProfile.mutate(
      {
        id: userId,
        level,
        elo: computeStartingElo({ level, yearsPlaying, competition, frequency }),
        height_cm: heightCm ? Number(heightCm) : null,
        sex,
        dominant_hand: dominantHand,
        club: club || null,
        racket: racket || null,
        apparel_brand: apparelBrand || null,
        zone: zone || null,
        country: country || null,
        looking_for_partner: lookingForPartner,
        avatar_url: avatarUrl,
        onboarding_completed: true,
      },
      {
        onSuccess: () => router.replace('/(tabs)'),
      }
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.tagline}>CREATE ATHLETE PROFILE</Text>
        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.subtitle}>This helps us match you with the right players and matches.</Text>
      </View>

      <Pressable 
        style={({ pressed }) => [
          styles.avatarPicker, 
          pressed && { opacity: 0.8 },
          avatarUrl ? styles.avatarPickerActive : null
        ]} 
        onPress={handlePickAvatar} 
        disabled={uploadingAvatar}
      >
        {uploadingAvatar ? (
          <ActivityIndicator color={theme.accent} />
        ) : avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderPlus}>+</Text>
            <Text style={styles.avatarPlaceholderText}>ADD PHOTO</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.label}>SKILL LEVEL</Text>
        <View style={styles.chipRow}>
          {LEVELS.map((l) => (
            <Pressable
              key={l}
              style={({ pressed }) => [
                styles.chip,
                level === l && styles.chipActive,
                pressed && { scale: 0.96 } as any
              ]}
              onPress={() => setLevel(l)}>
              <Text style={[styles.chipText, level === l && styles.chipTextActive]}>{LEVEL_LABELS[l]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>{LEVEL_DESCRIPTIONS[level]}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>HOW LONG HAVE YOU BEEN PLAYING?</Text>
        <View style={styles.chipRow}>
          {YEARS_PLAYING_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              style={({ pressed }) => [styles.chip, yearsPlaying === o.value && styles.chipActive, pressed && { scale: 0.96 } as any]}
              onPress={() => setYearsPlaying(o.value)}>
              <Text style={[styles.chipText, yearsPlaying === o.value && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>COMPETITIVE EXPERIENCE</Text>
        <View style={styles.chipRow}>
          {COMPETITION_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              style={({ pressed }) => [styles.chip, competition === o.value && styles.chipActive, pressed && { scale: 0.96 } as any]}
              onPress={() => setCompetition(o.value)}>
              <Text style={[styles.chipText, competition === o.value && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>HOW OFTEN DO YOU PLAY?</Text>
        <View style={styles.chipRow}>
          {FREQUENCY_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              style={({ pressed }) => [styles.chip, frequency === o.value && styles.chipActive, pressed && { scale: 0.96 } as any]}
              onPress={() => setFrequency(o.value)}>
              <Text style={[styles.chipText, frequency === o.value && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helperText}>
          Starting PS Score: {computeStartingElo({ level, yearsPlaying, competition, frequency })} — this is just your
          starting point, it'll move quickly once you play real matches.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>HEIGHT (CM)</Text>
        <TextInput
          style={[styles.input, focusedInput === 'height' && styles.inputFocused]}
          keyboardType="number-pad"
          placeholder="e.g. 178"
          placeholderTextColor={theme.textMuted}
          value={heightCm}
          onChangeText={setHeightCm}
          onFocus={() => setFocusedInput('height')}
          onBlur={() => setFocusedInput(null)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>SEX</Text>
        <View style={styles.chipRow}>
          {SEX_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              style={({ pressed }) => [
                styles.chip,
                sex === o.value && styles.chipActive,
                pressed && { scale: 0.96 } as any
              ]}
              onPress={() => setSex(o.value)}>
              <Text style={[styles.chipText, sex === o.value && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>DOMINANT HAND</Text>
        <View style={styles.chipRow}>
          {HAND_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              style={({ pressed }) => [
                styles.chip,
                dominantHand === o.value && styles.chipActive,
                pressed && { scale: 0.96 } as any
              ]}
              onPress={() => setDominantHand(o.value)}>
              <Text style={[styles.chipText, dominantHand === o.value && styles.chipTextActive]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>EQUIPMENT</Text>

        <Text style={styles.label}>CLUB OR COURT</Text>
        <TextInput
          style={[styles.input, focusedInput === 'club' && styles.inputFocused]}
          placeholder="Your home club"
          placeholderTextColor={theme.textMuted}
          value={club}
          onChangeText={setClub}
          onFocus={() => setFocusedInput('club')}
          onBlur={() => setFocusedInput(null)}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>RACKET MODEL</Text>
        <TextInput
          style={[styles.input, focusedInput === 'racket' && styles.inputFocused]}
          placeholder="e.g. Babolat Technical Viper"
          placeholderTextColor={theme.textMuted}
          value={racket}
          onChangeText={setRacket}
          onFocus={() => setFocusedInput('racket')}
          onBlur={() => setFocusedInput(null)}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>PREFERRED APPAREL BRAND</Text>
        <TextInput
          style={[styles.input, focusedInput === 'apparel' && styles.inputFocused]}
          placeholder="e.g. Bullpadel, Nike"
          placeholderTextColor={theme.textMuted}
          value={apparelBrand}
          onChangeText={setApparelBrand}
          onFocus={() => setFocusedInput('apparel')}
          onBlur={() => setFocusedInput(null)}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>LOCATION</Text>
        <Text style={styles.helperText}>
          Verified by GPS, not typed in — this is what keeps City/Country rankings fair for everyone.
        </Text>
        <View style={{ marginTop: 10 }}>
          <VerifiedLocation
            city={zone || null}
            country={country || null}
            onDetected={(loc) => {
              setZone(loc.city);
              setCountry(loc.country);
              setLocationError(null);
            }}
          />
        </View>
        {locationError && <Text style={styles.locationErrorText}>{locationError}</Text>}
      </View>

      <View style={[styles.section, styles.switchRow]}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={[styles.label, { marginTop: 0 }]}>PARTNER SEARCH</Text>
          <Text style={styles.helperText}>Make your profile visible in the "Partners" finder.</Text>
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
          updateProfile.isPending && styles.buttonDisabled
        ]} 
        onPress={handleFinish} 
        disabled={updateProfile.isPending}
      >
        {updateProfile.isPending ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <Text style={styles.buttonText}>Save Profile & Finish</Text>
        )}
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20, backgroundColor: theme.background },
  headerContainer: { marginBottom: 8, marginTop: 12 },
  tagline: { fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' },
  title: { fontSize: 32, fontWeight: '900', color: theme.text, textTransform: 'uppercase', letterSpacing: -0.5 },
  subtitle: { color: theme.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18, fontWeight: '700' },
  avatarPicker: {
    alignSelf: 'center',
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: theme.card,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  avatarPickerActive: {
    borderColor: theme.primary,
  },
  avatarImage: { width: 108, height: 108 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholderPlus: { fontSize: 24, fontWeight: 'bold', color: theme.primary, marginBottom: 2 },
  avatarPlaceholderText: { color: theme.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  section: { backgroundColor: theme.card, borderRadius: cardRadius, padding: 16, borderWidth: 1, borderColor: theme.border },
  sectionHeader: { fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 1.5, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 6, textTransform: 'uppercase' },
  label: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' },
  helperText: { color: theme.textMuted, marginTop: 6, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  input: { 
    borderWidth: 1, 
    borderColor: theme.border, 
    borderRadius: 14, 
    padding: 14, 
    fontSize: 14, 
    fontWeight: '800',
    backgroundColor: theme.card, 
    color: theme.text,
    letterSpacing: 0.5,
  },
  inputFocused: {
    borderColor: theme.borderActive,
    backgroundColor: '#1B1C24',
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  chip: { 
    borderWidth: 1, 
    borderColor: theme.border, 
    borderRadius: 16, 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    backgroundColor: theme.card 
  },
  chipActive: { 
    backgroundColor: 'rgba(255, 92, 0, 0.15)', 
    borderColor: theme.primary,
  },
  chipText: { color: theme.textMuted, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  chipTextActive: { color: theme.primary, fontWeight: '900' },
  locationErrorText: { color: theme.danger, fontSize: 12, marginTop: 8, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  button: { 
    backgroundColor: theme.primary, 
    borderRadius: buttonRadius, 
    padding: 14, 
    alignItems: 'center', 
    marginTop: 12, 
    marginBottom: 40,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: { color: theme.onAccent, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
});
