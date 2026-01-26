/**
 * GovMonitor.Org - Cloudflare Worker
 * Uptime monitoring for government websites
 *
 * Main entry point - now modularized for better maintainability
 */

import type { Env, Target } from './types';
import { VALIDATION } from './constants';
import { handleGetStatus } from './handlers/status';
import { handleGetHistory } from './handlers/history';
import { handleGetTargets, handleAddTarget, handleDeleteTarget } from './handlers/targets';
import { handleGetConfig, handleUpdateConfig } from './handlers/config';
import { handleManualCheck } from './handlers/check';
import { handleGetStateSummary } from './handlers/state-summary';
import {
  handleGetAlerts,
  handleGetAlertConfig,
  handleUpdateAlertConfig,
  handleGetAlertChannels,
  handleAddAlertChannel,
  handleDeleteAlertChannel
} from './handlers/alerts';
import { runBackfillCheck } from './checks/backfill';
import { checkTarget } from './checks/checker';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes
      if (url.pathname === '/api/status') {
        return await handleGetStatus(env, corsHeaders);
      }

      if (url.pathname === '/api/history') {
        const targetId = url.searchParams.get('targetId');
        const window = url.searchParams.get('window') || '24h';
        return await handleGetHistory(env, targetId, window, corsHeaders);
      }

      if (url.pathname === '/api/targets' && request.method === 'GET') {
        return await handleGetTargets(env, corsHeaders);
      }

      if (url.pathname === '/api/targets' && request.method === 'POST') {
        return await handleAddTarget(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/targets/') && request.method === 'DELETE') {
        const id = url.pathname.split('/')[3];
        return await handleDeleteTarget(id, env, corsHeaders);
      }

      if (url.pathname === '/api/config' && request.method === 'GET') {
        return await handleGetConfig(env, corsHeaders);
      }

      if (url.pathname === '/api/config' && request.method === 'PUT') {
        return await handleUpdateConfig(request, env, corsHeaders);
      }

      if (url.pathname === '/api/check' && request.method === 'POST') {
        return await handleManualCheck(request, env, corsHeaders);
      }

      if (url.pathname === '/api/state-summary' && request.method === 'GET') {
        const window = url.searchParams.get('window') || '24h';
        return await handleGetStateSummary(env, window, corsHeaders);
      }

      // Alert API routes
      if (url.pathname === '/api/alerts' && request.method === 'GET') {
        return await handleGetAlerts(env, url.searchParams, corsHeaders);
      }

      if (url.pathname.startsWith('/api/alerts/config/') && request.method === 'GET') {
        const targetId = url.pathname.split('/')[4];
        return await handleGetAlertConfig(env, targetId, corsHeaders);
      }

      if (url.pathname.startsWith('/api/alerts/config/') && request.method === 'PUT') {
        const targetId = url.pathname.split('/')[4];
        return await handleUpdateAlertConfig(request, env, targetId, corsHeaders);
      }

      if (url.pathname === '/api/alerts/channels' && request.method === 'GET') {
        return await handleGetAlertChannels(env, corsHeaders);
      }

      if (url.pathname === '/api/alerts/channels' && request.method === 'POST') {
        return await handleAddAlertChannel(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/alerts/channels/') && request.method === 'DELETE') {
        const channelId = url.pathname.split('/')[4];
        return await handleDeleteAlertChannel(env, channelId, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal Server Error', details: (error as Error).message }),
        { status: 500, headers: corsHeaders }
      );
    }
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    const cronMinute = new Date(event.scheduledTime).getMinutes();
    console.log('Cron trigger fired:', new Date(event.scheduledTime).toISOString());

    try {
      const now = Math.floor(Date.now() / 1000);

      // Run backfill check on the hour (minute 0) to catch missed checks
      if (cronMinute === 0) {
        await runBackfillCheck(env, now);
      }

      // Get all targets that need checking
      const targets = await env.DB.prepare(
        'SELECT * FROM targets WHERE enabled = 1 AND next_check_at <= ?'
      ).bind(now).all<Target>();

      if (!targets.results || targets.results.length === 0) {
        console.log('No targets to check');
        return;
      }

      console.log(`Checking ${targets.results.length} targets`);

      // Batch targets in groups of 25 to respect execution limits
      const batches: Target[][] = [];
      for (let i = 0; i < targets.results.length; i += VALIDATION.BATCH_SIZE) {
        batches.push(targets.results.slice(i, i + VALIDATION.BATCH_SIZE));
      }

      // Process each batch with Promise.allSettled to prevent single failures from aborting
      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map(target => checkTarget(target, env))
        );

        // Log any failures
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            console.error(`Failed to check ${batch[idx].url}:`, result.reason);
          }
        });
      }

      // Update last run timestamp
      await env.DB.prepare(
        'UPDATE config SET last_run_at = ?, updated_at = ? WHERE id = 1'
      ).bind(now, now).run();

      console.log('Cron job completed successfully');
    } catch (error) {
      console.error('Cron job error:', error);
    }
  },
};
