/**
 * Macros Tests
 *
 * Tests for ST macro registration and handler behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EventStore } from '../store/EventStore';

// Mock dependencies
vi.mock('../settings', () => ({
	getV2Settings: vi.fn(() => ({
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
		v2MaxRecentChapters: 5,
		v2MaxRecentEvents: 15,
	})),
}));

vi.mock('./state', () => ({
	formatStateForInjection: vi.fn(() => '[Scene State]\nTest state\n[/Scene State]'),
}));

vi.mock('./chapters', () => ({
	formatPastChaptersWithTags: vi.fn(() => ''),
}));

vi.mock('./events', () => ({
	getAllCurrentChapterEvents: vi.fn(() => []),
	formatOutOfContextEvents: vi.fn(() => ''),
}));

// Mock SillyTavern global
const mockRegisterMacro = vi.fn();
const mockUnregisterMacro = vi.fn();
const mockChat = [
	{ mes: 'Hello', is_user: true },
	{ mes: 'Hi there!', is_user: false },
	{ mes: 'How are you?', is_user: true },
];
const mockContext = {
	chat: mockChat,
	registerMacro: mockRegisterMacro,
	unregisterMacro: mockUnregisterMacro,
};

(globalThis as unknown as { SillyTavern: { getContext: () => typeof mockContext } }).SillyTavern = {
	getContext: () => mockContext,
};

// Import after mocking
import { registerMacros, unregisterMacros, registerMacroBridgeFunctions } from './macros';
import { getV2Settings } from '../settings';
import { formatStateForInjection } from './state';
import { formatPastChaptersWithTags } from './chapters';
import { getAllCurrentChapterEvents, formatOutOfContextEvents } from './events';

const mockGetV2Settings = vi.mocked(getV2Settings);
const mockFormatState = vi.mocked(formatStateForInjection);
const mockFormatChapters = vi.mocked(formatPastChaptersWithTags);
const mockGetAllEvents = vi.mocked(getAllCurrentChapterEvents);
const mockFormatEvents = vi.mocked(formatOutOfContextEvents);

// ============================================
// Test Setup
// ============================================

describe('macros', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ============================================
	// Registration Tests
	// ============================================

	describe('registerMacros', () => {
		it('registers btState macro', () => {
			registerMacros();

			expect(mockRegisterMacro).toHaveBeenCalledWith(
				'btState',
				expect.any(Function),
				expect.any(String),
			);
		});

		it('registers btNarrative macro', () => {
			registerMacros();

			expect(mockRegisterMacro).toHaveBeenCalledWith(
				'btNarrative',
				expect.any(Function),
				expect.any(String),
			);
		});

		it('registers both macros', () => {
			registerMacros();

			expect(mockRegisterMacro).toHaveBeenCalledTimes(2);
		});

		it('does not throw when registerMacro is unavailable', () => {
			const original = mockContext.registerMacro;
			mockContext.registerMacro =
				undefined as unknown as typeof mockRegisterMacro;

			expect(() => registerMacros()).not.toThrow();

			mockContext.registerMacro = original;
		});
	});

	// ============================================
	// Unregistration Tests
	// ============================================

	describe('unregisterMacros', () => {
		it('unregisters btState macro', () => {
			unregisterMacros();

			expect(mockUnregisterMacro).toHaveBeenCalledWith('btState');
		});

		it('unregisters btNarrative macro', () => {
			unregisterMacros();

			expect(mockUnregisterMacro).toHaveBeenCalledWith('btNarrative');
		});

		it('does not throw when unregisterMacro is unavailable', () => {
			const original = mockContext.unregisterMacro;
			mockContext.unregisterMacro =
				undefined as unknown as typeof mockUnregisterMacro;

			expect(() => unregisterMacros()).not.toThrow();

			mockContext.unregisterMacro = original;
		});
	});

	// ============================================
	// registerMacroBridgeFunctions Tests
	// ============================================

	describe('registerMacroBridgeFunctions', () => {
		it('accepts bridge functions without error', () => {
			const mockBridgeFunctions = {
				getV2EventStore: vi.fn(() => null),
				hasV2InitialSnapshot: vi.fn(() => false),
				buildSwipeContext: vi.fn(() => ({ getCanonicalSwipeId: () => 0 })),
			};

			expect(() =>
				registerMacroBridgeFunctions(mockBridgeFunctions),
			).not.toThrow();
		});
	});
});

// ============================================
// Handler Behavior Tests
// ============================================

describe('macro handlers', () => {
	let btStateHandler: () => string;
	let btNarrativeHandler: () => string;

	const mockStore = {
		projectStateAtMessage: vi.fn(() => ({
			time: null,
			location: null,
			forecasts: {},
			climate: null,
			scene: null,
			characters: {},
			charactersPresent: [],
			relationships: {},
			currentChapter: 0,
			source: { messageId: 1, swipeId: 0 },
		})),
	};

	const mockSwipeContext = {
		getCanonicalSwipeId: () => 0,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Capture the handlers when they're registered
		mockRegisterMacro.mockImplementation(
			(key: string, handler: string | (() => string)) => {
				if (key === 'btState') {
					btStateHandler = handler as () => string;
				} else if (key === 'btNarrative') {
					btNarrativeHandler = handler as () => string;
				}
			},
		);

		// Register bridge functions with mock store
		registerMacroBridgeFunctions({
			getV2EventStore: () => mockStore as unknown as EventStore,
			hasV2InitialSnapshot: () => true,
			buildSwipeContext: () => mockSwipeContext,
		});

		// Register macros to capture handlers
		registerMacros();
	});

	// ============================================
	// btState Handler Tests
	// ============================================

	describe('btState handler', () => {
		it('returns formatted state when store is available', () => {
			mockFormatState.mockReturnValue(
				'[Scene State]\nTest state\n[/Scene State]',
			);

			const result = btStateHandler();

			expect(result).toBe('[Scene State]\nTest state\n[/Scene State]');
		});

		it('calls formatStateForInjection with correct options', () => {
			btStateHandler();

			expect(mockFormatState).toHaveBeenCalledWith(
				expect.any(Object),
				mockStore,
				mockSwipeContext,
				expect.objectContaining({
					includeTime: true,
					includeLocation: true,
					includeClimate: true,
					includeCharacters: true,
					includeRelationships: true,
					includeScene: true,
					includeChapters: false,
					includeEvents: false,
				}),
			);
		});

		it('returns empty string when bridge functions are not registered', () => {
			// Reset bridge functions to null
			registerMacroBridgeFunctions(null);

			const result = btStateHandler();

			expect(result).toBe('');
		});

		it('returns empty string when store is unavailable', () => {
			// Re-register bridge functions with no store
			registerMacroBridgeFunctions({
				getV2EventStore: () => null,
				hasV2InitialSnapshot: () => false,
				buildSwipeContext: () => mockSwipeContext,
			});

			const result = btStateHandler();

			expect(result).toBe('');
		});

		it('returns empty string when bridge functions throw', () => {
			registerMacroBridgeFunctions({
				getV2EventStore: () => {
					throw new Error('Store error');
				},
				hasV2InitialSnapshot: () => false,
				buildSwipeContext: () => mockSwipeContext,
			});

			const result = btStateHandler();

			expect(result).toBe('');
		});

		it('returns empty string when no initial snapshot', () => {
			registerMacroBridgeFunctions({
				getV2EventStore: () => mockStore as unknown as EventStore,
				hasV2InitialSnapshot: () => false,
				buildSwipeContext: () => mockSwipeContext,
			});

			const result = btStateHandler();

			expect(result).toBe('');
		});

		it('returns empty string when chat has only one message', () => {
			const originalChat = mockContext.chat;
			mockContext.chat = [{ mes: 'Hello', is_user: true }];

			const result = btStateHandler();

			expect(result).toBe('');
			mockContext.chat = originalChat;
		});

		it('returns empty string when projection throws', () => {
			mockStore.projectStateAtMessage.mockImplementation(() => {
				throw new Error('Projection failed');
			});

			const result = btStateHandler();

			expect(result).toBe('');

			// Restore
			mockStore.projectStateAtMessage.mockReturnValue({
				time: null,
				location: null,
				forecasts: {},
				climate: null,
				scene: null,
				characters: {},
				charactersPresent: [],
				relationships: {},
				currentChapter: 0,
				source: { messageId: 1, swipeId: 0 },
			});
		});

		it('respects track settings', () => {
			mockGetV2Settings.mockReturnValue({
				v2Track: {
					time: false,
					location: true,
					props: true,
					climate: false,
					characters: true,
					relationships: false,
					scene: true,
					narrative: true,
				},
				v2MaxRecentChapters: 5,
				v2MaxRecentEvents: 15,
			} as ReturnType<typeof getV2Settings>);

			btStateHandler();

			expect(mockFormatState).toHaveBeenCalledWith(
				expect.any(Object),
				mockStore,
				mockSwipeContext,
				expect.objectContaining({
					includeTime: false,
					includeLocation: true,
					includeClimate: false,
					includeCharacters: true,
					includeRelationships: false,
					includeScene: true,
				}),
			);
		});
	});

	// ============================================
	// btNarrative Handler Tests
	// ============================================

	describe('btNarrative handler', () => {
		it('returns empty string when no chapters or events', () => {
			mockFormatChapters.mockReturnValue('');
			mockGetAllEvents.mockReturnValue([]);

			const result = btNarrativeHandler();

			expect(result).toBe('');
		});

		it('returns chapters when available', () => {
			mockFormatChapters.mockReturnValue(
				'[Story So Far]\nChapter 1: Test\n  Summary\n[/Story So Far]',
			);
			mockGetAllEvents.mockReturnValue([]);

			const result = btNarrativeHandler();

			expect(result).toContain('[Story So Far]');
			expect(result).toContain('Chapter 1: Test');
		});

		it('returns events when available', () => {
			mockFormatChapters.mockReturnValue('');
			mockGetAllEvents.mockReturnValue([
				{
					description: 'Something happened',
					witnesses: ['Alice'],
					subjects: [],
					source: { messageId: 1, swipeId: 0 },
				},
			] as never[]);
			mockFormatEvents.mockReturnValue('- Something happened');

			const result = btNarrativeHandler();

			expect(result).toContain('[Recent Events]');
			expect(result).toContain('- Something happened');
		});

		it('returns both chapters and events when available', () => {
			mockFormatChapters.mockReturnValue(
				'[Story So Far]\nChapter 1: Test\n[/Story So Far]',
			);
			mockGetAllEvents.mockReturnValue([
				{
					description: 'Event',
					witnesses: [],
					subjects: [],
					source: { messageId: 1, swipeId: 0 },
				},
			] as never[]);
			mockFormatEvents.mockReturnValue('- Event');

			const result = btNarrativeHandler();

			expect(result).toContain('[Story So Far]');
			expect(result).toContain('[Recent Events]');
		});

		it('calls formatPastChaptersWithTags with settings', () => {
			btNarrativeHandler();

			expect(mockFormatChapters).toHaveBeenCalledWith(
				mockStore,
				mockSwipeContext,
				5,
			);
		});

		it('calls getAllCurrentChapterEvents with current chapter', () => {
			btNarrativeHandler();

			expect(mockGetAllEvents).toHaveBeenCalledWith(
				mockStore,
				mockSwipeContext,
				0, // currentChapter from mock projection
			);
		});

		it('returns empty string when bridge functions are not registered', () => {
			registerMacroBridgeFunctions(null);

			const result = btNarrativeHandler();

			expect(result).toBe('');
		});

		it('returns empty string when store is unavailable', () => {
			registerMacroBridgeFunctions({
				getV2EventStore: () => null,
				hasV2InitialSnapshot: () => false,
				buildSwipeContext: () => mockSwipeContext,
			});

			const result = btNarrativeHandler();

			expect(result).toBe('');
		});

		it('returns empty string when bridge functions throw', () => {
			registerMacroBridgeFunctions({
				getV2EventStore: () => {
					throw new Error('Store error');
				},
				hasV2InitialSnapshot: () => false,
				buildSwipeContext: () => mockSwipeContext,
			});

			const result = btNarrativeHandler();

			expect(result).toBe('');
		});

		it('returns empty string when no initial snapshot', () => {
			registerMacroBridgeFunctions({
				getV2EventStore: () => mockStore as unknown as EventStore,
				hasV2InitialSnapshot: () => false,
				buildSwipeContext: () => mockSwipeContext,
			});

			const result = btNarrativeHandler();

			expect(result).toBe('');
		});

		it('returns empty string when chat has only one message', () => {
			const originalChat = mockContext.chat;
			mockContext.chat = [{ mes: 'Hello', is_user: true }];

			const result = btNarrativeHandler();

			expect(result).toBe('');
			mockContext.chat = originalChat;
		});

		it('returns empty string when projection throws', () => {
			mockStore.projectStateAtMessage.mockImplementation(() => {
				throw new Error('Projection failed');
			});

			const result = btNarrativeHandler();

			expect(result).toBe('');

			// Restore
			mockStore.projectStateAtMessage.mockReturnValue({
				time: null,
				location: null,
				forecasts: {},
				climate: null,
				scene: null,
				characters: {},
				charactersPresent: [],
				relationships: {},
				currentChapter: 0,
				source: { messageId: 1, swipeId: 0 },
			});
		});

		it('respects maxRecentChapters setting', () => {
			mockGetV2Settings.mockReturnValue({
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
				v2MaxRecentChapters: 3,
				v2MaxRecentEvents: 10,
			} as ReturnType<typeof getV2Settings>);

			btNarrativeHandler();

			expect(mockFormatChapters).toHaveBeenCalledWith(
				mockStore,
				mockSwipeContext,
				3,
			);
		});

		it('respects maxRecentEvents setting', () => {
			mockGetV2Settings.mockReturnValue({
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
				v2MaxRecentChapters: 5,
				v2MaxRecentEvents: 10,
			} as ReturnType<typeof getV2Settings>);

			mockGetAllEvents.mockReturnValue([
				{
					description: 'Event',
					witnesses: [],
					subjects: [],
					source: { messageId: 1, swipeId: 0 },
				},
			] as never[]);
			mockFormatEvents.mockReturnValue('- Event');

			btNarrativeHandler();

			expect(mockFormatEvents).toHaveBeenCalledWith(expect.any(Array), 10);
		});
	});
});
