/**
 * GDPR Data Deletion
 * Handles data deletion requests for GDPR Article 17 (Right to Erasure)
 */

import { DataDeletionRequest, CreateDeletionRequestPayload, DeletionResult, DeletionScope } from '../types';

/**
 * Create a new deletion request
 */
export async function createDeletionRequest(
  payload: CreateDeletionRequestPayload,
  requestedBy: string,
  db: D1Database
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  // Validation
  if (payload.deletion_scope === 'target' && !payload.target_id) {
    throw new Error('target_id is required for target deletion scope');
  }

  if (payload.deletion_scope === 'state' && !payload.state) {
    throw new Error('state is required for state deletion scope');
  }

  if (payload.deletion_scope === 'user_data' && !payload.user_identifier) {
    throw new Error('user_identifier is required for user_data deletion scope');
  }

  const result = await db
    .prepare(`
      INSERT INTO data_deletion_requests (
        deletion_scope, target_id, state, user_identifier, status, requested_by, created_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `)
    .bind(
      payload.deletion_scope,
      payload.target_id || null,
      payload.state || null,
      payload.user_identifier || null,
      requestedBy,
      now
    )
    .run();

  return result.meta.last_row_id as number;
}

/**
 * Get deletion request by ID
 */
export async function getDeletionRequest(
  requestId: number,
  db: D1Database
): Promise<DataDeletionRequest | null> {
  const request = await db
    .prepare('SELECT * FROM data_deletion_requests WHERE id = ?')
    .bind(requestId)
    .first<DataDeletionRequest>();

  return request || null;
}

/**
 * List deletion requests
 */
