import { useEffect, useState, Suspense } from "react"
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
import { RefreshCw, Activity, Clock, ExternalLink } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"

interface Target {
  id: number
  name: string
  url: string
  hostname: string
  state: string | null
  enabled: number
  ts: number | null
  ok: number | null
  status: number | null
  latency_ms: number | null
  error: string | null
}

interface CheckRecord {
  ts: number
  ok: number
  status: number | null
  latency_ms: number | null
  error: string | null
}

interface TargetDetailProps {
  target: Target
  apiUrl: string
  onBack: () => void
}

type TimeWindow = "24h" | "7d" | "30d" | "365d"

function HistoryCharts({
  targetId,
  apiUrl,
  window,
}: {
  targetId: number
  apiUrl: string
  window: TimeWindow
}) {
  const [history, setHistory] = useState<CheckRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `${apiUrl}/history?targetId=${targetId}&window=${window}`
        )
        if (!response.ok) throw new Error("Failed to fetch history")
        const data = await response.json()
        setHistory(data)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [targetId, apiUrl, window])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading history: {error}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No check history available for this time window
      </div>
    )
  }

  // Format data for charts
  const chartData = history.map((record) => ({
    time: record.ts * 1000,
    latency: record.ok === 1 ? record.latency_ms : null,
    status: record.ok === 1 ? 1 : 0,
    httpStatus: record.status,
  }))

  // Calculate uptime percentage
  const totalChecks = history.length
  const successfulChecks = history.filter((r) => r.ok === 1).length
  const uptimePercentage = ((successfulChecks / totalChecks) * 100).toFixed(2)

  // Calculate average latency (only for successful checks)
  const successfulWithLatency = history.filter(
    (r) => r.ok === 1 && r.latency_ms != null
  )
  const avgLatency =
    successfulWithLatency.length > 0
      ? Math.round(
          successfulWithLatency.reduce((sum, r) => sum + (r.latency_ms || 0), 0) /
            successfulWithLatency.length
        )
      : null

  const formatXAxis = (timestamp: number) => {
    if (window === "24h") {
      return format(new Date(timestamp), "HH:mm")
    } else if (window === "7d") {
      return format(new Date(timestamp), "EEE HH:mm")
    } else if (window === "30d") {
      return format(new Date(timestamp), "MMM d")
    } else {
      return format(new Date(timestamp), "MMM yyyy")
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Uptime</div>
            <div className="text-2xl font-bold text-green-600">
              {uptimePercentage}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Checks</div>
            <div className="text-2xl font-bold">{totalChecks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Successful</div>
            <div className="text-2xl font-bold text-green-600">
              {successfulChecks}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Avg Latency</div>
            <div className="text-2xl font-bold">
              {avgLatency != null ? `${avgLatency}ms` : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latency Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Response Latency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatXAxis}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  unit="ms"
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                  domain={[0, "auto"]}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    format(new Date(value as number), "PPpp")
                  }
                  formatter={(value) =>
                    value != null ? [`${value}ms`, "Latency"] : ["N/A", "Latency"]
                  }
                />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Uptime Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Uptime Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatXAxis}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 1]}
                  tickFormatter={(value) => (value === 1 ? "Up" : "Down")}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  labelFormatter={(value) =>
                    format(new Date(value), "PPpp")
                  }
                  formatter={(value: number) => [
                    value === 1 ? "Up" : "Down",
                    "Status",
                  ]}
                />
                <Area
                  type="stepAfter"
                  dataKey="status"
                  stroke="rgb(34 197 94)"
                  fill="rgb(34 197 94)"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Checks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Time</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">HTTP</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history
                .slice(-20)
                .reverse()
                .map((record, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {format(new Date(record.ts * 1000), "PPpp")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={record.ok === 1 ? "success" : "destructive"}
                      >
                        {record.ok === 1 ? "UP" : "DOWN"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {record.status || "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.latency_ms != null
                        ? `${record.latency_ms}ms`
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-destructive truncate max-w-xs">
                      {record.error || "-"}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function TargetDetail({ target, apiUrl, onBack: _onBack }: TargetDetailProps) {
  void _onBack // Preserved for interface compatibility - navigation handled by parent
  const [window, setWindow] = useState<TimeWindow>("24h")
  const isUp = target.ok === 1
  const lastCheckedAt = target.ts ? new Date(target.ts * 1000) : null

  const windowLabels: Record<TimeWindow, string> = {
    "24h": "Last 24 Hours",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "365d": "Last Year",
  }

  return (
    <div className="space-y-6">
      {/* Target Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge
                variant={isUp ? "success" : "destructive"}
                className="text-sm px-3 py-1"
              >
                {isUp ? "UP" : "DOWN"}
              </Badge>
              {target.state && (
                <span className="text-sm text-muted-foreground">
                  {target.state}
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Last checked:{" "}
              {lastCheckedAt
                ? formatDistanceToNow(lastCheckedAt, { addSuffix: true })
                : "Never"}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                HTTP Status:{" "}
                <span className="font-medium">{target.status || "N/A"}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Latency:{" "}
                <span className="font-medium">
                  {target.latency_ms != null ? `${target.latency_ms}ms` : "N/A"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <a
                href={target.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline truncate"
              >
                {target.hostname}
              </a>
            </div>
          </div>
          {target.error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">
                <strong>Error:</strong> {target.error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* History Charts with Suspense */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <HistoryCharts targetId={target.id} apiUrl={apiUrl} window={window} />
      </Suspense>
    </div>
  )
}
