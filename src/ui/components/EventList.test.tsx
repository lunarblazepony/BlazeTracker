// ============================================
// EventList Component Tests
// ============================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventList } from './EventList';
import type { TimestampedEvent } from '../../types/state';

// ============================================
// Test Data
// ============================================

function createMockEvent(overrides: Partial<TimestampedEvent> = {}): TimestampedEvent {
	return {
		summary: 'Test event summary',
		timestamp: {
			year: 2024,
			month: 6,
			day: 15,
			hour: 14,
			minute: 30,
			second: 0,
			dayOfWeek: 'Saturday',
		},
		tensionLevel: 'guarded',
		tensionType: 'suspense',
		location: 'Test Location',
		witnesses: ['Alice', 'Bob'],
		eventTypes: ['conversation'],
		messageId: 0,
		...overrides,
	};
}

const mockEvents: TimestampedEvent[] = [
	createMockEvent({
		summary: 'First event',
		messageId: 0,
		eventTypes: ['conversation'],
	}),
	createMockEvent({
		summary: 'Second event',
		messageId: 1,
		eventTypes: ['discovery'],
		timestamp: {
			year: 2024,
			month: 6,
			day: 15,
			hour: 15,
			minute: 0,
			second: 0,
			dayOfWeek: 'Saturday',
		},
	}),
	createMockEvent({
		summary: 'Third event',
		messageId: 2,
		eventTypes: ['argument'],
		timestamp: {
			year: 2024,
			month: 6,
			day: 15,
			hour: 16,
			minute: 0,
			second: 0,
			dayOfWeek: 'Saturday',
		},
	}),
];

// ============================================
// Tests
// ============================================

