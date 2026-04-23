import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView, StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { saveToken, saveHubUrl, getHubUrl as getStoredHubUrl } from '@/lib/storage'
import { setHubUrl } from '@/lib/hub-url'
import { setTokenCache } from '@/lib/api'
import { colors } from '@/lib/theme'

export default function LoginScreen() {
  const [hubUrl, setHubUrlState] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getStoredHubUrl().then((saved) => {
      if (saved) setHubUrlState(saved)
    })
  }, [])

  async function handleLogin() {
    const url = hubUrl.trim().replace(/\/$/, '')
    if (!url || !password) {
      setError('Hub URL and password are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError('Invalid password')
        return
      }
      const data = await res.json()
      if (!data.hubToken) {
        setError('Login failed — no token returned')
        return
      }
      await Promise.all([saveToken(data.hubToken), saveHubUrl(url)])
      setHubUrl(url)
      setTokenCache(data.hubToken)
      router.replace('/(app)')
    } catch {
      setError('Could not reach hub — check the URL and try again')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = hubUrl.trim().length > 0 && password.length > 0 && !loading

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logo}>
            <View style={styles.logoInner} />
          </View>
          <Text style={styles.title}>ElasticClaw</Text>
          <Text style={styles.subtitle}>Connect to your hub</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Hub URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://hub.example.com"
            placeholderTextColor={colors.textMuted}
            value={hubUrl}
            onChangeText={setHubUrlState}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={!canSubmit}
            style={[styles.button, { backgroundColor: canSubmit ? colors.blue : colors.elevated }]}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={[styles.buttonText, { color: canSubmit ? colors.white : colors.textMuted }]}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
  hero: { alignItems: 'center', marginBottom: 48 },
  logo: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: colors.elevated,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  logoInner: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.blue },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  form: {},
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  error: { color: colors.red, fontSize: 13, marginTop: 16 },
  button: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
})
