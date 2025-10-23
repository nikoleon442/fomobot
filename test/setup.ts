// Global test setup
import 'reflect-metadata';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

// Global test utilities
global.createMockDate = (dateString: string) => new Date(dateString);
global.createMockBigInt = (value: number) => BigInt(value);
