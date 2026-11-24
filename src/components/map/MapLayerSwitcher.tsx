import { useState } from 'react'
import { Layers } from 'lucide-react'
import { MAP_LAYERS, type MapLayerType } from './mapLayers'

interface MapLayerSwitcherProps {
  currentLayer: MapLayerType
  onLayerChange: (layer: MapLayerType) => void
}

export function MapLayerSwitcher({ currentLayer, onLayerChange }: MapLayerSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)

  const activeLayer = MAP_LAYERS[currentLayer] || MAP_LAYERS['google-streets']

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-800 shadow-md backdrop-blur-xs transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 dark:hover:bg-slate-900"
        title="Change Map View (Free Google Maps & Satellite)"
      >
        <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span>{activeLayer.icon}</span>
        <span className="hidden sm:inline">{activeLayer.shortName}</span>
      </button>

      {/* Layer Options Popup */}
      {isOpen && (
        <div
          className="absolute right-0 top-11 z-[1200] w-64 rounded-xl border border-slate-200 bg-white/98 p-2 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/98"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="mb-2 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Map Style (Google Maps Free)
          </div>
          <div className="space-y-1">
            {(Object.keys(MAP_LAYERS) as MapLayerType[]).map((key) => {
              const layer = MAP_LAYERS[key]
              const isSelected = currentLayer === key
              return (
                <button
                  key={key}
                  onClick={() => {
                    onLayerChange(key)
                    setIsOpen(false)
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    isSelected
                      ? 'bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{layer.icon}</span>
                    <span>{layer.name}</span>
                  </div>
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 text-center text-[10px] text-slate-400 dark:border-slate-800">
            Free Google Maps Tile Engine • No API Key Needed
          </div>
        </div>
      )}
    </div>
  )
}
