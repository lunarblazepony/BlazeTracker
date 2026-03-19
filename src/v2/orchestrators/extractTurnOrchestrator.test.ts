/**
 * extractTurn Orchestrator Tests
 *
 * Tests for the extractTurn entry point, focusing on generator wrapping
 * with training capture and basic flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies that extractTurn imports
vi.mock('../generator', () => ({
	SillyTavernGenerator: vi.fn().mockImplementation(() => ({
		generate: vi.fn().mockResolvedValue('{}'),
		abort: vi.fn(),
	})),
}));

// Track withTrainingCapture calls
const mockWithTrainingCapture = vi.fn((gen: unknown) => gen);
vi.mock('../training', () => ({
	withTrainingCapture: (gen: unknown) => mockWithTrainingCapture(gen),
}));

vi.mock('./extractInitialOrchestrator', () => ({
	extractInitialSnapshot: vi.fn().mockResolvedValue({
		snapshot: {
			time: null,
			location: {
				area: '',
				place: '',
				position: '',
				props: [],
				locationType: 'outdoor',
			},
			forecasts: {},
			climate: null,
			scene: {
				topic: '',
				tone: '',
				tension: { level: 'calm', type: 'none', direction: 'stable' },
			},
			characters: {},
			charactersPresent: [],
			relationships: {},
			currentChapter: 0,
			narrativeEvents: [],
		},
		errors: [],
		aborted: false,
	}),
}));

vi.mock('./extractEventsOrchestrator', () => ({
	extractEvents: vi.fn().mockResolvedValue({
		store: null,
		newEvents: [],
		chapterEnded: false,
		errors: [],
	}),
}));

vi.mock('./chapterInvalidationHandler', () => ({
	handleChapterInvalidation: vi.fn(),
}));

vi.mock('../extractors/utils', () => ({
	buildSwipeContextFromExtraction: vi.fn(() => ({
		getCanonicalSwipeId: () => 0,
	})),
}));

vi.mock('../cardExtensions', () => ({
	readAndResolveCardExtensions: vi.fn(() => null),
	mergeCardExtensionsIntoSnapshot: vi.fn((s: unknown) => s),
	hasEnabledExtensions: vi.fn(() => false),
}));

vi.mock('../../ui/cardDefaultsModal', () => ({
	getPersonaDefaults: vi.fn(() => ({})),
}));

vi.mock('../cardExtensions/personaMerger', () => ({
	mergePersonaDefaultsIntoSnapshot: vi.fn((s: unknown) => s),
}));

vi.mock('../../utils/debug', () => ({
	debugLog: vi.fn(),
	debugWarn: vi.fn(),
	errorLog: vi.fn(),
}));

// Must mock SillyTavern global before importing extractTurn
(globalThis as unknown as { SillyTavern: { getContext: () => unknown } }).SillyTavern = {
	getContext: () => ({ name1: 'User' }),
};

import { extractTurn } from './extractTurnOrchestrator';
import { EventStore } from '../store/EventStore';
import type { ExtractionContext, ExtractionSettings } from '../extractors/types';

function createContext(): ExtractionContext {
	return {
		chat: [
			{
				mes: 'Hello',
				is_user: true,
				is_system: false,
				swipe_id: 0,
				name: 'User',
			},
		],
		characters: [],
		name1: 'User',
		name2: 'Character',
		characterId: 0,
	};
}

function createSettings(): ExtractionSettings {
	return {
		profileId: 'test-profile',
		temperatures: {
			time: 0.3,
			location: 0.5,
			climate: 0.3,
			characters: 0.5,
			relationships: 0.6,
			scene: 0.5,
			narrative: 0.6,
			chapters: 0.6,
		},
		track: {
			time: true,
			location: true,
			props: true,
			climate: true,
			characters: true,
			relationships: true,
			scene: true,
			narrative: true,
			chapters: true,
		},
		customPrompts: {},
		promptTemperatures: {},
		maxMessagesToSend: 10,
		maxChapterMessagesToSend: 24,
		promptPrefix: '',
		promptSuffix: '',
		includeWorldinfo: false,
	};
}

describe('extractTurn', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('wraps provided generator with training capture', async () => {
		const store = new EventStore();
		const mockGen = {
			generate: vi.fn().mockResolvedValue('{}'),
			abort: vi.fn(),
		};

		await extractTurn(store, createContext(), createSettings(), undefined, mockGen);

		expect(mockWithTrainingCapture).toHaveBeenCalledWith(mockGen);
	});

	it('wraps default SillyTavernGenerator with training capture', async () => {
		const store = new EventStore();

		await extractTurn(store, createContext(), createSettings());

		// withTrainingCapture should have been called with a SillyTavernGenerator instance
		expect(mockWithTrainingCapture).toHaveBeenCalledTimes(1);
		expect(mockWithTrainingCapture).toHaveBeenCalledWith(
			expect.objectContaining({
				generate: expect.any(Function),
				abort: expect.any(Function),
			}),
		);
	});
});
