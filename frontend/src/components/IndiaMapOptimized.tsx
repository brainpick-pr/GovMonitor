import { useMemo } from "react"
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
  const stateDataMap = useMemo(() => {
    return stateData.reduce<Record<string, StateStats>>((acc, data) => {
      acc[data.state] = data
      return acc
    }, {})
  }, [stateData])

  const getStateColor = (stateName: string): string => {
    const data = stateDataMap[stateName]
    if (!data || data.total_checks === 0) return "#e5e7eb" // gray-200 for no data

    const uptime = data.uptime_percentage

    if (uptime >= 99) return "#10b981" // green-500
    if (uptime >= 95) return "#84cc16" // lime-500
    if (uptime >= 90) return "#fbbf24" // yellow-400
    if (uptime >= 80) return "#f97316" // orange-500
    return "#ef4444" // red-500
  }

  const getStateInfo = (stateName: string): string => {
    const data = stateDataMap[stateName]
    if (!data || data.total_checks === 0) return "No data"

    return `${data.uptime_percentage.toFixed(1)}% uptime\n${data.total_targets} targets\n${data.avg_latency_ms.toFixed(0)}ms avg latency`
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox={SVG_VIEWBOX}
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g id="india-map">
          {Object.entries(INDIA_SVG_PATHS).map(([stateName, path]) => {
            const isSelected = selectedState === stateName
            return (
              <g key={stateName}>
                <path
                  d={path}
                  fill={getStateColor(stateName)}
                  stroke={isSelected ? "#1e40af" : "#ffffff"}
                  strokeWidth={isSelected ? "3" : "1.5"}
                  className="transition-all duration-200 hover:opacity-80 cursor-pointer"
                  onClick={() => onStateClick?.(stateName)}
                  style={{ filter: isSelected ? "brightness(1.1)" : undefined }}
                >
                  <title>
                    {stateName}
                    {"\n"}
                    {getStateInfo(stateName)}
                  </title>
                </path>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "#10b981" }}></div>
          <span>≥99%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "#84cc16" }}></div>
          <span>95-99%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "#fbbf24" }}></div>
          <span>90-95%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "#f97316" }}></div>
          <span>80-90%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "#ef4444" }}></div>
          <span>&lt;80%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "#e5e7eb" }}></div>
          <span>No data</span>
        </div>
      </div>
    </div>
  )
}
