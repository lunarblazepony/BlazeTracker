/**
 * Initial Topic/Tone Extractor
 *
 * Extracts the initial topic and tone from the opening messages of a roleplay.
 */

import type { Generator } from '../../generator';
import type { Snapshot } from '../../types/snapshot';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import { initialTopicTonePrompt } from '../../prompts/initial/topicTonePrompt';
import { generateAndParse, buildExtractorPrompt, getExtractorTemperature } from '../utils';
import { createEmptySnapshot, createProjectionFromSnapshot } from '../../types/snapshot';
import { debugWarn } from '../../../utils/debug';

/**
 * Initial topic/tone extractor.
 *
 * Extracts the topic (what the scene is about) and tone (emotional atmosphere)
 * from the opening messages. Returns partial scene state with default tension
 * values that will be filled by the tensionExtractor.
 */
export const initialTopicToneExtractor: InitialExtractor = {
	name: 'initialTopicTone',
	displayName: 'scene',
	category: 'scene',
	defaultTemperature: 0.5,
	prompt: initialTopicTonePrompt,

	shouldRun(settings: ExtractionSettings, context: ExtractionContext): boolean {
		// Run if scene tracking is enabled and there's at least one message
		return settings.track.scene && context.chat.length > 0;
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		_partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Create a minimal projection for buildExtractorPrompt
		const emptySnapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
		const projection = createProjectionFromSnapshot(emptySnapshot, {
			messageId: 0,
			swipeId: 0,
		});

		// Build prompt with context
		const builtPrompt = buildExtractorPrompt(
			initialTopicTonePrompt,
			context,
			projection,
			settings,
			0,
			context.chat.length - 1,
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'scene',
			this.defaultTemperature,
		);

		// Generate and parse response
		const result = await generateAndParse(
			generator,
			initialTopicTonePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure
		if (!result.success || !result.data) {
			debugWarn('initialTopicTone extraction failed');
			return {};
		}

		const { topic, tone } = result.data;

		// Return partial snapshot with scene containing topic/tone and default tension
		// The tensionExtractor will fill in the actual tension values
		return {
			scene: {
				topic,
				tone,
				tension: {
					level: 'relaxed',
					type: 'conversation',
					direction: 'stable',
				},
			},
		};
	},
};
