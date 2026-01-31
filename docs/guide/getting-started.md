# Getting Started with GovMonitor

GovMonitor.Org is a real-time uptime monitoring system designed specifically for government websites. This guide will help you understand how to use GovMonitor effectively.

## What is GovMonitor?

GovMonitor provides:

- **Real-time monitoring** of government websites
- **Multiple check modes** (HTTP status, JSON validation, content matching)
- **Smart scheduling** that adapts to target reliability
- **Comprehensive alerts** for downtime and performance issues
- **State-level organization** for Indian government services
- **Historical analytics** with multiple time windows
- **GDPR-compliant** data handling

## Architecture Overview

GovMonitor runs entirely on Cloudflare's global edge network:

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                          │
│  React SPA (Cloudflare Pages)                               │
│  - StatusCard, StateDashboard, IndiaMap                     │
│  - Real-time status updates (30s polling)                    │
└─────────────────────────────────────────────────────────────┘
                          ↓ API Calls (/api/*)
┌─────────────────────────────────────────────────────────────┐
│                       Worker Layer                           │
│  Cloudflare Worker                                          │
│  - API endpoints                                            │
│  - Health check logic                                       │
│  - Authentication middleware                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓ Data Access
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│  D1 (Primary Storage) + KV (Fast Cache)                     │
│  - Tables: config, targets, checks, alerts                   │
│  - Views: latest_status, uptime_24h, state_uptime_*         │
└─────────────────────────────────────────────────────────────┘
```

## Key Concepts

### Targets

A **target** is a government website or API endpoint that you want to monitor. Each target has:

- **Name**: Friendly identifier (e.g., "NIC India")
- **URL**: Full URL to monitor (must be .gov domain)
- **State**: Indian state/UT (for organization)
- **Check Mode**: How to validate the target (website/api-json/api-text)
- **Interval**: Check frequency (5, 10, 15, 30, or 60 minutes)

### Checks

A **check** is an individual monitoring attempt. For each check, GovMonitor records:

- **Timestamp**: When the check occurred
- **Status**: OK (1) or Failed (0)
- **HTTP Status**: Response code (200, 500, etc.)
- **Latency**: Response time in milliseconds
- **Error**: Error message (if failed)

### Check Modes

GovMonitor supports three validation modes:

1. **Website Mode** - HTTP status code validation
2. **API JSON Mode** - JSON path/value validation
3. **API Text Mode** - Content substring matching

See [Check Modes](/guide/check-modes) for details.

### States

GovMonitor organizes targets by 36 Indian states and union territories, enabling state-level statistics and visualization.

## Quick Example

### 1. Add a Target

```bash
curl -X POST https://api.govmonitor.org/api/targets \
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

### 2. View Status

```bash
curl https://api.govmonitor.org/api/status
```

### 3. Get History

```bash
curl https://api.govmonitor.org/api/history?targetId=1&window=24h
```

## Next Steps

- **[Quick Start](/guide/quick-start)** - Set up monitoring in 5 minutes
- **[Authentication](/guide/authentication)** - Secure your API
- **[Check Modes](/guide/check-modes)** - Learn about validation modes
- **[API Reference](/api/endpoints)** - Complete API documentation
