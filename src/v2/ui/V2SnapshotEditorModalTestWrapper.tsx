/**
 * Test wrapper for V2SnapshotEditorModal Playwright component tests.
 *
 * Playwright CT serializes props across the browser boundary, which breaks
 * class instances like EventStore. This wrapper constructs the EventStore
 * inside the browser context and exposes test results via DOM attributes.
 */

import { useState, useCallback } from 'react';
import { V2SnapshotEditorModal } from './V2SnapshotEditorModal';
import type { EventStore } from '../store/EventStore';
import { createEventStore } from '../store/EventStore';
import {
	createEmptySnapshot,
	createEmptyCharacterState,
	sortPair,
	getRelationshipKey,
} from '../types/snapshot';
import type { SwipeContext } from '../store/projection';

function createPopulatedStore(): EventStore {
	const snap = createEmptySnapshot({ messageId: 1, swipeId: 0 });
	snap.time = '2025-06-15T14:30:00.000Z';
	snap.location = {
		area: 'Downtown',
		place: 'Coffee Shop',
		position: 'Corner booth',
		props: ['menu'],
		locationType: 'modern',
	};
	snap.scene = {
		topic: 'First meeting',
		tone: 'Nervous excitement',
		tension: { level: 'aware', type: 'conversation', direction: 'escalating' },
	};
	snap.characters = {
		Alice: {
			...createEmptyCharacterState('Alice'),
			position: 'Sitting',
			mood: ['curious'],
		},
		Bob: {
			...createEmptyCharacterState('Bob'),
			position: 'Standing',
			mood: ['confident'],
		},
	};
	const pair = sortPair('Alice', 'Bob');
	const key = getRelationshipKey(pair);
	snap.relationships = {
		[key]: {
			pair,
			status: 'strangers',
			aToB: { feelings: ['curious'], secrets: [], wants: [] },
			bToA: { feelings: ['interested'], secrets: [], wants: [] },
		},
	};

	const store = createEventStore();
	store.replaceInitialSnapshot(snap);
	return store;
}

const swipeContext: SwipeContext = {
	getCanonicalSwipeId: () => 0,
};

export function V2SnapshotEditorModalTestWrapper() {
	const [store] = useState(() => createPopulatedStore());
	const [closeCalled, setCloseCalled] = useState(false);
	const [saveCalled, setSaveCalled] = useState(false);
	const [saveHasSnapshot, setSaveHasSnapshot] = useState(false);

	const handleClose = useCallback(() => {
		setCloseCalled(true);
	}, []);

	const handleSave = useCallback((updatedStore: EventStore) => {
		setSaveCalled(true);
		setSaveHasSnapshot(updatedStore.initialSnapshot !== null);
	}, []);

	return (
		<>
			<div
				id="test-result"
				data-close-called={String(closeCalled)}
				data-save-called={String(saveCalled)}
				data-save-has-snapshot={String(saveHasSnapshot)}
				style={{ display: 'none' }}
			/>
			<V2SnapshotEditorModal
				eventStore={store}
				messageId={1}
				swipeId={0}
				swipeContext={swipeContext}
				onSave={handleSave}
				onClose={handleClose}
			/>
		</>
	);
}
