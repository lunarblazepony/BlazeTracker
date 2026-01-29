import type { STContext } from '../types/st';
import type {
	TrackedState,
	NarrativeDateTime,
	Scene,
	Character,
	TimestampedEvent,
	Climate,
	ProceduralClimate,
	Relationship,
	NarrativeEvent,
	DerivedChapter,
	CharacterEvent,
	LocationPropEvent,
	RelationshipEvent,
	DirectionalRelationshipEvent,
	StatusChangedEvent,
	EventType,
	AffectedPair,
	MilestoneType,
	ProjectedRelationship,
} from '../types/state';
import { getSettings } from '../settings';
import { getMessageState, setMessageState } from '../utils/messageState';
// V2 Event System Bridge
import { abortExtraction as abortV2Extraction } from '../v2Bridge';

// Import extractors
import { extractTime, setTimeTrackerState } from './extractTime';
import { extractLocation, type LocationState } from './extractLocation';
import { extractClimateWithContext } from './extractClimate';
import { extractCharacters } from './extractCharacters';
import { extractScene, shouldExtractScene } from './extractScene';
import { extractEvent } from './extractEvent';
import { extractChapterBoundary } from './extractChapter';
import { extractInitialRelationship, updateRelationshipFromSignal } from './extractRelationships';
import { extractRelationshipFeelings } from './extractRelationshipFeelings';
import { extractRelationshipSecrets } from './extractRelationshipSecrets';
import { extractRelationshipWants } from './extractRelationshipWants';
import { extractRelationshipStatus } from './extractRelationshipStatus';
import { extractCharacterPresence } from './extractCharacterPresence';
import { extractCharacterPosition } from './extractCharacterPosition';
import { extractCharacterActivity } from './extractCharacterActivity';
import { extractCharacterMood } from './extractCharacterMood';
import { extractCharacterOutfit } from './extractCharacterOutfit';
import { extractCharacterPhysical } from './extractCharacterPhysical';
import { extractInitialOutfit } from './extractInitialOutfit';
import { extractLocationProps } from './extractLocationProps';
import { confirmMilestone } from './extractMilestone';
import { propAlreadyExists } from '../utils/clothingMatch';
import {
	setGranularStep,
	setPlannedSteps,
	markStepCompleted,
	isStepCompleted,
	recordStepTiming,
	type GranularStep,
} from './extractionProgress';
import {
	getOrInitializeNarrativeState,
	saveNarrativeState,
	addChapter,
	updateRelationship,
	getRelationship,
	getEventStore,
} from '../state/narrativeState';
import { checkChapterBoundary } from '../state/chapters';
import {
	findUnestablishedPairs,
	popVersionForMessage,
	getLatestVersionMessageId,
	sortPair,
} from '../state/relationships';
import {
	replaceEventsForMessage,
	recomputeFirstFor,
	getCurrentChapterEvents,
	getCurrentChapterEventIds,
	assignEventsToChapter,
	pairKey,
	generateStateEventsFromDiff,
	projectStateAtMessage,
	replaceStateEventsForMessage,
	addForecastEvent,
	reProjectRelationshipsFromEvents,
	saveChapterSnapshot,
	setInitialProjection,
	getInitialProjection,
	getLastMessageWithEvents,
} from '../state/eventStore';
import {
	isUnifiedEventStore,
	isLocationPropEvent,
	EVENT_TYPE_TO_MILESTONE,
	EVENT_TYPES,
} from '../types/state';
import { debugLog, debugWarn } from '../utils/debug';

// ============================================
// Module State
// ============================================

let currentAbortController: AbortController | null = null;
let extractionCount = 0;
let generationWasStopped = false;
let batchExtractionInProgress = false;

/**
 * Check if a batch extraction is currently in progress.
 */
export function isBatchExtractionInProgress(): boolean {
	return batchExtractionInProgress;
}

/**
 * Set the batch extraction flag. Used by bt-extract-all to prevent
 * GENERATION_ENDED handler from interfering.
 */
export function setBatchExtractionInProgress(value: boolean): void {
	batchExtractionInProgress = value;
}

// ============================================
// Types
// ============================================

export interface ExtractionResult {
	state: TrackedState;
	raw: Record<string, string>;
	/** Weather transition text to inject into prompt (if procedural weather enabled) */
	weatherTransition?: string;
}

export interface ExtractionOptions {
	forceSceneExtraction?: boolean;
}

// ============================================
// Send Button State Management
// ============================================

function setSendButtonState(isGenerating: boolean): void {
	const context = SillyTavern.getContext();
	if (isGenerating) {
		context.deactivateSendButtons();
	} else {
		context.activateSendButtons();
	}
}

// ============================================
// Abort Handling
// ============================================

export function setupExtractionAbortHandler(): void {
	const context = SillyTavern.getContext();

	context.eventSource.on(context.event_types.GENERATION_STOPPED, (() => {
		generationWasStopped = true;
		if (currentAbortController) {
			debugWarn('Generation stopped, aborting extraction');
			currentAbortController.abort();
			currentAbortController = null;
		}
		// Also abort v2 extraction
		abortV2Extraction();
	}) as (...args: unknown[]) => void);
}

/**
 * Check if the last generation was stopped/aborted by the user.
 * Returns the flag value and resets it to false.
 */
export function wasGenerationAborted(): boolean {
	const wasStopped = generationWasStopped;
	generationWasStopped = false;
	return wasStopped;
}

export function abortCurrentExtraction(): void {
	if (currentAbortController) {
		currentAbortController.abort();
		currentAbortController = null;
	}
}

// ============================================
// Default Values (for when extraction is disabled)
// ============================================

function getDefaultTime(): NarrativeDateTime {
	return {
		year: new Date().getFullYear(),
		month: 6,
		day: 15,
		hour: 12,
		minute: 0,
		second: 0,
		dayOfWeek: 'Monday',
	};
}

function getDefaultLocation(): LocationState {
	return {
		area: 'Unknown Area',
		place: 'Unknown Place',
		position: 'Main area',
		props: [],
	};
}

function _getDefaultClimate() {
	return {
		weather: 'sunny' as const,
		temperature: 70,
	};
}

function _getDefaultCharacters(): Character[] {
	return [];
}

function getDefaultScene(): Scene {
	return {
		topic: 'Scene in progress',
		tone: 'neutral',
		tension: {
			level: 'relaxed',
			direction: 'stable',
			type: 'conversation',
		},
	};
}

// ============================================
// Milestone Validation Helper
// ============================================

/**
 * Create a composite key for storing milestone descriptions per-pair.
 * This ensures each pair gets its own description when multiple pairs
 * have the same milestone type (e.g., two pairs both triggering first_conflict).
 */
function milestoneDescKey(milestoneType: MilestoneType, pair: [string, string]): string {
	const sorted = sortPair(pair[0], pair[1]);
	return `${milestoneType}|${sorted[0].toLowerCase()}|${sorted[1].toLowerCase()}`;
}

interface MilestoneValidationResult {
	validatedEventTypes: EventType[];
	/** Key is composite: `${milestoneType}|${pairA}|${pairB}` (sorted, lowercase) */
	milestoneDescriptions: Map<string, string>;
	correctedPairs: Map<EventType, [string, string]>;
	/** Pairs that were validated and accepted for each milestone type */
	acceptedPairs: Map<MilestoneType, [string, string]>;
}

/**
 * Validate milestone-triggering event types using LLM confirmation.
 * Returns validated event types and milestone descriptions.
 */
