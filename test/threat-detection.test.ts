/**
 * Unit tests for threat detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectCredentialAttack,
  detectCredentialStuffing,
  detectEnumeration,
  detectOffHoursAccess,
  detectGeographicAnomaly,
  detectThreats,
  trackFailedAuth,
  clearFailedAuth,
  shouldBlockRequest,
  type SecurityEvent
} from '../src/security/threat-detection';
import type { Env } from '../src/types';

// Mock KV storage
class MockKV {
  private store = new Map<string, { value: string; expiration?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;

    // Check expiration
    if (item.expiration && item.expiration < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiration = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;

    this.store.set(key, { value, expiration });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

describe('Threat Detection', () => {
  let mockEnv: Partial<Env>;
  let mockKV: MockKV;

  beforeEach(() => {
    mockKV = new MockKV();
    mockEnv = {
      KV: mockKV as any,
      DB: {} as any,
      DISABLE_THREAT_DETECTION: 'false'
    };
  });

  describe('detectCredentialAttack', () => {
    it('should detect multiple failed auth attempts from same IP', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      // Simulate 5 failed attempts
      await mockKV.put('SECURITY:FAILED_AUTH:192.168.1.100', '5', { expirationTtl: 300 });

      const threat = await detectCredentialAttack(request, mockEnv as Env);

      expect(threat).not.toBeNull();
      expect(threat?.type).toBe('credential_attack');
      expect(threat?.severity).toBe('high');
      expect(threat?.ip_address).toBe('192.168.1.100');
      expect(threat?.metadata.failed_attempts).toBe(5);
    });

    it('should not detect threat with few failed attempts', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      // Simulate only 3 failed attempts (below threshold)
      await mockKV.put('SECURITY:FAILED_AUTH:192.168.1.100', '3', { expirationTtl: 300 });

      const threat = await detectCredentialAttack(request, mockEnv as Env);

      expect(threat).toBeNull();
    });

    it('should handle missing IP header', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets');

      const threat = await detectCredentialAttack(request, mockEnv as Env);

      // Should not throw, should use 'unknown' IP
      expect(threat).toBeNull();
    });
  });

  describe('trackFailedAuth', () => {
    it('should increment failed auth counter', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      await trackFailedAuth(request, mockEnv as Env);

      const count = await mockKV.get('SECURITY:FAILED_AUTH:192.168.1.100');
      expect(count).toBe('1');
    });

    it('should increment existing counter', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      await mockKV.put('SECURITY:FAILED_AUTH:192.168.1.100', '2', { expirationTtl: 300 });
      await trackFailedAuth(request, mockEnv as Env);

      const count = await mockKV.get('SECURITY:FAILED_AUTH:192.168.1.100');
      expect(count).toBe('3');
    });
  });

  describe('clearFailedAuth', () => {
    it('should clear failed auth counter', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      await mockKV.put('SECURITY:FAILED_AUTH:192.168.1.100', '5', { expirationTtl: 300 });
      await clearFailedAuth(request, mockEnv as Env);

      const count = await mockKV.get('SECURITY:FAILED_AUTH:192.168.1.100');
      expect(count).toBeNull();
    });
  });

  describe('detectCredentialStuffing', () => {
    it('should detect same API key from many IPs', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.111' }
      });

      // Simulate 10 different IPs using same key
      const ips = Array.from({ length: 10 }, (_, i) => `192.168.1.${i}`);
      await mockKV.put('SECURITY:KEY_IPS:1', JSON.stringify(ips), { expirationTtl: 3600 });

      const threat = await detectCredentialStuffing(1, request, mockEnv as Env);

      expect(threat).not.toBeNull();
      expect(threat?.type).toBe('credential_stuffing');
      expect(threat?.severity).toBe('critical');
      expect(threat?.api_key_id).toBe(1);
      expect(threat?.metadata.unique_ips).toBeGreaterThanOrEqual(10);
    });

    it('should not detect threat with few IPs', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      const ips = ['192.168.1.100', '192.168.1.101'];
      await mockKV.put('SECURITY:KEY_IPS:1', JSON.stringify(ips), { expirationTtl: 3600 });

      const threat = await detectCredentialStuffing(1, request, mockEnv as Env);

      expect(threat).toBeNull();
    });

    it('should track new IP addresses', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      await detectCredentialStuffing(1, request, mockEnv as Env);

      const ips = JSON.parse(await mockKV.get('SECURITY:KEY_IPS:1') || '[]');
      expect(ips).toContain('192.168.1.100');
    });
  });

  describe('detectEnumeration', () => {
    it('should detect rapid endpoint scanning', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets/16', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      // Simulate access to 15 different endpoints
      const endpoints = Array.from({ length: 15 }, (_, i) => `/api/targets/${i}`);
      await mockKV.put('SECURITY:ENDPOINTS:1', JSON.stringify(endpoints), { expirationTtl: 600 });

      const threat = await detectEnumeration(1, request, mockEnv as Env);

      expect(threat).not.toBeNull();
      expect(threat?.type).toBe('enumeration');
      expect(threat?.severity).toBe('medium');
      expect(threat?.metadata.unique_endpoints).toBeGreaterThanOrEqual(15);
    });

    it('should not detect threat with few endpoints', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      const endpoints = ['/api/targets', '/api/status', '/api/config'];
      await mockKV.put('SECURITY:ENDPOINTS:1', JSON.stringify(endpoints), { expirationTtl: 600 });

      const threat = await detectEnumeration(1, request, mockEnv as Env);

      expect(threat).toBeNull();
    });
  });

  describe('detectOffHoursAccess', () => {
    it('should detect access during off-hours (2-5 AM UTC)', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      // Mock current time to be 3 AM UTC
      const originalDate = Date;
      const mockDate = new Date('2026-01-30T03:00:00Z');
      global.Date = class extends originalDate {
        constructor() {
          super();
          return mockDate;
        }
        static now() {
          return mockDate.getTime();
        }
      } as any;

      const threat = await detectOffHoursAccess(1, request, mockEnv as Env);

      // Restore Date
      global.Date = originalDate;

      expect(threat).not.toBeNull();
      expect(threat?.type).toBe('off_hours_access');
      expect(threat?.severity).toBe('low');
      expect(threat?.metadata.hour_utc).toBe(3);
    });

    it('should not detect threat during normal hours', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      // Mock current time to be 10 AM UTC (normal hours)
      const originalDate = Date;
      const mockDate = new Date('2026-01-30T10:00:00Z');
      global.Date = class extends originalDate {
        constructor() {
          super();
          return mockDate;
        }
        static now() {
          return mockDate.getTime();
        }
      } as any;

      const threat = await detectOffHoursAccess(1, request, mockEnv as Env);

      // Restore Date
      global.Date = originalDate;

      expect(threat).toBeNull();
    });
  });

  describe('detectGeographicAnomaly', () => {
    it('should detect access from many countries', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' },
        cf: { country: 'CN' } as any
      });

      // Simulate access from 5 different countries
      const countries = ['US', 'IN', 'GB', 'DE', 'FR'];
      await mockKV.put('SECURITY:COUNTRIES:1', JSON.stringify(countries), { expirationTtl: 86400 });

      const threat = await detectGeographicAnomaly(1, request, mockEnv as Env);

      expect(threat).not.toBeNull();
      expect(threat?.type).toBe('geographic_anomaly');
      expect(threat?.severity).toBe('medium');
      expect(threat?.metadata.unique_countries).toBeGreaterThanOrEqual(5);
    });

    it('should not detect threat with few countries', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' },
        cf: { country: 'US' } as any
      });

      const countries = ['US', 'CA'];
      await mockKV.put('SECURITY:COUNTRIES:1', JSON.stringify(countries), { expirationTtl: 86400 });

      const threat = await detectGeographicAnomaly(1, request, mockEnv as Env);

      expect(threat).toBeNull();
    });

    it('should handle missing country info', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      const threat = await detectGeographicAnomaly(1, request, mockEnv as Env);

      expect(threat).toBeNull();
    });
  });

  describe('detectThreats', () => {
    it('should run all threat detection checks', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' },
        cf: { country: 'US' } as any
      });

      const threats = await detectThreats(request, 1, mockEnv as Env);

      expect(Array.isArray(threats)).toBe(true);
    });

    it('should return empty array when threat detection is disabled', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      const envWithDisabled = {
        ...mockEnv,
        DISABLE_THREAT_DETECTION: 'true'
      };

      const threats = await detectThreats(request, 1, envWithDisabled as Env);

      expect(threats).toEqual([]);
    });

    it('should only check credential attacks without API key', async () => {
      const request = new Request('https://api.govmonitor.org/api/targets', {
        headers: { 'CF-Connecting-IP': '192.168.1.100' }
      });

      await mockKV.put('SECURITY:FAILED_AUTH:192.168.1.100', '5', { expirationTtl: 300 });

      const threats = await detectThreats(request, null, mockEnv as Env);

      expect(threats.length).toBeGreaterThan(0);
      expect(threats[0].type).toBe('credential_attack');
    });
  });

  describe('shouldBlockRequest', () => {
    it('should block request if critical threat detected', () => {
      const threats: SecurityEvent[] = [
        {
          type: 'credential_stuffing',
          severity: 'critical',
          api_key_id: 1,
          ip_address: '192.168.1.100',
          endpoint: '/api/targets',
          description: 'Critical threat',
          metadata: {},
          timestamp: Date.now()
        }
      ];

      expect(shouldBlockRequest(threats)).toBe(true);
    });

    it('should not block request without critical threats', () => {
      const threats: SecurityEvent[] = [
        {
          type: 'off_hours_access',
          severity: 'low',
          api_key_id: 1,
          ip_address: '192.168.1.100',
          endpoint: '/api/targets',
          description: 'Low severity threat',
          metadata: {},
          timestamp: Date.now()
        }
      ];

      expect(shouldBlockRequest(threats)).toBe(false);
    });

    it('should not block request with no threats', () => {
      expect(shouldBlockRequest([])).toBe(false);
    });
  });
});
