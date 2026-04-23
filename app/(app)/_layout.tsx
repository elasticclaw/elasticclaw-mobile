import { Redirect, Stack } from 'expo-router'
import { HubProvider } from '@/context/HubContext'
import { getHubUrl } from '@/lib/hub-url'

export default function AppLayout() {
  if (!getHubUrl()) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <HubProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="chat/[clawId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </HubProvider>
  )
}
