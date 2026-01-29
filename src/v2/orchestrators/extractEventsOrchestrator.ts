import type { Generator } from '../generator';
import type { EventStore } from '../store';
import type {
	ExtractionContext,
	ExtractionSettings,
	ExtractionResult,
	RunStrategyContext,
	ExtractorState,
	EventExtractor,
	PerCharacterExtractor,
	PerPairExtractor,
} from '../extractors/types';
import { createExtractorState } from '../extractors/types';
import type { Event, MessageAndSwipe } from '../types';
import { sortPair } from '../types/snapshot';
import { buildSwipeContextFromExtraction } from '../extractors/utils';
import {
	coreEventExtractors,
	propsEventExtractors,
	narrativeEventExtractors,
	chapterEventExtractors,
	globalCharacterExtractors,
	perCharacterExtractors,
	globalRelationshipExtractors,
	perPairExtractors,
} from '../extractors/events';
import { startSection, completeSection, updateSectionLabel } from '../extractors/progressTracker';
import { debugLog, errorLog } from '../../utils/debug';

/** State tracked for each extractor across turns */
const extractorStates: Map<string, ExtractorState> = new Map();

function getExtractorState(name: string): ExtractorState {
	if (!extractorStates.has(name)) {
		extractorStates.set(name, createExtractorState());
	}
	return extractorStates.get(name)!;
}

/**
 * Run event extraction for a turn.
 */
