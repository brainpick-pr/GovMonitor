/**
 * GovMonitor.Org - Cloudflare Worker
 * Uptime monitoring for government websites
 *
 * Main entry point - now modularized for better maintainability
 */

import type { Env, Target } from './types';
import { VALIDATION } from './constants';
import { requireAuth } from './auth';
import { handleGetStatus } from './handlers/status';
import { handleGetHistory } from './handlers/history';
import { handleGetTargets, handleAddTarget, handleDeleteTarget } from './handlers/targets';
import { handleGetConfig, handleUpdateConfig } from './handlers/config';
import { handleManualCheck } from './handlers/check';
import { handleGetStateSummary } from './handlers/state-summary';
import { handleGetStateDailyUptime, handleGetTenderSites } from './handlers/state-daily';
import {
  handleGetAlerts,
  handleGetAlertConfig,
  handleUpdateAlertConfig,
  handleGetAlertChannels,
  handleAddAlertChannel,
  handleDeleteAlertChannel
} from './handlers/alerts';
import {
  handleListApiKeys,
  handleCreateApiKey,
  handleRevokeApiKey,
  handleUpdateApiKey,
  handleRotateApiKey,
  handleGetAuditLog
} from './handlers/auth';
import {
  handleGoogleAuth,
  handleGetCurrentUser,
  handleLogout
} from './handlers/oauth';
import {
  handleListSubmissions,
  handleCreateSubmission,
  handleGetMySubmissions,
  handleGetGuidelines,
  handleVoteSubmission,
  handleApproveSubmission,
  handleRejectSubmission,
  handleGetModerationQueue
} from './handlers/submissions';
import {
  handleListIssues,
  handleGetIssue,
  handleCreateIssue,
  handleGetTargetIssues,
  handleAddComment,
  handleVoteIssue,
  handleGovernmentResponse,
  handleUpdateIssueStatus,
  handleGetAssignedIssues
} from './handlers/issues';
import {
  handleUploadScreenshot,
  handleGetScreenshot,
  handleDeleteScreenshot
} from './handlers/upload';
import {
  handleGetRankings,
  handleGetStateRankingHistory,
  handleGetMethodology,
  handleSubmitSuggestion,
  handleListSuggestions,
  handleUpdateSuggestion,
  handleGetRankingStatistics
} from './handlers/rankings';
import { runScheduledRankings } from './ranking/calculator';
import {
  handleListDepartments,
  handleRequestVerification,
  handleConfirmVerification,
  handleSubmitAppeal,
  handleListAppeals,
  handleUpdateAppeal,
  handleGovernmentDashboard
} from './handlers/government';
import { handleSecurityRequest } from './handlers/security';
import { runBackfillCheck } from './checks/backfill';
import { checkTarget } from './checks/checker';

// Smart Scheduling
import { runSmartScheduling, getTargetMetrics, getAdjustmentHistory } from './scheduling/adjuster';

// Maintenance Windows
import {
  isInMaintenanceWindow,
  getActiveMaintenanceWindows,
  getUpcomingWindows,
  cleanupExpiredWindows,
  getMaintenanceSkipLog
} from './maintenance/windows';

// Bulk Operations
import {
  bulkImportTargets,
  bulkToggleTargets,
  bulkUpdateTargets,
  bulkDeleteTargets,
  bulkExportTargets
} from './handlers/bulk';

// Health Check Templates
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplateToTarget,
  getTargetTemplateHistory
} from './handlers/templates';

