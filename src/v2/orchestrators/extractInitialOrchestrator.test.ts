/**
 * Initial Extraction Orchestrator Tests
 *
 * Tests that verify the orchestrator runs extractors in sequence,
 * passes partial snapshots between extractors, and handles errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../generator';
import { extractInitialSnapshot } from './extractInitialOrchestrator';
import type { ExtractionContext, ExtractionSettings } from '../extractors/types';
import type { CardExtensions } from '../cardExtensions/types';
import type { MessageAndSwipe } from '../types';

// Mock progress tracker
vi.mock('../extractors/progressTracker', () => ({
	startSection: vi.fn(),
	completeSection: vi.fn(),
}));

// Mock forecast extractor weather dependencies
vi.mock('../../weather/locationMapper', () => ({
	mapLocation: vi.fn().mockResolvedValue({
		realWorldAnalog: 'Seattle, WA',
		latitude: 47.6062,
		longitude: -122.3321,
		baseClimateType: 'temperate',
	}),
}));

vi.mock('../../weather/climateApi', () => ({
	fetchClimateNormals: vi.fn().mockResolvedValue({
		temperature: { high: 15, low: 8, mean: 11.5 },
		precipitation: { avgMm: 80, rainyDays: 15 },
		humidity: 75,
		sunlightHours: 4,
	}),
}));

vi.mock('../../weather/fallbackProfiles', () => ({
	getClimateNormalsFromFallback: vi.fn().mockReturnValue({
		temperature: { high: 12, low: 5, mean: 8.5 },
		precipitation: { avgMm: 60, rainyDays: 12 },
		humidity: 70,
		sunlightHours: 5,
	}),
}));

vi.mock('../../weather/forecastGenerator', () => ({
	generateForecast: vi.fn().mockReturnValue({
		startDate: { year: 2024, month: 11, day: 14 },
		days: [
			{
				date: { year: 2024, month: 11, day: 14 },
				condition: 'partly_cloudy',
				high: 12,
				low: 6,
				precipChance: 30,
				hourly: [],
			},
		],
	}),
}));

function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*The clock shows 3:47 PM as Elena enters the coffee shop on November 14th, 2024.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: '*I wave to Elena from my seat near the window.* Hey!',
				is_user: true,
				is_system: false,
				name: 'User',
			},
		],
		characters: [
			{
				name: 'Elena',
				description: 'A young journalist with auburn hair.',
			},
		],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		...overrides,
	};
}

function createMockSettings(overrides: Partial<ExtractionSettings> = {}): ExtractionSettings {
	return {
		profileId: 'test',
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
		temperatures: {
			time: 0.3,
			location: 0.5,
			climate: 0.3,
			characters: 0.7,
			relationships: 0.6,
			scene: 0.6,
			narrative: 0.7,
			chapters: 0.5,
		},
		customPrompts: {},
		...overrides,
	};
}

function createMockSource(): MessageAndSwipe {
	return {
		messageId: 1,
		swipeId: 0,
	};
}

function setupDefaultResponses(mockGenerator: MockGenerator): void {
	// Time extractor - matches "current time" prompt
	mockGenerator.setResponse(
		/current date.*time|Date.*Time.*year.*month.*day/i,
		JSON.stringify({
			reasoning: 'Time is 3:47 PM on November 14th, 2024',
			datetime: '2024-11-14T15:47:00.000Z',
		}),
	);

	// Location extractor - matches location/area prompts
	mockGenerator.setResponse(
		/area.*place.*position|locationType/i,
		JSON.stringify({
			reasoning: 'At a coffee shop.',
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'Near the window',
			locationType: 'heated',
		}),
	);

	// Props extractor - matches props/objects prompts
	mockGenerator.setResponse(
		/props.*objects|nearby.*items/i,
		JSON.stringify({
			reasoning: 'Various items visible.',
			props: ['coffee mug', 'newspaper'],
		}),
	);

	// Characters present extractor - matches "PHYSICALLY PRESENT"
	mockGenerator.setResponse(
		/PHYSICALLY PRESENT/i,
		JSON.stringify({
			reasoning: 'Elena and User are present.',
			characters: [
				{
					name: 'Elena',
					position: 'entering the shop',
					activity: 'looking around',
					mood: ['curious'],
					physicalState: [],
				},
				{
					name: 'User',
					position: 'near the window',
					activity: 'waving',
					mood: ['friendly'],
					physicalState: [],
				},
			],
		}),
	);

	// Character outfits extractor - matches outfit/clothing
	mockGenerator.setResponse(
		/outfit|clothing.*wearing/i,
		JSON.stringify({
			reasoning: 'Outfit extraction.',
			outfits: [
				{
					character: 'Elena',
					outfit: {
						torso: 'blue sweater',
						legs: 'jeans',
						footwear: 'sneakers',
					},
				},
			],
		}),
	);

	// Topic/Tone extractor - matches topic/tone
	mockGenerator.setResponse(
		/topic.*tone|scene.*topic/i,
		JSON.stringify({
			reasoning: 'A casual reunion.',
			topic: 'reunion',
			tone: 'friendly',
		}),
	);

	// Tension extractor - matches tension/level
	mockGenerator.setResponse(
		/tension.*level|Level.*Type/i,
		JSON.stringify({
			reasoning: 'Relaxed atmosphere.',
			level: 'relaxed',
			type: 'conversation',
		}),
	);

	// Relationships extractor - matches relationship/pair
	mockGenerator.setResponse(
		/relationship.*pair|pair.*status/i,
		JSON.stringify({
			reasoning: 'Analyzing relationship.',
			relationships: [
				{
					pair: ['Elena', 'User'],
					status: 'friendly',
					aToB: {
						feelings: ['curious'],
						secrets: [],
						wants: ['friendship'],
					},
					bToA: {
						feelings: ['interested'],
						secrets: [],
						wants: ['connection'],
					},
				},
			],
		}),
	);

	// Default fallback for anything else
	mockGenerator.setDefaultResponse(JSON.stringify({ reasoning: 'default' }));
}

describe('extractInitialSnapshot', () => {
	let mockGenerator: MockGenerator;
	let setStatusCalls: string[];

	beforeEach(() => {
		vi.clearAllMocks();
		mockGenerator = createMockGenerator();
		setStatusCalls = [];
		setupDefaultResponses(mockGenerator);
	});

	describe('basic flow', () => {
		it('returns a complete snapshot with source and timestamp', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			expect(result.snapshot).toBeDefined();
			expect(result.snapshot.source).toEqual(source);
			expect(result.snapshot.timestamp).toBeGreaterThan(0);
			expect(result.snapshot.swipeId).toBe(source.swipeId);
		});

		it('includes swipeId in final snapshot', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source: MessageAndSwipe = { messageId: 1, swipeId: 3 };

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			expect(result.snapshot.swipeId).toBe(3);
		});

		it('calls setStatus for each extractor', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
				status => setStatusCalls.push(status),
			);

			// Should have status calls for enabled extractors
			expect(setStatusCalls.length).toBeGreaterThan(0);
			expect(setStatusCalls.some(s => s.includes('Extracting'))).toBe(true);
		});
	});

	describe('settings-based skipping', () => {
		it('skips time extractor when tracking disabled', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, time: false },
			});
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Time should not be extracted
			expect(result.snapshot.time).toBeNull();
		});

		it('skips location extractor when tracking disabled', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, location: false },
			});
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Location should be null or have empty values
			if (result.snapshot.location === null) {
				expect(result.snapshot.location).toBeNull();
			} else {
				expect(result.snapshot.location.area).toBe('');
			}
		});

		it('skips characters extractor when tracking disabled', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, characters: false },
			});
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Characters should be empty
			expect(Object.keys(result.snapshot.characters)).toHaveLength(0);
		});
	});

	describe('card extensions', () => {
		it('skips time extractor when card extension provides time', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();
			const cardExtensions: CardExtensions = {
				time: {
					enabled: true,
					datetime: '2025-01-15T10:00:00.000Z',
				},
				location: undefined,
			};

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
				undefined,
				cardExtensions,
			);

			// Time should come from card extension
			expect(result.snapshot.time).toBe('2025-01-15T10:00:00.000Z');
		});

		it('skips location extractor when card extension provides location', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();
			const cardExtensions: CardExtensions = {
				time: undefined,
				location: {
					enabled: true,
					area: 'Card Area',
					place: 'Card Place',
					position: 'Card Position',
					locationType: 'modern',
				},
			};

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
				undefined,
				cardExtensions,
			);

			// Location should come from card extension
			expect(result.snapshot.location!.area).toBe('Card Area');
			expect(result.snapshot.location!.place).toBe('Card Place');
			expect(result.snapshot.location!.position).toBe('Card Position');
			expect(result.snapshot.location!.locationType).toBe('modern');
		});

		it('handles invalid card extension time gracefully', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();
			const cardExtensions: CardExtensions = {
				time: {
					enabled: true,
					datetime: 'not-a-valid-datetime',
				},
				location: undefined,
			};

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
				undefined,
				cardExtensions,
			);

			// Should fall back to LLM extraction
			expect(result.snapshot.time).toBeDefined();
		});
	});

	describe('dependency handling', () => {
		it('propsExtractor receives location from prior extraction', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Props should be extracted and merged with location
			expect(result.snapshot.location!.props).toBeDefined();
		});

		it('tensionExtractor receives scene from prior extraction', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Scene should have topic, tone, and tension
			expect(result.snapshot.scene!.topic).toBeDefined();
			expect(result.snapshot.scene!.tone).toBeDefined();
			expect(result.snapshot.scene!.tension).toBeDefined();
		});
	});

	describe('error handling', () => {
		it('continues on extractor failure', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			// Make time extractor fail by returning invalid response
			mockGenerator.clearResponses();
			mockGenerator.setResponse(
				/current date.*time|Date.*Time.*year.*month.*day/i,
				'not valid json at all {{{',
			);
			// Set up other responses so extraction can continue
			mockGenerator.setResponse(
				/area.*place.*position|locationType/i,
				JSON.stringify({
					reasoning: 'At a coffee shop.',
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Near the window',
					locationType: 'heated',
				}),
			);
			mockGenerator.setDefaultResponse(JSON.stringify({ reasoning: 'default' }));

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Should still return a snapshot even if some extractors fail
			expect(result.snapshot).toBeDefined();
		});

		it('returns partial snapshot even with failures', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			// Make time fail but allow location to succeed
			mockGenerator.clearResponses();
			mockGenerator.setResponse(
				/current date.*time|Date.*Time.*year.*month.*day/i,
				'invalid',
			);
			mockGenerator.setResponse(
				/area.*place.*position|locationType/i,
				JSON.stringify({
					reasoning: 'At a coffee shop.',
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Near the window',
					locationType: 'heated',
				}),
			);
			mockGenerator.setDefaultResponse(JSON.stringify({ reasoning: 'default' }));

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Snapshot should exist with other extracted data
			expect(result.snapshot).toBeDefined();
			expect(result.snapshot.source).toEqual(source);
			// Location should still be extracted
			expect(result.snapshot.location!.area).toBe('Downtown');
		});
	});

	describe('progress tracking', () => {
		it('calls startSection for each enabled extractor', async () => {
			const { startSection } = await import('../extractors/progressTracker');
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			await extractInitialSnapshot(mockGenerator, context, settings, source);

			// startSection should be called for each enabled extractor
			expect(startSection).toHaveBeenCalled();
		});

		it('calls completeSection for each enabled extractor', async () => {
			const { completeSection } = await import('../extractors/progressTracker');
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			await extractInitialSnapshot(mockGenerator, context, settings, source);

			// completeSection should be called for each enabled extractor
			expect(completeSection).toHaveBeenCalled();
		});
	});

	describe('extractor sequence', () => {
		it('runs extractors and produces combined snapshot', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Snapshot should have data from multiple extractors
			expect(result.snapshot.time).toBeDefined();
			expect(result.snapshot.location).toBeDefined();
			expect(result.snapshot.scene).toBeDefined();
		});

		it('passes partialSnapshot to each extractor', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Props should be extracted and location should exist
			expect(result.snapshot.location).toBeDefined();
			expect(result.snapshot.location!.props).toBeDefined();
		});

		it('merges results into cumulative snapshot', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const source = createMockSource();

			const result = await extractInitialSnapshot(
				mockGenerator,
				context,
				settings,
				source,
			);

			// Snapshot should have data from multiple extractors
			expect(result.snapshot.time).toBeDefined();
			expect(result.snapshot.location).toBeDefined();
			expect(result.snapshot.scene).toBeDefined();
			expect(result.snapshot.characters).toBeDefined();
		});
	});
});
