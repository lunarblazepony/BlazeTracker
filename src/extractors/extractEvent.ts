// ============================================
// Event Extractor
// ============================================

import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, asString, asStringArray, isObject } from '../utils/json';
import type {
	TimestampedEvent,
	NarrativeDateTime,
	TensionType,
	TensionLevel,
	RelationshipSignal,
	DirectionalChange,
	LocationState,
	Relationship,
	EventType,
	AffectedPair,
} from '../types/state';
import { EVENT_TYPES } from '../types/state';
import { sortPair } from '../state/relationships';
import { debugWarn } from '../utils/debug';

// ============================================
// Schema & Example
// ============================================

export const EVENT_SCHEMA = {
	type: 'object',
	description: 'A significant event extracted from the messages',
	additionalProperties: false,
	properties: {
		summary: {
			type: 'string',
			description:
				'Detailed 2-sentence summary capturing what happened, who was involved, and the emotional context',
		},
		eventTypes: {
			type: 'array',
			items: { type: 'string', enum: [...EVENT_TYPES] },
			description: 'All applicable event type flags (can select multiple)',
		},
		eventPairs: {
			type: 'object',
			description:
				'REQUIRED: Maps each event type to the pair(s) of characters involved. Value is either [char1, char2] for single pair, or [[char1, char2], [char3, char4]] for multiple pairs.',
			additionalProperties: {
				oneOf: [
					{
						type: 'array',
						items: { type: 'string' },
						minItems: 2,
						maxItems: 2,
						description: 'Single pair: [char1, char2]',
					},
					{
						type: 'array',
						items: {
							type: 'array',
							items: { type: 'string' },
							minItems: 2,
							maxItems: 2,
						},
						description:
							'Multiple pairs: [[char1, char2], [char3, char4]]',
					},
				],
			},
		},
		eventDetails: {
			type: 'object',
			description:
				'Brief clarifying details for event types that need context. Key is the event type, value is a short phrase explaining what specifically happened.',
			additionalProperties: { type: 'string' },
		},
		witnesses: {
			type: 'array',
			description: 'Characters who witnessed or participated in this event',
			items: { type: 'string' },
		},
		relationshipSignals: {
			type: 'array',
			description:
				'Optional signals if events affect relationships. One entry per affected pair.',
			items: {
				type: 'object',
				properties: {
					pair: {
						type: 'array',
						items: { type: 'string' },
						minItems: 2,
						maxItems: 2,
						description: 'The two characters involved',
					},
					changes: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								from: {
									type: 'string',
									description:
										'Character whose attitude is changing',
								},
								toward: {
									type: 'string',
									description:
										'Character they feel differently about',
								},
								feeling: {
									type: 'string',
									description:
										'New or changed feeling',
								},
							},
							required: ['from', 'toward', 'feeling'],
						},
					},
				},
			},
		},
	},
	required: ['summary', 'eventTypes', 'eventPairs', 'witnesses'],
};

