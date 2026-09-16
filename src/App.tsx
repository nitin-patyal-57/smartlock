import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { Layout } from '@/components/layout/Layout'
import OverviewPage from '@/pages/OverviewPage'
import SmartLocksPage from '@/pages/SmartLocksPage'
import DeviceDetailPage from '@/pages/DeviceDetailPage'
import LiveMapPage from '@/pages/LiveMapPage'
import LocationHistoryPage from '@/pages/LocationHistoryPage'
import BatteryHistoryPage from '@/pages/BatteryHistoryPage'
import LockActivityPage from '@/pages/LockActivityPage'
import AlertsPage from '@/pages/AlertsPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </ThemeProvider>
  )
}
