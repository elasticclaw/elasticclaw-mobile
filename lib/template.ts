import { parse as parseYAML } from "yaml"
import { getHubTemplate } from "./api"
import type { CreateClawRequest, TemplateConfig } from "./types"

const CONFIG_FILE = "elasticclaw-config.yaml"

export class TemplateResolutionError extends Error {}

export function parseTemplateConfig(yaml: string): TemplateConfig {
  const cfg = parseYAML(yaml) as TemplateConfig | null
  if (!cfg || typeof cfg !== "object") {
    throw new TemplateResolutionError(`${CONFIG_FILE} is empty or invalid`)
  }
  if (!cfg.provider) {
    throw new TemplateResolutionError(`${CONFIG_FILE} is missing 'provider'`)
  }
  return cfg
}

export interface ResolvedTemplate {
  config: TemplateConfig
  files: Record<string, string>
}

export async function resolveHubTemplate(name: string): Promise<ResolvedTemplate> {
  const { files } = await getHubTemplate(name)
  const configYAML = files[CONFIG_FILE]
  if (!configYAML) {
    throw new TemplateResolutionError(
      `hub template "${name}" is missing ${CONFIG_FILE}`
    )
  }
  const config = parseTemplateConfig(configYAML)
  const templateFiles = { ...files }
  delete templateFiles[CONFIG_FILE]
  return { config, files: templateFiles }
}

export interface BuildRequestOptions {
  name: string
  templateName: string
  resolved: ResolvedTemplate
  /** User overrides — applied after template config. */
  overrides?: {
    color?: string
    tags?: string[]
    env?: Record<string, string>
    instanceType?: string
    ttl?: string
  }
  /** Template source tag ("hub"). Mirrors CLI auto-tagging. */
  source?: "hub" | "local"
}

export function buildCreateRequest(opts: BuildRequestOptions): CreateClawRequest {
  const { name, templateName, resolved, overrides, source = "hub" } = opts
  const cfg = resolved.config
  const tags = mergeTags(templateName, source, cfg.tags, overrides?.tags)
  return {
    name,
    template_name: templateName,
    provider: cfg.provider,
    resources: cfg.resources,
    instance_type: overrides?.instanceType ?? cfg.instance_type,
    image: cfg.image,
    ttl: overrides?.ttl ?? cfg.ttl,
    default_model: cfg.default_model,
    llm_key: cfg.llm_key,
    snapshot: cfg.snapshot,
    files: resolved.files,
    env: overrides?.env,
    github: cfg.github,
    linear: cfg.linear,
    auto_watch_ci: cfg.auto_watch_ci,
    auto_watch_bugbot: cfg.auto_watch_bugbot,
    nix: cfg.nix,
    tags,
    color: overrides?.color ?? cfg.color,
  }
}

function mergeTags(
  templateName: string,
  source: string,
  configTags: string[] | undefined,
  overrideTags: string[] | undefined
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (t: string) => {
    const v = t.trim()
    if (!v || seen.has(v)) return
    seen.add(v)
    out.push(v)
  }
  add(`template:${templateName}`)
  if (source) add(`source:${source}`)
  configTags?.forEach(add)
  overrideTags?.forEach(add)
  return out
}
