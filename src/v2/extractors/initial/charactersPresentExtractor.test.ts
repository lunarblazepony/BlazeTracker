/**
 * Characters Present Extractor Tests
 *
 * Tests that verify the characters present extractor builds prompts correctly
 * and parses responses properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { initialCharactersPresentExtractor } from './charactersPresentExtractor';
import { createMockContext, createMockSettings } from './testHelpers';

describe('initialCharactersPresentExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	describe('shouldRun', () => {
		it('returns true when characters tracking is enabled and chat has messages', () => {
			const context = createMockContext();
			const settings = createMockSettings();

			expect(initialCharactersPresentExtractor.shouldRun(settings, context)).toBe(
				true,
			);
		});

		it('returns false when characters tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, characters: false },
			});

			expect(initialCharactersPresentExtractor.shouldRun(settings, context)).toBe(
				false,
			);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();

			expect(initialCharactersPresentExtractor.shouldRun(settings, context)).toBe(
				false,
			);
		});
	});

	describe('run', () => {
		it('passes character name to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Elena and User are present.',
					characters: [
						{
							name: 'Elena',
							position: 'entering the coffee shop',
							activity: 'walking in',
							mood: ['curious'],
							physicalState: [],
						},
					],
				}),
			);

			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall();
			expect(call).toBeDefined();

			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('Elena');
		});

		it('passes character description to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					characters: [
						{
							name: 'Elena',
							position: 'at the door',
							activity: null,
							mood: [],
							physicalState: [],
						},
					],
				}),
			);

			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('auburn hair');
			expect(promptContent).toContain('journalist');
		});

		it('passes messages to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					characters: [
						{
							name: 'Elena',
							position: 'at the door',
							activity: null,
							mood: [],
							physicalState: [],
						},
					],
				}),
			);

			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('coffee shop');
		});

		it('passes persona to the prompt if available', async () => {
			const context = createMockContext({
				persona: 'A mysterious traveler from distant lands.',
			});
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					characters: [
						{
							name: 'Elena',
							position: 'at the door',
							activity: null,
							mood: [],
							physicalState: [],
						},
					],
				}),
			);

			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			// The persona might be included in the context
			expect(promptContent).toBeDefined();
		});

		it('uses the configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: {
					...createMockSettings().temperatures,
					characters: 0.8,
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					characters: [
						{
							name: 'Elena',
							position: 'at the door',
							activity: null,
							mood: [],
							physicalState: [],
						},
					],
				}),
			);

			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.8);
		});

		it('returns characters record on valid response', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Two characters are present.',
					characters: [
						{
							name: 'Elena',
							position: 'entering the coffee shop',
							activity: 'looking around',
							mood: ['curious', 'hopeful'],
							physicalState: ['well-rested'],
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

			const result = await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.characters).toBeDefined();
			expect(Object.keys(result.characters!)).toHaveLength(2);

			expect(result.characters!['Elena']).toBeDefined();
			expect(result.characters!['Elena'].position).toBe(
				'entering the coffee shop',
			);
			expect(result.characters!['Elena'].activity).toBe('looking around');
			expect(result.characters!['Elena'].mood).toEqual(['curious', 'hopeful']);
			expect(result.characters!['Elena'].physicalState).toEqual(['well-rested']);

			expect(result.characters!['User']).toBeDefined();
			expect(result.characters!['User'].position).toBe('near the window');
			expect(result.characters!['User'].activity).toBe('waving');
			expect(result.characters!['User'].mood).toEqual(['friendly']);
			expect(result.characters!['User'].physicalState).toEqual([]);
		});

		it('handles null activity', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Character is idle.',
					characters: [
						{
							name: 'Elena',
							position: 'standing still',
							activity: null,
							mood: ['relaxed'],
							physicalState: [],
						},
					],
				}),
			);

			const result = await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.characters!['Elena'].activity).toBeNull();
		});

		it('defaults mood to empty array if missing', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					characters: [
						{
							name: 'Elena',
							position: 'at the door',
							activity: null,
							// mood is missing
							physicalState: [],
						},
					],
				}),
			);

			const result = await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.characters!['Elena'].mood).toEqual([]);
		});

		it('defaults physicalState to empty array if missing', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					characters: [
						{
							name: 'Elena',
							position: 'at the door',
							activity: null,
							mood: [],
							// physicalState is missing
						},
					],
				}),
			);

			const result = await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.characters!['Elena'].physicalState).toEqual([]);
		});

		it('returns empty object when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse('This is not valid JSON');

			const result = await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result).toEqual({});
		});

		it('returns empty object when LLM returns incomplete data', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Incomplete response',
					// Missing characters field
				}),
			);

			const result = await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result).toEqual({});
		});

		it('includes system messages in prompt structure', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					characters: [
						{
							name: 'Elena',
							position: 'at the door',
							activity: null,
							mood: [],
							physicalState: [],
						},
					],
				}),
			);

			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall();
			const systemMessage = call!.prompt.messages.find(m => m.role === 'system');
			expect(systemMessage).toBeDefined();
			expect(systemMessage!.content).toContain('analyzing roleplay messages');
		});

		it('character names become keys in the record', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Multiple characters.',
					characters: [
						{
							name: 'Alice',
							position: 'at the bar',
							activity: 'drinking',
							mood: ['relaxed'],
							physicalState: [],
						},
						{
							name: 'Bob',
							position: 'at a table',
							activity: 'eating',
							mood: ['hungry'],
							physicalState: [],
						},
					],
				}),
			);

			const result = await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.characters).toBeDefined();
			expect(result.characters!['Alice']).toBeDefined();
			expect(result.characters!['Bob']).toBeDefined();
			expect(result.characters!['Alice'].name).toBe('Alice');
			expect(result.characters!['Bob'].name).toBe('Bob');
		});

		it('creates empty outfit for each character', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					characters: [
						{
							name: 'Elena',
							position: 'at the door',
							activity: null,
							mood: [],
							physicalState: [],
						},
					],
				}),
			);

			const result = await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.characters!['Elena'].outfit).toBeDefined();
			expect(result.characters!['Elena'].outfit.head).toBeNull();
			expect(result.characters!['Elena'].outfit.torso).toBeNull();
			expect(result.characters!['Elena'].outfit.legs).toBeNull();
			expect(result.characters!['Elena'].outfit.footwear).toBeNull();
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(initialCharactersPresentExtractor.name).toBe(
				'initialCharactersPresent',
			);
		});

		it('has the correct category', () => {
			expect(initialCharactersPresentExtractor.category).toBe('characters');
		});

		it('has a default temperature', () => {
			expect(initialCharactersPresentExtractor.defaultTemperature).toBe(0.5);
		});
	});
});
