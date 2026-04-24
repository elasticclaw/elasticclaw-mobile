import { useState, useEffect, useRef, useCallback } from "react"
import type { Claw, Message } from "@/lib/types"
import type { ApiClaw } from "@/lib/types"
import {
  fetchClaws,
  fetchMessages,
  sendMessage as apiSendMessage,
  createClaw as apiCreateClaw,
  killClaw as apiKillClaw,
  patchClaw as apiPatchClaw,
  getHubWsUrl,
  resolveToken,
} from "@/lib/api"
import { buildAttachmentsFooter, type PendingAttachment } from "@/lib/attachments"
import { resolveHubTemplate, buildCreateRequest } from "@/lib/template"
import { mapApiClaw, mapApiMessage, mapApiStatus, computeUptime } from "@/lib/mappers"
import { useTypewriter, type TypewriterState } from "@/hooks/use-typewriter"
import * as storage from "@/lib/storage"

export interface HubState {
  claws: Claw[]
  messages: Record<string, Message[]>
  streamingBuffers: Record<string, TypewriterState>
  connected: boolean
  configured: boolean
  loading: boolean
  hubError: string | null
  send: (clawId: string, content: string, attachments?: PendingAttachment[]) => Promise<void>
  createClaw: (req: { name: string; template: string; color?: string }) => Promise<void>
  killClaw: (clawId: string) => Promise<void>
  patchClaw: (clawId: string, patch: { name?: string; tags?: string[]; color?: string }) => Promise<void>
  newSession: (clawId: string) => void
  loadMessages: (clawId: string) => Promise<void>
  setPinned: (clawId: string, pinned: boolean) => void
  setUnreadCount: (clawId: string, count: number) => void
  refreshClaws: () => Promise<void>
}

const MAX_CACHED_PER_CLAW = 200

