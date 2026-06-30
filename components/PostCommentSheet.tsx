import { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { usePostComments, useAddComment, type PostComment } from '@/lib/queries';

interface Props {
  postId: string | null;
  userId: string | undefined;
  onClose: () => void;
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function CommentRow({ item, userId }: { item: PostComment; userId: string | undefined }) {
  return (
    <View style={styles.row}>
      {item.profiles?.avatar_url ? (
        <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={14} color={theme.textMuted} />
        </View>
      )}
      <View style={styles.bubble}>
        <Text style={styles.commentName}>{item.profiles?.full_name ?? 'Player'}</Text>
        <Text style={styles.commentBody}>{item.body}</Text>
      </View>
      <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
    </View>
  );
}

export function PostCommentSheet({ postId, userId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { data: comments, isLoading } = usePostComments(postId ?? undefined);
  const addComment = useAddComment();

  function handleSend() {
    const body = draft.trim();
    if (!body || !postId || !userId) return;
    setDraft('');
    addComment.mutate({ postId, profileId: userId, body });
  }

  return (
    <Modal visible={!!postId} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={comments ?? []}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <CommentRow item={item} userId={userId} />}
            ListEmptyComponent={
              <Text style={styles.empty}>No comments yet. Be the first!</Text>
            }
          />
        )}

        <View style={styles.inputRow}>
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
            style={[styles.sendBtn, (!draft.trim() || addComment.isPending) && styles.sendBtnDisabled]}
          >
            <Ionicons name="send" size={18} color={theme.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingTop: 8,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  headerTitle: { color: theme.text, fontSize: 15, fontWeight: '700' },
  list: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: { backgroundColor: theme.nav, justifyContent: 'center', alignItems: 'center' },
  bubble: { flex: 1, backgroundColor: theme.nav, borderRadius: cardRadius, padding: 10 },
  commentName: { color: theme.accent, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  commentBody: { color: theme.text, fontSize: 13, lineHeight: 18 },
  timeAgo: { color: theme.textMuted, fontSize: 10, marginTop: 4 },
  empty: { color: theme.textMuted, textAlign: 'center', marginTop: 40, fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.nav,
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
  sendBtnDisabled: { opacity: 0.4 },
});
