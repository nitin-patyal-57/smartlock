import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { RefreshProvider } from '@/context/RefreshContext'
import { AuthProvider } from '@/context/AuthContext'
import { Layout } from '@/components/layout/Layout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const OverviewPage = lazy(() => import('@/pages/OverviewPage'))
const SmartLocksPage = lazy(() => import('@/pages/SmartLocksPage'))
const DeviceDetailPage = lazy(() => import('@/pages/DeviceDetailPage'))
const LiveMapPage = lazy(() => import('@/pages/LiveMapPage'))
const LocationHistoryPage = lazy(() => import('@/pages/LocationHistoryPage'))
const BatteryHistoryPage = lazy(() => import('@/pages/BatteryHistoryPage'))
const LockActivityPage = lazy(() => import('@/pages/LockActivityPage'))
const AlertsPage = lazy(() => import('@/pages/AlertsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

export default function App() {
  return (
    <ThemeProvider>
      <RefreshProvider>
        <AuthProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner message="Loading..." className="min-h-screen" />}>
                <Routes>
                  {/* Public route */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Protected dashboard routes */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route path="/" element={<OverviewPage />} />
                    <Route path="/locks" element={<SmartLocksPage />} />
                    <Route path="/locks/:id" element={<DeviceDetailPage />} />
                    <Route path="/devices" element={<SmartLocksPage />} />
                    <Route path="/devices/:id" element={<DeviceDetailPage />} />
                    <Route path="/map" element={<LiveMapPage />} />
                    <Route path="/history" element={<LocationHistoryPage />} />
                    <Route path="/battery-history" element={<BatteryHistoryPage />} />
                    <Route path="/lock-activity" element={<LockActivityPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>

                  {/* Fallback to root (which protects to /login if unauthenticated) */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </RefreshProvider>
    </ThemeProvider>
  )
}