async function validateMilestoneCandidates(
	extractedEvent: TimestampedEvent,
	eventPairs: Record<string, [string, string] | [string, string][]>,
	messages: string,
	presentCharacters: string[],
	abortSignal: AbortSignal,
): Promise<MilestoneValidationResult> {
	const validatedEventTypes: EventType[] = [];
	// Key is composite: `${milestoneType}|${pairA}|${pairB}` (sorted, lowercase)
	const milestoneDescriptions = new Map<string, string>();
	const correctedPairs = new Map<EventType, [string, string]>();
	const acceptedPairs = new Map<MilestoneType, [string, string]>();

	// Process each event type
	for (const eventType of extractedEvent.eventTypes) {
		const milestoneType = EVENT_TYPE_TO_MILESTONE[eventType];

		// If this event type doesn't trigger a milestone, keep it as-is
		if (!milestoneType) {
			validatedEventTypes.push(eventType);
			continue;
		}

		// Get the pair(s) for this event type
		const pairData = eventPairs[eventType];
		if (!pairData) {
			// No pair specified, keep the event type
			validatedEventTypes.push(eventType);
			continue;
		}

		// Handle single pair vs multiple pairs
		const pairs: [string, string][] = Array.isArray(pairData[0])
			? (pairData as [string, string][])
			: [pairData as [string, string]];

		// Validate each pair for this event type
		for (const candidatePair of pairs) {
			try {
				const result = await confirmMilestone(
					messages,
					candidatePair,
					eventType,
					presentCharacters,
					abortSignal,
				);

				switch (result.result) {
					case 'accept':
						// Keep the event type
						if (!validatedEventTypes.includes(eventType)) {
							validatedEventTypes.push(eventType);
						}
						// Store the accepted pair for this milestone
						acceptedPairs.set(milestoneType, candidatePair);
						// Store the description with composite key (milestoneType + pair)
						if (result.description) {
							milestoneDescriptions.set(
								milestoneDescKey(
									milestoneType,
									candidatePair,
								),
								result.description,
							);
						}
						break;

					case 'wrong_event':
						// Replace with the correct event type
						if (
							result.correctEvent &&
							EVENT_TYPES.includes(
								result.correctEvent as EventType,
							)
						) {
							const correctEvent =
								result.correctEvent as EventType;
							if (
								!validatedEventTypes.includes(
									correctEvent,
								)
							) {
								validatedEventTypes.push(
									correctEvent,
								);
							}
							// Store the description for the correct milestone if applicable
							const correctMilestone =
								EVENT_TYPE_TO_MILESTONE[
									correctEvent
								];
							if (
								correctMilestone &&
								result.description
							) {
								milestoneDescriptions.set(
									milestoneDescKey(
										correctMilestone,
										candidatePair,
									),
									result.description,
								);
							}
							// Track the corrected pair for this event type
							correctedPairs.set(
								correctEvent,
								candidatePair,
							);
						}
						break;

					case 'wrong_pair':
						// Keep the event type but update the pair
						if (!validatedEventTypes.includes(eventType)) {
							validatedEventTypes.push(eventType);
						}
						if (result.correctPair) {
							correctedPairs.set(
								eventType,
								result.correctPair,
							);
							// Store description with the corrected pair
							if (result.description) {
								milestoneDescriptions.set(
									milestoneDescKey(
										milestoneType,
										result.correctPair,
									),
									result.description,
								);
							}
						}
						break;

					case 'reject':
						// Don't include this event type (it didn't actually happen)
						// Log for debugging
						debugLog(
							`Rejected milestone candidate: ${eventType} between ${candidatePair.join(' and ')}. Reason: ${result.reasoning}`,
						);
						break;
				}
			} catch (error) {
				// If confirmation fails, keep the original event type
				debugWarn(`Milestone confirmation failed for ${eventType}:`, error);
				if (!validatedEventTypes.includes(eventType)) {
					validatedEventTypes.push(eventType);
				}
			}
		}
	}

	// Ensure we have at least one event type
	if (validatedEventTypes.length === 0) {
		validatedEventTypes.push('conversation');
	}

	return {
		validatedEventTypes,
		milestoneDescriptions,
		correctedPairs,
		acceptedPairs,
	};
}

// ============================================
// Main Extraction Orchestrator
// ============================================

