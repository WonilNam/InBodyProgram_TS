/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>/miniprogram/hardware-sdk/src/tests',
    '<rootDir>/miniprogram/src/tests'
  ],
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }]
  },
  setupFilesAfterEnv: ['<rootDir>/miniprogram/hardware-sdk/src/tests/setupConsole.ts'],
  moduleFileExtensions: ['ts', 'js'],
  clearMocks: true,
};
