/**
 * Jest Setup File (runs in each worker after test framework is initialized)
 * Registers afterAll hook to close database connections and prevent open handle leaks
 */

import { closeDatabase } from '../src/db/init.js';

afterAll(async () => {
  await closeDatabase();
});
