import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useSession } from '@/lib/useSession';
import { usePushNotifications } from '@/lib/usePushNotifications';

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
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationDarkTheme}>
          <RootNavigator />
        </ThemeProvider>
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
        headerTitleStyle: { fontWeight: '800' as any, fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="match/[id]"
        options={{ title: 'Match Detail', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="chat/[requestId]"
        options={{ title: 'Chat Room', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="league/[id]"
        options={{ title: 'League', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="leagues/index"
        options={{ title: 'My Leagues', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="coaches/index"
        options={{ title: 'Coaches', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="coach/[id]"
        options={{ title: 'Coach', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="social/[id]"
        options={{ title: 'Players', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen
        name="privacy"
        options={{ title: 'Privacy Policy', contentStyle: { paddingBottom: insets.bottom } }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
