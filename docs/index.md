# GovMonitor.Org Documentation

Welcome to the comprehensive documentation for GovMonitor.Org - a real-time uptime monitoring system specifically designed for government websites.

## Quick Start

Get started monitoring government websites in minutes:

```bash
# 1. Add a monitoring target
curl -X POST https://api.govmonitor.org/api/targets \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "NIC India",
    "url": "https://www.nic.in",
    "state": "Delhi",
    "interval_min": 15,
    "check_mode": "website"
  }'

# 2. Check current status
curl https://api.govmonitor.org/api/status

# 3. View historical data
curl https://api.govmonitor.org/api/history?targetId=1&window=24h
```

## Documentation Sections

- **[Guide](/guide/getting-started)** - Get started, learn core concepts, and understand architecture
- **[Features](/features/overview)** - Explore smart scheduling, alerts, bulk operations, and templates
- **[API Reference](/api/endpoints)** - Complete API documentation with examples
- **[Deployment](/deployment/quickstart)** - Deploy to Cloudflare with step-by-step instructions

## Stack Summary

- **Cloudflare Workers** provide the REST API, cron-driven health checks, and integration with D1 and KV.
- **Cloudflare D1** stores configuration, target metadata, and check history.
- **Cloudflare KV** caches the latest target status and aggregated state data for fast reads.
- **Cloudflare Pages** hosts the Vite + React frontend.
- **VitePress** (these docs) capture implementation notes and roadmap items.

## 🎯 Current Features (Fully Implemented)

### Monitoring Capabilities
- ✅ **Multiple Check Modes**: Website (HTTP status), API JSON (path validation), API Text (content matching)
- ✅ **Flexible Scheduling**: 5, 10, 15, 30, 60-minute intervals with per-target overrides
- ✅ **State-Based Organization**: All 36 Indian states and union territories
- ✅ **Historical Analytics**: 24h, 7d, 30d, 365d time windows
- ✅ **Advanced Validation**: JSON path expressions, text matching, status code arrays

### User Interface
- ✅ **Interactive India Map**: SVG choropleth with hover tooltips and color-coded uptime
- ✅ **State Dashboard**: Aggregated statistics with sortable tables
- ✅ **Target Cards**: Real-time status with latency charts
- ✅ **Auto-refresh**: 30-second polling for live updates
- ✅ **Responsive Design**: Navy blue theme, mobile-friendly layout

### Performance & Reliability
- ✅ **KV Caching**: 60s TTL for status, 300s for state summaries
- ✅ **Database Views**: Pre-computed aggregations for fast queries
- ✅ **Optimized Indexes**: Performance-tuned for time-series and state queries
- ✅ **Batch Processing**: Efficient cron job execution
- ✅ **Structured Logging**: JSON logs for observability

### Infrastructure
- ✅ **Edge-Native**: Runs entirely on Cloudflare global network
- ✅ **Migration System**: Sequential database versioning
- ✅ **Domain Enforcement**: Database-level constraints for .gov domains
- ✅ **Cascade Deletes**: Clean data removal on target deletion

## ✨ Recently Implemented Features

The following features have been recently added to GovMonitor:

### 🔐 Authentication & Security (v1.1.0)
- ✅ **API Key Authentication** - Environment-based and database-backed keys
- ✅ **Scope-Based Authorization** - Admin, Write, Read permissions
- ✅ **Rate Limiting** - KV-based request throttling
- ✅ **Audit Logging** - Complete authentication trail
- ✅ **Key Management API** - Create, rotate, revoke keys

### 🔔 Alert System (v1.0.0)
- ✅ **5 Alert Types** - Downtime, Recovery, Latency, Consecutive Failures, State Outage
- ✅ **Webhook Support** - Send alerts to Slack, Discord, custom endpoints
- ✅ **Configurable Thresholds** - Per-target alert configuration
- ✅ **Alert History** - Complete audit trail of all triggered alerts

### ⚡ Smart Scheduling (v1.2.0)
- ✅ **Adaptive Intervals** - Automatically adjust based on reliability
- ✅ **Performance Metrics** - Track consecutive successes/failures
- ✅ **Resource Optimization** - Check stable targets less frequently

### 🛠️ Maintenance Windows (v1.2.0)
- ✅ **Scheduled Maintenance** - Define maintenance periods
- ✅ **Alert Suppression** - Suppress alerts during maintenance
- ✅ **Recurring Windows** - Daily, weekly, monthly schedules
- ✅ **State-Level Windows** - Apply to all targets in a state

### 📦 Bulk Operations (v1.2.0)
- ✅ **CSV/JSON Import** - Import 500+ targets at once
- ✅ **CSV/JSON Export** - Export all monitoring data
- ✅ **Bulk Updates** - Modify multiple targets simultaneously
- ✅ **Bulk Enable/Disable** - Toggle up to 100 targets

### 📋 Health Check Templates (v1.2.0)
- ✅ **6 Built-in Templates** - Government portal, API health, CMS, etc.
- ✅ **Custom Templates** - Create reusable check configurations
- ✅ **One-Click Application** - Apply templates to any target
- ✅ **Template History** - Track template usage

### ⚖️ GDPR Compliance (v1.3.0)
- ✅ **Data Retention Policies** - Automatic cleanup based on age
- ✅ **Export Requests** - GDPR Article 15 compliance
- ✅ **Deletion Requests** - GDPR Article 17 compliance
- ✅ **Processing Logs** - Complete audit trail

## 📊 Current Implementation Status

| Category | Status | Features |
|----------|--------|----------|
| **Core Monitoring** | 100% ✅ | 3 check modes, flexible scheduling, state organization |
| **Authentication & Security** | 100% ✅ | API keys, scopes, rate limiting, audit logs |
| **Alert System** | 100% ✅ | 5 alert types, webhooks, configurations |
| **Advanced Features** | 90% ✅ | Smart scheduling, maintenance windows, templates |
| **Bulk Operations** | 100% ✅ | Import/export, bulk updates/deletes |
| **GDPR Compliance** | 100% ✅ | Retention, export, deletion workflows |
| **Operations** | 85% ✅ | Monitoring, troubleshooting, migrations |

**Overall Progress**: ~95% feature-complete 🎉

## 🎯 Next Steps

- [ ] Certificate monitoring (SSL/TLS expiration tracking)
- [ ] Dark mode support for frontend
- [ ] PWA support for mobile app capabilities
- [ ] Geographic testing from multiple edge locations
- [ ] Dependency tracking for cascading failures

## 📚 Learn More

Explore the comprehensive documentation to learn how to use GovMonitor effectively:

- **[Quick Start Guide](/guide/quick-start)** - Set up monitoring in 5 minutes
- **[Authentication Guide](/guide/authentication)** - Secure your API
- **[API Reference](/api/endpoints)** - Complete API documentation
- **[Deployment Guide](/deployment/quickstart)** - Deploy to Cloudflare
