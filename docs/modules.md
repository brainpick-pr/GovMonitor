# Module Documentation

Complete reference for all modules in the GovMonitor.Org codebase.

---

## Table of Contents

1. [Backend Modules](#backend-modules)
2. [Frontend Core Modules](#frontend-core-modules)
3. [Frontend Components](#frontend-components)
4. [UI Components (shadcn/ui)](#ui-components-shadcnui)
5. [Utility Modules](#utility-modules)
6. [Data Modules](#data-modules)
7. [Module Dependencies](#module-dependencies)

---

## Backend Modules

### `src/worker.ts` - Main Worker Entry Point

**Purpose:** Cloudflare Worker that handles all API requests, cron-triggered health checks, and data persistence.

**Exports:**
- `fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>` - HTTP request handler
- `scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>` - Cron trigger handler

**Key Responsibilities:**
1. **API Route Handling**
   - `GET /api/status` - Latest status for all targets
   - `GET /api/history` - Historical check data
   - `GET /api/targets` - List all monitored targets
   - `POST /api/targets` - Add new target
   - `DELETE /api/targets/:id` - Remove target
   - `GET /api/config` - Global configuration
   - `PUT /api/config` - Update configuration
   - `POST /api/check` - Manual health check trigger
   - `GET /api/state-summary` - State aggregation statistics

2. **Health Check Logic**
   - Executes checks for targets based on `next_check_at` timestamp
   - Supports three check modes: website, api-json, api-text
   - Validates HTTP status codes, JSON paths, and text content
   - Records latency and error information

3. **Data Management**
   - Reads from and writes to D1 database
   - Caches status in KV for performance
   - Manages batch processing (25 targets per cron run)
   - Updates `next_check_at` for scheduling

**Dependencies:**
- `Cloudflare D1` (database binding: `DB`)
- `Cloudflare KV` (cache binding: `KV`)
- Environment variables: `USER_AGENT`, `TIMEOUT_MS`, `MAX_LATENCY_MS`

**Key Functions:**

```typescript
// Health check function
async function checkTarget(
  target: Target,
  db: D1Database,
  env: Env
): Promise<CheckResult>

// JSON path value extraction
function getJsonValue(obj: any, path: string): any

// KV cache management
async function updateStatusCache(
  kv: KVNamespace,
  data: Status[]
): Promise<void>
```

**Types:**
```typescript
interface Env {
  DB: D1Database
  KV: KVNamespace
  USER_AGENT: string
  TIMEOUT_MS: string
  MAX_LATENCY_MS: string
  ENVIRONMENT: string
}

interface Target {
  id: number
  name: string
  url: string
  hostname: string
  state: string
  interval_min: number
  next_check_at: number
  enabled: number
  check_mode: 'website' | 'api-json' | 'api-text'
  expected_status: number
  allowed_status_codes?: string
  json_path?: string
  expected_json_value?: string
  text_match?: string
}

interface CheckResult {
  ok: boolean
  status?: number
  latency_ms?: number
  error?: string
  validation_details?: string
}
```

**Lines of Code:** ~736 lines

**Last Modified:** October 2025 (based on migration dates)

---

## Frontend Core Modules

### `frontend/src/main.tsx` - Application Entry Point

**Purpose:** Initializes and mounts the React application.

**Exports:** None (renders to DOM)

**Key Responsibilities:**
- Renders root `<App />` component
- Mounts to `#root` DOM element
- Imports global styles (`index.css`)

**Dependencies:**
- `react`, `react-dom`
- `./App.tsx`
- `./index.css`

**Code:**
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### `frontend/src/App.tsx` - Root Application Component

**Purpose:** Main application container that manages routing, state, and data fetching.

**Exports:**
- `default function App(): JSX.Element` - Root component

**Key Responsibilities:**
1. **State Management**
   - `targets: Target[]` - All monitored targets with status
   - `loading: boolean` - Loading state
   - `view: 'landing' | 'targets' | 'dashboard' | 'detail'` - Current view
   - `selectedTarget: Target | null` - For detail view

2. **Data Fetching**
   - `fetchStatus()` - Polls `/api/status` every 30 seconds
   - Auto-refresh with `setInterval`
   - Manual refresh capability

3. **Navigation**
   - View switching between landing, targets, dashboard, detail
   - Breadcrumb-style navigation (no URL routing)

4. **Target Management**
   - Add new targets via `AddTargetDialog`
   - Delete targets with confirmation
   - View target details

**Dependencies:**
- Components: `StatusCard`, `AddTargetDialog`, `StateDashboard`, `TargetDetail`, `LandingPage`
- UI: `Button` (shadcn/ui)
- Icons: `lucide-react`

**State Interface:**
```typescript
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
```

**API Interaction:**
```typescript
// Environment variable for API URL
const apiUrl = import.meta.env.VITE_API_URL || "/api"

// Fetch all targets with latest status
const response = await fetch(`${apiUrl}/status`)

// Delete target
await fetch(`${apiUrl}/targets/${id}`, { method: 'DELETE' })
```

**Lines of Code:** ~200 lines (estimated)

---

## Frontend Components

### `frontend/src/components/StatusCard.tsx`

**Purpose:** Display individual target status with latency and error information.

**Exports:**
- `export function StatusCard(props: StatusCardProps): JSX.Element`

**Props:**
```typescript
interface StatusCardProps {
  target: Target
  onDelete: (id: number) => void
  onClick: (target: Target) => void
}
```

**Key Features:**
- Color-coded status indicator (green=up, red=down, gray=unknown)
- Latency badge with millisecond display
- Last check timestamp (relative time via `date-fns`)
- Error message display (if check failed)
- Delete button with confirmation
- Click to view detail

**Dependencies:**
- UI: `Card`, `Badge`, `Button`
- Icons: `lucide-react`
- Utils: `date-fns` (formatDistanceToNow)

**Styling:**
- Navy blue theme
- Responsive card layout
- Hover effects

---

### `frontend/src/components/AddTargetDialog.tsx`

**Purpose:** Advanced form for adding new monitored targets with validation.

**Exports:**
- `export function AddTargetDialog(props: AddTargetDialogProps): JSX.Element`

**Props:**
```typescript
interface AddTargetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTargetAdded: () => void
  apiUrl: string
}
```

**Key Features:**
1. **Basic Configuration**
   - Name (required)
   - URL (required, must be .gov domain)
   - State selection (36 Indian states/UTs dropdown)
   - Interval selection (5/10/15/30/60 minutes)

2. **Check Mode Selection**
   - Radio buttons: Website / API JSON / API Text
   - Conditional fields based on mode

3. **Validation Fields (per mode)**
   - **Website Mode:**
     - Expected status code
     - Allowed status codes (comma-separated)
   - **API JSON Mode:**
     - JSON path (dot notation)
     - Expected JSON value
   - **API Text Mode:**
     - Text match (substring)

4. **Validation**
   - URL format validation
   - Government domain enforcement (.gov, .gc.ca, etc.)
   - Required field checks
   - Real-time error messages

**Dependencies:**
- UI: `Dialog`, `Input`, `Label`, `Button`, `Select`
- State constants: `INDIAN_STATES` (36 states)

**Form Submission:**
```typescript
const payload = {
  name,
  url,
  state,
  interval_min: interval,
  check_mode: checkMode,
  expected_status: expectedStatus,
  allowed_status_codes: allowedCodes || null,
  json_path: checkMode === 'api-json' ? jsonPath : null,
  expected_json_value: checkMode === 'api-json' ? jsonValue : null,
  text_match: checkMode === 'api-text' ? textMatch : null
}

await fetch(`${apiUrl}/targets`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
```

**Lines of Code:** ~300 lines (estimated)

---

### `frontend/src/components/StateDashboard.tsx`

**Purpose:** State-level aggregation view with India map visualization.

**Exports:**
- `export function StateDashboard(props: StateDashboardProps): JSX.Element`

**Props:**
```typescript
interface StateDashboardProps {
  onBack: () => void
}
```

**Key Features:**
1. **India Choropleth Map**
   - SVG-based interactive map
   - Color-coded by uptime percentage
   - Hover tooltips with state statistics
   - Legend explaining color scheme

2. **State Statistics Table**
   - Sortable columns (state, targets, checks, uptime, latency)
   - Uptime percentage with color indicators
   - Average latency display
   - Total targets and checks

3. **Time Window Selection**
   - Toggle between 24h, 7d, 30d, 365d
   - Updates map and table on selection
   - Cached via KV (5-minute TTL)

4. **Summary Cards**
   - Total states with data
   - Total monitored targets
   - Total checks performed
   - Average uptime across all states

**Dependencies:**
- Components: `IndiaMapOptimized`
- UI: `Card`, `Button`, `Badge`
- Icons: `lucide-react`

**State Structure:**
```typescript
interface StateSummary {
  state: string
  total_targets: number
  total_checks: number
  successful_checks: number
  failed_checks: number
  uptime_percentage: number
  avg_latency_ms: number
}
```

**API Interaction:**
```typescript
const response = await fetch(
  `${apiUrl}/state-summary?window=${timeWindow}`
)
const data: StateSummary[] = await response.json()
```

**Color Coding:**
- Green (≥99%): Excellent uptime
- Lime (95-99%): Good uptime
- Yellow (90-95%): Fair uptime
- Orange (80-90%): Poor uptime
- Red (<80%): Critical uptime
- Gray: No data

**Lines of Code:** ~350 lines (estimated)

---

### `frontend/src/components/TargetDetail.tsx`

**Purpose:** Detailed analytics page for individual targets.

**Exports:**
- `export function TargetDetail(props: TargetDetailProps): JSX.Element`

**Props:**
```typescript
interface TargetDetailProps {
  target: Target
  onBack: () => void
  apiUrl: string
}
```

**Key Features:**
1. **Uptime Overview**
   - Large uptime percentage display
   - Time window selector (24h/7d/30d/365d)
   - Total checks count
   - Successful/failed breakdown

2. **Latency Statistics**
   - Average latency
   - Minimum latency
   - Maximum latency
   - Latency chart (Recharts)

3. **Check History**
   - Scrollable table of recent checks
   - Timestamp, status code, latency, error
   - Color-coded status indicators
   - Pagination support

4. **Target Information**
   - Name, URL, state
   - Check mode and configuration
   - Interval setting
   - Last check timestamp

**Dependencies:**
- UI: `Card`, `Button`, `Badge`
- Charts: `Recharts` (LineChart, AreaChart)
- Icons: `lucide-react`
- Utils: `date-fns`

**API Interaction:**
```typescript
const response = await fetch(
  `${apiUrl}/history?targetId=${target.id}&window=${timeWindow}`
)

const data = await response.json()
// Returns: { stats, history }
```

**Data Structure:**
```typescript
interface HistoryData {
  stats: {
    total_checks: number
    successful_checks: number
    uptime_percentage: number
    avg_latency_ms: number
    max_latency_ms: number
    min_latency_ms: number
  }
  history: Array<{
    ts: number
    ok: number
    status: number
    latency_ms: number
    error: string | null
  }>
}
```

**Lines of Code:** ~400 lines (estimated)

---

### `frontend/src/components/LandingPage.tsx`

**Purpose:** Marketing/introduction page for the application.

**Exports:**
- `export function LandingPage(props: LandingPageProps): JSX.Element`

**Props:**
```typescript
interface LandingPageProps {
  onGetStarted: () => void
}
```

**Key Features:**
- Hero section with tagline
- Feature highlights (3-4 key features)
- Call-to-action button ("Get Started")
- Logo and branding
- Responsive layout

**Dependencies:**
- UI: `Button`, `Card`
- Icons: `lucide-react`

**Styling:**
- Navy blue theme
- Large typography for hero
- Grid layout for features
- Centered content

**Lines of Code:** ~150 lines (estimated)

---

### `frontend/src/components/IndiaMap.tsx`

**Purpose:** Interactive SVG map of India with GeoJSON rendering (original version).

**Exports:**
- `export function IndiaMap(props: IndiaMapProps): JSX.Element`

**Props:**
```typescript
interface IndiaMapProps {
  stateSummaries: StateSummary[]
  onStateClick?: (state: string) => void
}
```

**Key Features:**
- Loads GeoJSON from `frontend/src/assets/india_state.geojson`
- Converts GeoJSON to SVG paths at runtime
- Color-codes states by uptime percentage
- Hover effects with tooltips
- Click handlers for state selection

**Dependencies:**
- Utils: `geoJsonToSvg` (custom utility)
- GeoJSON data: `india_state.geojson` (~22MB)

**Performance Notes:**
- Heavy GeoJSON parsing on load
- Replaced by `IndiaMapOptimized` for production
- Kept for reference/fallback

**Lines of Code:** ~200 lines (estimated)

---

### `frontend/src/components/IndiaMapOptimized.tsx`

**Purpose:** Optimized SVG map using pre-computed paths (production version).

**Exports:**
- `export function IndiaMapOptimized(props: IndiaMapProps): JSX.Element`

**Props:**
```typescript
interface IndiaMapProps {
  stateSummaries: StateSummary[]
  onStateClick?: (state: string) => void
}
```

**Key Features:**
- Uses pre-generated SVG paths from `indiaSvgPaths.ts`
- No runtime GeoJSON parsing
- ~70% faster load time vs original
- Color-coding by uptime percentage
- Hover tooltips
- Click interactions

**Dependencies:**
- Data: `indiaSvgPaths` (pre-computed paths)

**Optimization:**
- Paths generated via `scripts/generate-svg-paths.ts`
- Douglas-Peucker simplification
- Reduced file size (~150KB vs 22MB GeoJSON)

**SVG Structure:**
```typescript
<svg viewBox="0 0 1000 1200" className="w-full h-auto">
  <g>
    {states.map(state => (
      <path
        key={state.name}
        d={state.path}
        fill={getUptimeColor(state.uptime)}
        stroke="#001f3f"
        strokeWidth="1"
        onMouseEnter={() => setHoveredState(state.name)}
        onClick={() => onStateClick?.(state.name)}
      />
    ))}
  </g>
</svg>
```

**Lines of Code:** ~180 lines (estimated)

---

## UI Components (shadcn/ui)

All UI components follow shadcn/ui conventions using Radix UI primitives and Tailwind CSS.

### `frontend/src/components/ui/button.tsx`

**Purpose:** Reusable button component with variants.

**Exports:**
- `export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>`

**Variants:**
- `default` - Navy blue background
- `destructive` - Red for delete actions
- `outline` - Border only
- `secondary` - Gray background
- `ghost` - No background
- `link` - Text-only link style

**Sizes:**
- `default` - Standard padding
- `sm` - Small
- `lg` - Large
- `icon` - Square icon button

**Dependencies:**
- `@radix-ui/react-slot`
- `class-variance-authority`
- `tailwind-merge`

---

### `frontend/src/components/ui/card.tsx`

**Purpose:** Container component for content sections.

**Exports:**
- `Card` - Main container
- `CardHeader` - Top section with title
- `CardTitle` - Title text
- `CardDescription` - Subtitle text
- `CardContent` - Main content area
- `CardFooter` - Bottom section with actions

**Usage:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>Target Status</CardTitle>
    <CardDescription>Last checked 5 minutes ago</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    <Button>View Details</Button>
  </CardFooter>
</Card>
```

---

### `frontend/src/components/ui/dialog.tsx`

**Purpose:** Modal dialog component.

**Exports:**
- `Dialog` - Root component
- `DialogTrigger` - Button to open dialog
- `DialogContent` - Modal content container
- `DialogHeader` - Top section
- `DialogTitle` - Title text
- `DialogDescription` - Subtitle text
- `DialogFooter` - Bottom section with actions

**Dependencies:**
- `@radix-ui/react-dialog`

**Features:**
- Overlay backdrop
- ESC to close
- Click outside to close
- Scroll locking
- Focus trapping

---

### `frontend/src/components/ui/input.tsx`

**Purpose:** Text input component.

**Exports:**
- `export const Input = React.forwardRef<HTMLInputElement, InputProps>`

**Features:**
- Border styling
- Focus states
- Disabled states
- Error states (via className)
- Full width by default

**Types Supported:**
- `text`, `email`, `url`, `number`, `password`

---

### `frontend/src/components/ui/label.tsx`

**Purpose:** Form label component.

**Exports:**
- `export const Label = React.forwardRef<HTMLLabelElement, LabelProps>`

**Dependencies:**
- `@radix-ui/react-label`

**Features:**
- Accessible label-input association
- Styling for disabled states
- Click to focus input

---

### `frontend/src/components/ui/badge.tsx`

**Purpose:** Small status/tag component.

**Exports:**
- `export function Badge(props: BadgeProps): JSX.Element`

**Variants:**
- `default` - Navy blue
- `secondary` - Gray
- `destructive` - Red
- `outline` - Border only
- `success` - Green (custom)

**Usage:**
```typescript
<Badge variant="success">
  {latency_ms}ms
</Badge>
```

---

## Utility Modules

### `frontend/src/lib/utils.ts`

**Purpose:** Common utility functions.

**Exports:**
- `export function cn(...inputs: ClassValue[]): string` - Class name merger

**Key Functions:**

```typescript
// Merges Tailwind classes intelligently
function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

**Dependencies:**
- `clsx` - Class name concatenation
- `tailwind-merge` - Tailwind class deduplication

**Usage:**
```typescript
// Merges classes, resolves conflicts
cn("px-4 py-2", isActive && "bg-blue-500", className)
```

---

### `frontend/src/utils/geoJsonToSvg.ts`

**Purpose:** Converts GeoJSON geography to SVG paths.

**Exports:**
- `export function geoJsonToSvg(geoJson: GeoJSON): SVGPath[]`
- `export function simplifyPath(path: Point[], tolerance: number): Point[]`

**Key Functions:**

```typescript
interface Point {
  x: number
  y: number
}

interface SVGPath {
  name: string
  path: string // SVG path data
}

// Convert GeoJSON coordinates to SVG path
function geoJsonToSvg(geoJson: any): SVGPath[] {
  // Mercator projection
  // Coordinate transformation
  // Path generation
}

// Douglas-Peucker path simplification
function simplifyPath(points: Point[], tolerance: number): Point[] {
  // Reduce points while preserving shape
}
```

**Coordinate Transformation:**
```typescript
// Geographic to SVG coordinates
const x = (lon + 180) * (width / 360)
const y = (90 - lat) * (height / 180)
```

**Dependencies:** None (vanilla TypeScript)

**Lines of Code:** ~150 lines (estimated)

---

## Data Modules

### `frontend/src/data/indiaSvgPaths.ts`

**Purpose:** Pre-computed SVG paths for Indian states.

**Exports:**
- `export const indiaSvgPaths: StatePath[]`

**Structure:**
```typescript
interface StatePath {
  name: string        // State name
  path: string        // SVG path data (d attribute)
  centroid: {         // Label position
    x: number
    y: number
  }
}

export const indiaSvgPaths: StatePath[] = [
  {
    name: "Andhra Pradesh",
    path: "M 450.2 780.1 L 451.3 781.2...",
    centroid: { x: 455, y: 785 }
  },
  // ... 35 more states
]
```

**Generation:**
- Generated by `scripts/generate-svg-paths.ts`
- Source: `frontend/src/assets/india_state.geojson`
- Run: `npm run generate:svg`

**File Size:** ~150KB (optimized from 22MB GeoJSON)

**Lines of Code:** ~3000 lines (auto-generated)

---

### `frontend/src/vite-env.d.ts`

**Purpose:** TypeScript type definitions for Vite environment.

**Exports:** Type declarations only

**Contents:**
```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

**Usage:**
```typescript
const apiUrl = import.meta.env.VITE_API_URL || "/api"
```

---

## Module Dependencies

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Worker)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  src/worker.ts                                        │  │
│  │  - Cloudflare D1 (database)                           │  │
│  │  - Cloudflare KV (cache)                              │  │
│  │  - Environment variables                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓ API
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  main.tsx → App.tsx                                   │  │
│  │      ├── LandingPage                                  │  │
│  │      ├── StatusCard                                   │  │
│  │      │   └── ui/* (Button, Card, Badge)               │  │
│  │      ├── AddTargetDialog                              │  │
│  │      │   └── ui/* (Dialog, Input, Label)              │  │
│  │      ├── StateDashboard                               │  │
│  │      │   ├── IndiaMapOptimized                        │  │
│  │      │   │   └── indiaSvgPaths                        │  │
│  │      │   └── ui/* (Card, Button, Badge)               │  │
│  │      └── TargetDetail                                 │  │
│  │          ├── Recharts (charts)                        │  │
│  │          └── ui/* (Card, Button, Badge)               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Utilities                                            │  │
│  │  - lib/utils.ts (cn function)                         │  │
│  │  - utils/geoJsonToSvg.ts (map conversion)             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### External Dependencies

#### Backend
- `@cloudflare/workers-types` - TypeScript types
- `wrangler` - Development and deployment CLI

#### Frontend (Production)
- `react` ^18.2.0 - UI framework
- `react-dom` ^18.2.0 - DOM rendering
- `recharts` ^2.10.3 - Charts library
- `date-fns` ^3.0.6 - Date formatting
- `lucide-react` ^0.309.0 - Icons
- `@radix-ui/react-*` - UI primitives
- `class-variance-authority` - Component variants
- `tailwind-merge` - CSS class merging
- `clsx` - Class name utility

#### Frontend (Development)
- `vite` ^5.0.8 - Build tool
- `@vitejs/plugin-react` ^4.2.1 - React plugin
- `typescript` ^5.3.3 - Type checking
- `tailwindcss` ^3.4.1 - CSS framework

---

## Module Statistics

| Category | Files | Total Lines (Est.) |
|----------|-------|--------------------|
| **Backend** | 1 | ~736 |
| **Frontend Core** | 2 | ~250 |
| **Frontend Components** | 7 | ~1,730 |
| **UI Components** | 6 | ~400 |
| **Utilities** | 2 | ~200 |
| **Data** | 2 | ~3,050 |
| **Total** | **20** | **~6,366** |

---

## Module Loading Order

### Backend
1. Worker runtime initialization
2. Environment bindings (D1, KV)
3. `worker.ts` module load
4. Request handlers registered

### Frontend
1. `main.tsx` - React initialization
2. `App.tsx` - Root component mount
3. `index.css` - Global styles
4. Child components loaded on demand
5. API data fetched after mount

---

## Module Testing

### Backend Testing
- Test file: `test/worker.test.ts`
- Framework: Vitest with Cloudflare pool
- Mocks: D1 and KV bindings

### Frontend Testing
- **Currently missing** - No test files
- Recommended: Vitest + React Testing Library

---

## Module Conventions

### Naming Conventions
- **Backend:** `worker.ts` (single file)
- **Frontend Components:** PascalCase (e.g., `StatusCard.tsx`)
- **Utilities:** camelCase (e.g., `geoJsonToSvg.ts`)
- **UI Components:** PascalCase (e.g., `button.tsx`)
- **Data:** camelCase (e.g., `indiaSvgPaths.ts`)

### File Organization
```
src/
  worker.ts              # Backend worker

frontend/src/
  main.tsx               # Entry point
  App.tsx                # Root component
  components/            # Feature components
    StatusCard.tsx
    AddTargetDialog.tsx
    StateDashboard.tsx
    TargetDetail.tsx
    IndiaMap.tsx
    IndiaMapOptimized.tsx
    LandingPage.tsx
    ui/                  # Reusable UI components
      button.tsx
      card.tsx
      dialog.tsx
      input.tsx
      label.tsx
      badge.tsx
  utils/                 # Utility functions
    geoJsonToSvg.ts
  lib/                   # Library wrappers
    utils.ts
  data/                  # Static data
    indiaSvgPaths.ts
  assets/                # Large assets
    india_state.geojson
```

### Import Conventions
```typescript
// External dependencies first
import { useState } from "react"
import { Button } from "./components/ui/button"

// Internal modules second
import { StatusCard } from "./components/StatusCard"
import { cn } from "./lib/utils"

// Types/interfaces third
interface Target { ... }
```

---

## Future Modules (Planned)

Based on the improvement plan, future modules may include:

### Backend
- `src/alerts.ts` - Alert notification logic
- `src/certificates.ts` - Certificate monitoring
- `src/auth.ts` - Authentication middleware
- `src/metrics.ts` - Performance tracking

### Frontend
- `components/AlertCenter.tsx` - Alert management UI
- `components/TargetDetailPage.tsx` - Full-page target view
- `components/DateRangePicker.tsx` - Custom date selection
- `components/ExportDialog.tsx` - CSV/JSON export
- `hooks/useAuth.ts` - Authentication hook
- `hooks/useTargets.ts` - Target data hook
- `context/AuthContext.tsx` - Auth state provider

---

**Last Updated:** January 26, 2026
**Module Count:** 20 files
**Total Estimated Lines:** ~6,366 lines
