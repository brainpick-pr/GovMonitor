import { useEffect, useState } from "react"
import { IndiaMapOptimized } from "./IndiaMapOptimized"
import { RefreshCw, X, TrendingUp, TrendingDown, Activity, Globe, Clock, CheckCircle2, XCircle, Trophy, ExternalLink } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"

interface StateStats {
  state: string
  total_targets: number
  total_checks: number
  successful_checks: number
  failed_checks: number
  uptime_percentage: number
  avg_latency_ms: number
}

interface StateTarget {
  id: number
  name: string
  hostname: string
  url?: string
  total_checks: number
  successful_checks: number
  uptime_percentage: number
  avg_latency_ms: number | null
  last_check_ok: number | null
  last_check_ts: number | null
}

interface StateDetailData {
  state: string
  targets: StateTarget[]
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
  const [stateTargets, setStateTargets] = useState<StateTarget[]>([])
  const [loadingTargets, setLoadingTargets] = useState(false)

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

  const fetchStateTargets = async (state: string) => {
    setLoadingTargets(true)
    try {
      const response = await fetch(`${apiUrl}/state-daily?state=${encodeURIComponent(state)}&window=${window}`)
      const data: StateDetailData = await response.json()
      setStateTargets(data.targets || [])
    } catch (error) {
      console.error("Failed to fetch state targets:", error)
      setStateTargets([])
    } finally {
      setLoadingTargets(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchStateSummary()
  }, [window])

  useEffect(() => {
    if (selectedState) {
      fetchStateTargets(selectedState)
    } else {
      setStateTargets([])
    }
  }, [selectedState, window])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStateSummary()
  }

  // Sort all states by uptime for ranking
  const allStatesSorted = [...stateData].sort((a, b) => b.uptime_percentage - a.uptime_percentage)

  // Get ranking for selected state
  const getStateRanking = (stateName: string) => {
    const idx = allStatesSorted.findIndex(s => s.state === stateName)
    return idx >= 0 ? idx + 1 : null
  }

  const selectedStateData = selectedState
    ? stateData.find(s => s.state === selectedState)
    : null

  const selectedStateRank = selectedState ? getStateRanking(selectedState) : null

  const filteredStates = selectedState
    ? stateData.filter((s) => s.state === selectedState)
    : stateData

  const sortedStates = [...(selectedState ? stateData : filteredStates)].sort((a, b) => {
    return b.uptime_percentage - a.uptime_percentage
  })

  const windowLabels: Record<TimeWindow, string> = {
    "24h": "24H",
    "7d": "7D",
    "30d": "30D",
    "365d": "1Y",
  }

  const getUptimeColor = (percentage: number) => {
    if (percentage >= 99) return "text-emerald-500"
    if (percentage >= 95) return "text-lime-500"
    if (percentage >= 90) return "text-amber-500"
    if (percentage >= 80) return "text-orange-500"
    return "text-red-500"
  }

  // Calculate aggregated stats
  const totalStates = filteredStates.length
  const totalTargets = filteredStates.reduce((sum, s) => sum + s.total_targets, 0)
  const avgUptime = filteredStates.length > 0
    ? filteredStates.reduce((sum, s) => sum + s.uptime_percentage, 0) / filteredStates.length
    : 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed Controls Bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Live
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{totalStates}</span> states
            </span>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{totalTargets}</span> targets
            </span>
            <span className={getUptimeColor(avgUptime)}>
              <span className="font-bold">{avgUptime.toFixed(1)}%</span> avg
            </span>
          </div>
        </div>

