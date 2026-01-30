/**
 * Secrets Change Event Extractor
 *
 * Detects when secrets one character holds about another change.
 * This is a per-pair extractor that runs once for each present character pair.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	RelationshipSecretAddedEvent,
	RelationshipSecretRemovedEvent,
	MessageAndSwipe,
} from '../../../types';
import type { ExtractedSecretsChange } from '../../../types/extraction';
import type {
	PerPairExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
	MessageStrategy,
	RunStrategy,
} from '../../types';
import { secretsChangePrompt } from '../../../prompts/events/secretsChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapSecretsChange,
	evaluateRunStrategy,
	getPriorProjection,
	filterSecretsToAdd,
	filterSecretsToRemove,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';
import { debugWarn } from '../../../../utils/debug';

/**
 * Secrets change per-pair event extractor.
 *
 * Analyzes messages to detect changes in secrets one character holds about another.
 * Returns RelationshipSecretAddedEvent and RelationshipSecretRemovedEvent events.
 */
export const secretsChangeExtractor: PerPairExtractor<ExtractedSecretsChange> = {
	name: 'secretsChange',
	displayName: 'secrets',
	category: 'relationships',
	defaultTemperature: 0.6,
	prompt: secretsChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 4 } as MessageStrategy,
	runStrategy: { strategy: 'everyNMessages', n: 4 } as RunStrategy,

	shouldRun(context: RunStrategyContext): boolean {
		// Run if relationships tracking is enabled AND the run strategy permits
		return (
			context.settings.track.relationships &&
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
		pair: [string, string],
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

		// Calculate message range based on strategy
		const messageCount = 3; // fixedNumber: 3
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build prompt with relationship pair context
		const builtPrompt = buildExtractorPrompt(
			secretsChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{ relationshipPair: pair },
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'relationships',
			this.defaultTemperature,
		);

		// Generate and parse response
		const result = await generateAndParse(
			generator,
			secretsChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure
		if (!result.success || !result.data) {
			debugWarn(`secretsChange extraction failed for ${pair[0]} and ${pair[1]}`);
			return [];
		}

		const extraction = result.data;

		// Validate and deduplicate each direction against prior state
		const validatedChanges = extraction.changes
			.map(change => {
				const validatedAdded = filterSecretsToAdd(
					change.added,
					priorProjection,
					change.fromCharacter,
					change.towardCharacter,
				);
				const validatedRemoved = filterSecretsToRemove(
					change.removed,
					priorProjection,
					change.fromCharacter,
					change.towardCharacter,
				);

				return {
					fromCharacter: change.fromCharacter,
					towardCharacter: change.towardCharacter,
					added: validatedAdded,
					removed: validatedRemoved,
				};
			})
			.filter(change => change.added.length > 0 || change.removed.length > 0);

		// If no valid changes after validation, return empty array
		if (validatedChanges.length === 0) {
			return [];
		}

		// Map validated extraction to events
		const validatedExtraction: ExtractedSecretsChange = {
			reasoning: extraction.reasoning,
			changes: validatedChanges,
		};

		const events: (RelationshipSecretAddedEvent | RelationshipSecretRemovedEvent)[] =
			mapSecretsChange(validatedExtraction, currentMessage);

		return events;
	},
};
