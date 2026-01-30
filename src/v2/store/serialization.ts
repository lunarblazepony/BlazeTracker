/**
 * V2 Serialization
 *
 * JSON serialization for EventStore persistence.
 */

import type { Event } from '../types/event';
import type { Snapshot } from '../types/snapshot';
import { cloneSnapshot } from '../types/snapshot';
import { debugWarn } from '../../utils/debug';

/**
 * Serialized event store format for JSON storage.
 */
export interface SerializedEventStore {
	version: number;
	snapshots: Snapshot[];
	events: Event[];
}

/**
 * Current serialization version.
 */
export const STORE_VERSION = 1;

/**
 * Serialize snapshots for storage.
 * Creates deep clones to avoid mutation issues.
 */
export function serializeSnapshots(snapshots: readonly Snapshot[]): Snapshot[] {
	return snapshots.map(s => cloneSnapshot(s));
}

/**
 * Serialize events for storage.
 * Creates deep clones to avoid mutation issues.
 */
export function serializeEvents(events: readonly Event[]): Event[] {
	// Events are simpler structures, spread is sufficient for shallow clone
	// Arrays within events are reference types that need to be cloned
	return events.map(event => {
		const clone = { ...event, source: { ...event.source } };

		// Clone any array fields
		if ('witnesses' in clone && Array.isArray(clone.witnesses)) {
			clone.witnesses = [...clone.witnesses];
		}
		if ('pair' in clone && Array.isArray(clone.pair)) {
			(clone as { pair: [string, string] }).pair = [...clone.pair] as [
				string,
				string,
			];
		}

		return clone as Event;
	});
}

/**
 * Serialize an event store to JSON-compatible format.
 */
export function serializeEventStore(
	snapshots: readonly Snapshot[],
	events: readonly Event[],
): SerializedEventStore {
	return {
		version: STORE_VERSION,
		snapshots: serializeSnapshots(snapshots),
		events: serializeEvents(events),
	};
}

/**
 * Deserialize an event store from JSON.
 * Validates the structure and returns null if invalid.
 */
export function deserializeEventStore(
	data: unknown,
): { snapshots: Snapshot[]; events: Event[] } | null {
	if (!data || typeof data !== 'object') {
		return null;
	}

	const obj = data as Record<string, unknown>;

	// Check version
	if (typeof obj.version !== 'number') {
		return null;
	}

	// For now, only support version 1
	if (obj.version !== STORE_VERSION) {
		debugWarn(`Unknown event store version: ${obj.version}, expected ${STORE_VERSION}`);
		// Could implement migration here in the future
	}

	// Validate snapshots
	if (!Array.isArray(obj.snapshots)) {
		return null;
	}

	// Validate events
	if (!Array.isArray(obj.events)) {
		return null;
	}

	// Migrate old snapshots that may be missing new fields
	const snapshots = obj.snapshots as Snapshot[];
	for (const snapshot of snapshots) {
		// Add forecasts field if missing (added in v2 climate update)
		if (!snapshot.forecasts) {
			snapshot.forecasts = {};
		}
	}

	// Basic validation passed - return the data
	return {
		snapshots,
		events: obj.events as Event[],
	};
}

/**
 * Validate that an event has the required base fields.
 */
export function isValidEvent(event: unknown): event is Event {
	if (!event || typeof event !== 'object') return false;

	const e = event as Record<string, unknown>;

	// Check required base fields
	if (typeof e.id !== 'string') return false;
	if (!e.source || typeof e.source !== 'object') return false;
	if (typeof e.timestamp !== 'number') return false;
	if (typeof e.kind !== 'string') return false;

	const source = e.source as Record<string, unknown>;
	if (typeof source.messageId !== 'number') return false;
	if (typeof source.swipeId !== 'number') return false;

	return true;
}

/**
 * Validate that a snapshot has the required base fields.
 */
export function isValidSnapshot(snapshot: unknown): snapshot is Snapshot {
	if (!snapshot || typeof snapshot !== 'object') return false;

	const s = snapshot as Record<string, unknown>;

	// Check required base fields
	if (typeof s.type !== 'string') return false;
	if (!s.source || typeof s.source !== 'object') return false;
	if (typeof s.timestamp !== 'number') return false;
	if (typeof s.swipeId !== 'number') return false;

	const source = s.source as Record<string, unknown>;
	if (typeof source.messageId !== 'number') return false;
	if (typeof source.swipeId !== 'number') return false;

	return true;
}

/**
 * Generate a UUID for events.
 */
export function generateEventId(): string {
	// Use crypto.randomUUID if available, otherwise fallback
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for environments without crypto.randomUUID
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