        {/* Time Window Selector */}
        <div className="flex items-center gap-3">
          <div className="flex bg-muted/50 rounded-full p-1 border border-border/50">
            {(["24h", "7d", "30d", "365d"] as TimeWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  window === w
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {windowLabels[w]}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-full h-8 w-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Content Area - Fixed Height */}
      <div className="flex-1 relative overflow-hidden">
        {/* Subtle Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-secondary/3 pointer-events-none" />

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
              <Activity className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
        ) : (
          <div className="relative h-full p-4 flex gap-4">
            {/* Map Section */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden flex-1 flex flex-col">
                {/* Map Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold">Live Map</h2>
                    {selectedState && selectedStateRank && (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {selectedState}
                        </span>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-medium">
                          <Trophy className="h-3 w-3" />
                          Rank #{selectedStateRank}
                        </span>
                      </div>
                    )}
                  </div>
                  {selectedState && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedState(null)}
                      className="rounded-full h-7 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                {/* State Stats Bar - Show when state selected */}
                {selectedState && selectedStateData && (
                  <div className="px-4 py-2 border-b border-border/50 bg-muted/30 flex items-center gap-6 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Sites:</span>
                      <span className="font-semibold">{selectedStateData.total_targets}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Uptime:</span>
                      <span className={`font-semibold ${getUptimeColor(selectedStateData.uptime_percentage)}`}>
                        {selectedStateData.uptime_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Latency:</span>
                      <span className="font-semibold">{selectedStateData.avg_latency_ms?.toFixed(0) || "—"}ms</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-semibold text-emerald-600">{selectedStateData.successful_checks.toLocaleString()}</span>
                      <XCircle className="h-3.5 w-3.5 text-red-500 ml-2" />
                      <span className="font-semibold text-red-600">{selectedStateData.failed_checks.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Map - Fill remaining space */}
                <div className={`flex-1 p-4 flex items-center justify-center overflow-hidden ${selectedState ? 'pb-2' : ''}`}>
                  <div className={`w-full ${selectedState ? 'max-w-[450px]' : 'max-w-[550px]'}`}>
                    <IndiaMapOptimized
                      stateData={stateData}
                      selectedState={selectedState}
                      onStateClick={(state) =>
                        setSelectedState(state === selectedState ? null : state)
                      }
                    />
                  </div>
                </div>

                {/* Monitored Sites - Show when state selected */}
                {selectedState && (
                  <div className="border-t border-border/50 max-h-[200px] overflow-y-auto scrollbar-thin">
                    <div className="px-4 py-2 bg-muted/30 border-b border-border/50 sticky top-0">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Monitored Sites in {selectedState}
                        <span className="text-muted-foreground font-normal">({stateTargets.length})</span>
                      </h3>
                    </div>
                    {loadingTargets ? (
                      <div className="p-4 flex items-center justify-center">
                        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : stateTargets.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No sites monitored in this state
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {stateTargets.map((target) => (
                          <div key={target.id} className="px-4 py-2 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${target.last_check_ok === 1 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{target.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{target.hostname}</div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <Badge variant={target.last_check_ok === 1 ? "success" : "destructive"} className="text-[10px] px-1.5 py-0">
                                {target.last_check_ok === 1 ? "UP" : "DOWN"}
                              </Badge>
                              <span className={getUptimeColor(target.uptime_percentage || 0)}>
                                {(target.uptime_percentage || 0).toFixed(1)}%
                              </span>
                              <span className="text-muted-foreground">
                                {target.avg_latency_ms ? `${target.avg_latency_ms}ms` : "—"}
                              </span>
                              <a
                                href={target.url || `https://${target.hostname}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - State Rankings */}
            <div className="w-72 flex-shrink-0">
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden h-full flex flex-col">
                <div className="px-4 py-3 border-b border-border/50 flex-shrink-0">
                  <h2 className="text-base font-semibold">State Rankings</h2>
                  <p className="text-xs text-muted-foreground">
                    Click to view monitored sites
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                  <div className="space-y-1">
                    {sortedStates.map((state, idx) => {
                      const rank = getStateRanking(state.state) || idx + 1
                      const isSelected = selectedState === state.state
                      return (
                        <button
                          key={state.state}
                          onClick={() => setSelectedState(isSelected ? null : state.state)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all duration-200 text-left ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : rank <= 3
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                          }`}>
                            {rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${isSelected ? "text-white" : ""}`}>
                              {state.state}
                            </div>
                            <div className={`text-[10px] ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                              {state.total_targets} {state.total_targets === 1 ? "site" : "sites"} • {state.avg_latency_ms?.toFixed(0) || "—"}ms
                            </div>
                          </div>
                          <div className={`text-right ${isSelected ? "text-white" : getUptimeColor(state.uptime_percentage)}`}>
                            <div className="text-sm font-bold flex items-center justify-end gap-1">
                              {state.uptime_percentage.toFixed(1)}%
                              {state.uptime_percentage >= 95 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : state.uptime_percentage < 90 ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : null}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
