import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { RefreshCw, TrendingUp, TrendingDown, FileText, Plus } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { AddTargetDialog } from "./AddTargetDialog"

interface DailyUptime {
  date: string
  total_targets: number
  total_checks: number
  successful_checks: number
  failed_checks: number
  uptime_percentage: number
  avg_latency_ms: number | null
}

interface StateTarget {
  id: number
  name: string
  hostname: string
  total_checks: number
  successful_checks: number
  uptime_percentage: number
  avg_latency_ms: number | null
  last_check_ok: number | null
  last_check_ts: number | null
}

interface StateData {
  state: string
  window: string
  daily: DailyUptime[]
  targets: StateTarget[]
}

interface TenderWatchProps {
  apiUrl: string
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
]

type TimeWindow = "24h" | "7d" | "30d" | "365d"

export function TenderWatch({ apiUrl }: TenderWatchProps) {
  const [selectedState, setSelectedState] = useState<string>("Maharashtra")
  const [stateData, setStateData] = useState<StateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [window, setWindow] = useState<TimeWindow>("7d")
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const fetchStateData = async () => {
    try {
      const response = await fetch(
        `${apiUrl}/state-daily?state=${encodeURIComponent(selectedState)}&window=${window}`
      )
      if (!response.ok) throw new Error("Failed to fetch state data")
      const data = await response.json()
      setStateData(data)
    } catch (error) {
      console.error("Failed to fetch state data:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchStateData()
  }, [selectedState, window])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStateData()
  }

  const handleAddTarget = async (
    name: string,
    url: string,
    interval: number,
    state: string,
    checkMode: string,
    expectedStatus: number,
    jsonPath?: string,
    expectedJsonValue?: string,
    textMatch?: string
  ) => {
    const response = await fetch(`${apiUrl}/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        url,
        interval_min: interval,
        state,
        check_mode: checkMode,
        expected_status: expectedStatus,
        json_path: jsonPath,
        expected_json_value: expectedJsonValue,
        text_match: textMatch,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to add target")
    }

    setAddDialogOpen(false)
    fetchStateData()
  }

  const windowLabels: Record<TimeWindow, string> = {
    "24h": "Last 24 Hours",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "365d": "Last Year",
  }

  const getUptimeColor = (percentage: number) => {
    if (percentage >= 99) return "text-green-600"
    if (percentage >= 95) return "text-lime-600"
    if (percentage >= 90) return "text-yellow-600"
    if (percentage >= 80) return "text-orange-600"
    return "text-red-600"
  }

  const getUptimeBadge = (percentage: number) => {
    if (percentage >= 99) return "success"
    if (percentage >= 90) return "warning"
    return "destructive"
  }

  // Calculate overall stats
  const overallUptime = stateData?.daily?.length
    ? stateData.daily.reduce((sum, d) => sum + d.uptime_percentage, 0) / stateData.daily.length
    : 0

  const totalChecks = stateData?.daily?.reduce((sum, d) => sum + d.total_checks, 0) || 0
  const totalFailed = stateData?.daily?.reduce((sum, d) => sum + d.failed_checks, 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Tender Portal Monitor
          </h2>
          <p className="text-sm text-muted-foreground">
            State-wise uptime monitoring for government tender websites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Tender Site
          </Button>
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
      </div>

      {/* State and Time Selectors */}
      <div className="flex gap-4 flex-wrap">
        <div className="w-64">
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger>
              <SelectValue placeholder="Select a state" />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Overall Uptime</div>
                <div className={`text-2xl font-bold ${getUptimeColor(overallUptime)}`}>
                  {overallUptime.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Checks</div>
                <div className="text-2xl font-bold">{totalChecks.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Failed Checks</div>
                <div className="text-2xl font-bold text-red-600">{totalFailed.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Monitored Sites</div>
                <div className="text-2xl font-bold">{stateData?.targets?.length || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Uptime Chart - Simple Table View */}
          {stateData?.daily && stateData.daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Uptime - {selectedState}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Sites</TableHead>
                        <TableHead className="text-right">Checks</TableHead>
                        <TableHead className="text-right">Uptime</TableHead>
                        <TableHead className="text-right">Avg Latency</TableHead>
                        <TableHead className="text-center">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stateData.daily.map((day, idx) => {
                        const prevDay = stateData.daily[idx + 1]
                        const trend = prevDay
                          ? day.uptime_percentage - prevDay.uptime_percentage
                          : 0

                        return (
                          <TableRow key={day.date}>
                            <TableCell className="font-medium">
                              {format(new Date(day.date), "EEE, MMM d")}
                            </TableCell>
                            <TableCell className="text-center">{day.total_targets}</TableCell>
                            <TableCell className="text-right">{day.total_checks}</TableCell>
                            <TableCell className="text-right">
                              <span className={getUptimeColor(day.uptime_percentage)}>
                                {day.uptime_percentage.toFixed(2)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {day.avg_latency_ms ? `${day.avg_latency_ms}ms` : "N/A"}
                            </TableCell>
                            <TableCell className="text-center">
                              {trend > 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-600 inline" />
                              ) : trend < 0 ? (
                                <TrendingDown className="h-4 w-4 text-red-600 inline" />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* State Targets Table */}
          {stateData?.targets && stateData.targets.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Tender Sites in {selectedState} ({stateData.targets.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Site Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Uptime</TableHead>
                      <TableHead className="text-right">Checks</TableHead>
                      <TableHead className="text-right">Avg Latency</TableHead>
                      <TableHead>Last Check</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stateData.targets.map((target) => (
                      <TableRow key={target.id}>
                        <TableCell>
                          <div className="font-medium">{target.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {target.hostname}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={target.last_check_ok === 1 ? "success" : "destructive"}
                          >
                            {target.last_check_ok === 1 ? "UP" : "DOWN"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={getUptimeBadge(target.uptime_percentage) as any}>
                            {target.uptime_percentage?.toFixed(2) || 0}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {target.total_checks || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {target.avg_latency_ms ? `${target.avg_latency_ms}ms` : "N/A"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {target.last_check_ts
                            ? formatDistanceToNow(new Date(target.last_check_ts * 1000), {
                                addSuffix: true,
                              })
                            : "Never"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Tender Sites Found</h3>
                <p className="text-muted-foreground mb-6">
                  No government tender websites are being monitored for {selectedState}.
                </p>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tender Site
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Target Dialog */}
      <AddTargetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddTarget}
      />
    </div>
  )
}
