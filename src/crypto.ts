/**
 * Cryptography utilities for data encryption at rest
 * Uses AES-256-GCM for authenticated encryption
 */

import type { Env } from './types';

/**
 * Encrypt data using AES-256-GCM
 *
 * @param plaintext - Data to encrypt
 * @param env - Environment with ENCRYPTION_KEY
 * @returns Base64-encoded encrypted data (IV + ciphertext + auth tag)
 */
export async function encrypt(plaintext: string, env: Env): Promise<string> {
  if (!plaintext || plaintext.trim() === '') {
    return ''; // Don't encrypt empty strings
  }

  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  // Import encryption key from base64
  const keyData = base64ToArrayBuffer(env.ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the data
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + ciphertext + auth tag
  const encrypted = new Uint8Array(iv.length + ciphertext.byteLength);
  encrypted.set(iv, 0);
  encrypted.set(new Uint8Array(ciphertext), iv.length);

  // Return as base64
  return arrayBufferToBase64(encrypted.buffer);
}

/**
 * Decrypt data encrypted with encrypt()
 *
 * @param ciphertext - Base64-encoded encrypted data
 * @param env - Environment with ENCRYPTION_KEY
 * @returns Decrypted plaintext
 */
export async function decrypt(ciphertext: string, env: Env): Promise<string> {
  if (!ciphertext || ciphertext.trim() === '') {
    return ''; // Return empty string for empty input
  }

  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  // Import encryption key
  const keyData = base64ToArrayBuffer(env.ENCRYPTION_KEY);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decode base64
  const encrypted = new Uint8Array(base64ToArrayBuffer(ciphertext));

  // Extract IV (first 12 bytes)
  const iv = encrypted.slice(0, 12);

  // Extract ciphertext + auth tag
  const data = encrypted.slice(12);

  // Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data - key mismatch or corrupted data');
  }
}

/**
 * Generate a new 256-bit encryption key
 * Run this once and store the output in Cloudflare Secrets
 *
 * @returns Base64-encoded 256-bit key
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = crypto.getRandomValues(new Uint8Array(32)); // 256 bits
  return arrayBufferToBase64(key.buffer);
}

// Helper functions

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt multiple fields in an object
 * Useful for batch encryption operations
 */
export async function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[],
  env: Env
): Promise<T> {
  const result = { ...obj };

  for (const field of fields) {
    if (obj[field] && typeof obj[field] === 'string') {
      (result as Record<string, any>)[field as string] = await encrypt(obj[field] as string, env);
    }
  }

  return result;
}

/**
 * Decrypt multiple fields in an object
 */
export async function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[],
  env: Env
): Promise<T> {
  const result = { ...obj };

  for (const field of fields) {
    if (obj[field] && typeof obj[field] === 'string') {
      (result as Record<string, any>)[field as string] = await decrypt(obj[field] as string, env);
    }
  }

  return result;
}
