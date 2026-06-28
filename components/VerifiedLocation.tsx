import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme, chipRadius } from '@/constants/theme';
import { useDetectCity } from '@/lib/useLocation';

// City/country can only be set via GPS + reverse geocoding — no free-text
// entry — so players can't put joke locations on their profile and so
// City/Country League groupings are trustworthy.
export function VerifiedLocation({
  city,
  country,
  onDetected,
}: {
  city: string | null;
  country: string | null;
  onDetected: (location: { city: string; country: string }) => void;
}) {
  const { detectLocation, loading, error } = useDetectCity();

  async function handlePress() {
    const result = await detectLocation();
    if (result?.city && result?.country) {
      onDetected({ city: result.city, country: result.country });
    }
  }

  return (
    <View>
      {city && country ? (
        <View style={styles.verifiedRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.verifiedText}>📍 {city}, {country}</Text>
            <Text style={styles.verifiedSub}>Verified by GPS</Text>
          </View>
          <Pressable style={styles.refreshBtn} onPress={handlePress} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={theme.accent} /> : <Text style={styles.refreshBtnText}>UPDATE</Text>}
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.detectBtn} onPress={handlePress} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={styles.detectBtnText}>📍 VERIFY MY LOCATION (REQUIRED)</Text>
          )}
        </Pressable>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  detectBtn: { backgroundColor: theme.accent, borderRadius: chipRadius, paddingVertical: 14, alignItems: 'center' },
  detectBtnText: { color: theme.onAccent, fontWeight: '900', fontSize: 13 },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: chipRadius,
    padding: 14,
  },
  verifiedText: { color: theme.text, fontWeight: '700', fontSize: 14 },
  verifiedSub: { color: theme.success, fontSize: 11, fontWeight: '700', marginTop: 2 },
  refreshBtn: { borderWidth: 1, borderColor: theme.border, borderRadius: chipRadius, paddingVertical: 8, paddingHorizontal: 12 },
  refreshBtnText: { color: theme.textMuted, fontWeight: '800', fontSize: 11 },
  errorText: { color: theme.danger, fontSize: 12, marginTop: 6 },
});
