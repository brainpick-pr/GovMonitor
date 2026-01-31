# GovMonitor.Org Deployment Guide

This guide covers deploying the improvements to your Cloudflare infrastructure.

## Prerequisites

- Cloudflare account with Workers and D1 access
- `wrangler` CLI installed and authenticated
- Existing D1 database and KV namespace from initial setup

## Deployment Steps

### 1. Run Database Migrations

Apply the schema changes to add new features:

```bash
# Migration 1: Add check modes and validation fields
wrangler d1 execute govmonitor-db --file=./migrations/001_add_check_modes.sql

# Migration 2: Add state aggregation tables and views
wrangler d1 execute govmonitor-db --file=./migrations/002_state_aggregation.sql
```

For local development:

```bash
wrangler d1 execute govmonitor-db --local --file=./migrations/001_add_check_modes.sql
wrangler d1 execute govmonitor-db --local --file=./migrations/002_state_aggregation.sql
```

### 2. Backfill Existing Data

Set default values for existing targets (if any):

```bash
# Create a backfill script
cat > backfill.sql << 'EOF'
UPDATE targets
SET
  check_mode = 'website',
  expected_status = 200,
  allowed_status_codes = NULL,
  json_path = NULL,
  expected_json_value = NULL,
  text_match = NULL
WHERE check_mode IS NULL;
EOF

# Execute backfill
wrangler d1 execute govmonitor-db --file=./backfill.sql
```

### 3. Build TypeScript Worker

Compile the Worker code:

```bash
npm run build
```

### 4. Deploy Worker

Deploy the updated Worker with new features:

```bash
wrangler deploy
```

This will:
- Deploy the Worker with multiple check modes support
- Enable structured logging for Logpush integration
- Add the `/api/state-summary` endpoint
- Update health check logic with validation support

### 5. Build Frontend

Build the React frontend with new features:

```bash
npm run frontend:build
```

This includes:
- Extended add-target dialog with check mode options
- India map component with SVG vector graphics
- State dashboard with aggregated metrics
- Time window toggles (24h/7d/30d/365d)

### 6. Deploy Frontend

Deploy to Cloudflare Pages:

```bash
npm run frontend:deploy
```

Or follow the Cloudflare Pages dashboard to link your repository for automatic deployments.

## Verification

### 1. Test New Check Modes

Add a test target with JSON validation:

```bash
curl -X POST https://your-worker.workers.dev/api/targets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test API",
    "url": "https://api.example.gov/health",
    "state": "Delhi",
    "check_mode": "api-json",
    "expected_status": 200,
    "json_path": "status",
    "expected_json_value": "ok"
  }'
```

### 2. Test State Summary API

Query state aggregation data:

```bash
# 24 hour window
curl https://your-worker.workers.dev/api/state-summary?window=24h

# 7 day window
curl https://your-worker.workers.dev/api/state-summary?window=7d
```

### 3. Verify KV Caching

Check that state summaries are cached:

```bash
wrangler kv:key get state_summary_24h --namespace-id=YOUR_KV_NAMESPACE_ID
```

### 4. Test Frontend

1. Visit your Cloudflare Pages URL
2. Click "State Dashboard" to view the India map
3. Toggle between time windows (24h/7d/30d/365d)
4. Click "Add Website" and verify new fields appear
5. Test adding targets with different check modes

## Configuration

### Environment Variables

Ensure these are set in `wrangler.toml`:

```toml
[env.production]
vars = {
  ENVIRONMENT = "production",
  USER_AGENT = "GovMonitorBot/2.0",
  TIMEOUT_MS = "10000",
  MAX_LATENCY_MS = "5000"
}
```

### Cron Triggers

The existing cron triggers will continue working with the new check modes. No changes needed unless you want to add aggregation jobs:

```toml
# Optional: Add a daily aggregation job
[triggers]
crons = ["0 0 * * *"]  # Run at midnight UTC
```

## Monitoring

### Structured Logs

The Worker now emits JSON logs that can be consumed by Cloudflare Logpush:

```json
{
  "event": "health_check",
  "target_id": 123,
  "target_name": "Example Site",
  "url": "https://example.gov",
  "check_mode": "api-json",
  "status": 200,
  "latency_ms": 145,
  "ok": true,
  "validation_details": "JSON validation passed: status = ok",
  "timestamp": "2025-10-13T12:00:00.000Z"
}
```

Configure Logpush in the Cloudflare dashboard to send these to your logging service.

### KV Cache Monitoring

State summaries are cached in KV with 5-minute TTL. Monitor KV usage:

```bash
wrangler kv:key list --namespace-id=YOUR_KV_NAMESPACE_ID
```

## Rollback

If issues occur, rollback steps:

### 1. Rollback Worker

```bash
# Deploy previous version
git checkout previous-commit
wrangler deploy
```

### 2. Rollback Database (if needed)

Database migrations cannot be automatically reversed. If critical issues occur:

1. Remove the new columns manually (not recommended if data exists)
2. Or deploy a Worker version that handles missing columns gracefully

### 3. Rollback Frontend

```bash
# Redeploy previous build
git checkout previous-commit
npm run frontend:build
npm run frontend:deploy
```

## Troubleshooting

### Migration Fails

- Check D1 database exists: `wrangler d1 list`
- Verify database name matches `wrangler.toml`
- Check for syntax errors in migration files

### Worker Deployment Fails

- Run `npm run build` to check for TypeScript errors
- Verify `wrangler.toml` configuration
- Check D1 and KV bindings are correct

### Frontend Build Fails

- Install dependencies: `npm run frontend:install`
- Check Node.js version compatibility
- Verify all imports are correct

### State Summary Returns Empty

- Ensure migrations have run successfully
- Check targets exist with valid state values
- Verify checks have been performed (wait for cron or trigger manual check)

## Next Steps

1. **Configure Logpush**: Set up Cloudflare Logpush to collect structured logs
2. **Set Up Alerts**: Create alerts for low uptime thresholds
3. **Add More Targets**: Populate the database with government websites
4. **Customize Map**: Update `IndiaMap.tsx` with accurate SVG paths for better visualization
5. **Optimize Queries**: Monitor D1 query performance and add indexes as needed

## Support

For issues or questions:
- Check the main README.md
- Review the improvement plan documents
- Open an issue in the repository
