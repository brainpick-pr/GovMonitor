/**
 * Authentication Middleware Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { requireAuth, requiresAuth, generateApiKey, hashApiKey } from '../src/auth';
import type { Env } from '../src/types';

// Mock environment
const mockEnv: Env = {
  DB: {} as D1Database,
  KV: {} as KVNamespace,
  ENVIRONMENT: 'test',
  USER_AGENT: 'GovMonitorBot/1.0',
  TIMEOUT_MS: '5000',
  MAX_LATENCY_MS: '10000',
  API_KEY: 'test-api-key-12345',
  ADMIN_API_KEYS: 'admin-key-1,admin-key-2',
  READ_ONLY_API_KEYS: 'readonly-key-1',
  REQUIRE_AUTH_FOR_READS: 'false',
};

describe('requiresAuth', () => {
  it('should require auth for POST /api/targets', () => {
    expect(requiresAuth('/api/targets', 'POST', mockEnv)).toBe(true);
  });

  it('should require auth for DELETE /api/targets/123', () => {
    expect(requiresAuth('/api/targets/123', 'DELETE', mockEnv)).toBe(true);
  });

  it('should require auth for PUT /api/config', () => {
    expect(requiresAuth('/api/config', 'PUT', mockEnv)).toBe(true);
  });

  it('should require auth for POST /api/check', () => {
    expect(requiresAuth('/api/check', 'POST', mockEnv)).toBe(true);
  });

  it('should NOT require auth for GET /api/status by default', () => {
    expect(requiresAuth('/api/status', 'GET', mockEnv)).toBe(false);
  });

  it('should require auth for GET when REQUIRE_AUTH_FOR_READS=true', () => {
    const strictEnv = { ...mockEnv, REQUIRE_AUTH_FOR_READS: 'true' };
    expect(requiresAuth('/api/status', 'GET', strictEnv)).toBe(true);
  });

  it('should require auth for admin endpoints regardless of method', () => {
    expect(requiresAuth('/api/auth/keys', 'GET', mockEnv)).toBe(true);
    expect(requiresAuth('/api/auth/keys', 'POST', mockEnv)).toBe(true);
  });
});

describe('requireAuth - Bearer Token Validation', () => {
  it('should reject requests without Authorization header', async () => {
    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
    });

    const result = await requireAuth(request, mockEnv);
    expect(result).toBeTruthy();
    expect(result?.status).toBe(401);

    const body = await result?.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should accept valid Bearer token from API_KEY', async () => {
    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-api-key-12345',
      },
    });

    const result = await requireAuth(request, mockEnv);
    expect(result).toBeNull(); // No error = authenticated
  });

  it('should accept valid token from ADMIN_API_KEYS', async () => {
    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-key-1',
      },
    });

    const result = await requireAuth(request, mockEnv);
    expect(result).toBeNull();
  });

  it('should accept token without "Bearer" prefix', async () => {
    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: {
        Authorization: 'test-api-key-12345',
      },
    });

    const result = await requireAuth(request, mockEnv);
    expect(result).toBeNull();
  });

  it('should reject invalid API key', async () => {
    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-key',
      },
    });

    // Mock DB to return null (key not found)
    const envWithMockDB = {
      ...mockEnv,
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => null,
          }),
        }),
      } as any,
    };

    const result = await requireAuth(request, envWithMockDB);
    expect(result).toBeTruthy();
    expect(result?.status).toBe(403);

    const body = await result?.json();
    expect(body.error).toBe('Forbidden');
  });

  it('should allow public GET requests without auth', async () => {
    const request = new Request('http://localhost/api/status', {
      method: 'GET',
    });

    const result = await requireAuth(request, mockEnv);
    expect(result).toBeNull(); // No auth required
  });
});

describe('generateApiKey', () => {
  it('should generate a 43-character base64url key', async () => {
    const key = await generateApiKey();
    expect(key).toHaveLength(43);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/); // Base64url charset
  });

  it('should generate unique keys', async () => {
    const key1 = await generateApiKey();
    const key2 = await generateApiKey();
    expect(key1).not.toBe(key2);
  });
});

describe('hashApiKey', () => {
  it('should generate consistent SHA-256 hash', async () => {
    const key = 'test-key-12345';
    const hash1 = await hashApiKey(key);
    const hash2 = await hashApiKey(key);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate different hashes for different keys', async () => {
    const hash1 = await hashApiKey('key1');
    const hash2 = await hashApiKey('key2');

    expect(hash1).not.toBe(hash2);
  });
});

describe('Database-backed authentication', () => {
  it('should validate API key from database', async () => {
    const testKey = 'db-test-key-12345';
    const keyHash = await hashApiKey(testKey);

    // Mock DB that returns valid key record
    const mockDB = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            id: 1,
            name: 'Test Key',
            scope: 'admin',
            enabled: 1,
            rate_limit: 1000,
            last_used_at: null,
            expires_at: null,
          }),
        }),
      }),
    } as any;

    // Mock KV for rate limiting
    const mockKV = {
      get: async () => null,
      put: async () => undefined,
    } as any;

    const envWithDB = {
      ...mockEnv,
      DB: mockDB,
      KV: mockKV,
      API_KEY: '', // Disable env key to test DB path
    };

    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testKey}`,
      },
    });

    const result = await requireAuth(request, envWithDB);
    expect(result).toBeNull(); // Should authenticate via DB
  });

  it('should reject expired API key', async () => {
    const testKey = 'expired-key';
    const pastTimestamp = Math.floor(Date.now() / 1000) - 86400; // Yesterday

    const mockDB = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          first: async () =>
            sql.includes('api_keys')
              ? {
                  id: 1,
                  name: 'Expired Key',
                  scope: 'admin',
                  enabled: 1,
                  rate_limit: 1000,
                  last_used_at: null,
                  expires_at: pastTimestamp, // Expired
                }
              : null,
          run: async () => ({ success: true }),
        }),
      }),
    } as any;

    const envWithDB = {
      ...mockEnv,
      DB: mockDB,
      API_KEY: '',
    };

    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testKey}`,
      },
    });

    const result = await requireAuth(request, envWithDB);
    expect(result).toBeTruthy();
    expect(result?.status).toBe(403);
  });

  it('should enforce scope permissions', async () => {
    const testKey = 'read-only-key';

    // Mock DB returning read-only scope
    const mockDB = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          first: async () =>
            sql.includes('api_keys')
              ? {
                  id: 1,
                  name: 'Read Only Key',
                  scope: 'read', // Read-only scope
                  enabled: 1,
                  rate_limit: 1000,
                  last_used_at: null,
                  expires_at: null,
                }
              : null,
          run: async () => ({ success: true }),
        }),
      }),
    } as any;

    const envWithDB = {
      ...mockEnv,
      DB: mockDB,
      API_KEY: '',
    };

    // Try POST with read-only key (should fail)
    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testKey}`,
      },
    });

    const result = await requireAuth(request, envWithDB);
    expect(result).toBeTruthy();
    expect(result?.status).toBe(403);

    const body = await result?.json();
    expect(body.message).toContain('Insufficient permissions');
  });
});

describe('Rate limiting', () => {
  it('should enforce rate limits', async () => {
    const testKey = 'rate-limited-key';

    // Mock DB
    const mockDB = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          first: async () =>
            sql.includes('api_keys')
              ? {
                  id: 1,
                  name: 'Limited Key',
                  scope: 'admin',
                  enabled: 1,
                  rate_limit: 10, // Low limit for testing
                  last_used_at: null,
                  expires_at: null,
                }
              : null,
          run: async () => ({ success: true }),
        }),
      }),
    } as any;

    // Mock KV returning high count (limit exceeded)
    const mockKV = {
      get: async () => '11', // Already exceeded limit
      put: async () => undefined,
    } as any;

    const envWithDB = {
      ...mockEnv,
      DB: mockDB,
      KV: mockKV,
      API_KEY: '',
    };

    const request = new Request('http://localhost/api/targets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testKey}`,
      },
    });

    const result = await requireAuth(request, envWithDB);
    expect(result).toBeTruthy();
    expect(result?.status).toBe(429); // Too Many Requests

    const body = await result?.json();
    expect(body.error).toBe('Too Many Requests');
  });
});
