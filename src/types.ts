/**
 * Type definitions for GovMonitor.Org
 */

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ENVIRONMENT: string;
  USER_AGENT: string;
  TIMEOUT_MS: string;
  MAX_LATENCY_MS: string;

  // Authentication
  API_KEY?: string;              // Primary API key
  ADMIN_API_KEYS?: string;       // Comma-separated admin keys
  READ_ONLY_API_KEYS?: string;   // Comma-separated read-only keys
  REQUIRE_AUTH_FOR_READS?: string; // "true" | "false"

  // Google OAuth
  GOOGLE_CLIENT_ID?: string;     // Google OAuth client ID
  GOOGLE_CLIENT_SECRET?: string; // Google OAuth client secret

  // Encryption & Security
  ENCRYPTION_KEY?: string;       // Base64-encoded 256-bit AES key for data at rest
  SECURITY_WEBHOOK_URL?: string; // Webhook for security alerts
  DISABLE_ENCRYPTION?: string;   // "true" to disable encryption (emergency rollback)
  DISABLE_THREAT_DETECTION?: string; // "true" to disable threat detection

  // R2 Storage for file uploads
  SCREENSHOTS?: R2Bucket;        // R2 bucket for issue screenshots
}

export type CheckMode = 'website' | 'api-json' | 'api-text';

export interface Target {
  id: number;
  name: string;
  url: string;
  hostname: string;
  state: string;
  interval_min: number;
  next_check_at: number;
  enabled: number;
  check_mode: CheckMode;
  expected_status: number;
  allowed_status_codes: string | null; // JSON array of numbers
  json_path: string | null;
  expected_json_value: string | null;
  text_match: string | null;
}

export interface CheckResult {
  ok: boolean;
  status?: number;
  latency_ms?: number;
  error?: string;
  validation_details?: string;
}

export interface CachedStatus {
  id: number;
  name: string;
  url: string;
  hostname: string;
  state: string | null;
  enabled: number;
  ts: number | null;
  ok: number | null;
  status: number | null;
  latency_ms: number | null;
  error: string | null;
}

export type AddTargetPayload = {
  name: string;
  url: string;
  interval_min?: number;
  state?: string;
  check_mode?: CheckMode;
  expected_status?: number;
  allowed_status_codes?: number[];
  json_path?: string;
  expected_json_value?: string;
  text_match?: string;
};

// Alert-related types
export type AlertType = 'downtime' | 'recovery' | 'latency' | 'consecutive_failures' | 'state_outage';
export type AlertSeverity = 'info' | 'medium' | 'high' | 'critical';

export interface AlertConfig {
  id: number;
  target_id: number;
  enabled: number;
  downtime_alerts: number;
  recovery_alerts: number;
  latency_threshold_ms: number;
  latency_alerts: number;
  consecutive_failures_threshold: number;
  created_at: number;
  updated_at: number;
}

export interface AlertGlobalConfig {
  id: number;
  state_outage_threshold: number;
  state_outage_alerts: number;
  created_at: number;
  updated_at: number;
}

export interface Alert {
  id: number;
  target_id: number | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata: string; // JSON
  check_id: number | null;
  dispatched: number;
  dispatched_at: number | null;
  channels: string | null; // JSON array
  created_at: number;
}

export interface AlertChannel {
  id: number;
  name: string;
  type: 'webhook' | 'email';
  enabled: number;
  config: string; // JSON
  created_at: number;
  updated_at: number;
}

export interface AlertCondition {
  type: AlertType;
  severity: AlertSeverity;
  shouldTrigger: boolean;
  message: string;
  metadata: Record<string, any>;
}

// Authentication types
export type ApiKeyScope = 'admin' | 'write' | 'read';

export interface ApiKeyRecord {
  id: number;
  name: string;
  scope: ApiKeyScope;
  enabled: number;
  rate_limit: number;
  last_used_at: number | null;
  expires_at: number | null;
}

