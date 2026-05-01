import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Check, LogOut, Trash2, Star, Plus } from 'lucide-react-native'
import { colors } from '@/lib/theme'
import {
  fetchSettings, patchSettings, clearConfig, fetchModels,
  listSecrets, putSecret, deleteSecret,
  type SettingsView, type LLMKeyView, type LinearIntegrationView,
  type ModelsResponse,
} from '@/lib/api'
import { deleteToken } from '@/lib/storage'

const LLM_PROVIDERS = ['anthropic', 'fireworks', 'openai', 'groq', 'deepseek'] as const
const PROVIDER_PLACEHOLDER: Record<string, string> = {
  anthropic: 'sk-ant-…',
  fireworks: 'fw_…',
  openai: 'sk-…',
  groq: 'gsk_…',
  deepseek: 'sk-…',
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Provider form state
  const [repToken, setRepToken] = useState('')
  const [repTtl, setRepTtl] = useState('')
  const [repInstance, setRepInstance] = useState('')
  const [dayUrl, setDayUrl] = useState('')
  const [dayKey, setDayKey] = useState('')
  const [daySnapshot, setDaySnapshot] = useState('')

  // Security / SSH
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [sshKeyInput, setSshKeyInput] = useState('')
  const [sshKeys, setSshKeys] = useState<string[]>([])

  // New LLM key form
  const [newLlmName, setNewLlmName] = useState('')
  const [newLlmProvider, setNewLlmProvider] = useState<string>('anthropic')
  const [newLlmKey, setNewLlmKey] = useState('')
  const [newLlmModel, setNewLlmModel] = useState('')

  // Models fetched from hub
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null)

  // New Linear workspace form
  const [newLinearWorkspace, setNewLinearWorkspace] = useState('')
  const [newLinearToken, setNewLinearToken] = useState('')
  const [newLinearSecret, setNewLinearSecret] = useState('')

  // Secrets — separate endpoint
  const [secrets, setSecrets] = useState<string[]>([])
  const [newSecretName, setNewSecretName] = useState('')
  const [newSecretValue, setNewSecretValue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, sec, models] = await Promise.all([
        fetchSettings(),
        listSecrets().catch(() => []),
        fetchModels().catch(() => null),
      ])
      setSettings(s)
      setRepTtl(s.providers?.replicated?.defaultTtl ?? '')
      setRepInstance(s.providers?.replicated?.defaultInstanceType ?? '')
      setDayUrl(s.providers?.daytona?.apiUrl ?? '')
      setDaySnapshot(s.providers?.daytona?.defaultSnapshot ?? '')
      setSshKeys(s.sshPublicKeys ?? [])
      setSecrets(sec)
      if (models) setModelsData(models)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Save for provider/security/SSH sections (not LLM/Linear/Secrets which save individually) ──
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
      if (JSON.stringify(sshKeys) !== JSON.stringify(settings?.sshPublicKeys ?? [])) {
        patch.sshPublicKeys = sshKeys
      }

      if (Object.keys(patch).length === 0) {
        Alert.alert('No changes', 'Nothing to save.')
        return
      }

      await patchSettings(patch)
      Alert.alert('Saved', 'Settings updated.')
      setRepToken(''); setDayKey(''); setNewPw(''); setConfirmPw('')
      await load()
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  // ── LLM key operations ──
  async function addLlmKey() {
    if (!newLlmName.trim() || !newLlmKey.trim()) {
      Alert.alert('Missing fields', 'Name and API key are required.')
      return
    }
    try {
      await patchSettings({
        llmKeys: [{
          name: newLlmName.trim(),
          provider: newLlmProvider,
          apiKey: newLlmKey.trim(),
          defaultModel: newLlmModel.trim() || undefined,
        }],
      })
      setNewLlmName(''); setNewLlmKey(''); setNewLlmModel('')
      await load()
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function setLlmDefault(name: string) {
    try {
      await patchSettings({ llmKeys: [{ name, default: true }] })
      await load()
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function deleteLlmKey(name: string) {
    Alert.alert('Delete key', `Remove LLM key "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await patchSettings({ llmKeys: [{ name, delete: true }] })
            await load()
          } catch (err) {
            Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error')
          }
        },
      },
    ])
  }

  // ── Linear operations ──
  async function addLinearWorkspace() {
    if (!newLinearWorkspace.trim() || !newLinearToken.trim()) {
      Alert.alert('Missing fields', 'Workspace and token are required.')
      return
    }
    try {
      await patchSettings({
        integrations: {
          linear: [{
            workspace: newLinearWorkspace.trim(),
            token: newLinearToken.trim(),
            webhookSecret: newLinearSecret.trim() || undefined,
          }],
        },
      })
      setNewLinearWorkspace(''); setNewLinearToken(''); setNewLinearSecret('')
      await load()
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // ── Secrets operations ──
  async function addSecret() {
    if (!newSecretName.trim() || !newSecretValue.trim()) {
      Alert.alert('Missing fields', 'Name and value are required.')
      return
    }
    try {
      await putSecret(newSecretName.trim(), newSecretValue.trim())
      setNewSecretName(''); setNewSecretValue('')
      setSecrets(await listSecrets())
    } catch (err) {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function removeSecret(name: string) {
    Alert.alert('Delete secret', `Remove secret "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteSecret(name)
            setSecrets(await listSecrets())
          } catch (err) {
            Alert.alert('Failed', err instanceof Error ? err.message : 'Unknown error')
          }
        },
      },
    ])
  }

  function addSshKey() {
    const key = sshKeyInput.trim()
    if (!key || sshKeys.includes(key)) return
    setSshKeys([...sshKeys, key])
    setSshKeyInput('')
  }

  function removeSshKey(key: string) { setSshKeys(sshKeys.filter((k) => k !== key)) }

  function handleSignOut() {
    Alert.alert('Sign out', 'You will be disconnected from the hub.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || loading} style={styles.saveHeader}>
          {saving ? <ActivityIndicator color={colors.blueLight} size="small" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.blueLight} /></View>
      ) : error ? (
        <View style={styles.flex}>
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSignOut} style={[styles.signOutBtn, { marginTop: 16 }]} activeOpacity={0.8}>
              <LogOut size={17} color={colors.red} />
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex} keyboardVerticalOffset={64}>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">

            {/* LLM KEYS — list + add */}
            <Section title="LLM Keys" subtitle="One key per provider. Default key is used when a template doesn't specify.">
              {(settings?.llmKeys ?? []).length === 0 ? (
                <Text style={styles.emptyText}>No keys configured.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {settings!.llmKeys.map((k) => (
                    <LlmKeyRow key={k.name} k={k} onSetDefault={() => setLlmDefault(k.name)} onDelete={() => deleteLlmKey(k.name)} />
                  ))}
                </View>
              )}

              <View style={styles.divider} />
              <Text style={styles.addHeader}>Add key</Text>
              <Row label="Name">
                <TextInput
                  style={styles.input}
                  placeholder="e.g. anthropic-prod"
                  placeholderTextColor={colors.textMuted}
                  value={newLlmName}
                  onChangeText={setNewLlmName}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
              <Row label="Provider">
                <ProviderPicker
                  value={newLlmProvider}
                  onChange={(p) => { setNewLlmProvider(p); setNewLlmModel('') }}
                />
              </Row>
              <Row label="API Key">
                <TextInput
                  style={styles.input}
                  placeholder={PROVIDER_PLACEHOLDER[newLlmProvider]}
                  placeholderTextColor={colors.textMuted}
                  value={newLlmKey}
                  onChangeText={setNewLlmKey}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </Row>
              <Row label="Default model (optional)">
                <ModelPicker
                  provider={newLlmProvider}
                  modelsData={modelsData}
                  value={newLlmModel}
                  onChange={setNewLlmModel}
                />
              </Row>
              <InlineAddButton label="Add LLM key" onPress={addLlmKey} />
            </Section>

            {/* REPLICATED CMX */}
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
                <TextInput style={styles.input} placeholder="48h" placeholderTextColor={colors.textMuted} value={repTtl} onChangeText={setRepTtl} autoCapitalize="none" autoCorrect={false} />
              </Row>
              <Row label="Default instance">
                <TextInput style={styles.input} placeholder="r1.large" placeholderTextColor={colors.textMuted} value={repInstance} onChangeText={setRepInstance} autoCapitalize="none" autoCorrect={false} />
              </Row>
            </Section>

            {/* DAYTONA */}
            <Section title="Daytona">
              <Row label="API URL">
                <TextInput style={styles.input} placeholder="https://app.daytona.io" placeholderTextColor={colors.textMuted} value={dayUrl} onChangeText={setDayUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
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
                <TextInput style={styles.input} placeholder="daytona-medium" placeholderTextColor={colors.textMuted} value={daySnapshot} onChangeText={setDaySnapshot} autoCapitalize="none" autoCorrect={false} />
              </Row>
            </Section>

            {/* LINEAR INTEGRATIONS — editable */}
            <Section title="Linear Integrations" subtitle="Workspaces available for factory webhooks.">
              {(settings?.integrations?.linear ?? []).length === 0 ? (
                <Text style={styles.emptyText}>No Linear workspaces configured.</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {settings!.integrations!.linear!.map((l) => (
                    <LinearRow key={l.workspace} item={l} />
                  ))}
                </View>
              )}

              <View style={styles.divider} />
              <Text style={styles.addHeader}>Add / update workspace</Text>
              <Text style={styles.hint}>Re-entering an existing workspace updates its token.</Text>
              <Row label="Workspace">
                <TextInput style={styles.input} placeholder="e.g. my-company" placeholderTextColor={colors.textMuted} value={newLinearWorkspace} onChangeText={setNewLinearWorkspace} autoCapitalize="none" autoCorrect={false} />
              </Row>
              <Row label="API Token">
                <TextInput style={styles.input} placeholder="lin_api_…" placeholderTextColor={colors.textMuted} value={newLinearToken} onChangeText={setNewLinearToken} secureTextEntry autoCapitalize="none" autoCorrect={false} />
              </Row>
              <Row label="Webhook Secret (optional)">
                <TextInput style={styles.input} placeholder="whsec_…" placeholderTextColor={colors.textMuted} value={newLinearSecret} onChangeText={setNewLinearSecret} secureTextEntry autoCapitalize="none" autoCorrect={false} />
              </Row>
              <InlineAddButton label="Save workspace" onPress={addLinearWorkspace} />
            </Section>

            {/* SECRETS — list + add */}
            <Section title="Secrets" subtitle="Named secrets referenced by factories via webhook_secret_ref.">
              {secrets.length === 0 ? (
                <Text style={styles.emptyText}>No secrets configured.</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  {secrets.map((name) => (
                    <View key={name} style={styles.listRow}>
                      <Text style={styles.codeText}>{name}</Text>
                      <TouchableOpacity onPress={() => removeSecret(name)} style={styles.iconBtnSm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Trash2 size={16} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.divider} />
              <Text style={styles.addHeader}>Add secret</Text>
              <Row label="Name">
                <TextInput style={styles.input} placeholder="e.g. linear_webhook_secret" placeholderTextColor={colors.textMuted} value={newSecretName} onChangeText={setNewSecretName} autoCapitalize="none" autoCorrect={false} />
              </Row>
              <Row label="Value">
                <TextInput style={styles.input} placeholder="secret value" placeholderTextColor={colors.textMuted} value={newSecretValue} onChangeText={setNewSecretValue} secureTextEntry autoCapitalize="none" autoCorrect={false} />
              </Row>
              <InlineAddButton label="Add secret" onPress={addSecret} />
            </Section>

            {/* SECURITY */}
            <Section title="Security" subtitle="Change the UI login password. Leave blank to keep current.">
              <Row label="New password">
                <TextInput style={styles.input} placeholder="At least 8 characters" placeholderTextColor={colors.textMuted} value={newPw} onChangeText={setNewPw} secureTextEntry autoCapitalize="none" autoCorrect={false} />
              </Row>
              <Row label="Confirm">
                <TextInput style={styles.input} placeholder="Retype password" placeholderTextColor={colors.textMuted} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry autoCapitalize="none" autoCorrect={false} />
              </Row>
            </Section>

            {/* SSH KEYS */}
            <Section title="SSH Public Keys" subtitle="Injected into every provisioned VM.">
              <View style={styles.sshRow}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="ssh-ed25519 AAAA… comment" placeholderTextColor={colors.textMuted} value={sshKeyInput} onChangeText={setSshKeyInput} autoCapitalize="none" autoCorrect={false} multiline />
                <TouchableOpacity onPress={addSshKey} disabled={!sshKeyInput.trim()} style={[styles.addBtn, { backgroundColor: sshKeyInput.trim() ? colors.blue : colors.elevated }]}>
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

            {/* Read-only: GitHub Apps, Factories */}
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

            <View style={{ marginHorizontal: 16, marginTop: 28 }}>
              <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.8}>
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

// ── Subcomponents ──

function LlmKeyRow({ k, onSetDefault, onDelete }: {
  k: LLMKeyView
  onSetDefault: () => void
  onDelete: () => void
}) {
  return (
    <View style={styles.listRow}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.listName}>{k.name}</Text>
          {k.default ? <View style={styles.defaultBadge}><Text style={styles.defaultBadgeText}>default</Text></View> : null}
          {k.keySet ? null : <Text style={styles.unsetText}>(no key)</Text>}
        </View>
        <Text style={styles.listSubtext}>
          {k.provider}{k.defaultModel ? ` · ${k.defaultModel}` : ''}
        </Text>
      </View>
      {!k.default && (
        <TouchableOpacity onPress={onSetDefault} style={styles.iconBtnSm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Star size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onDelete} style={styles.iconBtnSm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Trash2 size={16} color={colors.red} />
      </TouchableOpacity>
    </View>
  )
}

function LinearRow({ item }: { item: LinearIntegrationView }) {
  return (
    <View style={styles.listRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.listName}>{item.workspace}</Text>
        <Text style={styles.listSubtext}>
          {item.tokenSet ? 'Token set' : 'No token'}{item.webhookSecretSet ? ' · webhook secret set' : ''}
        </Text>
      </View>
    </View>
  )
}

function ProviderPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {LLM_PROVIDERS.map((p) => {
        const active = p === value
        return (
          <TouchableOpacity
            key={p}
            onPress={() => onChange(p)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

function ModelPicker({ provider, modelsData, value, onChange }: {
  provider: string
  modelsData: ModelsResponse | null
  value: string
  onChange: (v: string) => void
}) {
  const models = modelsData?.providers?.find(p => p.name === provider)?.models ?? []
  const hasModels = models.length > 0

  return (
    <View style={{ gap: 6 }}>
      <TouchableOpacity
        onPress={() => onChange('')}
        style={[styles.modelChip, value === '' && styles.modelChipActive]}
      >
        <Text style={[styles.modelChipText, value === '' && styles.modelChipTextActive]}>
          — use provider default —
        </Text>
      </TouchableOpacity>
      {hasModels ? (
        models.map((m) => {
          const active = m.id === value
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => onChange(m.id)}
              style={[styles.modelChip, active && styles.modelChipActive]}
            >
              <Text style={[styles.modelChipText, active && styles.modelChipTextActive]}>{m.name}</Text>
            </TouchableOpacity>
          )
        })
      ) : (
        <TextInput
          style={styles.input}
          placeholder="e.g. myprovider/model-name"
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
    </View>
  )
}

function InlineAddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.inlineAddBtn} activeOpacity={0.8}>
      <Plus size={16} color={colors.white} />
      <Text style={styles.inlineAddText}>{label}</Text>
    </TouchableOpacity>
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
  iconBtnSm: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center', marginRight: 36 },
  saveHeader: { position: 'absolute', right: 12, top: 10, padding: 8 },
  saveText: { color: colors.blueLight, fontSize: 15, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errorText: { color: colors.red, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: colors.elevated, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 4 },
  addHeader: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: -6 },
  emptyText: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  row: {},
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  badge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: { color: '#4ade80', fontSize: 10, fontWeight: '600' },
  defaultBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 6,
  },
  defaultBadgeText: { color: colors.blueLight, fontSize: 9, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  unsetText: { color: colors.red, fontSize: 11 },
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
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: colors.white, fontWeight: '600' },
  modelChip: {
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modelChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  modelChipText: { color: colors.text, fontSize: 13 },
  modelChipTextActive: { color: colors.white, fontWeight: '600' },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.input,
    borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    gap: 8,
  },
  listName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  listSubtext: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  codeText: { color: colors.text, fontSize: 12, fontFamily: 'Menlo', flex: 1 },
  inlineAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.blue,
    borderRadius: 8,
    paddingVertical: 10,
  },
  inlineAddText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  sshRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sshKey: { backgroundColor: colors.input, borderRadius: 8, padding: 10, marginTop: 6 },
  sshKeyText: { color: colors.text, fontSize: 11, fontFamily: 'Menlo' },
  roRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  roLabel: { color: colors.text, fontSize: 13, fontWeight: '500' },
  roValue: { color: colors.textMuted, fontSize: 12 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  signOutText: { color: colors.red, fontSize: 14, fontWeight: '600' },
})
