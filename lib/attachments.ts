// Shared types and pure utilities for the file-attachment feature.
// Consumed by the useAttachments hook and by chat render code.
// Mirrors elasticclaw/web/lib/attachments.ts — keep in sync.

export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_FILES_PER_MSG = 10
export const ATTACHMENTS_MARKER = "\n\n[Attachments]\n"

export interface PendingAttachment {
  localId: string
  name: string
  size: number
  mimetype: string
  path?: string
  previewUrl?: string // object URL for images (revoked on remove / clear / unmount)
  status: "uploading" | "ready" | "error"
  error?: string
}

export interface ParsedAttachment {
  name: string
  path: string
  mimetype: string
  sizeLabel: string
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

// buildAttachmentsFooter renders the paths/sizes block that gets appended to
// a user message so the agent can Read the files at the paths the bridge wrote.
export function buildAttachmentsFooter(atts: PendingAttachment[]): string {
  if (atts.length === 0) return ""
  const lines = atts
    .filter((a) => a.status === "ready" && a.path)
    .map((a) => `- ${a.name} — ${a.path} (${a.mimetype}, ${formatBytes(a.size)})`)
  if (lines.length === 0) return ""
  return `${ATTACHMENTS_MARKER}${lines.join("\n")}`
}

// splitAttachmentsFooter extracts the attachments block from stored message
// content so history can render chips without a schema change.
export function splitAttachmentsFooter(content: string): { body: string; attachments: ParsedAttachment[] } {
  const embeddedIdx = content.indexOf(ATTACHMENTS_MARKER)
  const leadingMarker = "[Attachments]\n"
  const leading = embeddedIdx < 0 && content.startsWith(leadingMarker)
  if (embeddedIdx < 0 && !leading) return { body: content, attachments: [] }
  const idx = leading ? 0 : embeddedIdx
  const markerLen = leading ? leadingMarker.length : ATTACHMENTS_MARKER.length
  const body = content.slice(0, idx)
  const tail = content.slice(idx + markerLen)
  const atts: ParsedAttachment[] = []
  for (const line of tail.split("\n")) {
    // Expected: "- name — path (mimetype, size)". Greedy captures round-trip
    // correctly even with "(" inside filenames.
    const m = /^-\s+(.+)\s+—\s+(.+)\s+\(([^,]+),\s*([^)]+)\)\s*$/.exec(line)
    if (!m) continue
    atts.push({ name: m[1], path: m[2], mimetype: m[3], sizeLabel: m[4] })
  }
  if (atts.length === 0) return { body: content, attachments: [] }
  return { body, attachments: atts }
}
