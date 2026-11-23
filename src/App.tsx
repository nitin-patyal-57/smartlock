import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { RefreshProvider } from '@/context/RefreshContext'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const OverviewPage = lazy(() => import('@/pages/OverviewPage'))
const SmartLocksPage = lazy(() => import('@/pages/SmartLocksPage'))
const DeviceDetailPage = lazy(() => import('@/pages/DeviceDetailPage'))
const LiveMapPage = lazy(() => import('@/pages/LiveMapPage'))
const LocationHistoryPage = lazy(() => import('@/pages/LocationHistoryPage'))
const BatteryHistoryPage = lazy(() => import('@/pages/BatteryHistoryPage'))
const LockActivityPage = lazy(() => import('@/pages/LockActivityPage'))
const AlertsPage = lazy(() => import('@/pages/AlertsPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

export default function App() {
  return (
    <ThemeProvider>
      <RefreshProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner message="Loading..." className="min-h-screen" />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<OverviewPage />} />
                  <Route path="/locks" element={<SmartLocksPage />} />
                  <Route path="/locks/:id" element={<DeviceDetailPage />} />
                  <Route path="/map" element={<LiveMapPage />} />
                  <Route path="/history" element={<LocationHistoryPage />} />
                  <Route path="/battery-history" element={<BatteryHistoryPage />} />
                  <Route path="/lock-activity" element={<LockActivityPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </RefreshProvider>
    </ThemeProvider>
  )
}
