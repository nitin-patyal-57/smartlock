import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'

interface RefreshContextType {
  refreshInterval: number
  setRefreshInterval: (interval: number) => void
  isAutoRefreshEnabled: boolean
  toggleAutoRefresh: () => void
}

const RefreshContext = createContext<RefreshContextType>({
  refreshInterval: 1,
  setRefreshInterval: () => {},
  isAutoRefreshEnabled: true,
  toggleAutoRefresh: () => {},
})

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshInterval, setRefreshIntervalState] = useState(() => {
    const saved = localStorage.getItem('refreshInterval')
    return saved ? parseInt(saved, 10) : 1
  })

  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('autoRefreshEnabled')
    return saved ? saved === 'true' : true
  })

  useEffect(() => {
    localStorage.setItem('refreshInterval', refreshInterval.toString())
  }, [refreshInterval])

  useEffect(() => {
    localStorage.setItem('autoRefreshEnabled', isAutoRefreshEnabled.toString())
  }, [isAutoRefreshEnabled])

  const setRefreshInterval = useCallback((interval: number) => {
    setRefreshIntervalState(interval)
  }, [])

  const toggleAutoRefresh = useCallback(() => {
    setIsAutoRefreshEnabled(prev => !prev)
  }, [])

  const value = useMemo(
    () => ({
      refreshInterval,
      setRefreshInterval,
      isAutoRefreshEnabled,
      toggleAutoRefresh,
    }),
    [refreshInterval, setRefreshInterval, isAutoRefreshEnabled, toggleAutoRefresh]
  )

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
}

export const useRefresh = () => useContext(RefreshContext)
