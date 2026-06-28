import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme, buttonRadius } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.tagline}>MATCH • CONNECT • PLAY</Text>
          <Text style={styles.title}>PADELSCRIM</Text>
          <Text style={styles.subtitle}>Enter your details to access the court</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={[styles.input, focusedInput === 'email' && styles.inputFocused]}
            placeholder="Enter your email"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
          />

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={[styles.input, focusedInput === 'password' && styles.inputFocused]}
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedInput('password')}
            onBlur={() => setFocusedInput(null)}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color={theme.onAccent} /> : <Text style={styles.buttonText}>Log in</Text>}
          </Pressable>
        </View>

        <Link href="/(auth)/register" style={styles.link}>
          Don't have an account? <Text style={styles.linkHighlight}>Sign up</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: theme.background },
  headerContainer: { alignItems: 'center', marginBottom: 28 },
  tagline: { fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  title: {
    fontFamily: 'Coubra',
    fontSize: 44,
    color: theme.accent,
    textTransform: 'uppercase',
    paddingRight: 10,
  },
  subtitle: { fontSize: 13, color: theme.textMuted, marginTop: 4, textAlign: 'center', fontWeight: '700' },
  form: { gap: 14 },
  label: { fontSize: 9, fontWeight: '900', color: theme.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: '800',
    backgroundColor: theme.card,
    color: theme.text,
    letterSpacing: 0.5,
  },
  inputFocused: {
    borderColor: theme.borderActive,
    backgroundColor: '#1B1C24',
  },
  button: {
    backgroundColor: theme.primary,
    borderRadius: buttonRadius,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: { color: theme.onAccent, fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  error: { color: theme.danger, fontWeight: '700', fontSize: 12, textAlign: 'center', textTransform: 'uppercase' },
  link: { textAlign: 'center', marginTop: 28, color: theme.textMuted, fontSize: 13, fontWeight: '700' },
  linkHighlight: { color: theme.primary, fontWeight: '900' },
});
