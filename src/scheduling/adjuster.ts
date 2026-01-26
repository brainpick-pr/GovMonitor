/**
 * Smart Scheduling Interval Adjuster
 * Automatically adjusts check intervals based on target reliability
 */

import {
  AdjustmentReport,
  IntervalAdjustment,
  SchedulingMetrics,
} from '../types';
import { getSmartSchedulingConfig, getAdjustmentCandidates } from './metrics';

/**
 * Main smart scheduling logic - runs periodically to adjust intervals
 */
export async function runSmartScheduling(
  db: D1Database,
  env: any
): Promise<AdjustmentReport> {
  const startTime = Date.now();

  const report: AdjustmentReport = {
    total_candidates: 0,
    adjusted: 0,
    increased: 0,
    decreased: 0,
    errors: 0,
    adjustments: [],
  };

  try {
    // Check if smart scheduling is enabled
    const config = await getSmartSchedulingConfig(db);
    if (!config) {
      console.log('Smart scheduling is disabled');
      return report;
    }

    console.log('Running smart scheduling with config:', config);

    // Get adjustment candidates
    const candidates = await getAdjustmentCandidates(db, config);
    report.total_candidates = candidates.length;

    console.log(`Found ${candidates.length} targets eligible for interval adjustment`);

    // Process each candidate
    for (const candidate of candidates) {
      try {
        const adjustment = await adjustTargetInterval(
          candidate.target_id,
          candidate.recommended_interval,
          candidate.reason,
          db
        );

        if (adjustment) {
          report.adjustments.push(adjustment);
          report.adjusted++;

          if (adjustment.new_interval_min > adjustment.old_interval_min) {
            report.increased++;
          } else {
            report.decreased++;
          }

          console.log(
            `Adjusted target ${candidate.target_id}: ${adjustment.old_interval_min}min → ${adjustment.new_interval_min}min (${candidate.reason})`
          );
        }
      } catch (error) {
        console.error(`Error adjusting target ${candidate.target_id}:`, error);
        report.errors++;
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(
      `Smart scheduling completed: ${report.adjusted}/${report.total_candidates} adjusted (${report.increased} increased, ${report.decreased} decreased) in ${executionTime}ms`
    );

    return report;
  } catch (error) {
    console.error('Error in smart scheduling:', error);
    throw error;
  }
}

/**
 * Adjust interval for a single target
 */
export async function adjustTargetInterval(
  targetId: number,
  newInterval: number,
  reason: string,
  db: D1Database
): Promise<IntervalAdjustment | null> {
  const now = Math.floor(Date.now() / 1000);

  try {
    // Get current metrics and target info
    const metrics = await db
      .prepare('SELECT * FROM scheduling_metrics WHERE target_id = ?')
      .bind(targetId)
      .first<SchedulingMetrics>();

    const target = await db
      .prepare('SELECT interval_min FROM targets WHERE id = ?')
      .bind(targetId)
      .first<{ interval_min: number }>();

    if (!metrics || !target) {
      console.warn(`Target ${targetId} or metrics not found`);
      return null;
    }

    const oldInterval = target.interval_min;

    // Don't adjust if already at desired interval
    if (oldInterval === newInterval) {
      return null;
    }

    // Update target interval
    await db
      .prepare('UPDATE targets SET interval_min = ?, updated_at = ? WHERE id = ?')
      .bind(newInterval, now, targetId)
      .run();

    // Update scheduling metrics
    await db
      .prepare(`
        UPDATE scheduling_metrics SET
          current_interval_min = ?,
          recommended_interval_min = ?,
          interval_last_adjusted_at = ?,
          adjustment_reason = ?,
          updated_at = ?
        WHERE target_id = ?
      `)
      .bind(newInterval, newInterval, now, reason, now, targetId)
      .run();

    // Log adjustment history
    const adjustmentResult = await db
      .prepare(`
        INSERT INTO interval_adjustments (
          target_id, old_interval_min, new_interval_min, reason,
          uptime_at_adjustment, consecutive_failures_at_adjustment, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        targetId,
        oldInterval,
        newInterval,
        reason,
        metrics.uptime_percentage,
        metrics.consecutive_failures,
        now
      )
      .run();

    const adjustment: IntervalAdjustment = {
      id: adjustmentResult.meta.last_row_id as number,
      target_id: targetId,
      old_interval_min: oldInterval,
      new_interval_min: newInterval,
      reason,
      uptime_at_adjustment: metrics.uptime_percentage,
      consecutive_failures_at_adjustment: metrics.consecutive_failures,
      created_at: now,
    };

    return adjustment;
  } catch (error) {
    console.error(`Error adjusting interval for target ${targetId}:`, error);
    throw error;
  }
}

/**
 * Get adjustment history for a target
 */
export async function getAdjustmentHistory(
  targetId: number,
  limit: number,
  db: D1Database
): Promise<IntervalAdjustment[]> {
  const results = await db
    .prepare(`
      SELECT * FROM interval_adjustments
      WHERE target_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .bind(targetId, limit)
    .all<IntervalAdjustment>();

  return results.results || [];
}

/**
 * Get metrics for a specific target
 */
export async function getTargetMetrics(
  targetId: number,
  db: D1Database
): Promise<SchedulingMetrics | null> {
  const metrics = await db
    .prepare('SELECT * FROM scheduling_metrics WHERE target_id = ?')
    .bind(targetId)
    .first<SchedulingMetrics>();

  return metrics || null;
}
