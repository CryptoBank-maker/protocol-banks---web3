// Jest setup file for Protocol Banks testing

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Mock crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto as Crypto;
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
