import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCompatiblePlayers, useProfile, usePartnerRequests, useSendPartnerRequest, useFollowing, useFollowPlayer, useUnfollowPlayer, useFollowedProfiles } from '@/lib/queries';
import type { PartnerRequestWithProfiles, Profile } from '@/types/database';
import { theme, buttonRadius, cardRadius, chipRadius } from '@/constants/theme';
import { LEVEL_LABELS } from '@/constants/levels';
import { ProBadge } from '@/components/ProBadge';
import { CoachBadge } from '@/components/CoachBadge';
import { Card } from '@/components/Card';

function requestWith(requests: PartnerRequestWithProfiles[], userId: string, otherId: string) {
  return requests.find(
    (r) => (r.from_id === userId && r.to_id === otherId) || (r.from_id === otherId && r.to_id === userId)
  );
}

export default function PartnersScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  
  // Data Queries
  const { data: profile } = useProfile(userId);
  const { data: players, isLoading } = useCompatiblePlayers(userId, profile);
  const { data: requests } = usePartnerRequests(userId);
  const sendRequest = useSendPartnerRequest();
  const { data: following } = useFollowing(userId);
  const followPlayer = useFollowPlayer();
  const unfollowPlayer = useUnfollowPlayer();
  const queryClient = useQueryClient();
  const { data: followedProfiles, isLoading: followedLoading } = useFollowedProfiles(userId);

  // UI Navigation State
  const [activeTab, setActiveTab] = useState<'grid' | 'followed'>('grid');

  // Grid list card item renderer
  function renderGridItem({ item }: { item: Profile }) {
    const existing = userId && requests ? requestWith(requests, userId, item.id) : undefined;

    let buttonLabel = 'CONNECT';
    let disabled = false;
    let buttonVariant: 'primary' | 'pending' | 'connected' = 'primary';
    
    if (existing) {
      disabled = true;
      if (existing.status === 'pending') {
        buttonLabel = 'PENDING';
        buttonVariant = 'pending';
      } else if (existing.status === 'accepted') {
        buttonLabel = 'CONNECTED';
        buttonVariant = 'connected';
      } else {
        buttonLabel = 'DECLINED';
        buttonVariant = 'pending';
      }
    }

    const isFollowing = following?.has(item.id);
    const followPending = followPlayer.isPending || unfollowPlayer.isPending;

    const handleFollowPress = () => {
      if (!userId || followPending) return;
      if (isFollowing) {
        unfollowPlayer.mutate({ followerId: userId, followedId: item.id });
      } else {
        followPlayer.mutate({ followerId: userId, followedId: item.id });
      }
    };

    return (
      <Card style={styles.card} contentStyle={{ padding: 12 }}>
        <Pressable 
          style={({ pressed }) => [
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
          ]}
          onPress={() => router.push(`/player/${item.id}` as any)}
        >
          <View style={styles.avatarBox}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.placeholderContainer}>
                <Image source={require('@/assets/images/icon.png')} style={styles.avatarPlaceholderLogo} resizeMode="contain" />
              </View>
            )}
            {item.looking_for_partner && (
              <View style={styles.lookingBadge}>
                <Text style={styles.lookingBadgeText}>ACTIVE FINDER</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.full_name ?? 'Player'}
            </Text>
            {item.is_pro && <ProBadge size="sm" />}
            {item.coach_status === 'approved' && <CoachBadge size="sm" />}
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.levelBadge}>
              {item.level ? LEVEL_LABELS[item.level].toUpperCase() : 'NO LEVEL'}
            </Text>
            <Text style={styles.elo}>{item.elo} <Text style={{ fontSize: 9, color: theme.textMuted }}>PS</Text></Text>
          </View>

          <View style={styles.compatRow}>
            <Ionicons name="pulse" size={10} color={theme.accent} />
            <Text style={styles.compatText}>
              {profile?.elo != null && Math.abs((profile.elo ?? 1200) - item.elo) <= 100 ? 'WELL MATCHED' : 'COMPATIBLE LEVEL'}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              buttonVariant === 'primary' && styles.buttonPrimary,
              buttonVariant === 'pending' && styles.buttonPending,
              buttonVariant === 'connected' && styles.buttonConnected,
              pressed && !disabled && { scale: 0.96 } as any
            ]}
            disabled={disabled || sendRequest.isPending}
            onPress={(e) => {
              e.stopPropagation();
              userId && sendRequest.mutate({ fromId: userId, toId: item.id });
            }}>
            <Text style={[
              styles.buttonText,
              buttonVariant === 'primary' && styles.buttonTextPrimary,
              buttonVariant === 'pending' && styles.buttonTextPending,
              buttonVariant === 'connected' && styles.buttonTextConnected,
            ]}>
              {buttonLabel}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.followBtn,
              isFollowing && styles.followBtnActive,
              pressed && !followPending && { scale: 0.96 } as any
            ]}
            disabled={followPending}
            onPress={(e) => {
              e.stopPropagation();
              handleFollowPress();
            }}>
            <Ionicons 
              name={isFollowing ? "checkmark-circle" : "person-add"} 
              size={11} 
              color={isFollowing ? theme.primary : theme.textMuted} 
              style={{ marginRight: 4 }} 
            />
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
            </Text>
          </Pressable>
        </Pressable>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.tagline}>PARTNER DISCOVERY</Text>
        <Text style={styles.title}>PARTNERS</Text>
      </View>

      {/* Tab Selectors */}
      <View style={styles.tabSelector}>
        <Pressable 
          style={[styles.tabButton, activeTab === 'grid' && styles.tabButtonActive]}
          onPress={() => setActiveTab('grid')}
        >
          <Ionicons name="grid" size={14} color={activeTab === 'grid' ? '#FFF' : theme.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'grid' && styles.tabButtonTextActive]}>DISCOVERY</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'followed' && styles.tabButtonActive]}
          onPress={() => setActiveTab('followed')}
        >
          <Ionicons name="people" size={14} color={activeTab === 'followed' ? '#FFF' : theme.textMuted} />
          <Text style={[styles.tabButtonText, activeTab === 'followed' && styles.tabButtonTextActive]}>FOLLOWING</Text>
        </Pressable>
      </View>

      {activeTab === 'grid' ? (
        /* Standard Grid View */
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={theme.primary} />
        ) : (
          <FlatList
            key="discovery-grid"
            data={players}
            keyExtractor={(item) => item.id}
            renderItem={renderGridItem}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.empty}>No compatible players yet.</Text>
                <Text style={styles.emptySub}>Please check your Level and City configurations in your profile.</Text>
              </View>
            }
          />
        )
      ) : (
        /* Following Tab View */
        followedLoading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={theme.primary} />
        ) : followedProfiles && followedProfiles.length > 0 ? (
          <FlatList
            key="followed-list"
            data={followedProfiles}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 110 }}
            renderItem={({ item }) => (
              <Card style={styles.followedRow} contentStyle={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                <Pressable 
                  style={({ pressed }) => [
                    { flex: 1, flexDirection: 'row', alignItems: 'center' },
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
                  ]}
                  onPress={() => router.push(`/player/${item.id}` as any)}
                >
                  <View style={styles.followedAvatarContainer}>
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.followedAvatar} />
                    ) : (
                      <View style={styles.followedAvatarPlaceholder}>
                        <Image source={require('@/assets/images/icon.png')} style={styles.followedAvatarPlaceholderLogo} resizeMode="contain" />
                      </View>
                    )}
                  </View>
                  <View style={styles.followedInfo}>
                    <Text style={styles.followedName} numberOfLines={1}>
                      {item.full_name ?? 'Player'}
                    </Text>
                    <View style={styles.followedMetaRow}>
                      <Text style={styles.followedLevel}>
                        {item.level ? LEVEL_LABELS[item.level].toUpperCase() : 'NO LEVEL'}
                      </Text>
                      <Text style={styles.followedDivider}>•</Text>
                      <Text style={styles.followedElo}>
                        {item.elo} <Text style={{ fontSize: 8, color: theme.textMuted }}>PS</Text>
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.unfollowButton,
                      pressed && { opacity: 0.8 }
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!userId) return;
                      unfollowPlayer.mutate({ followerId: userId, followedId: item.id }, {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: ["followedProfiles"] });
                        }
                      });
                    }}
                  >
                    <Ionicons name="person-remove-outline" size={12} color={theme.danger} style={{ marginRight: 4 }} />
                    <Text style={styles.unfollowButtonText}>UNFOLLOW</Text>
                  </Pressable>
                </Pressable>
              </Card>
            )}
          />
        ) : (
          <Card style={styles.emptyFollowedContainer} contentStyle={{ padding: 30, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people-outline" size={48} color={theme.textMuted} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyFollowedTitle}>YOU'RE NOT FOLLOWING ANYONE YET</Text>
            <Text style={styles.emptyFollowedDesc}>
              Follow players from the Discovery Grid to see their active milestones and match results on your home feed.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyFollowedBtn,
                pressed && { opacity: 0.8 }
              ]}
              onPress={() => setActiveTab('grid')}
            >
              <Text style={styles.emptyFollowedBtnText}>DISCOVER PLAYERS</Text>
            </Pressable>
          </Card>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: 'transparent' },
  headerContainer: { marginBottom: 16, marginTop: 12 },
  tagline: { fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 28,  color: theme.text, letterSpacing: -0.5 , textTransform: 'uppercase'},
  
  // Tab Selector styles
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
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

  // Grid Card styles
  card: { 
    flex: 1, 
    borderRadius: cardRadius, 
  },
  avatarBox: {
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarImage: { width: '100%', height: '100%' },
  placeholderContainer: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  avatarPlaceholderLogo: { width: 40, height: 40, opacity: 0.5 },
  lookingBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(198, 255, 51, 0.9)',
    paddingVertical: 4,
  },
  lookingBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: theme.text },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  compatRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  compatText: { color: theme.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  levelBadge: { color: theme.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  elo: { color: theme.text, fontSize: 11, fontWeight: '900' },
  button: { 
    borderRadius: buttonRadius, 
    paddingVertical: 10, 
    alignItems: 'center', 
    marginTop: 12,
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  buttonPending: {
    backgroundColor: 'transparent',
    borderColor: theme.border,
  },
  buttonConnected: {
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderColor: theme.success,
  },
  buttonText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  buttonTextPrimary: { color: '#08080C' },
  buttonTextPending: { color: theme.textMuted },
  buttonTextConnected: { color: theme.success },

  emptyContainer: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  empty: { textAlign: 'center', color: theme.text, fontSize: 14, fontWeight: '900' },
  emptySub: { textAlign: 'center', color: theme.textMuted, fontSize: 11, marginTop: 6, lineHeight: 18 },

  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(198, 255, 51, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(198, 255, 51, 0.15)',
    borderRadius: buttonRadius,
    paddingVertical: 10,
    marginTop: 8,
    width: '100%',
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderColor: theme.primary,
  },
  followBtnText: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  followBtnTextActive: {
    color: theme.primary,
    fontWeight: '900',
  },
  followedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: cardRadius,
  },
  followedAvatarContainer: {
    marginRight: 12,
  },
  followedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  followedAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  followedAvatarPlaceholderLogo: { width: 24, height: 24, opacity: 0.5 },
  followedInfo: {
    flex: 1,
    marginRight: 8,
  },
  followedName: {
    color: theme.text,
    fontSize: 14,
    
    textTransform: 'uppercase',
    letterSpacing: 0.2,},
  followedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  followedLevel: {
    color: theme.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  followedDivider: {
    color: theme.borderActive,
    fontSize: 10,
    fontWeight: '900',
  },
  followedElo: {
    color: theme.text,
    fontSize: 11,
    fontWeight: '700',
  },
  unfollowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.3)',
    backgroundColor: 'rgba(239, 83, 80, 0.05)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unfollowButtonText: {
    color: theme.danger,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyFollowedContainer: {
    borderRadius: cardRadius,
    marginTop: 20,
  },
  emptyFollowedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyFollowedDesc: {
    fontSize: 11,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  emptyFollowedBtn: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  emptyFollowedBtnText: {
    color: theme.onAccent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
