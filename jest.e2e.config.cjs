module.exports = {
  ...require('./jest.config.cjs'),
  roots: ['<rootDir>/tests/e2e'],
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 120_000,
};