export function useHub(selectedClawId: string | null): HubState {
  const [claws, setClaws] = useState<Claw[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const messagesRef = useRef<Record<string, Message[]>>({})
  const [connected, setConnected] = useState(false)
  const { displayBuffers: streamingBuffers, pushChunk, finalize: finalizeTypewriter } = useTypewriter()
  const [configured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [hubError, setHubError] = useState<string | null>(null)

  const pinnedRef = useRef<Record<string, boolean>>({})
  const wsRef = useRef<WebSocket | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const selectedClawIdRef = useRef<string | null>(selectedClawId)

  useEffect(() => { selectedClawIdRef.current = selectedClawId }, [selectedClawId])
  useEffect(() => { messagesRef.current = messages }, [messages])

  const persistMessages = useCallback((msgs: Record<string, Message[]>) => {
    const toSave: Record<string, unknown[]> = {}
    for (const [clawId, clawMsgs] of Object.entries(msgs)) {
      toSave[clawId] = clawMsgs
        .filter((m) => !m.id.startsWith('opt-') && m.role !== 'system')
        .slice(-MAX_CACHED_PER_CLAW)
    }
    storage.persistMessages(toSave).catch(() => {})
  }, [])

  // Load pinned + message cache from storage on mount
  useEffect(() => {
    storage.loadPinned().then((pinned) => {
      pinnedRef.current = pinned
    }).catch(() => {})

    storage.loadCachedMessages().then((cached) => {
      if (!cached) return
      const hydrated: Record<string, Message[]> = {}
      for (const [clawId, msgs] of Object.entries(cached)) {
        hydrated[clawId] = msgs.map((m) => ({
          ...m,
          role: m.role as Message['role'],
          timestamp: new Date(m.timestamp),
        }))
      }
      setMessages(hydrated)
    }).catch(() => {})
  }, [])

  const savePinnedState = useCallback((pinned: Record<string, boolean>) => {
    pinnedRef.current = pinned
    storage.savePinned(pinned).catch(() => {})
  }, [])

  const setPinned = useCallback((clawId: string, pinned: boolean) => {
    const next = { ...pinnedRef.current, [clawId]: pinned }
    savePinnedState(next)
    setClaws((prev) => prev.map((c) => (c.id === clawId ? { ...c, pinned } : c)))
  }, [savePinnedState])

  const setUnreadCount = useCallback((clawId: string, count: number) => {
    setClaws((prev) => prev.map((c) => (c.id === clawId ? { ...c, unreadCount: count } : c)))
  }, [])

  const mergeClaws = useCallback((apiClaws: ApiClaw[]) => {
    setClaws((prev) => {
      const prevMap = new Map(prev.map((c) => [c.id, c]))
      return apiClaws.map((ac) => {
        const existing = prevMap.get(ac.id)
        return mapApiClaw(ac, {
          unreadCount: existing?.unreadCount ?? 0,
          isStreaming: existing?.isStreaming ?? false,
          pinned: pinnedRef.current[ac.id] ?? false,
          tags: existing?.tags,
          uptime: computeUptime(ac),
        })
      })
    })
  }, [])

  const refreshClaws = useCallback(async (): Promise<void> => {
    try {
      const apiClaws = await fetchClaws()
      mergeClaws(apiClaws)
      setHubError(null)
      setLoading(false)
    } catch (err) {
      setHubError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }, [mergeClaws])

  const loadMessages = useCallback(async (clawId: string) => {
    try {
      const apiMsgs = await fetchMessages(clawId)
      const msgs = apiMsgs.map(mapApiMessage)

      const existingIds = new Set((messagesRef.current[clawId] || []).map((m) => m.id))
      const newClawMsgs = msgs.filter((m) => !existingIds.has(m.id) && m.role !== 'user' && m.role !== 'system')

      setMessages((prev) => {
        const existing = prev[clawId] || []
        const existingNonOpt = existing.filter((m) => !m.id.startsWith('opt-'))
        const apiIds = new Set(msgs.map((m) => m.id))
        const cachedOnly = existingNonOpt.filter((m) => !apiIds.has(m.id))
        const inflight = existing.filter((m) =>
          m.id.startsWith('opt-') && !msgs.some((r) => r.content === m.content && r.role === m.role)
        )
        const merged = [...msgs, ...cachedOnly, ...inflight]
        merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        const next = { ...prev, [clawId]: merged }
        persistMessages(next)
        return next
      })

      if (newClawMsgs.length > 0 && selectedClawIdRef.current !== clawId) {
        setClaws((prev) =>
          prev.map((c) =>
            c.id === clawId ? { ...c, unreadCount: c.unreadCount + newClawMsgs.length } : c
          )
        )
      }
    } catch (err) {
      console.warn(`Failed to load messages for ${clawId}:`, err)
    }
  }, [persistMessages])

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) wsRef.current.close()

    const wsUrl = getHubWsUrl()
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (err) {
      console.error('WS create failed:', err)
      return
    }
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onclose = () => {
      setConnected(false)
      setTimeout(connectWebSocket, 3000)
    }

    ws.onerror = (err) => console.warn('WS error:', err)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        const { type, payload } = data

        if (type === 'chunk') {
          const { claw_id, content } = payload
          pushChunk(claw_id, content)
          setClaws((prev) => prev.map((c) => c.id === claw_id ? { ...c, isStreaming: true } : c))
        } else if (type === 'message') {
          const msg = mapApiMessage(payload)
          const clawId = payload.claw_id

          // Dedupe: skip if we already have this message (e.g. echo of our own POST).
          const existing = messagesRef.current[clawId] || []
          if (existing.some((m) => m.id === msg.id)) return

          // User messages — either from another device (web) or a quick WS echo
          // that beat the REST response. No typewriter; append or swap optimistic.
          if (msg.role === 'user') {
            setMessages((prev) => {
              const msgs = prev[clawId] || []
              const optMatch = msgs.find(
                (m) => m.id.startsWith('opt-') && m.role === 'user' && m.content === msg.content
              )
              const updated = optMatch
                ? msgs.map((m) => (m.id === optMatch.id ? msg : m))
                : [...msgs, msg]
              const next = { ...prev, [clawId]: updated }
              persistMessages(next)
              return next
            })
            return
          }

          // Claw / system messages — run through typewriter so streaming drains first.
          finalizeTypewriter(clawId, () => {
            setClaws((prev) =>
              prev.map((c) =>
                c.id === clawId
                  ? {
                      ...c,
                      isStreaming: false,
                      unreadCount: selectedClawIdRef.current !== clawId && msg.role === 'claw'
                        ? c.unreadCount + 1
                        : c.unreadCount,
                    }
                  : c
              )
            )
            setMessages((prev) => {
              // Dedupe check again inside updater in case of race.
              const current = prev[clawId] || []
              if (current.some((m) => m.id === msg.id)) return prev
              const next = { ...prev, [clawId]: [...current, msg] }
              persistMessages(next)
              return next
            })
          })
        } else if (type === 'claw_status') {
          const { claw_id, status } = payload
          if (status === 'deleted') {
            setClaws((prev) => prev.filter((c) => c.id !== claw_id))
          } else {
            setClaws((prev) =>
              prev.map((c) =>
                c.id === claw_id
                  ? { ...c, status: mapApiStatus(status), isStreaming: status !== 'connected' ? false : c.isStreaming }
                  : c
              )
            )
            setClaws((prev) => {
              if (!prev.find((c) => c.id === claw_id)) refreshClaws()
              return prev
            })
          }
        } else if (type === 'claw_error') {
          const { claw_id } = payload
          setClaws((prev) =>
            prev.map((c) => c.id === claw_id ? { ...c, status: 'error', isStreaming: false } : c)
          )
        }
      } catch (err) {
        console.warn('Failed to parse WS message:', err)
      }
    }
  }, [mergeClaws, refreshClaws, pushChunk, finalizeTypewriter, persistMessages])

  useEffect(() => {
    refreshClaws()
    pollIntervalRef.current = setInterval(refreshClaws, 10_000)
    resolveToken().then(() => connectWebSocket())

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (clawId: string, content: string, attachments?: PendingAttachment[]) => {
    if (!clawId || (!content.trim() && !attachments?.length)) return

    const footer = buildAttachmentsFooter(attachments ?? [])
    const fullContent = content.trim() + footer

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      role: 'user',
      content: fullContent,
      timestamp: new Date(),
    }
    setMessages((prev) => {
      const next = { ...prev, [clawId]: [...(prev[clawId] || []), optimistic] }
      persistMessages(next)
      return next
    })
    setClaws((prev) => prev.map((c) => c.id === clawId ? { ...c, isStreaming: true } : c))
    pushChunk(clawId, '')

    try {
      const sent = await apiSendMessage(clawId, fullContent)
      const realMsg = mapApiMessage(sent)
      setMessages((prev) => {
        const msgs = prev[clawId] || []
        const hasReal = msgs.some((m) => m.id === realMsg.id)
        const updated = hasReal
          ? msgs.filter((m) => m.id !== optimistic.id)
          : msgs.map((m) => (m.id === optimistic.id ? realMsg : m))
        const next = { ...prev, [clawId]: updated }
        persistMessages(next)
        return next
      })
    } catch (err) {
      console.error('Failed to send message:', err)
      setClaws((prev) => prev.map((c) => c.id === clawId ? { ...c, isStreaming: false } : c))
    }
  }, [persistMessages, pushChunk])

  const createClaw = useCallback(async (req: { name: string; template: string; color?: string }) => {
    const resolved = await resolveHubTemplate(req.template)
    const fullReq = buildCreateRequest({
      name: req.name,
      templateName: req.template,
      resolved,
      overrides: { color: req.color },
      source: 'hub',
    })
    const apiClaw = await apiCreateClaw(fullReq)
    const claw = mapApiClaw(apiClaw, {
      pinned: false,
      unreadCount: 0,
      isStreaming: false,
      color: fullReq.color,
    })
    setClaws((prev) => [claw, ...prev])
  }, [])

  const killClaw = useCallback(async (clawId: string) => {
    await apiKillClaw(clawId)
    setClaws((prev) => prev.filter((c) => c.id !== clawId))
    setMessages((prev) => {
      const next = { ...prev }
      delete next[clawId]
      persistMessages(next)
      return next
    })
  }, [persistMessages])

  const patchClaw = useCallback(async (
    clawId: string,
    patch: { name?: string; tags?: string[]; color?: string }
  ) => {
    await apiPatchClaw(clawId, patch)
    setClaws((prev) =>
      prev.map((c) => (c.id === clawId ? { ...c, ...patch } : c))
    )
  }, [])

  const newSession = useCallback((clawId: string) => {
    const marker: Message = {
      id: `sys-${Date.now()}`,
      role: 'system',
      content: 'Context Reset',
      timestamp: new Date(),
    }
    setMessages((prev) => ({
      ...prev,
      [clawId]: [...(prev[clawId] || []), marker],
    }))
  }, [])

  return {
    claws, messages, streamingBuffers, connected, configured,
    loading, hubError, send, createClaw, killClaw, patchClaw, newSession,
    loadMessages, setPinned, setUnreadCount, refreshClaws,
  }
}
