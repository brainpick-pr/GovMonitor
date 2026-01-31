# Features Overview

GovMonitor.Org provides comprehensive monitoring capabilities for government websites with advanced features for automation, alerting, and compliance.

## Core Monitoring

### Multiple Check Modes

GovMonitor supports three validation modes:

- **Website Mode** - HTTP status code validation
- **API JSON Mode** - JSON path/value validation  
- **API Text Mode** - Content substring matching

[Learn more about Check Modes](/guide/check-modes)

### Flexible Scheduling

Configure check intervals per target:
- 5, 10, 15, 30, or 60 minutes
- Per-target overrides
- Global default interval

## Advanced Features

### Smart Scheduling

Automatically adjusts check intervals based on target reliability:

- **Stable targets** (99.5%+ uptime) → longer intervals → save resources
- **Unreliable targets** (<95% uptime) → shorter intervals → faster detection
- Tracks performance metrics (consecutive successes/failures)
- Historical adjustment tracking

[Learn more about Smart Scheduling](/features/smart-scheduling)

### Maintenance Windows

Define scheduled maintenance periods:

- One-time or recurring (daily/weekly/monthly)
- Suppress checks during maintenance (optional)
- Suppress alerts during maintenance (default)
- Target-specific, state-level, or global windows

[Learn more about Maintenance Windows](/features/maintenance-windows)

### Alert System

Comprehensive alerting with 5 alert types:

- **Downtime** - Target goes down (UP → DOWN)
- **Recovery** - Target recovers (DOWN → UP)
- **Latency** - Response time exceeds threshold
- **Consecutive Failures** - N failures in a row
- **State Outage** - >50% of state targets down

[Learn more about Alerts](/features/alerts)

### Bulk Operations

Efficiently manage multiple targets:

- **Import** up to 500 targets from CSV or JSON
- **Export** all targets to CSV or JSON
- **Bulk enable/disable** up to 100 targets
- **Bulk update** configuration
- **Bulk delete** targets

[Learn more about Bulk Operations](/features/bulk-operations)

### Health Check Templates

Pre-built and custom check configurations:

- **6 built-in templates** (government portal, API health, CMS, etc.)
- **Custom templates** - create reusable configurations
- **One-click application** - apply to any target
- **Template history** - track usage

[Learn more about Templates](/features/templates)

## Security & Compliance

### Authentication

API key-based authentication with advanced features:

- Environment-based or database-backed keys
- Scope-based permissions (admin/write/read)
- Rate limiting (KV-based, configurable)
- Audit logging (complete auth trail)
- Key management API (create, rotate, revoke)

[Learn more about Authentication](/guide/authentication)

### GDPR Compliance

Built-in compliance features:

- **Data retention policies** - automatic cleanup
- **Export requests** - GDPR Article 15
- **Deletion requests** - GDPR Article 17
- **Processing logs** - complete audit trail

[Learn more about GDPR](/guide/gdpr-compliance)

## Performance & Reliability

### Caching Strategy

Optimized for performance:

- **KV caching** - 60s TTL for status, 300s for state summaries
- **Database views** - pre-computed aggregations
- **Batch processing** - 25 targets per batch
- **Optimized indexes** - time-series and state queries

### Edge-Native Architecture

Runs on Cloudflare's global network:

- **200+ cities** - ultra-low latency monitoring
- **Auto-scaling** - handles traffic spikes automatically
- **DDoS protection** - built-in security
- **Cost-effective** - generous free tier

## Visualization

### State Dashboard

Interactive visualizations:

- **India map** - color-coded uptime by state
- **State tables** - sortable statistics
- **Time windows** - 24h, 7d, 30d, 365d views

### Target Cards

Real-time status displays:

- Color-coded borders (green/red/gray)
- Latency badges
- Mini area charts (last 10 checks)
- Relative timestamps

## Getting Started

Ready to explore these features?

- **[Quick Start](/guide/quick-start)** - Set up monitoring in 5 minutes
- **[API Reference](/api/endpoints)** - Complete API documentation
- **[Deployment](/deployment/quickstart)** - Deploy to production
