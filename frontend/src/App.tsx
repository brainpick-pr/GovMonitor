import { useEffect, useState } from "react"
import { StatusCard } from "./components/StatusCard"
import { AddTargetDialog } from "./components/AddTargetDialog"
import { StateDashboard } from "./components/StateDashboard"
import { TargetDetail } from "./components/TargetDetail"
import { LandingPage } from "./components/LandingPage"
import { SecurityDashboard } from "./components/SecurityDashboard"
import { TenderWatch } from "./components/TenderWatch"
import { AdminLogin } from "./components/AdminLogin"
import { GoogleLoginButton } from "./components/GoogleLoginButton"
import { UserAvatar } from "./components/UserAvatar"
import { UserProfile } from "./components/UserProfile"
import { Button } from "./components/ui/button"
import { Toaster } from "./components/ui/toaster"
import { useToast } from "./components/ui/use-toast"
import { useAuth } from "./contexts/AuthContext"
import {
  Plus,
  RefreshCw,
  Map,
  Shield,
  LogOut,
  Lock,
  FileText,
  Server,
  Moon,
  Sun,
  ChevronLeft,
  ExternalLink,
  User,
} from "lucide-react"

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

type ViewType = "landing" | "targets" | "dashboard" | "detail" | "security" | "admin-login" | "tender-watch" | "profile" | "login"

// Ashoka Chakra SVG component
function AshokaChakra({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="8" />
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180
        const x1 = 50 + 10 * Math.cos(angle)
        const y1 = 50 + 10 * Math.sin(angle)
        const x2 = 50 + 46 * Math.cos(angle)
        const y2 = 50 + 46 * Math.sin(angle)
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        )
      })}
    </svg>
  )
}

