import { createContext, useContext, useState, type ReactNode } from "react"
import { useHub, type HubState } from "@/hooks/use-hub"

interface HubContextValue extends HubState {
  selectedClawId: string | null
  setSelectedClawId: (id: string | null) => void
}

const HubContext = createContext<HubContextValue | null>(null)

export function HubProvider({ children }: { children: ReactNode }) {
  const [selectedClawId, setSelectedClawId] = useState<string | null>(null)
  const hub = useHub(selectedClawId)

  return (
    <HubContext.Provider value={{ ...hub, selectedClawId, setSelectedClawId }}>
      {children}
    </HubContext.Provider>
  )
}

export function useHubContext(): HubContextValue {
  const ctx = useContext(HubContext)
  if (!ctx) throw new Error('useHubContext must be used within HubProvider')
  return ctx
}
