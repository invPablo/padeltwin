import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
  return tokenResponse.data;
}

export function usePushNotifications(userId: string | undefined) {
  const router = useRouter();
  const registered = useRef(false);

  useEffect(() => {
    if (!userId || registered.current) return;
    registered.current = true;

    registerForPushToken().then((token) => {
      if (token) {
        supabase.from('profiles').update({ push_token: token }).eq('id', userId);
      }
    });
  }, [userId]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === 'message' || data?.type === 'partner_accepted') {
        if (typeof data.requestId === 'string') {
          router.push({ pathname: '/chat/[requestId]', params: { requestId: data.requestId } });
        }
      } else if (data?.type === 'partner_request') {
        router.push('/profile');
      } else if (data?.type === 'follow' && typeof data.profileId === 'string') {
        router.push(`/player/${data.profileId}` as any);
      }
    });
    return () => subscription.remove();
  }, [router]);
}
