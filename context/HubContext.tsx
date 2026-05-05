import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useHub, type HubState } from "@/hooks/use-hub"
import { getActiveServerId, refreshActiveServer } from "@/lib/hub-url"
import { migrateLegacyServer } from "@/lib/servers"

interface HubContextValue extends HubState {
  selectedClawId: string | null
  setSelectedClawId: (id: string | null) => void
  serverId: string | null
  refreshServer: () => Promise<void>
}

const HubContext = createContext<HubContextValue | null>(null)

export function HubProvider({ children }: { children: ReactNode }) {
  const [selectedClawId, setSelectedClawId] = useState<string | null>(null)
  const [serverId, setServerId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      await migrateLegacyServer()
      const server = await refreshActiveServer()
      setServerId(server?.id ?? null)
      setReady(true)
    }
    init()
  }, [])

  const hub = useHub(selectedClawId, serverId)

  const refreshServer = async () => {
    const id = await getActiveServerId()
    setServerId(id)
  }

  if (!ready) return null

  return (
    <HubContext.Provider value={{ ...hub, selectedClawId, setSelectedClawId, serverId, refreshServer }}>
      {children}
    </HubContext.Provider>
  )
}

export function useHubContext(): HubContextValue {
  const ctx = useContext(HubContext)
  if (!ctx) throw new Error('useHubContext must be used within HubProvider')
  return ctx
}