export async function extractEvents(
	generator: Generator,
	context: ExtractionContext,
	settings: ExtractionSettings,
	store: EventStore,
	currentMessage: MessageAndSwipe,
	setStatus?: (status: string) => void,
	abortSignal?: AbortSignal,
): Promise<ExtractionResult> {
	const errors: Array<{ extractor: string; error: Error }> = [];
	const turnEvents: Event[] = [];
	let chapterEnded = false;

	// Build run strategy context
	const buildContext = (extractor: EventExtractor): RunStrategyContext => {
		const state = getExtractorState(extractor.name);
		return {
			store,
			context,
			settings,
			currentMessage,
			turnEvents,
			ranAtMessages: state.ranAtMessages,
			producedAtMessages: state.producedAtMessages,
		};
	};

	// Helper to run an extractor (progress is tracked at section level)
	async function runExtractor(extractor: EventExtractor): Promise<void> {
		const strategyContext = buildContext(extractor);
		if (!extractor.shouldRun(strategyContext)) {
			debugLog(`Skipping ${extractor.name} - shouldRun returned false`);
			return;
		}

		const label = `Extracting ${extractor.displayName}...`;
		updateSectionLabel(label);
		setStatus?.(label);

		try {
			const events = await extractor.run(
				generator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
				abortSignal,
			);

			// Update extractor state
			const state = getExtractorState(extractor.name);
			state.ranAtMessages.push(currentMessage);
			if (events.length > 0) {
				state.producedAtMessages.push(currentMessage);
				debugLog(`${extractor.name} produced ${events.length} events`);
			} else {
				debugLog(`${extractor.name} produced no events`);
			}

			// Add events to turn
			turnEvents.push(...events);
		} catch (error) {
			errorLog(`${extractor.name} failed:`, error);
			errors.push({
				extractor: extractor.name,
				error: error instanceof Error ? error : new Error(String(error)),
			});
		}
	}

	// Helper to run per-character extractor for all present characters
	async function runPerCharacter(extractor: PerCharacterExtractor): Promise<boolean> {
		const swipeContext = buildSwipeContextFromExtraction(context);
		const projection = store.projectStateAtMessage(
			currentMessage.messageId,
			swipeContext,
		);
		const characters = projection.charactersPresent;

		for (const character of characters) {
			// Check if aborted before each character
			if (abortSignal?.aborted) {
				return true; // Signal that we aborted
			}

			const strategyContext = buildContext(extractor as any);
			if (!extractor.shouldRun(strategyContext)) continue;

			const label = `Extracting ${extractor.displayName} for ${character}...`;
			updateSectionLabel(label);
			setStatus?.(label);

			try {
				const events = await extractor.run(
					generator,
					context,
					settings,
					store,
					currentMessage,
					turnEvents,
					character,
					abortSignal,
				);
				turnEvents.push(...events);
			} catch (error) {
				errorLog(`${extractor.name} (${character}) failed:`, error);
				errors.push({
					extractor: `${extractor.name}:${character}`,
					error:
						error instanceof Error
							? error
							: new Error(String(error)),
				});
			}
		}
		return false; // Not aborted
	}

	// Helper to run per-pair extractor for all present pairs
	async function runPerPair(extractor: PerPairExtractor): Promise<boolean> {
		const swipeContext = buildSwipeContextFromExtraction(context);
		const projection = store.projectStateAtMessage(
			currentMessage.messageId,
			swipeContext,
		);
		const characters = projection.charactersPresent;

		// Generate all pairs
		const pairs: [string, string][] = [];
		for (let i = 0; i < characters.length; i++) {
			for (let j = i + 1; j < characters.length; j++) {
				pairs.push(sortPair(characters[i], characters[j]));
			}
		}

		for (const pair of pairs) {
			// Check if aborted before each pair
			if (abortSignal?.aborted) {
				return true; // Signal that we aborted
			}

			const strategyContext = buildContext(extractor as any);
			if (!extractor.shouldRun(strategyContext)) continue;

			const label = `Extracting ${extractor.displayName} for ${pair[0]} & ${pair[1]}...`;
			updateSectionLabel(label);
			setStatus?.(label);

			try {
				const events = await extractor.run(
					generator,
					context,
					settings,
					store,
					currentMessage,
					turnEvents,
					pair,
					abortSignal,
				);
				turnEvents.push(...events);
			} catch (error) {
				errorLog(`${extractor.name} (${pair.join('/')}) failed:`, error);
				errors.push({
					extractor: `${extractor.name}:${pair.join('/')}`,
					error:
						error instanceof Error
							? error
							: new Error(String(error)),
				});
			}
		}
		return false; // Not aborted
	}

	// Helper to create aborted result (no events saved)
	const abortedResult = (): ExtractionResult => ({
		store,
		newEvents: [],
		chapterEnded: false,
		errors,
		aborted: true,
	});

	// Run extractors in phases (sections)

	// Section: Core extractors (time, location, climate, topic/tone, tension)
	if (abortSignal?.aborted) return abortedResult();
	startSection('core', 'Extracting core state...');
	for (const extractor of coreEventExtractors) {
		await runExtractor(extractor);
		if (abortSignal?.aborted) {
			completeSection('core');
			return abortedResult();
		}
	}
	completeSection('core');

	// Section: Character presence (global)
	if (abortSignal?.aborted) return abortedResult();
	startSection('characterPresence', 'Detecting character presence...');
	for (const extractor of globalCharacterExtractors) {
		await runExtractor(extractor);
		if (abortSignal?.aborted) {
			completeSection('characterPresence');
			return abortedResult();
		}
	}
	completeSection('characterPresence');

	// Section: Per-character extractors (includes outfit changes)
	if (abortSignal?.aborted) return abortedResult();
	startSection('perCharacter', 'Extracting character states...');
	for (const extractor of perCharacterExtractors) {
		const wasAborted = await runPerCharacter(extractor);
		if (wasAborted || abortSignal?.aborted) {
			completeSection('perCharacter');
			return abortedResult();
		}
	}
	completeSection('perCharacter');

	// Section: Props extractors (runs AFTER outfit changes to integrate clothing as props)
	if (abortSignal?.aborted) return abortedResult();
	startSection('props', 'Extracting props changes...');
	for (const extractor of propsEventExtractors) {
		await runExtractor(extractor);
		if (abortSignal?.aborted) {
			completeSection('props');
			return abortedResult();
		}
	}
	completeSection('props');

	// Section: Relationship subjects (global)
	if (abortSignal?.aborted) return abortedResult();
	startSection('relationshipSubjects', 'Extracting relationship subjects...');
	for (const extractor of globalRelationshipExtractors) {
		await runExtractor(extractor);
		if (abortSignal?.aborted) {
			completeSection('relationshipSubjects');
			return abortedResult();
		}
	}
	completeSection('relationshipSubjects');

	// Section: Per-pair relationship extractors
	if (abortSignal?.aborted) return abortedResult();
	startSection('perPair', 'Extracting relationship details...');
	for (const extractor of perPairExtractors) {
		const wasAborted = await runPerPair(extractor);
		if (wasAborted || abortSignal?.aborted) {
			completeSection('perPair');
			return abortedResult();
		}
	}
	completeSection('perPair');

	// Section: Narrative extractors
	if (abortSignal?.aborted) return abortedResult();
	startSection('narrative', 'Extracting narrative...');
	for (const extractor of narrativeEventExtractors) {
		await runExtractor(extractor);
		if (abortSignal?.aborted) {
			completeSection('narrative');
			return abortedResult();
		}
	}
	completeSection('narrative');

	// Section: Chapter extractors
	if (abortSignal?.aborted) return abortedResult();
	startSection('chapter', 'Checking chapter boundaries...');
	for (const extractor of chapterEventExtractors) {
		await runExtractor(extractor);
		if (abortSignal?.aborted) {
			completeSection('chapter');
			return abortedResult();
		}
	}
	completeSection('chapter');

	// Check if chapter ended
	chapterEnded = turnEvents.some(
		e => e.kind === 'chapter' && 'subkind' in e && e.subkind === 'ended',
	);

	// Debug: Log extracted events by kind
	const eventsByKind: Record<string, number> = {};
	for (const e of turnEvents) {
		const key = 'subkind' in e ? `${e.kind}:${e.subkind}` : e.kind;
		eventsByKind[key] = (eventsByKind[key] || 0) + 1;
	}
	debugLog(
		`extractEvents: ${turnEvents.length} events extracted for msg ${currentMessage.messageId} swipe ${currentMessage.swipeId}:`,
		eventsByKind,
	);

	// Add events to store
	store.appendEvents(turnEvents);

	return {
		store,
		newEvents: turnEvents,
		chapterEnded,
		errors,
	};
}

/**
 * Reset extractor states (for testing or fresh start).
 */
export function resetExtractorStates(): void {
	extractorStates.clear();
}
