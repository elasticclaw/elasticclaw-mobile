import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Message } from './types'

// Per-server keys — suffix with server ID at runtime
function messagesKey(serverId: string) { return `ec_messages_${serverId}` }
function pinnedKey(serverId: string) { return `ec_pinned_${serverId}` }

export async function loadCachedMessages(serverId: string): Promise<Record<string, Array<{ id: string; role: string; content: string; timestamp: string }>> | null> {
  try {
    const raw = await AsyncStorage.getItem(messagesKey(serverId))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function persistMessages(serverId: string, msgs: Record<string, unknown[]>) {
  try {
    await AsyncStorage.setItem(messagesKey(serverId), JSON.stringify(msgs))
  } catch {}
}

export async function loadPinned(serverId: string): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(pinnedKey(serverId))
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function savePinned(serverId: string, pinned: Record<string, boolean>) {
  try {
    await AsyncStorage.setItem(pinnedKey(serverId), JSON.stringify(pinned))
  } catch {}
}

// Legacy cleanup — old keys are no longer used but may exist from pre-multi-server versions
export async function clearLegacyStorage() {
  try {
    await AsyncStorage.multiRemove([
      'elasticclaw_messages',
      'elasticclaw_pinned',
    ])
  } catch {}
}
