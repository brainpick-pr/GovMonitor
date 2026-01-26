import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface StatusCardProps {
  target: {
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
  onClick?: () => void
}

export function StatusCard({ target, onClick }: StatusCardProps) {
  const isUp = target.ok === 1
  const timestamp = target.ts
  const hasData = timestamp != null
  const lastCheckedAt = hasData ? new Date(timestamp * 1000) : null

  const statusText = isUp ? "Online" : "Down"
  const ariaLabel = `${target.name}, ${statusText}${
    target.state ? `, ${target.state}` : ""
  }${target.latency_ms ? `, ${target.latency_ms} milliseconds latency` : ""}. Click to view details.`

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick?.()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg transition-all"
    >
      <Card className="transition-all hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col">
          <CardTitle className="text-sm font-medium">
            {target.name}
          </CardTitle>
          {target.state && (
            <span className="text-xs text-muted-foreground">{target.state}</span>
          )}
        </div>
        <Badge variant={isUp ? "success" : "destructive"}>
          {isUp ? "UP" : "DOWN"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground truncate">
            {target.hostname}
          </div>

          {hasData && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{target.status || "N/A"}</span>
                </div>
                {target.latency_ms != null && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{target.latency_ms}ms</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                Last checked:{" "}
                {lastCheckedAt
                  ? formatDistanceToNow(lastCheckedAt, { addSuffix: true })
                  : "N/A"}
              </div>
            </>
          )}

          {!hasData && (
            <div className="text-sm text-muted-foreground">
              No data available yet
            </div>
          )}

          {target.error && (
            <div className="text-xs text-destructive">
              Error: {target.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
