export type ClawStatus = "connected" | "idle" | "offline" | "provisioning" | "error"

export interface Claw {
  id: string
  name: string
  template: string
  status: ClawStatus
  uptime: number // in seconds, computed from created_at
  unreadCount: number
  isStreaming: boolean
  pinned: boolean
  tags: string[]
  color: string // accent color name, e.g. "blue", "emerald"
  contextUsage: number // 0-100 percentage
  description?: string
  ssh_host?: string
  ssh_port?: number
  ssh_user?: string
  last_seen?: string
  created_at?: string
  tenant_id?: string
}

export interface Message {
  id: string
  role: "user" | "claw" | "system"
  content: string
  timestamp: Date
  claw_id?: string
  tenant_id?: string
}

export interface ApiClaw {
  id: string
  name: string
  template: string
  status: "connected" | "offline" | "provisioning" | "starting" | "error"
  last_seen: string
  created_at: string
  tenant_id: string
  context_usage?: number
  tags?: string[]
  color?: string
  ssh_host?: string
  ssh_port?: number
  ssh_user?: string
}

export interface ApiMessage {
  id: string
  claw_id: string
  tenant_id: string
  role: "user" | "claw"
  content: string
  created_at: string
}

// ── Template config (parsed from elasticclaw-config.yaml) ──
// Mirrors pkg/types/template.go:TemplateConfig. Keep in sync.

export interface GitHubRepoAccess {
  repo: string
  permissions?: "read" | "write"
}

export interface GitHubTemplateConfig {
  repos: GitHubRepoAccess[]
}

export interface LinearTemplateConfig {
  workspace?: string
  team?: string
}

export interface TemplateResources {
  cpu?: string
  memory?: string
  disk?: string
}

export interface TemplateConfig {
  provider: string
  resources?: TemplateResources
  instance_type?: string
  image?: string
  ttl?: string
  default_model?: string
  llm_key?: string
  snapshot?: string
  auto_watch_ci?: boolean
  auto_watch_bugbot?: boolean
  github?: GitHubTemplateConfig
  linear?: LinearTemplateConfig
  nix?: boolean
  tags?: string[]
  color?: string
}

// Mirrors pkg/types/template.go:CreateClawRequest. Keep in sync.
export interface CreateClawRequest {
  name: string
  template_name: string
  provider: string
  resources?: TemplateResources
  instance_type?: string
  image?: string
  ttl?: string
  default_model?: string
  llm_key?: string
  snapshot?: string
  files: Record<string, string>
  env?: Record<string, string>
  github?: GitHubTemplateConfig
  linear?: LinearTemplateConfig
  auto_watch_ci?: boolean
  auto_watch_bugbot?: boolean
  nix?: boolean
  tags?: string[]
  color?: string
}
