import { useEffect, useState } from "react"
import { StatusCard } from "./components/StatusCard"
import { AddTargetDialog } from "./components/AddTargetDialog"
import { Button } from "./components/ui/button"
import { Plus, RefreshCw, Activity } from "lucide-react"

interface Target {
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

function App() {
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || "/api"

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/status`)
      const data = await response.json()
      setTargets(data)
    } catch (error) {
      console.error("Failed to fetch status:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStatus()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleAddTarget = async (name: string, url: string, interval: number) => {
    const response = await fetch(`${apiUrl}/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, interval_min: interval }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to add target")
    }

    await fetchStatus()
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStatus()
  }

  const upCount = targets.filter((t) => t.ok === 1).length
  const downCount = targets.filter((t) => t.ok === 0).length
  const totalCount = targets.length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">GovMonitor.Org</h1>
                <p className="text-sm text-primary-foreground/80">
                  Government Website Uptime Monitoring
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Website
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex gap-8">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium">Up: {upCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500"></div>
              <span className="text-sm font-medium">Down: {downCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Total: {totalCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : targets.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No websites monitored yet</h2>
            <p className="text-muted-foreground mb-6">
              Add your first government website to start monitoring
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Website
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {targets.map((target) => (
              <StatusCard key={target.id} target={target} />
            ))}
          </div>
        )}
      </main>

      {/* Add Target Dialog */}
      <AddTargetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddTarget}
      />
    </div>
  )
}

export default App
