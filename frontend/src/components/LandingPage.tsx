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
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <FileText className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h4 className="font-semibold text-white">Tender Portals</h4>
          <p className="text-xs text-white/60">Live status</p>
        </div>
      </div>
      <div className="space-y-2">
        {tenderSites.map((site) => (
          <div
            key={site.name}
            className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg"
          >
            <span className="text-sm text-white/80">{site.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50">{site.latency}</span>
              <div
                className={`h-2 w-2 rounded-full ${
                  site.status === "up" ? "bg-emerald-400" : "bg-red-400"
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
    <div className="min-h-screen bg-[#0a1628] text-white overflow-hidden">
      {/* Custom styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap');

        .font-display { font-family: 'Playfair Display', Georgia, serif; }
        .font-body { font-family: 'Source Sans 3', system-ui, sans-serif; }

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

        .gradient-text {
          background: linear-gradient(135deg, #ffffff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-gradient {
          background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.15), transparent);
        }
      `}</style>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <AshokaChakra className="h-10 w-10 text-[#004080]" />
                <div className="absolute inset-0 bg-[#FF9933] opacity-30 blur-xl" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold tracking-tight">
                  GovMonitor<span className="text-[#FF9933]">.org</span>
                </h1>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-body">
                  Civic Transparency Initiative
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors font-body">
                Features
              </a>
              <a href="#tenders" className="text-sm text-white/70 hover:text-white transition-colors font-body">
                Tender Watch
              </a>
              <Button
                onClick={onEnterDashboard}
                className="bg-[#004080] hover:bg-[#003366] text-white font-body font-semibold"
              >
                View Dashboard
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center hero-gradient">
        <GridPattern />

        {/* Floating Chakra decoration */}
        <div className="absolute right-[10%] top-[15%] opacity-5">
          <AshokaChakra className="h-96 w-96" spinning />
        </div>

        <div className="container mx-auto px-6 py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left content */}
            <div className={`space-y-8 ${isVisible ? "animate-slide-up" : "opacity-0"}`}>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-body text-white/80">
                  Monitoring 150+ Government Websites
                </span>
              </div>

              {/* Headline */}
              <div className="space-y-4">
                <h1 className="font-display text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] tracking-tight">
                  <span className="gradient-text">Transparency</span>
                  <br />
                  <span className="text-white">for India's</span>
                  <br />
                  <span className="text-[#FF9933]">Digital</span>{" "}
                  <span className="text-[#138808]">Governance</span>
                </h1>
              </div>

              <p className="text-lg lg:text-xl text-white/60 font-body leading-relaxed max-w-xl">
                Real-time uptime monitoring for Indian government portals.
                Track tender websites, state services, and critical infrastructure
                with precision and accountability.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={onEnterDashboard}
                  size="lg"
                  className="bg-gradient-to-r from-[#FF9933] to-[#FF6600] hover:from-[#FF6600] hover:to-[#FF9933] text-white font-body font-semibold text-lg px-8 py-6 shadow-lg shadow-orange-500/20"
                >
                  Explore Dashboard
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/20 text-white hover:bg-white/10 font-body px-8 py-6"
                  onClick={() => document.getElementById("tenders")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <FileText className="mr-2 h-5 w-5" />
                  Tender Watch
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-8 pt-4">
                <div className="flex items-center gap-2 text-white/50 font-body text-sm">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <span>Open Source</span>
                </div>
                <div className="flex items-center gap-2 text-white/50 font-body text-sm">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span>24/7 Monitoring</span>
                </div>
                <div className="flex items-center gap-2 text-white/50 font-body text-sm">
                  <Bell className="h-4 w-4 text-amber-400" />
                  <span>Instant Alerts</span>
                </div>
              </div>
            </div>

            {/* Right content - Live status visualization */}
            <div className={`relative ${isVisible ? "animate-slide-up delay-200" : "opacity-0"}`}>
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#004080]/30 to-[#138808]/30 blur-3xl" />

                {/* Main card */}
                <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Activity className="h-6 w-6 text-emerald-400" />
                      <span className="font-body font-semibold">Live Status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs text-white/50 font-body">Real-time</span>
                    </div>
                  </div>

                  {/* Mini India Map placeholder */}
                  <div className="relative h-48 mb-6 rounded-xl overflow-hidden bg-[#0a1628]/50 flex items-center justify-center">
                    <div className="text-center">
                      <Map className="h-16 w-16 text-[#004080] mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-white/40 font-body">Interactive State Map</p>
                      <p className="text-xs text-white/30 font-body">28 States & 8 UTs</p>
                    </div>
                    {/* Pulse indicators on map */}
                    <div className="absolute top-[30%] left-[40%]">
                      <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse-ring" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                    <div className="absolute top-[50%] left-[60%]">
                      <span className="absolute inline-flex h-3 w-3 rounded-full bg-amber-400 animate-pulse-ring" style={{ animationDelay: "0.5s" }} />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                    </div>
                    <div className="absolute top-[70%] left-[45%]">
                      <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 animate-pulse-ring" style={{ animationDelay: "1s" }} />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-display font-bold text-emerald-400">142</div>
                      <div className="text-xs text-white/50 font-body">Online</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                      </div>
                      <div className="text-2xl font-display font-bold text-red-400">8</div>
                      <div className="text-xs text-white/50 font-body">Down</div>
                    </div>
                    <div className="text-center p-3 bg-white/5 rounded-xl">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Zap className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="text-2xl font-display font-bold text-white">234<span className="text-sm">ms</span></div>
                      <div className="text-xs text-white/50 font-body">Avg Latency</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 border-y border-white/10 bg-[#0d1d33]">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div ref={websitesCounter.ref} className="text-center">
              <div className="font-display text-5xl lg:text-6xl font-bold text-white mb-2">
                {websitesCounter.count}+
              </div>
              <div className="text-white/50 font-body">Websites Monitored</div>
            </div>
            <div ref={checksCounter.ref} className="text-center">
              <div className="font-display text-5xl lg:text-6xl font-bold text-[#FF9933] mb-2">
                {(checksCounter.count / 1000000).toFixed(1)}M+
              </div>
              <div className="text-white/50 font-body">Health Checks</div>
            </div>
            <div ref={uptimeCounter.ref} className="text-center">
              <div className="font-display text-5xl lg:text-6xl font-bold text-emerald-400 mb-2">
                {(uptimeCounter.count / 100).toFixed(2)}%
              </div>
              <div className="text-white/50 font-body">Average Uptime</div>
            </div>
            <div ref={statesCounter.ref} className="text-center">
              <div className="font-display text-5xl lg:text-6xl font-bold text-[#138808] mb-2">
                {statesCounter.count}
              </div>
              <div className="text-white/50 font-body">States Covered</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tender Focus Section */}
      <section id="tenders" className="relative py-24 bg-gradient-to-b from-[#0d1d33] to-[#0a1628]">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <FileText className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-body text-amber-400">Tender Watch</span>
              </div>

              <h2 className="font-display text-4xl lg:text-5xl font-bold leading-tight">
                Never Miss a
                <br />
                <span className="text-[#FF9933]">Government Tender</span>
              </h2>

              <p className="text-lg text-white/60 font-body leading-relaxed">
                Critical procurement portals like <strong className="text-white">eProcure.gov.in</strong>,
                <strong className="text-white"> GeM Portal</strong>, and state tender websites
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
                    <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="text-white/80 font-body">{item}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={onEnterDashboard}
                className="bg-amber-500 hover:bg-amber-600 text-black font-body font-semibold"
              >
                Monitor Tender Portals
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Right - Tender Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/10 blur-3xl" />
              <TenderCard />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-bold mb-4">
              Built for <span className="text-[#FF9933]">Accountability</span>
            </h2>
            <p className="text-lg text-white/50 font-body max-w-2xl mx-auto">
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
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
              },
              {
                icon: Map,
                title: "State-Wise Dashboard",
                description: "Interactive India map showing uptime statistics organized by state and union territory.",
                color: "text-blue-400",
                bg: "bg-blue-500/10",
              },
              {
                icon: Bell,
                title: "Instant Alerts",
                description: "Get notified immediately when critical government portals experience downtime.",
                color: "text-amber-400",
                bg: "bg-amber-500/10",
              },
              {
                icon: TrendingUp,
                title: "Historical Data",
                description: "Access detailed uptime history and performance trends over days, weeks, and months.",
                color: "text-purple-400",
                bg: "bg-purple-500/10",
              },
              {
                icon: Shield,
                title: "Open & Transparent",
                description: "All data is publicly accessible. No hidden metrics. Complete transparency.",
                color: "text-cyan-400",
                bg: "bg-cyan-500/10",
              },
              {
                icon: FileText,
                title: "Tender Focus",
                description: "Special monitoring for procurement portals with deadline-aware alerting.",
                color: "text-orange-400",
                bg: "bg-orange-500/10",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative p-8 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-300"
              >
                <div className={`inline-flex p-3 ${feature.bg} rounded-xl mb-6`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-white/50 font-body leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 bg-gradient-to-t from-[#0d1d33] to-transparent">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#004080] to-[#002855] p-12 lg:p-20">
            {/* Background decoration */}
            <div className="absolute right-0 top-0 opacity-10">
              <AshokaChakra className="h-80 w-80 -translate-y-20 translate-x-20" spinning />
            </div>

            <div className="relative z-10 max-w-2xl">
              <h2 className="font-display text-3xl lg:text-5xl font-bold mb-6">
                Start Monitoring
                <br />
                <span className="text-[#FF9933]">Government Services</span>
              </h2>
              <p className="text-lg text-white/70 font-body mb-8">
                Join citizens and organizations tracking the reliability of India's
                digital governance infrastructure. Free, open, and transparent.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  onClick={onEnterDashboard}
                  size="lg"
                  className="bg-[#FF9933] hover:bg-[#FF6600] text-black font-body font-semibold text-lg px-8"
                >
                  Access Dashboard
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/30 text-white hover:bg-white/10 font-body px-8"
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <AshokaChakra className="h-8 w-8 text-[#004080]" />
              <div>
                <span className="font-display font-bold">GovMonitor.org</span>
                <p className="text-xs text-white/40 font-body">A Civic Transparency Initiative</p>
              </div>
            </div>
            <p className="text-sm text-white/40 font-body">
              Open source project for monitoring Indian government digital services
            </p>
            <div className="flex items-center gap-6 text-sm text-white/50 font-body">
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">API</a>
              <a href="#" className="hover:text-white transition-colors">About</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
