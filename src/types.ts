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
