/**
 * Security monitoring dashboard endpoints
 * Requires admin scope for access
 */

import type { Env } from '../types';

/**
 * Handle security-related API requests
 */
export async function handleSecurityRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // All security endpoints require admin authentication
  // This is checked by the main auth middleware

  // GET /api/security/events - Recent security events
  if (path === '/api/security/events' && request.method === 'GET') {
    return getSecurityEvents(url, env);
  }

  // GET /api/security/summary - Security metrics summary
  if (path === '/api/security/summary' && request.method === 'GET') {
    return getSecuritySummary(url, env);
  }

  // GET /api/security/events/:id - Get specific security event
  if (path.match(/^\/api\/security\/events\/\d+$/) && request.method === 'GET') {
    const eventId = parseInt(path.split('/').pop() || '0', 10);
    return getSecurityEvent(eventId, env);
  }

  // GET /api/security/threats - Active threats by type
  if (path === '/api/security/threats' && request.method === 'GET') {
    return getThreats(url, env);
  }

  // GET /api/security/stats - Overall security statistics
  if (path === '/api/security/stats' && request.method === 'GET') {
    return getSecurityStats(env);
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * GET /api/security/events
 * Retrieve recent security events with filtering
 */
async function getSecurityEvents(url: URL, env: Env): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') || '100', 10);
  const severity = url.searchParams.get('severity');
  const type = url.searchParams.get('type');
  const ipAddress = url.searchParams.get('ip_address');
  const apiKeyId = url.searchParams.get('api_key_id');

  let query = 'SELECT * FROM security_events WHERE 1=1';
  const params: any[] = [];

  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  if (ipAddress) {
    query += ' AND ip_address = ?';
    params.push(ipAddress);
  }

  if (apiKeyId) {
    query += ' AND api_key_id = ?';
    params.push(parseInt(apiKeyId, 10));
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Math.min(limit, 1000)); // Cap at 1000

  try {
    const result = await env.DB.prepare(query).bind(...params).all();

    // Parse JSON metadata
    const events = result.results?.map((event: any) => ({
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : {}
    })) || [];

    return new Response(JSON.stringify({
      events,
      count: events.length,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch security events:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to fetch security events'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/security/summary
 * Get summary of security events in the last 24 hours
 */
async function getSecuritySummary(url: URL, env: Env): Promise<Response> {
  const hours = parseInt(url.searchParams.get('hours') || '24', 10);
  const sinceTs = Math.floor(Date.now() / 1000) - (hours * 3600);

  try {
    const summary = await env.DB.prepare(`
      SELECT
        type,
        severity,
        COUNT(*) as event_count,
        MAX(created_at) as last_occurrence,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT api_key_id) as unique_keys
      FROM security_events
      WHERE created_at >= ?
      GROUP BY type, severity
      ORDER BY event_count DESC
    `).bind(sinceTs).all();

    const totalEvents = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM security_events WHERE created_at >= ?
    `).bind(sinceTs).first<{ total: number }>();

    const criticalCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM security_events
      WHERE created_at >= ? AND severity = 'critical'
    `).bind(sinceTs).first<{ count: number }>();

    return new Response(JSON.stringify({
      period_hours: hours,
      total_events: totalEvents?.total || 0,
      critical_events: criticalCount?.count || 0,
      events_by_type: summary.results,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch security summary:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to fetch security summary'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/security/events/:id
 * Get a specific security event by ID
 */
async function getSecurityEvent(eventId: number, env: Env): Promise<Response> {
  try {
    const event = await env.DB.prepare(`
      SELECT * FROM security_events WHERE id = ?
    `).bind(eventId).first();

    if (!event) {
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Security event not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse JSON metadata
    const eventData: any = event;
    eventData.metadata = eventData.metadata ? JSON.parse(eventData.metadata) : {};

    return new Response(JSON.stringify(eventData), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch security event:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to fetch security event'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/security/threats
 * Get active threats grouped by type
 */
async function getThreats(url: URL, env: Env): Promise<Response> {
  const hours = parseInt(url.searchParams.get('hours') || '24', 10);
  const sinceTs = Math.floor(Date.now() / 1000) - (hours * 3600);

  try {
    const threats = await env.DB.prepare(`
      SELECT
        type,
        COUNT(*) as occurrence_count,
        MAX(created_at) as last_seen,
        MAX(severity) as highest_severity,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM security_events
      WHERE created_at >= ?
      GROUP BY type
      ORDER BY occurrence_count DESC
    `).bind(sinceTs).all();

    return new Response(JSON.stringify({
      period_hours: hours,
      threats: threats.results,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch threats:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to fetch threats'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /api/security/stats
 * Get overall security statistics
 */
async function getSecurityStats(env: Env): Promise<Response> {
  try {
    const last24h = Math.floor(Date.now() / 1000) - (24 * 3600);
    const last7d = Math.floor(Date.now() / 1000) - (7 * 24 * 3600);

    const stats24h = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_events,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM security_events
      WHERE created_at >= ?
    `).bind(last24h).first();

    const stats7d = await env.DB.prepare(`
      SELECT
        COUNT(*) as total_events,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM security_events
      WHERE created_at >= ?
    `).bind(last7d).first();

    const topThreats = await env.DB.prepare(`
      SELECT type, COUNT(*) as count
      FROM security_events
      WHERE created_at >= ?
      GROUP BY type
      ORDER BY count DESC
      LIMIT 5
    `).bind(last24h).all();

    const topIPs = await env.DB.prepare(`
      SELECT ip_address, COUNT(*) as event_count
      FROM security_events
      WHERE created_at >= ?
      GROUP BY ip_address
      ORDER BY event_count DESC
      LIMIT 10
    `).bind(last24h).all();

    return new Response(JSON.stringify({
      last_24h: stats24h,
      last_7d: stats7d,
      top_threats_24h: topThreats.results,
      top_ips_24h: topIPs.results,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to fetch security stats:', error);
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'Failed to fetch security stats'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
