import '../global.css'
import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { refreshActiveServer } from '@/lib/hub-url'
import { setTokenCache } from '@/lib/api'
import { migrateLegacyServer } from '@/lib/servers'

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      await migrateLegacyServer()
      const server = await refreshActiveServer()
      if (server) setTokenCache(server.token)
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
