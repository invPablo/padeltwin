import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '@/lib/useSession';
import { useProfile, useSendCoachLead } from '@/lib/queries';
import { theme, buttonRadius, cardRadius } from '@/constants/theme';

export default function CoachDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const { data: coach, isLoading } = useProfile(id);
  const sendLead = useSendCoachLead();
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');

  function handleSend() {
    if (!userId || !id || !message.trim()) return;
    sendLead.mutate(
      { coachId: id, requesterId: userId, message: message.trim() },
      {
        onSuccess: () => {
          setModalVisible(false);
          setMessage('');
          Alert.alert('Request sent', "The coach will get back to you directly.");
        },
        onError: (err: any) => Alert.alert('Could not send request', err.message ?? 'Try again.'),
      }
    );
  }

  if (isLoading || !coach) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  const initials = (coach.full_name ?? 'Coach').slice(0, 2).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        {coach.avatar_url ? (
          <Image source={{ uri: coach.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Image source={require('@/assets/images/icon.png')} style={styles.avatarPlaceholderLogo} resizeMode="contain" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{coach.full_name ?? 'Coach'}</Text>
          {coach.zone && <Text style={styles.zone}>📍 {coach.zone}</Text>}
        </View>
      </View>

      <View style={styles.statsRow}>
        {coach.coach_years_experience != null && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{coach.coach_years_experience}y</Text>
            <Text style={styles.statLabel}>EXPERIENCE</Text>
          </View>
        )}
        {coach.coach_hourly_rate != null && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>£{coach.coach_hourly_rate}</Text>
            <Text style={styles.statLabel}>PER HOUR</Text>
          </View>
        )}
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{coach.elo}</Text>
          <Text style={styles.statLabel}>PS Score</Text>
        </View>
      </View>

      {coach.coach_specialties && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SPECIALTIES</Text>
          <Text style={styles.bodyText}>{coach.coach_specialties}</Text>
        </View>
      )}

      {coach.coach_bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <Text style={styles.bodyText}>{coach.coach_bio}</Text>
        </View>
      )}

      {id !== userId && (
        <Pressable style={({ pressed }) => [styles.contactButton, pressed && { opacity: 0.9 }]} onPress={() => setModalVisible(true)}>
          <Ionicons name="paper-plane" size={16} color={theme.onAccent} />
          <Text style={styles.contactButtonText}>REQUEST A LESSON</Text>
        </Pressable>
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Message {coach.full_name ?? 'Coach'}</Text>
            <TextInput
              style={styles.modalInput}
              value={message}
              onChangeText={setMessage}
              placeholder="e.g. Looking for a 1-hour lesson this weekend, intermediate level."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, (!message.trim() || sendLead.isPending) && { opacity: 0.5 }]}
                onPress={handleSend}
                disabled={!message.trim() || sendLead.isPending}
              >
                {sendLead.isPending ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.modalConfirmText}>SEND</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderLogo: { width: 28, height: 28, opacity: 0.5 },
  name: { color: theme.text, fontSize: 20, fontWeight: '900' },
  zone: { color: theme.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: cardRadius,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: theme.text, fontSize: 18, fontWeight: '900' },
  statLabel: { color: theme.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 4 },
  section: { backgroundColor: theme.card, borderRadius: cardRadius, borderWidth: 1, borderColor: theme.border, padding: 16 },
  sectionTitle: { color: theme.accent, fontSize: 11,  letterSpacing: 1, marginBottom: 8 , textTransform: 'uppercase'},
  bodyText: { color: theme.text, fontSize: 13, lineHeight: 19 },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.accent,
    borderRadius: buttonRadius,
    paddingVertical: 16,
    marginTop: 8,
  },
  contactButtonText: { color: theme.onAccent, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: theme.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: theme.border },
  modalTitle: { color: theme.text, fontWeight: '700', fontSize: 14, marginBottom: 14 },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    backgroundColor: '#191922',
    color: theme.text,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: buttonRadius, borderWidth: 1, borderColor: theme.border },
  modalCancelText: { color: theme.textMuted, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  modalConfirmBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: buttonRadius, backgroundColor: theme.accent },
  modalConfirmText: { color: theme.onAccent, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
});
