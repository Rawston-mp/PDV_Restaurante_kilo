// Vitest global setup - polyfills
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Mock window.open to avoid jsdom NotImplementedError during tests
if (typeof window !== 'undefined') {
  window.open = vi.fn();
}