export async function extractState(
	context: STContext,
	messageId: number,
	previousState: TrackedState | null,
	abortSignal?: AbortSignal,
	options: ExtractionOptions = {},
): Promise<ExtractionResult> {
	const settings = getSettings();

	if (!settings.profileId) {
		throw new Error(
			'No connection profile selected. Please configure BlazeTracker in extension settings.',
		);
	}

	// Create and register abort controller
	const abortController = new AbortController();
	currentAbortController = abortController;

	// Link external abort signal if provided
	if (abortSignal) {
		abortSignal.addEventListener('abort', () => abortController.abort());
	}

	// Track active extractions for button state
	extractionCount++;
	if (extractionCount === 1) {
		setSendButtonState(true);
	}

	const rawResponses: Record<string, string> = {};

	try {
		const { lastXMessages } = settings;
		const isInitial = previousState === null;

		// Determine if this is an assistant message (for scene extraction)
		const currentMessage = context.chat[messageId];
		const isAssistantMessage = currentMessage?.is_user === false;
		const shouldRunScene =
			settings.trackScene !== false &&
			(options.forceSceneExtraction ||
				shouldExtractScene(messageId, isAssistantMessage));

		// Determine if event extraction should run
		const shouldRunEvent = settings.trackEvents !== false && isAssistantMessage;

		// Calculate planned steps for progress tracking
		const plannedSteps: GranularStep[] = [];

		if (settings.trackTime !== false) plannedSteps.push('time');
		if (settings.trackLocation !== false) plannedSteps.push('location');
		if (settings.trackClimate !== false) plannedSteps.push('climate');

		// Character extraction steps depend on whether using new extractors
		if (settings.trackCharacters !== false) {
			if (isInitial) {
				plannedSteps.push('char_legacy');
			} else {
				plannedSteps.push('char_presence');
				plannedSteps.push('char_parallel');
			}
		}

		// Location props (only for non-initial with location enabled)
		if (settings.trackLocation !== false && !isInitial) {
			plannedSteps.push('location_props');
		}

		// Relationship extraction (only for assistant messages with characters)
		if (settings.trackRelationships !== false && isAssistantMessage && !isInitial) {
			plannedSteps.push('rel_feelings');
			if (settings.includeRelationshipSecrets !== false) {
				plannedSteps.push('rel_secrets');
			}
			plannedSteps.push('rel_wants');
			// rel_status is conditional on refresh interval, add it tentatively
			plannedSteps.push('rel_status');
		}

		if (shouldRunScene) plannedSteps.push('scene');
		if (shouldRunEvent) {
			plannedSteps.push('event');
			plannedSteps.push('milestone_confirm'); // May be skipped if no milestones
		}

		// Chapter detection (conditional but add tentatively for assistant messages)
		if (isAssistantMessage && !isInitial) {
			plannedSteps.push('chapter');
		}

		// Set the planned steps for progress calculation
		setPlannedSteps(plannedSteps, isAssistantMessage);

		// ========================================
		// Get narrative state (needed for climate cache and relationships)
		// ========================================
		const narrativeState = getOrInitializeNarrativeState();

		// ========================================
		// Pre-fetch unified store and swipeId (needed for multiple steps)
		// ========================================
		const swipeId = currentMessage?.swipe_id ?? 0;
		const unifiedStore = getEventStore(narrativeState);

		// ========================================
		// Get previous projected state (source of truth for time/location/characters)
		// ========================================
		const prevProjected =
			!isInitial && isUnifiedEventStore(unifiedStore)
				? projectStateAtMessage(
						unifiedStore,
						messageId - 1,
						swipeId,
						context.chat,
					)
				: null;

		// ========================================
		// STEP 0: Initialize time tracker from previous state
		// ========================================
		const prevTime = prevProjected?.time ?? previousState?.time;
		if (prevTime) {
			setTimeTrackerState(prevTime);
		}

		// ========================================
		// Get message window for extraction
		// ========================================
		const { formattedMessages, characterInfo, userInfo } = prepareExtractionContext(
			context,
			messageId,
			lastXMessages,
			unifiedStore,
		);

		// ========================================
		// STEP 1: Extract Time (if enabled)
		// ========================================
		let narrativeTime: NarrativeDateTime | undefined;

		if (settings.trackTime !== false) {
			setGranularStep('time');
			const timeStart = performance.now();

			narrativeTime = await extractTime(
				!isInitial,
				formattedMessages,
				abortController.signal,
			);

			recordStepTiming('time', performance.now() - timeStart, isAssistantMessage);
			markStepCompleted('time');
		} else {
			// Use previous projection (preferred) or legacy state
			narrativeTime = prevProjected?.time ?? previousState?.time;
		}

		// ========================================
		// STEP 2: Extract Location (if enabled)
		// ========================================
		let location: LocationState | undefined;
		const prevLocation = prevProjected?.location ?? previousState?.location ?? null;

		if (settings.trackLocation !== false) {
			setGranularStep('location');
			const locationStart = performance.now();

			location = await extractLocation(
				isInitial,
				formattedMessages,
				isInitial ? characterInfo : '',
				prevLocation,
				abortController.signal,
			);

			recordStepTiming(
				'location',
				performance.now() - locationStart,
				isAssistantMessage,
			);
			markStepCompleted('location');
		} else {
			// Use previous projection (preferred) or legacy state
			location = prevLocation ?? undefined;
		}

		// ========================================
		// STEP 3: Extract Climate (if enabled)
		// ========================================
		let climate: Climate | ProceduralClimate | undefined;
		let weatherTransition: string | null = null;

		if (settings.trackClimate !== false) {
			setGranularStep('climate');
			const climateStart = performance.now();

			// Climate extraction needs time and location - use defaults if not available
			const timeForClimate = narrativeTime ?? getDefaultTime();
			const locationForClimate = location ?? getDefaultLocation();

			// Store previous forecast areas for new forecast detection
			const previousForecastAreas = new Set(
				narrativeState.forecastCache.map(f => f.areaName.toLowerCase()),
			);

			const climateResult = await extractClimateWithContext({
				isInitial,
				messages: formattedMessages,
				narrativeTime: timeForClimate,
				location: locationForClimate,
				characterInfo: isInitial ? characterInfo : '',
				previousClimate: previousState?.climate ?? null,
				forecastCache: narrativeState.forecastCache,
				locationMappings: narrativeState.locationMappings,
				abortSignal: abortController.signal,
				eventStore: isUnifiedEventStore(unifiedStore)
					? unifiedStore
					: undefined,
			});

			climate = climateResult.climate;
			weatherTransition = climateResult.transition;

			// Update narrative state caches if they changed
			if (climateResult.forecastCache) {
				narrativeState.forecastCache = climateResult.forecastCache;

				// Create ForecastGeneratedEvent for new forecasts (Phase 3)
				if (isUnifiedEventStore(unifiedStore)) {
					for (const entry of climateResult.forecastCache) {
						const areaLower = entry.areaName.toLowerCase();
						// Check if this is a new forecast (not in previous cache)
						if (!previousForecastAreas.has(areaLower)) {
							addForecastEvent(
								unifiedStore,
								entry.areaName,
								entry.forecast,
								messageId,
								swipeId,
							);
						}
					}
				}
			}
			if (climateResult.locationMappings) {
				narrativeState.locationMappings = climateResult.locationMappings;
			}

			recordStepTiming(
				'climate',
				performance.now() - climateStart,
				isAssistantMessage,
			);
			markStepCompleted('climate');
		} else {
			// Use previous or undefined
			climate = previousState?.climate;
		}

		// ========================================
		// STEP 4: Extract Characters (if enabled)
		// ========================================
		let characters: Character[] | undefined;

		const useNewExtractors =
			settings.trackCharacters !== false && isUnifiedEventStore(unifiedStore);

		if (settings.trackCharacters !== false) {
			// Characters extraction uses location - use default if not available
			const locationForCharacters = location ?? getDefaultLocation();

			if (useNewExtractors && isUnifiedEventStore(unifiedStore) && !isInitial) {
				// Use dedicated character extractors for event-based tracking (non-initial only)
				// Get previous character state from projection
				const prevProjected =
					messageId > 0
						? projectStateAtMessage(
								unifiedStore,
								messageId - 1,
								swipeId,
								context.chat,
							)
						: null;

				// Convert projected characters to Character[] for extractors
				const previousCharacters: Character[] = prevProjected
					? Array.from(prevProjected.characters.values()).map(pc => ({
							name: pc.name,
							position: pc.position,
							activity: pc.activity,
							mood: pc.mood,
							physicalState: pc.physicalState,
							outfit: pc.outfit,
						}))
					: [];

				const previousCharacterNames = previousCharacters.map(c => c.name);

				// Collect all character events from the 6 extractors
				const characterEvents: CharacterEvent[] = [];

				// Run extractors - some can run in parallel
				// Presence needs to run first to know who's present
				setGranularStep('char_presence');
				const presenceStart = performance.now();

				const presenceEvents = await extractCharacterPresence(
					formattedMessages,
					locationForCharacters,
					previousCharacterNames,
					messageId,
					swipeId,
					abortController.signal,
				);

				recordStepTiming(
					'char_presence',
					performance.now() - presenceStart,
					isAssistantMessage,
				);
				markStepCompleted('char_presence');
				characterEvents.push(...presenceEvents);

				// Extract initial outfits for characters that just appeared
				const appearedCharacters = presenceEvents
					.filter(e => e.subkind === 'appeared')
					.map(e => ({
						name: e.character,
						initialPosition: e.initialPosition,
						initialActivity: e.initialActivity,
					}));

				if (appearedCharacters.length > 0) {
					setGranularStep('char_initial_outfit');
					const initialOutfitStart = performance.now();

					const initialOutfitEvents = await extractInitialOutfit(
						formattedMessages,
						locationForCharacters,
						appearedCharacters,
						messageId,
						swipeId,
						abortController.signal,
					);

					recordStepTiming(
						'char_initial_outfit',
						performance.now() - initialOutfitStart,
						isAssistantMessage,
					);
					markStepCompleted('char_initial_outfit');
					characterEvents.push(...initialOutfitEvents);
				}

				// Now run the other extractors in parallel
				setGranularStep('char_parallel');
				const parallelStart = performance.now();

				const [
					positionEvents,
					activityEvents,
					moodEvents,
					outfitEvents,
					physicalEvents,
				] = await Promise.all([
					extractCharacterPosition(
						formattedMessages,
						locationForCharacters,
						previousCharacters,
						messageId,
						swipeId,
						abortController.signal,
					),
					extractCharacterActivity(
						formattedMessages,
						locationForCharacters,
						previousCharacters,
						messageId,
						swipeId,
						abortController.signal,
					),
					extractCharacterMood(
						formattedMessages,
						locationForCharacters,
						previousCharacters,
						messageId,
						swipeId,
						abortController.signal,
					),
					extractCharacterOutfit(
						formattedMessages,
						locationForCharacters,
						previousCharacters,
						messageId,
						swipeId,
						abortController.signal,
					),
					extractCharacterPhysical(
						formattedMessages,
						locationForCharacters,
						previousCharacters,
						messageId,
						swipeId,
						abortController.signal,
					),
				]);

				recordStepTiming(
					'char_parallel',
					performance.now() - parallelStart,
					isAssistantMessage,
				);
				markStepCompleted('char_parallel');

				characterEvents.push(
					...positionEvents,
					...activityEvents,
					...moodEvents,
					...outfitEvents,
					...physicalEvents,
				);

				// Store character events in the unified store
				if (characterEvents.length > 0) {
					replaceStateEventsForMessage(
						unifiedStore,
						messageId,
						swipeId,
						characterEvents,
						context.chat,
					);
				}

				// Project current characters from events
				const currentProjected = projectStateAtMessage(
					unifiedStore,
					messageId,
					swipeId,
					context.chat,
				);
				characters = Array.from(currentProjected.characters.values()).map(
					pc => ({
						name: pc.name,
						position: pc.position,
						activity: pc.activity,
						mood: pc.mood,
						physicalState: pc.physicalState,
						outfit: pc.outfit,
					}),
				);
			} else {
				// LEGACY: Use extractCharacters for initial extraction only
				// For subsequent messages in legacy stores, keep previous state
				if (isInitial) {
					setGranularStep('char_legacy');
					const legacyCharStart = performance.now();

					characters = await extractCharacters(
						formattedMessages,
						locationForCharacters,
						userInfo,
						characterInfo,
						abortController.signal,
					);

					recordStepTiming(
						'char_legacy',
						performance.now() - legacyCharStart,
						isAssistantMessage,
					);
					markStepCompleted('char_legacy');
				} else {
					// Legacy stores without event-based tracking: use projection if available
					const projectedChars = prevProjected
						? Array.from(prevProjected.characters.values()).map(
								pc => ({
									name: pc.name,
									position: pc.position,
									activity: pc.activity,
									mood: pc.mood,
									physicalState:
										pc.physicalState,
									outfit: pc.outfit,
								}),
							)
						: null;
					characters = projectedChars ?? previousState?.characters;
				}
			}

			// ========================================
			// STEP 4.5: Post-process outfits (only if we have location)
			// ========================================
			if (location && characters) {
				const cleanup = cleanupOutfitsAndMoveProps(characters, location);
				characters = cleanup.characters;
				location = cleanup.location;
			}

			// ========================================
			// STEP 4.6: Extract Location Props (event-based)
			// ========================================
			if (
				settings.trackLocation !== false &&
				location &&
				characters &&
				useNewExtractors &&
				isUnifiedEventStore(unifiedStore) &&
				!isInitial
			) {
				try {
					setGranularStep('location_props');
					const propsStart = performance.now();

					// Get previous props from projection (use already-computed prevProjected)
					const previousProps = prevProjected?.location?.props ?? [];

					// Get character outfits for context
					const characterOutfits = characters.map(c => ({
						name: c.name,
						outfit: c.outfit ?? {
							head: null,
							neck: null,
							jacket: null,
							back: null,
							torso: null,
							legs: null,
							underwear: null,
							socks: null,
							footwear: null,
						},
					}));

					// Extract prop changes
					const propEvents: LocationPropEvent[] =
						await extractLocationProps(
							formattedMessages,
							location,
							previousProps,
							characterOutfits,
							messageId,
							swipeId,
							abortController.signal,
						);

					recordStepTiming(
						'location_props',
						performance.now() - propsStart,
						isAssistantMessage,
					);
					markStepCompleted('location_props');

					// Store prop events in the unified store
					if (propEvents.length > 0) {
						// Soft-delete old prop events for this message
						for (const event of unifiedStore.stateEvents) {
							if (
								event.messageId === messageId &&
								event.swipeId === swipeId &&
								isLocationPropEvent(event) &&
								!event.deleted
							) {
								event.deleted = true;
							}
						}
						// Add new prop events
						for (const event of propEvents) {
							unifiedStore.stateEvents.push(event);
						}
						// Keep sorted
						unifiedStore.stateEvents.sort(
							(a, b) =>
								a.messageId - b.messageId ||
								a.timestamp - b.timestamp,
						);

						// Apply prop events to the current location state
						for (const event of propEvents) {
							if (event.subkind === 'prop_added') {
								if (!location.props)
									location.props = [];
								location.props.push(event.prop);
							} else if (
								event.subkind === 'prop_removed'
							) {
								if (location.props) {
									const idx =
										location.props.findIndex(
											p =>
												p.toLowerCase() ===
												event.prop.toLowerCase(),
										);
									if (idx >= 0) {
										location.props.splice(
											idx,
											1,
										);
									}
								}
							}
						}
					}
				} catch (e) {
					debugWarn('Failed to extract location props:', e);
				}
			}
		} else {
			// Use previous projection (preferred) or legacy state
			const projectedChars = prevProjected
				? Array.from(prevProjected.characters.values()).map(pc => ({
						name: pc.name,
						position: pc.position,
						activity: pc.activity,
						mood: pc.mood,
						physicalState: pc.physicalState,
						outfit: pc.outfit,
					}))
				: null;
			characters = projectedChars ?? previousState?.characters;
		}

		// ========================================
		// STEP 4.7: Extract Relationship Attitudes (event-based)
		// ========================================
		// Only extract for pairs where BOTH characters are currently in the scene
		// This avoids excessive extractions (e.g., 80 extractions for 20 pairs)
		if (
			settings.trackRelationships !== false &&
			useNewExtractors &&
			isUnifiedEventStore(unifiedStore) &&
			!isInitial &&
			characters &&
			characters.length >= 2
		) {
			try {
				const presentCharacterNames = new Set(
					characters.map(c => c.name.toLowerCase()),
				);

				// Get projected state to access relationships
				const currentProjected = projectStateAtMessage(
					unifiedStore,
					messageId,
					swipeId,
					context.chat,
				);

				// Find pairs where both characters are present in the scene
				const pairsInScene: Array<{
					key: string;
					relationship: typeof currentProjected.relationships extends Map<
						string,
						infer V
					>
						? V
						: never;
				}> = [];

				for (const [key, relationship] of currentProjected.relationships) {
					const [charA, charB] = relationship.pair;
					if (
						presentCharacterNames.has(charA.toLowerCase()) &&
						presentCharacterNames.has(charB.toLowerCase())
					) {
						pairsInScene.push({ key, relationship });
					}
				}

				// Also check for new pairs that might not have relationships yet
				const characterNames = characters.map(c => c.name);
				for (let i = 0; i < characterNames.length; i++) {
					for (let j = i + 1; j < characterNames.length; j++) {
						const sorted = sortPair(
							characterNames[i],
							characterNames[j],
						);
						// Use lowercase key for consistent lookups
						// (Map keys are normalized to lowercase in getOrCreateRelationship/pairKey)
						const key =
							`${sorted[0]}|${sorted[1]}`.toLowerCase();
						const existingIdx = pairsInScene.findIndex(
							p => p.key.toLowerCase() === key,
						);
						if (existingIdx === -1) {
							// Check if relationship exists in projected state
							const existing =
								currentProjected.relationships.get(
									key,
								);
							if (existing) {
								pairsInScene.push({
									key,
									relationship: existing,
								});
							} else {
								// Create a default relationship for new pairs
								// This allows the extractors to run and generate events
								const defaultRelationship: ProjectedRelationship =
									{
										pair: sorted,
										status: 'strangers',
										aToB: {
											feelings: [],
											secrets: [],
											wants: [],
										},
										bToA: {
											feelings: [],
											secrets: [],
											wants: [],
										},
									};
								pairsInScene.push({
									key,
									relationship:
										defaultRelationship,
								});
							}
						}
					}
				}

				if (pairsInScene.length > 0) {
					// Collect relationship events
					const relationshipEvents: RelationshipEvent[] = [];

					// Track timing for relationship extraction steps
					setGranularStep('rel_feelings');
					const relFeelingsStart = performance.now();

					// Process each pair
					for (const { relationship } of pairsInScene) {
						// Extract feelings, secrets, and wants in parallel
						// These use normal extraction context (since last event or lastX)
						const [feelingEvents, secretEvents, wantEvents] =
							await Promise.all([
								extractRelationshipFeelings(
									formattedMessages,
									relationship,
									messageId,
									swipeId,
									abortController.signal,
								),
								settings.includeRelationshipSecrets !==
								false
									? extractRelationshipSecrets(
											formattedMessages,
											relationship,
											messageId,
											swipeId,
											abortController.signal,
										)
									: Promise.resolve([]),
								extractRelationshipWants(
									formattedMessages,
									relationship,
									messageId,
									swipeId,
									abortController.signal,
								),
							]);

						relationshipEvents.push(
							...feelingEvents,
							...secretEvents,
							...wantEvents,
						);

						// Check if we should re-extract status
						// Find the last status change event for this pair
						const pairKey = `${relationship.pair[0]}|${relationship.pair[1]}`;
						let lastStatusMessageId = 0;
						for (const event of unifiedStore.stateEvents) {
							if (
								!event.deleted &&
								event.kind === 'relationship' &&
								event.subkind === 'status_changed'
							) {
								const statusEvent =
									event as StatusChangedEvent;
								const eventPairKey = `${statusEvent.pair[0]}|${statusEvent.pair[1]}`;
								if (
									eventPairKey === pairKey &&
									statusEvent.messageId >
										lastStatusMessageId
								) {
									lastStatusMessageId =
										statusEvent.messageId;
								}
							}
						}

						const messagesSinceLastStatus =
							messageId - lastStatusMessageId;
						const shouldExtractStatus =
							messagesSinceLastStatus >=
							settings.relationshipRefreshInterval;

						if (shouldExtractStatus) {
							// Status uses limited context (min(N, lastX) where N = relationshipRefreshInterval)
							const statusMessages =
								formatMessagesWithMinimum(
									context,
									messageId,
									Math.min(
										lastXMessages,
										settings.relationshipRefreshInterval,
									),
									unifiedStore,
								);

							// Get milestones for this pair from narrative state
							// Note: DerivedRelationship has milestoneEventIds, legacy Relationship has milestones
							const existingRelationship =
								narrativeState.relationships.find(
									r =>
										sortPair(
											r.pair[0],
											r.pair[1],
										).join('|') ===
										pairKey,
								);
							// Access milestones only if it's a legacy Relationship type
							const milestones =
								existingRelationship &&
								'milestones' in existingRelationship
									? existingRelationship.milestones
									: [];

							// Record feelings/secrets/wants timing before status
							// (only record once, on first status extraction)
							if (
								relationshipEvents.length > 0 &&
								!isStepCompleted('rel_feelings')
							) {
								recordStepTiming(
									'rel_feelings',
									performance.now() -
										relFeelingsStart,
									isAssistantMessage,
								);
								markStepCompleted('rel_feelings');
								if (
									settings.includeRelationshipSecrets !==
									false
								) {
									markStepCompleted(
										'rel_secrets',
									);
								}
								markStepCompleted('rel_wants');
							}

							setGranularStep('rel_status');
							const statusStart = performance.now();

							const statusEvents =
								await extractRelationshipStatus(
									statusMessages,
									relationship,
									milestones,
									messageId,
									swipeId,
									abortController.signal,
								);
							relationshipEvents.push(...statusEvents);

							recordStepTiming(
								'rel_status',
								performance.now() - statusStart,
								isAssistantMessage,
							);
							markStepCompleted('rel_status');
						}
					}

					// Record feelings timing if status was never extracted
					if (
						!isStepCompleted('rel_feelings') &&
						relationshipEvents.length > 0
					) {
						recordStepTiming(
							'rel_feelings',
							performance.now() - relFeelingsStart,
							isAssistantMessage,
						);
						markStepCompleted('rel_feelings');
						if (settings.includeRelationshipSecrets !== false) {
							markStepCompleted('rel_secrets');
						}
						markStepCompleted('rel_wants');
					}

					// Store relationship events in the unified store
					if (relationshipEvents.length > 0) {
						debugLog(
							`Storing ${relationshipEvents.length} relationship events for message ${messageId}:`,
							relationshipEvents.map(e => {
								if (
									e.subkind ===
									'status_changed'
								) {
									const se =
										e as StatusChangedEvent;
									return {
										subkind: se.subkind,
										pair: se.pair,
										newStatus: se.newStatus,
									};
								}
								const de =
									e as DirectionalRelationshipEvent;
								return {
									subkind: de.subkind,
									from: de.fromCharacter,
									toward: de.towardCharacter,
									value: de.value,
								};
							}),
						);
						// Soft-delete old relationship events for this message
						for (const event of unifiedStore.stateEvents) {
							if (
								event.messageId === messageId &&
								event.swipeId === swipeId &&
								event.kind === 'relationship' &&
								!event.deleted
							) {
								event.deleted = true;
							}
						}
						// Add new relationship events
						for (const event of relationshipEvents) {
							unifiedStore.stateEvents.push(event);
						}
						// Keep sorted
						unifiedStore.stateEvents.sort(
							(a, b) =>
								a.messageId - b.messageId ||
								a.timestamp - b.timestamp,
						);
						debugLog(
							`Total relationship events in store:`,
							unifiedStore.stateEvents.filter(
								e =>
									e.kind === 'relationship' &&
									!e.deleted,
							).length,
						);
					}
				}
			} catch (e) {
				debugWarn('Failed to extract relationship attitudes:', e);
			}
		}

		// ========================================
		// STEP 5: Extract Scene (conditional)
		// ========================================
		let scene: Scene | undefined;

		if (shouldRunScene) {
			setGranularStep('scene');
			const sceneStart = performance.now();

			// Scene needs at least 2 messages for tension analysis
			const sceneMessages = formatMessagesWithMinimum(
				context,
				messageId,
				lastXMessages,
				unifiedStore,
			);

			const isInitialScene = !previousState?.scene;

			// Use characters for context if available, otherwise empty
			const charactersForScene = characters ?? [];

			scene = await extractScene(
				isInitialScene,
				sceneMessages,
				charactersForScene,
				isInitialScene ? userInfo : '',
				isInitialScene ? characterInfo : '',
				previousState?.scene ?? null,
				abortController.signal,
			);

			recordStepTiming(
				'scene',
				performance.now() - sceneStart,
				isAssistantMessage,
			);
			markStepCompleted('scene');
		} else if (settings.trackScene !== false) {
			// Carry forward previous scene
			scene = previousState?.scene;
		}

		// ========================================
		// STEP 6: Extract Event (conditional)
		// ========================================
		// Get the event store for writing narrative events
		const eventStore = getEventStore(narrativeState);

		// Keep currentEvents for backward compatibility during transition
		let currentEvents: TimestampedEvent[] = (previousState?.currentEvents ?? []).filter(
			e => e.messageId !== messageId,
		);

		if (shouldRunEvent) {
			setGranularStep('event');
			const eventStart = performance.now();

			// Event extraction needs at least 2 messages (both sides of conversation)
			const eventMessages = formatMessagesWithMinimum(
				context,
				messageId,
				lastXMessages,
				unifiedStore,
			);

			// Use effective values for event extraction
			const timeForEvent = narrativeTime ?? getDefaultTime();
			const locationForEvent = location ?? getDefaultLocation();
			const sceneForEvent = scene ?? getDefaultScene();

			const extractionResult = await extractEvent({
				messages: eventMessages,
				messageId,
				currentTime: timeForEvent,
				currentLocation: locationForEvent,
				currentTensionType: sceneForEvent.tension.type,
				currentTensionLevel: sceneForEvent.tension.level,
				relationships: narrativeState.relationships as Relationship[],
				abortSignal: abortController.signal,
			});

			recordStepTiming(
				'event',
				performance.now() - eventStart,
				isAssistantMessage,
			);
			markStepCompleted('event');

			if (extractionResult) {
				const { event: extractedEvent, eventPairs } = extractionResult;

				// Validate milestone-triggering event types
				// Get present character names for milestone validation
				const presentCharacters =
					characters?.map(c => c.name) ?? extractedEvent.witnesses;

				setGranularStep('milestone_confirm');
				const milestoneStart = performance.now();

				const validationResult = await validateMilestoneCandidates(
					extractedEvent,
					eventPairs,
					eventMessages,
					presentCharacters,
					abortController.signal,
				);

				recordStepTiming(
					'milestone_confirm',
					performance.now() - milestoneStart,
					isAssistantMessage,
				);
				markStepCompleted('milestone_confirm');

				// Use validated event types
				const validatedEventTypes = validationResult.validatedEventTypes;

				// Build affected pairs from the extracted event
				const affectedPairs: AffectedPair[] =
					extractedEvent.relationshipSignal
						? [
								{
									pair: sortPair(
										extractedEvent
											.relationshipSignal
											.pair[0],
										extractedEvent
											.relationshipSignal
											.pair[1],
									),
									changes: extractedEvent
										.relationshipSignal
										.changes,
								},
							]
						: [];

				// Add pairs from accepted milestone validations
				// Use the pairs that were actually validated rather than looking up from eventPairs
				for (const [
					_milestoneType,
					acceptedPair,
				] of validationResult.acceptedPairs) {
					const sortedPair = sortPair(
						acceptedPair[0],
						acceptedPair[1],
					);
					const pairKeyStr = pairKey(sortedPair);
					const existingPair = affectedPairs.find(
						ap => pairKey(ap.pair) === pairKeyStr,
					);
					if (!existingPair) {
						affectedPairs.push({ pair: sortedPair });
					}
				}

				// Apply corrected pairs from milestone validation
				for (const [
					_eventType,
					correctedPair,
				] of validationResult.correctedPairs) {
					const sortedPair = sortPair(
						correctedPair[0],
						correctedPair[1],
					);
					const pairKeyStr = pairKey(sortedPair);
					const existingPair = affectedPairs.find(
						ap => pairKey(ap.pair) === pairKeyStr,
					);
					if (!existingPair) {
						affectedPairs.push({ pair: sortedPair });
					}
				}

				// Add milestone descriptions to affected pairs
				// Each pair looks up its own description using the composite key
				for (const ap of affectedPairs) {
					const pairMilestones: Record<string, string> = {};
					for (const eventType of validatedEventTypes) {
						const milestoneType =
							EVENT_TYPE_TO_MILESTONE[eventType];
						if (milestoneType) {
							// Look up by composite key (milestoneType + pair)
							const key = milestoneDescKey(
								milestoneType,
								ap.pair,
							);
							const description =
								validationResult.milestoneDescriptions.get(
									key,
								);
							if (description) {
								pairMilestones[milestoneType] =
									description;
							}
						}
					}
					if (Object.keys(pairMilestones).length > 0) {
						ap.milestoneDescriptions = pairMilestones;
					}
				}

				// Create NarrativeEvent for the event store
				const narrativeEvent: Omit<NarrativeEvent, 'id'> = {
					messageId,
					swipeId,
					timestamp: Date.now(),
					summary: extractedEvent.summary,
					eventTypes: validatedEventTypes,
					tensionLevel: extractedEvent.tensionLevel,
					tensionType: extractedEvent.tensionType,
					witnesses: extractedEvent.witnesses,
					location: extractedEvent.location,
					narrativeTimestamp: extractedEvent.timestamp,
					affectedPairs,
				};

				// Write to event store (replaces any existing events for this message+swipe)
				const _newEventIds = replaceEventsForMessage(
					eventStore,
					messageId,
					swipeId,
					[narrativeEvent],
				);

				// Recompute firstFor designations for affected pairs
				if (affectedPairs.length > 0) {
					const pairKeys = new Set(
						affectedPairs.map(ap => pairKey(ap.pair)),
					);
					recomputeFirstFor(eventStore, messageId, pairKeys);

					// Re-project relationships to pick up new milestones
					narrativeState.relationships =
						reProjectRelationshipsFromEvents(eventStore);
				}

				// Also keep in currentEvents for backward compatibility
				const eventWithId: TimestampedEvent = {
					...extractedEvent,
					eventTypes: validatedEventTypes, // Use validated event types
					messageId,
				};
				currentEvents = [...currentEvents, eventWithId];

				// Apply relationship signal if present
				if (
					extractedEvent.relationshipSignal &&
					settings.trackRelationships !== false
				) {
					const signal = extractedEvent.relationshipSignal;
					const [char1, char2] = signal.pair;

					let relationship = getRelationship(
						narrativeState,
						char1,
						char2,
					) as Relationship | null;

					if (relationship) {
						// Pop version if re-extracting this message (swipe/re-extract)
						popVersionForMessage(relationship, messageId);
						// Note: In v3, milestones are computed from event store
						// We still do a simple update for relationship feelings
						relationship = updateRelationshipFromSignal(
							relationship,
							signal,
							messageId,
						);

						updateRelationship(narrativeState, relationship);
					} else {
						// Need to initialize this relationship first
						const relationshipMessages =
							formatMessagesForRelationship(
								context,
								messageId,
								lastXMessages,
								undefined, // No existing relationship
							);

						const newRelationship =
							await extractInitialRelationship({
								char1,
								char2,
								messages: relationshipMessages,
								characterInfo: isInitial
									? characterInfo
									: '',
								messageId,
								currentTime: narrativeTime,
								currentLocation: location,
								abortSignal: abortController.signal,
							});

						if (newRelationship) {
							// Apply the signal to the new relationship
							const withSignal =
								updateRelationshipFromSignal(
									newRelationship,
									signal,
									messageId,
								);
							updateRelationship(
								narrativeState,
								withSignal,
							);
						}
					}
				}
			}
		}

		// ========================================
		// STEP 6.3: Initialize Missing Relationships
		// ========================================
		// Check if there are character pairs that don't have relationships yet
		if (settings.trackRelationships !== false && characters && characters.length >= 2) {
			const characterNames = characters.map(c => c.name);
			const unestablishedPairs = findUnestablishedPairs(
				characterNames,
				narrativeState.relationships,
			);

			// Limit to initializing one relationship per extraction to avoid slowdown
			if (unestablishedPairs.length > 0) {
				const [char1, char2] = unestablishedPairs[0];

				const relationshipMessages = formatMessagesForRelationship(
					context,
					messageId,
					lastXMessages,
					undefined, // No existing relationship
				);

				const newRelationship = await extractInitialRelationship({
					char1,
					char2,
					messages: relationshipMessages,
					characterInfo: isInitial ? characterInfo : '',
					messageId,
					currentTime: narrativeTime,
					currentLocation: location,
					abortSignal: abortController.signal,
				});

				if (newRelationship) {
					updateRelationship(narrativeState, newRelationship);

					// Add new relationship to initial projection so it's available
					// for subsequent projectStateAtMessage() calls
					if (isUnifiedEventStore(unifiedStore)) {
						const existingInitial =
							getInitialProjection(unifiedStore);
						if (existingInitial) {
							const sorted = sortPair(char1, char2);
							// Use lowercase key for consistent lookups
							const key =
								`${sorted[0]}|${sorted[1]}`.toLowerCase();
							existingInitial.relationships.set(key, {
								pair: sorted,
								status: newRelationship.status,
								aToB: {
									feelings: [
										...newRelationship
											.aToB
											.feelings,
									],
									secrets: [
										...newRelationship
											.aToB
											.secrets,
									],
									wants: [
										...newRelationship
											.aToB.wants,
									],
								},
								bToA: {
									feelings: [
										...newRelationship
											.bToA
											.feelings,
									],
									secrets: [
										...newRelationship
											.bToA
											.secrets,
									],
									wants: [
										...newRelationship
											.bToA.wants,
									],
								},
							});
							// Re-save with updated relationships
							setInitialProjection(
								unifiedStore,
								existingInitial,
							);
						}
					}
				}
			}
		}

		// ========================================
		// STEP 6.5: Check Chapter Boundary
		// ========================================
		let currentChapter = previousState?.currentChapter ?? 0;
		let chapterEnded: TrackedState['chapterEnded'] = undefined;

		// Get current chapter events from event store
		const currentChapterStoreEvents = getCurrentChapterEvents(eventStore);
		const currentChapterEventIds = getCurrentChapterEventIds(eventStore);

		// Get previous location/time from projection (preferred) or legacy state
		const prevLocationForChapter = prevProjected?.location ?? previousState?.location;
		const prevTimeForChapter = prevProjected?.time ?? previousState?.time;

		// Only check for chapter boundary if we have previous state (not initial extraction)
		// and there are events in the current chapter
		if (
			(prevProjected || previousState) &&
			(currentEvents.length > 0 || currentChapterStoreEvents.length > 0)
		) {
			const boundaryCheck = checkChapterBoundary(
				prevLocationForChapter,
				location,
				prevTimeForChapter,
				narrativeTime,
			);

			if (boundaryCheck.triggered) {
				setGranularStep('chapter');
				const chapterStart = performance.now();

				// Get the time range from events
				const startTime =
					currentChapterStoreEvents[0]?.narrativeTimestamp ??
					currentEvents[0]?.timestamp ??
					prevTimeForChapter ??
					getDefaultTime();
				const endTime = narrativeTime ?? getDefaultTime();
				const primaryLocation = prevLocationForChapter
					? `${prevLocationForChapter.area} - ${prevLocationForChapter.place}`
					: 'Unknown';

				// Extract chapter summary via LLM
				const chapterResult = await extractChapterBoundary({
					events: currentEvents,
					narrativeState,
					chapterIndex: currentChapter,
					startTime,
					endTime,
					primaryLocation,
					abortSignal: abortController.signal,
				});

				recordStepTiming(
					'chapter',
					performance.now() - chapterStart,
					isAssistantMessage,
				);
				markStepCompleted('chapter');

				if (chapterResult.isChapterBoundary && chapterResult.chapter) {
					// Store chapter ended summary for display
					const eventCount = Math.max(
						currentEvents.length,
						currentChapterStoreEvents.length,
					);
					chapterEnded = {
						index: currentChapter,
						title: chapterResult.chapter.title,
						summary: chapterResult.chapter.summary,
						eventCount,
						reason: boundaryCheck.reason!,
					};

					// Assign events to the closed chapter in the event store
					assignEventsToChapter(
						eventStore,
						currentChapterEventIds,
						currentChapter,
					);

					// Create a DerivedChapter with eventIds
					const derivedChapter: DerivedChapter = {
						index: currentChapter,
						title: chapterResult.chapter.title,
						summary: chapterResult.chapter.summary,
						outcomes: chapterResult.chapter.outcomes,
						eventIds: currentChapterEventIds,
						boundaryMessageId: messageId,
						timeRange: chapterResult.chapter.timeRange,
						primaryLocation:
							chapterResult.chapter.primaryLocation,
					};

					// Add chapter to narrative state
					addChapter(narrativeState, derivedChapter);

					// Save chapter snapshot for projection performance (Phase 6)
					if (isUnifiedEventStore(eventStore)) {
						const projection = projectStateAtMessage(
							eventStore,
							messageId,
							swipeId,
							context.chat,
						);
						saveChapterSnapshot(
							eventStore,
							currentChapter,
							messageId,
							swipeId,
							projection,
						);
					}

					await saveNarrativeState(narrativeState);

					// Increment chapter counter and clear current events
					currentChapter++;
					currentEvents = [];
				}
			}
		}

		// ========================================
		// STEP 7: Assemble Final State
		// ========================================
		setGranularStep('complete');

		const state: TrackedState = {
			time: narrativeTime,
			location,
			climate,
			scene,
			characters,
			currentChapter,
			currentEvents: currentEvents.length > 0 ? currentEvents : undefined,
			chapterEnded,
		};

		// ========================================
		// STEP 8: Generate State Events (Phase 2)
		// ========================================
		// Generate state events for time/location changes
		// Note: Character events are now handled by the new extractors in STEP 4
		if (isUnifiedEventStore(unifiedStore)) {
			try {
				// For initial extraction, save as initial projection instead of generating events
				if (isInitial && !getInitialProjection(unifiedStore)) {
					// Build relationships map from narrativeState.relationships
					// (which were populated in STEP 6.3)
					const relationshipsMap = new Map<
						string,
						ProjectedRelationship
					>();
					for (const rel of narrativeState.relationships) {
						const key = `${rel.pair[0]}|${rel.pair[1]}`;
						relationshipsMap.set(key, {
							pair: rel.pair,
							status: rel.status,
							aToB: {
								feelings: [...rel.aToB.feelings],
								secrets: [...rel.aToB.secrets],
								wants: [...rel.aToB.wants],
							},
							bToA: {
								feelings: [...rel.bToA.feelings],
								secrets: [...rel.bToA.secrets],
								wants: [...rel.bToA.wants],
							},
						});
					}

					const initialState = {
						time: narrativeTime ?? null,
						location: location ?? null,
						characters: new Map(
							(characters ?? []).map(char => [
								char.name,
								{
									name: char.name,
									position:
										char.position ??
										'unknown',
									activity:
										char.activity ??
										'idle',
									mood: char.mood ?? [],
									physicalState:
										char.physicalState ??
										[],
									outfit: char.outfit,
								},
							]),
						),
						relationships: relationshipsMap,
					};
					setInitialProjection(unifiedStore, initialState);
					await saveNarrativeState(narrativeState);
				} else {
					// Get previous projected state
					const prevProjected =
						messageId > 0
							? projectStateAtMessage(
									unifiedStore,
									messageId - 1,
									swipeId,
									context.chat,
								)
							: null;

					// Build current state for diffing - only time/location if new extractors used
					const currForDiff = {
						time: narrativeTime ?? null,
						location: location ?? null,
						// Only include characters if NOT using new extractors (to avoid duplicates)
						characters: useNewExtractors
							? undefined
							: characters?.map(char => ({
									name: char.name,
									position: char.position,
									activity: char.activity,
									mood: char.mood,
									physicalState:
										char.physicalState,
									outfit: char.outfit,
								})),
					};

					// Generate state events from diff
					const stateEvents = generateStateEventsFromDiff(
						messageId,
						swipeId,
						prevProjected,
						currForDiff,
					);

					// Replace state events for this message (handles re-extraction)
					// Only add non-character events if we used new extractors
					const eventsToStore = useNewExtractors
						? stateEvents.filter(e => e.kind !== 'character')
						: stateEvents;

					if (eventsToStore.length > 0) {
						// First soft-delete old non-character events for this message
						for (const event of unifiedStore.stateEvents) {
							if (
								event.messageId === messageId &&
								event.swipeId === swipeId &&
								!event.deleted
							) {
								// If using new extractors, only delete time/location-moved events
								// Character events are managed by STEP 4
								// Location prop events are managed by STEP 4.2
								// Relationship events are managed by STEP 4.3
								if (
									!useNewExtractors ||
									(event.kind !==
										'character' &&
										!isLocationPropEvent(
											event,
										) &&
										event.kind !==
											'relationship')
								) {
									event.deleted = true;
								}
							}
						}
						// Then add new events
						for (const event of eventsToStore) {
							unifiedStore.stateEvents.push(event);
						}
						// Keep sorted
						unifiedStore.stateEvents.sort(
							(a, b) =>
								a.messageId - b.messageId ||
								a.timestamp - b.timestamp,
						);
					}

					// Save narrative state with new state events
					await saveNarrativeState(narrativeState);
				}
			} catch (e) {
				debugWarn('Failed to generate state events:', e);
			}
		}

		return {
			state,
			raw: rawResponses,
			weatherTransition: weatherTransition ?? undefined,
		};
	} finally {
		extractionCount--;
		if (extractionCount === 0) {
			setSendButtonState(false);
			setGranularStep('idle');
		}
		if (currentAbortController === abortController) {
			currentAbortController = null;
		}
	}
}

