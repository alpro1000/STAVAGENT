/**
 * Test Server Setup
 * Creates an Express app with test database for integration tests
 */

import express from 'express';
import { createTestDbAdapter } from './test-db.js';

/**
 * Create test server with mocked database
 */
export async function createTestServer() {
  const app = express();
  app.use(express.json());

  // Create test database adapter
  const testDb = createTestDbAdapter();

  // Mock the db module globally for this test
  // This is a workaround since ES module mocking is complex
  global.TEST_DB = testDb;

  // Import routes (they will use the real db module, but we'll intercept it)
  // For now, we'll use a simple stub until we refactor routes to support DI

  return app;
}
