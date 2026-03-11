/**
 * Jest Configuration - Unit Tests
 * This config runs only unit tests (mocked database)
 * For integration tests, use jest.integration.config.js
 */
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/routes/**/*.test.js', '**/tests/services/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db/migrations/**',
    '!src/scripts/**'
  ],
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testTimeout: 10000,
  verbose: true
};
