/**
 * V2 Migration - Convert legacy state to v2 EventStore
 *
 * This provides best-effort migration from the old state format.
 */

import type { EventStore } from '../store';
import type { Snapshot } from '../types/snapshot';
import { createEmptySnapshot, createEmptyCharacterState, sortPair } from '../types/snapshot';
import type {
	Event,
	RelationshipStatusChangedEvent,
	RelationshipFeelingAddedEvent,
	ChapterEndedEvent,
	ChapterDescribedEvent,
} from '../types/event';
import { debugLog } from '../../utils/debug';

/**
 * Legacy NarrativeState structure (from old format).
 */
interface LegacyNarrativeState {
	chapters?: LegacyChapter[];
	relationships?: LegacyRelationship[];
	arcs?: Record<string, unknown>;
}

interface LegacyChapter {
	title?: string;
	summary?: string;
	timeRange?: { start: string; end: string };
	events?: unknown[];
}

interface LegacyRelationship {
	characters: [string, string];
	status?: string;
	attitudes?: {
		aToB?: { feelings?: string[]; secrets?: string[]; wants?: string[] };
		bToA?: { feelings?: string[]; secrets?: string[]; wants?: string[] };
	};
	milestones?: unknown[];
	history?: unknown[];
}

/**
 * Legacy per-message TrackedState structure.
 */
interface LegacyTrackedState {
	time?: { iso?: string; formatted?: string };
	location?: { area?: string; place?: string; position?: string; props?: string[] };
	climate?: { temperature?: number; conditions?: string; isIndoors?: boolean };
	scene?: {
		topic?: string;
		tone?: string;
		tension?: { level?: string; type?: string; direction?: string };
	};
	characters?: Record<
		string,
		{
			position?: string;
			activity?: string | null;
			mood?: string[];
			physicalState?: string[];
			outfit?: Record<string, string | null>;
		}
	>;
}

/**
 * Migrate legacy state to v2 EventStore.
 * Returns a fresh EventStore populated with migrated data.
 */
export function migrateFromLegacy(
	legacyNarrativeState: LegacyNarrativeState | null,
	legacyTrackedState: LegacyTrackedState | null,
	store: EventStore,
): void {
	// If no legacy data, nothing to migrate
	if (!legacyNarrativeState && !legacyTrackedState) {
		debugLog('No legacy state to migrate');
		return;
	}

	const events: Event[] = [];
	let eventIndex = 0;
	const createEventId = () => `migrated-${eventIndex++}`;
	const baseSource = { messageId: 0, swipeId: 0 };
	const baseTimestamp = Date.now();

	// Create initial snapshot from tracked state
	if (legacyTrackedState) {
		const snapshot = createSnapshotFromLegacy(legacyTrackedState, baseSource);
		store.replaceInitialSnapshot(snapshot);
	}

	// Migrate relationships
	if (legacyNarrativeState?.relationships) {
		for (const legacyRel of legacyNarrativeState.relationships) {
			const pair = sortPair(legacyRel.characters[0], legacyRel.characters[1]);

			// Create status event if status exists
			if (legacyRel.status) {
				const statusEvent: RelationshipStatusChangedEvent = {
					id: createEventId(),
					source: baseSource,
					timestamp: baseTimestamp,
					kind: 'relationship',
					subkind: 'status_changed',
					pair,
					newStatus: mapLegacyStatus(legacyRel.status),
				};
				events.push(statusEvent);
			}

			// Migrate attitudes
			if (legacyRel.attitudes?.aToB?.feelings) {
				for (const feeling of legacyRel.attitudes.aToB.feelings) {
					const feelingEvent: RelationshipFeelingAddedEvent = {
						id: createEventId(),
						source: baseSource,
						timestamp: baseTimestamp,
						kind: 'relationship',
						subkind: 'feeling_added',
						fromCharacter: pair[0],
						towardCharacter: pair[1],
						value: feeling,
					};
					events.push(feelingEvent);
				}
			}

			if (legacyRel.attitudes?.bToA?.feelings) {
				for (const feeling of legacyRel.attitudes.bToA.feelings) {
					const feelingEvent: RelationshipFeelingAddedEvent = {
						id: createEventId(),
						source: baseSource,
						timestamp: baseTimestamp,
						kind: 'relationship',
						subkind: 'feeling_added',
						fromCharacter: pair[1],
						towardCharacter: pair[0],
						value: feeling,
					};
					events.push(feelingEvent);
				}
			}
		}
	}

	// Migrate chapters
	if (legacyNarrativeState?.chapters) {
		for (let i = 0; i < legacyNarrativeState.chapters.length; i++) {
			const chapter = legacyNarrativeState.chapters[i];

			// Create chapter ended event (except for last/current chapter)
			if (i < legacyNarrativeState.chapters.length - 1) {
				const endedEvent: ChapterEndedEvent = {
					id: createEventId(),
					source: baseSource,
					timestamp: baseTimestamp,
					kind: 'chapter',
					subkind: 'ended',
					chapterIndex: i,
					reason: 'manual',
				};
				events.push(endedEvent);
			}

			// Create chapter described event if has title/summary
			if (chapter.title || chapter.summary) {
				const describedEvent: ChapterDescribedEvent = {
					id: createEventId(),
					source: baseSource,
					timestamp: baseTimestamp,
					kind: 'chapter',
					subkind: 'described',
					chapterIndex: i,
					title: chapter.title || `Chapter ${i + 1}`,
					summary: chapter.summary || '',
				};
				events.push(describedEvent);
			}
		}
	}

	// Add migrated events to store
	if (events.length > 0) {
		store.appendEvents(events);
		debugLog(`Migrated ${events.length} events from legacy state`);
	}
}

