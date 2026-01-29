/**
 * Initial Location Extractor
 *
 * Extracts the initial location (area, place, position) from the opening messages of a roleplay.
 * Props are handled by a separate propsExtractor, so props are initialized as empty array here.
 */

import type { Generator } from '../../generator';
import type { Snapshot, LocationState } from '../../types';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import { initialLocationPrompt } from '../../prompts/initial/locationPrompt';
import { buildExtractorPrompt, generateAndParse, getExtractorTemperature } from '../utils';
import { createEmptySnapshot, createProjectionFromSnapshot } from '../../types/snapshot';

/**
 * Initial location extractor.
 * Extracts area, place, and position from the opening messages.
 */
export const locationExtractor: InitialExtractor = {
	name: 'initialLocation',
	displayName: 'location',
	category: 'location',
	defaultTemperature: 0.5,
	prompt: initialLocationPrompt,

	shouldRun(
		settings: ExtractionSettings,
		context: ExtractionContext,
		partialSnapshot?: Partial<Snapshot>,
	): boolean {
		// Skip if location already exists (e.g., from card extensions)
		if (partialSnapshot?.location) {
			return false;
		}
		return settings.track.location && context.chat.length > 0;
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		_partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Create a minimal projection for buildExtractorPrompt
		// We need source for createProjectionFromSnapshot, use message 0
		const emptySnapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
		const projection = createProjectionFromSnapshot(emptySnapshot, {
			messageId: 0,
			swipeId: 0,
		});

		// Build the prompt
		const builtPrompt = buildExtractorPrompt(
			initialLocationPrompt,
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
			'location',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			initialLocationPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parse failure
		if (!result.success || !result.data) {
			console.warn(
				'[BlazeTracker] initialLocation extraction failed, returning empty',
			);
			return {};
		}

		// Build the location state
		const location: LocationState = {
			area: result.data.area,
			place: result.data.place,
			position: result.data.position,
			props: [], // Props are handled by a separate extractor
			locationType: result.data.locationType,
		};

		return { location };
	},
};
