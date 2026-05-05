import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, ScrollView, StyleSheet, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { setActiveServer } from '@/lib/hub-url'
import { setTokenCache } from '@/lib/api'
import { colors } from '@/lib/theme'
import { listServers, addServer, switchServer, type ServerConfig } from '@/lib/servers'

export default function LoginScreen() {
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [servers, setServers] = useState<ServerConfig[]>([])
  const [serverName, setServerName] = useState('')
  const [hubUrl, setHubUrlState] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listServers().then(setServers)
  }, [])

  async function handleLogin() {
    const url = hubUrl.trim().replace(/\/$/, '')
    const name = serverName.trim() || url
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
      const server = await addServer({ name, url, token: data.hubToken })
      setActiveServer(server)
      setTokenCache(data.hubToken)
      router.replace('/(app)')
    } catch {
      setError('Could not reach hub — check the URL and try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleSwitch(server: ServerConfig) {
    await switchServer(server.id)
    setActiveServer(server)
    setTokenCache(server.token)
    router.replace('/(app)')
  }

  async function handleRemove(server: ServerConfig) {
    Alert.alert(
      'Remove server',
      `Remove "${server.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { removeServer } = await import('@/lib/servers')
            await removeServer(server.id)
            setServers(await listServers())
          },
        },
      ]
    )
  }

  const canSubmit = hubUrl.trim().length > 0 && password.length > 0 && !loading

  if (mode === 'list' && servers.length > 0) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logo}>
              <View style={styles.logoInner} />
            </View>
            <Text style={styles.title}>ElasticClaw</Text>
            <Text style={styles.subtitle}>Select a server</Text>
          </View>

          <View style={styles.form}>
            {servers.map((s) => (
              <View key={s.id} style={styles.serverRow}>
                <TouchableOpacity
                  onPress={() => handleSwitch(s)}
                  style={styles.serverBtn}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serverName}>{s.name}</Text>
                    <Text style={styles.serverUrl}>{s.url}</Text>
                  </View>
                  <Text style={styles.serverAction}>Connect ›</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemove(s)}
                  style={styles.serverRemove}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.serverRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => setMode('add')}
              style={[styles.button, { backgroundColor: colors.elevated, marginTop: 16 }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonText, { color: colors.textMuted }]}>Add New Server</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    )
  }

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
          <Text style={styles.subtitle}>{servers.length > 0 ? 'Add new server' : 'Connect to your hub'}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Server name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Production"
            placeholderTextColor={colors.textMuted}
            value={serverName}
            onChangeText={setServerName}
            autoCapitalize="none"
            autoCorrect={false}
          />

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

          {servers.length > 0 && (
            <TouchableOpacity
              onPress={() => setMode('list')}
              style={[styles.button, { backgroundColor: 'transparent', marginTop: 8 }]}
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonText, { color: colors.textMuted }]}>← Back to servers</Text>
            </TouchableOpacity>
          )}
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
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  serverBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  serverName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  serverUrl: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  serverAction: { color: colors.blue, fontSize: 13, fontWeight: '600' },
  serverRemove: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  serverRemoveText: { color: colors.red, fontSize: 14, fontWeight: '600' },
})
