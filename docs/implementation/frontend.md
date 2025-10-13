# Frontend (Cloudflare Pages)

The frontend (`frontend/`) is a Vite + React application deployed with Cloudflare Pages. It consumes APIs exposed by the Worker and renders the monitoring dashboard.

## Key Components

- `App.tsx`: Root container that loads target status, manages refresh intervals, and aggregates counts for global and state-level summaries.
- `StatusCard`: Displays per-target uptime, latency, last check timestamp, and error messages.
- `AddTargetDialog`: Collects new target information, including human-readable name, URL, check interval, and Indian state/UT selection.
- `lib/` helpers (if present) encapsulate API client behavior and utility formatting.

## Styling & UI

- Tailwind CSS (via `index.css` and Tailwind config) provides utility classes with a navy theme.
- shadcn/ui components (Buttons, Dialogs, Cards) offer consistent design primitives.
- Icons from `lucide-react` illustrate status, refresh actions, and activity.

## Data Flow

1. On mount, `App` fetches `/api/status` and stores targets in state.
2. A 30-second interval refreshes status automatically; manual refresh is available via a button.
3. Adding a target posts to `/api/targets` and triggers a reload when successful.
4. Derived metrics (up/down counts, per-state aggregates) are computed client-side from the fetched data.

## Roadmap Considerations

- Add state filters, time-range tabs (24h/7d/30d), and map visualizations using aggregated APIs.
- Provide detailed target pages with charts built from `/api/history`.
- Offer status badges or toast notifications when manual checks fail.