// GDPR Features
import { getRetentionPolicy, updateRetentionPolicy, runDataCleanup, getCleanupPreview } from './gdpr/retention';
import {
  createExportRequest,
  getExportRequest,
  listExportRequests,
  processExportRequests
} from './gdpr/export';
import {
  createDeletionRequest,
  getDeletionRequest,
  listDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
  processDeletionRequests,
  getDeletionPreview
} from './gdpr/deletion';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Authentication check
    const authError = await requireAuth(request, env);
    if (authError) {
      // Merge CORS headers with auth error response
      const authResponse = new Response(authError.body, {
        status: authError.status,
        headers: { ...corsHeaders, ...Object.fromEntries(authError.headers) }
      });
      return authResponse;
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

      if (url.pathname === '/api/state-daily' && request.method === 'GET') {
        const state = url.searchParams.get('state');
        const window = url.searchParams.get('window') || '7d';
        return await handleGetStateDailyUptime(env, state, window, corsHeaders);
      }

      if (url.pathname === '/api/tender-sites' && request.method === 'GET') {
        return await handleGetTenderSites(env, corsHeaders);
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

      // ========================================================================
      // User OAuth Routes (Google OAuth)
      // ========================================================================
      if (url.pathname === '/api/auth/google' && request.method === 'POST') {
        return await handleGoogleAuth(request, env, corsHeaders);
      }

      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        return await handleGetCurrentUser(request, env, corsHeaders);
      }

      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        return await handleLogout(request, env, corsHeaders);
      }

      // Authentication API routes (admin only)
      if (url.pathname === '/api/auth/keys' && request.method === 'GET') {
        return await handleListApiKeys(env, corsHeaders);
      }

      if (url.pathname === '/api/auth/keys' && request.method === 'POST') {
        return await handleCreateApiKey(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/auth/keys/') && request.method === 'DELETE') {
        const keyId = url.pathname.split('/')[4];
        return await handleRevokeApiKey(keyId, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/auth/keys/') && request.method === 'PUT') {
        const keyId = url.pathname.split('/')[4];
        return await handleUpdateApiKey(keyId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/auth\/keys\/\d+\/rotate$/) && request.method === 'POST') {
        const keyId = url.pathname.split('/')[4];
        return await handleRotateApiKey(keyId, env, corsHeaders);
      }

      if (url.pathname === '/api/auth/audit' && request.method === 'GET') {
        return await handleGetAuditLog(env, url.searchParams, corsHeaders);
      }

      // ========================================================================
      // Community Submissions API Routes
      // ========================================================================
      if (url.pathname === '/api/submissions' && request.method === 'GET') {
        return await handleListSubmissions(request, env, corsHeaders);
      }

      if (url.pathname === '/api/submissions' && request.method === 'POST') {
        return await handleCreateSubmission(request, env, corsHeaders);
      }

      if (url.pathname === '/api/submissions/mine' && request.method === 'GET') {
        return await handleGetMySubmissions(request, env, corsHeaders);
      }

      if (url.pathname === '/api/submissions/guidelines' && request.method === 'GET') {
        return await handleGetGuidelines(env, corsHeaders);
      }

      if (url.pathname === '/api/submissions/moderation-queue' && request.method === 'GET') {
        return await handleGetModerationQueue(request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/submissions\/\d+\/vote$/) && request.method === 'POST') {
        const submissionId = url.pathname.split('/')[3];
        return await handleVoteSubmission(submissionId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/submissions\/\d+\/approve$/) && request.method === 'PUT') {
        const submissionId = url.pathname.split('/')[3];
        return await handleApproveSubmission(submissionId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/submissions\/\d+\/reject$/) && request.method === 'PUT') {
        const submissionId = url.pathname.split('/')[3];
        return await handleRejectSubmission(submissionId, request, env, corsHeaders);
      }

      // ========================================================================
      // Issue Reporting API Routes
      // ========================================================================
      if (url.pathname === '/api/issues' && request.method === 'GET') {
        return await handleListIssues(request, env, corsHeaders);
      }

      if (url.pathname === '/api/issues' && request.method === 'POST') {
        return await handleCreateIssue(request, env, corsHeaders);
      }

      if (url.pathname === '/api/issues/assigned' && request.method === 'GET') {
        return await handleGetAssignedIssues(request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/issues\/\d+$/) && request.method === 'GET') {
        const issueId = url.pathname.split('/')[3];
        return await handleGetIssue(issueId, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/issues\/\d+\/comments$/) && request.method === 'POST') {
        const issueId = url.pathname.split('/')[3];
        return await handleAddComment(issueId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/issues\/\d+\/vote$/) && request.method === 'POST') {
        const issueId = url.pathname.split('/')[3];
        return await handleVoteIssue(issueId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/issues\/\d+\/respond$/) && request.method === 'PUT') {
        const issueId = url.pathname.split('/')[3];
        return await handleGovernmentResponse(issueId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/issues\/\d+\/status$/) && request.method === 'PUT') {
        const issueId = url.pathname.split('/')[3];
        return await handleUpdateIssueStatus(issueId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/targets\/\d+\/issues$/) && request.method === 'GET') {
        const targetId = url.pathname.split('/')[3];
        return await handleGetTargetIssues(targetId, request, env, corsHeaders);
      }

      // ========================================================================
      // Screenshot Upload API Routes
      // ========================================================================
      if (url.pathname === '/api/upload/screenshot' && request.method === 'POST') {
        return await handleUploadScreenshot(request, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/screenshots/') && request.method === 'GET') {
        const filename = url.pathname.replace('/api/screenshots/', '');
        return await handleGetScreenshot(filename, env, corsHeaders);
      }

      if (url.pathname.startsWith('/api/screenshots/') && request.method === 'DELETE') {
        const filename = url.pathname.replace('/api/screenshots/', '');
        return await handleDeleteScreenshot(filename, request, env, corsHeaders);
      }

      // ========================================================================
      // Ranking System API Routes
      // ========================================================================
      if (url.pathname === '/api/rankings' && request.method === 'GET') {
        return await handleGetRankings(request, env, corsHeaders);
      }

      if (url.pathname === '/api/rankings/methodology' && request.method === 'GET') {
        return await handleGetMethodology(env, corsHeaders);
      }

      if (url.pathname === '/api/rankings/statistics' && request.method === 'GET') {
        return await handleGetRankingStatistics(env, corsHeaders);
      }

      if (url.pathname === '/api/rankings/suggestions' && request.method === 'GET') {
        return await handleListSuggestions(request, env, corsHeaders);
      }

      if (url.pathname === '/api/rankings/suggestions' && request.method === 'POST') {
        return await handleSubmitSuggestion(request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/rankings\/suggestions\/\d+$/) && request.method === 'PUT') {
        const suggestionId = url.pathname.split('/')[4];
        return await handleUpdateSuggestion(suggestionId, request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/rankings\/state\/[^/]+$/) && request.method === 'GET') {
        const state = url.pathname.split('/')[4];
        return await handleGetStateRankingHistory(state, request, env, corsHeaders);
      }

      // ========================================================================
      // Government Integration API Routes
      // ========================================================================
      if (url.pathname === '/api/government/departments' && request.method === 'GET') {
        return await handleListDepartments(request, env, corsHeaders);
      }

      if (url.pathname === '/api/government/verify' && request.method === 'POST') {
        return await handleRequestVerification(request, env, corsHeaders);
      }

      if (url.pathname === '/api/government/verify/confirm' && request.method === 'POST') {
        return await handleConfirmVerification(request, env, corsHeaders);
      }

      if (url.pathname === '/api/government/dashboard' && request.method === 'GET') {
        return await handleGovernmentDashboard(request, env, corsHeaders);
      }

      if (url.pathname === '/api/appeals' && request.method === 'GET') {
        return await handleListAppeals(request, env, corsHeaders);
      }

      if (url.pathname === '/api/appeals' && request.method === 'POST') {
        return await handleSubmitAppeal(request, env, corsHeaders);
      }

      if (url.pathname.match(/^\/api\/appeals\/\d+$/) && request.method === 'PUT') {
        const appealId = url.pathname.split('/')[3];
        return await handleUpdateAppeal(appealId, request, env, corsHeaders);
      }

      // ========================================================================
      // Security Monitoring API Routes (admin only)
      // ========================================================================
      if (url.pathname.startsWith('/api/security')) {
        const response = await handleSecurityRequest(request, env);
        const jsonResponse = new Response(response.body, {
          status: response.status,
          headers: { ...corsHeaders, ...Object.fromEntries(response.headers) }
        });
        return jsonResponse;
      }

      // ========================================================================
      // Smart Scheduling API Routes
      // ========================================================================
      if (url.pathname.match(/^\/api\/scheduling\/metrics\/\d+$/) && request.method === 'GET') {
        const targetId = parseInt(url.pathname.split('/')[4]);
        const metrics = await getTargetMetrics(targetId, env.DB);
        return new Response(JSON.stringify(metrics), { headers: corsHeaders });
      }

      if (url.pathname.match(/^\/api\/scheduling\/adjustments\/\d+$/) && request.method === 'GET') {
        const targetId = parseInt(url.pathname.split('/')[4]);
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const adjustments = await getAdjustmentHistory(targetId, limit, env.DB);
        return new Response(JSON.stringify(adjustments), { headers: corsHeaders });
      }

      if (url.pathname === '/api/config/smart-scheduling' && request.method === 'PUT') {
        const body = await request.json() as any;
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(`
          UPDATE config SET
            smart_scheduling_enabled = ?,
            smart_scheduling_config = ?,
            updated_at = ?
          WHERE id = 1
        `).bind(body.enabled ? 1 : 0, JSON.stringify(body.config), now).run();
        return new Response(JSON.stringify({ message: 'Smart scheduling config updated' }), { headers: corsHeaders });
      }

      // ========================================================================
      // Maintenance Windows API Routes
      // ========================================================================
      if (url.pathname === '/api/maintenance/windows' && request.method === 'GET') {
        const now = Math.floor(Date.now() / 1000);
        const windows = await getActiveMaintenanceWindows(now, env.DB);
        return new Response(JSON.stringify(windows), { headers: corsHeaders });
      }

      if (url.pathname === '/api/maintenance/windows' && request.method === 'POST') {
        const payload = await request.json() as any;
        const now = Math.floor(Date.now() / 1000);
        const result = await env.DB.prepare(`
          INSERT INTO maintenance_windows (
            name, description, target_id, state, start_time, end_time,
            recurrence, recurrence_config, suppress_checks, suppress_alerts,
            created_by, enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).bind(
          payload.name,
          payload.description || null,
          payload.target_id || null,
          payload.state || null,
          payload.start_time,
          payload.end_time,
          payload.recurrence || null,
          payload.recurrence_config ? JSON.stringify(payload.recurrence_config) : null,
          payload.suppress_checks ? 1 : 0,
          payload.suppress_alerts !== undefined ? (payload.suppress_alerts ? 1 : 0) : 1,
          payload.created_by || 'api',
          now,
          now
        ).run();
        return new Response(JSON.stringify({ id: result.meta.last_row_id, message: 'Window created' }), { status: 201, headers: corsHeaders });
      }

      if (url.pathname.match(/^\/api\/maintenance\/windows\/\d+$/) && request.method === 'DELETE') {
        const windowId = url.pathname.split('/')[4];
        await env.DB.prepare('DELETE FROM maintenance_windows WHERE id = ?').bind(windowId).run();
        return new Response(JSON.stringify({ message: 'Window deleted' }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/maintenance/skip-log' && request.method === 'GET') {
        const targetId = url.searchParams.get('targetId') ? parseInt(url.searchParams.get('targetId')!) : null;
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const logs = await getMaintenanceSkipLog(targetId, null, limit, env.DB);
        return new Response(JSON.stringify(logs), { headers: corsHeaders });
      }

      // ========================================================================
      // Bulk Operations API Routes
      // ========================================================================
      if (url.pathname === '/api/targets/bulk/import' && request.method === 'POST') {
        return await bulkImportTargets(request, env.DB, env);
      }

      if (url.pathname === '/api/targets/bulk/toggle' && request.method === 'POST') {
        return await bulkToggleTargets(request, env.DB);
      }

      if (url.pathname === '/api/targets/bulk/update' && request.method === 'POST') {
        return await bulkUpdateTargets(request, env.DB);
      }

      if (url.pathname === '/api/targets/bulk/delete' && request.method === 'POST') {
        return await bulkDeleteTargets(request, env.DB);
      }

      if (url.pathname === '/api/targets/export' && request.method === 'GET') {
        const format = (url.searchParams.get('format') as 'csv' | 'json') || 'json';
        const state = url.searchParams.get('state') || undefined;
        const enabled = url.searchParams.get('enabled') === 'true' ? true : url.searchParams.get('enabled') === 'false' ? false : undefined;
        return await bulkExportTargets(env.DB, format, { state, enabled });
      }

      // ========================================================================
      // Health Check Templates API Routes
      // ========================================================================
      if (url.pathname === '/api/templates' && request.method === 'GET') {
        const category = url.searchParams.get('category') || undefined;
        return await listTemplates(env.DB, category);
      }

      if (url.pathname === '/api/templates' && request.method === 'POST') {
        return await createTemplate(request, env.DB);
      }

      if (url.pathname.match(/^\/api\/templates\/\d+$/) && request.method === 'GET') {
        const id = parseInt(url.pathname.split('/')[3]);
        return await getTemplate(id, env.DB);
      }

      if (url.pathname.match(/^\/api\/templates\/\d+$/) && request.method === 'PUT') {
        const id = parseInt(url.pathname.split('/')[3]);
        return await updateTemplate(id, request, env.DB);
      }

      if (url.pathname.match(/^\/api\/templates\/\d+$/) && request.method === 'DELETE') {
        const id = parseInt(url.pathname.split('/')[3]);
        return await deleteTemplate(id, env.DB);
      }

      if (url.pathname.match(/^\/api\/targets\/\d+\/apply-template$/) && request.method === 'POST') {
        const targetId = parseInt(url.pathname.split('/')[3]);
        return await applyTemplateToTarget(targetId, request, env.DB);
      }

      if (url.pathname.match(/^\/api\/targets\/\d+\/template-history$/) && request.method === 'GET') {
        const targetId = parseInt(url.pathname.split('/')[3]);
        return await getTargetTemplateHistory(targetId, env.DB);
      }

      // ========================================================================
      // GDPR API Routes
      // ========================================================================

      // Retention Policy
      if (url.pathname === '/api/gdpr/retention-policy' && request.method === 'GET') {
        const policy = await getRetentionPolicy(env.DB);
        return new Response(JSON.stringify(policy), { headers: corsHeaders });
      }

      if (url.pathname === '/api/gdpr/retention-policy' && request.method === 'PUT') {
        const payload = await request.json() as any;
        await updateRetentionPolicy(payload, env.DB);
        return new Response(JSON.stringify({ message: 'Retention policy updated' }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/gdpr/retention-policy/preview' && request.method === 'GET') {
        const preview = await getCleanupPreview(env.DB);
        return new Response(JSON.stringify(preview), { headers: corsHeaders });
      }

      // Data Export
      if (url.pathname === '/api/gdpr/export' && request.method === 'POST') {
        const payload = await request.json() as any;
        const requestedBy = 'api'; // TODO: Get from auth context
        const ipAddress = request.headers.get('CF-Connecting-IP');
        const requestId = await createExportRequest(payload, requestedBy, ipAddress, env.DB);
        return new Response(JSON.stringify({ request_id: requestId, status: 'pending' }), { status: 201, headers: corsHeaders });
      }

      if (url.pathname.match(/^\/api\/gdpr\/export\/\d+$/) && request.method === 'GET') {
        const requestId = parseInt(url.pathname.split('/')[4]);
        const exportRequest = await getExportRequest(requestId, env.DB);
        return new Response(JSON.stringify(exportRequest), { headers: corsHeaders });
      }

      if (url.pathname === '/api/gdpr/exports' && request.method === 'GET') {
        const status = url.searchParams.get('status') || null;
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const exports = await listExportRequests(null, status, limit, env.DB);
        return new Response(JSON.stringify(exports), { headers: corsHeaders });
      }

      // Data Deletion
      if (url.pathname === '/api/gdpr/deletion' && request.method === 'POST') {
        const payload = await request.json() as any;
        const requestedBy = 'api'; // TODO: Get from auth context
        const requestId = await createDeletionRequest(payload, requestedBy, env.DB);
        return new Response(JSON.stringify({ request_id: requestId, status: 'pending' }), { status: 201, headers: corsHeaders });
      }

      if (url.pathname.match(/^\/api\/gdpr\/deletion\/\d+$/) && request.method === 'GET') {
        const requestId = parseInt(url.pathname.split('/')[4]);
        const deletionRequest = await getDeletionRequest(requestId, env.DB);
        return new Response(JSON.stringify(deletionRequest), { headers: corsHeaders });
      }

      if (url.pathname.match(/^\/api\/gdpr\/deletion\/\d+\/approve$/) && request.method === 'PUT') {
        const requestId = parseInt(url.pathname.split('/')[4]);
        const approvedBy = 'api'; // TODO: Get from auth context
        await approveDeletionRequest(requestId, approvedBy, env.DB);
        return new Response(JSON.stringify({ message: 'Deletion request approved' }), { headers: corsHeaders });
      }

      if (url.pathname.match(/^\/api\/gdpr\/deletion\/\d+\/reject$/) && request.method === 'PUT') {
        const requestId = parseInt(url.pathname.split('/')[4]);
        const body = await request.json() as { reason: string };
        await rejectDeletionRequest(requestId, body.reason, env.DB);
        return new Response(JSON.stringify({ message: 'Deletion request rejected' }), { headers: corsHeaders });
      }

      if (url.pathname === '/api/gdpr/deletions' && request.method === 'GET') {
        const status = url.searchParams.get('status') || null;
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const deletions = await listDeletionRequests(status, limit, env.DB);
        return new Response(JSON.stringify(deletions), { headers: corsHeaders });
      }

      if (url.pathname === '/api/gdpr/deletion/preview' && request.method === 'POST') {
        const payload = await request.json() as any;
        const preview = await getDeletionPreview(payload.scope, payload.target_id || null, payload.state || null, env.DB);
        return new Response(JSON.stringify(preview), { headers: corsHeaders });
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

        // Also run smart scheduling adjustments hourly
        try {
          const adjustmentReport = await runSmartScheduling(env.DB, env);
          console.log(`Smart scheduling: ${adjustmentReport.adjusted} targets adjusted`);
        } catch (error) {
          console.error('Smart scheduling error:', error);
        }

        // Process GDPR export requests
        try {
          await processExportRequests(env.DB, env);
        } catch (error) {
          console.error('GDPR export processing error:', error);
        }

        // Process GDPR deletion requests
        try {
          await processDeletionRequests(env.DB);
        } catch (error) {
          console.error('GDPR deletion processing error:', error);
        }

        // Cleanup expired maintenance windows (once daily at 2 AM)
        const cronHour = new Date(event.scheduledTime).getUTCHours();
        if (cronHour === 2) {
          try {
            const deleted = await cleanupExpiredWindows(env.DB);
            console.log(`Cleaned up ${deleted} expired maintenance windows`);
          } catch (error) {
            console.error('Maintenance window cleanup error:', error);
          }

          // Run data cleanup based on retention policies
          try {
            const cleanupReport = await runDataCleanup(env.DB, env);
            console.log(`Data cleanup: ${cleanupReport.total_deleted} records deleted`);
          } catch (error) {
            console.error('Data cleanup error:', error);
          }

          // Run scheduled ranking calculations
          try {
            await runScheduledRankings(env);
          } catch (error) {
            console.error('Ranking calculation error:', error);
          }
        }
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
