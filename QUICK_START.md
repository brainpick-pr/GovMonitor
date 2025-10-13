# Quick Start Guide

Get GovMonitor.Org up and running with the new features.

## Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)

## Local Development

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Frontend dependencies
npm run frontend:install
```

### 2. Generate SVG Map Paths

```bash
# Generate optimized SVG paths from GeoJSON
npm run generate:svg
```

This creates `frontend/src/data/indiaSvgPaths.ts` with pre-computed map paths.

### 3. Set Up Local Database

```bash
# Create and migrate local D1 database
npm run db:migrate:local

# Run migrations for new features
wrangler d1 execute govmonitor-db --local --file=./migrations/001_add_check_modes.sql
wrangler d1 execute govmonitor-db --local --file=./migrations/002_state_aggregation.sql
```

### 4. Start Development Servers

**Terminal 1 - Worker:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run frontend:dev
```

### 5. Open Browser

- Frontend: http://localhost:5173
- Worker API: http://localhost:8787

## Adding Test Data

### Add a Website Target

```bash
curl -X POST http://localhost:8787/api/targets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Gov Site",
    "url": "https://example.gov",
    "state": "Delhi",
    "interval_min": 15,
    "check_mode": "website",
    "expected_status": 200
  }'
```

### Add an API with JSON Validation

```bash
curl -X POST http://localhost:8787/api/targets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Health API",
    "url": "https://api.example.gov/health",
    "state": "Maharashtra",
    "check_mode": "api-json",
    "expected_status": 200,
    "json_path": "status",
    "expected_json_value": "ok"
  }'
```

### Trigger Manual Check

```bash
curl -X POST http://localhost:8787/api/check \
  -H "Content-Type: application/json" \
  -d '{"targetId": 1}'
```

## Features to Test

### 1. Target Management
- ✅ Click "Add Website" button
- ✅ Select check type (Website/API JSON/API Text)
- ✅ Fill in check parameters
- ✅ Submit and verify target appears

### 2. State Dashboard
- ✅ Click "State Dashboard" tab
- ✅ Verify India map loads with state borders
- ✅ Toggle time windows (24h/7d/30d/365d)
- ✅ Hover over states to see tooltips
- ✅ Check statistics table updates

### 3. Check Modes
- ✅ Add website target with 200 status check
- ✅ Add API JSON target with path validation
- ✅ Add API text target with substring match
- ✅ Verify all checks run successfully

### 4. Aggregation
- ✅ Query state summary: `GET /api/state-summary?window=24h`
- ✅ Verify KV caching works
- ✅ Check D1 views have data

## Common Tasks

### Regenerate Map Paths

If you update the GeoJSON file:

```bash
npm run generate:svg
```

### Reset Local Database

```bash
rm -rf .wrangler/state
npm run db:migrate:local
wrangler d1 execute govmonitor-db --local --file=./migrations/001_add_check_modes.sql
wrangler d1 execute govmonitor-db --local --file=./migrations/002_state_aggregation.sql
```

### Check Logs

```bash
# Worker logs (in dev terminal)
# Frontend logs (in browser console)
```

### Build for Production

```bash
# Build Worker
npm run build

# Build Frontend
npm run frontend:build
```

## Troubleshooting

### Map doesn't appear
- Check if `frontend/src/data/indiaSvgPaths.ts` exists
- Run `npm run generate:svg`
- Check browser console for errors

### State dashboard shows no data
- Add targets with valid state names
- Run checks to populate data
- Verify API endpoint: `curl http://localhost:8787/api/state-summary?window=24h`

### Migrations fail
- Check D1 database exists
- Verify wrangler.toml configuration
- Check migration SQL syntax

### Frontend build fails
- Delete `node_modules` and `package-lock.json`
- Run `npm run frontend:install` again
- Check TypeScript errors

### Worker deployment fails
- Run `npm run build` to check TypeScript
- Verify wrangler.toml bindings
- Check D1 and KV namespace IDs

## Environment Variables

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8787/api
```

### Worker (wrangler.toml)

```toml
[env.production]
vars = {
  ENVIRONMENT = "production",
  USER_AGENT = "GovMonitorBot/2.0",
  TIMEOUT_MS = "10000"
}
```

## Next Steps

1. Add more test targets
2. Wait for scheduled checks to run
3. View state dashboard with real data
4. Explore different time windows
5. Test API JSON/text validation

## Resources

- [Full Deployment Guide](./DEPLOYMENT.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Scripts Documentation](./scripts/README.md)
- [Improvement Plans](./docs/pending/)

## Getting Help

Issues? Check:
1. Browser console for frontend errors
2. Terminal for Worker errors
3. Wrangler logs: `wrangler tail`
4. D1 queries: `wrangler d1 execute govmonitor-db --command "SELECT * FROM targets"`

Enjoy monitoring! 🚀
