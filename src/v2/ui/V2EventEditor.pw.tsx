import { test, expect } from '@playwright/experimental-ct-react';
import { V2EventEditor, V2AddEventMenu } from './V2EventEditor';
import type { Event, NarrativeDescriptionEvent } from '../types/event';
import type { Projection } from '../types/snapshot';
import { createEmptySnapshot, createProjectionFromSnapshot } from '../types/snapshot';

// ============================================
// Test Fixtures
// ============================================

function createBaseEvent(id: string = 'test-id') {
	return {
		id,
		source: { messageId: 1, swipeId: 0 },
		timestamp: Date.now(),
	};
}

function createNarrativeDescriptionEvent(
	id: string,
	description: string,
): NarrativeDescriptionEvent {
	return {
		...createBaseEvent(id),
		kind: 'narrative_description',
		description,
	};
}

function createEmptyProjection(): Projection {
	const snap = createEmptySnapshot({ messageId: 1, swipeId: 0 });
	return createProjectionFromSnapshot(snap, { messageId: 1, swipeId: 0 });
}

// ============================================
// Narrative Description Events - Display
// ============================================

test.describe('Narrative description events - display', () => {
	test('renders narrative description events in a group', async ({ mount }) => {
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Alice greeted Bob warmly'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		await expect(
			component.locator('.bt-event-group-header', {
				hasText: 'Narrative Events',
			}),
		).toBeVisible();
		await expect(component.getByText('Narrative Description')).toBeVisible();
		await expect(component.getByText('Alice greeted Bob warmly')).toBeVisible();
	});

	test('shows scroll icon on narrative description event card', async ({ mount }) => {
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Something happened'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		const card = component.locator('.bt-event-card[data-kind="narrative"]');
		await expect(card.locator('.fa-scroll')).toBeAttached();
	});

	test('truncates long descriptions at 80 characters', async ({ mount }) => {
		const longDesc =
			'A very long narrative description that exceeds eighty characters and should be truncated with an ellipsis';
		const events: Event[] = [createNarrativeDescriptionEvent('nd-1', longDesc)];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		const truncated = longDesc.slice(0, 80) + '...';
		await expect(component.getByText(truncated)).toBeVisible();
	});

	test('shows (empty) for empty description', async ({ mount }) => {
		const events: Event[] = [createNarrativeDescriptionEvent('nd-1', '')];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		await expect(component.getByText('(empty)')).toBeVisible();
	});

	test('shows correct count badge for multiple narrative events', async ({ mount }) => {
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'First event'),
			createNarrativeDescriptionEvent('nd-2', 'Second event'),
			createNarrativeDescriptionEvent('nd-3', 'Third event'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		const group = component
			.locator('.bt-event-group')
			.filter({ hasText: 'Narrative Events' });
		await expect(
			group.locator('.bt-event-group-count', { hasText: '3' }),
		).toBeVisible();
	});

	test('does not render narrative group when no narrative events exist', async ({
		mount,
	}) => {
		const events: Event[] = [
			{
				...createBaseEvent('t-1'),
				kind: 'tension',
				level: 'relaxed',
				type: 'conversation',
				direction: 'stable',
			} as Event,
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		await expect(
			component.locator('.bt-event-group-header', {
				hasText: 'Narrative Events',
			}),
		).not.toBeVisible();
	});
});

// ============================================
// Narrative Description Events - Edit
// ============================================

test.describe('Narrative description events - editing', () => {
	test('clicking edit shows textarea with current description', async ({ mount }) => {
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Alice greeted Bob'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		await component.locator('.bt-action-btn[title="Edit"]').click();
		const textarea = component.locator('textarea[placeholder="Narrative description"]');
		await expect(textarea).toBeVisible();
		await expect(textarea).toHaveValue('Alice greeted Bob');
	});

	test('saving edit updates the event', async ({ mount }) => {
		let lastEvents: Event[] | null = null;
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Alice greeted Bob'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={e => {
					lastEvents = e;
				}}
				projection={createEmptyProjection()}
			/>,
		);

		await component.locator('.bt-action-btn[title="Edit"]').click();
		const textarea = component.locator('textarea[placeholder="Narrative description"]');
		await textarea.fill('Alice greeted Bob warmly');
		await component.locator('.bt-action-btn[title="Save"]').click();

		expect(lastEvents).not.toBeNull();
		const updated = lastEvents!.find(e => e.id === 'nd-1') as NarrativeDescriptionEvent;
		expect(updated.description).toBe('Alice greeted Bob warmly');
	});

	test('canceling edit does not update the event', async ({ mount }) => {
		let lastEvents: Event[] | null = null;
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Alice greeted Bob'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={e => {
					lastEvents = e;
				}}
				projection={createEmptyProjection()}
			/>,
		);

		await component.locator('.bt-action-btn[title="Edit"]').click();
		const textarea = component.locator('textarea[placeholder="Narrative description"]');
		await textarea.fill('Something else entirely');
		await component.locator('.bt-action-btn[title="Cancel"]').click();

		expect(lastEvents).toBeNull();
	});

	test('cancel returns to display mode', async ({ mount }) => {
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Alice greeted Bob'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		await component.locator('.bt-action-btn[title="Edit"]').click();
		await expect(
			component.locator('textarea[placeholder="Narrative description"]'),
		).toBeVisible();
		await component.locator('.bt-action-btn[title="Cancel"]').click();
		await expect(
			component.locator('textarea[placeholder="Narrative description"]'),
		).not.toBeVisible();
		await expect(component.getByText('Alice greeted Bob')).toBeVisible();
	});
});

