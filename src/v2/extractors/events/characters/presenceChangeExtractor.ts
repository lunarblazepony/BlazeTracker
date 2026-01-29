/**
 * Character Presence Change Event Extractor
 *
 * Detects which characters have appeared or departed from the scene.
 * This is a global extractor that runs for all characters at once.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	CharacterAppearedEvent,
	CharacterDepartedEvent,
	MessageAndSwipe,
	Projection,
} from '../../../types';
import type { ExtractedCharacterPresenceChange } from '../../../types/extraction';
import { presenceChangePrompt } from '../../../prompts/events/presenceChangePrompt';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	MessageStrategy,
	RunStrategy,
	RunStrategyContext,
} from '../../types';
import { getMessageCount } from '../../types';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapPresenceChange,
	evaluateRunStrategy,
	getPriorProjection,
	filterCharactersAppeared,
	filterCharactersDeparted,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';

/**
 * Character Presence Change Extractor
 *
 * Detects when characters appear or depart from the scene.
 * Returns CharacterAppearedEvent and CharacterDepartedEvent for all changes.
 */
export const presenceChangeExtractor: EventExtractor<ExtractedCharacterPresenceChange> = {
	name: 'presenceChange',
	displayName: 'presence',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: presenceChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 2 } as MessageStrategy,
	runStrategy: { strategy: 'everyMessage' } as RunStrategy,

	shouldRun(context: RunStrategyContext): boolean {
		// Check if character tracking is enabled
		if (!context.settings.track.characters) {
			return false;
		}
		// Evaluate the run strategy
		return evaluateRunStrategy(this.runStrategy, context);
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
		let projection: Projection;
		try {
			projection = projectWithTurnEvents(
				store,
				turnEvents,
				currentMessage.messageId,
				context,
			);
		} catch {
			// No initial snapshot yet - can't detect presence changes
			return [];
		}

		// Get prior projection for validation (state before this message)
		const priorProjection = getPriorProjection(store, currentMessage, context);

		// Determine message range
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build the prompt with character context
		const builtPrompt = buildExtractorPrompt(
			this.prompt,
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
			'characters',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse<ExtractedCharacterPresenceChange>(
			generator,
			this.prompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty
		if (!result.success || !result.data) {
			return [];
		}

		const extraction = result.data;

		// Validate and deduplicate against prior state
		const validatedAppeared = filterCharactersAppeared(
			extraction.appeared,
			priorProjection,
		);
		const validatedDeparted = filterCharactersDeparted(
			extraction.departed,
			priorProjection,
		);

		// If no valid changes, return empty
		if (validatedAppeared.length === 0 && validatedDeparted.length === 0) {
			return [];
		}

		// Map validated extraction to events
		const validatedExtraction: ExtractedCharacterPresenceChange = {
			...extraction,
			appeared: validatedAppeared,
			departed: validatedDeparted,
		};

		const events: (CharacterAppearedEvent | CharacterDepartedEvent)[] =
			mapPresenceChange(validatedExtraction, currentMessage);

		return events;
	},
};
