import { Redirect, Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Platform, View, Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useSession } from '@/lib/useSession';
import { useProfile } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { TopNavigation } from '@/components/TopNavigation';

function CustomTabBar({ state, descriptors, navigation, bottomInset }: any) {
  const router = useRouter();

  function renderRouteButton(route: any) {
    const index = state.routes.findIndex((r: any) => r.key === route.key);
    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    let iconName = '';
    if (route.name === 'home') {
      iconName = isFocused ? 'home' : 'home-outline';
    } else if (route.name === 'index') {
      iconName = isFocused ? 'tennisball' : 'tennisball-outline';
    } else if (route.name === 'partners') {
      iconName = isFocused ? 'people' : 'people-outline';
    } else if (route.name === 'profile') {
      iconName = isFocused ? 'person' : 'person-outline';
    }

    return (
      <Pressable key={route.key} onPress={onPress} style={styles.tabButton}>
        <View style={[styles.iconWrapper, isFocused && styles.activeIconWrapper]}>
          <Ionicons name={iconName as any} size={22} color={isFocused ? theme.accent : '#6E707E'} />
        </View>
      </Pressable>
    );
  }

  const homeRoute = state.routes.find((r: any) => r.name === 'home');
  const indexRoute = state.routes.find((r: any) => r.name === 'index');
  const partnersRoute = state.routes.find((r: any) => r.name === 'partners');
  const profileRoute = state.routes.find((r: any) => r.name === 'profile');

  const currentRouteName = state.routes[state.index]?.name ?? '';
  const isLeaguesFocused = currentRouteName.startsWith('leagues/');
  const isKopFocused = currentRouteName === 'club-leaderboard';

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomInset }]}>
      <View style={styles.tabBarContainer}>
        {/* Tab Buttons */}
        <View style={styles.buttonsContainer}>
        {homeRoute && renderRouteButton(homeRoute)}
        {indexRoute && renderRouteButton(indexRoute)}

        <Pressable style={styles.tabButton} onPress={() => router.push('/leagues' as any)}>
          <View style={[styles.iconWrapper, isLeaguesFocused && styles.activeIconWrapper]}>
            <MaterialCommunityIcons name="podium" size={22} color={isLeaguesFocused ? theme.accent : '#6E707E'} />
          </View>
        </Pressable>

        <Pressable style={styles.tabButton} onPress={() => router.push('/club-leaderboard' as any)}>
          <View style={[styles.iconWrapper, isKopFocused && styles.activeIconWrapper]}>
            <MaterialCommunityIcons name="crown" size={22} color={isKopFocused ? theme.accent : '#6E707E'} />
          </View>
        </Pressable>

          {partnersRoute && renderRouteButton(partnersRoute)}
          {profileRoute && renderRouteButton(profileRoute)}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { session, loading } = useSession();
  const { data: profile, isLoading: profileLoading } = useProfile(session?.user.id);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0);

  if (loading || (session && profileLoading)) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (profile?.is_banned) {
    supabase.auth.signOut();
    return null;
  }
  if (!profile?.onboarding_completed) return <Redirect href={'/(onboarding)' as any} />;

  return (
    <Tabs
      initialRouteName="home"
      tabBar={(props) => <CustomTabBar {...props} bottomInset={bottomInset} />}
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <TopNavigation routeName={route.name} />,
        sceneStyle: {
          backgroundColor: theme.background,
        },
      })}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="create-match" />
      <Tabs.Screen name="partners" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="leagues/index" options={{ href: null }} />
      <Tabs.Screen name="leagues/country" options={{ href: null }} />
      <Tabs.Screen name="club-leaderboard" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.nav,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabBarContainer: {
    backgroundColor: 'transparent',
  },
  buttonsContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeIconWrapper: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
});
