/**
 * Maintenance Windows Logic
 * Handles scheduled maintenance periods to suppress checks and alerts
 */

import { MaintenanceWindow, RecurrenceConfig, RecurrenceType } from '../types';

/**
 * Check if a target is currently in a maintenance window
 */
export async function isInMaintenanceWindow(
  targetId: number,
  currentTime: number,
  db: D1Database
): Promise<MaintenanceWindow | null> {
  // Check target-specific windows
  const targetWindow = await db
    .prepare(`
      SELECT * FROM maintenance_windows
      WHERE enabled = 1
        AND target_id = ?
        AND ? BETWEEN start_time AND end_time
      LIMIT 1
    `)
    .bind(targetId, currentTime)
    .first<MaintenanceWindow>();

  if (targetWindow) {
    return targetWindow;
  }

  // Check state-level windows
  const target = await db
    .prepare('SELECT state FROM targets WHERE id = ?')
    .bind(targetId)
    .first<{ state: string }>();

  if (target) {
    const stateWindow = await db
      .prepare(`
        SELECT * FROM maintenance_windows
        WHERE enabled = 1
          AND state = ?
          AND target_id IS NULL
          AND ? BETWEEN start_time AND end_time
        LIMIT 1
      `)
      .bind(target.state, currentTime)
      .first<MaintenanceWindow>();

    if (stateWindow) {
      return stateWindow;
    }
  }

  // Check global windows (no target_id, no state)
  const globalWindow = await db
    .prepare(`
      SELECT * FROM maintenance_windows
      WHERE enabled = 1
        AND target_id IS NULL
        AND state IS NULL
        AND ? BETWEEN start_time AND end_time
      LIMIT 1
    `)
    .bind(currentTime)
    .first<MaintenanceWindow>();

  return globalWindow || null;
}

/**
 * Check if a state is in maintenance
 */
export async function isStateInMaintenance(
  state: string,
  currentTime: number,
  db: D1Database
): Promise<MaintenanceWindow | null> {
  const window = await db
    .prepare(`
      SELECT * FROM maintenance_windows
      WHERE enabled = 1
        AND (state = ? OR (state IS NULL AND target_id IS NULL))
        AND ? BETWEEN start_time AND end_time
      LIMIT 1
    `)
    .bind(state, currentTime)
    .first<MaintenanceWindow>();

  return window || null;
}

/**
 * Get all currently active maintenance windows
 */
export async function getActiveMaintenanceWindows(
  currentTime: number,
  db: D1Database
): Promise<MaintenanceWindow[]> {
  const results = await db
    .prepare(`
      SELECT * FROM maintenance_windows
      WHERE enabled = 1
        AND ? BETWEEN start_time AND end_time
      ORDER BY
        CASE
          WHEN target_id IS NOT NULL THEN 1
          WHEN state IS NOT NULL THEN 2
          ELSE 3
        END
    `)
    .bind(currentTime)
    .all<MaintenanceWindow>();

  return results.results || [];
}

/**
 * Calculate next occurrence for a recurring window
 */
export function getNextOccurrence(
  window: MaintenanceWindow,
  fromTime: number
): number | null {
  if (!window.recurrence || !window.recurrence_config) {
    // Non-recurring window, no next occurrence
    return null;
  }

  let config: RecurrenceConfig;
  try {
    config = JSON.parse(window.recurrence_config);
  } catch (e) {
    console.error('Invalid recurrence config:', window.recurrence_config);
    return null;
  }

  const fromDate = new Date(fromTime * 1000);
  const duration = window.end_time - window.start_time;

  switch (window.recurrence) {
    case 'daily':
      // Next day at same time
      const nextDaily = new Date(fromDate);
      nextDaily.setUTCDate(nextDaily.getUTCDate() + 1);
      if (config.time) {
        const [hours, minutes] = config.time.split(':').map(Number);
        nextDaily.setUTCHours(hours, minutes, 0, 0);
      }
      return Math.floor(nextDaily.getTime() / 1000);

    case 'weekly':
      // Next week on specified day
      if (config.day_of_week === undefined) return null;

      const nextWeekly = new Date(fromDate);
      const currentDay = nextWeekly.getUTCDay();
      const targetDay = config.day_of_week;

      let daysUntilTarget = targetDay - currentDay;
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7; // Next week
      }

      nextWeekly.setUTCDate(nextWeekly.getUTCDate() + daysUntilTarget);

      if (config.time) {
        const [hours, minutes] = config.time.split(':').map(Number);
        nextWeekly.setUTCHours(hours, minutes, 0, 0);
      }

      return Math.floor(nextWeekly.getTime() / 1000);

    case 'monthly':
      // Next month on specified day
      if (config.day_of_month === undefined) return null;

      const nextMonthly = new Date(fromDate);
      nextMonthly.setUTCMonth(nextMonthly.getUTCMonth() + 1);
      nextMonthly.setUTCDate(config.day_of_month);

      if (config.time) {
        const [hours, minutes] = config.time.split(':').map(Number);
        nextMonthly.setUTCHours(hours, minutes, 0, 0);
      }

      return Math.floor(nextMonthly.getTime() / 1000);

    default:
      return null;
  }
}

