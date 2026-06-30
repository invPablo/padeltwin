import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/lib/useSession';
import { useProfile, useUnreadNotificationCount } from '@/lib/queries';
import { theme } from '@/constants/theme';

export function TopNavigation({ routeName }: { routeName: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { data: profile } = useProfile(session?.user.id);
  const { data: unreadCount } = useUnreadNotificationCount(session?.user.id);

  // Map route names to display titles
  const getTitle = () => {
    switch (routeName) {
      case 'home': return 'Home';
      case 'index': return 'Record';
      case 'leagues/index': return 'Leagues';
      case 'club-leaderboard': return 'KOP';
      case 'partners': return 'Partners';
      case 'profile': return 'Profile';
      case 'create-match': return 'Create Match';
      default: return 'PadelTwin';
    }
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        <Text style={styles.title}>{getTitle()}</Text>

        <View style={styles.actions}>
          <Pressable onPress={() => router.push('/profile' as any)} style={styles.avatarButton}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={14} color="#FFF" />
              </View>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/chat' as any)} style={styles.iconButton}>
            <Ionicons name="chatbubble-outline" size={24} color="#FFF" />
          </Pressable>

          <Pressable onPress={() => router.push('/search' as any)} style={styles.iconButton}>
            <Ionicons name="search-outline" size={24} color="#FFF" />
          </Pressable>

          <Pressable onPress={() => router.push('/notifications' as any)} style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={24} color="#FFF" />
            {!!unreadCount && <View style={styles.badgeDot} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.nav,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Anton_400Regular',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
    borderWidth: 1.5,
    borderColor: theme.nav,
  },
  avatarButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
