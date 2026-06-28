import { useState } from 'react';
import * as Location from 'expo-location';

export type DetectedLocation = { city: string | null; country: string | null };

export function useDetectCity() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function detectLocation(): Promise<DetectedLocation | null> {
    setError(null);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to verify your city.');
        return null;
      }

      const position = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const city = place?.city ?? place?.subregion ?? place?.region ?? null;
      const country = place?.country ?? null;

      if (!city || !country) {
        setError('Could not determine your city. Make sure GPS is on and try again.');
        return null;
      }

      return { city, country };
    } catch (err: any) {
      setError(err.message ?? 'Could not detect location');
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { detectLocation, loading, error };
}
