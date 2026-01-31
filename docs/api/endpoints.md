# API Endpoints

Complete reference of all GovMonitor API endpoints.

## Authentication

All write operations (POST/PUT/DELETE) require authentication via API key:

```bash
-H "Authorization: Bearer YOUR_API_KEY"
```

Read operations (GET) are public by default.

[Learn more about Authentication](/guide/authentication)

## Monitoring

### GET /api/status

Returns current status of all targets (latest check per target).

**Response:**
```json
[
  {
    "id": 1,
    "name": "NIC India",
    "url": "https://www.nic.in",
    "hostname": "www.nic.in",
    "state": "Delhi",
    "enabled": 1,
    "ts": 1737849600,
    "ok": 1,
    "status": 200,
    "latency_ms": 245
  }
]
```

**Caching:** KV cache with 60s TTL

---

### GET /api/history

Returns check history for a specific target within a time window.

**Parameters:**
- `targetId` (required) - Target ID
- `window` (optional) - `24h` | `7d` | `30d` | `365d` (default: `24h`)

**Response:**
```json
{
  "stats": {
    "total_checks": 96,
    "successful_checks": 95,
    "uptime_percentage": 98.96,
    "avg_latency_ms": 234.5
  },
  "history": [...]
}
```

---

### GET /api/targets

Lists all monitored targets.

**Response:**
```json
[
  {
    "id": 1,
    "name": "NIC India",
    "url": "https://www.nic.in",
    "state": "Delhi",
    "interval_min": 15,
    "enabled": 1,
    "check_mode": "website"
  }
]
```

---

### POST /api/targets

Adds a new monitored target. **Requires authentication.**

**Request:**
```json
{
  "name": "NIC India",
  "url": "https://www.nic.in",
  "state": "Delhi",
  "interval_min": 15,
  "check_mode": "website",
  "expected_status": 200
}
```

**Validation:**
- Domain must be .gov/.gov.*/.gc.ca/.government.*
- State must be valid Indian state/UT
- Interval must be 5/10/15/30/60

---

### DELETE /api/targets/:id

Removes a target. **Requires authentication.**

**Response:**
```json
{
  "message": "Target deleted successfully"
}
```

---

### POST /api/check

Triggers manual check (bypasses schedule). **Requires authentication.**

**Query Parameters:**
- `targetId` (optional) - Check specific target, or all if omitted

**Response:**
```json
{
  "message": "Check completed",
  "processed": 25,
  "successful": 24,
  "failed": 1
}
```

---

## Configuration

### GET /api/config

Returns global configuration.

### PUT /api/config

Updates global configuration. **Requires authentication.**

**Request:**
```json
{
  "interval_min": 10,
  "smart_scheduling_enabled": true
}
```

---

### GET /api/state-summary

Returns state-level aggregation statistics.

**Parameters:**
- `window` (optional) - `24h` | `7d` | `30d` | `365d` (default: `24h`)

**Response:**
```json
[
  {
    "state": "Karnataka",
    "total_targets": 12,
    "total_checks": 1152,
    "successful_checks": 1140,
    "uptime_percentage": 98.96
  }
]
```

**Caching:** KV cache with 300s (5 min) TTL

---

## Alerts

### GET /api/alerts

List alert history.

**Parameters:**
- `target_id` (optional) - Filter by target
- `severity` (optional) - Filter by severity
- `limit` (optional) - Number of results (default: 50)

---

### GET /api/alerts/config/:targetId

Get target alert configuration.

---

### PUT /api/alerts/config/:targetId

Update target alert configuration. **Requires authentication.**

**Request:**
```json
{
  "downtime_enabled": true,
  "latency_enabled": true,
  "latency_threshold_ms": 2000,
  "consecutive_failures_enabled": true,
  "consecutive_failures_threshold": 3
}
```

---

### GET /api/alerts/channels

List all alert channels.

---

### POST /api/alerts/channels

Add new alert channel (webhook/email). **Requires authentication.**

**Request:**
```json
{
  "name": "Slack Notifications",
  "type": "webhook",
  "config": {
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK",
    "headers": {}
  }
}
```

---

### DELETE /api/alerts/channels/:id

