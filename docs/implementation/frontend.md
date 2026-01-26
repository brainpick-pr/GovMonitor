# Frontend (Cloudflare Pages)

The frontend (`frontend/`) is a Vite + React application deployed with Cloudflare Pages. It consumes APIs exposed by the Worker and renders the monitoring dashboard.

## Key Components

- `App.tsx`: Root container that loads target status, manages refresh intervals, and aggregates counts for global and state-level summaries. Supports view switching between targets and state dashboard.
- `StatusCard`: Displays per-target uptime, latency, last check timestamp, and error messages.
- `AddTargetDialog`: Advanced dialog for collecting target information including check mode, validation parameters, and Indian state/UT selection.
- `StateDashboard`: India map visualization showing state-wise uptime statistics with interactive choropleth mapping.
- `IndiaMap` & `IndiaMapOptimized`: SVG-based India state map components for geographic visualization.
- UI components in `components/ui/`: shadcn/ui components (Buttons, Dialogs, Cards, Inputs, Labels) for consistent design.

## Advanced Target Configuration

The AddTargetDialog supports comprehensive monitoring setup:

### Basic Configuration
- **Name**: Human-readable display name
- **URL**: Government website or API endpoint
- **State**: Indian state or union territory selection
- **Interval**: Check frequency (5, 10, 15, 30, 60 minutes)

### Check Mode Selection
1. **Website Mode**: Basic HTTP status monitoring
2. **API JSON Mode**: JSON response validation with path expressions
3. **API Text Mode**: Text content matching validation

### Validation Options
- **Expected Status**: Primary HTTP status code (default: 200)
- **Allowed Status Codes**: Array of acceptable status codes
- **JSON Path**: Dot notation path for JSON validation (e.g., "status.health")
- **Expected JSON Value**: Value to match at JSON path
- **Text Match**: Substring to find in response body

## Styling & UI

- Tailwind CSS (via `index.css` and Tailwind config) provides utility classes with a navy theme.
- shadcn/ui components with Radix UI primitives offer consistent design primitives.
- Icons from `lucide-react` illustrate status, refresh actions, and navigation.
- Responsive design with mobile-first approach.

## Data Flow

1. On mount, `App` fetches `/api/status` and stores targets in state.
2. Auto-refresh every 30 seconds keeps data current; manual refresh available.
3. State dashboard fetches `/api/state-summary` for aggregated statistics.
4. Adding a target posts to `/api/targets` with advanced configuration and triggers reload.
5. View switching between targets grid and state dashboard with different data presentations.

## State Dashboard Features

- **India Choropleth Map**: Interactive SVG map showing uptime by state
- **State Statistics Table**: Detailed uptime metrics per state
- **Time Window Selection**: 24h, 7d, 30d, 365d views
- **Color-coded Visualization**: Green (high uptime) to red (low uptime) gradient
- **Hover Effects**: Detailed tooltips on state interaction

## Current Implementation Status

✅ **Completed Features:**
- State dashboard with India map visualization
- Advanced target configuration with multiple check modes
- Real-time auto-refresh functionality
- State-wise uptime aggregation display
- Responsive design with navy theme
- View switching between targets and state dashboard
- JSON path and text validation support
- Interactive choropleth mapping

## ❌ Missing Frontend Features

### Navigation & Routing
- **No individual target pages**: Cannot drill down into single target detail
- **No URL routing**: All views in single-page, no shareable URLs
- **No breadcrumbs**: No navigation context for users
- **No back/forward support**: Browser history not utilized

### Data Visualization Gaps
- **No custom date ranges**: Fixed time windows (24h/7d/30d/365d) only
- **No comparison views**: Cannot compare targets or time periods
- **No advanced charts**: Basic charts only, no heatmaps/scatter plots
- **No chart export**: Cannot download charts as images
- **No data export**: No CSV/JSON export from UI
- **No trend indicators**: No up/down arrows for changes

### User Experience
- **No dark mode**: Single navy theme only
- **No theme customization**: Fixed color scheme
- **No keyboard shortcuts**: Mouse-only navigation
- **No loading skeletons**: Shows empty state during loads
- **No error boundaries**: Uncaught errors crash entire app
- **No offline support**: Requires constant connectivity
- **No PWA capabilities**: Cannot install as mobile app

### Search & Filtering
- **No target search**: Must manually find targets in list
- **No filtering**: Cannot filter by state, status, or tags
- **No sorting options**: Limited sort capabilities
- **No saved views**: Cannot save filter/sort preferences
- **No bulk selection**: Cannot select multiple targets

### Alerts & Notifications
- **No in-app notifications**: No alerts for downtime events
- **No notification center**: No historical alert view
- **No browser notifications**: No desktop notification support
- **No alert acknowledgment**: Cannot mark alerts as seen

### Target Management
- **No bulk operations**: Must edit targets individually
- **No target templates**: Cannot duplicate configurations
- **No target groups**: No way to organize targets
- **No tags system**: Cannot categorize targets
- **No import/export**: Cannot bulk import targets from CSV

### Performance & Settings
- **No performance tuning**: Fixed 30s refresh rate
- **No user preferences**: Cannot customize dashboard layout
- **No column customization**: Fixed table columns
- **No density options**: Fixed card/table density
- **No cache control**: No manual refresh/clear cache

### Accessibility
- **Limited ARIA labels**: Incomplete screen reader support
- **No keyboard navigation**: Mouse-dependent interactions
- **No focus indicators**: Unclear keyboard focus
- **No high contrast mode**: Single color scheme
- **No font size controls**: Fixed typography scale

### Advanced Features Missing
- **No dashboard customization**: Fixed layout only
- **No widget system**: Cannot add/remove dashboard widgets
- **No data correlation**: Cannot overlay multiple metrics
- **No annotations**: Cannot add notes to charts
- **No reports**: No scheduled/automated reporting
- **No API playground**: No interactive API testing UI

### Mobile Experience
- **No mobile app**: Web-only interface
- **Limited mobile optimization**: Basic responsive design only
- **No touch gestures**: Click-only interactions
- **No mobile-specific features**: Desktop UI adapted for mobile

## Priority Improvements

### High Priority
1. Individual target detail pages with deep history
2. Custom date range selection
3. Search and filtering capabilities
4. Dark mode support
5. Better error handling and loading states

### Medium Priority
1. PWA capabilities for mobile
2. Data export (CSV/JSON) functionality
3. Bulk target operations
4. Keyboard shortcuts and accessibility
5. Saved views and preferences

### Low Priority
1. Advanced charting options
2. Dashboard customization
3. Target grouping and tags
4. Annotation and reporting features
5. API playground for testing
