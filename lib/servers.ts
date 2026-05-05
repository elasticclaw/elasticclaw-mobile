import * as SecureStore from 'expo-secure-store'

const SERVERS_KEY = 'ec_servers'
const ACTIVE_SERVER_KEY = 'ec_active_server_id'

export interface ServerConfig {
  id: string
  name: string
  url: string
  token: string
  lastUsedAt: string // ISO timestamp
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export async function listServers(): Promise<ServerConfig[]> {
  const raw = await SecureStore.getItemAsync(SERVERS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as ServerConfig[]
  } catch {
    return []
  }
}

export async function getActiveServerId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_SERVER_KEY)
}

export async function getActiveServer(): Promise<ServerConfig | null> {
  const id = await getActiveServerId()
  if (!id) return null
  const servers = await listServers()
  return servers.find((s) => s.id === id) ?? null
}

export async function addServer(opts: { name: string; url: string; token: string }): Promise<ServerConfig> {
  const servers = await listServers()
  const normalizedUrl = opts.url.replace(/\/$/, '')

  // Update existing if same URL
  const existing = servers.find((s) => s.url === normalizedUrl)
  if (existing) {
    existing.name = opts.name
    existing.token = opts.token
    existing.lastUsedAt = new Date().toISOString()
    await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(servers))
    await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, existing.id)
    return existing
  }

  const server: ServerConfig = {
    id: generateId(),
    name: opts.name,
    url: normalizedUrl,
    token: opts.token,
    lastUsedAt: new Date().toISOString(),
  }
  servers.push(server)
  await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(servers))
  await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, server.id)
  return server
}

export async function switchServer(id: string): Promise<boolean> {
  const servers = await listServers()
  const server = servers.find((s) => s.id === id)
  if (!server) return false
  server.lastUsedAt = new Date().toISOString()
  await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(servers))
  await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, id)
  return true
}

export async function removeServer(id: string): Promise<void> {
  const servers = await listServers()
  const filtered = servers.filter((s) => s.id !== id)
  await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(filtered))

  const activeId = await getActiveServerId()
  if (activeId === id) {
    const next = filtered[0]
    if (next) {
      await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, next.id)
    } else {
      await SecureStore.deleteItemAsync(ACTIVE_SERVER_KEY)
    }
  }
}

export async function renameServer(id: string, name: string): Promise<void> {
  const servers = await listServers()
  const server = servers.find((s) => s.id === id)
  if (server) {
    server.name = name
    await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(servers))
  }
}

// Legacy migration: if old single-server keys exist, migrate them
export async function migrateLegacyServer(): Promise<void> {
  const [oldUrl, oldToken] = await Promise.all([
    SecureStore.getItemAsync('ec_hub_url'),
    SecureStore.getItemAsync('ec_hub_token'),
  ])
  if (oldUrl && oldToken) {
    const servers = await listServers()
    const exists = servers.some((s) => s.url === oldUrl.replace(/\/$/, ''))
    if (!exists) {
      await addServer({ name: 'Default', url: oldUrl, token: oldToken })
    }
    // Clean up old keys
    await SecureStore.deleteItemAsync('ec_hub_url')
    await SecureStore.deleteItemAsync('ec_hub_token')
  }
}
