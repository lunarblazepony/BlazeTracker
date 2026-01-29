/**
 * Character Outfits Extractor Tests
 *
 * Tests that verify the character outfits extractor builds prompts correctly
 * and parses responses properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { initialCharacterOutfitsExtractor } from './characterOutfitsExtractor';
import {
	createMockContext,
	createMockSettings,
	createPartialSnapshot,
	createMockCharacter,
} from './testHelpers';

describe('initialCharacterOutfitsExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	describe('shouldRun', () => {
		it('returns true when characters tracking is enabled and chat has messages', () => {
			const context = createMockContext();
			const settings = createMockSettings();

			expect(initialCharacterOutfitsExtractor.shouldRun(settings, context)).toBe(
				true,
			);
		});

		it('returns false when characters tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, characters: false },
			});

			expect(initialCharacterOutfitsExtractor.shouldRun(settings, context)).toBe(
				false,
			);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();

			expect(initialCharacterOutfitsExtractor.shouldRun(settings, context)).toBe(
				false,
			);
		});
	});

	describe('run', () => {
		it('returns empty object when partialSnapshot has no characters', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot(); // No characters

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('returns empty object when characters is empty', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {},
			});

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('passes character names to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
					User: createMockCharacter('User'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Extracting outfits.',
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

			await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			expect(call).toBeDefined();

			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('Elena');
			expect(promptContent).toContain('User');
		});

		it('uses the configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: {
					...createMockSettings().temperatures,
					characters: 0.9,
				},
			});
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					outfits: [
						{
							character: 'Elena',
							outfit: { torso: 'shirt' },
						},
					],
				}),
			);

			await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.9);
		});

		it('merges outfit data into existing characters', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena', {
						position: 'at the door',
						activity: 'standing',
						mood: ['curious'],
					}),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Elena is wearing casual clothes.',
					outfits: [
						{
							character: 'Elena',
							outfit: {
								head: null,
								neck: 'silver necklace',
								jacket: 'leather jacket',
								back: null,
								torso: 'white t-shirt',
								legs: 'blue jeans',
								underwear: null,
								socks: 'ankle socks',
								footwear: 'white sneakers',
							},
						},
					],
				}),
			);

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.characters).toBeDefined();
			expect(result.characters!['Elena']).toBeDefined();

			// Original properties preserved
			expect(result.characters!['Elena'].position).toBe('at the door');
			expect(result.characters!['Elena'].activity).toBe('standing');
			expect(result.characters!['Elena'].mood).toEqual(['curious']);

			// Outfit merged
			expect(result.characters!['Elena'].outfit.neck).toBe('silver necklace');
			expect(result.characters!['Elena'].outfit.jacket).toBe('leather jacket');
			expect(result.characters!['Elena'].outfit.torso).toBe('white t-shirt');
			expect(result.characters!['Elena'].outfit.legs).toBe('blue jeans');
			expect(result.characters!['Elena'].outfit.socks).toBe('ankle socks');
			expect(result.characters!['Elena'].outfit.footwear).toBe('white sneakers');
		});

		it('handles all outfit slots', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Full outfit.',
					outfits: [
						{
							character: 'Elena',
							outfit: {
								head: 'baseball cap',
								neck: 'scarf',
								jacket: 'denim jacket',
								back: 'backpack',
								torso: 'tank top',
								legs: 'shorts',
								underwear: 'boxers',
								socks: 'knee socks',
								footwear: 'boots',
							},
						},
					],
				}),
			);

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const outfit = result.characters!['Elena'].outfit;
			expect(outfit.head).toBe('baseball cap');
			expect(outfit.neck).toBe('scarf');
			expect(outfit.jacket).toBe('denim jacket');
			expect(outfit.back).toBe('backpack');
			expect(outfit.torso).toBe('tank top');
			expect(outfit.legs).toBe('shorts');
			expect(outfit.underwear).toBe('boxers');
			expect(outfit.socks).toBe('knee socks');
			expect(outfit.footwear).toBe('boots');
		});

		it('handles case-insensitive character name matching', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					outfits: [
						{
							character: 'ELENA', // Different case
							outfit: {
								torso: 'sweater',
							},
						},
					],
				}),
			);

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.characters!['Elena'].outfit.torso).toBe('sweater');
		});

		it('warns and skips unknown character names', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					outfits: [
						{
							character: 'Unknown',
							outfit: { torso: 'shirt' },
						},
					],
				}),
			);

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// Elena should still be in the result, just without outfit changes
			expect(result.characters!['Elena']).toBeDefined();
			// No Unknown character should be added
			expect(result.characters!['Unknown']).toBeUndefined();
		});

		it('handles multiple characters', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
					User: createMockCharacter('User'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Both characters have outfits.',
					outfits: [
						{
							character: 'Elena',
							outfit: {
								torso: 'blue sweater',
								legs: 'jeans',
							},
						},
						{
							character: 'User',
							outfit: {
								torso: 'hoodie',
								legs: 'sweatpants',
							},
						},
					],
				}),
			);

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.characters!['Elena'].outfit.torso).toBe('blue sweater');
			expect(result.characters!['Elena'].outfit.legs).toBe('jeans');
			expect(result.characters!['User'].outfit.torso).toBe('hoodie');
			expect(result.characters!['User'].outfit.legs).toBe('sweatpants');
		});

		it('returns empty object when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
				},
			});

			mockGenerator.setDefaultResponse('This is not valid JSON');

			const result = await initialCharacterOutfitsExtractor.run(
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
				characters: {
					Elena: createMockCharacter('Elena'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Incomplete response',
					// Missing outfits field
				}),
			);

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('only updates outfit slots that have values', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const existingCharacter = createMockCharacter('Elena');
			existingCharacter.outfit.head = 'existing hat';
			existingCharacter.outfit.torso = 'existing shirt';

			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: existingCharacter,
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Only some items specified.',
					outfits: [
						{
							character: 'Elena',
							outfit: {
								legs: 'new jeans',
								// head and torso not specified (undefined)
							},
						},
					],
				}),
			);

			const result = await initialCharacterOutfitsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// New value applied
			expect(result.characters!['Elena'].outfit.legs).toBe('new jeans');
			// Existing values preserved since they weren't in the response
			expect(result.characters!['Elena'].outfit.head).toBe('existing hat');
			expect(result.characters!['Elena'].outfit.torso).toBe('existing shirt');
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(initialCharacterOutfitsExtractor.name).toBe(
				'initialCharacterOutfits',
			);
		});

		it('has the correct category', () => {
			expect(initialCharacterOutfitsExtractor.category).toBe('characters');
		});

		it('has a default temperature', () => {
			expect(initialCharacterOutfitsExtractor.defaultTemperature).toBe(0.5);
		});
	});
});
