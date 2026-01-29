/**
 * Initial Props Extractor
 *
 * Extracts notable objects and props from the opening messages of a roleplay.
 * Depends on location being extracted first (props are tied to the current location).
 * Depends on characters/outfits being extracted first (to filter out worn clothing).
 */

import type { Generator } from '../../generator';
import type { Snapshot } from '../../types';
import type { ExtractedInitialProps } from '../../types/extraction';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import { initialPropsPrompt } from '../../prompts/initial/propsPrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	getAllOutfitItems,
	filterPropsAgainstOutfits,
	getExtractorTemperature,
} from '../utils';
import { createEmptySnapshot, createProjectionFromSnapshot } from '../../types';
import { debugLog, debugWarn } from '../../../utils/debug';

/**
 * Initial props extractor.
 *
 * Extracts notable objects and props from the scene opening.
 * Requires location to be extracted first.
 */
export const initialPropsExtractor: InitialExtractor<ExtractedInitialProps> = {
	name: 'initialProps',
	displayName: 'props',
	category: 'props',
	defaultTemperature: 0.4,
	prompt: initialPropsPrompt,

	/**
	 * Check if this extractor should run.
	 * Requires:
	 * - props tracking enabled
	 * - at least one message
	 * - location already extracted (props are tied to location)
	 *
	 * Note: Characters are optional - if not available, outfit filtering is skipped.
	 */
	shouldRun(
		settings: ExtractionSettings,
		context: ExtractionContext,
		partialSnapshot?: Partial<Snapshot>,
	): boolean {
		// Must have props tracking enabled
		if (!settings.track.props) {
			return false;
		}

		// Must have at least one message
		if (context.chat.length === 0) {
			return false;
		}

		// Location must be extracted first (props are tied to location)
		if (!partialSnapshot?.location) {
			return false;
		}

		return true;
	},

	/**
	 * Run props extraction.
	 */
	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Safety check: location must exist
		if (!partialSnapshot.location) {
			return {};
		}

		// Create a temporary projection to get formatted location and outfit strings
		const tempSnapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
		tempSnapshot.location = partialSnapshot.location;
		if (partialSnapshot.characters) {
			tempSnapshot.characters = partialSnapshot.characters;
		}
		// Note: charactersPresent is derived from Object.keys(characters) in createProjectionFromSnapshot
		const tempProjection = createProjectionFromSnapshot(tempSnapshot, {
			messageId: 0,
			swipeId: 0,
		});

		// Build the prompt (characterOutfits is now a standard placeholder)
		const builtPrompt = buildExtractorPrompt(
			initialPropsPrompt,
			context,
			tempProjection,
			settings,
			0,
			context.chat.length - 1,
		);

		// Get temperature (prompt override → category → default)
		// Props uses location temperature category
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'location',
			this.defaultTemperature,
		);

		// Generate and parse
		const result = await generateAndParse(
			generator,
			initialPropsPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parse failure
		if (!result.success || !result.data) {
			debugWarn('Props extraction failed, returning empty');
			return {};
		}

		const extracted = result.data;

		// Filter out props that match worn outfit items
		const outfitItems = getAllOutfitItems(tempProjection);
		const filteredProps = filterPropsAgainstOutfits(extracted.props, outfitItems);

		if (filteredProps.length !== extracted.props.length) {
			debugLog(
				`Filtered ${extracted.props.length - filteredProps.length} props that matched outfit items`,
			);
		}

		// Return updated location with filtered props
		return {
			location: {
				...partialSnapshot.location,
				props: filteredProps,
			},
		};
	},
};
