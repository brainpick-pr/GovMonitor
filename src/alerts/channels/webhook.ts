/**
 * Webhook alert channel
 * Sends alerts via HTTP POST to configured webhook URLs
 */

import type { Target, AlertCondition, AlertChannel } from '../../types';

export async function dispatchWebhook(
  alert: AlertCondition,
  target: Target,
  channel: AlertChannel,
  env: any
): Promise<boolean> {
  const config = JSON.parse(channel.config);

  if (!config.url) {
    console.error(`Webhook channel ${channel.name} is missing URL configuration`);
    return false;
  }

  const payload = {
    alert_type: alert.type,
    severity: alert.severity,
    target: {
      id: target.id,
      name: target.name,
      url: target.url,
      state: target.state,
      hostname: target.hostname,
    },
    message: alert.message,
    metadata: alert.metadata,
    timestamp: Date.now(),
    environment: env.ENVIRONMENT || 'production',
  };

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GovMonitorBot/1.0 (Alert)',
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Webhook ${channel.name} returned ${response.status}: ${await response.text()}`);
      return false;
    }

    console.log(`Webhook ${channel.name} dispatched successfully`);
    return true;
  } catch (error) {
    console.error(`Webhook ${channel.name} dispatch failed:`, error);
    return false;
  }
}
