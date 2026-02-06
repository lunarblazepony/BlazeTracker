import { defineConfig, devices } from '@playwright/experimental-ct-react';
import { resolve } from 'path';

export default defineConfig({
	testDir: './src',
	testMatch: '**/*.pw.tsx',
	snapshotDir: './__snapshots__',
	timeout: 10 * 1000,
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		trace: 'on-first-retry',
		ctPort: 3100,
		ctViteConfig: {
			resolve: {
				alias: {
					'sillytavern-utils-lib/config': resolve(
						__dirname,
						'src/test/mocks/stUtilsConfig.ts',
					),
					'sillytavern-utils-lib/generation': resolve(
						__dirname,
						'src/test/mocks/stUtilsGeneration.ts',
					),
					'sillytavern-utils-lib': resolve(
						__dirname,
						'src/test/mocks/stUtils.ts',
					),
				},
			},
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
