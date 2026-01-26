/**
 * Alert dispatcher
 * Routes alerts to configured channels (webhook, email, etc.)
 */

import type { Target, AlertCondition, AlertChannel } from '../types';
import { dispatchWebhook } from './channels/webhook';
import { logAlertToDatabase } from './channels/database';
import { isInMaintenanceWindow, logMaintenanceSkip } from '../maintenance/windows';

/**
 * Dispatch alerts to all enabled channels
 */
export async function dispatchAlerts(
  alerts: AlertCondition[],
  target: Target,
  checkId: number,
  db: D1Database,
  env: any
): Promise<void> {
  if (alerts.length === 0) return;

  // Check if target is in maintenance window with alert suppression
  const now = Math.floor(Date.now() / 1000);
  const maintenanceWindow = await isInMaintenanceWindow(target.id, now, db);

  if (maintenanceWindow && maintenanceWindow.suppress_alerts) {
    console.log(`Suppressing alerts for ${target.name} - in maintenance window: ${maintenanceWindow.name}`);

    // Log the suppression for each alert
    for (const alert of alerts) {
      await logMaintenanceSkip(
        target.id,
        maintenanceWindow.id,
        'maintenance_alert_suppressed',
        now,
        maintenanceWindow.name,
        db
      );
    }

    return; // Don't dispatch alerts during maintenance
  }

  // Get all enabled alert channels
  const channelsResult = await db.prepare(`
    SELECT * FROM alert_channels WHERE enabled = 1
  `).all<AlertChannel>();

  const channels = channelsResult.results || [];

  for (const alert of alerts) {
    // First, log alert to database
    const alertId = await logAlertToDatabase(alert, target, checkId, db);

    if (!alertId) {
      console.error('Failed to log alert to database');
      continue;
    }

    // Then dispatch to external channels
    const dispatchedChannels: string[] = [];

    for (const channel of channels) {
      try {
        let success = false;

        switch (channel.type) {
          case 'webhook':
            success = await dispatchWebhook(alert, target, channel, env);
            break;
          case 'email':
            // TODO: Implement email channel
            console.log('Email channel not yet implemented');
            break;
          default:
            console.warn(`Unknown channel type: ${channel.type}`);
        }

        if (success) {
          dispatchedChannels.push(channel.name);
        }
      } catch (error) {
        console.error(`Failed to dispatch alert to ${channel.name}:`, error);
      }
    }

    // Mark alert as dispatched and update channels list
    if (dispatchedChannels.length > 0) {
      const now = Math.floor(Date.now() / 1000);
      await db.prepare(`
        UPDATE alert_history
        SET dispatched = 1, dispatched_at = ?, channels = ?
        WHERE id = ?
      `).bind(now, JSON.stringify(dispatchedChannels), alertId).run();

      console.log(`Alert dispatched to ${dispatchedChannels.length} channels:`, dispatchedChannels);
    }
  }
}
