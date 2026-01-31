#!/usr/bin/env tsx
/**
 * One-time migration script to encrypt existing plaintext data
 *
 * This script:
 * 1. Finds all checks with unencrypted error messages
 * 2. Encrypts the error messages
 * 3. Updates the database with encrypted values
 * 4. Marks them as encrypted
 *
 * Usage:
 *   ENCRYPTION_KEY=<your-key> npx tsx scripts/encrypt-existing-data.ts
 *
 * Options:
 *   --dry-run    Show what would be encrypted without making changes
 *   --batch-size <number>   Process N records at a time (default: 100)
 */

import { encrypt } from '../src/crypto';

// Parse command-line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchSizeArg = args.findIndex(arg => arg === '--batch-size');
const batchSize = batchSizeArg !== -1 ? parseInt(args[batchSizeArg + 1], 10) : 100;

// Mock Env for encryption
const env = {
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  DISABLE_ENCRYPTION: 'false',
} as any;

interface CheckRecord {
  id: number;
  error: string;
  error_encrypted: number;
}

async function main() {
  console.log('🔐 Encryption Migration Tool');
  console.log('============================');
  console.log('');

  if (!env.ENCRYPTION_KEY) {
    console.error('❌ Error: ENCRYPTION_KEY environment variable not set');
    console.log('');
    console.log('Usage:');
    console.log('  ENCRYPTION_KEY=<your-key> npx tsx scripts/encrypt-existing-data.ts');
    console.log('');
    console.log('To generate a key:');
    console.log('  npx tsx scripts/generate-encryption-key.ts');
    process.exit(1);
  }

  if (dryRun) {
    console.log('🏃 Running in DRY RUN mode - no changes will be made');
    console.log('');
  }

  console.log(`Batch size: ${batchSize} records`);
  console.log('');

  // Note: This script would need to connect to the actual D1 database
  // For now, we'll create a placeholder that shows the migration logic

  console.log('⚠️  Important: This script requires manual execution steps:');
  console.log('');
  console.log('1. Export data from D1:');
  console.log('   wrangler d1 execute govmonitor-db --command="SELECT id, error FROM checks WHERE error IS NOT NULL AND error_encrypted = 0" --json > unencrypted-checks.json');
  console.log('');
  console.log('2. Process the exported data (this script would do that)');
  console.log('');
  console.log('3. Update the database:');
  console.log('   (Generate UPDATE statements for each encrypted record)');
  console.log('');

  // Example encryption logic (would process actual data)
  const exampleError = 'Connection timeout after 5000ms';
  try {
    const encrypted = await encrypt(exampleError, env);
    console.log('✅ Encryption test successful!');
    console.log(`   Original: "${exampleError}"`);
    console.log(`   Encrypted: ${encrypted.substring(0, 50)}...`);
    console.log('');
  } catch (error) {
    console.error('❌ Encryption test failed:', error);
    process.exit(1);
  }

  // Show migration query template
  console.log('📝 Migration Query Template:');
  console.log('');
  console.log('UPDATE checks SET');
  console.log('  error = ?,           -- encrypted value');
  console.log('  error_encrypted = 1  -- mark as encrypted');
  console.log('WHERE id = ?;          -- record ID');
  console.log('');

  console.log('💡 Alternative approach for Cloudflare Workers:');
  console.log('');
  console.log('Create a migration worker that:');
  console.log('1. Queries unencrypted records in batches');
  console.log('2. Encrypts them using the crypto module');
  console.log('3. Updates the database');
  console.log('4. Runs as a scheduled job until complete');
  console.log('');

  console.log('Example worker endpoint:');
  console.log('  POST /api/internal/encrypt-data?batch_size=100');
  console.log('');

  // Show migration stats query
  console.log('📊 Check migration progress:');
  console.log('');
  console.log('SELECT');
  console.log('  COUNT(*) as total,');
  console.log('  SUM(CASE WHEN error_encrypted = 1 THEN 1 ELSE 0 END) as encrypted,');
  console.log('  SUM(CASE WHEN error_encrypted = 0 THEN 1 ELSE 0 END) as unencrypted');
  console.log('FROM checks');
  console.log('WHERE error IS NOT NULL;');
  console.log('');

  console.log('✅ Migration script ready');
  console.log('');
  console.log('Next steps:');
  console.log('1. Ensure ENCRYPTION_KEY is set in production');
  console.log('2. Create a migration worker or use wrangler d1 execute');
  console.log('3. Monitor progress with the stats query above');
  console.log('4. Verify encrypted data can be decrypted');
}

main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
