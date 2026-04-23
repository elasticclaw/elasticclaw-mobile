import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Check, LogOut } from 'lucide-react-native'
import { colors } from '@/lib/theme'
import { fetchSettings, patchSettings, clearConfig, type SettingsView } from '@/lib/api'
import { deleteToken } from '@/lib/storage'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [error, setError] = useState<string | null>(null)

  // form state (editable inputs; empty = don't change unless user types)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [repToken, setRepToken] = useState('')
  const [repTtl, setRepTtl] = useState('')
  const [repInstance, setRepInstance] = useState('')
  const [dayUrl, setDayUrl] = useState('')
  const [dayKey, setDayKey] = useState('')
  const [daySnapshot, setDaySnapshot] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [sshKeyInput, setSshKeyInput] = useState('')
  const [sshKeys, setSshKeys] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await fetchSettings()
      setSettings(s)
      setRepTtl(s.providers?.replicated?.defaultTtl ?? '')
      setRepInstance(s.providers?.replicated?.defaultInstanceType ?? '')
      setDayUrl(s.providers?.daytona?.apiUrl ?? '')
      setDaySnapshot(s.providers?.daytona?.defaultSnapshot ?? '')
      setSshKeys(s.sshPublicKeys ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (newPw && newPw !== confirmPw) {
      Alert.alert('Password mismatch', 'New password and confirmation do not match.')
      return
    }
    if (newPw && newPw.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.')
      return
    }

    setSaving(true)
    try {
      const patch: any = {}
      if (anthropicKey) patch.llmKeys = { anthropic: anthropicKey }

      const providers: any = {}
      if (repToken || repTtl !== (settings?.providers?.replicated?.defaultTtl ?? '') ||
          repInstance !== (settings?.providers?.replicated?.defaultInstanceType ?? '')) {
        providers.replicated = {}
        if (repToken) providers.replicated.token = repToken
        if (repTtl) providers.replicated.defaultTtl = repTtl
        if (repInstance) providers.replicated.defaultInstanceType = repInstance
      }
      if (dayKey || dayUrl !== (settings?.providers?.daytona?.apiUrl ?? '') ||
          daySnapshot !== (settings?.providers?.daytona?.defaultSnapshot ?? '')) {
        providers.daytona = {}
        if (dayKey) providers.daytona.apiKey = dayKey
        if (dayUrl) providers.daytona.apiUrl = dayUrl
        if (daySnapshot) providers.daytona.defaultSnapshot = daySnapshot
      }
      if (Object.keys(providers).length > 0) patch.providers = providers

      if (newPw) patch.uiPassword = newPw

      // Always send the current SSH keys list if it changed from loaded state
      if (JSON.stringify(sshKeys) !== JSON.stringify(settings?.sshPublicKeys ?? [])) {
        patch.sshPublicKeys = sshKeys
      }

      if (Object.keys(patch).length === 0) {
        Alert.alert('No changes', 'Nothing to save.')
        return
      }

      await patchSettings(patch)
      Alert.alert('Saved', 'Settings updated.')
      setAnthropicKey('')
      setRepToken('')
      setDayKey('')
      setNewPw('')
      setConfirmPw('')
      await load()
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  function addSshKey() {
    const key = sshKeyInput.trim()
    if (!key) return
    if (sshKeys.includes(key)) return
    setSshKeys([...sshKeys, key])
    setSshKeyInput('')
  }

  function removeSshKey(key: string) {
    setSshKeys(sshKeys.filter((k) => k !== key))
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'You will be disconnected from the hub.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await deleteToken()
          clearConfig()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || loading}
          style={styles.saveHeader}
        >
          {saving
            ? <ActivityIndicator color={colors.blueLight} size="small" />
            : <Text style={styles.saveText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blueLight} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
          keyboardVerticalOffset={64}
        >
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* LLM KEYS */}
            <Section title="LLM Keys">
              <Row label="Anthropic" badge={settings?.llmKeys?.anthropic ? 'Set' : undefined}>
                <TextInput
                  style={styles.input}
                  placeholder={settings?.llmKeys?.anthropic ? '•••••••• (tap to replace)' : 'sk-ant-…'}
                  placeholderTextColor={colors.textMuted}
                  value={anthropicKey}
                  onChangeText={setAnthropicKey}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
            </Section>

            {/* PROVIDERS — REPLICATED */}
            <Section title="Replicated CMX">
              <Row label="API Token" badge={settings?.providers?.replicated?.tokenSet ? 'Set' : undefined}>
                <TextInput
                  style={styles.input}
                  placeholder={settings?.providers?.replicated?.tokenSet ? '•••••••• (tap to replace)' : 'Replicated token'}
                  placeholderTextColor={colors.textMuted}
                  value={repToken}
                  onChangeText={setRepToken}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
              <Row label="Default TTL">
                <TextInput
                  style={styles.input}
                  placeholder="48h"
                  placeholderTextColor={colors.textMuted}
                  value={repTtl}
                  onChangeText={setRepTtl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
              <Row label="Default instance">
                <TextInput
                  style={styles.input}
                  placeholder="r1.large"
                  placeholderTextColor={colors.textMuted}
                  value={repInstance}
                  onChangeText={setRepInstance}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
            </Section>

            {/* PROVIDERS — DAYTONA */}
            <Section title="Daytona">
              <Row label="API URL">
                <TextInput
                  style={styles.input}
                  placeholder="https://app.daytona.io"
                  placeholderTextColor={colors.textMuted}
                  value={dayUrl}
                  onChangeText={setDayUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </Row>
              <Row label="API Key" badge={settings?.providers?.daytona?.apiKeySet ? 'Set' : undefined}>
                <TextInput
                  style={styles.input}
                  placeholder={settings?.providers?.daytona?.apiKeySet ? '•••••••• (tap to replace)' : 'Daytona key'}
                  placeholderTextColor={colors.textMuted}
                  value={dayKey}
                  onChangeText={setDayKey}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
              <Row label="Default snapshot">
                <TextInput
                  style={styles.input}
                  placeholder="daytona-medium"
                  placeholderTextColor={colors.textMuted}
                  value={daySnapshot}
                  onChangeText={setDaySnapshot}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
            </Section>

            {/* SECURITY */}
            <Section title="Security" subtitle="Change the UI login password. Leave blank to keep current.">
              <Row label="New password">
                <TextInput
                  style={styles.input}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.textMuted}
                  value={newPw}
                  onChangeText={setNewPw}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
              <Row label="Confirm">
                <TextInput
                  style={styles.input}
                  placeholder="Retype password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPw}
                  onChangeText={setConfirmPw}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
            </Section>

            {/* SSH KEYS */}
            <Section title="SSH Public Keys" subtitle="Injected into every provisioned VM.">
              <View style={styles.sshRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="ssh-ed25519 AAAA… comment"
                  placeholderTextColor={colors.textMuted}
                  value={sshKeyInput}
                  onChangeText={setSshKeyInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                />
                <TouchableOpacity
                  onPress={addSshKey}
                  disabled={!sshKeyInput.trim()}
                  style={[
                    styles.addBtn,
                    { backgroundColor: sshKeyInput.trim() ? colors.blue : colors.elevated },
                  ]}
                >
                  <Check size={16} color={sshKeyInput.trim() ? colors.white : colors.textMuted} />
                </TouchableOpacity>
              </View>
              {sshKeys.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {sshKeys.map((key) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => {
                        Alert.alert('Remove key', 'Remove this SSH public key?', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeSshKey(key) },
                        ])
                      }}
                      style={styles.sshKey}
                    >
                      <Text style={styles.sshKeyText} numberOfLines={2}>{key}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Section>

            {/* Read-only info about advanced sections */}
            {(settings?.github?.length ?? 0) > 0 && (
              <Section title="GitHub Apps" subtitle="Manage from the web UI.">
                {settings!.github.map((app) => (
                  <View key={app.appId} style={styles.roRow}>
                    <Text style={styles.roLabel}>App {app.appId}</Text>
                    <Text style={styles.roValue}>{app.keySet ? 'Configured' : 'No key'}</Text>
                  </View>
                ))}
              </Section>
            )}

            {(settings?.integrations?.linear?.length ?? 0) > 0 && (
              <Section title="Linear Integrations" subtitle="Manage from the web UI.">
                {settings!.integrations!.linear!.map((l) => (
                  <View key={l.workspace} style={styles.roRow}>
                    <Text style={styles.roLabel}>{l.workspace}</Text>
                    <Text style={styles.roValue}>
                      {l.tokenSet ? 'Token set' : 'No token'}
                      {l.webhookSecretSet ? ' · webhook' : ''}
                    </Text>
                  </View>
                ))}
              </Section>
            )}

            {(settings?.factories?.length ?? 0) > 0 && (
              <Section title="Factories" subtitle="Manage from the web UI.">
                {settings!.factories!.map((f) => (
                  <View key={f.name} style={styles.roRow}>
                    <Text style={styles.roLabel}>{f.name}</Text>
                    <Text style={styles.roValue}>
                      {f.integration}/{f.team} → {f.template}
                    </Text>
                  </View>
                ))}
              </Section>
            )}

            {/* Sign out */}
            <View style={{ marginHorizontal: 16, marginTop: 28 }}>
              <TouchableOpacity
                onPress={handleSignOut}
                style={styles.signOutBtn}
                activeOpacity={0.8}
              >
                <LogOut size={17} color={colors.red} />
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function Row({ label, badge, children }: { label: string; badge?: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{label}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', marginRight: 36 },
  saveHeader: {
    position: 'absolute', right: 12, top: 10, padding: 8,
  },
  saveText: { color: colors.blueLight, fontSize: 15, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorText: { color: colors.red, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: colors.elevated, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  section: { marginTop: 20, marginHorizontal: 16 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { color: colors.textMuted, fontSize: 12, marginBottom: 10 },
  sectionBody: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  row: {},
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  badge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: { color: '#4ade80', fontSize: 10, fontWeight: '600' },
  input: {
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
  },
  sshRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    width: 40, height: 40, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  sshKey: {
    backgroundColor: colors.input,
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  sshKeyText: { color: colors.text, fontSize: 11, fontFamily: 'Menlo' },
  roRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  roLabel: { color: colors.text, fontSize: 13, fontWeight: '500' },
  roValue: { color: colors.textMuted, fontSize: 12 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  signOutText: { color: colors.red, fontSize: 14, fontWeight: '600' },
})

