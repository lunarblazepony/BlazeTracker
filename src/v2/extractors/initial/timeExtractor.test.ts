/**
 * Initial Time Extractor Tests
 *
 * Tests that verify the time extractor builds prompts correctly
 * with mocked ST context and MockGenerator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { initialTimeExtractor } from './timeExtractor';
import type { ExtractionContext, ExtractionSettings } from '../types';
import type { Snapshot } from '../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*The clock on the wall shows 3:47 PM as Elena enters the coffee shop. November 14th, 2024 - exactly one year since everything changed.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: '*I wave to Elena from my seat near the window.* Hey, glad you could make it.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
		],
		characters: [
			{
				name: 'Elena',
				description:
					'A young woman with auburn hair and green eyes. She works as a journalist.',
				personality: 'Curious, determined, slightly anxious',
				scenario: 'Meeting at a coffee shop after a year apart.',
			},
		],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A mysterious stranger with secrets to share.',
		...overrides,
	};
}

/**
 * Create mock extraction settings.
 */
function createMockSettings(overrides: Partial<ExtractionSettings> = {}): ExtractionSettings {
	return {
		profileId: 'test-profile',
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

describe('initialTimeExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	describe('shouldRun', () => {
		it('returns true when time tracking is enabled and chat has messages', () => {
			const context = createMockContext();
			const settings = createMockSettings();

			expect(initialTimeExtractor.shouldRun(settings, context)).toBe(true);
		});

		it('returns false when time tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, time: false },
			});

			expect(initialTimeExtractor.shouldRun(settings, context)).toBe(false);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();

			expect(initialTimeExtractor.shouldRun(settings, context)).toBe(false);
		});
	});

	describe('run', () => {
		it('passes character name to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'The clock shows 3:47 PM on November 14th, 2024.',
					time: {
						year: 2024,
						month: 11,
						day: 14,
						hour: 15,
						minute: 47,
						second: 0,
						dayOfWeek: 'Thursday',
					},
				}),
			);

			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			expect(call).toBeDefined();

			// Check that the prompt contains the character name
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('Elena');
		});

		// Note: characterDescription was removed from this prompt in the refactor
		// Only charactersPresentPrompt, characterOutfitsPrompt, and relationshipsPrompt use it now

		it('passes messages to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					time: {
						year: 2024,
						month: 11,
						day: 14,
						hour: 15,
						minute: 47,
						second: 0,
						dayOfWeek: 'Thursday',
					},
				}),
			);

			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('clock on the wall shows 3:47 PM');
			expect(promptContent).toContain('November 14th, 2024');
		});

		it('uses the configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: { ...createMockSettings().temperatures, time: 0.5 },
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					time: {
						year: 2024,
						month: 11,
						day: 14,
						hour: 15,
						minute: 47,
						second: 0,
						dayOfWeek: 'Thursday',
					},
				}),
			);

			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.5);
		});

		it('returns extracted time as ISO string in snapshot', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'The clock shows 3:47 PM on November 14th, 2024.',
					time: {
						year: 2024,
						month: 11,
						day: 14,
						hour: 15,
						minute: 47,
						second: 0,
						dayOfWeek: 'Thursday',
					},
				}),
			);

			const result = await initialTimeExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.time).toBeDefined();
			// Check that it's a valid ISO string containing the date
			expect(result.time).toContain('2024-11-14');
			expect(result.time).toContain('15:47');
		});

		it('returns empty object when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse('This is not valid JSON');

			const result = await initialTimeExtractor.run(
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
					// Missing time field
				}),
			);

			const result = await initialTimeExtractor.run(
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
					time: {
						year: 2024,
						month: 11,
						day: 14,
						hour: 15,
						minute: 47,
						second: 0,
						dayOfWeek: 'Thursday',
					},
				}),
			);

			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			const systemMessage = call!.prompt.messages.find(m => m.role === 'system');
			expect(systemMessage).toBeDefined();
			expect(systemMessage!.content).toContain('analyzing roleplay messages');
		});

		it('skips system messages from chat in the prompt', async () => {
			const context = createMockContext({
				chat: [
					{
						mes: 'System message that should be skipped',
						is_user: false,
						is_system: true,
						name: 'System',
					},
					{
						mes: '*Elena enters the room.*',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
				],
			});
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					time: {
						year: 2024,
						month: 1,
						day: 1,
						hour: 12,
						minute: 0,
						second: 0,
						dayOfWeek: 'Monday',
					},
				}),
			);

			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).not.toContain(
				'System message that should be skipped',
			);
			expect(promptContent).toContain('Elena enters the room');
		});

		it('uses partial snapshot data if provided', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot: Partial<Snapshot> = {
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'near the window',
					props: ['menu', 'coffee cup'],
					locationType: 'heated',
				},
			};

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					time: {
						year: 2024,
						month: 11,
						day: 14,
						hour: 15,
						minute: 47,
						second: 0,
						dayOfWeek: 'Thursday',
					},
				}),
			);

			const result = await initialTimeExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// The extractor should still work with partial snapshot
			expect(result.time).toBeDefined();
		});
	});

	describe('prompt name', () => {
		it('has the correct name', () => {
			expect(initialTimeExtractor.name).toBe('initialTime');
		});

		it('has the correct category', () => {
			expect(initialTimeExtractor.category).toBe('time');
		});

		it('has a default temperature', () => {
			expect(initialTimeExtractor.defaultTemperature).toBe(0.3);
		});
	});
});