// ============================================
// Narrative Description Events - Delete
// ============================================

test.describe('Narrative description events - delete', () => {
	test('clicking delete removes the event', async ({ mount }) => {
		let lastEvents: Event[] | null = null;
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Alice greeted Bob'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={e => {
					lastEvents = e;
				}}
				projection={createEmptyProjection()}
			/>,
		);

		await component.locator('.bt-action-btn[title="Delete"]').click();
		expect(lastEvents).not.toBeNull();
		expect(lastEvents!).toHaveLength(0);
	});

	test('deleting one of multiple narrative events keeps the others', async ({ mount }) => {
		let lastEvents: Event[] | null = null;
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'First event'),
			createNarrativeDescriptionEvent('nd-2', 'Second event'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={e => {
					lastEvents = e;
				}}
				projection={createEmptyProjection()}
			/>,
		);

		// Delete the first one
		const cards = component.locator('.bt-event-card[data-kind="narrative"]');
		await cards.first().locator('.bt-action-btn[title="Delete"]').click();

		expect(lastEvents).not.toBeNull();
		expect(lastEvents!).toHaveLength(1);
		expect((lastEvents![0] as NarrativeDescriptionEvent).description).toBe(
			'Second event',
		);
	});
});

// ============================================
// Add Event Menu - Narrative Description
// ============================================

test.describe('Add event menu - narrative description', () => {
	test('shows Narrative Description option in the menu', async ({ mount }) => {
		const component = await mount(
			<V2AddEventMenu
				messageId={1}
				swipeId={0}
				onAdd={() => {}}
				onClose={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		await expect(component.getByText('Narrative Description')).toBeVisible();
	});

	test('scroll icon exists next to Narrative Description option', async ({ mount }) => {
		const component = await mount(
			<V2AddEventMenu
				messageId={1}
				swipeId={0}
				onAdd={() => {}}
				onClose={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		const option = component
			.locator('.bt-v2-add-event-option')
			.filter({ hasText: 'Narrative Description' });
		await expect(option.locator('.fa-scroll')).toBeAttached();
	});

	test('clicking Narrative Description creates event with correct kind', async ({
		mount,
	}) => {
		let addedEvent: Event | null = null;

		const component = await mount(
			<V2AddEventMenu
				messageId={1}
				swipeId={0}
				onAdd={e => {
					addedEvent = e;
				}}
				onClose={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		await component.getByText('Narrative Description').click();
		expect(addedEvent).not.toBeNull();
		expect(addedEvent!.kind).toBe('narrative_description');
		expect((addedEvent as unknown as NarrativeDescriptionEvent).description).toBe('');
	});

	test('created event has correct messageId and swipeId', async ({ mount }) => {
		let addedEvent: Event | null = null;

		const component = await mount(
			<V2AddEventMenu
				messageId={5}
				swipeId={2}
				onAdd={e => {
					addedEvent = e;
				}}
				onClose={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		await component.getByText('Narrative Description').click();
		expect(addedEvent).not.toBeNull();
		expect(addedEvent!.source.messageId).toBe(5);
		expect(addedEvent!.source.swipeId).toBe(2);
	});

	test('Narrative Description option is in the Scene Events section', async ({ mount }) => {
		const component = await mount(
			<V2AddEventMenu
				messageId={1}
				swipeId={0}
				onAdd={() => {}}
				onClose={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		// Verify that the Scene Events label exists and the Narrative Description option
		// comes after it (they're in the same menu)
		await expect(
			component.locator('.bt-v2-add-event-section-label', {
				hasText: 'Scene Events',
			}),
		).toBeVisible();
		await expect(component.getByText('Narrative Description')).toBeVisible();
	});
});

// ============================================
// Group collapse/expand for narrative events
// ============================================

test.describe('Narrative events group - collapse/expand', () => {
	test('clicking header collapses the group', async ({ mount }) => {
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Something happened'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		const group = component
			.locator('.bt-event-group')
			.filter({ hasText: 'Narrative Events' });
		await expect(group).not.toHaveClass(/collapsed/);

		await group.locator('.bt-event-group-header').click();
		await expect(group).toHaveClass(/collapsed/);
	});

	test('clicking header again expands the group', async ({ mount }) => {
		const events: Event[] = [
			createNarrativeDescriptionEvent('nd-1', 'Something happened'),
		];

		const component = await mount(
			<V2EventEditor
				events={events}
				messageId={1}
				swipeId={0}
				onEventsChange={() => {}}
				projection={createEmptyProjection()}
			/>,
		);

		const group = component
			.locator('.bt-event-group')
			.filter({ hasText: 'Narrative Events' });

		// Collapse
		await group.locator('.bt-event-group-header').click();
		await expect(group).toHaveClass(/collapsed/);

		// Expand
		await group.locator('.bt-event-group-header').click();
		await expect(group).not.toHaveClass(/collapsed/);
	});
});
