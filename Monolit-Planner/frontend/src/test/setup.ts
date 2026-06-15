// Vitest + Testing Library setup (first frontend test runner, 2026-06-15).
// Auto-clean the DOM between tests. (jest-dom matchers intentionally not
// imported — the current suites use plain vitest matchers + DOM props, and
// the jest-dom/vitest integration clashes with this vitest version.)
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
