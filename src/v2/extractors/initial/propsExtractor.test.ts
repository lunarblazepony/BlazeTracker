/**
 * Props Extractor Tests
 *
 * Tests that verify the props extractor builds prompts correctly
 * and parses responses properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { initialPropsExtractor } from './propsExtractor';
import {
	createMockContext,
	createMockSettings,
	createPartialSnapshot,
	createMockLocation,
	createMockCharacter,
} from './testHelpers';

describe('initialPropsExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	describe('shouldRun', () => {
		it('returns true when props tracking is enabled and location exists', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			expect(
				initialPropsExtractor.shouldRun(settings, context, partialSnapshot),
			).toBe(true);
		});

		it('returns false when props tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, props: false },
			});
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			expect(
				initialPropsExtractor.shouldRun(settings, context, partialSnapshot),
			).toBe(false);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			expect(
				initialPropsExtractor.shouldRun(settings, context, partialSnapshot),
			).toBe(false);
		});

		it('returns false when location does not exist in partialSnapshot', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot(); // No location

			expect(
				initialPropsExtractor.shouldRun(settings, context, partialSnapshot),
			).toBe(false);
		});
	});

	describe('run', () => {
		it('passes character name to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Props in the coffee shop.',
					props: ['menu', 'coffee mug'],
				}),
			);

			await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			expect(call).toBeDefined();

			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('Elena');
		});

		// Note: characterDescription was removed from this prompt in the refactor

		it('passes messages to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					props: ['menu'],
				}),
			);

			await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('coffee shop');
		});

		it('uses the configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: {
					...createMockSettings().temperatures,
					location: 0.8,
				},
			});
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					props: ['menu'],
				}),
			);

			await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			// Props uses location temperature
			expect(call!.settings.temperature).toBe(0.8);
		});

		it('returns location with props merged', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const existingLocation = createMockLocation({
				area: 'Downtown Seattle',
				place: 'The Starlight Diner',
				position: 'Corner booth',
			});
			const partialSnapshot = createPartialSnapshot({
				location: existingLocation,
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Props visible in the scene.',
					props: ['coffee mug', 'newspaper', 'salt shaker'],
				}),
			);

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.location).toBeDefined();
			expect(result.location?.area).toBe('Downtown Seattle');
			expect(result.location?.place).toBe('The Starlight Diner');
			expect(result.location?.position).toBe('Corner booth');
			expect(result.location?.props).toEqual([
				'coffee mug',
				'newspaper',
				'salt shaker',
			]);
		});

		it('returns empty object when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			mockGenerator.setDefaultResponse('This is not valid JSON');

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('returns empty object when LLM returns incomplete data', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Incomplete response',
					// Missing props field
				}),
			);

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('returns empty object when partialSnapshot has no location', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot(); // No location

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('handles empty props array', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'No notable props.',
					props: [],
				}),
			);

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.location?.props).toEqual([]);
		});
	});

	describe('outfit integration', () => {
		it('passes character outfits to the prompt when characters exist', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
				characters: {
					Elena: createMockCharacter('Elena', {
						outfit: {
							head: null,
							neck: 'silver necklace',
							jacket: 'leather jacket',
							back: null,
							torso: 'white blouse',
							legs: 'jeans',
							underwear: null,
							socks: null,
							footwear: 'heels',
						},
					}),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Props in the scene.',
					props: ['coffee mug', 'newspaper'],
				}),
			);

			await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			// Should include outfit items
			expect(promptContent).toContain('leather jacket');
			expect(promptContent).toContain('white blouse');
			expect(promptContent).toContain('jeans');
		});

		it('filters out props that match worn outfit items', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
				characters: {
					Elena: createMockCharacter('Elena', {
						outfit: {
							head: null,
							neck: 'silver necklace',
							jacket: 'leather jacket',
							back: null,
							torso: 'white blouse',
							legs: 'jeans',
							underwear: null,
							socks: null,
							footwear: 'heels',
						},
					}),
				},
			});

			// LLM returns props including some that match outfit items
			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Props in the scene.',
					props: [
						'coffee mug',
						'leather jacket', // Worn by Elena - should be filtered
						'newspaper',
						'silver necklace', // Worn by Elena - should be filtered
					],
				}),
			);

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// Should only contain props that are NOT worn
			expect(result.location?.props).toEqual(['coffee mug', 'newspaper']);
		});

		it('filters props with fuzzy matching (partial word overlap)', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
				characters: {
					Elena: createMockCharacter('Elena', {
						outfit: {
							head: null,
							neck: null,
							jacket: 'black leather jacket',
							back: null,
							torso: null,
							legs: null,
							underwear: null,
							socks: null,
							footwear: null,
						},
					}),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Props in the scene.',
					props: [
						'coffee mug',
						"Elena's jacket", // Fuzzy match with "black leather jacket"
					],
				}),
			);

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// Should filter the jacket due to word overlap
			expect(result.location?.props).toEqual(['coffee mug']);
		});

		it('handles extraction without characters (no outfit filtering)', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
				// No characters - outfit filtering will be skipped
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Props in the scene.',
					props: ['coffee mug', 'newspaper', 'jacket'], // All kept since no outfits
				}),
			);

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.location?.props).toEqual([
				'coffee mug',
				'newspaper',
				'jacket',
			]);
		});

		it('handles multiple characters and filters all their outfits', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
				characters: {
					Elena: createMockCharacter('Elena', {
						outfit: {
							head: null,
							neck: null,
							jacket: null,
							back: null,
							torso: 'red dress',
							legs: null,
							underwear: null,
							socks: null,
							footwear: 'heels',
						},
					}),
					User: createMockCharacter('User', {
						outfit: {
							head: null,
							neck: null,
							jacket: 'denim jacket',
							back: null,
							torso: 't-shirt',
							legs: 'shorts',
							underwear: null,
							socks: null,
							footwear: 'sneakers',
						},
					}),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Props in the scene.',
					props: [
						'coffee mug',
						'red dress', // Elena's - filter
						'denim jacket', // User's - filter
						'newspaper',
						'heels', // Elena's - filter
					],
				}),
			);

			const result = await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.location?.props).toEqual(['coffee mug', 'newspaper']);
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(initialPropsExtractor.name).toBe('initialProps');
		});

		it('has the correct category', () => {
			expect(initialPropsExtractor.category).toBe('props');
		});

		it('has a default temperature', () => {
			expect(initialPropsExtractor.defaultTemperature).toBe(0.4);
		});
	});
});
