import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, cardRadius } from '@/constants/theme';
import type { PostCardData } from '@/lib/queries';

function didWin(matchResult: NonNullable<PostCardData['matchResult']>, posterId: string) {
  const inTeamA = matchResult.team_a_player1 === posterId || matchResult.team_a_player2 === posterId;
  return (inTeamA && matchResult.winner === 'a') || (!inTeamA && matchResult.winner === 'b');
}

function opponentNames(matchResult: NonNullable<PostCardData['matchResult']>, posterId: string) {
  const inTeamA = matchResult.team_a_player1 === posterId || matchResult.team_a_player2 === posterId;
  const rivals = inTeamA
    ? [matchResult.team_b_player1_profile, matchResult.team_b_player2_profile]
    : [matchResult.team_a_player1_profile, matchResult.team_a_player2_profile];
  return rivals.map((p) => p?.full_name ?? 'Player').join(' & ');
}

interface MatchCardProps {
  post: PostCardData;
  posterId: string;
  width: number;
  height?: number;
  onPress?: () => void;
  vibCount?: number;
  vibbedByMe?: boolean;
  onToggleVib?: () => void;
}

export function MatchCard({ post, posterId, width, height, onPress, vibCount, vibbedByMe, onToggleVib }: MatchCardProps) {
  const result = post.matchResult;
  const win = result ? didWin(result, posterId) : null;
  const scoreline = result ? result.sets.map((s) => `${s.a}-${s.b}`).join('  ') : null;
  const rivals = result ? opponentNames(result, posterId) : null;

  const frameColor = win === true ? theme.accent : win === false ? theme.danger : theme.border;

  return (
    <Pressable onPress={onPress} style={[styles.card, { width, height: height ?? width * 1.25, borderColor: frameColor }]}>
      <Image source={{ uri: post.photo_url }} style={StyleSheet.absoluteFillObject as any} />
      <View style={styles.scrim} />

      {win !== null && (
        <View style={[styles.resultBadge, { backgroundColor: win ? theme.accent : theme.danger }]}>
          <Text style={styles.resultBadgeText}>{win ? 'WIN' : 'LOSS'}</Text>
        </View>
      )}

      <View style={styles.bottomOverlay}>
        {rivals && <Text style={styles.opponentText} numberOfLines={1}>vs {rivals}</Text>}
        {scoreline && <Text style={styles.scoreText}>{scoreline}</Text>}
        {post.caption && <Text style={styles.captionText} numberOfLines={2}>{post.caption}</Text>}

        <View style={styles.footerRow}>
          <Text style={styles.dateText}>{new Date(post.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</Text>
          {onToggleVib && (
            <Pressable onPress={onToggleVib} style={styles.vibBtn} hitSlop={8}>
              <Ionicons name={vibbedByMe ? 'heart' : 'heart-outline'} size={16} color={vibbedByMe ? theme.primary : '#FFF'} />
              {!!vibCount && <Text style={styles.vibCount}>{vibCount}</Text>}
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: cardRadius,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: theme.card,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  resultBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultBadgeText: { color: theme.onAccent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  opponentText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  scoreText: { color: theme.accent, fontSize: 15, fontFamily: 'Anton_400Regular', marginTop: 2 },
  captionText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 4 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  dateText: { color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '700' },
  vibBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  vibCount: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});