// ============================================
// Re-extraction Event Cleanup
// ============================================

/**
 * Update subsequent messages after re-extracting a message.
 * Removes old events from the re-extracted messageId and optionally adds the new event.
 */
export function updateSubsequentMessagesEvents(
	context: STContext,
	reExtractedMessageId: number,
	newEvent: TimestampedEvent | undefined,
): void {
	// Iterate through all messages after the re-extracted one
	for (let i = reExtractedMessageId + 1; i < context.chat.length; i++) {
		const message = context.chat[i];
		const stateData = getMessageState(message);

		if (!stateData?.state?.currentEvents) {
			continue;
		}

		// Filter out events from the re-extracted messageId
		const filteredEvents = stateData.state.currentEvents.filter(
			(e: TimestampedEvent) => e.messageId !== reExtractedMessageId,
		);

		// If we have a new event and it should be included (before any chapter boundary that cleared events)
		// Add it to the filtered list if this message's events include events after the new one
		let updatedEvents = filteredEvents;
		if (newEvent) {
			// Insert the new event at the right position (by messageId order)
			const insertIndex = filteredEvents.findIndex(
				(e: TimestampedEvent) => (e.messageId ?? 0) > reExtractedMessageId,
			);
			if (insertIndex === -1) {
				// No events after this one, append
				updatedEvents = [...filteredEvents, newEvent];
			} else {
				// Insert before events from later messages
				updatedEvents = [
					...filteredEvents.slice(0, insertIndex),
					newEvent,
					...filteredEvents.slice(insertIndex),
				];
			}
		}

		// Update the message state
		const newStateData = {
			...stateData,
			state: {
				...stateData.state,
				currentEvents: updatedEvents.length > 0 ? updatedEvents : undefined,
			},
		};

		setMessageState(message, newStateData);
	}
}

