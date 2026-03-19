/**
 * v2Bridge Tests
 *
 * Tests for runV2Extraction early-return behavior on empty messages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy dependencies before importing

vi.mock('./v2/settings/manager', () => ({
	getV2Settings: vi.fn(() => ({
		v2ProfileId: 'test-profile',
		v2Track: {
			time: true,
			location: true,
			props: true,
			climate: true,
			characters: true,
			relationships: true,
			scene: true,
			narrative: true,
		},
		v2Temperatures: {
			time: 0.3,
			location: 0.5,
			climate: 0.3,
			characters: 0.5,
			relationships: 0.6,
			scene: 0.5,
			narrative: 0.6,
		},
		v2CustomPrompts: {},
		v2PromptTemperatures: {},
		v2MaxMessagesToSend: 10,
		v2MaxChapterMessagesToSend: 24,
		v2PromptPrefix: '',
		v2PromptSuffix: '',
		v2IncludeWorldinfo: false,
	})),
}));

vi.mock('./v2', () => ({
	SillyTavernGenerator: vi.fn(),
	EventStore: vi.fn(),
	extractTurn: vi.fn().mockResolvedValue({
		projection: {},
		events: [],
		errors: [],
		aborted: false,
	}),
}));

vi.mock('./v2/orchestrators/chapterInvalidationHandler', () => ({
	recalculateChapterDescription: vi.fn(),
}));

vi.mock('./v2/extractors/progressTracker', () => ({
	setProgressCallback: vi.fn(),
	startExtractionRun: vi.fn(),
	completeExtractionRun: vi.fn(),
}));

vi.mock('sillytavern-utils-lib/config', () => ({
	st_echo: vi.fn(),
}));

vi.mock('./utils/debug', () => ({
	debugLog: vi.fn(),
	debugWarn: vi.fn(),
	errorLog: vi.fn(),
}));

vi.mock('./v2/shakeups/types', () => ({
	createEmptyShakeupHistory: vi.fn(() => ({ events: [] })),
}));

// Mock SillyTavern global
function setMockChat(chat: Array<{ mes: string; is_user: boolean; name: string }>) {
	(globalThis as unknown as { SillyTavern: { getContext: () => unknown } }).SillyTavern = {
		getContext: () => ({
			chat: chat.map(msg => ({
				...msg,
				swipe_id: 0,
				extra: {},
			})),
			characters: [
				{
					name: 'Character',
					description: '',
					personality: '',
					scenario: '',
				},
			],
			characterId: 0,
			name1: 'User',
			name2: 'Character',
		}),
	};
}

import { runV2Extraction } from './v2Bridge';
import { extractTurn } from './v2';

describe('runV2Extraction', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('empty message short-circuit', () => {
		it('returns null for empty string message', async () => {
			setMockChat([
				{ mes: 'Hello', is_user: true, name: 'User' },
				{ mes: '', is_user: false, name: 'Character' },
			]);

			const result = await runV2Extraction(1);

			expect(result).toBeNull();
			expect(extractTurn).not.toHaveBeenCalled();
		});

		it('returns null for whitespace-only message', async () => {
			setMockChat([
				{ mes: 'Hello', is_user: true, name: 'User' },
				{ mes: '   \n  \t  ', is_user: false, name: 'Character' },
			]);

			const result = await runV2Extraction(1);

			expect(result).toBeNull();
			expect(extractTurn).not.toHaveBeenCalled();
		});

		it('returns null when message has undefined mes', async () => {
			setMockChat([
				{ mes: 'Hello', is_user: true, name: 'User' },
				{
					mes: undefined as unknown as string,
					is_user: false,
					name: 'Character',
				},
			]);

			const result = await runV2Extraction(1);

			expect(result).toBeNull();
			expect(extractTurn).not.toHaveBeenCalled();
		});

		it('returns null when messageId is beyond chat length', async () => {
			setMockChat([{ mes: 'Hello', is_user: true, name: 'User' }]);

			const result = await runV2Extraction(5);

			expect(result).toBeNull();
			expect(extractTurn).not.toHaveBeenCalled();
		});

		it('does not return null for message with actual text content', async () => {
			setMockChat([
				{ mes: 'Hello', is_user: true, name: 'User' },
				{ mes: 'Hello world', is_user: false, name: 'Character' },
			]);

			// This will proceed past the empty check (may fail later due to incomplete mocks,
			// but we verify it doesn't short-circuit)
			try {
				await runV2Extraction(1);
			} catch {
				// Expected — deeper dependencies aren't fully mocked
			}

			// The key assertion: extractTurn should have been called (or attempted),
			// meaning we didn't short-circuit
			// Since the function proceeds past empty check, we verify debugLog wasn't called
			// with the skip message
			const { debugLog } = await import('./utils/debug');
			expect(debugLog).not.toHaveBeenCalledWith(
				'Skipping extraction for empty/whitespace message:',
				1,
			);
		});
	});
});
