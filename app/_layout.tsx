import '../global.css'
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { getToken, getHubUrl as getStoredHubUrl } from '@/lib/storage'
import { setHubUrl } from '@/lib/hub-url'
import { setTokenCache } from '@/lib/api'

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      const [token, url] = await Promise.all([getToken(), getStoredHubUrl()])
      if (url) setHubUrl(url)
      if (token) setTokenCache(token)
      setReady(true)
    }
    init()
  }, [])

  // Hold splash screen until SecureStore is read so hub-url is set
  // before (app)/_layout.tsx renders its guard check.
  if (!ready) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