// ============================================
// Helper Functions
// ============================================

interface ExtractionContext {
	formattedMessages: string;
	characterInfo: string;
	userInfo: string;
}

/**
 * Format messages with a minimum of 2 messages guaranteed.
 * Used for scene extraction, event extraction, and milestone validation
 * which all need both sides of the conversation for proper analysis.
 */
function formatMessagesWithMinimum(
	context: STContext,
	messageId: number,
	lastXMessages: number,
	eventStore: ReturnType<typeof getEventStore> | null,
): string {
	const MIN_MESSAGES = 2;

	// Find where last event was stored BEFORE current message
	// (prefer event store over legacy state lookup)
	let eventIdx = -1;
	if (eventStore && isUnifiedEventStore(eventStore)) {
		const lastEventMessageId = getLastMessageWithEvents(eventStore, messageId);
		if (lastEventMessageId >= 0) {
			eventIdx = lastEventMessageId;
		}
	}

	// Calculate start: we want at least MIN_MESSAGES, but also respect lastXMessages
	// and include all messages since last event
	const minStart = Math.max(0, messageId - MIN_MESSAGES + 1);
	const eventStart = eventIdx >= 0 ? eventIdx + 1 : 0;
	const limitStart = messageId - lastXMessages;

	// Take the earliest of: minimum messages needed, or messages since event
	// But don't go earlier than lastXMessages limit
	const effectiveStart = Math.max(limitStart, Math.min(minStart, eventStart));

	const chatMessages = context.chat.slice(effectiveStart, messageId + 1);

	return chatMessages.map(msg => `${msg.name}: ${msg.mes}`).join('\n\n');
}

