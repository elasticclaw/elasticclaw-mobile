import { Redirect, Stack } from 'expo-router'
import { HubProvider, useHubContext } from '@/context/HubContext'

function AppStack() {
  const { serverId } = useHubContext()

  if (!serverId) {
    return <Redirect href="/(auth)/login" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="chat/[clawId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}

export default function AppLayout() {
  return (
    <HubProvider>
      <AppStack />
    </HubProvider>
  )
}
