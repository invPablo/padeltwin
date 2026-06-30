import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/lib/useSession';
import { useDeclarePair, useMyPairs, usePartnerRequests, useProfile } from '@/lib/queries';
import { theme, cardRadius, chipRadius } from '@/constants/theme';
import { divisionFromPairElo } from '@/lib/pairDivisions';
import type { PartnerRequestWithProfiles } from '@/types/database';

const FREE_PAIR_LIMIT = 2;

export default function PairsScreen() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: pairs, isLoading } = useMyPairs(userId);
  const { data: requests } = usePartnerRequests(userId);
  const declarePair = useDeclarePair();
  const [pickerOpen, setPickerOpen] = useState(false);

  const acceptedPartners = (requests ?? [])
    .filter((r): r is PartnerRequestWithProfiles => r.status === 'accepted')
    .map((r) => (r.from_id === userId ? r.to_profile : r.from_profile))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const pairedPartnerIds = new Set(
    (pairs ?? []).map((p) => (p.player_a_id === userId ? p.player_b_id : p.player_a_id))
  );
  const availablePartners = acceptedPartners.filter((p) => !pairedPartnerIds.has(p.id));

  const atFreeLimit = !profile?.is_pro && (pairs?.length ?? 0) >= FREE_PAIR_LIMIT;

  function handleDeclare(partnerId: string) {
    declarePair.mutate(
      { partnerId },
      {
        onSuccess: () => setPickerOpen(false),
        onError: (e) => Alert.alert('Could not declare pair', e instanceof Error ? e.message : 'Please try again.'),
      }
    );
  }

  function handleAddPress() {
    if (atFreeLimit) {
      Alert.alert(
        'Free pair limit reached',
        `Free accounts can rank up to ${FREE_PAIR_LIMIT} pairs. Upgrade to Pro for unlimited ranked pairs.`
      );
      return;
    }
    setPickerOpen((v) => !v);
  }

  if (isLoading) return <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 20, gap: 12 }}
      data={pairs ?? []}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 8 }}>
          <Text style={styles.intro}>
            Declare a fixed pair with an accepted partner to rank together as a team, independent of your
            individual PS Score. {!profile?.is_pro && `Free accounts get up to ${FREE_PAIR_LIMIT} ranked pairs.`}
          </Text>
          <Pressable style={styles.addBtn} onPress={handleAddPress}>
            <Text style={styles.addBtnText}>{pickerOpen ? 'Cancel' : '+ Declare a Pair'}</Text>
          </Pressable>
          {pickerOpen && (
            <View style={styles.pickerCard}>
              {availablePartners.length === 0 ? (
                <Text style={styles.empty}>
                  No available accepted partners to pair with. Add partners from the Partners tab first.
                </Text>
              ) : (
                availablePartners.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.pickerRow}
                    onPress={() => handleDeclare(p.id)}
                    disabled={declarePair.isPending}
                  >
                    <Text style={styles.pickerName}>{p.full_name ?? 'Player'}</Text>
                    <Text style={styles.pickerAdd}>+ pair up</Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No ranked pairs yet.</Text>}
      renderItem={({ item }) => {
        const partner = item.player_a_id === userId ? item.player_b : item.player_a;
        const division = divisionFromPairElo(item.elo);
        return (
          <View style={styles.pairCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pairNames}>You & {partner?.full_name ?? 'Partner'}</Text>
              <Text style={styles.pairMeta}>
                {item.matches_played < 5 ? `Provisional • ${item.matches_played}/5 matches` : `${item.matches_played} matches played`}
              </Text>
            </View>
            <View style={styles.divisionBadge}>
              <Text style={styles.divisionBadgeText}>{division.toUpperCase()}</Text>
              <Text style={styles.pairElo}>{item.elo}</Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  intro: { color: theme.textMuted, fontSize: 13, lineHeight: 18 },
  addBtn: { backgroundColor: theme.accent, borderRadius: chipRadius, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: theme.onAccent, fontWeight: '900', fontSize: 13 },
  pickerCard: { backgroundColor: theme.card, borderRadius: cardRadius, borderWidth: 1, borderColor: theme.border, padding: 12, gap: 4 },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  pickerName: { color: theme.text, fontSize: 13, fontWeight: '600' },
  pickerAdd: { color: theme.accent, fontSize: 12, fontWeight: '800' },
  empty: { color: theme.textMuted, textAlign: 'center', marginTop: 20 },
  pairCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderRadius: cardRadius, borderWidth: 1, borderColor: theme.border, padding: 16 },
  pairNames: { color: theme.text, fontWeight: '700', fontSize: 14 },
  pairMeta: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  divisionBadge: { alignItems: 'flex-end' },
  divisionBadgeText: { color: theme.accent, fontWeight: '900', fontSize: 10, letterSpacing: 0.5 },
  pairElo: { color: theme.text, fontWeight: '900', fontSize: 16, marginTop: 2 },
});
