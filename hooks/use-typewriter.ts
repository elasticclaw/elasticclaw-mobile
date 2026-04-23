import { useRef, useCallback, useEffect, useState } from "react"

const CHARS_PER_MS = 0.18

interface TypewriterEntry {
  clawId: string
  queue: string
  shown: string
  done: boolean
  hadChunks: boolean
  pausedAt: number | null
}

export interface TypewriterState {
  text: string
  hadChunks: boolean
  isPaused: boolean
}

export function useTypewriter() {
  const entries = useRef<Record<string, TypewriterEntry>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTickRef = useRef<number>(0)
  const [displayBuffers, setDisplayBuffers] = useState<Record<string, TypewriterState>>({})
  const onDrainCallbacks = useRef<Record<string, () => void>>({})

  const tick = useCallback(() => {
    const now = Date.now()
    const dt = lastTickRef.current ? now - lastTickRef.current : 16
    lastTickRef.current = now

    const charsToReveal = Math.max(1, Math.round(CHARS_PER_MS * dt))
    let anyActive = false
    let changed = false

    for (const entry of Object.values(entries.current)) {
      if (entry.queue.length === 0) {
        if (entry.done) {
          const cb = onDrainCallbacks.current[entry.clawId]
          if (cb) {
            delete onDrainCallbacks.current[entry.clawId]
            cb()
          }
          delete entries.current[entry.clawId]
          changed = true
        } else if (entry.hadChunks && entry.pausedAt === null) {
          entry.pausedAt = now
        } else if (entry.hadChunks && entry.pausedAt !== null && now - entry.pausedAt >= 500) {
          changed = true
        }
        continue
      }

      if (entry.pausedAt !== null) {
        entry.pausedAt = null
        changed = true
      }

      anyActive = true
      const reveal = entry.queue.slice(0, charsToReveal)
      entry.queue = entry.queue.slice(charsToReveal)
      entry.shown += reveal
      entry.hadChunks = true
      changed = true
    }

    if (changed) {
      const snapshot: Record<string, TypewriterState> = {}
      for (const [id, e] of Object.entries(entries.current)) {
        snapshot[id] = {
          text: e.shown,
          hadChunks: e.hadChunks,
          isPaused: e.hadChunks && e.queue.length === 0 && !e.done && e.pausedAt !== null,
        }
      }
      setDisplayBuffers(snapshot)
    }

    const anyPending = Object.values(entries.current).some(
      (e) => e.queue.length > 0 || (e.hadChunks && !e.done && e.pausedAt !== null)
    )
    if (!anyActive && !anyPending && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const ensureRunning = useCallback(() => {
    if (!intervalRef.current) {
      lastTickRef.current = 0
      intervalRef.current = setInterval(tick, 16)
    }
  }, [tick])

  const pushChunk = useCallback((clawId: string, chunk: string) => {
    if (!entries.current[clawId]) {
      entries.current[clawId] = { clawId, queue: '', shown: '', done: false, hadChunks: false, pausedAt: null }
      setDisplayBuffers((prev) => ({ ...prev, [clawId]: { text: '', hadChunks: false, isPaused: false } }))
    }
    if (chunk) {
      entries.current[clawId].queue += chunk
    }
    ensureRunning()
  }, [ensureRunning])

  const finalize = useCallback((clawId: string, onDrain?: () => void) => {
    if (entries.current[clawId]) {
      entries.current[clawId].done = true
      if (onDrain) onDrainCallbacks.current[clawId] = onDrain
    } else {
      onDrain?.()
    }
  }, [])

  const isTyping = useCallback((clawId: string) => {
    return Boolean(entries.current[clawId])
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { displayBuffers, pushChunk, finalize, isTyping }
}
