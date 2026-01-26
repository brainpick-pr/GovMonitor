# Data & Storage

GovMonitor.Org relies on Cloudflare D1 and KV for persistence and caching. Understanding the schema is essential for extending health checks and analytics.

## D1 Database

### Tables

- `config`: Singleton row storing global settings (`interval_min`, `last_run_at`) with timestamps.
- `targets`: Enhanced metadata for each monitored endpoint. Columns include:
  - Basic: `name`, `url`, `hostname`, `state`, `interval_min`, `next_check_at`, `enabled`
  - Check Configuration: `check_mode`, `expected_status`, `allowed_status_codes`
  - Validation: `json_path`, `expected_json_value`, `text_match`
- `checks`: Historical records of every health probe with `ts`, `ok`, `status`, `latency_ms`, `error`, `validation_details`, `interval_used`.
- `state_daily_stats`: Daily aggregated statistics per state for performance optimization.

### Views

- `latest_status`: Joins `targets` with their most recent check for fast dashboard reads.
- `uptime_24h` / `uptime_7d`: Aggregate success metrics for 24-hour and 7-day windows.
- `state_uptime_24h`, `state_uptime_7d`, `state_uptime_30d`, `state_uptime_365d`: Per-state uptime aggregation across multiple time windows.

### Schema Evolution

**Migration 001 (001_add_check_modes.sql):**
- Added check mode support: `check_mode`, `expected_status`, `allowed_status_codes`
- Added validation fields: `json_path`, `expected_json_value`, `text_match`
- Enhanced checks table: `validation_details`, `interval_used`
- Added performance indexes for check modes and states

**Migration 002 (002_state_aggregation.sql):**
- Created `state_daily_stats` table for cached daily aggregates
- Implemented state uptime views for 24h, 7d, 30d, 365d windows
- Added indexes for state-date queries

## KV Namespaces

- `latest_status`: JSON cache (30-second TTL) containing the payload returned by `/api/status`.
- `state_summary_24h`, `state_summary_7d`, etc.: Cached state uptime statistics (5-minute TTL) to accelerate map dashboard loads.

## Data Validation & Constraints

### Target Validation
- Government domain enforcement: `.gov`, `.gov.*`, `.gc.ca`, `.government.*`
- Indian state validation against predefined list of 28 states + 8 UTs
- URL format validation with proper hostname extraction

### Check Mode Validation
- `website`: HTTP status monitoring with HEAD/GET fallback
- `api-json`: JSON response validation with dot-notation path access
- `api-text`: Response body content matching

## Performance Optimizations

### Indexing Strategy
- `idx_targets_next_check`: Optimizes cron job target selection
- `idx_targets_check_mode`: Supports filtering by check type
- `idx_targets_state`: Enables fast state-based queries
- `idx_checks_target_ts`: Optimizes historical data retrieval
- `idx_state_daily_stats_state_date`: Accelerates daily aggregate queries

### Caching Strategy
- KV cache for latest status reduces D1 load
- State summary caching enables fast map dashboard loads
- Daily stats table provides pre-computed aggregates

## Wrangler Configuration

- `wrangler.toml` binds D1 (`DB`) and KV (`KV`) namespaces, defines cron schedules, and sets environment variables like `USER_AGENT`, `TIMEOUT_MS`, and `MAX_LATENCY_MS`.
- Database migrations tracked in `migrations/` directory with sequential numbering.
- Environment-specific configurations for development and production.

## Backup & Observability

- Export D1 snapshots periodically using `wrangler d1 export`.
- Structured logging enables Cloudflare Logpush integration for long-term retention.
- Consider R2 storage for historical data archival if regulatory compliance is required.

## Current Implementation Status

✅ **Completed Features:**
- Enhanced target schema with check modes and validation
- State aggregation views for multiple time windows
- Performance-optimized indexing strategy
- KV caching for status and state summaries
- Migration system for schema evolution
- Daily statistics table for performance optimization

