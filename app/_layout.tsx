import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useSession } from '@/lib/useSession';
import { usePushNotifications } from '@/lib/usePushNotifications';
import { applyGlobalFont } from '@/lib/globalFont';
import { ThemeProvider as VisualThemeProvider } from '@/lib/ThemeContext';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const navigationDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.background,
    card: theme.card,
    text: theme.text,
    border: theme.border,
    primary: theme.accent,
  },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Coubra: require('../assets/fonts/CoubraFont.ttf'),
    Anton_400Regular,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log('[OTA] update check failed', e);
      }
    })();
  }, []);

  if (!loaded) {
    return null;
  }

  applyGlobalFont('Anton_400Regular');

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <VisualThemeProvider>
          <ThemeProvider value={navigationDarkTheme}>
            <RootNavigator />
          </ThemeProvider>
        </VisualThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  usePushNotifications(session?.user.id);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        headerTitleStyle: { fontFamily: 'Anton_400Regular', fontWeight: '800' as any, fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="match/[id]"
        options={{ title: 'MATCH DETAIL', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="chat/[requestId]"
        options={{ title: 'CHAT ROOM', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="chat/index" options={{ headerShown: false }} />
      <Stack.Screen
        name="league/[id]"
        options={{ title: 'LEAGUE', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="coaches/index"
        options={{ title: 'COACHES', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="coach/[id]"
        options={{ title: 'COACH', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="social/[id]"
        options={{ title: 'PLAYERS', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="privacy"
        options={{ title: 'PRIVACY POLICY', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="tournaments/index"
        options={{ title: 'TOURNAMENTS', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="tournaments/[id]"
        options={{ title: 'TOURNAMENT', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="pairs/index"
        options={{ title: 'MY PAIRS', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
