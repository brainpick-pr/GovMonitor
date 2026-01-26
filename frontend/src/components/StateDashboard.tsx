import { useEffect, useState } from "react"
import { IndiaMapOptimized } from "./IndiaMapOptimized"
import { RefreshCw, X } from "lucide-react"
import { Button } from "./ui/button"

interface StateStats {
  state: string
  total_targets: number
  total_checks: number
  successful_checks: number
  failed_checks: number
  uptime_percentage: number
  avg_latency_ms: number
}

interface StateDashboardProps {
  apiUrl: string
}

type TimeWindow = "24h" | "7d" | "30d" | "365d"

export function StateDashboard({ apiUrl }: StateDashboardProps) {
  const [stateData, setStateData] = useState<StateStats[]>([])
  const [loading, setLoading] = useState(true)
  const [window, setWindow] = useState<TimeWindow>("24h")
  const [refreshing, setRefreshing] = useState(false)
  const [selectedState, setSelectedState] = useState<string | null>(null)

  const fetchStateSummary = async () => {
    try {
      const response = await fetch(`${apiUrl}/state-summary?window=${window}`)
      const data = await response.json()
      setStateData(data)
    } catch (error) {
      console.error("Failed to fetch state summary:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchStateSummary()
  }, [window])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStateSummary()
  }

  const filteredStates = selectedState
    ? stateData.filter((s) => s.state === selectedState)
    : stateData

  const sortedStates = [...filteredStates].sort((a, b) => {
    return b.uptime_percentage - a.uptime_percentage
  })

  const windowLabels: Record<TimeWindow, string> = {
    "24h": "Last 24 Hours",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "365d": "Last Year",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">State Uptime Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Government website uptime by state
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Time Window Selector */}
      <div className="flex gap-2">
        {(["24h", "7d", "30d", "365d"] as TimeWindow[]).map((w) => (
          <Button
            key={w}
            variant={window === w ? "default" : "outline"}
            size="sm"
            onClick={() => setWindow(w)}
          >
            {windowLabels[w]}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Map Visualization */}
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">India Map - Uptime by State</h3>
              {selectedState && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedState(null)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filter: {selectedState}
                </Button>
              )}
            </div>
            <IndiaMapOptimized
              stateData={stateData}
              selectedState={selectedState}
              onStateClick={(state) =>
                setSelectedState(state === selectedState ? null : state)
              }
            />
          </div>

          {/* State Statistics Table */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Detailed Statistics
                  {selectedState && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (Filtered: {selectedState})
                    </span>
                  )}
                </h3>
                {selectedState && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedState(null)}
                  >
                    Show All States
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">State</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Uptime</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Targets</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Total Checks</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Successful</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Failed</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Avg Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedStates.map((state) => (
                    <tr key={state.state} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium">{state.state}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={`font-semibold ${
                            state.uptime_percentage >= 99
                              ? "text-green-600 dark:text-green-400"
                              : state.uptime_percentage >= 95
                              ? "text-lime-600 dark:text-lime-400"
                              : state.uptime_percentage >= 90
                              ? "text-yellow-600 dark:text-yellow-400"
                              : state.uptime_percentage >= 80
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {state.uptime_percentage.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{state.total_targets}</td>
                      <td className="px-4 py-3 text-sm text-right">{state.total_checks}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                        {state.successful_checks}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                        {state.failed_checks}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {state.avg_latency_ms ? `${state.avg_latency_ms.toFixed(0)}ms` : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">
                {selectedState ? "Selected State" : "Total States"}
              </div>
              <div className="text-2xl font-bold mt-1">{filteredStates.length}</div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Total Targets</div>
              <div className="text-2xl font-bold mt-1">
                {filteredStates.reduce((sum, s) => sum + s.total_targets, 0)}
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Total Checks</div>
              <div className="text-2xl font-bold mt-1">
                {filteredStates.reduce((sum, s) => sum + s.total_checks, 0)}
              </div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Average Uptime</div>
              <div className="text-2xl font-bold mt-1">
                {filteredStates.length > 0
                  ? (
                      filteredStates.reduce((sum, s) => sum + s.uptime_percentage, 0) /
                      filteredStates.length
                    ).toFixed(2)
                  : "0"}
                %
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