function prepareExtractionContext(
	context: STContext,
	messageId: number,
	lastXMessages: number,
	eventStore: ReturnType<typeof getEventStore> | null,
): ExtractionContext {
	// Find where to start reading messages (from last message with events BEFORE current)
	let startIdx = 0;
	if (eventStore && isUnifiedEventStore(eventStore)) {
		const lastEventMessageId = getLastMessageWithEvents(eventStore, messageId);
		if (lastEventMessageId >= 0) {
			startIdx = lastEventMessageId + 1; // Start from message AFTER the one with events
		}
	}

	// Get only new messages (but respect lastXMessages limit)
	const effectiveStart = Math.max(startIdx, messageId - lastXMessages);
	const chatMessages = context.chat.slice(effectiveStart, messageId + 1);

	// Format messages for prompts
	const formattedMessages = chatMessages.map(msg => `${msg.name}: ${msg.mes}`).join('\n\n');

	// Get user persona info
	const userPersona = context.powerUserSettings?.persona_description || '';
	const userInfo = userPersona
		? `Name: ${context.name1}\nDescription: ${userPersona
				.replace(/\{\{user\}\}/gi, context.name1)
				.replace(/\{\{char\}\}/gi, context.name2)}`
		: `Name: ${context.name1}`;

	// Get character info
	const character = context.characters?.[context.characterId];
	const charDescription = (character?.description || 'No description')
		.replace(/\{\{char\}\}/gi, context.name2)
		.replace(/\{\{user\}\}/gi, context.name1);
	const characterInfo = `Name: ${context.name2}\nDescription: ${charDescription}`;

	return { formattedMessages, characterInfo, userInfo };
}

