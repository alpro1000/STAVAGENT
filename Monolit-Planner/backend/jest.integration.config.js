/**
 * Jest Configuration - Integration Tests
 * This config runs integration tests with real database
 */
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.integration.test.js'],
  coverageDirectory: 'coverage-integration',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db/migrations/**',
    '!src/scripts/**'
  ],
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testTimeout: 30000, // Longer timeout for integration tests
  verbose: true,
  // Run tests sequentially to avoid database conflicts
  maxWorkers: 1
};
