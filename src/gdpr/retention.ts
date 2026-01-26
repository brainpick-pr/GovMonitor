/**
 * GDPR Data Retention
 * Handles data retention policies and automatic cleanup
 */

import { RetentionPolicy, CleanupReport, UpdateRetentionPolicyPayload } from '../types';

/**
 * Get current retention policy
 */
export async function getRetentionPolicy(db: D1Database): Promise<RetentionPolicy | null> {
  const policy = await db
    .prepare('SELECT * FROM retention_policies WHERE id = 1')
    .first<RetentionPolicy>();

  return policy || null;
}

/**
 * Update retention policy
 */
export async function updateRetentionPolicy(
  payload: UpdateRetentionPolicyPayload,
  db: D1Database
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const setClauses: string[] = [];
  const bindings: any[] = [];

  if (payload.checks_retention_days !== undefined) {
    setClauses.push('checks_retention_days = ?');
    bindings.push(payload.checks_retention_days);
  }

  if (payload.failed_checks_retention_days !== undefined) {
    setClauses.push('failed_checks_retention_days = ?');
    bindings.push(payload.failed_checks_retention_days);
  }

  if (payload.audit_log_retention_days !== undefined) {
    setClauses.push('audit_log_retention_days = ?');
    bindings.push(payload.audit_log_retention_days);
  }

  if (payload.alert_history_retention_days !== undefined) {
    setClauses.push('alert_history_retention_days = ?');
    bindings.push(payload.alert_history_retention_days);
  }

  if (payload.auto_cleanup_enabled !== undefined) {
    setClauses.push('auto_cleanup_enabled = ?');
    bindings.push(payload.auto_cleanup_enabled ? 1 : 0);
  }

  setClauses.push('updated_at = ?');
  bindings.push(now);

  await db
    .prepare(`UPDATE retention_policies SET ${setClauses.join(', ')} WHERE id = 1`)
    .bind(...bindings)
    .run();
}

/**
 * Run data cleanup based on retention policies
 */
export async function runDataCleanup(
  db: D1Database,
  env: any
): Promise<CleanupReport> {
  const startTime = Date.now();
  const report: CleanupReport = {
    checks_deleted: 0,
    failed_checks_deleted: 0,
    audit_logs_deleted: 0,
    alerts_deleted: 0,
    total_deleted: 0,
    execution_time_ms: 0,
  };

  try {
    const policy = await getRetentionPolicy(db);
    if (!policy || !policy.auto_cleanup_enabled) {
      console.log('Data cleanup is disabled');
      return report;
    }

    const now = Math.floor(Date.now() / 1000);

    // 1. Delete old successful checks
    const successfulChecksCutoff = now - policy.checks_retention_days * 24 * 60 * 60;
    const successfulChecksResult = await db
      .prepare(`
        DELETE FROM checks
        WHERE ok = 1 AND ts < ?
      `)
      .bind(successfulChecksCutoff)
      .run();

    report.checks_deleted = successfulChecksResult.meta.changes || 0;

    // 2. Delete old failed checks (different retention period)
    const failedChecksCutoff = now - policy.failed_checks_retention_days * 24 * 60 * 60;
    const failedChecksResult = await db
      .prepare(`
        DELETE FROM checks
        WHERE ok = 0 AND ts < ?
      `)
      .bind(failedChecksCutoff)
      .run();

    report.failed_checks_deleted = failedChecksResult.meta.changes || 0;

    // 3. Delete old audit logs
    const auditLogCutoff = now - policy.audit_log_retention_days * 24 * 60 * 60;
    const auditLogResult = await db
      .prepare(`
        DELETE FROM auth_audit_log
        WHERE created_at < ?
      `)
      .bind(auditLogCutoff)
      .run();

    report.audit_logs_deleted = auditLogResult.meta.changes || 0;

    // 4. Delete old alert history
    const alertHistoryCutoff = now - policy.alert_history_retention_days * 24 * 60 * 60;
    const alertHistoryResult = await db
      .prepare(`
        DELETE FROM alert_history
        WHERE created_at < ?
      `)
      .bind(alertHistoryCutoff)
      .run();

    report.alerts_deleted = alertHistoryResult.meta.changes || 0;

    // Update last cleanup timestamp
    await db
      .prepare('UPDATE retention_policies SET last_cleanup_at = ?, updated_at = ? WHERE id = 1')
      .bind(now, now)
      .run();

    report.total_deleted =
      report.checks_deleted +
      report.failed_checks_deleted +
      report.audit_logs_deleted +
      report.alerts_deleted;

    report.execution_time_ms = Date.now() - startTime;

    console.log(
      `Data cleanup completed: ${report.total_deleted} records deleted (${report.checks_deleted} checks, ${report.failed_checks_deleted} failed checks, ${report.audit_logs_deleted} audit logs, ${report.alerts_deleted} alerts) in ${report.execution_time_ms}ms`
    );

    return report;
  } catch (error) {
    console.error('Error during data cleanup:', error);
    throw error;
  }
}

/**
 * Get cleanup preview (what would be deleted)
 */
export async function getCleanupPreview(db: D1Database): Promise<{
  checks_to_delete: number;
  failed_checks_to_delete: number;
  audit_logs_to_delete: number;
  alerts_to_delete: number;
  total: number;
}> {
  const policy = await getRetentionPolicy(db);
  if (!policy) {
    return {
      checks_to_delete: 0,
      failed_checks_to_delete: 0,
      audit_logs_to_delete: 0,
      alerts_to_delete: 0,
      total: 0,
    };
  }

  const now = Math.floor(Date.now() / 1000);

  // Count successful checks to delete
  const successfulChecksCutoff = now - policy.checks_retention_days * 24 * 60 * 60;
  const checksCount = await db
    .prepare('SELECT COUNT(*) as count FROM checks WHERE ok = 1 AND ts < ?')
    .bind(successfulChecksCutoff)
    .first<{ count: number }>();

  // Count failed checks to delete
  const failedChecksCutoff = now - policy.failed_checks_retention_days * 24 * 60 * 60;
  const failedChecksCount = await db
    .prepare('SELECT COUNT(*) as count FROM checks WHERE ok = 0 AND ts < ?')
    .bind(failedChecksCutoff)
    .first<{ count: number }>();

  // Count audit logs to delete
  const auditLogCutoff = now - policy.audit_log_retention_days * 24 * 60 * 60;
  const auditLogsCount = await db
    .prepare('SELECT COUNT(*) as count FROM auth_audit_log WHERE created_at < ?')
    .bind(auditLogCutoff)
    .first<{ count: number }>();

  // Count alerts to delete
  const alertHistoryCutoff = now - policy.alert_history_retention_days * 24 * 60 * 60;
  const alertsCount = await db
    .prepare('SELECT COUNT(*) as count FROM alert_history WHERE created_at < ?')
    .bind(alertHistoryCutoff)
    .first<{ count: number }>();

  return {
    checks_to_delete: checksCount?.count || 0,
    failed_checks_to_delete: failedChecksCount?.count || 0,
    audit_logs_to_delete: auditLogsCount?.count || 0,
    alerts_to_delete: alertsCount?.count || 0,
    total:
      (checksCount?.count || 0) +
      (failedChecksCount?.count || 0) +
      (auditLogsCount?.count || 0) +
      (alertsCount?.count || 0),
  };
}
