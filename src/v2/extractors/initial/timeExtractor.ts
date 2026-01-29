/**
 * Initial Time Extractor
 *
 * Extracts the initial date/time from the opening messages of a roleplay.
 */

import type { Generator } from '../../generator';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import type { Snapshot, Projection, ExtractedInitialTime } from '../../types';
import {
	createEmptySnapshot,
	createProjectionFromSnapshot,
	extractedDateTimeToIsoString,
} from '../../types';
import { initialTimePrompt } from '../../prompts/initial/timePrompt';
import { buildExtractorPrompt, generateAndParse, getExtractorTemperature } from '../utils';
import { debugWarn } from '../../../utils/debug';

/**
 * Initial time extractor.
 * Extracts the date/time from the opening messages.
 */
export const initialTimeExtractor: InitialExtractor<ExtractedInitialTime> = {
	name: 'initialTime',
	displayName: 'time',
	category: 'time',
	defaultTemperature: 0.3,
	prompt: initialTimePrompt,

	shouldRun(
		settings: ExtractionSettings,
		context: ExtractionContext,
		partialSnapshot?: Partial<Snapshot>,
	): boolean {
		// Skip if time already exists (e.g., from card extensions)
		if (partialSnapshot?.time) {
			return false;
		}
		// Run if time tracking is enabled and there's at least one message
		return settings.track.time && context.chat.length > 0;
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Create an empty projection for prompt building
		// We use message 0 as the source since this is initial extraction
		const emptySnapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
		const projection: Projection = createProjectionFromSnapshot(
			{ ...emptySnapshot, ...partialSnapshot },
			{ messageId: 0, swipeId: 0 },
		);

		// Build the prompt with placeholders filled in
		const builtPrompt = buildExtractorPrompt(
			initialTimePrompt,
			context,
			projection,
			settings,
			0, // Start from message 0
			context.chat.length - 1, // Include all messages
		);

		// Get the temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'time',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			initialTimePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty object
		if (!result.success || !result.data) {
			debugWarn('initialTime extraction failed:', result.error);
			return {};
		}

		// Convert ExtractedDateTime to ISO string
		const isoString = extractedDateTimeToIsoString(result.data.time);

		return {
			time: isoString,
		};
	},
};
