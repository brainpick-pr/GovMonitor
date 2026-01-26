/**
 * KV cache utilities
 */

import type { CachedStatus } from '../types';

/**
 * Type guard for cached status data
 * @param data - The data to validate
 * @returns true if valid CachedStatus array, false otherwise
 */
export function isValidStatusArray(data: unknown): data is CachedStatus[] {
  if (!Array.isArray(data)) {
    return false;
  }

  return data.every(item => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    return (
      typeof item.id === 'number' &&
      typeof item.name === 'string' &&
      typeof item.url === 'string' &&
      typeof item.hostname === 'string' &&
      (item.state === null || typeof item.state === 'string') &&
      typeof item.enabled === 'number' &&
      (item.ts === null || typeof item.ts === 'number') &&
      (item.ok === null || typeof item.ok === 'number') &&
      (item.status === null || typeof item.status === 'number') &&
      (item.latency_ms === null || typeof item.latency_ms === 'number') &&
      (item.error === null || typeof item.error === 'string')
    );
  });
}

/**
 * Invalidate status cache in KV
 * @param kv - KV namespace
 */
export async function invalidateStatusCache(kv: KVNamespace): Promise<void> {
  await kv.delete('latest_status');
}

/**
 * Get cached status from KV
 * @param kv - KV namespace
 * @returns Cached status array or null if not found/invalid
 */
export async function getCachedStatus(kv: KVNamespace): Promise<CachedStatus[] | null> {
  const cached = await kv.get('latest_status', 'json');
  if (isValidStatusArray(cached)) {
    return cached;
  }
  return null;
}

/**
 * Set status cache in KV
 * @param kv - KV namespace
 * @param data - Status data to cache
 * @param ttl - Time to live in seconds (default: 60)
 */
export async function setCachedStatus(
  kv: KVNamespace,
  data: CachedStatus[],
  ttl: number = 60
): Promise<void> {
  await kv.put('latest_status', JSON.stringify(data), { expirationTtl: ttl });
}