// Multiple examples showing different scenarios
const EVENT_EXAMPLES = [
	// Example 1: Single pair, emotional moment
	{
		summary: "After hours of tense silence, Elena finally broke down and confessed her past as a thief to Marcus, her voice trembling as she revealed the crimes she'd committed before they met. Marcus listened without interrupting, his expression unreadable, before finally reaching across the table to take her hand.",
		eventTypes: ['secret_shared', 'emotional', 'confession'],
		eventPairs: {
			secret_shared: ['Elena', 'Marcus'],
			emotional: ['Elena', 'Marcus'],
			confession: ['Elena', 'Marcus'],
		},
		eventDetails: {
			secret_shared: "Elena's past as a thief and the crimes she committed",
			emotional: 'Elena broke down crying while revealing her past',
			confession: 'Elena admitted her criminal history to Marcus',
		},
		witnesses: ['Elena', 'Marcus'],
		relationshipSignals: [
			{
				pair: ['Elena', 'Marcus'],
				changes: [
					{ from: 'Elena', toward: 'Marcus', feeling: 'vulnerable' },
					{ from: 'Marcus', toward: 'Elena', feeling: 'protective' },
				],
			},
		],
	},
	// Example 2: Combat with multiple enemies (same event type, different pairs)
	{
		summary: "The ambush came from both sides - Jake barely dodged Viper's knife before spinning to block Razor's bat. He managed to disarm Viper with a swift kick, then turned his fury on Razor, slamming him against the alley wall.",
		eventTypes: ['combat', 'danger'],
		eventPairs: {
			combat: [
				['Jake', 'Viper'],
				['Jake', 'Razor'],
			],
			danger: ['Jake', 'Viper'],
		},
		eventDetails: {
			combat: 'Jake fought off both Viper and Razor in the alley ambush',
			danger: 'Jake was ambushed by two armed attackers',
		},
		witnesses: ['Jake', 'Viper', 'Razor'],
		relationshipSignals: [
			{
				pair: ['Jake', 'Viper'],
				changes: [{ from: 'Viper', toward: 'Jake', feeling: 'vengeful' }],
			},
			{
				pair: ['Jake', 'Razor'],
				changes: [{ from: 'Razor', toward: 'Jake', feeling: 'fearful' }],
			},
		],
	},
	// Example 3: Mixed - combat AND emotional support from different people
	{
		summary: 'After Sarah dispatched the last of the guards, she found Alex trembling in the corner. She knelt beside him, pulling him into a fierce embrace while promising they would make it out together.',
		eventTypes: ['combat', 'emotional', 'supportive', 'intimate_embrace'],
		eventPairs: {
			combat: ['Sarah', 'Guard'],
			emotional: ['Sarah', 'Alex'],
			supportive: ['Sarah', 'Alex'],
			intimate_embrace: ['Sarah', 'Alex'],
		},
		eventDetails: {
			combat: 'Sarah fought and defeated the guards',
			emotional: 'Alex was traumatized and trembling',
			supportive: 'Sarah comforted and reassured Alex',
			intimate_embrace: 'Sarah pulled Alex into a protective embrace',
		},
		witnesses: ['Sarah', 'Alex', 'Guard'],
		relationshipSignals: [
			{
				pair: ['Sarah', 'Alex'],
				changes: [
					{ from: 'Alex', toward: 'Sarah', feeling: 'grateful' },
					{ from: 'Sarah', toward: 'Alex', feeling: 'protective' },
				],
			},
		],
	},
];

const EVENT_EXAMPLE = JSON.stringify(EVENT_EXAMPLES[0], null, 2);

// ============================================
// Public API
// ============================================

export interface ExtractEventParams {
	messages: string;
	messageId: number;
	currentTime: NarrativeDateTime;
	currentLocation: LocationState;
	currentTensionType: TensionType;
	currentTensionLevel: TensionLevel;
	relationships: Relationship[];
	abortSignal?: AbortSignal;
}

/** A pair can be a single [char1, char2] or multiple [[char1, char2], [char3, char4]] */
export type EventPairValue = [string, string] | [string, string][];

export interface ExtractedEventData {
	summary: string;
	eventTypes: EventType[];
	eventPairs: Record<string, EventPairValue>;
	eventDetails?: Record<string, string>;
	witnesses: string[];
	relationshipSignals?: RelationshipSignal[];
}

/**
 * Extended event extraction result including eventPairs for milestone validation.
 */
export interface ExtractedEventResult {
	event: TimestampedEvent;
	eventPairs: Record<string, EventPairValue>;
}

/**
 * Extract a significant event from the recent messages.
 * Returns null if no significant event occurred.
 *
 * Note: In v3 (event-sourced architecture), milestones are computed by the event store
 * based on event types, not created inline during extraction.
 */
