/**
 * Utilities for event metadata and correlation tracking
 */

export interface CheckMetadata {
  correlation_id: string;
  worker_id?: string;
  colo?: string; // Cloudflare datacenter code
  check_trigger?: 'cron' | 'manual' | 'backfill';
  request_id?: string;
  timestamp: number;
}

export interface EventMetadata extends CheckMetadata {
  causation_id?: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Extract metadata from Cloudflare request
 */
export function extractRequestMetadata(request?: Request): Partial<EventMetadata> {
  if (!request) return {};

  return {
    correlation_id: request.headers.get('X-Correlation-ID') || generateCorrelationId(),
    request_id: request.headers.get('CF-Ray') || undefined,
    ip_address: request.headers.get('CF-Connecting-IP') || undefined,
    user_agent: request.headers.get('User-Agent') || undefined,
    colo: (request.cf as any)?.colo || undefined,
  };
}

/**
 * Build metadata for check operations
 */
export function buildCheckMetadata(
  trigger: 'cron' | 'manual' | 'backfill' = 'cron',
  request?: Request
): CheckMetadata {
  const baseMetadata: CheckMetadata = {
    correlation_id: generateCorrelationId(),
    check_trigger: trigger,
    timestamp: Math.floor(Date.now() / 1000),
  };

  if (request) {
    const requestMeta = extractRequestMetadata(request);
    return {
      ...baseMetadata,
      correlation_id: requestMeta.correlation_id || baseMetadata.correlation_id,
      request_id: requestMeta.request_id,
      colo: requestMeta.colo,
    };
  }

  return baseMetadata;
}

/**
 * Serialize metadata to JSON string for database storage
 */
export function serializeMetadata(metadata: CheckMetadata | EventMetadata): string {
  return JSON.stringify(metadata);
}

/**
 * Parse metadata from JSON string
 */
export function parseMetadata<T = CheckMetadata>(json: string | null): T | null {
  if (!json) return null;

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('Failed to parse metadata:', error);
    return null;
  }
}
