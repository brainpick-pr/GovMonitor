import { useEffect, useState, useRef } from "react"
import { Button } from "./ui/button"
import {
  Activity,
  Bell,
  Shield,
  Clock,
  Map,
  TrendingUp,
  FileText,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
} from "lucide-react"

interface LandingPageProps {
  onEnterDashboard: () => void
}

// Animated counter hook
function useCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(!startOnView)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (startOnView && ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setHasStarted(true)
          }
        },
        { threshold: 0.3 }
      )
      observer.observe(ref.current)
      return () => observer.disconnect()
    }
  }, [startOnView])

  useEffect(() => {
    if (!hasStarted) return

    let startTime: number
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(easeOut * end))
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }, [end, duration, hasStarted])

  return { count, ref }
}

// Ashoka Chakra SVG component
function AshokaChakra({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} ${spinning ? "animate-spin-slow" : ""}`}
      fill="currentColor"
    >
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="50" r="8" />
      {/* 24 spokes */}
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

// Animated background pattern
function GridPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  )
}

// Tender focus card
function TenderCard() {
  const tenderSites = [
    { name: "eProcure.gov.in", status: "up", latency: "234ms" },
    { name: "GeM Portal", status: "up", latency: "187ms" },
    { name: "CPPP", status: "down", latency: "-" },
    { name: "State PWD Tenders", status: "up", latency: "342ms" },
  ]

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground">Tender Portals</h4>
          <p className="text-xs text-muted-foreground">Live status</p>
        </div>
      </div>
      <div className="space-y-2">
        {tenderSites.map((site) => (
          <div
            key={site.name}
            className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
          >
            <span className="text-sm text-foreground">{site.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{site.latency}</span>
              <div
                className={`h-2 w-2 rounded-full ${
                  site.status === "up" ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [isVisible, setIsVisible] = useState(false)
  const websitesCounter = useCounter(150, 2500)
  const checksCounter = useCounter(2400000, 3000)
  const uptimeCounter = useCounter(9847, 2000)
  const statesCounter = useCounter(28, 1500)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Custom styles */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow { animation: spin-slow 30s linear infinite; }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-pulse-ring { animation: pulse-ring 2s ease-out infinite; }

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-400 { animation-delay: 400ms; }
        .delay-500 { animation-delay: 500ms; }
      `}</style>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <AshokaChakra className="h-10 w-10 text-secondary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  GovMonitor<span className="text-primary">.org</span>
                </h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Civic Transparency Initiative
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#tenders" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Tender Watch
              </a>
              <Button
                onClick={onEnterDashboard}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                View Dashboard
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center bg-gradient-to-b from-accent/30 to-background">
        <GridPattern />

        {/* Floating Chakra decoration */}
        <div className="absolute right-[10%] top-[15%] opacity-5">
          <AshokaChakra className="h-96 w-96 text-secondary" spinning />
        </div>

        <div className="container mx-auto px-6 py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left content */}
            <div className={`space-y-8 ${isVisible ? "animate-slide-up" : "opacity-0"}`}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-full shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-sm text-muted-foreground">
                  Monitoring 150+ Government Websites
                </span>
              </div>

              {/* Headline */}
              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] tracking-tight">
                  <span className="text-foreground">Transparency</span>
                  <br />
                  <span className="text-foreground">for India's</span>
                  <br />
                  <span className="text-primary">Digital</span>{" "}
                  <span className="text-secondary">Governance</span>
                </h1>
              </div>

              <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl">
                Real-time uptime monitoring for Indian government portals.
                Track tender websites, state services, and critical infrastructure
                with precision and accountability.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={onEnterDashboard}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg px-8 py-6 shadow-lg"
                >
                  Explore Dashboard
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-border text-foreground hover:bg-accent px-8 py-6"
                  onClick={() => document.getElementById("tenders")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <FileText className="mr-2 h-5 w-5" />
                  Tender Watch
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-8 pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Shield className="h-4 w-4 text-secondary" />
                  <span>Open Source</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>24/7 Monitoring</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Bell className="h-4 w-4 text-primary" />
                  <span>Instant Alerts</span>
                </div>
              </div>
            </div>

            {/* Right content - Live status visualization */}
            <div className={`relative ${isVisible ? "animate-slide-up delay-200" : "opacity-0"}`}>
              <div className="relative">
                {/* Main card */}
                <div className="relative bg-card border border-border rounded-3xl p-8 shadow-xl">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Activity className="h-6 w-6 text-emerald-500" />
                      <span className="font-semibold text-foreground">Live Status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs text-muted-foreground">Real-time</span>
                    </div>
                  </div>

                  {/* Mini India Map placeholder */}
                  <div className="relative h-48 mb-6 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center">
                    <div className="text-center">
                      <Map className="h-16 w-16 text-secondary mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">Interactive State Map</p>
                      <p className="text-xs text-muted-foreground/70">28 States & 8 UTs</p>
                    </div>
                    {/* Pulse indicators on map */}
                    <div className="absolute top-[30%] left-[40%]">
                      <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse-ring" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                    <div className="absolute top-[50%] left-[60%]">
                      <span className="absolute inline-flex h-3 w-3 rounded-full bg-primary animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                    </div>
                    <div className="absolute top-[70%] left-[45%]">
                      <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse-ring" style={{ animationDelay: "1s" }} />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-emerald-500/10 rounded-xl">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="text-2xl font-bold text-emerald-600">142</div>
                      <div className="text-xs text-muted-foreground">Online</div>
                    </div>
                    <div className="text-center p-3 bg-red-500/10 rounded-xl">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="text-2xl font-bold text-red-600">8</div>
                      <div className="text-xs text-muted-foreground">Down</div>
                    </div>
                    <div className="text-center p-3 bg-accent rounded-xl">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-2xl font-bold text-foreground">234<span className="text-sm">ms</span></div>
                      <div className="text-xs text-muted-foreground">Avg Latency</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 border-y border-border bg-card">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div ref={websitesCounter.ref} className="text-center">
              <div className="text-5xl lg:text-6xl font-bold text-foreground mb-2">
                {websitesCounter.count}+
              </div>
              <div className="text-muted-foreground">Websites Monitored</div>
            </div>
            <div ref={checksCounter.ref} className="text-center">
              <div className="text-5xl lg:text-6xl font-bold text-primary mb-2">
                {(checksCounter.count / 1000000).toFixed(1)}M+
              </div>
              <div className="text-muted-foreground">Health Checks</div>
            </div>
            <div ref={uptimeCounter.ref} className="text-center">
              <div className="text-5xl lg:text-6xl font-bold text-emerald-500 mb-2">
                {(uptimeCounter.count / 100).toFixed(2)}%
              </div>
              <div className="text-muted-foreground">Average Uptime</div>
            </div>
            <div ref={statesCounter.ref} className="text-center">
              <div className="text-5xl lg:text-6xl font-bold text-secondary mb-2">
                {statesCounter.count}
              </div>
              <div className="text-muted-foreground">States Covered</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tender Focus Section */}
      <section id="tenders" className="relative py-24 bg-gradient-to-b from-background to-accent/20">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium">Tender Watch</span>
              </div>

              <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
                Never Miss a
                <br />
                <span className="text-primary">Government Tender</span>
              </h2>

              <p className="text-lg text-muted-foreground leading-relaxed">
                Critical procurement portals like <strong className="text-foreground">eProcure.gov.in</strong>,
                <strong className="text-foreground"> GeM Portal</strong>, and state tender websites
                experience frequent outages during bid submission deadlines.
              </p>

              <div className="space-y-4">
                {[
                  "Real-time monitoring of all major tender portals",
                  "Instant alerts before submission deadlines",
                  "Historical uptime data for evidence",
                  "State-wise tender portal tracking",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={onEnterDashboard}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                Monitor Tender Portals
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Right - Tender Card */}
            <div className="relative">
              <TenderCard />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 bg-card">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Built for <span className="text-primary">Accountability</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive monitoring tools designed to ensure government digital
              services remain accessible to all citizens.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Activity,
                title: "Real-Time Monitoring",
                description: "Continuous health checks every minute with instant status updates across all monitored websites.",
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
              },
              {
                icon: Map,
                title: "State-Wise Dashboard",
                description: "Interactive India map showing uptime statistics organized by state and union territory.",
                color: "text-blue-500",
                bg: "bg-blue-500/10",
              },
              {
                icon: Bell,
                title: "Instant Alerts",
                description: "Get notified immediately when critical government portals experience downtime.",
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                icon: TrendingUp,
                title: "Historical Data",
                description: "Access detailed uptime history and performance trends over days, weeks, and months.",
                color: "text-purple-500",
                bg: "bg-purple-500/10",
              },
              {
                icon: Shield,
                title: "Open & Transparent",
                description: "All data is publicly accessible. No hidden metrics. Complete transparency.",
                color: "text-secondary",
                bg: "bg-secondary/10",
              },
              {
                icon: FileText,
                title: "Tender Focus",
                description: "Special monitoring for procurement portals with deadline-aware alerting.",
                color: "text-primary",
                bg: "bg-primary/10",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative p-8 bg-background border border-border rounded-2xl hover:shadow-lg transition-all duration-300"
              >
                <div className={`inline-flex p-3 ${feature.bg} rounded-xl mb-6`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 bg-gradient-to-t from-accent/30 to-background">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary to-primary/80 p-12 lg:p-20">
            {/* Background decoration */}
            <div className="absolute right-0 top-0 opacity-10">
              <AshokaChakra className="h-80 w-80 -translate-y-20 translate-x-20 text-white" spinning />
            </div>

            <div className="relative z-10 max-w-2xl">
              <h2 className="text-3xl lg:text-5xl font-bold mb-6 text-white">
                Start Monitoring
                <br />
                <span className="text-white/90">Government Services</span>
              </h2>
              <p className="text-lg text-white/80 mb-8">
                Join citizens and organizations tracking the reliability of India's
                digital governance infrastructure. Free, open, and transparent.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={onEnterDashboard}
                  size="lg"
                  className="bg-white hover:bg-white/90 text-primary font-semibold text-lg px-8"
                >
                  Access Dashboard
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/30 text-white hover:bg-white/10 px-8"
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-card">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <AshokaChakra className="h-8 w-8 text-secondary" />
              <div>
                <span className="font-bold text-foreground">GovMonitor.org</span>
                <p className="text-xs text-muted-foreground">A Civic Transparency Initiative</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Open source project for monitoring Indian government digital services
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
              <a href="#" className="hover:text-foreground transition-colors">API</a>
              <a href="#" className="hover:text-foreground transition-colors">About</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
