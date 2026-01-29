/**
 * Tension Change Event Extractor
 *
 * Detects when the tension level, type, or direction of a scene has changed.
 */

import type { Generator } from '../../generator';
import type { EventStore } from '../../store';
import type { Event, TensionEvent, MessageAndSwipe } from '../../types';
import type { ExtractedTensionChange } from '../../types/extraction';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
	MessageStrategy,
	RunStrategy,
} from '../types';
import { tensionChangePrompt } from '../../prompts/events/tensionChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapTensionChange,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../utils';
import { debugWarn } from '../../../utils/debug';

/**
 * Tension change event extractor.
 *
 * Analyzes messages to detect changes in:
 * - Tension level (relaxed, aware, guarded, tense, charged, volatile, explosive)
 * - Tension type (confrontation, intimate, vulnerable, celebratory, negotiation, suspense, conversation)
 * - Tension direction (escalating, stable, decreasing)
 */
export const tensionChangeExtractor: EventExtractor<ExtractedTensionChange> = {
	name: 'tensionChange',
	displayName: 'tension',
	category: 'scene',
	defaultTemperature: 0.6,
	prompt: tensionChangePrompt,

	messageStrategy: {
		strategy: 'sinceLastEventOfKind',
		kinds: [{ kind: 'tension' }],
	} as MessageStrategy,
	runStrategy: { strategy: 'everyAssistantMessage' } as RunStrategy,

	shouldRun(context: RunStrategyContext): boolean {
		// Run if scene tracking is enabled AND the run strategy permits
		return (
			context.settings.track.scene &&
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
		abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Calculate message range based on strategy
		const messageCount = 2; // fixedNumber: 2
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build prompt with current tension context
		const builtPrompt = buildExtractorPrompt(
			tensionChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
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
			tensionChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure
		if (!result.success || !result.data) {
			debugWarn('tensionChange extraction failed');
			return [];
		}

		const extraction = result.data;

		// If no change detected, return empty array
		if (!extraction.changed) {
			return [];
		}

		// Map extraction to TensionEvent(s)
		// Direction is calculated programmatically based on level change
		const events: TensionEvent[] = mapTensionChange(
			extraction,
			currentMessage,
			projection.scene?.tension.level,
			projection.scene?.tension.type,
		);

		return events;
	},
};
