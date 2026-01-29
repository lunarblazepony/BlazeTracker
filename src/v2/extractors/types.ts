/**
 * V2 Extractor Types
 *
 * Defines interfaces for initial and event extractors.
 */

import type { Generator } from '../generator';
import type { EventStore } from '../store';
import type { Snapshot, Event, KindAndSubkind, MessageAndSwipe } from '../types';
import type { PromptTemplate } from '../prompts';

/**
 * SillyTavern context needed for extraction.
 * This is a subset of what SillyTavern.getContext() provides.
 */
export interface ExtractionContext {
	/** Current chat messages */
	chat: Array<{
		mes: string;
		is_user: boolean;
		is_system: boolean;
		name: string;
		swipe_id?: number;
		swipes?: string[];
		extra?: Record<string, unknown>;
	}>;
	/** Main character info */
	characters: Array<{
		name: string;
		description?: string;
		personality?: string;
		scenario?: string;
		first_mes?: string;
	}>;
	/** Current character index */
	characterId: number;
	/** User persona name */
	name1: string;
	/** Character name */
	name2: string;
	/** User persona description */
	persona?: string;
	/** Group info if in group chat */
	groups?: Array<{
		id: string;
		name: string;
		members: string[];
	}>;
	/** Current group ID if in group chat */
	groupId?: string;
}

/**
 * Settings that affect extraction behavior.
 */
export interface ExtractionSettings {
	/** Connection profile ID for LLM calls */
	profileId: string;
	/** Which extractors are enabled */
	track: {
		time: boolean;
		location: boolean;
		props: boolean;
		climate: boolean;
		characters: boolean;
		relationships: boolean;
		scene: boolean;
		narrative: boolean;
		chapters: boolean;
	};
	/** Temperature overrides per category */
	temperatures: {
		time: number;
		location: number;
		climate: number;
		characters: number;
		relationships: number;
		scene: number;
		narrative: number;
		chapters: number;
	};
	/** Custom prompt overrides */
	customPrompts: Record<
		string,
		{
			systemPrompt?: string;
			userTemplate?: string;
		}
	>;
	/** Per-prompt temperature overrides (takes precedence over category temperatures) */
	promptTemperatures?: Record<string, number>;
}

// ============================================
// Message Strategies
// ============================================

/**
 * Strategy for selecting which messages to include in extraction context.
 */
export type MessageStrategy =
	| { strategy: 'fixedNumber'; n: number }
	| { strategy: 'lastXMessages'; x: number }
	| { strategy: 'sinceLastEvent' }
	| { strategy: 'sinceLastEventOfKind'; kinds: KindAndSubkind[] };

/**
 * Get the number of messages to include based on strategy.
 */
export function getMessageCount(
	strategy: MessageStrategy,
	store: EventStore,
	currentMessage: MessageAndSwipe,
): number {
	switch (strategy.strategy) {
		case 'fixedNumber':
			return strategy.n;
		case 'lastXMessages':
			return strategy.x;
		case 'sinceLastEvent': {
			const events = store.getActiveEvents();
			if (events.length === 0) return currentMessage.messageId + 1;
			const lastEvent = events[events.length - 1];
			return currentMessage.messageId - lastEvent.source.messageId + 1;
		}
		case 'sinceLastEventOfKind': {
			const events = store.getActiveEvents();
			const matching = events.filter(e =>
				strategy.kinds.some(
					k =>
						e.kind === k.kind &&
						('subkind' in e
							? e.subkind === k.subkind
							: !k.subkind),
				),
			);
			if (matching.length === 0) return currentMessage.messageId + 1;
			const lastMatch = matching[matching.length - 1];
			return currentMessage.messageId - lastMatch.source.messageId + 1;
		}
	}
}

// ============================================
// Run Strategies
// ============================================

/**
 * Strategy for determining when an extractor should run.
 */
export type RunStrategy =
	| { strategy: 'everyMessage' }
	| { strategy: 'everyUserMessage' }
	| { strategy: 'everyAssistantMessage' }
	| { strategy: 'everyNMessages'; n: number }
	| { strategy: 'nSinceLastProducedEvents'; n: number }
	| { strategy: 'nSinceLastEventOfKind'; n: number; kinds: KindAndSubkind[] }
	| { strategy: 'newEventsOfKind'; kinds: KindAndSubkind[] }
	| { strategy: 'custom'; check: (context: RunStrategyContext) => boolean };

