import { useMemo } from 'react'
import { MapPin, Clock, Gauge, Navigation } from 'lucide-react'
import Card from '@/components/ui/Card'
import type { LocationHistoryEntry } from '@/types/smartlock'

interface RouteTrackerProps {
  locations: LocationHistoryEntry[]
}

function getHeadingLabel(heading: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(heading / 45) % 8
  return `${directions[index]} (${Math.round(heading)}°)`
}

export default function RouteTracker({ locations }: RouteTrackerProps) {
  const stats = useMemo(() => {
    if (locations.length === 0) {
      return { distance: 0, duration: 0, currentSpeed: 0, heading: 0 }
    }

    let totalDistance = 0
    for (let i = 1; i < locations.length; i++) {
      const R = 6371
      const dLat = ((locations[i].latitude - locations[i - 1].latitude) * Math.PI) / 180
      const dLon = ((locations[i].longitude - locations[i - 1].longitude) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((locations[i - 1].latitude * Math.PI) / 180) *
          Math.cos((locations[i].latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2
      totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    const first = new Date(locations[0].timestamp)
    const last = new Date(locations[locations.length - 1].timestamp)
    const durationMs = last.getTime() - first.getTime()
    const durationMin = Math.round(durationMs / 60000)

    const latestLocation = locations[locations.length - 1]

    return {
      distance: totalDistance,
      duration: durationMin,
      currentSpeed: latestLocation.speed,
      heading: latestLocation.heading,
    }
  }, [locations])

  const statItems = [
    {
      icon: <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      value: stats.distance < 1
        ? `${Math.round(stats.distance * 1000)} m`
        : `${stats.distance.toFixed(1)} km`,
      label: 'Distance Traveled',
    },
    {
      icon: <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      value: stats.duration < 60
        ? `${stats.duration} min`
        : `${Math.floor(stats.duration / 60)}h ${stats.duration % 60}m`,
      label: 'Time Elapsed',
    },
    {
      icon: <Gauge className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      value: `${stats.currentSpeed.toFixed(0)} km/h`,
      label: 'Current Speed',
    },
    {
      icon: <Navigation className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      value: getHeadingLabel(stats.heading),
      label: 'Heading',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {statItems.map((item) => (
        <Card key={item.label} className="flex flex-col items-center gap-2 py-4">
          <div className={`rounded-lg p-2 ${item.bg}`}>
            {item.icon}
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {item.value}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.label}
          </p>
        </Card>
      ))}
    </div>
  )
}
