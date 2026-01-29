// Test setup for Vitest + React Testing Library
import '@testing-library/jest-dom';

// Note: sillytavern-utils-lib mocks are set up in vitest.config.ts via alias

// Mock SillyTavern global if needed for component tests
// Use type assertion to avoid TS errors with globalThis extension
const globalAny = globalThis as Record<string, unknown>;
if (typeof globalAny.SillyTavern === 'undefined') {
	globalAny.SillyTavern = {
		getContext: () => ({
			chat: [],
			characters: [],
			eventSource: {
				on: () => {},
				off: () => {},
				emit: () => {},
			},
		}),
	};
}
