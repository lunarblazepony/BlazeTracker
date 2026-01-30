/**
 * V2 Store Index
 *
 * Re-exports all store types and functions.
 */

// EventStore
export { EventStore, createEventStore } from './EventStore';

// Event application
export { applyEventToProjection } from './eventApplication';

// Projection helpers
export type { SwipeContext } from './projection';
export {
	filterCanonicalEvents,
	filterEventsUpToMessage,
	filterEventsForMessage,
	filterActiveEvents,
	projectFromSnapshot,
	sortEvents,
	getLatestMessageId,
	getEarliestMessageId,
	groupEventsByMessage,
} from './projection';

// Serialization
export type { SerializedEventStore } from './serialization';
export {
	STORE_VERSION,
	serializeSnapshots,
	serializeEvents,
	serializeEventStore,
	deserializeEventStore,
	isValidEvent,
	isValidSnapshot,
	generateEventId,
} from './serialization';
