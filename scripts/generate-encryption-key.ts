#!/usr/bin/env tsx
/**
 * Generate a 256-bit encryption key for AES-256-GCM
 *
 * Usage:
 *   npx tsx scripts/generate-encryption-key.ts
 *
 * Then add the key to Cloudflare Secrets:
 *   wrangler secret put ENCRYPTION_KEY
 *
 * For local development, add to .dev.vars:
 *   echo "ENCRYPTION_KEY=<key>" >> .dev.vars
 */

// Node.js crypto for key generation
import { randomBytes } from 'crypto';

async function generateKey() {
  // Generate 32 random bytes (256 bits)
  const key = randomBytes(32);

  // Encode as base64
  const keyBase64 = key.toString('base64');

  console.log('🔐 Generated 256-bit AES encryption key:');
  console.log('');
  console.log(keyBase64);
  console.log('');
  console.log('📋 Next steps:');
  console.log('');
  console.log('1. Production (Cloudflare):');
  console.log('   wrangler secret put ENCRYPTION_KEY');
  console.log('   (Paste the key above when prompted)');
  console.log('');
  console.log('2. Local development (.dev.vars):');
  console.log(`   echo "ENCRYPTION_KEY=${keyBase64}" >> .dev.vars`);
  console.log('');
  console.log('⚠️  IMPORTANT: Keep this key secure and backed up!');
  console.log('   Without it, encrypted data cannot be decrypted.');
}

generateKey().catch(console.error);
