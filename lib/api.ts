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
export interface SettingsView {
  llmKeys: Record<string, boolean>
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
  integrations?: { linear?: Array<{ workspace: string; tokenSet: boolean; webhookSecretSet: boolean }> }
  factories?: Array<{ name: string; integration: string; workspace: string; team: string; triggerStatus: string; doneStatus: string; template: string; color?: string; tags?: string[]; terminateOnLeave?: boolean; webhookSecretSet?: boolean }>
}

export interface SettingsPatch {
  llmKeys?: Record<string, string>
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

export function getHubWsUrl(): string {
  const token = getTokenSync()
  const hub = getHubUrl()
  const wsBase = hub.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
  return `${wsBase}/api/ws?token=${encodeURIComponent(token)}`
}

export function clearConfig() {
  _token = null
  _tokenPromise = null
}
