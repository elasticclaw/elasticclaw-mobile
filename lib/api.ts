import type { ApiClaw, ApiMessage, CreateClawRequest } from "./types"
import { getHubUrl } from "./hub-url"
import { getToken } from "./storage"

let _token: string | null = null
let _tokenPromise: Promise<string> | null = null

export function resolveToken(): Promise<string> {
  if (_token) return Promise.resolve(_token)
  if (_tokenPromise) return _tokenPromise

  _tokenPromise = getToken().then((stored) => {
    _token = stored || ''
    _tokenPromise = null
    return _token
  })

  return _tokenPromise
}

export function setTokenCache(token: string) {
  _token = token
  _tokenPromise = null
}

function getTokenSync(): string {
  return _token || ''
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await resolveToken()
  const hubBase = getHubUrl()
  const url = `${hubBase}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function fetchClaws(): Promise<ApiClaw[]> {
  return apiFetch<ApiClaw[]>('/api/claws')
}

export async function fetchMessages(clawId: string, opts?: { before?: string; after?: string }): Promise<ApiMessage[]> {
  const params = new URLSearchParams()
  if (opts?.before) params.set('before', opts.before)
  if (opts?.after) params.set('after', opts.after)
  const qs = params.toString() ? '?' + params.toString() : ''
  return apiFetch<ApiMessage[]>(`/api/messages/${clawId}${qs}`)
}

export async function sendMessage(clawId: string, content: string): Promise<ApiMessage> {
  return apiFetch<ApiMessage>(`/api/messages/${clawId}`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export async function createClaw(req: CreateClawRequest): Promise<ApiClaw> {
  return apiFetch<ApiClaw>('/api/claws', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function killClaw(id: string): Promise<void> {
  return apiFetch<void>(`/api/claws/${id}`, { method: 'DELETE' })
}

export interface HubTemplate {
  name: string
  updatedAt?: string
}

export async function fetchTemplates(): Promise<HubTemplate[]> {
  return apiFetch<HubTemplate[]>('/api/templates')
}

export async function getHubTemplate(
  name: string
): Promise<{ name: string; files: Record<string, string> }> {
  return apiFetch(`/api/templates/${encodeURIComponent(name)}`)
}

export async function patchClaw(
  id: string,
  patch: { name?: string; tags?: string[]; color?: string }
): Promise<void> {
  return apiFetch<void>(`/api/claws/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

// ── Settings ──
// Mirrors pkg/hub/settings.go. Keep in sync.

export interface LLMKeyView {
  name: string
  provider: string
  keySet: boolean
  default: boolean
  defaultModel?: string
}

export interface LinearIntegrationView {
  workspace: string
  tokenSet: boolean
  webhookSecretSet: boolean
}

export interface SettingsView {
  llmKeys: LLMKeyView[]
  providers: Record<string, {
    type: string
    enabled?: boolean
    tokenSet?: boolean
    apiKeySet?: boolean
    apiUrl?: string
    defaultTtl?: string
    defaultInstanceType?: string
    defaultSnapshot?: string
  }>
  github: Array<{ appId: number; url?: string; keySet: boolean }>
  sshPublicKeys: string[]
  integrations?: {
    linear?: LinearIntegrationView[]
    shortcut?: Array<{ workspace: string; tokenSet: boolean }>
  }
  factories?: Array<{ name: string; integration: string; workspace: string; team: string; triggerStatus: string; doneStatus: string; template: string; color?: string; tags?: string[]; terminateOnLeave?: boolean; webhookSecretSet?: boolean }>
  secrets?: string[]
}

export interface LLMKeyPatch {
  name: string
  provider?: string
  apiKey?: string
  default?: boolean
  delete?: boolean
  defaultModel?: string
}

export interface LinearIntegrationPatch {
  workspace: string
  originalWorkspace?: string
  token?: string
  webhookSecret?: string
}

export interface SettingsPatch {
  llmKeys?: LLMKeyPatch[]
  providers?: Record<string, {
    token?: string
    apiKey?: string
    apiUrl?: string
    defaultTtl?: string
    defaultInstanceType?: string
    defaultSnapshot?: string
  }>
  uiPassword?: string
  sshPublicKeys?: string[]
  integrations?: {
    linear?: LinearIntegrationPatch[]
  }
}

export async function fetchSettings(): Promise<SettingsView> {
  return apiFetch<SettingsView>('/api/settings')
}

export async function patchSettings(patch: SettingsPatch): Promise<void> {
  await apiFetch('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

// ── Secrets ── (separate endpoint, not part of /api/settings)

export async function listSecrets(): Promise<string[]> {
  const res = await apiFetch<{ secrets: string[] }>('/api/secrets')
  return res.secrets ?? []
}

export async function putSecret(name: string, value: string): Promise<void> {
  await apiFetch('/api/secrets', {
    method: 'PUT',
    body: JSON.stringify({ name, value }),
  })
}

export async function deleteSecret(name: string): Promise<void> {
  await apiFetch(`/api/secrets?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

export function getHubWsUrl(): string {
  const token = getTokenSync()
  const hub = getHubUrl()
  const wsBase = hub.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  return `${wsBase}/api/ws?token=${encodeURIComponent(token)}`
}

export interface UploadedAttachment {
  name: string
  path: string
  size: number
  mimetype: string
}

// getFileViewUrl returns the hub URL that serves the bytes of an uploaded
// file back to the client. Auth is via ?token query since React Native image
// components can't set Authorization headers.
export function getFileViewUrl(clawId: string, path: string): string {
  const token = getTokenSync()
  const hubBase = getHubUrl()
  const base = `${hubBase}/api/files/view/${clawId}`
  const qs = new URLSearchParams({ path, token }).toString()
  return `${base}?${qs}`
}

export async function uploadFiles(
  clawId: string,
  files: { uri: string; name: string; type: string }[]
): Promise<UploadedAttachment[]> {
  const token = await resolveToken()
  const hubBase = getHubUrl()
  const url = `${hubBase}/api/files/${clawId}`

  const form = new FormData()
  for (const f of files) {
    // React Native expects a File-like object with uri, name, type
    form.append("files", {
      uri: f.uri,
      name: f.name,
      type: f.type,
    } as any)
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    throw new Error(`upload failed ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.files as UploadedAttachment[]
}

export function clearConfig() {
  _token = null
  _tokenPromise = null
}

// ── Models ──

export interface ModelInfo {
  id: string
  name: string
}

export type ProviderModels = Record<string, ModelInfo[]>

export async function fetchModels(provider?: string): Promise<ProviderModels | { provider: string; models: ModelInfo[] }> {
  const qs = provider ? `?provider=${encodeURIComponent(provider)}` : ''
  return apiFetch(`/api/models${qs}`)
}
