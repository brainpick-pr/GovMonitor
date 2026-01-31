import { useMemo, useState } from "react"
import { INDIA_SVG_PATHS, SVG_VIEWBOX } from "@/data/indiaSvgPaths"

interface StateStats {
  state: string
  total_targets: number
  total_checks: number
  successful_checks: number
  failed_checks: number
  uptime_percentage: number
  avg_latency_ms: number
}

interface IndiaMapProps {
  stateData: StateStats[]
  selectedState?: string | null
  onStateClick?: (state: string) => void
}

export function IndiaMapOptimized({ stateData, selectedState, onStateClick }: IndiaMapProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null)

  const stateDataMap = useMemo(() => {
    return stateData.reduce<Record<string, StateStats>>((acc, data) => {
      acc[data.state] = data
      return acc
    }, {})
  }, [stateData])

  const getStateColor = (stateName: string): string => {
    const data = stateDataMap[stateName]
    if (!data || data.total_checks === 0) return "#e2e8f0" // slate-200 for no data

    const uptime = data.uptime_percentage

    // Using colors that complement the orange/teal theme
    if (uptime >= 99) return "#10b981" // emerald-500
    if (uptime >= 95) return "#22c55e" // green-500
    if (uptime >= 90) return "#eab308" // yellow-500
    if (uptime >= 80) return "#f97316" // orange-500
    return "#ef4444" // red-500
  }

  const getStateInfo = (stateName: string): { uptime: string; targets: string; latency: string } | null => {
    const data = stateDataMap[stateName]
    if (!data || data.total_checks === 0) return null

    return {
      uptime: `${data.uptime_percentage.toFixed(1)}%`,
      targets: `${data.total_targets}`,
      latency: `${data.avg_latency_ms?.toFixed(0) || "—"}ms`
    }
  }

  const hoveredData = hoveredState ? getStateInfo(hoveredState) : null

  return (
    <div className="relative w-full">
      {/* Hover Tooltip */}
      {hoveredState && (
        <div className="absolute top-4 left-4 z-10 bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-xl min-w-[180px]">
          <div className="font-semibold text-foreground mb-2">{hoveredState}</div>
          {hoveredData ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-medium text-foreground">{hoveredData.uptime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Targets</span>
                <span className="font-medium text-foreground">{hoveredData.targets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-medium text-foreground">{hoveredData.latency}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No monitoring data</div>
          )}
        </div>
      )}

      <svg
        viewBox={SVG_VIEWBOX}
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background glow for selected state */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="noDataGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>

        <g id="india-map">
          {Object.entries(INDIA_SVG_PATHS).map(([stateName, path]) => {
            const isSelected = selectedState === stateName
            const isHovered = hoveredState === stateName
            const hasData = stateDataMap[stateName]?.total_checks > 0

            return (
              <g key={stateName}>
                <path
                  d={path}
                  fill={hasData ? getStateColor(stateName) : "url(#noDataGradient)"}
                  stroke={isSelected ? "#ea580c" : isHovered ? "#0d9488" : "#ffffff"}
                  strokeWidth={isSelected ? "3" : isHovered ? "2" : "1"}
                  className="transition-all duration-200 cursor-pointer"
                  onClick={() => onStateClick?.(stateName)}
                  onMouseEnter={() => setHoveredState(stateName)}
                  onMouseLeave={() => setHoveredState(null)}
                  style={{
                    filter: isSelected ? "url(#glow)" : undefined,
                    opacity: selectedState && !isSelected ? 0.5 : 1,
                    transform: isHovered && !isSelected ? "scale(1.01)" : undefined,
                    transformOrigin: "center"
                  }}
                />
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-4 p-3 bg-muted/30 rounded-xl border border-border/50">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "#10b981" }}></div>
            <span className="text-muted-foreground">≥99%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "#22c55e" }}></div>
            <span className="text-muted-foreground">95-99%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "#eab308" }}></div>
            <span className="text-muted-foreground">90-95%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "#f97316" }}></div>
            <span className="text-muted-foreground">80-90%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: "#ef4444" }}></div>
            <span className="text-muted-foreground">&lt;80%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border border-border" style={{ background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)" }}></div>
            <span className="text-muted-foreground">No data</span>
          </div>
        </div>
      </div>
    </div>
  )
}