describe('EventList', () => {
	describe('rendering', () => {
		it('renders all events', () => {
			render(<EventList events={mockEvents} />);

			expect(screen.getByText('First event')).toBeInTheDocument();
			expect(screen.getByText('Second event')).toBeInTheDocument();
			expect(screen.getByText('Third event')).toBeInTheDocument();
		});

		it('renders events in reverse order (newest first)', () => {
			render(<EventList events={mockEvents} />);

			const eventItems = screen.getAllByText(/event$/);
			// Events should be in reverse order: Third, Second, First
			expect(eventItems[0]).toHaveTextContent('Third event');
			expect(eventItems[1]).toHaveTextContent('Second event');
			expect(eventItems[2]).toHaveTextContent('First event');
		});

		it('shows empty state when no events', () => {
			render(<EventList events={[]} />);

			expect(screen.getByText('No events recorded yet.')).toBeInTheDocument();
		});

		it('limits events based on maxEvents prop', () => {
			render(<EventList events={mockEvents} maxEvents={2} />);

			// Should only show the 2 most recent events (Second and Third)
			expect(screen.queryByText('First event')).not.toBeInTheDocument();
			expect(screen.getByText('Second event')).toBeInTheDocument();
			expect(screen.getByText('Third event')).toBeInTheDocument();
		});

		it('displays event time in formatted form', () => {
			render(<EventList events={[mockEvents[0]]} />);

			// Should display "Saturday 2:30 PM"
			expect(screen.getByText('Saturday 2:30 PM')).toBeInTheDocument();
		});

		it('displays witness list', () => {
			render(<EventList events={[mockEvents[0]]} />);

			expect(screen.getByText('Alice')).toBeInTheDocument();
			expect(screen.getByText('Bob')).toBeInTheDocument();
		});
	});

	describe('edit mode', () => {
		it('shows edit and delete buttons in edit mode', () => {
			render(<EventList events={mockEvents} editMode />);

			// Each event should have edit and delete buttons
			const editButtons = screen.getAllByTitle('Edit event');
			const deleteButtons = screen.getAllByTitle('Delete event');

			expect(editButtons).toHaveLength(3);
			expect(deleteButtons).toHaveLength(3);
		});

		it('does not show edit buttons when not in edit mode', () => {
			render(<EventList events={mockEvents} />);

			expect(screen.queryByTitle('Edit event')).not.toBeInTheDocument();
			expect(screen.queryByTitle('Delete event')).not.toBeInTheDocument();
		});
	});

	describe('in-place editing (Issue 1 fix)', () => {
		it('shows editor in-place when edit button is clicked', () => {
			const onUpdate = vi.fn();
			render(<EventList events={mockEvents} editMode onUpdate={onUpdate} />);

			// Click edit on the first displayed event (Third event, since reversed)
			const editButtons = screen.getAllByTitle('Edit event');
			fireEvent.click(editButtons[0]);

			// Editor should appear with the event's data
			expect(screen.getByLabelText('Summary')).toBeInTheDocument();
			expect(screen.getByLabelText('Summary')).toHaveValue('Third event');
		});

		it('replaces the event item with editor (not above it)', () => {
			const onUpdate = vi.fn();
			render(<EventList events={mockEvents} editMode onUpdate={onUpdate} />);

			// Click edit on an event
			const editButtons = screen.getAllByTitle('Edit event');
			fireEvent.click(editButtons[0]);

			// The event being edited should not show its summary as a regular item
			// We should have 2 visible event items (bt-event-item divs), not 3
			// The edited one is replaced by an editor container
			const eventItems = document.querySelectorAll('.bt-event-item');
			expect(eventItems).toHaveLength(2); // Only 2 regular event items visible
		});

		it('saves edited event when save is clicked', () => {
			const onUpdate = vi.fn();
			render(<EventList events={mockEvents} editMode onUpdate={onUpdate} />);

			// Click edit on the first displayed event
			const editButtons = screen.getAllByTitle('Edit event');
			fireEvent.click(editButtons[0]);

			// Change the summary
			const summaryInput = screen.getByLabelText('Summary');
			fireEvent.change(summaryInput, {
				target: { value: 'Updated event summary' },
			});

			// Click save
			const saveButton = screen.getByRole('button', { name: /save/i });
			fireEvent.click(saveButton);

			// onUpdate should be called with the correct index and updated event
			expect(onUpdate).toHaveBeenCalledTimes(1);
			const [index, event] = onUpdate.mock.calls[0];
			expect(index).toBe(2); // Original index of "Third event"
			expect(event.summary).toBe('Updated event summary');
		});

		it('cancels editing without saving when cancel is clicked', () => {
			const onUpdate = vi.fn();
			render(<EventList events={mockEvents} editMode onUpdate={onUpdate} />);

			// Click edit
			const editButtons = screen.getAllByTitle('Edit event');
			fireEvent.click(editButtons[0]);

			// Change the summary
			const summaryInput = screen.getByLabelText('Summary');
			fireEvent.change(summaryInput, {
				target: { value: 'Changed but not saved' },
			});

			// Click cancel
			const cancelButton = screen.getByRole('button', { name: /cancel/i });
			fireEvent.click(cancelButton);

			// onUpdate should not be called
			expect(onUpdate).not.toHaveBeenCalled();

			// Event should be back to normal display
			expect(screen.getByText('Third event')).toBeInTheDocument();
		});
	});

	describe('event deletion', () => {
		it('calls onDelete with correct index when delete is clicked', () => {
			const onDelete = vi.fn();
			render(<EventList events={mockEvents} editMode onDelete={onDelete} />);

			// Click delete on the second displayed event
			const deleteButtons = screen.getAllByTitle('Delete event');
			fireEvent.click(deleteButtons[1]);

			// onDelete should be called with the original index
			expect(onDelete).toHaveBeenCalledTimes(1);
			expect(onDelete).toHaveBeenCalledWith(1); // Original index of "Second event"
		});
	});

	describe('event preservation (Issue 6 fix)', () => {
		it('preserves all events when updating one', () => {
			const onUpdate = vi.fn();
			render(<EventList events={mockEvents} editMode onUpdate={onUpdate} />);

			// Edit the middle event
			const editButtons = screen.getAllByTitle('Edit event');
			fireEvent.click(editButtons[1]); // Second displayed = Second event (middle)

			// Save without changes
			const saveButton = screen.getByRole('button', { name: /save/i });
			fireEvent.click(saveButton);

			// onUpdate should receive the correct index
			expect(onUpdate).toHaveBeenCalledWith(1, expect.any(Object));

			// The original events array should be intact (component doesn't modify it)
			expect(mockEvents).toHaveLength(3);
			expect(mockEvents[0].summary).toBe('First event');
			expect(mockEvents[1].summary).toBe('Second event');
			expect(mockEvents[2].summary).toBe('Third event');
		});

		it('calculates correct original index when maxEvents is used', () => {
			const onUpdate = vi.fn();
			// Only show last 2 events (Second and Third)
			render(
				<EventList
					events={mockEvents}
					maxEvents={2}
					editMode
					onUpdate={onUpdate}
				/>,
			);

			// Edit the first displayed event (which is Third event at original index 2)
			const editButtons = screen.getAllByTitle('Edit event');
			fireEvent.click(editButtons[0]);

			const saveButton = screen.getByRole('button', { name: /save/i });
			fireEvent.click(saveButton);

			// Should call with original index 2 (Third event)
			expect(onUpdate).toHaveBeenCalledWith(
				2,
				expect.objectContaining({ summary: 'Third event' }),
			);
		});
	});

	describe('ref API', () => {
		it('exposes getPendingEdit for getting current edit state', () => {
			const ref = { current: null } as React.RefObject<any>;
			const onUpdate = vi.fn();

			render(
				<EventList
					ref={ref}
					events={mockEvents}
					editMode
					onUpdate={onUpdate}
				/>,
			);

			// Initially no pending edit
			expect(ref.current?.getPendingEdit()).toBeNull();

			// Start editing
			const editButtons = screen.getAllByTitle('Edit event');
			fireEvent.click(editButtons[0]);

			// Change the summary
			const summaryInput = screen.getByLabelText('Summary');
			fireEvent.change(summaryInput, { target: { value: 'Pending change' } });

			// Get pending edit
			const pending = ref.current?.getPendingEdit();
			expect(pending).not.toBeNull();
			expect(pending?.index).toBe(2);
			expect(pending?.event.summary).toBe('Pending change');
		});

		it('exposes commitPendingEdits for saving current edit', () => {
			const ref = { current: null } as React.RefObject<any>;
			const onUpdate = vi.fn();

			render(
				<EventList
					ref={ref}
					events={mockEvents}
					editMode
					onUpdate={onUpdate}
				/>,
			);

			// Start editing
			const editButtons = screen.getAllByTitle('Edit event');
			fireEvent.click(editButtons[0]);

			// Change the summary
			const summaryInput = screen.getByLabelText('Summary');
			fireEvent.change(summaryInput, { target: { value: 'Committed change' } });

			// Commit via ref
			const hadPending = ref.current?.commitPendingEdits();
			expect(hadPending).toBe(true);

			// onUpdate should be called
			expect(onUpdate).toHaveBeenCalledWith(
				2,
				expect.objectContaining({ summary: 'Committed change' }),
			);
		});
	});

	describe('CSS layout structure (CSS conflict fix)', () => {
		it('event items are wrapped in bt-event-list container', () => {
			render(<EventList events={mockEvents} />);

			const eventItem = document.querySelector('.bt-event-item');
			expect(eventItem).toBeInTheDocument();

			// Event items should be inside bt-event-list container for CSS scoping
			const eventList = eventItem?.closest('.bt-event-list');
			expect(eventList).toBeInTheDocument();
		});

		it('renders edit buttons when editMode is true', () => {
			render(
				<EventList
					events={mockEvents}
					editMode={true}
					onUpdate={vi.fn()}
					onDelete={vi.fn()}
				/>,
			);

			const editButtons = screen.getAllByTitle('Edit event');
			expect(editButtons.length).toBe(mockEvents.length);
		});

		it('event header contains time element and header-right section', () => {
			render(<EventList events={mockEvents} />);

			const header = document.querySelector('.bt-event-header');
			expect(header).toBeInTheDocument();

			const time = header?.querySelector('.bt-event-time');
			const rightSide = header?.querySelector('.bt-event-header-right');

			expect(time).toBeInTheDocument();
			expect(rightSide).toBeInTheDocument();
		});

		it('event actions are inside header-right section in edit mode', () => {
			render(
				<EventList
					events={mockEvents}
					editMode={true}
					onUpdate={vi.fn()}
					onDelete={vi.fn()}
				/>,
			);

			const headerRight = document.querySelector('.bt-event-header-right');
			expect(headerRight).toBeInTheDocument();

			const actions = headerRight?.querySelector('.bt-event-actions');
			expect(actions).toBeInTheDocument();

			// Actions should contain edit and delete buttons
			const editBtn = actions?.querySelector('.bt-edit-btn-small');
			const deleteBtn = actions?.querySelector('.bt-delete-btn-small');
			expect(editBtn).toBeInTheDocument();
			expect(deleteBtn).toBeInTheDocument();
		});

		it('maintains correct DOM structure for CSS specificity', () => {
			render(
				<EventList
					events={mockEvents}
					editMode={true}
					onUpdate={vi.fn()}
					onDelete={vi.fn()}
				/>,
			);

			// Verify the full DOM path for CSS scoping
			const eventList = document.querySelector('.bt-event-list');
			expect(eventList).toBeInTheDocument();

			const eventItems = eventList?.querySelectorAll('.bt-event-item');
			expect(eventItems?.length).toBe(mockEvents.length);

			// Each event item should have the correct structure
			const firstItem = eventItems?.[0];
			expect(firstItem?.querySelector('.bt-event-header')).toBeInTheDocument();
			expect(firstItem?.querySelector('.bt-event-summary')).toBeInTheDocument();
			expect(firstItem?.querySelector('.bt-event-footer')).toBeInTheDocument();
		});

		it('does NOT use bt-state-event-header class (that is for StateEventEditor)', () => {
			render(<EventList events={mockEvents} />);

			// EventList should use .bt-event-header, NOT .bt-state-event-header
			const wrongClass = document.querySelector('.bt-state-event-header');
			expect(wrongClass).not.toBeInTheDocument();

			const correctClass = document.querySelector('.bt-event-header');
			expect(correctClass).toBeInTheDocument();
		});

		it('event items are direct children of event list', () => {
			render(<EventList events={mockEvents} />);

			const eventList = document.querySelector('.bt-event-list');
			expect(eventList).toBeInTheDocument();

			// Event items should be direct children for CSS .bt-event-list > .bt-event-item to work
			const directChildren =
				eventList?.querySelectorAll(':scope > .bt-event-item');
			expect(directChildren?.length).toBe(mockEvents.length);
		});

		it('event tension icons are in footer section', () => {
			render(<EventList events={mockEvents} />);

			const footer = document.querySelector('.bt-event-footer');
			expect(footer).toBeInTheDocument();

			const tensionIcons = footer?.querySelector('.bt-event-tension');
			expect(tensionIcons).toBeInTheDocument();
		});
	});
});
