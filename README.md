# GovMonitor.Org

A modern uptime monitoring system for government websites built with the Cloudflare stack (Workers, Pages, D1, KV).

## Features

- ✅ Real-time uptime monitoring for government websites (.gov, .gov.*, .gc.ca, .government.*)
- ✅ Configurable check intervals (5, 10, 15, 30, 60 minutes)
- ✅ Automatic periodic checks via Cloudflare Cron Triggers
- ✅ Historical uptime data with 24h and 7d views
- ✅ Fast status lookups with KV caching
- ✅ Modern React frontend with shadcn/ui components
- ✅ Navy blue themed UI
- ✅ Responsive dashboard with status cards

## Architecture

### Backend (Cloudflare Worker)
- **API Routes**: Status, history, targets CRUD, manual checks
- **Cron Triggers**: Automated uptime checks at configured intervals
- **D1 Database**: Persistent storage for targets and check history
- **KV Store**: Fast caching layer for latest status

### Frontend (Cloudflare Pages)
- **Framework**: React 18 + Vite + TypeScript
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom navy blue theme
- **Charts**: Recharts for latency/uptime visualization

## Setup & Deployment

### Prerequisites

```bash
npm install -g wrangler
wrangler login
```

### 1. Install Dependencies

```bash
# Root (Worker)
npm install

# Frontend
npm run frontend:install
```

### 2. Create Cloudflare Resources

```bash
# Create D1 Database
npm run db:create
# Copy the database_id from output and update wrangler.toml

# Create KV Namespace
npm run kv:create
# Copy the id from output and update wrangler.toml
```

### 3. Update wrangler.toml

Edit `wrangler.toml` and fill in the IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "govmonitor-db"
database_id = "YOUR_DATABASE_ID"  # From step 2

[[kv_namespaces]]
binding = "KV"
id = "YOUR_KV_ID"  # From step 2
```

### 4. Initialize Database

```bash
# For production
npm run db:migrate

# For local development
npm run db:migrate:local
```

### 5. Deploy Worker

```bash
npm run deploy
```

### 6. Build & Deploy Frontend

```bash
# Build frontend
npm run frontend:build

# Deploy to Cloudflare Pages
npm run frontend:deploy
```

## Local Development

### Run Worker Locally

```bash
npm run dev
```

The Worker will be available at `http://localhost:8787`

### Run Frontend Locally

```bash
npm run frontend:dev
```

The frontend will be available at `http://localhost:5173` and will proxy API requests to the Worker.

## API Endpoints

### GET /api/status
Get current status of all monitored websites

### GET /api/history?targetId=1&window=24h
Get check history for a target (window: 24h or 7d)

### GET /api/targets
List all monitored targets

### POST /api/targets
Add a new target
```json
{
  "name": "White House",
  "url": "https://www.whitehouse.gov",
  "interval_min": 15
}
```

### DELETE /api/targets/:id
Remove a monitored target

### GET /api/config
Get global configuration

### PUT /api/config
Update global configuration
```json
{
  "interval_min": 15
}
```

### POST /api/check
Trigger manual check for a target
```json
{
  "targetId": 1
}
```

## Database Schema

See `schema.sql` for the complete database structure:
- `config`: Global settings and last run timestamp
- `targets`: Monitored websites with intervals and next check times
- `checks`: Historical check results with status, latency, and errors

## Environment Variables

Worker environment variables (set in `wrangler.toml`):
- `ENVIRONMENT`: production/development
- `USER_AGENT`: Custom user agent for checks
- `TIMEOUT_MS`: Request timeout (default: 5000)
- `MAX_LATENCY_MS`: Maximum latency threshold (default: 10000)

## Cron Schedule

The Worker supports multiple cron triggers for flexible checking:
- `*/5 * * * *` - Every 5 minutes
- `*/10 * * * *` - Every 10 minutes
- `*/15 * * * *` - Every 15 minutes
- `*/30 * * * *` - Every 30 minutes
- `0 * * * *` - Every 60 minutes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev` and `npm run frontend:dev`
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
