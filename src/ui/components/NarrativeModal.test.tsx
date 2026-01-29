// ============================================
// NarrativeModal Component Tests
// ============================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NarrativeModal } from './NarrativeModal';
import type {
	NarrativeState,
	UnifiedEventStore,
	NarrativeEvent,
	StateEvent,
	DirectionalRelationshipEvent,
} from '../../types/state';

// ============================================
// Test Helpers
// ============================================

function createMockUnifiedEventStore(
	narrativeEvents: NarrativeEvent[] = [],
	stateEvents: StateEvent[] = [],
): UnifiedEventStore {
	return {
		narrativeEvents,
		stateEvents,
		version: 2,
	};
}

function createMockNarrativeEvent(overrides: Partial<NarrativeEvent> = {}): NarrativeEvent {
	return {
		id: `event-${Math.random().toString(36).slice(2)}`,
		messageId: 0,
		swipeId: 0,
		summary: 'Test event',
		tensionLevel: 'guarded',
		tensionType: 'suspense',
		witnesses: ['Alice'],
		location: 'Test Location',
		eventTypes: ['conversation'],
		affectedPairs: [],
		timestamp: Date.now(),
		narrativeTimestamp: {
			year: 2024,
			month: 6,
			day: 15,
			hour: 14,
			minute: 30,
			second: 0,
			dayOfWeek: 'Saturday',
		},
		...overrides,
	};
}

function createMockRelationshipEvent(
	overrides: Partial<DirectionalRelationshipEvent> = {},
): DirectionalRelationshipEvent {
	return {
		id: `rel-event-${Math.random().toString(36).slice(2)}`,
		messageId: 0,
		swipeId: 0,
		timestamp: Date.now(),
		kind: 'relationship',
		subkind: 'feeling_added',
		fromCharacter: 'Alice',
		towardCharacter: 'Bob',
		value: 'trust',
		...overrides,
	};
}

function createMockNarrativeState(eventStore?: UnifiedEventStore): NarrativeState {
	return {
		version: 4,
		chapters: [],
		relationships: [],
		eventStore: eventStore ?? createMockUnifiedEventStore(),
		forecastCache: [],
		locationMappings: [],
	};
}

// ============================================
// Tests
// ============================================