/**
 * Format messages for relationship extraction.
 * Uses messages since the last status change (or lastXMessages, whichever is smaller).
 * Ensures a minimum of MIN_RELATIONSHIP_MESSAGES for context.
 */
function formatMessagesForRelationship(
	context: STContext,
	messageId: number,
	lastXMessages: number,
	relationship?: Relationship,
): string {
	const MIN_RELATIONSHIP_MESSAGES = 3;

	// Calculate the start based on last version's messageId
	let statusChangeStart = 0;
	const lastVersionMessageId = relationship
		? getLatestVersionMessageId(relationship)
		: undefined;
	if (lastVersionMessageId !== undefined) {
		// Start from the message after the last status change
		statusChangeStart = lastVersionMessageId + 1;
	}

	// Calculate start: take minimum of (messages since status change, lastXMessages)
	// But ensure we have at least MIN_RELATIONSHIP_MESSAGES
	const minStart = Math.max(0, messageId - MIN_RELATIONSHIP_MESSAGES + 1);
	const limitStart = Math.max(0, messageId - lastXMessages);

	// Take the later of: limit start or status change start
	// This ensures we don't exceed lastXMessages
	const constrainedStart = Math.max(limitStart, statusChangeStart);

	// But ensure we have at least MIN_RELATIONSHIP_MESSAGES
	const effectiveStart = Math.min(constrainedStart, minStart);

	const chatMessages = context.chat.slice(effectiveStart, messageId + 1);
	return chatMessages.map(msg => `${msg.name}: ${msg.mes}`).join('\n\n');
}

