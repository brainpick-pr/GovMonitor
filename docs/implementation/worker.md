# Cloudflare Worker

The Worker (`src/worker.ts`) orchestrates health checks, data persistence, and API responses. Key responsibilities include:

## API Routes

- `GET /api/status`: Returns the latest state of every monitored target, served from KV when possible.
- `GET /api/history?targetId=…&window=…`: Streams check history for a target across predefined windows (24h, 7d).
- `GET /api/targets`, `POST /api/targets`, `DELETE /api/targets/:id`: Administer monitored endpoints with validation for `.gov` domains and mandatory Indian state metadata.
- `GET/PUT /api/config`: Manage global settings such as the default check interval.
- `POST /api/check`: Trigger a manual health check for a specific target.
- `GET /api/state-summary?window=…`: Returns aggregated uptime statistics by Indian state for 24h, 7d, 30d, or 365d windows.

All handlers share CORS headers and structured error responses. When mutating data, the Worker invalidates `latest_status` in KV to keep frontend views fresh.

## Health Check Logic

### Check Modes
The Worker supports three check modes per target:

1. **Website Mode** (`website`): Uses `HEAD` requests first, falling back to `GET` when HEAD is unsupported
2. **API JSON Mode** (`api-json`): Makes `GET` requests and validates JSON response structure using JSON path expressions
3. **API Text Mode** (`api-text`): Makes `GET` requests and validates response content contains expected text

### Validation Features
- **Status Code Validation**: Supports single expected status or array of allowed status codes
- **JSON Path Validation**: Uses dot notation (e.g., "status.health") to extract and validate JSON values
- **Text Matching**: Validates that response body contains expected substring
- **Timeout Handling**: Applies `AbortController` timeout (default 5s) with `cf.cacheTtl: 0` to bypass cache

### Structured Logging
The Worker emits structured JSON logs for observability:
```json
{
  "event": "health_check",
  "target_id": 1,
  "target_name": "Example API",
  "url": "https://api.example.gov/health",
  "check_mode": "api-json",
  "status": 200,
  "latency_ms": 245,
  "ok": true,
  "validation_details": "JSON validation passed: status.health = healthy",
  "timestamp": "2025-10-16T10:30:00.000Z"
}
```

## Cron Triggers

Cron invocations select enabled targets whose `next_check_at` has elapsed, run checks in parallel, and update the `config.last_run_at` timestamp. The Worker is designed to handle multiple cron schedules (5m/10m/15m/30m/60m) defined in `wrangler.toml`.

## State Aggregation

The Worker provides pre-computed state-level uptime statistics through:
- Database views: `state_uptime_24h`, `state_uptime_7d`, `state_uptime_30d`, `state_uptime_365d`
- KV caching: State summaries cached for 5 minutes to accelerate dashboard loads
- API endpoint: `/api/state-summary` serves aggregated data for the India map visualization

## Current Implementation Status

✅ **Completed Features:**
- Multiple check modes (website, api-json, api-text)
- JSON path validation with `getJsonValue()` helper function
- Text content matching validation
- Structured logging for observability
- State-wise uptime aggregation
- KV caching for performance optimization
- Advanced target configuration options

## ❌ Missing Worker Features

### Alert & Notification System
- **No downtime alerts**: No email, Slack, or webhook notifications when targets fail
- **No alert rules**: Cannot configure when/how to notify
- **No escalation policies**: No multi-level alert routing
- **No alert suppression**: No maintenance windows or snooze functionality
- **No alert history**: No tracking of sent notifications

### Certificate Monitoring
- **No SSL/TLS tracking**: Certificate expiration dates not monitored
- **No certificate validation**: No checks for revoked or invalid certificates
- **No chain verification**: Certificate chain not validated
- **No early warnings**: No proactive expiration alerts (30/7/1 day before)

### Advanced Health Checks
- **No multi-region testing**: Checks run from single edge location only
- **No dependency chains**: Cannot model service dependencies
- **No performance thresholds**: No configurable latency/response size alerts
- **No custom headers**: Limited header customization
- **No request body support**: Cannot send POST/PUT data for API checks
- **No authentication**: No support for Basic/Bearer auth in checks

### Rate Limiting & Security
- **No API rate limiting**: Worker endpoints unprotected from abuse
- **No authentication**: Public access to all endpoints
- **No IP allowlisting**: Cannot restrict access by IP
- **No request validation**: Limited input sanitization
- **No CORS configuration**: Accepts all origins

### Scheduling & Automation
- **No smart scheduling**: Fixed intervals only, no adaptive checking
- **No backoff strategies**: Failed checks retry at same interval
- **No regional routing**: Cannot check from specific Cloudflare POPs
- **No check prioritization**: All targets treated equally
- **No batch size tuning**: Fixed batch processing limits

### Observability & Debugging
- **No request tracing**: No distributed tracing support
- **No debug mode**: Cannot enable verbose logging per target
- **No check replay**: Cannot re-run historical checks
- **No performance metrics**: No Worker execution time tracking
- **No error categorization**: Generic error messages only

### Data Management
- **No data retention**: Unlimited history growth (no automatic cleanup)
- **No archival to R2**: Long-term data not moved to cheaper storage
- **No aggregation jobs**: Daily stats not automatically computed
- **No data export**: Cannot export checks to CSV/JSON via API

### API Endpoints Missing
- **No `/api/alerts` endpoint**: No alert management
- **No `/api/certificates` endpoint**: No certificate information
- **No `/api/metrics` endpoint**: No Worker performance data
- **No `/api/export` endpoint**: No data export functionality
- **No `/api/batch` endpoint**: No bulk operations support

## Priority Improvements

### High Priority
1. Alert system with email/Slack/webhook support
2. Certificate monitoring and expiration warnings
3. API authentication and rate limiting
4. Integration test suite

### Medium Priority
1. Multi-region health check support
2. Smart scheduling and adaptive intervals
3. Data retention and R2 archival
4. Enhanced error handling and categorization

### Low Priority
1. Custom request headers and authentication
2. Dependency chain modeling
3. Advanced performance metrics
4. Request tracing and debugging tools
