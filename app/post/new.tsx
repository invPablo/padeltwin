import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, cardRadius, buttonRadius } from '@/constants/theme';
import { useSession } from '@/lib/useSession';
import { useCreatePost, useRecentResults } from '@/lib/queries';
import { pickPostPhoto, uploadPostPhoto } from '@/lib/uploadPostPhoto';

const SCREEN_W = Dimensions.get('window').width;
const CAPTION_LIMIT = 150;

function matchScore(
  result: { sets: { a: number; b: number }[]; winner: string; team_a_player1: string | null; team_a_player2: string | null },
  userId: string
) {
  const inTeamA = result.team_a_player1 === userId || result.team_a_player2 === userId;
  const setsWon = result.sets.reduce(
    (acc, s) => {
      if (s.a > s.b) return { my: acc.my + (inTeamA ? 1 : 0), opp: acc.opp + (inTeamA ? 0 : 1) };
      return { my: acc.my + (inTeamA ? 0 : 1), opp: acc.opp + (inTeamA ? 1 : 0) };
    },
    { my: 0, opp: 0 }
  );
  const win = (inTeamA && result.winner === 'a') || (!inTeamA && result.winner === 'b');
  return { win, score: `${setsWon.my}-${setsWon.opp}` };
}

export default function NewPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: recentResults } = useRecentResults(userId, 10);
  const createPost = useCreatePost();

  const [photo, setPhoto] = useState<{ uri: string; base64: string; ext: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [linkedMatchId, setLinkedMatchId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const progressAnim = useRef(new Animated.Value(0)).current;

  // Open gallery immediately on mount
  useEffect(() => {
    openPicker(true);
  }, []);

  async function openPicker(isFirst = false) {
    const picked = await pickPostPhoto();
    if (!picked) {
      if (isFirst) router.back();
      return;
    }
    setPhoto({ uri: `data:image/jpeg;base64,${picked.base64}`, base64: picked.base64, ext: picked.ext });
  }

  async function handlePost() {
    if (!userId || !photo) return;
    setUploading(true);

    // Fake progress animation so upload feels responsive
    Animated.timing(progressAnim, { toValue: 0.7, duration: 1200, useNativeDriver: false }).start();

    try {
      const photoUrl = await uploadPostPhoto(userId, photo.base64, photo.ext);
      Animated.timing(progressAnim, { toValue: 1, duration: 250, useNativeDriver: false }).start();

      createPost.mutate(
        { profileId: userId, photoUrl, caption, matchId: linkedMatchId },
        { onSuccess: () => router.back() }
      );
    } catch {
      progressAnim.setValue(0);
      setUploading(false);
    }
  }

  const busy = uploading || createPost.isPending;
  const canPost = !!photo && !busy;

  if (!photo) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={styles.loadingText}>Opening gallery…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Post</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Photo */}
        <View style={styles.photoWrap}>
          <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
          {/* Upload progress bar */}
          {busy && (
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          )}
          {/* Change photo button */}
          {!busy && (
            <Pressable onPress={() => openPicker()} style={styles.changePhotoBtn} hitSlop={6}>
              <Ionicons name="camera" size={16} color="#FFF" />
              <Text style={styles.changePhotoBtnText}>Change</Text>
            </Pressable>
          )}
        </View>

        {/* Caption */}
        <View style={styles.captionWrap}>
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption…"
            placeholderTextColor={theme.textMuted}
            value={caption}
            onChangeText={(t) => setCaption(t.slice(0, CAPTION_LIMIT))}
            multiline
            autoFocus={false}
          />
          <Text style={[styles.charCount, caption.length > CAPTION_LIMIT * 0.85 && { color: theme.danger }]}>
            {caption.length}/{CAPTION_LIMIT}
          </Text>
        </View>

        {/* Match link */}
        {recentResults && recentResults.length > 0 && (
          <View style={styles.matchSection}>
            <View style={styles.matchSectionHeader}>
              <Ionicons name="flash" size={13} color={theme.accent} />
              <Text style={styles.matchSectionTitle}>Link a match</Text>
              <Text style={styles.matchSectionOptional}>optional</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {recentResults.slice(0, 8).map((r) => {
                const { win, score } = matchScore(r, userId!);
                const selected = linkedMatchId === r.match_id;
                return (
                  <Pressable
                    key={r.id}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => setLinkedMatchId(selected ? null : r.match_id)}
                  >
                    <Text style={[styles.chipResult, { color: win ? theme.accent : theme.danger }, selected && { color: theme.onAccent }]}>
                      {win ? 'WIN' : 'LOSS'}
                    </Text>
                    <Text style={[styles.chipScore, selected && styles.chipTextActive]}>{score}</Text>
                    <Text style={[styles.chipDate, selected && styles.chipTextActive]}>
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Share button — anchored at bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable onPress={handlePost} disabled={!canPost} style={[styles.shareBtn, !canPost && { opacity: 0.45 }]}>
          {busy ? (
            <ActivityIndicator size="small" color={theme.onAccent} />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color={theme.onAccent} />
              <Text style={styles.shareBtnText}>SHARE POST</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: { color: theme.textMuted, fontSize: 13 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconBtn: { padding: 6 },
  headerTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },

  scroll: { gap: 0, paddingBottom: 20 },

  photoWrap: {
    width: SCREEN_W,
    aspectRatio: 1,
    backgroundColor: '#000',
  },
  photo: { width: '100%', height: '100%' },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: theme.accent,
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  changePhotoBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  captionWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  captionInput: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: {
    color: theme.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },

  matchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  matchSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchSectionTitle: { color: theme.text, fontWeight: '700', fontSize: 13 },
  matchSectionOptional: { color: theme.textMuted, fontSize: 11, marginLeft: 2 },
  chipsRow: { gap: 8, paddingVertical: 2 },

  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: cardRadius,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.card,
    alignItems: 'center',
    gap: 2,
  },
  chipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipResult: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  chipScore: { color: theme.text, fontSize: 16, fontWeight: '800' },
  chipDate: { color: theme.textMuted, fontSize: 10 },
  chipTextActive: { color: theme.onAccent },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  shareBtn: {
    backgroundColor: theme.accent,
    borderRadius: buttonRadius,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnText: { color: theme.onAccent, fontWeight: '900', fontSize: 14, letterSpacing: 0.8 },
});
