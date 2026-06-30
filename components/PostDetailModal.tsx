import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, cardRadius } from '@/constants/theme';
import {
  usePostComments,
  useAddComment,
  useItemVibs,
  useToggleVib,
  type PostComment,
} from '@/lib/queries';
import type { PostCardData } from '@/lib/queries';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PHOTO_H = SCREEN_H * 0.46;

function didWin(matchResult: NonNullable<PostCardData['matchResult']>, posterId: string) {
  const inTeamA =
    matchResult.team_a_player1 === posterId || matchResult.team_a_player2 === posterId;
  return (inTeamA && matchResult.winner === 'a') || (!inTeamA && matchResult.winner === 'b');
}

function opponentNames(matchResult: NonNullable<PostCardData['matchResult']>, posterId: string) {
  const inTeamA =
    matchResult.team_a_player1 === posterId || matchResult.team_a_player2 === posterId;
  const rivals = inTeamA
    ? [matchResult.team_b_player1_profile, matchResult.team_b_player2_profile]
    : [matchResult.team_a_player1_profile, matchResult.team_a_player2_profile];
  return rivals.map((p) => p?.full_name ?? 'Player').join(' & ');
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function CommentRow({ item }: { item: PostComment }) {
  return (
    <View style={styles.commentRow}>
      {item.profiles?.avatar_url ? (
        <Image source={{ uri: item.profiles.avatar_url }} style={styles.commentAvatar} />
      ) : (
        <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
          <Ionicons name="person" size={12} color={theme.textMuted} />
        </View>
      )}
      <View style={styles.commentBubble}>
        <Text style={styles.commentName}>{item.profiles?.full_name ?? 'Player'}</Text>
        <Text style={styles.commentBody}>{item.body}</Text>
      </View>
      <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
    </View>
  );
}

interface Props {
  post: PostCardData | null;
  userId: string | undefined;
  onClose: () => void;
}

export function PostDetailModal({ post, userId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  const { data: vibs } = useItemVibs('post', post?.id, userId);
  const { data: comments } = usePostComments(post?.id);
  const addComment = useAddComment();
  const toggleVib = useToggleVib();

  function handleSend() {
    const body = draft.trim();
    if (!body || !post?.id || !userId) return;
    setDraft('');
    addComment.mutate({ postId: post.id, profileId: userId, body });
  }

  function handleVib() {
    if (!post?.id || !userId) return;
    toggleVib.mutate({
      profileId: userId,
      itemType: 'post',
      itemId: post.id,
      currentlyVibbed: vibs?.vibbedByMe ?? false,
    });
  }

  const result = post?.matchResult ?? null;
  const win = result && post ? didWin(result, post.profile_id) : null;
  const scoreline = result ? result.sets.map((s) => `${s.a}-${s.b}`).join('  ') : null;
  const rivals = result && post ? opponentNames(result, post.profile_id) : null;
  const author = (post as any)?.profiles;

  const listHeader = (
    <>
      {/* Author row */}
      <View style={styles.authorRow}>
        {author?.avatar_url ? (
          <Image source={{ uri: author.avatar_url }} style={styles.authorAvatar} />
        ) : (
          <View style={[styles.authorAvatar, styles.authorAvatarPlaceholder]}>
            <Ionicons name="person" size={16} color={theme.textMuted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName}>{author?.full_name ?? 'Player'}</Text>
          <Text style={styles.authorTime}>{post ? timeAgo(post.created_at) : ''}</Text>
        </View>
      </View>

      {/* Match result */}
      {result && (
        <View style={[styles.matchBanner, { backgroundColor: win ? `${theme.accent}22` : `${theme.danger}22` }]}>
          <View style={[styles.matchBadge, { backgroundColor: win ? theme.accent : theme.danger }]}>
            <Text style={styles.matchBadgeText}>{win ? 'WIN' : 'LOSS'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {rivals && <Text style={styles.matchRivals} numberOfLines={1}>vs {rivals}</Text>}
            {scoreline && <Text style={styles.matchScore}>{scoreline}</Text>}
          </View>
        </View>
      )}

      {/* Caption */}
      {post?.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}

      {/* Action bar */}
      <View style={styles.actionBar}>
        <Pressable onPress={handleVib} style={styles.actionBtn} hitSlop={10}>
          <Ionicons
            name={vibs?.vibbedByMe ? 'heart' : 'heart-outline'}
            size={26}
            color={vibs?.vibbedByMe ? theme.primary : theme.text}
          />
          {(vibs?.count ?? 0) > 0 && (
            <Text style={[styles.actionCount, vibs?.vibbedByMe && { color: theme.primary }]}>
              {vibs!.count}
            </Text>
          )}
        </Pressable>
        <Pressable onPress={() => inputRef.current?.focus()} style={styles.actionBtn} hitSlop={10}>
          <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
          {(comments?.length ?? 0) > 0 && (
            <Text style={styles.actionCount}>{comments!.length}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.divider} />
      {(comments?.length ?? 0) > 0 && (
        <Text style={styles.commentsLabel}>Comments</Text>
      )}
    </>
  );

  return (
    <Modal visible={!!post} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>

        {/* Photo */}
        <View style={styles.photoWrap}>
          {post?.photo_url && (
            <Image source={{ uri: post.photo_url }} style={styles.photo} resizeMode="cover" />
          )}
          {win !== null && (
            <View style={[styles.photoBadge, { backgroundColor: win ? theme.accent : theme.danger }]}>
              <Text style={styles.photoBadgeText}>{win ? 'WIN' : 'LOSS'}</Text>
            </View>
          )}
        </View>

        {/* Content + comments */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.bottom}
        >
          <FlatList
            data={comments ?? []}
            keyExtractor={(c) => c.id}
            ListHeaderComponent={listHeader}
            renderItem={({ item }) => <CommentRow item={item} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.noComments}>No comments yet</Text>
            }
          />

          {/* Input */}
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 4 }]}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
              maxLength={500}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || addComment.isPending}
              style={[styles.sendBtn, (!draft.trim() || addComment.isPending) && { opacity: 0.4 }]}
            >
              <Ionicons name="send" size={18} color={theme.onAccent} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },


  photoWrap: {
    width: SCREEN_W,
    height: PHOTO_H,
    backgroundColor: '#000',
  },
  photo: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoBadgeText: { color: theme.onAccent, fontSize: 11, fontWeight: '900' },

  listContent: { paddingBottom: 12 },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  authorAvatar: { width: 36, height: 36, borderRadius: 18 },
  authorAvatarPlaceholder: { backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center' },
  authorName: { color: theme.text, fontWeight: '700', fontSize: 14 },
  authorTime: { color: theme.textMuted, fontSize: 11, marginTop: 1 },

  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: cardRadius,
    padding: 10,
  },
  matchBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  matchBadgeText: { color: theme.onAccent, fontSize: 10, fontWeight: '900' },
  matchRivals: { color: theme.text, fontSize: 12, fontWeight: '700' },
  matchScore: { color: theme.accent, fontSize: 16, fontFamily: 'Anton_400Regular', marginTop: 2 },

  caption: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },

  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: theme.text, fontSize: 14, fontWeight: '700' },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginHorizontal: 14, marginBottom: 8 },
  commentsLabel: { color: theme.textMuted, fontSize: 11, fontWeight: '700', paddingHorizontal: 14, marginBottom: 6, letterSpacing: 0.5 },

  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, marginBottom: 12 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentAvatarPlaceholder: { backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center' },
  commentBubble: { flex: 1, backgroundColor: theme.card, borderRadius: 14, padding: 8 },
  commentName: { color: theme.accent, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  commentBody: { color: theme.text, fontSize: 13, lineHeight: 18 },
  commentTime: { color: theme.textMuted, fontSize: 10, marginTop: 6 },

  noComments: { color: theme.textMuted, textAlign: 'center', paddingVertical: 20, fontSize: 13 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  input: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: theme.text,
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    backgroundColor: theme.accent,
    borderRadius: 20,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
