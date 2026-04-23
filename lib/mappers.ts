import type { ApiClaw, ApiMessage, Claw, Message, ClawStatus } from "./types"

export const CLAW_COLORS = [
  "slate", "red", "orange", "amber", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "pink", "rose",
] as const

export type ClawColor = typeof CLAW_COLORS[number]

function autoColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  }
  return CLAW_COLORS[h % CLAW_COLORS.length]
}

// Hex colors for each named color (NativeWind doesn't support CSS variables)
export const COLOR_HEX: Record<string, { border: string; bubble: string; dot: string }> = {
  slate:   { border: '#64748b', bubble: '#64748b1a', dot: '#94a3b8' },
  red:     { border: '#ef4444', bubble: '#ef44441a', dot: '#f87171' },
  orange:  { border: '#f97316', bubble: '#f973161a', dot: '#fb923c' },
  amber:   { border: '#f59e0b', bubble: '#f59e0b1a', dot: '#fbbf24' },
  lime:    { border: '#84cc16', bubble: '#84cc161a', dot: '#a3e635' },
  green:   { border: '#22c55e', bubble: '#22c55e1a', dot: '#4ade80' },
  emerald: { border: '#10b981', bubble: '#10b9811a', dot: '#34d399' },
  teal:    { border: '#14b8a6', bubble: '#14b8a61a', dot: '#2dd4bf' },
  cyan:    { border: '#06b6d4', bubble: '#06b6d41a', dot: '#22d3ee' },
  sky:     { border: '#0ea5e9', bubble: '#0ea5e91a', dot: '#38bdf8' },
  blue:    { border: '#3b82f6', bubble: '#3b82f61a', dot: '#60a5fa' },
  indigo:  { border: '#6366f1', bubble: '#6366f11a', dot: '#818cf8' },
  violet:  { border: '#8b5cf6', bubble: '#8b5cf61a', dot: '#a78bfa' },
  purple:  { border: '#a855f7', bubble: '#a855f71a', dot: '#c084fc' },
  pink:    { border: '#ec4899', bubble: '#ec48991a', dot: '#f472b6' },
  rose:    { border: '#f43f5e', bubble: '#f43f5e1a', dot: '#fb7185' },
}

export function computeUptime(apiClaw: ApiClaw): number {
  if (apiClaw.status !== "connected") return 0
  try {
    const created = new Date(apiClaw.created_at).getTime()
    return Math.max(0, Math.floor((Date.now() - created) / 1000))
  } catch {
    return 0
  }
}

export function mapApiStatus(status: ApiClaw["status"]): ClawStatus {
  switch (status) {
    case "connected": return "connected"
    case "provisioning":
    case "starting": return "provisioning"
    case "error": return "error"
    default: return "offline"
  }
}

export function mapApiClaw(apiClaw: ApiClaw, overrides: Partial<Claw> = {}): Claw {
  return {
    id: apiClaw.id,
    name: apiClaw.name,
    template: apiClaw.template,
    status: overrides.status ?? mapApiStatus(apiClaw.status),
    uptime: overrides.uptime ?? computeUptime(apiClaw),
    unreadCount: overrides.unreadCount ?? 0,
    isStreaming: overrides.isStreaming ?? false,
    pinned: overrides.pinned ?? false,
    tags: overrides.tags ?? (apiClaw.tags ?? []),
    color: overrides.color ?? (apiClaw.color || autoColor(apiClaw.name)),
    contextUsage: overrides.contextUsage ?? apiClaw.context_usage ?? 0,
    description: overrides.description,
    ssh_host: apiClaw.ssh_host,
    ssh_port: apiClaw.ssh_port,
    ssh_user: apiClaw.ssh_user,
    last_seen: apiClaw.last_seen,
    created_at: apiClaw.created_at,
    tenant_id: apiClaw.tenant_id,
  }
}

export function mapApiMessage(apiMsg: ApiMessage): Message {
  return {
    id: apiMsg.id,
    role: apiMsg.role,
    content: apiMsg.content,
    timestamp: new Date(apiMsg.created_at),
    claw_id: apiMsg.claw_id,
    tenant_id: apiMsg.tenant_id,
  }
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

export function formatRelative(date: Date | string | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function clawInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // Take first non-whitespace letter, uppercase
  return trimmed[0].toUpperCase()
}