function createSnapshotFromLegacy(
	legacy: LegacyTrackedState,
	source: { messageId: number; swipeId: number },
): Snapshot {
	const snapshot = createEmptySnapshot(source);

	// Migrate time
	if (legacy.time?.iso) {
		snapshot.time = legacy.time.iso;
	}

	// Migrate location
	if (legacy.location) {
		// Derive locationType from legacy isIndoors if available
		const isIndoors = legacy.climate?.isIndoors ?? false;
		snapshot.location = {
			area: legacy.location.area || '',
			place: legacy.location.place || '',
			position: legacy.location.position || '',
			props: legacy.location.props || [],
			locationType: isIndoors ? 'heated' : 'outdoor',
		};
	}

	// Migrate climate
	if (legacy.climate) {
		snapshot.climate = {
			temperature: legacy.climate.temperature ?? 70,
			outdoorTemperature: legacy.climate.temperature ?? 70,
			feelsLike: legacy.climate.temperature ?? 70,
			conditions: legacy.climate.conditions || 'clear',
			isIndoors: legacy.climate.isIndoors ?? false,
			conditionType: 'clear',
			humidity: 50,
			precipitation: 0,
			cloudCover: 0,
			daylight: 'day',
			windSpeed: 0,
			windDirection: 'N',
			uvIndex: 5,
		};
	}

	// Migrate scene
	if (legacy.scene) {
		snapshot.scene = {
			topic: legacy.scene.topic || '',
			tone: legacy.scene.tone || '',
			tension: {
				level: (legacy.scene.tension?.level as any) || 'relaxed',
				type: (legacy.scene.tension?.type as any) || 'conversation',
				direction: (legacy.scene.tension?.direction as any) || 'stable',
			},
		};
	}

	// Migrate characters
	if (legacy.characters) {
		for (const [name, char] of Object.entries(legacy.characters)) {
			const charState = createEmptyCharacterState(name);
			charState.position = char.position || '';
			charState.activity = char.activity ?? null;
			charState.mood = char.mood || [];
			charState.physicalState = char.physicalState || [];
			if (char.outfit) {
				for (const [slot, item] of Object.entries(char.outfit)) {
					if (slot in charState.outfit) {
						(charState.outfit as any)[slot] = item;
					}
				}
			}
			snapshot.characters[name] = charState;
		}
	}

	return snapshot;
}

function mapLegacyStatus(status: string): any {
	const statusMap: Record<string, string> = {
		strangers: 'strangers',
		acquaintances: 'acquaintances',
		friends: 'friendly',
		'close friends': 'close',
		close_friends: 'close',
		romantic: 'intimate',
		partners: 'intimate',
		married: 'intimate',
		family: 'close',
		rivals: 'strained',
		enemies: 'hostile',
	};
	return statusMap[status.toLowerCase()] || 'acquaintances';
}

export default migrateFromLegacy;
