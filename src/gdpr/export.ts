/**
 * GDPR Data Export
 * Handles data export requests for GDPR Article 15 (Right of Access)
 */

import { DataExportRequest, CreateExportRequestPayload, DataExportType } from '../types';

/**
 * Create a new export request
 */
export async function createExportRequest(
  payload: CreateExportRequestPayload,
  requestedBy: string,
  ipAddress: string | null,
  db: D1Database
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(`
      INSERT INTO data_export_requests (
        request_type, status, target_ids, date_range_start, date_range_end,
        export_format, requested_by, ip_address, created_at
      ) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      payload.request_type,
      payload.target_ids ? JSON.stringify(payload.target_ids) : null,
      payload.date_range_start || null,
      payload.date_range_end || null,
      payload.export_format || 'json',
      requestedBy,
      ipAddress,
      now
    )
    .run();

  return result.meta.last_row_id as number;
}

/**
 * Get export request by ID
 */
export async function getExportRequest(
  requestId: number,
  db: D1Database
): Promise<DataExportRequest | null> {
  const request = await db
    .prepare('SELECT * FROM data_export_requests WHERE id = ?')
    .bind(requestId)
    .first<DataExportRequest>();

  return request || null;
}

/**
 * List export requests
 */
export async function listExportRequests(
  requestedBy: string | null,
  status: string | null,
  limit: number,
  db: D1Database
): Promise<DataExportRequest[]> {
  let query = 'SELECT * FROM data_export_requests WHERE 1=1';
  const bindings: any[] = [];

  if (requestedBy) {
    query += ' AND requested_by = ?';
    bindings.push(requestedBy);
  }

  if (status) {
    query += ' AND status = ?';
    bindings.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(limit);

  const results = await db.prepare(query).bind(...bindings).all<DataExportRequest>();

  return results.results || [];
}

/**
 * Process pending export requests
 */
export async function processExportRequests(db: D1Database, env: any): Promise<void> {
  // Get pending requests
  const requests = await db
    .prepare(`
      SELECT * FROM data_export_requests
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
    `)
    .all<DataExportRequest>();

  if (!requests.results || requests.results.length === 0) {
    return;
  }

  for (const request of requests.results) {
    try {
      // Mark as processing
      await db
        .prepare('UPDATE data_export_requests SET status = ? WHERE id = ?')
        .bind('processing', request.id)
        .run();

      // Generate export
      const exportData = await generateExport(request, db);

      const now = Math.floor(Date.now() / 1000);
      const filename = `export-${request.id}-${now}.${request.export_format}`;

      // In a real implementation, you would upload to R2 or similar storage
      // For now, we'll store a placeholder URL
      const exportUrl = `/exports/${filename}`;

      // Mark as completed
      await db
        .prepare(`
          UPDATE data_export_requests SET
            status = 'completed',
            export_url = ?,
            export_filename = ?,
            export_size_bytes = ?,
            completed_at = ?
          WHERE id = ?
        `)
        .bind(
          exportUrl,
          filename,
          exportData.length,
          now,
          request.id
        )
        .run();

      console.log(`Completed export request ${request.id}`);
    } catch (error: any) {
      console.error(`Error processing export request ${request.id}:`, error);

      // Mark as failed
      await db
        .prepare(`
          UPDATE data_export_requests SET
            status = 'failed',
            error_message = ?
          WHERE id = ?
        `)
        .bind(error.message || 'Unknown error', request.id)
        .run();
    }
  }
}

/**
 * Generate export data based on request type
 */
export async function generateExport(
  request: DataExportRequest,
  db: D1Database
): Promise<string> {
  const exportData: any = {
    export_id: request.id,
    export_type: request.request_type,
    generated_at: new Date().toISOString(),
    data: {},
  };

  switch (request.request_type) {
    case 'full':
      exportData.data.targets = await exportTargets(request, db);
      exportData.data.checks = await exportChecks(request, db);
      exportData.data.alerts = await exportAlerts(request, db);
      exportData.data.audit_logs = await exportAuditLogs(request, db);
      break;

    case 'targets':
      exportData.data.targets = await exportTargets(request, db);
      break;

    case 'checks':
      exportData.data.checks = await exportChecks(request, db);
      break;

    case 'alerts':
      exportData.data.alerts = await exportAlerts(request, db);
      break;

    case 'audit':
      exportData.data.audit_logs = await exportAuditLogs(request, db);
      break;

    default:
      throw new Error(`Unknown export type: ${request.request_type}`);
  }

  if (request.export_format === 'json') {
    return JSON.stringify(exportData, null, 2);
  } else {
    // CSV format - would need more complex conversion
    // For simplicity, return JSON for now
    return JSON.stringify(exportData, null, 2);
  }
}

/**
 * Export targets
 */
async function exportTargets(request: DataExportRequest, db: D1Database): Promise<any[]> {
  let query = 'SELECT * FROM targets WHERE 1=1';
  const bindings: any[] = [];

  if (request.target_ids) {
    try {
      const targetIds = JSON.parse(request.target_ids);
      const placeholders = targetIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      bindings.push(...targetIds);
    } catch (e) {
      // Invalid JSON, skip filter
    }
  }

  const results = await db.prepare(query).bind(...bindings).all();
  return results.results || [];
}

/**
 * Export checks
 */
async function exportChecks(request: DataExportRequest, db: D1Database): Promise<any[]> {
  let query = 'SELECT * FROM checks WHERE 1=1';
  const bindings: any[] = [];

  if (request.target_ids) {
    try {
      const targetIds = JSON.parse(request.target_ids);
      const placeholders = targetIds.map(() => '?').join(',');
      query += ` AND target_id IN (${placeholders})`;
      bindings.push(...targetIds);
    } catch (e) {
      // Invalid JSON, skip filter
    }
  }

  if (request.date_range_start) {
    query += ' AND ts >= ?';
    bindings.push(request.date_range_start);
  }

  if (request.date_range_end) {
    query += ' AND ts <= ?';
    bindings.push(request.date_range_end);
  }

  query += ' ORDER BY ts DESC LIMIT 10000'; // Limit to prevent huge exports

  const results = await db.prepare(query).bind(...bindings).all();
  return results.results || [];
}

/**
 * Export alerts
 */
async function exportAlerts(request: DataExportRequest, db: D1Database): Promise<any[]> {
  let query = 'SELECT * FROM alert_history WHERE 1=1';
  const bindings: any[] = [];

  if (request.target_ids) {
    try {
      const targetIds = JSON.parse(request.target_ids);
      const placeholders = targetIds.map(() => '?').join(',');
      query += ` AND target_id IN (${placeholders})`;
      bindings.push(...targetIds);
    } catch (e) {
      // Invalid JSON, skip filter
    }
  }

  if (request.date_range_start) {
    query += ' AND created_at >= ?';
    bindings.push(request.date_range_start);
  }

  if (request.date_range_end) {
    query += ' AND created_at <= ?';
    bindings.push(request.date_range_end);
  }

  query += ' ORDER BY created_at DESC LIMIT 5000';

  const results = await db.prepare(query).bind(...bindings).all();
  return results.results || [];
}

/**
 * Export audit logs
 */
async function exportAuditLogs(request: DataExportRequest, db: D1Database): Promise<any[]> {
  let query = 'SELECT * FROM auth_audit_log WHERE 1=1';
  const bindings: any[] = [];

  if (request.date_range_start) {
    query += ' AND created_at >= ?';
    bindings.push(request.date_range_start);
  }

  if (request.date_range_end) {
    query += ' AND created_at <= ?';
    bindings.push(request.date_range_end);
  }

  query += ' ORDER BY created_at DESC LIMIT 5000';

  const results = await db.prepare(query).bind(...bindings).all();
  return results.results || [];
}