export interface AuthResult {
  authenticated: boolean;
  apiKeyId?: number;
  scope?: ApiKeyScope;
  error?: string;
}

export interface CreateApiKeyPayload {
  name: string;
  scope: ApiKeyScope;
  rate_limit?: number;
  expires_at?: number;
}

// ============================================================================
// Smart Scheduling Types
// ============================================================================

export interface SmartSchedulingConfig {
  stable_threshold_uptime: number;       // 99.5%+ = increase interval
  unstable_threshold_uptime: number;     // <95% = decrease interval
  min_checks_before_adjust: number;      // Need N checks before adjusting
  max_interval_min: number;              // Don't exceed this interval
  min_interval_min: number;              // Don't go below this interval
  stable_multiplier: number;             // Multiply interval when stable
  unstable_multiplier: number;           // Multiply interval when unstable
  consecutive_failures_trigger: number;  // Decrease after N failures
}

export interface SchedulingMetrics {
  id: number;
  target_id: number;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  uptime_percentage: number;
  consecutive_successes: number;
  consecutive_failures: number;
  avg_latency_ms: number | null;
  last_failure_at: number | null;
  recommended_interval_min: number;
  current_interval_min: number;
  interval_last_adjusted_at: number | null;
  adjustment_reason: string | null;
  peak_hours: string | null;  // JSON
  failure_time_pattern: string | null;  // JSON
  created_at: number;
  updated_at: number;
}

export interface IntervalAdjustment {
  id: number;
  target_id: number;
  old_interval_min: number;
  new_interval_min: number;
  reason: string;
  uptime_at_adjustment: number;
  consecutive_failures_at_adjustment: number;
  created_at: number;
}

export interface AdjustmentReport {
  total_candidates: number;
  adjusted: number;
  increased: number;
  decreased: number;
  errors: number;
  adjustments: IntervalAdjustment[];
}

// ============================================================================
// Maintenance Windows Types
// ============================================================================

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | null;

export interface RecurrenceConfig {
  day_of_week?: number;  // 0-6 (Sunday-Saturday)
  day_of_month?: number;  // 1-31
  time?: string;  // "02:00"
}

export interface MaintenanceWindow {
  id: number;
  name: string;
  description: string | null;
  target_id: number | null;
  state: string | null;
  start_time: number;
  end_time: number;
  recurrence: RecurrenceType;
  recurrence_config: string | null;  // JSON
  suppress_checks: number;
  suppress_alerts: number;
  created_by: string | null;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface CreateMaintenanceWindowPayload {
  name: string;
  description?: string;
  target_id?: number;
  state?: string;
  start_time: number;
  end_time: number;
  recurrence?: RecurrenceType;
  recurrence_config?: RecurrenceConfig;
  suppress_checks?: boolean;
  suppress_alerts?: boolean;
}

export interface MaintenanceSkipLog {
  id: number;
  target_id: number;
  window_id: number;
  skip_reason: string;
  scheduled_check_time: number;
  window_name: string | null;
  created_at: number;
}

// ============================================================================
// Bulk Operations Types
// ============================================================================

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  target_ids: number[];
}

export interface BulkTogglePayload {
  target_ids: number[];
  enabled: boolean;
}

export interface BulkUpdatePayload {
  target_ids: number[];
  updates: Partial<{
    interval_min: number;
    check_mode: CheckMode;
    expected_status: number;
    state: string;
  }>;
}

export interface BulkDeletePayload {
  target_ids: number[];
}

export interface BulkDeleteResult {
  deleted: number;
  failed: number;
  errors: string[];
}

export interface BulkExportFormat {
  format: 'csv' | 'json';
  filters?: {
    state?: string;
    enabled?: boolean;
    check_mode?: CheckMode;
  };
}

// ============================================================================
// Health Check Templates Types
// ============================================================================

export type TemplateCategory = 'government-portal' | 'api-service' | 'cms' | 'custom';

