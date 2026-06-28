import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

export function ProBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const iconSize = size === 'sm' ? 10 : 13;
  return (
    <View style={[styles.badge, size === 'sm' && styles.badgeSm]}>
      <Ionicons name="checkmark" size={iconSize} color={theme.onAccent} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: { width: 15, height: 15, borderRadius: 7.5 },
});
