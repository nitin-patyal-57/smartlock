import Card from '@/components/ui/Card'

interface RouteProgressBarProps {
  totalDistance: number
  elapsedMinutes: number
}

export default function RouteProgressBar({ totalDistance, elapsedMinutes }: RouteProgressBarProps) {
  const remaining = totalDistance < 1
    ? `${Math.round(totalDistance * 1000)} m`
    : `${totalDistance.toFixed(1)} km`

  return (
    <Card className="px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Route Progress</h3>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {remaining} remaining
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ETA: {elapsedMinutes} min
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center">
            <div className="h-3 w-3 rounded-full border-2 border-blue-500 bg-white" />
          </div>

          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: '65%' }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-500 shadow-md"
              style={{ left: '63%' }}
            />
          </div>

          <div className="flex h-6 w-6 items-center justify-center">
            <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
        </div>

        <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Start</span>
          <span>Destination</span>
        </div>
      </div>
    </Card>
  )
}
