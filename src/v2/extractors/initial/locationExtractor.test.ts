/**
 * Location Extractor Tests
 *
 * Tests that verify the location extractor builds prompts correctly
 * and parses responses properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { locationExtractor } from './locationExtractor';
import {
	createMockContext,
	createMockSettings,
	createPartialSnapshot,
	createMockLocation,
} from './testHelpers';

describe('locationExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	describe('shouldRun', () => {
		it('returns true when location tracking is enabled and chat has messages', () => {
			const context = createMockContext();
			const settings = createMockSettings();

			expect(locationExtractor.shouldRun(settings, context)).toBe(true);
		});

		it('returns false when location tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, location: false },
			});

			expect(locationExtractor.shouldRun(settings, context)).toBe(false);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();

			expect(locationExtractor.shouldRun(settings, context)).toBe(false);
		});

		it('returns false when location already exists in partialSnapshot', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
			});

			expect(
				locationExtractor.shouldRun(settings, context, partialSnapshot),
			).toBe(false);
		});
	});

	describe('run', () => {
		it('passes character name to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'The scene takes place in a coffee shop.',
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Near the window',
					locationType: 'heated',
				}),
			);

			await locationExtractor.run(mockGenerator, context, settings, {});

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
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Near the window',
					locationType: 'heated',
				}),
			);

			await locationExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('coffee shop');
			expect(promptContent).toContain('window');
		});

		it('uses the configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: {
					...createMockSettings().temperatures,
					location: 0.7,
				},
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Near the window',
					locationType: 'heated',
				}),
			);

			await locationExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.7);
		});

		it('returns extracted location in snapshot', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'The scene is at a coffee shop.',
					area: 'Downtown Seattle',
					place: 'The Starlight Diner',
					position: 'Corner booth',
					locationType: 'heated',
				}),
			);

			const result = await locationExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.location).toBeDefined();
			expect(result.location?.area).toBe('Downtown Seattle');
			expect(result.location?.place).toBe('The Starlight Diner');
			expect(result.location?.position).toBe('Corner booth');
			expect(result.location?.locationType).toBe('heated');
			expect(result.location?.props).toEqual([]);
		});

		it('handles all location types', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			const locationTypes = [
				'outdoor',
				'modern',
				'heated',
				'unheated',
				'underground',
				'tent',
				'vehicle',
			];

			for (const locationType of locationTypes) {
				mockGenerator.clearCalls();
				mockGenerator.setDefaultResponse(
					JSON.stringify({
						reasoning: `Location type is ${locationType}`,
						area: 'Test Area',
						place: 'Test Place',
						position: 'Test Position',
						locationType,
					}),
				);

				const result = await locationExtractor.run(
					mockGenerator,
					context,
					settings,
					{},
				);
				expect(result.location?.locationType).toBe(locationType);
			}
		});

		it('returns empty object when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse('This is not valid JSON');

			const result = await locationExtractor.run(
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
					area: 'Downtown',
					// Missing place and position
				}),
			);

			const result = await locationExtractor.run(
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
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Near the window',
					locationType: 'heated',
				}),
			);

			await locationExtractor.run(mockGenerator, context, settings, {});

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
						mes: '*Elena enters the coffee shop.*',
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
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Entrance',
					locationType: 'heated',
				}),
			);

			await locationExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).not.toContain(
				'System message that should be skipped',
			);
			expect(promptContent).toContain('Elena enters the coffee shop');
		});

		it('defaults to outdoor when locationType is invalid', async () => {
			const context = createMockContext();
			const settings = createMockSettings();

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Near the window',
					locationType: 'invalid_type',
				}),
			);

			const result = await locationExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			expect(result.location?.locationType).toBe('outdoor');
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(locationExtractor.name).toBe('initialLocation');
		});

		it('has the correct category', () => {
			expect(locationExtractor.category).toBe('location');
		});

		it('has a default temperature', () => {
			expect(locationExtractor.defaultTemperature).toBe(0.5);
		});
	});
});