describe('NarrativeModal', () => {
	describe('temporary event store editing model', () => {
		it('creates a temporary event store when entering edit mode', async () => {
			const narrativeEvent = createMockNarrativeEvent({
				summary: 'Original summary',
			});
			const relationshipEvent = createMockRelationshipEvent({
				value: 'original-feeling',
			});

			const eventStore = createMockUnifiedEventStore(
				[narrativeEvent],
				[relationshipEvent],
			);
			const narrativeState = createMockNarrativeState(eventStore);
			const onClose = vi.fn();
			const onSave = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					currentEvents={[]}
					onClose={onClose}
					onSave={onSave}
				/>,
			);

			// Click enable editing
			const editButton = screen.getByRole('button', { name: /enable editing/i });
			await act(async () => {
				fireEvent.click(editButton);
			});

			// Verify we're in edit mode
			expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
		});

		it('does not modify real event store when cancel is clicked', async () => {
			// Create a narrative event - we verify the real store is unchanged after cancel
			const narrativeEvent = createMockNarrativeEvent({
				id: 'test-event-1',
				summary: 'Original summary',
			});

			const eventStore = createMockUnifiedEventStore([narrativeEvent], []);
			const narrativeState = createMockNarrativeState(eventStore);
			const onClose = vi.fn();
			const onSave = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					currentEvents={[]}
					onClose={onClose}
					onSave={onSave}
				/>,
			);

			// Enter edit mode (this creates a deep copy for editing)
			const editButton = screen.getByRole('button', { name: /enable editing/i });
			await act(async () => {
				fireEvent.click(editButton);
			});

			// Verify the original event store is unchanged
			expect(eventStore.narrativeEvents[0].summary).toBe('Original summary');

			// Click cancel - the real store should still be unchanged
			// (With the new model, edits go to a temp copy, not the real store)
			const cancelButton = screen.getByRole('button', { name: /cancel/i });
			await act(async () => {
				fireEvent.click(cancelButton);
			});

			// The real event store should still have original values
			expect(eventStore.narrativeEvents[0].summary).toBe('Original summary');
		});

		it('preserves real event store state events when cancel is clicked', async () => {
			// Create a relationship event
			const relationshipEvent = createMockRelationshipEvent({
				id: 'rel-event-1',
				value: 'original-value',
			});

			const eventStore = createMockUnifiedEventStore([], [relationshipEvent]);
			const narrativeState = createMockNarrativeState(eventStore);
			const onClose = vi.fn();
			const onSave = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					currentEvents={[]}
					onClose={onClose}
					onSave={onSave}
				/>,
			);

			// Enter edit mode
			const editButton = screen.getByRole('button', { name: /enable editing/i });
			await act(async () => {
				fireEvent.click(editButton);
			});

			// Verify original value
			expect(eventStore.stateEvents[0].kind).toBe('relationship');
			expect(
				(eventStore.stateEvents[0] as DirectionalRelationshipEvent).value,
			).toBe('original-value');

			// Click cancel - real store should be unchanged
			const cancelButton = screen.getByRole('button', { name: /cancel/i });
			await act(async () => {
				fireEvent.click(cancelButton);
			});

			// State events in real store should be unchanged
			expect(
				(eventStore.stateEvents[0] as DirectionalRelationshipEvent).value,
			).toBe('original-value');
		});

		it('calls onSave when save is clicked', async () => {
			const narrativeEvent = createMockNarrativeEvent({
				id: 'test-event-2',
				summary: 'Original summary',
			});

			const eventStore = createMockUnifiedEventStore([narrativeEvent], []);
			const narrativeState = createMockNarrativeState(eventStore);
			const onClose = vi.fn();
			const onSave = vi.fn().mockResolvedValue(undefined);

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					currentEvents={[]}
					onClose={onClose}
					onSave={onSave}
				/>,
			);

			// Enter edit mode
			const editButton = screen.getByRole('button', { name: /enable editing/i });
			await act(async () => {
				fireEvent.click(editButton);
			});

			// Click save
			const saveButton = screen.getByRole('button', { name: /save/i });
			await act(async () => {
				fireEvent.click(saveButton);
			});

			// Wait for save to complete
			await waitFor(() => {
				expect(onSave).toHaveBeenCalled();
			});
		});
	});

	describe('tab navigation', () => {
		it('starts on chapters tab by default', () => {
			const narrativeState = createMockNarrativeState();
			const onClose = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					onClose={onClose}
				/>,
			);

			// Chapters tab should be active
			const chaptersTab = screen.getByRole('button', { name: /chapters/i });
			expect(chaptersTab).toHaveClass('bt-tab-active');
		});

		it('starts on events tab when initialTab is "events"', () => {
			const narrativeState = createMockNarrativeState();
			const onClose = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					onClose={onClose}
					initialTab="events"
				/>,
			);

			// Events tab should be active
			const eventsTab = screen.getByRole('button', { name: /events/i });
			expect(eventsTab).toHaveClass('bt-tab-active');
		});

		it('switches tabs when clicked', async () => {
			const narrativeState = createMockNarrativeState();
			const onClose = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					onClose={onClose}
				/>,
			);

			// Click relationships tab
			const relationshipsTab = screen.getByRole('button', {
				name: /relationships/i,
			});
			await act(async () => {
				fireEvent.click(relationshipsTab);
			});

			// Relationships tab should now be active
			expect(relationshipsTab).toHaveClass('bt-tab-active');
		});
	});

	describe('edit mode UI', () => {
		it('shows Enable Editing button when not in edit mode', () => {
			const narrativeState = createMockNarrativeState();
			const onClose = vi.fn();
			const onSave = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					onClose={onClose}
					onSave={onSave}
				/>,
			);

			expect(
				screen.getByRole('button', { name: /enable editing/i }),
			).toBeInTheDocument();
		});

		it('shows Save and Cancel buttons in edit mode', async () => {
			const narrativeState = createMockNarrativeState();
			const onClose = vi.fn();
			const onSave = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					onClose={onClose}
					onSave={onSave}
				/>,
			);

			// Enter edit mode
			const editButton = screen.getByRole('button', { name: /enable editing/i });
			await act(async () => {
				fireEvent.click(editButton);
			});

			expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
			expect(
				screen.queryByRole('button', { name: /enable editing/i }),
			).not.toBeInTheDocument();
		});

		it('disables close button during edit mode', async () => {
			const narrativeState = createMockNarrativeState();
			const onClose = vi.fn();
			const onSave = vi.fn();

			render(
				<NarrativeModal
					narrativeState={narrativeState}
					onClose={onClose}
					onSave={onSave}
				/>,
			);

			// Enter edit mode
			const editButton = screen.getByRole('button', { name: /enable editing/i });
			await act(async () => {
				fireEvent.click(editButton);
			});

			// Close button should be hidden (not in DOM)
			const closeButton = document.querySelector('.bt-modal-close');
			expect(closeButton).toBeNull();
		});
	});
});