function App() {
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<ViewType>("dashboard")
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(null)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("govmonitor-theme")
      if (stored) {
        return stored === "dark"
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches
    }
    return false
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const { toast } = useToast()
  const { isAuthenticated, isAdmin, logout, user, isUserAuthenticated } = useAuth()
  const apiUrl = import.meta.env.VITE_API_URL || "/api"

  // Handle OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')

    // If there's an OAuth callback, go to login view to process it
    if (code || error) {
      setView("login")
    }
  }, [])

  // Toggle dark mode and persist
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("govmonitor-theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("govmonitor-theme", "light")
    }
  }, [darkMode])

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/status`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setTargets(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.error("Failed to fetch status:", error)
      toast({
        variant: "destructive",
        title: "Failed to load data",
        description: message,
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 120000)
    return () => clearInterval(interval)
  }, [])

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
    try {
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

      toast({
        variant: "success",
        title: "Website added successfully!",
        description: `${name} is now being monitored.`,
      })

      setAddDialogOpen(false)
      await fetchStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast({
        variant: "destructive",
        title: "Failed to add website",
        description: message,
      })
      throw error
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStatus()
  }

  const handleLogout = () => {
    logout()
    setView("dashboard")
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    })
  }

  const upCount = targets.filter((t) => t.ok === 1).length
  const downCount = targets.filter((t) => t.ok === 0).length

  // Show landing page (full screen, separate from app shell)
  if (view === "landing") {
    return <LandingPage onEnterDashboard={() => setView("dashboard")} />
  }

  // Navigation items
  const navItems: { key: ViewType; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "State Map", icon: <Map className="h-5 w-5" /> },
    { key: "targets", label: "Targets", icon: <Server className="h-5 w-5" /> },
    { key: "tender-watch", label: "Tender Watch", icon: <FileText className="h-5 w-5" /> },
  ]

  if (isAdmin) {
    navItems.push({ key: "security", label: "Security", icon: <Shield className="h-5 w-5" /> })
  }

  return (
    <div className="h-full flex bg-background">
      {/* Left Sidebar */}
      <aside
        className={`flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ${
          sidebarCollapsed ? "w-16" : "w-56"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border">
          <AshokaChakra className="h-8 w-8 text-secondary flex-shrink-0" />
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="font-display text-lg font-semibold text-sidebar-foreground leading-tight">
                GovMonitor
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Civic Transparency
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = view === item.key || (item.key === "targets" && view === "detail")
            return (
              <button
                key={item.key}
                onClick={() => {
                  setView(item.key)
                  if (item.key !== "detail") setSelectedTarget(null)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className={isActive ? "text-sidebar-primary" : ""}>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Status Indicators */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          {!sidebarCollapsed ? (
            <>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Live Status
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2" title="Online targets">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="text-sm font-medium text-sidebar-foreground">{upCount}</span>
                  <span className="text-xs text-muted-foreground">up</span>
                </div>
                <div className="flex items-center gap-2" title="Offline targets">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-sidebar-foreground">{downCount}</span>
                  <span className="text-xs text-muted-foreground">down</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2" title={`${upCount} up, ${downCount} down`}>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-medium text-sidebar-foreground">{upCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-xs font-medium text-sidebar-foreground">{downCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              className={`h-5 w-5 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
            />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
            title={sidebarCollapsed ? (darkMode ? "Light mode" : "Dark mode") : undefined}
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {!sidebarCollapsed && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
          </button>

          {/* User Auth */}
          {isUserAuthenticated && user ? (
            <button
              onClick={() => setView("profile")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
              title={sidebarCollapsed ? user.display_name : undefined}
            >
              <UserAvatar user={user} size="sm" />
              {!sidebarCollapsed && (
                <span className="truncate">{user.display_name}</span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setView("login")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
              title={sidebarCollapsed ? "Sign In" : undefined}
            >
              <User className="h-5 w-5" />
              {!sidebarCollapsed && <span>Sign In</span>}
            </button>
          )}

          {/* Admin Auth Button (API Key) */}
          {!isAuthenticated ? (
            <button
              onClick={() => setView("admin-login")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
              title={sidebarCollapsed ? "Admin Login" : undefined}
            >
              <Lock className="h-5 w-5" />
              {!sidebarCollapsed && <span>Admin Login</span>}
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all"
              title={sidebarCollapsed ? "Logout" : undefined}
            >
              <LogOut className="h-5 w-5" />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 h-14 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              {view === "dashboard" && "State-wise Monitoring"}
              {view === "targets" && "Monitored Websites"}
              {view === "tender-watch" && "Tender Portal Watch"}
              {view === "security" && "Security Dashboard"}
              {view === "admin-login" && "Admin Login"}
              {view === "login" && "Sign In"}
              {view === "profile" && "Your Profile"}
              {view === "detail" && selectedTarget?.name}
            </h2>
            {view === "detail" && selectedTarget && (
              <a
                href={selectedTarget.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                {selectedTarget.hostname}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {view === "targets" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Website
                </Button>
              </>
            )}
            {view === "detail" && (
              <Button variant="outline" size="sm" onClick={() => setView("targets")}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Targets
              </Button>
            )}
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {view === "login" ? (
            <div className="p-8 max-w-md mx-auto">
              <div className="bg-card rounded-lg border p-6">
                <h2 className="text-xl font-semibold mb-2">Welcome to GovMonitor</h2>
                <p className="text-muted-foreground mb-6">
                  Sign in to report issues, submit websites, and participate in the community.
                </p>
                <GoogleLoginButton
                  onSuccess={() => setView("dashboard")}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  By signing in, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          ) : view === "profile" ? (
            <div className="p-8 max-w-md mx-auto">
              {user ? (
                <UserProfile onLogout={() => setView("dashboard")} />
              ) : (
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">You need to sign in to view your profile.</p>
                  <Button onClick={() => setView("login")}>
                    <User className="h-4 w-4 mr-2" />
                    Sign In
                  </Button>
                </div>
              )}
            </div>
          ) : view === "admin-login" ? (
            <div className="p-8 max-w-md mx-auto">
              <AdminLogin onSuccess={() => setView("dashboard")} />
            </div>
          ) : view === "dashboard" ? (
            <StateDashboard apiUrl={apiUrl} />
          ) : view === "tender-watch" ? (
            <div className="p-6">
              <TenderWatch apiUrl={apiUrl} />
            </div>
          ) : view === "security" ? (
            isAdmin ? (
              <div className="p-6">
                <SecurityDashboard />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
                  <p className="text-muted-foreground mb-6">
                    You need admin privileges to view the security dashboard
                  </p>
                  <Button onClick={() => setView("admin-login")}>
                    <Lock className="h-4 w-4 mr-2" />
                    Login as Admin
                  </Button>
                </div>
              </div>
            )
          ) : view === "detail" && selectedTarget ? (
            <div className="p-6">
              <TargetDetail
                target={selectedTarget}
                apiUrl={apiUrl}
                onBack={() => {
                  setView("targets")
                  setSelectedTarget(null)
                }}
              />
            </div>
          ) : (
            /* Targets View */
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : targets.length === 0 ? (
                <div className="flex items-center justify-center py-24">
                  <div className="text-center">
                    <Server className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No websites monitored yet</h2>
                    <p className="text-muted-foreground mb-6">
                      Add your first government website to start monitoring
                    </p>
                    <Button onClick={() => setAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Website
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {targets.map((target) => (
                    <StatusCard
                      key={target.id}
                      target={target}
                      onClick={() => {
                        setSelectedTarget(target)
                        setView("detail")
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Target Dialog */}
      <AddTargetDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddTarget}
      />

      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
}

export default App
