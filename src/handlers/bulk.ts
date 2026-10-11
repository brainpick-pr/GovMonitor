/**
 * Bulk Operations Handlers
 * Mass target management via CSV/JSON import, batch updates, and exports
 */

import {
  BulkImportResult,
  BulkTogglePayload,
  BulkUpdatePayload,
  BulkDeletePayload,
  BulkDeleteResult,
  AddTargetPayload,
  Target,
} from '../types';
import { isGovernmentDomain, isValidState } from '../utils/validation';

// Indian states for validation
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/**
 * Parse CSV string into array of objects
 */
function parseCSV(csvText: string): Array<Record<string, string>> {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data: any[], headers: string[]): string {
  const csvRows: string[] = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Bulk import targets from CSV or JSON
 */
export async function bulkImportTargets(
  request: Request,
  db: D1Database,
  env: any
): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') || '';
    let targets: AddTargetPayload[] = [];
    let format: 'csv' | 'json' = 'json';

    if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
      // Parse CSV
      format = 'csv';
      const csvText = await request.text();
      const rows = parseCSV(csvText);

      targets = rows.map(row => ({
        name: row.name,
        url: row.url,
        state: row.state || 'Delhi',
        interval_min: parseInt(row.interval_min) || 15,
        check_mode: (row.check_mode as any) || 'website',
        expected_status: parseInt(row.expected_status) || 200,
        allowed_status_codes: row.allowed_status_codes ? JSON.parse(row.allowed_status_codes) : undefined,
        json_path: row.json_path || undefined,
        expected_json_value: row.expected_json_value || undefined,
        text_match: row.text_match || undefined,
      }));
    } else {
      // Parse JSON
      const body = await request.json() as { targets: AddTargetPayload[] };
      targets = body.targets;
    }

    // Validate max limit
    if (targets.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Maximum 500 targets per import' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result: BulkImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      target_ids: [],
    };

    const now = Math.floor(Date.now() / 1000);

    // Process each target
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const rowNumber = i + 2; // +2 for 1-indexed and header row

      try {
        // Validation
        if (!target.name || !target.url) {
          result.errors.push({
            row: rowNumber,
            field: 'name/url',
            message: 'Name and URL are required',
          });
          result.failed++;
          continue;
        }

        // Validate URL format
        let hostname: string;
        try {
          const urlObj = new URL(target.url);
          hostname = urlObj.hostname;
        } catch (e) {
          result.errors.push({
            row: rowNumber,
            field: 'url',
            message: 'Invalid URL format',
          });
          result.failed++;
          continue;
        }

        // Validate government domain
        if (!isGovernmentDomain(hostname)) {
          result.errors.push({
            row: rowNumber,
            field: 'url',
            message: 'Only government domains allowed',
          });
          result.failed++;
          continue;
        }

        // Validate state
        if (target.state && !INDIAN_STATES.includes(target.state)) {
          result.errors.push({
            row: rowNumber,
            field: 'state',
            message: `Invalid state: ${target.state}`,
          });
          result.failed++;
          continue;
        }

        // Insert target
        const insertResult = await db
          .prepare(`
            INSERT INTO targets (
              name, url, hostname, state, interval_min, next_check_at, enabled,
              check_mode, expected_status, allowed_status_codes, json_path,
              expected_json_value, text_match, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            target.name,
            target.url,
            hostname,
            target.state || 'Delhi',
            target.interval_min || 15,
            now,
            target.check_mode || 'website',
            target.expected_status || 200,
            target.allowed_status_codes ? JSON.stringify(target.allowed_status_codes) : null,
            target.json_path || null,
            target.expected_json_value || null,
            target.text_match || null,
            now,
            now
          )
          .run();

        const targetId = insertResult.meta.last_row_id as number;
        result.target_ids.push(targetId);

        // Initialize scheduling metrics
        await db
          .prepare(`
            INSERT INTO scheduling_metrics (target_id, current_interval_min, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `)
          .bind(targetId, target.interval_min || 15, now, now)
          .run();

        result.imported++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          field: 'general',
          message: error.message || 'Unknown error',
        });
        result.failed++;
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Import failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Bulk enable/disable targets
 */
export async function bulkToggleTargets(
  request: Request,
  db: D1Database
): Promise<Response> {
  try {
    const payload = await request.json() as BulkTogglePayload;

    if (!payload.target_ids || payload.target_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'target_ids is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (payload.target_ids.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Maximum 100 targets per operation' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const enabled = payload.enabled ? 1 : 0;

    // Build query with placeholders
    const placeholders = payload.target_ids.map(() => '?').join(',');
    const query = `UPDATE targets SET enabled = ?, updated_at = ? WHERE id IN (${placeholders})`;

    const result = await db
      .prepare(query)
      .bind(enabled, now, ...payload.target_ids)
      .run();

    return new Response(
      JSON.stringify({
        message: `${result.meta.changes} targets ${enabled ? 'enabled' : 'disabled'}`,
        updated: result.meta.changes,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Toggle failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Bulk update target configuration
 */
export async function bulkUpdateTargets(
  request: Request,
  db: D1Database
): Promise<Response> {
  try {
    const payload = await request.json() as BulkUpdatePayload;

    if (!payload.target_ids || payload.target_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'target_ids is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (payload.target_ids.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Maximum 100 targets per operation' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Build dynamic UPDATE query
    const setClauses: string[] = [];
    const bindings: any[] = [];

    if (payload.updates.interval_min !== undefined) {
      setClauses.push('interval_min = ?');
      bindings.push(payload.updates.interval_min);
    }

    if (payload.updates.check_mode !== undefined) {
      setClauses.push('check_mode = ?');
      bindings.push(payload.updates.check_mode);
    }

    if (payload.updates.expected_status !== undefined) {
      setClauses.push('expected_status = ?');
      bindings.push(payload.updates.expected_status);
    }

    if (payload.updates.state !== undefined) {
      if (!INDIAN_STATES.includes(payload.updates.state)) {
        return new Response(
          JSON.stringify({ error: `Invalid state: ${payload.updates.state}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      setClauses.push('state = ?');
      bindings.push(payload.updates.state);
    }

    if (setClauses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No updates specified' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Always update updated_at
    setClauses.push('updated_at = ?');
    bindings.push(now);

    // Build final query
    const placeholders = payload.target_ids.map(() => '?').join(',');
    const query = `UPDATE targets SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`;

    const result = await db
      .prepare(query)
      .bind(...bindings, ...payload.target_ids)
      .run();

    return new Response(
      JSON.stringify({
        message: `${result.meta.changes} targets updated`,
        updated: result.meta.changes,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Update failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Bulk delete targets
 */
export async function bulkDeleteTargets(
  request: Request,
  db: D1Database
): Promise<Response> {
  try {
    const payload = await request.json() as BulkDeletePayload;

    if (!payload.target_ids || payload.target_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'target_ids is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (payload.target_ids.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Maximum 100 targets per operation' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result: BulkDeleteResult = {
      deleted: 0,
      failed: 0,
      errors: [],
    };

    // Delete each target (cascade will handle related records)
    for (const targetId of payload.target_ids) {
      try {
        const deleteResult = await db
          .prepare('DELETE FROM targets WHERE id = ?')
          .bind(targetId)
          .run();

        if (deleteResult.meta.changes && deleteResult.meta.changes > 0) {
          result.deleted++;
        } else {
          result.failed++;
          result.errors.push(`Target ${targetId} not found`);
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Error deleting target ${targetId}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Delete failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Export targets to CSV or JSON
 */
export async function bulkExportTargets(
  db: D1Database,
  format: 'csv' | 'json',
  filters?: { state?: string; enabled?: boolean; check_mode?: string }
): Promise<Response> {
  try {
    let query = 'SELECT * FROM targets WHERE 1=1';
    const bindings: any[] = [];

    if (filters?.state) {
      query += ' AND state = ?';
      bindings.push(filters.state);
    }

    if (filters?.enabled !== undefined) {
      query += ' AND enabled = ?';
      bindings.push(filters.enabled ? 1 : 0);
    }

    if (filters?.check_mode) {
      query += ' AND check_mode = ?';
      bindings.push(filters.check_mode);
    }

    query += ' ORDER BY id ASC';

    const results = await db.prepare(query).bind(...bindings).all<Target>();
    const targets = results.results || [];

    if (format === 'csv') {
      const headers = [
        'id', 'name', 'url', 'hostname', 'state', 'interval_min',
        'enabled', 'check_mode', 'expected_status', 'allowed_status_codes',
        'json_path', 'expected_json_value', 'text_match'
      ];

      const csv = arrayToCSV(targets, headers);

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="targets.csv"',
        },
      });
    } else {
      // JSON format
      return new Response(JSON.stringify({ targets }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="targets.json"',
        },
      });
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Export failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
