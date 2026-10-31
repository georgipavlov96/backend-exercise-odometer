module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/*.e2e.test.ts'],
  testTimeout: 120_000,
};