## ❌ Missing Data & Storage Features

### Database Schema Gaps
- **No user/account tables**: No authentication or user management schema
- **No alert configuration table**: Alert rules not persisted
- **No alert history table**: Sent notifications not tracked
- **No certificate tracking table**: SSL/TLS expiration data not stored
- **No maintenance windows table**: No scheduled downtime support
- **No target groups/tags tables**: No organizational structure
- **No audit log table**: Configuration changes not tracked

### Data Retention & Archival
- **No retention policies**: Check history grows indefinitely
- **No automatic cleanup**: Old data never purged
- **No R2 archival**: Long-term data not moved to cheaper storage
- **No data compression**: Historical data stored uncompressed
- **No partitioning**: Single checks table for all history
- **No cold storage tier**: All data in D1 (expensive for old data)

### KV Namespace Gaps
- **No cache warming**: Cache populated on-demand only
- **No cache invalidation tracking**: Cannot monitor cache effectiveness
- **No fallback strategy**: Limited error handling on KV failures
- **No cache versioning**: No ability to force cache refresh
- **No cache metrics**: Hit/miss rates not tracked

### Configuration Management
- **Missing wrangler.toml IDs**:
  - `database_id = ""` (must run `wrangler d1 create`)
  - KV namespace `id = ""` (must run `wrangler kv:namespace create`)
  - Optional: `route = ""` and `zone_id = ""`
- **No environment separation**: Same IDs for dev/staging/prod
- **No secrets management**: No secure storage for API keys

### Data Integrity & Validation
- **Limited constraints**: Only domain validation enforced
- **No foreign key indexes**: FK relationships not indexed
- **No unique constraints on state**: Duplicate state entries possible
- **No check result validation**: Malformed data can be inserted
- **No data versioning**: No schema version tracking in database

### Backup & Disaster Recovery
- **No automated backups**: Manual `wrangler d1 export` only
- **No backup verification**: No restore testing
- **No point-in-time recovery**: Cannot restore to specific timestamp
- **No cross-region replication**: Single D1 database location
- **No backup retention policy**: No backup lifecycle management

### Performance Optimization Gaps
- **No materialized views**: All views computed on-demand
- **No query caching**: D1 queries not cached (only KV)
- **No read replicas**: Single D1 instance for all reads
- **No connection pooling**: Each request creates new connection
- **No query monitoring**: Slow queries not identified
- **No index usage tracking**: Cannot verify index effectiveness

### Analytics & Reporting
- **No pre-aggregated metrics**: Daily stats table not automatically populated
- **No trend tables**: Historical trend data not pre-computed
- **No percentile tracking**: P50/P95/P99 latencies not stored
- **No correlation data**: Cannot analyze relationships between targets
- **No report storage**: No scheduled report results

### Migration Management
- **No migration rollback**: One-way migrations only
- **No migration testing**: No dry-run capability
- **No migration versioning**: Sequential numbering only
- **No migration dependencies**: Cannot model complex migration graphs
- **No migration history**: Applied migrations not tracked in database

### Observability
- **No Logpush configuration**: Structured logs not exported
- **No D1 metrics**: Query performance not monitored
- **No KV metrics**: Cache effectiveness not tracked
- **No storage alerts**: No alerts on database size/growth
- **No quota monitoring**: Cannot track D1/KV limits

## Priority Improvements

### High Priority
1. Configure missing Cloudflare resource IDs in wrangler.toml
2. Implement data retention policies and cleanup jobs
3. Add alert configuration and history tables
4. Create automated backup to R2 storage
5. Add audit logging table for compliance

### Medium Priority
1. Implement certificate tracking schema
2. Add user authentication and account tables
3. Create materialized views for expensive aggregations
4. Implement cache warming strategy
5. Add migration rollback capability

### Low Priority
1. Advanced analytics tables (trends, correlations)
2. Read replica support for scaling
3. Cross-region replication for DR
4. Custom metric storage
5. Advanced query optimization and monitoring
