/**
 * Tension Extractor Tests
 *
 * Tests that verify the tension extractor builds prompts correctly
 * and parses responses properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { tensionExtractor } from './tensionExtractor';
import { createMockContext, createMockSettings, createPartialSnapshot } from './testHelpers';
import type { SceneState } from '../../types';

describe('tensionExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	function createMockScene(overrides: Partial<SceneState> = {}): SceneState {
		return {
			topic: 'casual conversation',
			tone: 'friendly',
			tension: {
				level: 'relaxed',
				type: 'conversation',
				direction: 'stable',
			},
			...overrides,
		};
	}

	describe('shouldRun', () => {
		it('returns true when scene tracking is enabled and chat has messages', () => {
			const context = createMockContext();
			const settings = createMockSettings();

			expect(tensionExtractor.shouldRun(settings, context)).toBe(true);
		});

		it('returns false when scene tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, scene: false },
			});

			expect(tensionExtractor.shouldRun(settings, context)).toBe(false);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();

			expect(tensionExtractor.shouldRun(settings, context)).toBe(false);
		});
	});

	describe('run', () => {
		it('returns empty object when partialSnapshot has no scene', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot(); // No scene

			const result = await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('passes character name to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Analysis of tension.',
					level: 'relaxed',
					type: 'conversation',
				}),
			);

			await tensionExtractor.run(
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
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					level: 'relaxed',
					type: 'conversation',
				}),
			);

			await tensionExtractor.run(
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
				temperatures: { ...createMockSettings().temperatures, scene: 0.9 },
			});
			const partialSnapshot = createPartialSnapshot({
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					level: 'relaxed',
					type: 'conversation',
				}),
			);

			await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.9);
		});

		it('merges tension into existing scene', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				scene: createMockScene({
					topic: 'reunion',
					tone: 'nostalgic',
				}),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Emotional reunion scene.',
					level: 'charged',
					type: 'vulnerable',
				}),
			);

			const result = await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.scene).toBeDefined();
			// Original topic/tone preserved
			expect(result.scene?.topic).toBe('reunion');
			expect(result.scene?.tone).toBe('nostalgic');
			// Tension updated
			expect(result.scene?.tension.level).toBe('charged');
			expect(result.scene?.tension.type).toBe('vulnerable');
			// Direction is always 'stable' for initial extraction
			expect(result.scene?.tension.direction).toBe('stable');
		});

		it('handles all valid tension levels', async () => {
			const levels = [
				'relaxed',
				'aware',
				'guarded',
				'tense',
				'charged',
				'volatile',
				'explosive',
			];

			const context = createMockContext();
			const settings = createMockSettings();

			for (const level of levels) {
				mockGenerator.clearCalls();
				const partialSnapshot = createPartialSnapshot({
					scene: createMockScene(),
				});

				mockGenerator.setDefaultResponse(
					JSON.stringify({
						reasoning: `Tension level is ${level}.`,
						level,
						type: 'conversation',
					}),
				);

				const result = await tensionExtractor.run(
					mockGenerator,
					context,
					settings,
					partialSnapshot,
				);

				expect(result.scene?.tension.level).toBe(level);
			}
		});

		it('handles all valid tension types', async () => {
			const types = [
				'confrontation',
				'intimate',
				'vulnerable',
				'celebratory',
				'negotiation',
				'suspense',
				'conversation',
			];

			const context = createMockContext();
			const settings = createMockSettings();

			for (const type of types) {
				mockGenerator.clearCalls();
				const partialSnapshot = createPartialSnapshot({
					scene: createMockScene(),
				});

				mockGenerator.setDefaultResponse(
					JSON.stringify({
						reasoning: `Tension type is ${type}.`,
						level: 'relaxed',
						type,
					}),
				);

				const result = await tensionExtractor.run(
					mockGenerator,
					context,
					settings,
					partialSnapshot,
				);

				expect(result.scene?.tension.type).toBe(type);
			}
		});

		it('direction is always stable for initial extraction', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					level: 'tense',
					type: 'confrontation',
				}),
			);

			const result = await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// Direction should always be 'stable' for initial extraction since there's no prior state
			expect(result.scene?.tension.direction).toBe('stable');
		});

		it('returns empty object when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse('This is not valid JSON');

			const result = await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('returns empty object when LLM returns invalid level', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					level: 'invalid_level',
					type: 'conversation',
				}),
			);

			const result = await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('returns empty object when LLM returns invalid type', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					level: 'relaxed',
					type: 'invalid_type',
				}),
			);

			const result = await tensionExtractor.run(
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
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Incomplete response',
					level: 'relaxed',
					// Missing type field
				}),
			);

			const result = await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result).toEqual({});
		});

		it('includes system messages in prompt structure', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				scene: createMockScene(),
			});

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test',
					level: 'relaxed',
					type: 'conversation',
				}),
			);

			await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall();
			const systemMessage = call!.prompt.messages.find(m => m.role === 'system');
			expect(systemMessage).toBeDefined();
			expect(systemMessage!.content).toContain('analyzing roleplay messages');
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(tensionExtractor.name).toBe('initialTension');
		});

		it('has the correct category', () => {
			expect(tensionExtractor.category).toBe('scene');
		});

		it('has a default temperature', () => {
			expect(tensionExtractor.defaultTemperature).toBe(0.6);
		});
	});
});
