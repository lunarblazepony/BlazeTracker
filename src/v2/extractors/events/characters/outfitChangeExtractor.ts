/**
 * Character Outfit Change Event Extractor
 *
 * A PerCharacterExtractor that detects when a specific character has clothing
 * items added or removed. Runs once for EACH present character.
 */

import type { Generator } from '../../../generator';
import type {
	PerCharacterExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import type { Event, MessageAndSwipe, ExtractedOutfitChange, OutfitSlot } from '../../../types';
import { outfitChangePrompt } from '../../../prompts/events/outfitChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapOutfitChange,
	evaluateRunStrategy,
	getPriorProjection,
	filterOutfitSlotsToRemove,
	filterOutfitSlotsToAdd,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';
import type { EventStore } from '../../../store';

/**
 * Outfit change event extractor.
 * Detects clothing changes for a specific character and produces CharacterOutfitChangedEvent events.
 */
export const outfitChangeExtractor: PerCharacterExtractor<ExtractedOutfitChange> = {
	name: 'outfitChange',
	displayName: 'outfit',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: outfitChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 2 },
	runStrategy: { strategy: 'everyMessage' },

	shouldRun(context: RunStrategyContext): boolean {
		// Run if character tracking is enabled AND run strategy allows it
		return (
			context.settings.track.characters &&
			evaluateRunStrategy(this.runStrategy, context)
		);
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		store: EventStore,
		currentMessage: MessageAndSwipe,
		turnEvents: Event[],
		targetCharacter: string,
		abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Get prior projection for validation (state before this message)
		const priorProjection = getPriorProjection(store, currentMessage, context);
		const priorCharacterState = priorProjection?.characters[targetCharacter];

		// Calculate message range (last 2 messages)
		const messageCount = 2;
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build the prompt with target character and their current outfit
		const builtPrompt = buildExtractorPrompt(
			outfitChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{ targetCharacter },
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			outfitChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty array
		if (!result.success || !result.data) {
			console.warn(
				`[BlazeTracker] outfitChange extraction failed for ${targetCharacter}:`,
				result.error,
			);
			return [];
		}

		const extraction = result.data;

		// Post-process to intercept common LLM mistakes:
		// If "added" values contain removal suffixes, move them to "removed" instead
		const removalSuffixes = [
			'(removed)',
			'(taken off)',
			'(undressed)',
			'(off)',
			'(discarded)',
			'(shed)',
			'(stripped)',
			'(gone)',
			'(pulled off)',
			'(slipped off)',
			'(tossed aside)',
		];

		const slotsToMoveToRemoved: OutfitSlot[] = [];
		const cleanedAdded: Partial<Record<OutfitSlot, string>> = {};

		if (extraction.added) {
			for (const [slot, value] of Object.entries(extraction.added)) {
				if (value && typeof value === 'string') {
					const lowerValue = value.toLowerCase();
					const hasRemovalSuffix = removalSuffixes.some(suffix =>
						lowerValue.includes(suffix),
					);
					if (hasRemovalSuffix) {
						// This was meant to be a removal, not an addition
						slotsToMoveToRemoved.push(slot as OutfitSlot);
					} else {
						cleanedAdded[slot as OutfitSlot] = value;
					}
				} else if (value !== null && value !== undefined) {
					cleanedAdded[slot as OutfitSlot] = value;
				}
			}
		}

		// Merge moved slots into removed array (avoiding duplicates)
		const mergedRemoved = [...(extraction.removed || [])];
		for (const slot of slotsToMoveToRemoved) {
			if (!mergedRemoved.includes(slot)) {
				mergedRemoved.push(slot);
			}
		}

		// Update extraction with cleaned data
		extraction.added = cleanedAdded;
		extraction.removed = mergedRemoved;

		// Validate and deduplicate against prior state
		const validatedRemoved = filterOutfitSlotsToRemove(
			extraction.removed,
			priorCharacterState,
		);
		const validatedAdded = filterOutfitSlotsToAdd(
			extraction.added,
			priorCharacterState,
		);

		// If no valid outfit changes after validation, return empty array
		if (validatedRemoved.length === 0 && Object.keys(validatedAdded).length === 0) {
			return [];
		}

		// Map validated extraction to events
		const validatedExtraction: ExtractedOutfitChange = {
			...extraction,
			removed: validatedRemoved,
			added: validatedAdded,
		};

		const events = mapOutfitChange(validatedExtraction, currentMessage);

		return events;
	},
};