/**
 * Create recurring window instances
 * For recurring windows, this creates the next instance after the current one ends
 */
export async function createRecurringInstance(
  window: MaintenanceWindow,
  db: D1Database
): Promise<void> {
  if (!window.recurrence) {
    return; // Not a recurring window
  }

  const now = Math.floor(Date.now() / 1000);

  // Only create next instance if current window has ended
  if (window.end_time > now) {
    return;
  }

  const nextStart = getNextOccurrence(window, window.end_time);
  if (!nextStart) {
    return;
  }

  const duration = window.end_time - window.start_time;
  const nextEnd = nextStart + duration;

  // Create new window instance
  await db
    .prepare(`
      INSERT INTO maintenance_windows (
        name, description, target_id, state, start_time, end_time,
        recurrence, recurrence_config, suppress_checks, suppress_alerts,
        created_by, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      window.name,
      window.description,
      window.target_id,
      window.state,
      nextStart,
      nextEnd,
      window.recurrence,
      window.recurrence_config,
      window.suppress_checks,
      window.suppress_alerts,
      window.created_by,
      window.enabled,
      now,
      now
    )
    .run();

  console.log(
    `Created recurring instance of window "${window.name}" for ${new Date(nextStart * 1000).toISOString()}`
  );
}

/**
 * Log a skipped check due to maintenance
 */
export async function logMaintenanceSkip(
  targetId: number,
  windowId: number,
  skipReason: 'maintenance_check_suppressed' | 'maintenance_alert_suppressed',
  scheduledCheckTime: number,
  windowName: string,
  db: D1Database
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(`
      INSERT INTO maintenance_skip_log (
        target_id, window_id, skip_reason, scheduled_check_time, window_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(targetId, windowId, skipReason, scheduledCheckTime, windowName, now)
    .run();
}

/**
 * Get maintenance skip log for a target
 */
export async function getMaintenanceSkipLog(
  targetId: number | null,
  windowId: number | null,
  limit: number,
  db: D1Database
): Promise<any[]> {
  let query = 'SELECT * FROM maintenance_skip_log WHERE 1=1';
  const bindings: any[] = [];

  if (targetId !== null) {
    query += ' AND target_id = ?';
    bindings.push(targetId);
  }

  if (windowId !== null) {
    query += ' AND window_id = ?';
    bindings.push(windowId);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  bindings.push(limit);

  const results = await db.prepare(query).bind(...bindings).all();

  return results.results || [];
}

/**
 * Clean up old one-time maintenance windows
 */
export async function cleanupExpiredWindows(db: D1Database): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - 30 * 24 * 60 * 60; // 30 days ago

  // Delete one-time windows that ended more than 30 days ago
  const result = await db
    .prepare(`
      DELETE FROM maintenance_windows
      WHERE recurrence IS NULL
        AND end_time < ?
    `)
    .bind(cutoff)
    .run();

  const deleted = result.meta.changes || 0;

  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} expired maintenance windows`);
  }

  return deleted;
}

/**
 * Get upcoming maintenance windows for a target
 */
export async function getUpcomingWindows(
  targetId: number | null,
  state: string | null,
  limit: number,
  db: D1Database
): Promise<MaintenanceWindow[]> {
  const now = Math.floor(Date.now() / 1000);
  let query = `
    SELECT * FROM maintenance_windows
    WHERE enabled = 1 AND start_time > ?
  `;
  const bindings: any[] = [now];

  if (targetId !== null) {
    query += ' AND (target_id = ? OR target_id IS NULL)';
    bindings.push(targetId);
  }

  if (state !== null) {
    query += ' AND (state = ? OR state IS NULL)';
    bindings.push(state);
  }

  query += ' ORDER BY start_time ASC LIMIT ?';
  bindings.push(limit);

  const results = await db.prepare(query).bind(...bindings).all<MaintenanceWindow>();

  return results.results || [];
}