export async function extractEvent(
	params: ExtractEventParams,
): Promise<ExtractedEventResult | null> {
	const settings = getSettings();

	if (!settings.trackEvents) {
		return null;
	}

	// Format relationships for context
	const relationshipsContext = formatRelationshipsForPrompt(params.relationships);

	const schemaStr = JSON.stringify(EVENT_SCHEMA, null, 2);
	const locationStr = `${params.currentLocation.area} - ${params.currentLocation.place}`;

	const promptParts = getPromptParts('event_extract');
	const userPrompt = promptParts.user
		.replace('{{messages}}', params.messages)
		.replace('{{currentRelationships}}', relationshipsContext)
		.replace('{{schema}}', schemaStr)
		.replace('{{schemaExample}}', EVENT_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	try {
		const response = await makeGeneratorRequest(llmMessages, {
			profileId: settings.profileId,
			maxTokens: settings.maxResponseTokens,
			temperature: getTemperature('event_extract'),
			abortSignal: params.abortSignal,
		});

		const parsed = parseJsonResponse(response, {
			shape: 'object',
			moduleName: 'BlazeTracker/Event',
		});

		const eventData = validateEventData(parsed, params.relationships);

		// If the summary indicates no significant event, return null
		if (!eventData || isNoEventResponse(eventData.summary)) {
			return null;
		}

		// Convert relationship signals to simple format (no milestones)
		// Milestones will be computed by the event store based on event types
		let relationshipSignal: RelationshipSignal | undefined;

		if (eventData.relationshipSignals && eventData.relationshipSignals.length > 0) {
			// Use the first signal as the primary relationship signal for the event
			// Note: We no longer create milestones here - they're computed by eventStore
			relationshipSignal = eventData.relationshipSignals[0];
		}

		// Create the timestamped event using scene's tension values
		const event: TimestampedEvent = {
			timestamp: params.currentTime,
			summary: eventData.summary,
			eventTypes: eventData.eventTypes,
			tensionType: params.currentTensionType,
			tensionLevel: params.currentTensionLevel,
			witnesses: eventData.witnesses,
			location: locationStr,
			relationshipSignal,
		};

		return {
			event,
			eventPairs: eventData.eventPairs,
		};
	} catch (error) {
		debugWarn('Event extraction failed:', error);
		return null;
	}
}

/**
 * Get affectedPairs from extracted event data for the event store.
 * This converts relationshipSignals to the v3 AffectedPair format.
 */
export function getAffectedPairsFromEvent(eventData: ExtractedEventData): AffectedPair[] {
	const pairs: AffectedPair[] = [];
	const seenPairs = new Set<string>();

	// First, collect all unique pairs from eventPairs
	for (const eventType of eventData.eventTypes) {
		const pairValue = eventData.eventPairs[eventType];
		if (!pairValue) continue;

		const normalizedPairs = normalizePairs(pairValue);
		for (const pair of normalizedPairs) {
			const sorted = sortPair(pair[0], pair[1]);
			const key = sorted.join('|').toLowerCase();

			if (!seenPairs.has(key)) {
				seenPairs.add(key);
				pairs.push({
					pair: sorted,
					// Changes will be added from relationshipSignals below
				});
			}
		}
	}

	// Add changes from relationshipSignals
	if (eventData.relationshipSignals) {
		for (const signal of eventData.relationshipSignals) {
			const sorted = sortPair(signal.pair[0], signal.pair[1]);
			const key = sorted.join('|').toLowerCase();

			// Find existing pair entry or create new one
			let ap = pairs.find(p => p.pair.join('|').toLowerCase() === key);
			if (!ap) {
				ap = { pair: sorted };
				pairs.push(ap);
				seenPairs.add(key);
			}

			// Add changes
			if (signal.changes && signal.changes.length > 0) {
				ap.changes = signal.changes;
			}
		}
	}

	return pairs;
}

// ============================================
// Validation
// ============================================

function validateEventTypes(data: unknown): EventType[] {
	if (!Array.isArray(data)) {
		return ['conversation']; // Default fallback
	}

	const valid = data.filter(
		(t): t is EventType =>
			typeof t === 'string' && EVENT_TYPES.includes(t as EventType),
	);

	return valid.length > 0 ? valid : ['conversation'];
}

// Note: EVENT_TYPE_TO_MILESTONE mapping is now in src/types/state.ts
// Milestone creation happens in the event store, not during extraction
// The functions for milestone description extraction have been removed
// as milestones are now computed by the event store from event types

function validateEventDetails(data: unknown): Record<string, string> | undefined {
	if (!data || !isObject(data)) {
		return undefined;
	}

	const details: Record<string, string> = {};
	for (const [key, value] of Object.entries(data)) {
		if (typeof value === 'string' && value.trim()) {
			details[key] = value.trim();
		}
	}

	return Object.keys(details).length > 0 ? details : undefined;
}

/**
 * Parse a single pair from data.
 */
function parseSinglePair(pair: unknown): [string, string] | null {
	if (!Array.isArray(pair) || pair.length < 2) return null;
	const char1 = typeof pair[0] === 'string' ? pair[0].trim() : '';
	const char2 = typeof pair[1] === 'string' ? pair[1].trim() : '';
	if (char1 && char2) return [char1, char2];
	return null;
}

/**
 * Validate eventPairs - supports both single pair and array of pairs per event type.
 */
function validateEventPairs(
	data: unknown,
	eventTypes: EventType[],
): Record<string, EventPairValue> {
	const pairs: Record<string, EventPairValue> = {};

	if (!data || !isObject(data)) {
		return pairs;
	}

	for (const eventType of eventTypes) {
		const value = (data as Record<string, unknown>)[eventType];
		if (!Array.isArray(value) || value.length < 2) continue;

		// Check if it's an array of pairs [[char1, char2], [char3, char4]]
		if (Array.isArray(value[0])) {
			const multiplePairs: [string, string][] = [];
			for (const item of value) {
				const parsed = parseSinglePair(item);
				if (parsed) multiplePairs.push(parsed);
			}
			if (multiplePairs.length > 0) {
				pairs[eventType] = multiplePairs;
			}
		} else {
			// Single pair [char1, char2]
			const parsed = parseSinglePair(value);
			if (parsed) {
				pairs[eventType] = parsed;
			}
		}
	}

	return pairs;
}

/**
 * Normalize eventPairs to always return an array of pairs for easier processing.
 */
function normalizePairs(value: EventPairValue): [string, string][] {
	if (value.length === 0) return [];
	// Check if it's array of pairs or single pair
	if (Array.isArray(value[0])) {
		return value as [string, string][];
	}
	return [value as [string, string]];
}

function validateEventData(
	data: unknown,
	_relationships: Relationship[],
): ExtractedEventData | null {
	if (!isObject(data)) {
		return null;
	}

	const summary = asString(data.summary, '');
	if (!summary.trim()) {
		return null;
	}

	const eventTypes = validateEventTypes(data.eventTypes);
	const eventPairs = validateEventPairs(data.eventPairs, eventTypes);
	const eventDetails = validateEventDetails(data.eventDetails);
	const witnesses = asStringArray(data.witnesses);
	const relationshipSignals = validateRelationshipSignals(data.relationshipSignals);

	return {
		summary,
		eventTypes,
		eventPairs,
		eventDetails,
		witnesses,
		relationshipSignals,
	};
}

function validateRelationshipSignal(data: unknown): RelationshipSignal | undefined {
	if (!data || !isObject(data)) {
		return undefined;
	}

	// Validate pair
	const pair = data.pair;
	if (!Array.isArray(pair) || pair.length !== 2) {
		return undefined;
	}

	const char1 = typeof pair[0] === 'string' ? pair[0] : '';
	const char2 = typeof pair[1] === 'string' ? pair[1] : '';

	if (!char1 || !char2) {
		return undefined;
	}

	// Sort the pair alphabetically
	const sortedPair = sortPair(char1, char2);

	// Validate changes
	let changes: DirectionalChange[] | undefined;
	if (Array.isArray(data.changes)) {
		changes = data.changes
			.filter(isObject)
			.map(c => ({
				from: asString(c.from, ''),
				toward: asString(c.toward, ''),
				feeling: asString(c.feeling, ''),
			}))
			.filter(c => c.from && c.toward && c.feeling);

		if (changes.length === 0) {
			changes = undefined;
		}
	}

	// Only return signal if we have changes
	if (!changes) {
		return undefined;
	}

	return {
		pair: sortedPair,
		changes,
	};
}

function validateRelationshipSignals(data: unknown): RelationshipSignal[] | undefined {
	if (!Array.isArray(data)) {
		return undefined;
	}

	const signals = data
		.map(item => validateRelationshipSignal(item))
		.filter((s): s is RelationshipSignal => s !== undefined);

	return signals.length > 0 ? signals : undefined;
}

function isNoEventResponse(summary: string): boolean {
	const noEventPhrases = [
		'no significant event',
		'no notable event',
		'no major event',
		'nothing significant',
		'nothing notable',
		'routine conversation',
		'casual conversation',
		'n/a',
		'none',
	];

	const lower = summary.toLowerCase().trim();
	return noEventPhrases.some(phrase => lower.includes(phrase) || lower === phrase);
}

// ============================================
// Helper Functions
// ============================================

function formatRelationshipsForPrompt(relationships: Relationship[]): string {
	if (relationships.length === 0) {
		return 'No established relationships yet.';
	}

	return relationships
		.map(r => {
			const [charA, charB] = r.pair;
			const aFeelings = r.aToB.feelings.join(', ') || 'neutral';
			const bFeelings = r.bToA.feelings.join(', ') || 'neutral';

			return `${charA} & ${charB} (${r.status}): ${charA} feels ${aFeelings}; ${charB} feels ${bFeelings}`;
		})
		.join('\n');
}
