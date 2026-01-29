/**
 * Relationships Extractor Tests
 *
 * Tests that verify the relationships extractor builds prompts correctly
 * and parses responses properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { initialRelationshipsExtractor } from './relationshipsExtractor';
import {
	createMockContext,
	createMockSettings,
	createPartialSnapshot,
	createMockCharacter,
} from './testHelpers';

describe('initialRelationshipsExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	describe('shouldRun', () => {
		it('returns true when relationships tracking is enabled and chat has messages', () => {
			const context = createMockContext();
			const settings = createMockSettings();

			expect(initialRelationshipsExtractor.shouldRun(settings, context)).toBe(
				true,
			);
		});

		it('returns false when relationships tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, relationships: false },
			});

			expect(initialRelationshipsExtractor.shouldRun(settings, context)).toBe(
				false,
			);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();

			expect(initialRelationshipsExtractor.shouldRun(settings, context)).toBe(
				false,
			);
		});
	});

	describe('run', () => {
		it('returns empty object when partialSnapshot has no characters', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot(); // No characters

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('returns empty object when less than 2 characters', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
				},
			});

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('passes character pairs to the prompt', async () => {
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
					reasoning: 'Analysis of relationship.',
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

			await initialRelationshipsExtractor.run(
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

		it('character pairs are alphabetically sorted', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Zara: createMockCharacter('Zara'),
					Alice: createMockCharacter('Alice'),
					Mike: createMockCharacter('Mike'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					relationships: [
						{
							pair: ['Alice', 'Mike'],
							status: 'strangers',
							aToB: {
								feelings: [],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
						{
							pair: ['Alice', 'Zara'],
							status: 'strangers',
							aToB: {
								feelings: [],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
						{
							pair: ['Mike', 'Zara'],
							status: 'strangers',
							aToB: {
								feelings: [],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
					],
				}),
			);

			await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');

			// Check that pairs are alphabetically sorted in the prompt
			expect(promptContent).toContain('Alice and Mike');
			expect(promptContent).toContain('Alice and Zara');
			expect(promptContent).toContain('Mike and Zara');
		});

		it('uses the configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: {
					...createMockSettings().temperatures,
					relationships: 0.8,
				},
			});
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
					User: createMockCharacter('User'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					relationships: [
						{
							pair: ['Elena', 'User'],
							status: 'friendly',
							aToB: {
								feelings: [],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
					],
				}),
			);

			await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.8);
		});

		it('returns relationships record on valid response', async () => {
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
					reasoning: 'Elena and User are newly acquainted.',
					relationships: [
						{
							pair: ['Elena', 'User'],
							status: 'acquaintances',
							aToB: {
								feelings: ['curious', 'cautious'],
								secrets: [
									'knows more than she admits',
								],
								wants: ['to understand User'],
							},
							bToA: {
								feelings: ['interested', 'hopeful'],
								secrets: [
									'has been waiting for this meeting',
								],
								wants: ['to reconnect'],
							},
						},
					],
				}),
			);

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.relationships).toBeDefined();
			const key = 'Elena|User';
			expect(result.relationships![key]).toBeDefined();
			expect(result.relationships![key].pair).toEqual(['Elena', 'User']);
			expect(result.relationships![key].status).toBe('acquaintances');
			expect(result.relationships![key].aToB.feelings).toEqual([
				'curious',
				'cautious',
			]);
			expect(result.relationships![key].aToB.secrets).toEqual([
				'knows more than she admits',
			]);
			expect(result.relationships![key].aToB.wants).toEqual([
				'to understand User',
			]);
			expect(result.relationships![key].bToA.feelings).toEqual([
				'interested',
				'hopeful',
			]);
			expect(result.relationships![key].bToA.secrets).toEqual([
				'has been waiting for this meeting',
			]);
			expect(result.relationships![key].bToA.wants).toEqual(['to reconnect']);
		});

		it('handles all valid relationship statuses', async () => {
			const statuses = [
				'strangers',
				'acquaintances',
				'friendly',
				'close',
				'intimate',
				'strained',
				'hostile',
				'complicated',
			];

			const context = createMockContext();
			const settings = createMockSettings();

			for (const status of statuses) {
				mockGenerator.clearCalls();
				const partialSnapshot = createPartialSnapshot({
					characters: {
						Elena: createMockCharacter('Elena'),
						User: createMockCharacter('User'),
					},
				});

				mockGenerator.setDefaultResponse(
					JSON.stringify({
						reasoning: `Status is ${status}.`,
						relationships: [
							{
								pair: ['Elena', 'User'],
								status,
								aToB: {
									feelings: [],
									secrets: [],
									wants: [],
								},
								bToA: {
									feelings: [],
									secrets: [],
									wants: [],
								},
							},
						],
					}),
				);

				const result = await initialRelationshipsExtractor.run(
					mockGenerator,
					context,
					settings,
					partialSnapshot,
				);

				expect(result.relationships!['Elena|User'].status).toBe(status);
			}
		});

		it('handles case-insensitive character name matching', async () => {
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
					reasoning: 'Test',
					relationships: [
						{
							pair: ['ELENA', 'USER'], // Different case
							status: 'friendly',
							aToB: {
								feelings: ['happy'],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: ['content'],
								secrets: [],
								wants: [],
							},
						},
					],
				}),
			);

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// Should match using our original casing
			expect(result.relationships!['Elena|User']).toBeDefined();
			expect(result.relationships!['Elena|User'].pair).toEqual(['Elena', 'User']);
		});

		it('handles swapped pair order from LLM', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
					User: createMockCharacter('User'),
				},
			});

			// LLM returns User first (wrong order), we should swap aToB/bToA accordingly
			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					relationships: [
						{
							pair: ['User', 'Elena'], // Wrong order (not alphabetical)
							status: 'friendly',
							aToB: {
								feelings: ['user-feeling'],
								secrets: [],
								wants: [],
							}, // This is User -> Elena
							bToA: {
								feelings: ['elena-feeling'],
								secrets: [],
								wants: [],
							}, // This is Elena -> User
						},
					],
				}),
			);

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// Should be stored with alphabetical order
			expect(result.relationships!['Elena|User']).toBeDefined();
			expect(result.relationships!['Elena|User'].pair).toEqual(['Elena', 'User']);
			// aToB should now be Elena -> User (swapped from bToA)
			expect(result.relationships!['Elena|User'].aToB.feelings).toEqual([
				'elena-feeling',
			]);
			// bToA should now be User -> Elena (swapped from aToB)
			expect(result.relationships!['Elena|User'].bToA.feelings).toEqual([
				'user-feeling',
			]);
		});

		it('handles multiple relationships', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Alice: createMockCharacter('Alice'),
					Bob: createMockCharacter('Bob'),
					Charlie: createMockCharacter('Charlie'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Three characters with different relationships.',
					relationships: [
						{
							pair: ['Alice', 'Bob'],
							status: 'close',
							aToB: {
								feelings: ['trusting'],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: ['protective'],
								secrets: [],
								wants: [],
							},
						},
						{
							pair: ['Alice', 'Charlie'],
							status: 'strained',
							aToB: {
								feelings: ['suspicious'],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: ['resentful'],
								secrets: [],
								wants: [],
							},
						},
						{
							pair: ['Bob', 'Charlie'],
							status: 'strangers',
							aToB: {
								feelings: ['neutral'],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: ['indifferent'],
								secrets: [],
								wants: [],
							},
						},
					],
				}),
			);

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(Object.keys(result.relationships!)).toHaveLength(3);
			expect(result.relationships!['Alice|Bob'].status).toBe('close');
			expect(result.relationships!['Alice|Charlie'].status).toBe('strained');
			expect(result.relationships!['Bob|Charlie'].status).toBe('strangers');
		});

		it('skips relationships with unknown character names', async () => {
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
					reasoning: 'Test',
					relationships: [
						{
							pair: ['Elena', 'User'],
							status: 'friendly',
							aToB: {
								feelings: [],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
						{
							pair: ['Unknown', 'Elena'], // Unknown character
							status: 'strangers',
							aToB: {
								feelings: [],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
					],
				}),
			);

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// Should only have the valid relationship
			expect(Object.keys(result.relationships!)).toHaveLength(1);
			expect(result.relationships!['Elena|User']).toBeDefined();
		});

		it('returns empty object when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				characters: {
					Elena: createMockCharacter('Elena'),
					User: createMockCharacter('User'),
				},
			});

			mockGenerator.setDefaultResponse('This is not valid JSON');

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('returns empty object when LLM returns invalid status', async () => {
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
					reasoning: 'Test',
					relationships: [
						{
							pair: ['Elena', 'User'],
							status: 'invalid_status',
							aToB: {
								feelings: [],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
					],
				}),
			);

			const result = await initialRelationshipsExtractor.run(
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
					User: createMockCharacter('User'),
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Incomplete response',
					// Missing relationships field
				}),
			);

			const result = await initialRelationshipsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(initialRelationshipsExtractor.name).toBe('initialRelationships');
		});

		it('has the correct category', () => {
			expect(initialRelationshipsExtractor.category).toBe('relationships');
		});

		it('has a default temperature', () => {
			expect(initialRelationshipsExtractor.defaultTemperature).toBe(0.6);
		});
	});
});