export interface CheckTemplate {
  id: number;
  name: string;
  description: string | null;
  category: TemplateCategory | null;
  check_mode: CheckMode;
  expected_status: number;
  allowed_status_codes: string | null;  // JSON
  json_path: string | null;
  expected_json_value: string | null;
  text_match: string | null;
  default_interval_min: number;
  is_system_template: number;
  usage_count: number;
  created_at: number;
  updated_at: number;
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  category?: TemplateCategory;
  check_mode: CheckMode;
  expected_status?: number;
  allowed_status_codes?: number[];
  json_path?: string;
  expected_json_value?: string;
  text_match?: string;
  default_interval_min?: number;
}

export interface TargetTemplateMapping {
  id: number;
  target_id: number;
  template_id: number;
  applied_at: number;
}

export interface ApplyTemplatePayload {
  template_id: number;
}

// ============================================================================
// GDPR Compliance Types
// ============================================================================

export interface RetentionPolicy {
  id: number;
  checks_retention_days: number;
  failed_checks_retention_days: number;
  audit_log_retention_days: number;
  alert_history_retention_days: number;
  auto_cleanup_enabled: number;
  last_cleanup_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface UpdateRetentionPolicyPayload {
  checks_retention_days?: number;
  failed_checks_retention_days?: number;
  audit_log_retention_days?: number;
  alert_history_retention_days?: number;
  auto_cleanup_enabled?: boolean;
}

export type DataExportType = 'full' | 'targets' | 'checks' | 'alerts' | 'audit';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ExportFormat = 'json' | 'csv';

export interface DataExportRequest {
  id: number;
  request_type: DataExportType;
  status: ExportStatus;
  target_ids: string | null;  // JSON
  date_range_start: number | null;
  date_range_end: number | null;
  export_url: string | null;
  export_size_bytes: number | null;
  export_format: ExportFormat;
  export_filename: string | null;
  requested_by: string | null;
  ip_address: string | null;
  created_at: number;
  completed_at: number | null;
  error_message: string | null;
}

export interface CreateExportRequestPayload {
  request_type: DataExportType;
  target_ids?: number[];
  date_range_start?: number;
  date_range_end?: number;
  export_format?: ExportFormat;
}

export interface GdprConsent {
  id: number;
  user_identifier: string;
  analytics_consent: number;
  marketing_consent: number;
  data_processing_consent: number;
  consent_given_at: number;
  consent_withdrawn_at: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
  updated_at: number;
}

export type DeletionScope = 'target' | 'state' | 'all_checks' | 'user_data';
export type DeletionStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';

export interface DataDeletionRequest {
  id: number;
  deletion_scope: DeletionScope;
  target_id: number | null;
  state: string | null;
  user_identifier: string | null;
  status: DeletionStatus;
  requested_by: string;
  approved_by: string | null;
  rejection_reason: string | null;
  deleted_targets_count: number;
  deleted_checks_count: number;
  deleted_alerts_count: number;
  deleted_audit_logs_count: number;
  created_at: number;
  approved_at: number | null;
  completed_at: number | null;
}

export interface CreateDeletionRequestPayload {
  deletion_scope: DeletionScope;
  target_id?: number;
  state?: string;
  user_identifier?: string;
}

export interface DeletionResult {
  targets_deleted: number;
  checks_deleted: number;
  alerts_deleted: number;
  audit_logs_deleted: number;
}

export interface CleanupReport {
  checks_deleted: number;
  failed_checks_deleted: number;
  audit_logs_deleted: number;
  alerts_deleted: number;
  total_deleted: number;
  execution_time_ms: number;
}

// ============================================================================
// User Authentication Types (Google OAuth)
// ============================================================================

export type UserRole = 'user' | 'moderator' | 'admin' | 'government';

export interface User {
  id: number;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  reputation_score: number;
  is_banned: number;
  ban_reason: string | null;
  banned_at: number | null;
  banned_by: number | null;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export interface UserSession {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
  last_activity_at: number;
}

export interface UserIPLog {
  id: number;
  user_id: number;
  ip_address: string;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  metadata: string | null;
  created_at: number;
}

export interface PublicUser {
  id: number;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  reputation_score: number;
  created_at: number;
}

// ============================================================================
// Community Submission Types
// ============================================================================

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type PortalCategory = 'central' | 'identity' | 'financial' | 'transport' | 'utilities' | 'health' | 'business' | 'passport' | 'transparency' | 'education' | 'tender' | 'other';

export interface Submission {
  id: number;
  user_id: number;
  name: string;
  url: string;
  hostname: string;
  state: string | null;
  category: PortalCategory;
  justification: string;
  status: SubmissionStatus;
  reviewed_by: number | null;
  reviewed_at: number | null;
  review_notes: string | null;
  target_id: number | null;
  created_at: number;
  updated_at: number;
}

export interface CreateSubmissionPayload {
  name: string;
  url: string;
  state?: string;
  category: PortalCategory;
  justification: string;
}

// ============================================================================
// Issue Reporting Types
// ============================================================================

export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'wont_fix' | 'duplicate';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueCategory = 'downtime' | 'slow_performance' | 'broken_functionality' | 'security_concern' | 'accessibility' | 'data_issue' | 'other';

export interface Issue {
  id: number;
  target_id: number;
  user_id: number;
  title: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  screenshot_url: string | null;
  government_response: string | null;
  government_responded_by: number | null;
  government_responded_at: number | null;
  upvotes: number;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
  resolved_by: number | null;
}

export interface IssueComment {
  id: number;
  issue_id: number;
  user_id: number;
  content: string;
  is_government_response: number;
  created_at: number;
  updated_at: number;
}

export interface IssueScreenshot {
  id: number;
  issue_id: number;
  url: string;
  filename: string;
  size_bytes: number;
  created_at: number;
}

export interface CreateIssuePayload {
  target_id: number;
  title: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
}

export interface CreateIssueCommentPayload {
  content: string;
}

// ============================================================================
// Ranking System Types
// ============================================================================

export type RankingPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface StateRanking {
  id: number;
  state: string;
  period: RankingPeriod;
  period_start: number;
  period_end: number;
  rank: number;
  previous_rank: number | null;
  rank_change: number;
  score: number;
  uptime_percentage: number;
  avg_latency_ms: number;
  issue_resolution_rate: number;
  portal_coverage: number;
  created_at: number;
}

export interface RankingMethodology {
  id: number;
  version: number;
  uptime_weight: number;
  latency_weight: number;
  issue_resolution_weight: number;
  coverage_weight: number;
  description: string;
  effective_from: number;
  created_at: number;
}

export interface RankingSuggestion {
  id: number;
  user_id: number;
  suggestion: string;
  status: 'pending' | 'accepted' | 'rejected';
  admin_response: string | null;
  created_at: number;
  reviewed_at: number | null;
}

// ============================================================================
// Government Integration Types
// ============================================================================

export interface GovernmentDepartment {
  id: number;
  name: string;
  state: string | null;
  email_domain: string;
  verified: number;
  created_at: number;
  updated_at: number;
}

export interface GovernmentVerification {
  id: number;
  user_id: number;
  department_id: number;
  verification_code: string;
  verified: number;
  verified_at: number | null;
  created_at: number;
  expires_at: number;
}

export type AppealType = 'status_dispute' | 'data_correction' | 'removal_request';
export type AppealStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export interface ApiAppeal {
  id: number;
  user_id: number;
  target_id: number;
  appeal_type: AppealType;
  reason: string;
  evidence_url: string | null;
  status: AppealStatus;
  admin_response: string | null;
  created_at: number;
  reviewed_at: number | null;
  reviewed_by: number | null;
}
