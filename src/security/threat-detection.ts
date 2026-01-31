/**
 * Active threat detection and anomaly monitoring
 */

import type { Env } from '../types';

export interface SecurityEvent {
  type: 'credential_attack' | 'credential_stuffing' | 'enumeration' |
        'rate_limit_abuse' | 'off_hours_access' | 'geographic_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  api_key_id: number | null;
  ip_address: string;
  endpoint: string;
  description: string;
  metadata: Record<string, any>;
  timestamp: number;
}

/**
 * Check for credential attack (brute force)
 * Multiple failed auth attempts from same IP in short time
 */
export async function detectCredentialAttack(
  request: Request,
  env: Env
): Promise<SecurityEvent | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `SECURITY:FAILED_AUTH:${ip}`;

  // Get recent failed attempts from this IP
  const failedCount = await env.KV.get(key);
  const count = failedCount ? parseInt(failedCount, 10) : 0;

  // Threshold: 5 failed attempts in 5 minutes
  if (count >= 5) {
    return {
      type: 'credential_attack',
      severity: 'high',
      api_key_id: null,
      ip_address: ip,
      endpoint: new URL(request.url).pathname,
      description: `${count} failed authentication attempts from IP ${ip}`,
      metadata: { failed_attempts: count, window_minutes: 5 },
      timestamp: Date.now()
    };
  }

  return null;
}

/**
 * Track a failed authentication attempt
 */
export async function trackFailedAuth(request: Request, env: Env): Promise<void> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `SECURITY:FAILED_AUTH:${ip}`;

  const current = await env.KV.get(key);
  const count = current ? parseInt(current, 10) : 0;

  await env.KV.put(key, (count + 1).toString(), { expirationTtl: 300 }); // 5 minutes
}

/**
 * Clear failed auth tracking (on successful auth)
 */
export async function clearFailedAuth(request: Request, env: Env): Promise<void> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `SECURITY:FAILED_AUTH:${ip}`;
  await env.KV.delete(key);
}

/**
 * Check for credential stuffing
 * Same API key used from many different IPs
 */
export async function detectCredentialStuffing(
  apiKeyId: number,
  request: Request,
  env: Env
): Promise<SecurityEvent | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `SECURITY:KEY_IPS:${apiKeyId}`;

  // Track IPs using this key (last 1 hour)
  const ipsJson = await env.KV.get(key);
  const ips: string[] = ipsJson ? JSON.parse(ipsJson) : [];

  if (!ips.includes(ip)) {
    ips.push(ip);
    await env.KV.put(key, JSON.stringify(ips), { expirationTtl: 3600 });
  }

  // Threshold: 10 different IPs in 1 hour
  if (ips.length >= 10) {
    return {
      type: 'credential_stuffing',
      severity: 'critical',
      api_key_id: apiKeyId,
      ip_address: ip,
      endpoint: new URL(request.url).pathname,
      description: `API key used from ${ips.length} different IPs in 1 hour`,
      metadata: { unique_ips: ips.length, ips: ips.slice(0, 5) },
      timestamp: Date.now()
    };
  }

  return null;
}

/**
 * Check for endpoint enumeration
 * Rapid access to many different endpoints
 */
export async function detectEnumeration(
  apiKeyId: number,
  request: Request,
  env: Env
): Promise<SecurityEvent | null> {
  const endpoint = new URL(request.url).pathname;
  const key = `SECURITY:ENDPOINTS:${apiKeyId}`;

  // Track endpoints accessed (last 10 minutes)
  const endpointsJson = await env.KV.get(key);
  const endpoints: string[] = endpointsJson ? JSON.parse(endpointsJson) : [];

  if (!endpoints.includes(endpoint)) {
    endpoints.push(endpoint);
    await env.KV.put(key, JSON.stringify(endpoints), { expirationTtl: 600 });
  }

  // Threshold: 15 different endpoints in 10 minutes
  if (endpoints.length >= 15) {
    return {
      type: 'enumeration',
      severity: 'medium',
      api_key_id: apiKeyId,
      ip_address: request.headers.get('CF-Connecting-IP') || 'unknown',
      endpoint,
      description: `${endpoints.length} different endpoints accessed in 10 minutes`,
      metadata: { unique_endpoints: endpoints.length, endpoints: endpoints.slice(0, 10) },
      timestamp: Date.now()
    };
  }

  return null;
}

/**
 * Check for off-hours access
 * API access during unusual times (configurable per timezone)
 */
