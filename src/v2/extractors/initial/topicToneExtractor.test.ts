/**
 * Topic/Tone Extractor Tests
 *
 * Tests that verify the topic/tone extractor builds prompts correctly
 * and parses responses properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { initialTopicToneExtractor } from './topicToneExtractor';
import { createMockContext, createMockSettings } from './testHelpers';

describe('initialTopicToneExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	describe('shouldRun', () => {
		it('returns true when scene tracking is enabled and chat has messages', () => {
			const context = createMockContext();
			const settings = createMockSettings();

			expect(initialTopicToneExtractor.shouldRun(settings, context)).toBe(true);
		});

		it('returns false when scene tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, scene: false },
			});

			expect(initialTopicToneExtractor.shouldRun(settings, context)).toBe(false);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();

			expect(initialTopicToneExtractor.shouldRun(settings, context)).toBe(false);
		});
	});

	describe('run', () => {
		it('passes character name to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'A reunion scene.',
					topic: 'reunion',
					tone: 'hopeful',
				}),
			);

			await initialTopicToneExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			expect(call).toBeDefined();

			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('Elena');
		});

		// Note: characterDescription was removed from this prompt in the refactor

		it('passes messages to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					topic: 'meeting',
					tone: 'casual',
				}),
			);

			await initialTopicToneExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('coffee shop');
		});

		it('uses the configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: { ...createMockSettings().temperatures, scene: 0.8 },
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					topic: 'meeting',
					tone: 'casual',
				}),
			);

			await initialTopicToneExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.8);
		});

		it('returns scene with topic, tone, and default tension', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Friends reuniting after a year.',
					topic: 'reunion after separation',
					tone: 'nostalgic and hopeful',
				}),
			);

			const result = await initialTopicToneExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.scene).toBeDefined();
			expect(result.scene?.topic).toBe('reunion after separation');
			expect(result.scene?.tone).toBe('nostalgic and hopeful');

			// Default tension values for initial extraction
			expect(result.scene?.tension).toBeDefined();
			expect(result.scene?.tension.level).toBe('relaxed');
			expect(result.scene?.tension.type).toBe('conversation');
			expect(result.scene?.tension.direction).toBe('stable');
		});

		it('returns empty object when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse('This is not valid JSON');

			const result = await initialTopicToneExtractor.run(
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
					topic: 'meeting',
					// Missing tone field
				}),
			);

			const result = await initialTopicToneExtractor.run(
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
					topic: 'meeting',
					tone: 'casual',
				}),
			);

			await initialTopicToneExtractor.run(mockGenerator, context, settings, {});

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
					topic: 'arrival',
					tone: 'neutral',
				}),
			);

			await initialTopicToneExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).not.toContain(
				'System message that should be skipped',
			);
			expect(promptContent).toContain('Elena enters the room');
		});

		it('handles various topic/tone combinations', async () => {
			const testCases = [
				{ topic: 'casual conversation', tone: 'lighthearted' },
				{ topic: 'confrontation', tone: 'tense' },
				{ topic: 'romantic encounter', tone: 'intimate' },
				{ topic: 'investigation', tone: 'mysterious' },
				{ topic: 'celebration', tone: 'joyful' },
			];

			const context = createMockContext();
			const settings = createMockSettings();

			for (const testCase of testCases) {
				mockGenerator.clearCalls();
				mockGenerator.setDefaultResponse(
					JSON.stringify({
						reasoning: `Scene is about ${testCase.topic}.`,
						topic: testCase.topic,
						tone: testCase.tone,
					}),
				);

				const result = await initialTopicToneExtractor.run(
					mockGenerator,
					context,
					settings,
					{},
				);

				expect(result.scene?.topic).toBe(testCase.topic);
				expect(result.scene?.tone).toBe(testCase.tone);
			}
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(initialTopicToneExtractor.name).toBe('initialTopicTone');
		});

		it('has the correct category', () => {
			expect(initialTopicToneExtractor.category).toBe('scene');
		});

		it('has a default temperature', () => {
			expect(initialTopicToneExtractor.defaultTemperature).toBe(0.5);
		});
	});
});
