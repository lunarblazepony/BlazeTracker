import React, { useState, useCallback, useMemo } from 'react';
import { RelationshipsTab } from './RelationshipsTab';
import type {
	ProjectedRelationship,
	RelationshipEvent,
	DirectionalRelationshipEvent,
	StatusChangedEvent,
	DirectionalRelationshipSubkind,
	UnifiedEventStore,
} from '../../types/state';
import {
	createUnifiedEventStore,
	addStateEvent,
	getRelationshipEventsForPair,
	projectRelationshipsFromCurrentState,
	invalidateProjectionsFrom,
	invalidateSnapshotsFrom,
} from '../../state/eventStore';

// Generate test events
function generateTestEvents(count: number): RelationshipEvent[] {
	const events: RelationshipEvent[] = [];
	const directionalSubkinds: DirectionalRelationshipSubkind[] = [
		'feeling_added',
		'feeling_removed',
		'secret_added',
		'secret_removed',
		'want_added',
		'want_removed',
	];

	for (let i = 0; i < count; i++) {
		if (i % 7 === 6) {
			// Create status_changed event
			const statusEvent: StatusChangedEvent = {
				id: `event-${i}`,
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Alice', 'Bob'] as [string, string],
				messageId: i,
				swipeId: 0,
				timestamp: Date.now() + i * 1000,
				newStatus: 'friendly',
				previousStatus: 'acquaintances',
			};
			events.push(statusEvent);
		} else {
			// Create directional event
			const subkind = directionalSubkinds[i % directionalSubkinds.length];
			const dirEvent: DirectionalRelationshipEvent = {
				id: `event-${i}`,
				kind: 'relationship',
				subkind,
				messageId: i,
				swipeId: 0,
				timestamp: Date.now() + i * 1000,
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: `Test value ${i}`,
			};
			events.push(dirEvent);
		}
	}

	return events;
}

// Create a test relationship
const testRelationship: ProjectedRelationship = {
	pair: ['Alice', 'Bob'] as [string, string],
	status: 'friendly',
	aToB: {
		feelings: ['trust', 'affection'],
		wants: ['protection'],
		secrets: [],
	},
	bToA: {
		feelings: ['respect'],
		wants: ['approval'],
		secrets: ['knows true identity'],
	},
};

// Generate mock chat data for swipeId lookup
function generateMockChat(count: number): { swipe_id: number }[] {
	return Array.from({ length: count }, (_, i) => ({
		// Even messages have swipe_id 0, odd messages have swipe_id 1
		swipe_id: i % 2,
	}));
}

// Wrapper component for testing with many events
export function RelationshipsTabWith400Events() {
	const events = React.useMemo(() => generateTestEvents(400), []);
	const chat = React.useMemo(() => generateMockChat(400), []);

	return (
		<div style={{ height: '600px', width: '800px' }}>
			<RelationshipsTab
				relationships={[testRelationship]}
				editMode={true}
				hasEventStore={true}
				getStateEventsForPair={() => events}
				computeMilestonesForPair={() => []}
				onStateEventUpdate={() => {}}
				onStateEventDelete={() => {}}
				onStateEventAdd={() => {}}
				chatLength={400}
				chat={chat}
			/>
		</div>
	);
}

// Wrapper component for testing with fewer events
export function RelationshipsTabWith50Events() {
	const events = React.useMemo(() => generateTestEvents(50), []);
	const chat = React.useMemo(() => generateMockChat(50), []);

	return (
		<div style={{ height: '600px', width: '800px' }}>
			<RelationshipsTab
				relationships={[testRelationship]}
				editMode={true}
				hasEventStore={true}
				getStateEventsForPair={() => events}
				computeMilestonesForPair={() => []}
				onStateEventUpdate={() => {}}
				onStateEventDelete={() => {}}
				onStateEventAdd={() => {}}
				chatLength={50}
				chat={chat}
			/>
		</div>
	);
}

/**
 * Story component with real event store that properly updates projections.
 * This simulates the NarrativeModal behavior for testing projection updates.
 */
export function RelationshipsTabWithEventStore() {
	// Mock chat data for 100 messages
	const chat = useMemo(() => generateMockChat(100), []);

	// Create a real event store with initial relationship
	const [eventStore] = useState<UnifiedEventStore>(() => {
		const store = createUnifiedEventStore();
		// Add an initial relationship_created event so the pair exists
		const initialEvent: Omit<StatusChangedEvent, 'id'> = {
			kind: 'relationship',
			subkind: 'status_changed',
			pair: ['Alice', 'Bob'] as [string, string],
			messageId: 0,
			swipeId: 0,
			timestamp: Date.now(),
			newStatus: 'strangers',
			previousStatus: 'strangers',
		};
		addStateEvent(store, initialEvent);
		return store;
	});

	// Version counter to force re-renders
	const [version, setVersion] = useState(0);

	// Project relationships from the event store
	const relationships = useMemo(() => {
		void version; // Force dependency on version
		return projectRelationshipsFromCurrentState(eventStore, chat);
	}, [eventStore, version, chat]);

	// Get events for a pair
	const getStateEventsForPair = useCallback(
		(pair: [string, string]): RelationshipEvent[] => {
			void version; // Force dependency
			return getRelationshipEventsForPair(eventStore, pair);
		},
		[eventStore, version],
	);

	// Handle adding a new event
	const handleStateEventAdd = useCallback(
		(event: Omit<RelationshipEvent, 'id'>) => {
			// Add the event to the store
			addStateEvent(eventStore, event);

			// Invalidate cached projections
			invalidateProjectionsFrom(eventStore, event.messageId);
			invalidateSnapshotsFrom(eventStore, event.messageId);

			// Increment version to force re-render with new projection
			setVersion(v => v + 1);
		},
		[eventStore],
	);

	// Handle updating an event
	const handleStateEventUpdate = useCallback(
		(eventId: string, updates: Partial<RelationshipEvent>) => {
			const event = eventStore.stateEvents.find(e => e.id === eventId);
			if (event) {
				Object.assign(event, updates);
				invalidateProjectionsFrom(eventStore, event.messageId);
				invalidateSnapshotsFrom(eventStore, event.messageId);
				setVersion(v => v + 1);
			}
		},
		[eventStore],
	);

	// Handle deleting an event
	const handleStateEventDelete = useCallback(
		(eventId: string) => {
			const event = eventStore.stateEvents.find(e => e.id === eventId);
			if (event) {
				event.deleted = true;
				invalidateProjectionsFrom(eventStore, event.messageId);
				invalidateSnapshotsFrom(eventStore, event.messageId);
				setVersion(v => v + 1);
			}
		},
		[eventStore],
	);

	return (
		<div style={{ height: '600px', width: '800px' }}>
			<RelationshipsTab
				relationships={relationships}
				editMode={true}
				hasEventStore={true}
				getStateEventsForPair={getStateEventsForPair}
				computeMilestonesForPair={() => []}
				onStateEventUpdate={handleStateEventUpdate}
				onStateEventDelete={handleStateEventDelete}
				onStateEventAdd={handleStateEventAdd}
				chatLength={100}
				chat={chat}
			/>
		</div>
	);
}
