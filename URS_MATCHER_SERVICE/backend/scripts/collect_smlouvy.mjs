#!/usr/bin/env node
/**
 * CLI: Collect smlouvy from Hlídač státu API
 *
 * Usage:
 *   HLIDAC_API_TOKEN=... node scripts/collect_smlouvy.mjs [--query "KRYCÍ LIST"] [--pages 10]
 *
 * Env vars:
 *   HLIDAC_API_TOKEN  — API token (required)
 *   DATABASE_URL      — SQLite DB path (default: file:./data/urs_matcher.db)
 */

import { startCollection, getCollectionStatus } from '../src/services/smlouvyCollector.js';

const args = process.argv.slice(2);
const queryIdx = args.indexOf('--query');
const pagesIdx = args.indexOf('--pages');

const query = queryIdx >= 0 ? args[queryIdx + 1] : 'KRYCÍ LIST SOUPISU';
const maxPages = pagesIdx >= 0 ? parseInt(args[pagesIdx + 1]) : 10;

if (!process.env.HLIDAC_API_TOKEN) {
  console.error('ERROR: Set HLIDAC_API_TOKEN environment variable');
  console.error('Usage: HLIDAC_API_TOKEN=... node scripts/collect_smlouvy.mjs');
  process.exit(1);
}

console.log(`Starting collection: "${query}" (max ${maxPages} pages)`);
console.log(`Rate limit: 1 req/10s — this will take ~${maxPages * 30}s minimum`);
console.log('');

try {
  await startCollection({ query, maxPages });

  // Poll status
  const poll = setInterval(() => {
    const status = getCollectionStatus();
    process.stdout.write(
      `\r  ${status.processed}/${status.total} smlouvy | ${status.withData} with data | ${status.positions} positions | ${status.elapsed}s`
    );
    if (status.status !== 'running') {
      clearInterval(poll);
      console.log(`\n\nDone: ${status.status}`);
      console.log(JSON.stringify(status, null, 2));
      process.exit(0);
    }
  }, 2000);
} catch (err) {
  console.error('Collection failed:', err.message);
  process.exit(1);
}
