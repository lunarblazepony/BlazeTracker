import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
	test: {
		globals: true,
		include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json-summary'],
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.d.ts'],
		},
		// Use jsdom for React component tests, node for others
		environmentMatchGlobs: [
			['src/**/*.test.tsx', 'jsdom'],
			['src/**/*.test.ts', 'node'],
		],
		setupFiles: ['./src/test/setup.ts'],
		// Mock external modules that have native dependencies
		alias: {
			'sillytavern-utils-lib/config': resolve(__dirname, 'src/test/mocks/stUtilsConfig.ts'),
			'sillytavern-utils-lib/generation': resolve(__dirname, 'src/test/mocks/stUtilsGeneration.ts'),
			'sillytavern-utils-lib': resolve(__dirname, 'src/test/mocks/stUtils.ts'),
		},
	},
});
