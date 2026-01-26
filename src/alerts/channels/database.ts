/**
 * Database alert channel
 * Logs alerts to the alert_history table
 */

import type { Target, AlertCondition } from '../../types';

/**
 * Log alert to database
 * @returns Alert ID if successful, null otherwise
 */
export async function logAlertToDatabase(
  alert: AlertCondition,
  target: Target,
  checkId: number,
  db: D1Database
): Promise<number | null> {
  try {
    const now = Math.floor(Date.now() / 1000);

    const result = await db.prepare(`
      INSERT INTO alert_history (
        target_id,
        alert_type,
        severity,
        message,
        metadata,
        check_id,
        dispatched,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      RETURNING id
    `).bind(
      target.id,
      alert.type,
      alert.severity,
      alert.message,
      JSON.stringify(alert.metadata),
      checkId,
      now
    ).first<{ id: number }>();

    if (result && result.id) {
      return result.id;
    }

    return null;
  } catch (error) {
    console.error('Failed to log alert to database:', error);
    return null;
  }
}
