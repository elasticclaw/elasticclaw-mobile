import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Message } from './types'

const TOKEN_KEY = 'ec_hub_token'
const HUB_URL_KEY = 'ec_hub_url'
const PINNED_KEY = 'elasticclaw_pinned'
const MESSAGES_KEY = 'elasticclaw_messages'

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}

export async function saveHubUrl(url: string) {
  await SecureStore.setItemAsync(HUB_URL_KEY, url)
}

export async function getHubUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(HUB_URL_KEY)
}

export async function loadCachedMessages(): Promise<Record<string, Array<{ id: string; role: string; content: string; timestamp: string }>> | null> {
  try {
    const raw = await AsyncStorage.getItem(MESSAGES_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function persistMessages(msgs: Record<string, unknown[]>) {
  try {
    await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs))
  } catch {}
}

export async function loadPinned(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(PINNED_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function savePinned(pinned: Record<string, boolean>) {
  try {
    await AsyncStorage.setItem(PINNED_KEY, JSON.stringify(pinned))
  } catch {}
}
