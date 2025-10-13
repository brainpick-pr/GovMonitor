import { useEffect, useMemo, useState } from "react"
import indiaGeoJson from "../assets/india_state.geojson"
import {
  calculateBounds,
  coordinatesToPath,
  getStateName,
} from "../utils/geoJsonToSvg"

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
}

interface GeoJsonFeature {
  type: string
  properties: {
    NAME_1?: string
    st_nm?: string
    name?: string
  }
  geometry: {
    type: string
    coordinates: any
  }
}

interface StatePath {
  name: string
  path: string
}

export function IndiaMap({ stateData }: IndiaMapProps) {
  const [statePaths, setStatePaths] = useState<StatePath[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Process GeoJSON in useEffect to avoid blocking
    const processGeoJson = () => {
      // Parse GeoJSON if it's a string (due to Vite stringify option)
      const geoJson = typeof indiaGeoJson === 'string'
        ? JSON.parse(indiaGeoJson)
        : indiaGeoJson
      const features: GeoJsonFeature[] = geoJson.features || []

      // Calculate bounds for projection
      const bounds = calculateBounds(features)

      // SVG dimensions
      const width = 1000
      const height = 1200

      // Convert each feature to SVG path
      const paths: StatePath[] = features.map((feature) => {
        const stateName = getStateName(feature)
        const path = coordinatesToPath(feature.geometry.coordinates, bounds, width, height)

        return {
          name: stateName,
          path,
        }
      })

      setStatePaths(paths)
      setLoading(false)
    }

    processGeoJson()
  }, [])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading map...</div>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 1000 1200"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g id="india-map">
          {statePaths.map((statePath) => (
            <g key={statePath.name}>
              <path
                d={statePath.path}
                fill={getStateColor(statePath.name)}
                stroke="#ffffff"
                strokeWidth="1.5"
                className="transition-all duration-200 hover:opacity-80 cursor-pointer"
              >
                <title>
                  {statePath.name}
                  {"\n"}
                  {getStateInfo(statePath.name)}
                </title>
              </path>
            </g>
          ))}
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