/**
 * Context for evaluating run strategies.
 */
export interface RunStrategyContext {
	store: EventStore;
	context: ExtractionContext;
	settings: ExtractionSettings;
	currentMessage: MessageAndSwipe;
	/** Events produced this turn by other extractors */
	turnEvents: Event[];
	/** Messages this extractor has already run at */
	ranAtMessages: MessageAndSwipe[];
	/** Messages where this extractor produced events */
	producedAtMessages: MessageAndSwipe[];
}

// ============================================
// Extractor Interfaces
// ============================================

/**
 * Base extractor interface shared by initial and event extractors.
 */
export interface BaseExtractor {
	/** Unique name for this extractor */
	name: string;
	/** Human-readable name for UI display (e.g., "characters" instead of "initialCharactersPresent") */
	displayName: string;
	/** Category for settings (time, location, characters, etc.) */
	category: keyof ExtractionSettings['track'];
	/** Default temperature for LLM calls */
	defaultTemperature: number;
}

/**
 * Initial extractor produces part of the initial Snapshot.
 */
export interface InitialExtractor<T = unknown> extends BaseExtractor {
	/** The prompt template for this extractor */
	prompt: PromptTemplate<T>;
	/** Check if this extractor should run (partialSnapshot allows dependency checks) */
	shouldRun(
		settings: ExtractionSettings,
		context: ExtractionContext,
		partialSnapshot?: Partial<Snapshot>,
	): boolean;
	/** Run extraction and return partial snapshot */
	run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>>;
}

/**
 * Event extractor produces events from message changes.
 */
export interface EventExtractor<T = unknown> extends BaseExtractor {
	/** The prompt template for this extractor */
	prompt: PromptTemplate<T>;
	/** How to select messages for context */
	messageStrategy: MessageStrategy;
	/** When this extractor should run */
	runStrategy: RunStrategy;
	/** Check if this extractor should run given current state */
	shouldRun(context: RunStrategyContext): boolean;
	/** Run extraction and return events */
	run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		store: EventStore,
		currentMessage: MessageAndSwipe,
		turnEvents: Event[],
		abortSignal?: AbortSignal,
	): Promise<Event[]>;
}

/**
 * Per-character event extractor runs once for each present character.
 */
export interface PerCharacterExtractor<T = unknown> extends Omit<EventExtractor<T>, 'run'> {
	/** Run extraction for a specific character */
	run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		store: EventStore,
		currentMessage: MessageAndSwipe,
		turnEvents: Event[],
		targetCharacter: string,
		abortSignal?: AbortSignal,
	): Promise<Event[]>;
}

/**
 * Per-pair event extractor runs once for each present character pair.
 */
export interface PerPairExtractor<T = unknown> extends Omit<EventExtractor<T>, 'run'> {
	/** Run extraction for a specific character pair */
	run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		store: EventStore,
		currentMessage: MessageAndSwipe,
		turnEvents: Event[],
		pair: [string, string],
		abortSignal?: AbortSignal,
	): Promise<Event[]>;
}

// ============================================
// Extractor State
// ============================================

/**
 * Tracks extractor execution state during a session.
 */
export interface ExtractorState {
	/** Messages this extractor has run at */
	ranAtMessages: MessageAndSwipe[];
	/** Messages where this extractor produced events */
	producedAtMessages: MessageAndSwipe[];
}

/**
 * Create empty extractor state.
 */
export function createExtractorState(): ExtractorState {
	return {
		ranAtMessages: [],
		producedAtMessages: [],
	};
}

// ============================================
// Extraction Result
// ============================================

/**
 * Result of running extraction for a turn.
 */
export interface ExtractionResult {
	/** Updated event store */
	store: EventStore;
	/** Events produced this turn */
	newEvents: Event[];
	/** Whether a chapter ended this turn */
	chapterEnded: boolean;
	/** Any errors that occurred */
	errors: Array<{ extractor: string; error: Error }>;
	/** Whether extraction was aborted */
	aborted?: boolean;
}

/**
 * Result of initial extraction.
 */
export interface InitialExtractionResult {
	/** The initial snapshot */
	snapshot: Snapshot;
	/** Any errors that occurred */
	errors: Array<{ extractor: string; error: Error }>;
	/** Whether extraction was aborted */
	aborted?: boolean;
}
