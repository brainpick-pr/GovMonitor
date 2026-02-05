/**
 * Data access layer for checks with encryption support
 */

import { encrypt, decrypt } from '../crypto';
import type { Env, CheckResult } from '../types';
import type { CheckMetadata } from '../utils/metadata';

export interface StoredCheck {
  id: number;
  target_id: number;
  ts: number;
  ok: number;
  status: number | null;
  latency_ms: number | null;
  error: string | null;
  error_encrypted: number;
  metadata: string | null;
}

/**
 * Store check result with encrypted error message and metadata
 */
export async function storeCheckResult(
  targetId: number,
  result: CheckResult,
  env: Env,
  metadata?: CheckMetadata
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  let errorValue: string | null = null;
  let errorEncrypted = 0;

  // Encrypt error message if present and encryption is enabled
  if (result.error) {
    if (env.ENCRYPTION_KEY && env.DISABLE_ENCRYPTION !== 'true') {
      try {
        errorValue = await encrypt(result.error, env);
        errorEncrypted = 1;
      } catch (encryptError) {
        console.error('Failed to encrypt error message:', encryptError);
        // Fall back to plaintext if encryption fails
        errorValue = result.error;
        errorEncrypted = 0;
      }
    } else {
      errorValue = result.error;
      errorEncrypted = 0;
    }
  }

  // Serialize metadata to JSON
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  const checkInsertResult = await env.DB.prepare(`
    INSERT INTO checks (target_id, ts, ok, status, latency_ms, error, error_encrypted, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).bind(
    targetId,
    now,
    result.ok ? 1 : 0,
    result.status || null,
    result.latency_ms || null,
    errorValue,
    errorEncrypted,
    metadataJson
  ).first<{ id: number }>();

  return checkInsertResult?.id || 0;
}

/**
 * Retrieve check results with decrypted error messages
 */
export async function getCheckHistory(
  targetId: number,
  limit: number,
  env: Env
): Promise<any[]> {
  const results = await env.DB.prepare(`
    SELECT id, target_id, ts, ok, status, latency_ms, error, error_encrypted, metadata
    FROM checks
    WHERE target_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `).bind(targetId, limit).all();

  if (!results.results) return [];

  // Decrypt error messages
  return Promise.all(results.results.map(async (check: any) => {
    if (check.error && check.error_encrypted === 1) {
      if (env.ENCRYPTION_KEY) {
        try {
          check.error = await decrypt(check.error, env);
        } catch (error) {
          console.error('Failed to decrypt check error:', error);
          check.error = '[Decryption failed - key mismatch or corrupted data]';
        }
      } else {
        check.error = '[Encrypted - ENCRYPTION_KEY not configured]';
      }
    }

    return check;
  }));
}

/**
 * Get the most recent check for a target with decryption
 */
export async function getLatestCheck(
  targetId: number,
  env: Env
): Promise<StoredCheck | null> {
  const result = await env.DB.prepare(`
    SELECT id, target_id, ts, ok, status, latency_ms, error, error_encrypted, metadata
    FROM checks
    WHERE target_id = ?
    ORDER BY ts DESC
    LIMIT 1
  `).bind(targetId).first<StoredCheck>();

  if (!result) return null;

  // Decrypt error if encrypted
  if (result.error && result.error_encrypted === 1) {
    if (env.ENCRYPTION_KEY) {
      try {
        result.error = await decrypt(result.error, env);
      } catch (error) {
        console.error('Failed to decrypt check error:', error);
        result.error = '[Decryption failed]';
      }
    } else {
      result.error = '[Encrypted - ENCRYPTION_KEY not configured]';
    }
  }

  return result;
}

/**
 * Get checks within a time range with decryption
 */
export async function getChecksByTimeRange(
  targetId: number,
  startTs: number,
  endTs: number,
  env: Env
): Promise<StoredCheck[]> {
  const results = await env.DB.prepare(`
    SELECT id, target_id, ts, ok, status, latency_ms, error, error_encrypted, metadata
    FROM checks
    WHERE target_id = ? AND ts >= ? AND ts <= ?
    ORDER BY ts DESC
  `).bind(targetId, startTs, endTs).all();

  if (!results.results) return [];

  // Decrypt error messages
  return Promise.all(results.results.map(async (check: any) => {
    if (check.error && check.error_encrypted === 1) {
      if (env.ENCRYPTION_KEY) {
        try {
          check.error = await decrypt(check.error, env);
        } catch (error) {
          console.error('Failed to decrypt check error:', error);
          check.error = '[Decryption failed]';
        }
      } else {
        check.error = '[Encrypted]';
      }
    }

    return check as StoredCheck;
  }));
}

/**
 * Count encrypted vs unencrypted checks (for migration monitoring)
 */
export async function getEncryptionStatus(env: Env): Promise<{
  total: number;
  encrypted: number;
  unencrypted: number;
  encryption_percentage: number;
}> {
  const result = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN error IS NOT NULL AND error_encrypted = 1 THEN 1 ELSE 0 END) as encrypted,
      SUM(CASE WHEN error IS NOT NULL AND error_encrypted = 0 THEN 1 ELSE 0 END) as unencrypted
    FROM checks
    WHERE error IS NOT NULL
  `).first<{ total: number; encrypted: number; unencrypted: number }>();

  if (!result) {
    return { total: 0, encrypted: 0, unencrypted: 0, encryption_percentage: 0 };
  }

  const encryptionPercentage = result.total > 0
    ? (result.encrypted / result.total) * 100
    : 0;

  return {
    total: result.total,
    encrypted: result.encrypted,
    unencrypted: result.unencrypted,
    encryption_percentage: Math.round(encryptionPercentage * 100) / 100,
  };
}