// ============================================
// Outfit Cleanup Post-Processing
// ============================================

/**
 * Regex patterns that indicate an item has been removed.
 * Captures the item name in group 1.
 */
const REMOVED_PATTERNS = [
	/^(.+?)\s*\((?:removed|off|taken off|discarded|dropped|on (?:the )?floor|on (?:the )?ground|cast aside|tossed aside)\)$/i,
	/^(.+?)\s*-\s*(?:removed|off|taken off)$/i,
	/^(?:removed|off|none|nothing|bare|naked)$/i,
];

/**
 * Values that should be treated as null (no item).
 */
const NULL_VALUES = new Set(['none', 'nothing', 'bare', 'naked', 'n/a', 'na', '-', '']);

interface OutfitCleanupResult {
	characters: Character[];
	location: LocationState;
	movedItems: string[];
}

/**
 * Post-process characters to fix outfit items that the LLM marked as removed
 * but didn't set to null. Moves removed items to location props if not already there.
 */
function cleanupOutfitsAndMoveProps(
	characters: Character[],
	location: LocationState,
): OutfitCleanupResult {
	const movedItems: string[] = [];
	const existingProps = new Set((location.props || []).map(p => p.toLowerCase()));

	const processedCharacters = characters.map(char => {
		if (!char.outfit) return char;

		const newOutfit = { ...char.outfit };
		const outfitSlots = [
			'head',
			'neck',
			'jacket',
			'back',
			'torso',
			'legs',
			'underwear',
			'socks',
			'footwear',
		] as const;

		for (const slot of outfitSlots) {
			const value = newOutfit[slot];
			if (value === null || value === undefined) continue;

			const trimmed = value.trim();

			// Check for explicit null values
			if (NULL_VALUES.has(trimmed.toLowerCase())) {
				newOutfit[slot] = null;
				continue;
			}

			// Check for removal patterns
			for (const pattern of REMOVED_PATTERNS) {
				const match = trimmed.match(pattern);
				if (match) {
					// Extract the item name (group 1, or the whole thing if no group)
					const itemName = match[1]?.trim() || trimmed;

					// Set to null
					newOutfit[slot] = null;

					// Add to props if we have a real item name and it's not already there
					if (itemName && !NULL_VALUES.has(itemName.toLowerCase())) {
						if (
							!propAlreadyExists(
								itemName,
								char.name,
								existingProps,
							)
						) {
							const propEntry = `${char.name}'s ${itemName}`;
							movedItems.push(propEntry);
							existingProps.add(propEntry.toLowerCase());
						}
					}
					break;
				}
			}
		}

		return { ...char, outfit: newOutfit };
	});

	// Build new props array if we added items
	const newProps =
		movedItems.length > 0 ? [...(location.props || []), ...movedItems] : location.props;

	return {
		characters: processedCharacters,
		location: { ...location, props: newProps },
		movedItems,
	};
}
