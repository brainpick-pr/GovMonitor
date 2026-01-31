/**
 * Unit tests for encryption utilities
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, generateEncryptionKey, encryptFields, decryptFields } from '../src/crypto';
import type { Env } from '../src/types';

describe('Encryption', () => {
  let testEnv: Partial<Env>;

  beforeAll(async () => {
    // Generate a test encryption key
    const key = await generateEncryptionKey();
    testEnv = {
      ENCRYPTION_KEY: key,
      DISABLE_ENCRYPTION: 'false'
    };
  });

  describe('generateEncryptionKey', () => {
    it('should generate a valid base64-encoded key', async () => {
      const key = await generateEncryptionKey();

      // Should be a string
      expect(typeof key).toBe('string');

      // Should be valid base64
      expect(() => atob(key)).not.toThrow();

      // Should be 256 bits (32 bytes) -> 44 chars in base64
      expect(key.length).toBe(44);
    });

    it('should generate unique keys', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext data', async () => {
      const plaintext = 'Sensitive error message';
      const encrypted = await encrypt(plaintext, testEnv as Env);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(plaintext.length);
    });

    it('should return empty string for empty input', async () => {
      const encrypted = await encrypt('', testEnv as Env);
      expect(encrypted).toBe('');
    });

    it('should return empty string for whitespace-only input', async () => {
      const encrypted = await encrypt('   ', testEnv as Env);
      expect(encrypted).toBe('');
    });

    it('should throw error if ENCRYPTION_KEY is missing', async () => {
      const envWithoutKey = { ENCRYPTION_KEY: undefined };

      await expect(
        encrypt('test', envWithoutKey as Env)
      ).rejects.toThrow('ENCRYPTION_KEY not configured');
    });

    it('should encrypt special characters', async () => {
      const plaintext = 'Error: Connection failed! @#$%^&*() 🔒';
      const encrypted = await encrypt(plaintext, testEnv as Env);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      // Due to random IV, same plaintext should produce different ciphertext
      const plaintext = 'Same message';
      const encrypted1 = await encrypt(plaintext, testEnv as Env);
      const encrypted2 = await encrypt(plaintext, testEnv as Env);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data correctly', async () => {
      const plaintext = 'Sensitive error message';
      const encrypted = await encrypt(plaintext, testEnv as Env);
      const decrypted = await decrypt(encrypted, testEnv as Env);

      expect(decrypted).toBe(plaintext);
    });

    it('should return empty string for empty input', async () => {
      const decrypted = await decrypt('', testEnv as Env);
      expect(decrypted).toBe('');
    });

    it('should throw error if ENCRYPTION_KEY is missing', async () => {
      const envWithoutKey = { ENCRYPTION_KEY: undefined };
      const encrypted = await encrypt('test', testEnv as Env);

      await expect(
        decrypt(encrypted, envWithoutKey as Env)
      ).rejects.toThrow('ENCRYPTION_KEY not configured');
    });

    it('should throw error for invalid ciphertext', async () => {
      await expect(
        decrypt('invalid-ciphertext', testEnv as Env)
      ).rejects.toThrow();
    });

    it('should throw error for corrupted ciphertext', async () => {
      const plaintext = 'Test message';
      const encrypted = await encrypt(plaintext, testEnv as Env);

      // Corrupt the ciphertext by changing a character
      const corrupted = encrypted.substring(0, encrypted.length - 5) + 'ZZZZZ';

      await expect(
        decrypt(corrupted, testEnv as Env)
      ).rejects.toThrow();
    });

    it('should fail with wrong encryption key', async () => {
      const plaintext = 'Secret message';
      const encrypted = await encrypt(plaintext, testEnv as Env);

      // Generate a different key
      const wrongKey = await generateEncryptionKey();
      const envWithWrongKey = { ENCRYPTION_KEY: wrongKey };

      await expect(
        decrypt(encrypted, envWithWrongKey as Env)
      ).rejects.toThrow();
    });

    it('should decrypt special characters correctly', async () => {
      const plaintext = 'Error: Connection failed! @#$%^&*() 🔒';
      const encrypted = await encrypt(plaintext, testEnv as Env);
      const decrypted = await decrypt(encrypted, testEnv as Env);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('encryptFields', () => {
    it('should encrypt specified fields in an object', async () => {
      const obj = {
        id: 123,
        name: 'Test',
        error: 'Connection failed',
        message: 'Internal server error'
      };

      const encrypted = await encryptFields(obj, ['error', 'message'], testEnv as Env);

      expect(encrypted.id).toBe(123);
      expect(encrypted.name).toBe('Test');
      expect(encrypted.error).not.toBe('Connection failed');
      expect(encrypted.message).not.toBe('Internal server error');
    });

    it('should not encrypt non-string fields', async () => {
      const obj = {
        id: 123,
        count: 456,
        error: 'Failed'
      };

      const encrypted = await encryptFields(obj, ['id', 'count', 'error'], testEnv as Env);

      expect(encrypted.id).toBe(123); // Number, not encrypted
      expect(encrypted.count).toBe(456); // Number, not encrypted
      expect(encrypted.error).not.toBe('Failed'); // String, encrypted
    });

    it('should handle null/undefined fields', async () => {
      const obj = {
        error: null,
        message: undefined,
        warning: 'Test'
      };

      const encrypted = await encryptFields(obj, ['error', 'message', 'warning'], testEnv as Env);

      expect(encrypted.error).toBeNull();
      expect(encrypted.message).toBeUndefined();
      expect(encrypted.warning).not.toBe('Test');
    });
  });

  describe('decryptFields', () => {
    it('should decrypt specified fields in an object', async () => {
      const obj = {
        id: 123,
        name: 'Test',
        error: 'Connection failed',
        message: 'Internal server error'
      };

      const encrypted = await encryptFields(obj, ['error', 'message'], testEnv as Env);
      const decrypted = await decryptFields(encrypted, ['error', 'message'], testEnv as Env);

      expect(decrypted.id).toBe(123);
      expect(decrypted.name).toBe('Test');
      expect(decrypted.error).toBe('Connection failed');
      expect(decrypted.message).toBe('Internal server error');
    });

    it('should handle empty objects', async () => {
      const obj = {};
      const decrypted = await decryptFields(obj, [], testEnv as Env);

      expect(decrypted).toEqual({});
    });
  });

  describe('End-to-end encryption', () => {
    it('should handle long messages', async () => {
      const longText = 'A'.repeat(10000);
      const encrypted = await encrypt(longText, testEnv as Env);
      const decrypted = await decrypt(encrypted, testEnv as Env);

      expect(decrypted).toBe(longText);
    });

    it('should handle unicode characters', async () => {
      const unicode = '你好世界 🌍 Здравствуй мир 🚀 مرحبا بالعالم';
      const encrypted = await encrypt(unicode, testEnv as Env);
      const decrypted = await decrypt(encrypted, testEnv as Env);

      expect(decrypted).toBe(unicode);
    });

    it('should handle JSON strings', async () => {
      const jsonData = JSON.stringify({
        error: 'Connection timeout',
        details: { host: 'example.gov', port: 443 },
        timestamp: Date.now()
      });

      const encrypted = await encrypt(jsonData, testEnv as Env);
      const decrypted = await decrypt(encrypted, testEnv as Env);

      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });
  });
});
