# Quick Start

Get started with GovMonitor in under 5 minutes.

## Prerequisites

- Cloudflare account (free tier works)
- `wrangler` CLI installed
- Node.js 18+ and npm

## Step 1: Clone and Install

```bash
git clone https://github.com/yourusername/govmonitor.git
cd govmonitor
npm install
```

## Step 2: Set Up Database

```bash
# Create D1 database
wrangler d1 create govmonitor-db
# Copy the database_id to wrangler.toml

# Run migrations
wrangler d1 execute govmonitor-db --local --file=schema.sql
wrangler d1 execute govmonitor-db --local --file=migrations/001_add_check_modes.sql
wrangler d1 execute govmonitor-db --local --file=migrations/002_state_aggregation.sql
wrangler d1 execute govmonitor-db --local --file=migrations/003_add_alerts.sql
wrangler d1 execute govmonitor-db --local --file=migrations/004_add_auth.sql
```

## Step 3: Set Up KV Namespace

```bash
# Create KV namespace
wrangler kv:namespace create "GOVMONITOR_KV"
# Copy the id to wrangler.toml
```

## Step 4: Configure Authentication

```bash
# Generate a secure API key
openssl rand -base64 32

# Set it as a secret
wrangler secret put API_KEY
# Paste the generated key
```

## Step 5: Start Local Development

```bash
# Start worker
npm run dev

# In another terminal, start frontend
npm run frontend:dev
```

Visit `http://localhost:5173` to see the dashboard.

## Step 6: Add Your First Target

```bash
curl -X POST http://localhost:8787/api/targets \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NIC India",
    "url": "https://www.nic.in",
    "state": "Delhi",
    "interval_min": 15,
    "check_mode": "website",
    "expected_status": 200
  }'
```

## Step 7: Trigger a Manual Check

```bash
curl -X POST http://localhost:8787/api/check \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Step 8: View the Dashboard

Open `http://localhost:5173` in your browser. You should see:

- Your target card showing status
- State dashboard with statistics
- Interactive India map (if state is an Indian state)

## Next Steps

- **[Authentication Guide](/guide/authentication)** - Learn about API keys
- **[Features](/features/overview)** - Explore all features
- **[Deployment](/deployment/quickstart)** - Deploy to production
- **[API Reference](/api/endpoints)** - Complete API documentation

## Troubleshooting

**Database not found?**
Run migrations again and check `wrangler.toml` has correct `database_id`.

**401 Unauthorized?**
Make sure you've set the API key and are sending it in the `Authorization` header.

**Target not checking?**
Wait for the next cron interval (5 minutes by default) or trigger manually with `POST /api/check`.
