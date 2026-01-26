/**
 * Backfill logic for missed checks
 */

import type { Env, Target } from '../types';
import { checkTarget } from './checker';

export async function runBackfillCheck(env: Env, now: number): Promise<void> {
  console.log('Running backfill check for stale targets...');

  // Find targets whose next_check_at is more than 2x their interval in the past
  // This indicates they missed their scheduled check window
  const staleTargets = await env.DB.prepare(`
    SELECT * FROM targets
    WHERE enabled = 1
    AND next_check_at < ? - (interval_min * 60 * 2)
    ORDER BY next_check_at ASC
    LIMIT 50
  `).bind(now).all<Target>();

  if (!staleTargets.results || staleTargets.results.length === 0) {
    console.log('No stale targets found for backfill');
    return;
  }

  console.log(`Found ${staleTargets.results.length} stale targets to backfill`);

  // Log structured output for observability
  console.log(JSON.stringify({
    event: 'backfill_started',
    stale_count: staleTargets.results.length,
    timestamp: new Date().toISOString(),
  }));

  // Reset their next_check_at to now so they get picked up in the regular check
  // Also queue them for immediate checking
  const BATCH_SIZE = 10;
  const batches: Target[][] = [];
  for (let i = 0; i < staleTargets.results.length; i += BATCH_SIZE) {
    batches.push(staleTargets.results.slice(i, i + BATCH_SIZE));
  }

  let checkedCount = 0;
  let failedCount = 0;

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(async (target) => {
        // Update next_check_at to prevent re-queuing on next run
        await env.DB.prepare(
          'UPDATE targets SET next_check_at = ? WHERE id = ?'
        ).bind(now + (target.interval_min * 60), target.id).run();

        // Perform the check
        return checkTarget(target, env);
      })
    );

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        checkedCount++;
      } else {
        failedCount++;
        console.error(`Backfill check failed for ${batch[idx].url}:`, result.reason);
      }
    });
  }

  console.log(JSON.stringify({
    event: 'backfill_completed',
    checked: checkedCount,
    failed: failedCount,
    timestamp: new Date().toISOString(),
  }));

  console.log(`Backfill completed: ${checkedCount} checked, ${failedCount} failed`);
}
