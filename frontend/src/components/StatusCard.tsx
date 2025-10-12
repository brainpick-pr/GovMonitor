import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Clock, TrendingUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface StatusCardProps {
  target: {
    id: number
    name: string
    url: string
    hostname: string
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
  const hasData = target.ts !== null

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md"
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {target.name}
        </CardTitle>
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
                {target.latency_ms && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{target.latency_ms}ms</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                Last checked:{" "}
                {formatDistanceToNow(new Date(target.ts * 1000), {
                  addSuffix: true,
                })}
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
  )
}