export async function detectOffHoursAccess(
  apiKeyId: number,
  request: Request,
  env: Env
): Promise<SecurityEvent | null> {
  const now = new Date();
  const hour = now.getUTCHours(); // Using UTC for simplicity

  // Define off-hours: 2 AM - 5 AM UTC
  if (hour >= 2 && hour <= 5) {
    return {
      type: 'off_hours_access',
      severity: 'low',
      api_key_id: apiKeyId,
      ip_address: request.headers.get('CF-Connecting-IP') || 'unknown',
      endpoint: new URL(request.url).pathname,
      description: `API access during off-hours (${hour}:00 UTC)`,
      metadata: { hour_utc: hour },
      timestamp: Date.now()
    };
  }

  return null;
}

/**
 * Check for geographic anomalies
 * Access from unexpected countries
 */
export async function detectGeographicAnomaly(
  apiKeyId: number,
  request: Request,
  env: Env
): Promise<SecurityEvent | null> {
  const country = request.cf?.country as string | undefined;

  if (!country) return null;

  const key = `SECURITY:COUNTRIES:${apiKeyId}`;

  // Track countries (last 24 hours)
  const countriesJson = await env.KV.get(key);
  const countries: string[] = countriesJson ? JSON.parse(countriesJson) : [];

  if (!countries.includes(country)) {
    countries.push(country);
    await env.KV.put(key, JSON.stringify(countries), { expirationTtl: 86400 });
  }

  // Threshold: 5 different countries in 24 hours
  if (countries.length >= 5) {
    return {
      type: 'geographic_anomaly',
      severity: 'medium',
      api_key_id: apiKeyId,
      ip_address: request.headers.get('CF-Connecting-IP') || 'unknown',
      endpoint: new URL(request.url).pathname,
      description: `API key used from ${countries.length} countries in 24 hours`,
      metadata: { unique_countries: countries.length, countries },
      timestamp: Date.now()
    };
  }

  return null;
}

/**
 * Run all threat detection checks
 */
export async function detectThreats(
  request: Request,
  apiKeyId: number | null,
  env: Env
): Promise<SecurityEvent[]> {
  // Skip threat detection if disabled
  if (env.DISABLE_THREAT_DETECTION === 'true') {
    return [];
  }

  const threats: SecurityEvent[] = [];

  // Check for credential attacks (no API key needed)
  const credentialAttack = await detectCredentialAttack(request, env);
  if (credentialAttack) threats.push(credentialAttack);

  // Skip remaining checks if no valid API key
  if (!apiKeyId) return threats;

  // Check for credential stuffing
  const stuffing = await detectCredentialStuffing(apiKeyId, request, env);
  if (stuffing) threats.push(stuffing);

  // Check for enumeration
  const enumeration = await detectEnumeration(apiKeyId, request, env);
  if (enumeration) threats.push(enumeration);

  // Check for off-hours access
  const offHours = await detectOffHoursAccess(apiKeyId, request, env);
  if (offHours) threats.push(offHours);

  // Check for geographic anomalies
  const geoAnomaly = await detectGeographicAnomaly(apiKeyId, request, env);
  if (geoAnomaly) threats.push(geoAnomaly);

  return threats;
}

/**
 * Log security event to database
 */
export async function logSecurityEvent(
  event: SecurityEvent,
  env: Env
): Promise<void> {
  try {
    await env.DB.prepare(`
      INSERT INTO security_events (
        type, severity, api_key_id, ip_address, endpoint,
        description, metadata, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.type,
      event.severity,
      event.api_key_id,
      event.ip_address,
      event.endpoint,
      event.description,
      JSON.stringify(event.metadata),
      Math.floor(event.timestamp / 1000)
    ).run();
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw - logging failure shouldn't break request
  }
}

/**
 * Alert security team via webhook
 */
export async function alertSecurityTeam(
  event: SecurityEvent,
  env: Env
): Promise<void> {
  if (!env.SECURITY_WEBHOOK_URL) {
    console.warn('SECURITY_WEBHOOK_URL not configured - skipping alert');
    return;
  }

  // Only alert on high/critical severity
  if (event.severity !== 'high' && event.severity !== 'critical') {
    return;
  }

  try {
    await fetch(env.SECURITY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: event.type,
        severity: event.severity,
        description: event.description,
        details: event.metadata,
        timestamp: new Date(event.timestamp).toISOString(),
        action_required: true,
        ip_address: event.ip_address,
        endpoint: event.endpoint
      })
    });

    console.log(`🚨 Security alert sent: ${event.type} (${event.severity})`);
  } catch (error) {
    console.error('Failed to send security alert:', error);
  }
}

/**
 * Check if request should be blocked based on threats
 */
export function shouldBlockRequest(threats: SecurityEvent[]): boolean {
  // Block if any critical threat is detected
  return threats.some(threat => threat.severity === 'critical');
}