Remove alert channel. **Requires authentication.**

---

## Authentication (Admin Only)

### GET /api/auth/keys

List all API keys. **Requires admin scope.**

---

### POST /api/auth/keys

Create new API key. **Requires admin scope.**

**Request:**
```json
{
  "name": "Production Admin Key",
  "scope": "admin",
  "rate_limit": 5000
}
```

**Response includes plaintext key (only shown once!):**
```json
{
  "api_key": "generated-key-here",
  "warning": "Save this key now!"
}
```

---

### DELETE /api/auth/keys/:id

Revoke API key. **Requires admin scope.**

---

### POST /api/auth/keys/:id/rotate

Rotate API key (generate new key). **Requires admin scope.**

---

### GET /api/auth/audit

View authentication audit log. **Requires admin scope.**

**Parameters:**
- `limit` (optional) - Number of results (default: 100)
- `success` (optional) - Filter by success (0 or 1)

---

## Smart Scheduling

### GET /api/scheduling/metrics/:targetId

Get performance metrics for a target.

---

### GET /api/scheduling/adjustments/:targetId

Get interval adjustment history.

**Parameters:**
- `limit` (optional) - Number of results (default: 20)

---

### PUT /api/config/smart-scheduling

Update smart scheduling configuration. **Requires authentication.**

---

## Maintenance Windows

### GET /api/maintenance/windows

List active maintenance windows.

---

### POST /api/maintenance/windows

Create maintenance window. **Requires authentication.**

**Request:**
```json
{
  "name": "Weekly Maintenance",
  "start_time": 1737849600,
  "end_time": 1737853200,
  "recurrence": "weekly",
  "suppress_checks": false,
  "suppress_alerts": true
}
```

---

### DELETE /api/maintenance/windows/:id

Delete maintenance window. **Requires authentication.**

---

## Bulk Operations

### POST /api/targets/bulk/import

Import targets from CSV or JSON. **Requires authentication.**

**Request (CSV):**
```csv
name,url,state,interval_min,check_mode
Target 1,https://example.gov,Delhi,15,website
```

**Request (JSON):**
```json
{
  "targets": [...]
}
```

**Max:** 500 targets per import

---

### GET /api/targets/export

Export all targets to CSV or JSON.

**Parameters:**
- `format` (optional) - `csv` | `json` (default: `json`)
- `state` (optional) - Filter by state
- `enabled` (optional) - Filter by enabled status

---

### POST /api/targets/bulk/toggle

Bulk enable/disable targets. **Requires authentication.**

**Request:**
```json
{
  "target_ids": [1, 2, 3],
  "enabled": false
}
```

**Max:** 100 targets per request

---

### POST /api/targets/bulk/update

Bulk update target configuration. **Requires authentication.**

---

### POST /api/targets/bulk/delete

Bulk delete targets. **Requires authentication.**

**Max:** 100 targets per request

---

## Templates

### GET /api/templates

List all health check templates.

**Parameters:**
- `category` (optional) - Filter by category

---

### POST /api/templates

Create custom template. **Requires authentication.**

---

### GET /api/templates/:id

Get specific template.

---

### PUT /api/templates/:id

Update template. **Requires authentication.**

---

### DELETE /api/templates/:id

Delete template. **Requires authentication.**

---

### POST /api/targets/:id/apply-template

Apply template to target. **Requires authentication.**

**Request:**
```json
{
  "template_id": 1
}
```

---

## GDPR

### GET /api/gdpr/retention-policy

Get data retention policy.

---

### PUT /api/gdpr/retention-policy

Update retention policy. **Requires authentication.**

---

### POST /api/gdpr/export

Create data export request. **Requires authentication.**

---

### GET /api/gdpr/export/:id

Get export request status.

---

### POST /api/gdpr/deletion

Create data deletion request. **Requires authentication.**

---

### PUT /api/gdpr/deletion/:id/approve

Approve deletion request. **Requires authentication.**

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error details"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limits

Default rate limits per API key:
- **Admin keys**: 10,000 requests/hour
- **Write keys**: 5,000 requests/hour
- **Read keys**: 1,000 requests/hour

Configurable per key via API key management endpoints.
