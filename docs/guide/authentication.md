# Authentication Guide for GovMonitor.Org

This guide explains how to set up and use the authentication system in GovMonitor.Org.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Environment-Based Authentication](#environment-based-authentication)
4. [Database-Backed API Keys](#database-backed-api-keys)
5. [API Endpoints](#api-endpoints)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

GovMonitor.Org uses **API key-based authentication** to protect administrative endpoints. The system supports two authentication methods:

### Phase 1: Environment-Based Keys (Simple)
- API keys stored as Cloudflare secrets
- Quick setup, ideal for single-user or small teams
- No database queries required

### Phase 2: Database-Backed Keys (Advanced)
- API keys stored in D1 database with metadata
- Supports multiple keys with different scopes
- Rate limiting, audit logging, and key rotation
- Fine-grained access control

---

## Quick Start

### 1. Set Up Primary API Key

Generate a secure API key and store it in Cloudflare:

```bash
# Generate a secure random key (43 characters)
openssl rand -base64 32

# Set it as a secret in Cloudflare
wrangler secret put API_KEY
# Paste the generated key when prompted
```

### 2. Test Authentication

```bash
# Without authentication (should fail for protected endpoints)
curl -X POST http://localhost:8787/api/targets \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","url":"https://example.gov","state":"Delhi"}'

# Response: 401 Unauthorized

# With authentication (should succeed)
curl -X POST http://localhost:8787/api/targets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"name":"Test","url":"https://example.gov","state":"Delhi"}'

# Response: 201 Created
```

### 3. Run Database Migration (for Phase 2)

```bash
# Local development
wrangler d1 execute govmonitor-db --local --file=migrations/004_add_auth.sql

# Production
wrangler d1 execute govmonitor-db --file=migrations/004_add_auth.sql
```

---

## Environment-Based Authentication

### Supported Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `API_KEY` | Primary API key | `abc123def456...` |
| `ADMIN_API_KEYS` | Comma-separated admin keys | `key1,key2,key3` |
| `READ_ONLY_API_KEYS` | Comma-separated read-only keys | `readonly1,readonly2` |
| `REQUIRE_AUTH_FOR_READS` | Require auth for GET requests | `"true"` or `"false"` (default) |

### Setting Secrets

```bash
# Primary API key
wrangler secret put API_KEY
# Enter: your-secure-api-key

# Admin keys (multiple, comma-separated)
wrangler secret put ADMIN_API_KEYS
# Enter: admin-key-1,admin-key-2,admin-key-3

# Read-only keys
wrangler secret put READ_ONLY_API_KEYS
# Enter: readonly-key-1,readonly-key-2
```

### Local Development

For local testing, create a `.dev.vars` file:

```env
# .dev.vars (DO NOT commit to git!)
API_KEY=dev-test-key-12345
ADMIN_API_KEYS=dev-admin-key-1
READ_ONLY_API_KEYS=dev-readonly-key-1
REQUIRE_AUTH_FOR_READS=false
```

Then run:
```bash
npm run dev
```

---

## Database-Backed API Keys

### Creating API Keys

Use the `/api/auth/keys` endpoint to create managed API keys:

```bash
# Create an admin key
curl -X POST http://localhost:8787/api/auth/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -d '{
    "name": "Production Admin Key",
    "scope": "admin",
    "rate_limit": 5000,
    "expires_at": null
  }'

# Response:
{
  "message": "API key created successfully",
  "api_key": "mKz8pQ3vN2xR7wL5tH9jC1...",  # SAVE THIS!
  "key_info": {
    "id": 1,
    "name": "Production Admin Key",
    "scope": "admin",
    "rate_limit": 5000
  },
  "warning": "Save this key now! It will not be shown again."
}
```

**IMPORTANT:** The plaintext API key is only shown once. Save it immediately!

### API Key Scopes

| Scope | Permissions |
|-------|-------------|
| `admin` | Full access (create, read, update, delete, key management) |
| `write` | Create and update operations (no delete, no key management) |
| `read` | Read-only access (GET endpoints only) |

### Managing API Keys

#### List All Keys

```bash
curl http://localhost:8787/api/auth/keys \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"

# Response:
[
  {
    "id": 1,
    "name": "Production Admin Key",
    "scope": "admin",
    "enabled": 1,
    "rate_limit": 5000,
    "last_used_at": 1737849600,
    "created_at": 1737849000,
    "expires_at": null
  }
]
```

#### Update API Key

```bash
curl -X PUT http://localhost:8787/api/auth/keys/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -d '{
    "name": "Updated Admin Key",
    "rate_limit": 10000,
    "enabled": true
  }'
```

#### Revoke API Key

```bash
curl -X DELETE http://localhost:8787/api/auth/keys/1 \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"

# Response:
{
  "message": "API key revoked successfully",
  "id": 1
}
```

#### Rotate API Key

Generate a new key while keeping the same ID and settings:

```bash
curl -X POST http://localhost:8787/api/auth/keys/1/rotate \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"

# Response:
{
  "message": "API key rotated successfully",
  "api_key": "NEW_KEY_HERE",  # SAVE THIS!
  "key_info": {
    "id": 1,
    "name": "Production Admin Key",
    "scope": "admin"
  },
  "warning": "Save this new key now! The old key is now invalid."
}
```

---

## API Endpoints

### Protected Endpoints (Require Authentication)

#### Write Operations (POST/PUT/DELETE)
- `POST /api/targets` - Add monitoring target
- `DELETE /api/targets/:id` - Remove target
- `PUT /api/config` - Update configuration
- `POST /api/check` - Trigger manual check
- `POST /api/alerts/channels` - Add alert channel
- `DELETE /api/alerts/channels/:id` - Remove channel
- `PUT /api/alerts/config/:targetId` - Update alert config

#### Admin-Only Operations
- `GET /api/auth/keys` - List API keys
- `POST /api/auth/keys` - Create API key
- `DELETE /api/auth/keys/:id` - Revoke API key
- `PUT /api/auth/keys/:id` - Update API key
- `POST /api/auth/keys/:id/rotate` - Rotate API key
- `GET /api/auth/audit` - View audit log

### Public Endpoints (No Authentication Required)

By default, read operations are public:
- `GET /api/status` - Current status
- `GET /api/history` - Historical data
- `GET /api/targets` - List targets
- `GET /api/state-summary` - State aggregations
- `GET /api/alerts` - Alert history

**To require authentication for reads**, set:
```toml
# wrangler.toml
[vars]
REQUIRE_AUTH_FOR_READS = "true"
```

---

## Security Best Practices

### 1. API Key Generation

Always use cryptographically secure random generation:

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Option 3: Use the built-in generator
# POST /api/auth/keys automatically generates secure keys
```

**Never use:**
- Simple passwords or passphrases
- Sequential numbers
- Dictionary words
- Keys shorter than 32 characters

### 2. Key Storage

**DO:**
- ✅ Store keys in Cloudflare secrets (`wrangler secret put`)
- ✅ Use environment variables for local dev (`.dev.vars`)
- ✅ Store keys in secure password managers
- ✅ Use different keys for dev, staging, and production

**DON'T:**
- ❌ Commit keys to git repositories
- ❌ Share keys in Slack, email, or chat
- ❌ Reuse keys across environments
- ❌ Store keys in frontend code

### 3. Key Rotation

Rotate API keys regularly:

```bash
# Recommended schedule:
# - Production admin keys: Every 90 days
# - Service keys: Every 180 days
# - Compromised keys: Immediately

# Rotation process:
# 1. Create new key or rotate existing
# 2. Update all services using the old key
# 3. Wait 24 hours for propagation
# 4. Revoke the old key
```

### 4. Rate Limiting

Default rate limits:
- Admin keys: 10,000 requests/hour
- Write keys: 5,000 requests/hour
- Read keys: 1,000 requests/hour

Adjust based on usage:

```bash
curl -X PUT http://localhost:8787/api/auth/keys/1 \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -d '{"rate_limit": 20000}'
```

### 5. Audit Logging

Monitor authentication attempts:

```bash
# View recent authentication activity
curl http://localhost:8787/api/auth/audit?limit=100 \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"

# Filter failed attempts only
curl http://localhost:8787/api/auth/audit?success=0&limit=50 \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

### 6. Key Expiration

Set expiration dates for temporary keys:

```bash
# Create key that expires in 30 days
EXPIRES_AT=$(date -u -v+30d +%s)  # macOS
# EXPIRES_AT=$(date -u -d "+30 days" +%s)  # Linux

curl -X POST http://localhost:8787/api/auth/keys \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -d "{
    \"name\": \"Temporary Access\",
    \"scope\": \"read\",
    \"expires_at\": $EXPIRES_AT
  }"
```

---

## Troubleshooting

### 401 Unauthorized

**Symptom:** `{"error":"Unauthorized","message":"Missing or invalid Authorization header"}`

**Causes:**
- Missing `Authorization` header
- Malformed header (use `Bearer TOKEN` format)

**Solution:**
```bash
# Correct format
-H "Authorization: Bearer YOUR_API_KEY"

# Incorrect formats:
-H "Authorization: YOUR_API_KEY"  # Missing "Bearer"
-H "API-Key: YOUR_API_KEY"        # Wrong header name
```

### 403 Forbidden

**Symptom:** `{"error":"Forbidden","message":"Invalid API key"}`

**Causes:**
- API key doesn't exist
- API key is disabled (`enabled = 0`)
- API key has expired
- API key lacks required scope

**Solution:**
```bash
# Check if key exists and is enabled
wrangler d1 execute govmonitor-db --command \
  "SELECT * FROM api_keys WHERE enabled = 1"

# Check audit log for details
curl http://localhost:8787/api/auth/audit?success=0&limit=10 \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

### 429 Too Many Requests

**Symptom:** `{"error":"Too Many Requests","message":"Rate limit exceeded"}`

**Causes:**
- Exceeded hourly rate limit
- Too many requests in short time window

**Solution:**
```bash
# Check current rate limit
curl http://localhost:8787/api/auth/keys \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" | jq '.[] | {name, rate_limit}'

# Increase rate limit if needed
curl -X PUT http://localhost:8787/api/auth/keys/1 \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -d '{"rate_limit": 10000}'

# Or wait for next hour (rate limits reset hourly)
```

### CORS Issues

**Symptom:** Browser shows CORS errors even with valid API key

**Cause:** `Authorization` header not allowed in CORS

**Solution:** Already fixed in `worker.ts`:
```typescript
'Access-Control-Allow-Headers': 'Content-Type, Authorization'
```

If still seeing issues, check browser console for specific error.

### Database Key Not Found

**Symptom:** Valid key rejected, but works with environment key

**Causes:**
- Migration not run (`api_keys` table doesn't exist)
- Key hash mismatch

**Solution:**
```bash
# Check if table exists
wrangler d1 execute govmonitor-db --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys'"

# If empty, run migration
wrangler d1 execute govmonitor-db --file=migrations/004_add_auth.sql

# Verify table has data
wrangler d1 execute govmonitor-db --command \
  "SELECT COUNT(*) FROM api_keys WHERE enabled = 1"
```

---

## Testing

### Unit Tests

Run authentication tests:

```bash
npm run test -- auth.test.ts
```

### Integration Testing

```bash
# 1. Start local worker
npm run dev

# 2. Test public endpoint (no auth)
curl http://localhost:8787/api/status

# 3. Test protected endpoint without auth (should fail)
curl -X POST http://localhost:8787/api/targets \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","url":"https://example.gov","state":"Delhi"}'

# Expected: 401 Unauthorized

# 4. Test protected endpoint with auth (should succeed)
curl -X POST http://localhost:8787/api/targets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-test-key-12345" \
  -d '{"name":"Test","url":"https://example.gov","state":"Delhi"}'

# Expected: 201 Created

# 5. Test admin endpoint (requires admin scope)
curl -X POST http://localhost:8787/api/auth/keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-test-key-12345" \
  -d '{"name":"New Key","scope":"read"}'

# Expected: 201 Created (if using admin key)
```

---

## Migration from No Auth to Auth

If you have an existing deployment without authentication:

### Step 1: Deploy with Auth (Reads Still Public)

```bash
# Deploy worker with auth code
npm run deploy

# Run migration
wrangler d1 execute govmonitor-db --file=migrations/004_add_auth.sql

# Reads are still public by default
# Only write operations require auth
```

### Step 2: Set API Key

```bash
# Generate and set primary API key
wrangler secret put API_KEY
```

### Step 3: Update Clients

Update all scripts/services that perform write operations:

```bash
# Before (no auth)
curl -X POST https://api.govmonitor.org/api/targets -d '...'

# After (with auth)
curl -X POST https://api.govmonitor.org/api/targets \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '...'
```

### Step 4: Protect Reads (Optional)

If you want to require auth for read operations:

```bash
# Update wrangler.toml
[vars]
REQUIRE_AUTH_FOR_READS = "true"

# Redeploy
npm run deploy
```

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review audit logs: `GET /api/auth/audit`
- Check Cloudflare logs: `wrangler tail`
- Open an issue on GitHub

---

**Last Updated:** January 26, 2026
**Version:** 1.0
**Migration:** 004_add_auth.sql
