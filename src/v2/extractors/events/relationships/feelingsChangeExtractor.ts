/**
 * Relationship Feelings Change Event Extractor
 *
 * Detects when a character's feelings toward another character change.
 * This is a per-pair extractor that runs once for each present character pair.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	RelationshipFeelingAddedEvent,
	RelationshipFeelingRemovedEvent,
	MessageAndSwipe,
} from '../../../types';
import type { ExtractedFeelingsChange } from '../../../types/extraction';
import type {
	PerPairExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
	MessageStrategy,
	RunStrategy,
} from '../../types';
import { feelingsChangePrompt } from '../../../prompts/events/feelingsChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapFeelingsChange,
	evaluateRunStrategy,
	getPriorProjection,
	filterFeelingsToAdd,
	filterFeelingsToRemove,
	projectWithTurnEvents,
	getExtractorTemperature,
	limitMessageRange,
	getMaxMessages,
} from '../../utils';
import { debugWarn } from '../../../../utils/debug';
import { getWorldinfoForRelationship } from '../../../utils/worldinfo';

/**
 * Feelings change per-pair event extractor.
 *
 * Analyzes messages to detect changes in feelings between a specific character pair.
 * Returns RelationshipFeelingAddedEvent and RelationshipFeelingRemovedEvent events.
 */
export const feelingsChangeExtractor: PerPairExtractor<ExtractedFeelingsChange> = {
	name: 'feelingsChange',
	displayName: 'feelings',
	category: 'relationships',
	defaultTemperature: 0.6,
	prompt: feelingsChangePrompt,

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
		let messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		let messageEnd = currentMessage.messageId;

		// Apply message limiting
		const maxMessages = getMaxMessages(settings, this.name);
		({ messageStart, messageEnd } = limitMessageRange(
			messageStart,
			messageEnd,
			maxMessages,
		));

		// Fetch worldinfo for the relationship pair if enabled
		let worldinfo = '';
		if (settings.includeWorldinfo) {
			const messagesForWorldinfo: string[] = [];
			for (
				let i = messageStart;
				i <= messageEnd && i < context.chat.length;
				i++
			) {
				const msg = context.chat[i];
				if (!msg.is_system) {
					messagesForWorldinfo.push(msg.mes);
				}
			}
			worldinfo = await getWorldinfoForRelationship(messagesForWorldinfo, pair);
		}

		// Build prompt with relationship pair context
		const builtPrompt = buildExtractorPrompt(
			feelingsChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{
				relationshipPair: pair,
				worldinfo: worldinfo || 'No worldinfo available',
			},
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
			feelingsChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure
		if (!result.success || !result.data) {
			debugWarn(
				`feelingsChange extraction failed for pair ${pair[0]} and ${pair[1]}`,
			);
			return [];
		}

		const extraction = result.data;

		// Validate and deduplicate each direction against prior state
		const validatedChanges = extraction.changes
			.map(change => {
				const validatedAdded = filterFeelingsToAdd(
					change.added,
					priorProjection,
					change.fromCharacter,
					change.towardCharacter,
				);
				const validatedRemoved = filterFeelingsToRemove(
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
		const validatedExtraction: ExtractedFeelingsChange = {
			reasoning: extraction.reasoning,
			changes: validatedChanges,
		};

		const events: (RelationshipFeelingAddedEvent | RelationshipFeelingRemovedEvent)[] =
			mapFeelingsChange(validatedExtraction, currentMessage);

		return events;
	},
};
