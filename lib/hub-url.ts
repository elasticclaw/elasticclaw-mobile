import { getActiveServer, type ServerConfig } from './servers'

let _activeServer: ServerConfig | null = null

export function getHubUrl(): string {
  return _activeServer?.url ?? ''
}

export function getActiveServerId(): string | null {
  return _activeServer?.id ?? null
}

export function getActiveToken(): string {
  return _activeServer?.token ?? ''
}

export function setActiveServer(server: ServerConfig | null) {
  _activeServer = server
}

export async function refreshActiveServer(): Promise<ServerConfig | null> {
  const server = await getActiveServer()
  _activeServer = server
  return server
}