export async function listDeletionRequests(
  status: string | null,
  limit: number,
  db: D1Database
): Promise<DataDeletionRequest[]> {
  let query = 'SELECT * FROM data_deletion_requests WHERE 1=1';
  const bindings: any[] = [];

  if (status) {
    query += ' AND status = ?';
    bindings.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(limit);

  const results = await db.prepare(query).bind(...bindings).all<DataDeletionRequest>();

  return results.results || [];
}

/**
 * Approve a deletion request (admin only)
 */
export async function approveDeletionRequest(
  requestId: number,
  approvedBy: string,
  db: D1Database
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const request = await getDeletionRequest(requestId, db);
  if (!request) {
    throw new Error('Deletion request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Only pending requests can be approved');
  }

  await db
    .prepare(`
      UPDATE data_deletion_requests SET
        status = 'approved',
        approved_by = ?,
        approved_at = ?
      WHERE id = ?
    `)
    .bind(approvedBy, now, requestId)
    .run();
}

/**
 * Reject a deletion request (admin only)
 */
export async function rejectDeletionRequest(
  requestId: number,
  rejectionReason: string,
  db: D1Database
): Promise<void> {
  const request = await getDeletionRequest(requestId, db);
  if (!request) {
    throw new Error('Deletion request not found');
  }

  if (request.status !== 'pending') {
    throw new Error('Only pending requests can be rejected');
  }

  await db
    .prepare(`
      UPDATE data_deletion_requests SET
        status = 'rejected',
        rejection_reason = ?
      WHERE id = ?
    `)
    .bind(rejectionReason, requestId)
    .run();
}

/**
 * Process approved deletion requests
 */
export async function processDeletionRequests(db: D1Database): Promise<void> {
  // Get approved requests
  const requests = await db
    .prepare(`
      SELECT * FROM data_deletion_requests
      WHERE status = 'approved'
      ORDER BY approved_at ASC
      LIMIT 5
    `)
    .all<DataDeletionRequest>();

  if (!requests.results || requests.results.length === 0) {
    return;
  }

  for (const request of requests.results) {
    try {
      // Mark as processing
      await db
        .prepare('UPDATE data_deletion_requests SET status = ? WHERE id = ?')
        .bind('processing', request.id)
        .run();

      // Execute deletion based on scope
      const result = await executeDeletion(request, db);

      const now = Math.floor(Date.now() / 1000);

      // Mark as completed
      await db
        .prepare(`
          UPDATE data_deletion_requests SET
            status = 'completed',
            deleted_targets_count = ?,
            deleted_checks_count = ?,
            deleted_alerts_count = ?,
            deleted_audit_logs_count = ?,
            completed_at = ?
          WHERE id = ?
        `)
        .bind(
          result.targets_deleted,
          result.checks_deleted,
          result.alerts_deleted,
          result.audit_logs_deleted,
          now,
          request.id
        )
        .run();

      console.log(
        `Completed deletion request ${request.id}: ${result.targets_deleted} targets, ${result.checks_deleted} checks, ${result.alerts_deleted} alerts, ${result.audit_logs_deleted} audit logs`
      );
    } catch (error: any) {
      console.error(`Error processing deletion request ${request.id}:`, error);

      // Mark as failed and reject
      await db
        .prepare(`
          UPDATE data_deletion_requests SET
            status = 'rejected',
            rejection_reason = ?
          WHERE id = ?
        `)
        .bind(error.message || 'Deletion failed', request.id)
        .run();
    }
  }
}

/**
 * Execute deletion based on scope
 */
async function executeDeletion(
  request: DataDeletionRequest,
  db: D1Database
): Promise<DeletionResult> {
  const result: DeletionResult = {
    targets_deleted: 0,
    checks_deleted: 0,
    alerts_deleted: 0,
    audit_logs_deleted: 0,
  };

  switch (request.deletion_scope) {
    case 'target':
      if (request.target_id) {
        const targetResult = await deleteTargetData(request.target_id, db);
        result.targets_deleted = targetResult.targets_deleted;
        result.checks_deleted = targetResult.checks_deleted;
        result.alerts_deleted = targetResult.alerts_deleted;
      }
      break;

    case 'state':
      if (request.state) {
        // Get all targets in the state
        const targets = await db
          .prepare('SELECT id FROM targets WHERE state = ?')
          .bind(request.state)
          .all<{ id: number }>();

        for (const target of targets.results || []) {
          const targetResult = await deleteTargetData(target.id, db);
          result.targets_deleted += targetResult.targets_deleted;
          result.checks_deleted += targetResult.checks_deleted;
          result.alerts_deleted += targetResult.alerts_deleted;
        }
      }
      break;

    case 'all_checks':
      // Delete all check data (but keep targets)
      const checksResult = await db.prepare('DELETE FROM checks').run();
      result.checks_deleted = checksResult.meta.changes || 0;
      break;

    case 'user_data':
      if (request.user_identifier) {
        // Delete user-specific data (consents, etc.)
        const consentResult = await db
          .prepare('DELETE FROM gdpr_consents WHERE user_identifier = ?')
          .bind(request.user_identifier)
          .run();

        // Note: This doesn't delete targets/checks since those are system data
        // Only personal user preferences/consents are deleted
      }
      break;

    default:
      throw new Error(`Unknown deletion scope: ${request.deletion_scope}`);
  }

  return result;
}

/**
 * Delete all data for a specific target (cascade)
 */
export async function deleteTargetData(
  targetId: number,
  db: D1Database
): Promise<DeletionResult> {
  const result: DeletionResult = {
    targets_deleted: 0,
    checks_deleted: 0,
    alerts_deleted: 0,
    audit_logs_deleted: 0,
  };

  try {
    // Count checks before deletion
    const checksCount = await db
      .prepare('SELECT COUNT(*) as count FROM checks WHERE target_id = ?')
      .bind(targetId)
      .first<{ count: number }>();

    result.checks_deleted = checksCount?.count || 0;

    // Count alerts before deletion
    const alertsCount = await db
      .prepare('SELECT COUNT(*) as count FROM alert_history WHERE target_id = ?')
      .bind(targetId)
      .first<{ count: number }>();

    result.alerts_deleted = alertsCount?.count || 0;

    // Delete target (cascade will handle related records)
    const targetResult = await db
      .prepare('DELETE FROM targets WHERE id = ?')
      .bind(targetId)
      .run();

    result.targets_deleted = targetResult.meta.changes || 0;

    return result;
  } catch (error) {
    console.error(`Error deleting target ${targetId}:`, error);
    throw error;
  }
}

/**
 * Get deletion preview (what would be deleted)
 */
export async function getDeletionPreview(
  scope: DeletionScope,
  targetId: number | null,
  state: string | null,
  db: D1Database
): Promise<DeletionResult> {
  const preview: DeletionResult = {
    targets_deleted: 0,
    checks_deleted: 0,
    alerts_deleted: 0,
    audit_logs_deleted: 0,
  };

  switch (scope) {
    case 'target':
      if (targetId) {
        const target = await db
          .prepare('SELECT id FROM targets WHERE id = ?')
          .bind(targetId)
          .first();

        if (target) {
          preview.targets_deleted = 1;

          const checksCount = await db
            .prepare('SELECT COUNT(*) as count FROM checks WHERE target_id = ?')
            .bind(targetId)
            .first<{ count: number }>();

          preview.checks_deleted = checksCount?.count || 0;

          const alertsCount = await db
            .prepare('SELECT COUNT(*) as count FROM alert_history WHERE target_id = ?')
            .bind(targetId)
            .first<{ count: number }>();

          preview.alerts_deleted = alertsCount?.count || 0;
        }
      }
      break;

    case 'state':
      if (state) {
        const targets = await db
          .prepare('SELECT id FROM targets WHERE state = ?')
          .bind(state)
          .all<{ id: number }>();

        preview.targets_deleted = targets.results?.length || 0;

        if (targets.results) {
          for (const target of targets.results) {
            const checksCount = await db
              .prepare('SELECT COUNT(*) as count FROM checks WHERE target_id = ?')
              .bind(target.id)
              .first<{ count: number }>();

            preview.checks_deleted += checksCount?.count || 0;

            const alertsCount = await db
              .prepare('SELECT COUNT(*) as count FROM alert_history WHERE target_id = ?')
              .bind(target.id)
              .first<{ count: number }>();

            preview.alerts_deleted += alertsCount?.count || 0;
          }
        }
      }
      break;

    case 'all_checks':
      const checksCount = await db
        .prepare('SELECT COUNT(*) as count FROM checks')
        .first<{ count: number }>();

      preview.checks_deleted = checksCount?.count || 0;
      break;

    default:
      break;
  }

  return preview;
}
