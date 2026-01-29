import { test, expect } from '@playwright/experimental-ct-react';
import {
	RelationshipsTabWith400Events,
	RelationshipsTabWith50Events,
	RelationshipsTabWithEventStore,
} from './RelationshipsTab.story';

test.describe('RelationshipsTab Scrolling', () => {
	test('can scroll to bottom of 400 events', async ({ mount, page }) => {
		// Mount the component with 400 events
		const component = await mount(<RelationshipsTabWith400Events />);

		// Click on the relationship card to expand it
		const relationshipHeader = component.locator('.bt-relationship-header').first();
		await relationshipHeader.click();

		// Click the edit button to enter editing mode
		const editButton = component.locator('.bt-edit-btn-small').first();
		await editButton.click();

		// Wait for the split editor to appear
		const splitEditor = component.locator('.bt-split-editor');
		await expect(splitEditor).toBeVisible();

		// Find the events list container
		const eventsList = component.locator('.bt-relationship-events-list');
		await expect(eventsList).toBeVisible();

		// Get the scroll height and client height
		const scrollInfo = await eventsList.evaluate(el => ({
			scrollHeight: el.scrollHeight,
			clientHeight: el.clientHeight,
			scrollTop: el.scrollTop,
		}));

		// Verify that content is scrollable (scrollHeight > clientHeight)
		expect(scrollInfo.scrollHeight).toBeGreaterThan(scrollInfo.clientHeight);
		console.log(
			`Events list - scrollHeight: ${scrollInfo.scrollHeight}, clientHeight: ${scrollInfo.clientHeight}`,
		);

		// Scroll to the bottom
		await eventsList.evaluate(el => {
			el.scrollTop = el.scrollHeight;
		});

		// Wait a moment for scroll to complete
		await page.waitForTimeout(100);

		// Verify we scrolled to the bottom
		const afterScroll = await eventsList.evaluate(el => ({
			scrollTop: el.scrollTop,
			scrollHeight: el.scrollHeight,
			clientHeight: el.clientHeight,
		}));

		// scrollTop should be approximately scrollHeight - clientHeight
		const expectedScrollTop = afterScroll.scrollHeight - afterScroll.clientHeight;
		expect(afterScroll.scrollTop).toBeGreaterThanOrEqual(expectedScrollTop - 5);

		console.log(
			`After scroll - scrollTop: ${afterScroll.scrollTop}, expected: ${expectedScrollTop}`,
		);

		// Verify the last event is visible (event #400, which is index 399)
		const lastEvent = component.locator('.bt-event-card').last();
		await expect(lastEvent).toBeVisible();

		// Verify it contains the expected event number
		const lastEventText = await lastEvent.textContent();
		expect(lastEventText).toContain('#400');
	});

	test('events list maintains scroll position', async ({ mount, page }) => {
		const component = await mount(<RelationshipsTabWith50Events />);

		// Expand and edit
		await component.locator('.bt-relationship-header').first().click();
		await component.locator('.bt-edit-btn-small').first().click();

		const eventsList = component.locator('.bt-relationship-events-list');
		await expect(eventsList).toBeVisible();

		// Scroll down a bit
		await eventsList.evaluate(el => {
			el.scrollTop = 200;
		});

		await page.waitForTimeout(50);

		// Get scroll position
		const scrollBefore = await eventsList.evaluate(el => el.scrollTop);
		expect(scrollBefore).toBe(200);

		// The scroll position should be maintained
		const scrollAfter = await eventsList.evaluate(el => el.scrollTop);
		expect(scrollAfter).toBe(200);
	});
});

test.describe('RelationshipsTab Projection Updates', () => {
	test('projection updates when adding a feeling event', async ({ mount, page }) => {
		const component = await mount(<RelationshipsTabWithEventStore />);

		// Click on the relationship card to expand it
		await component.locator('.bt-relationship-header').first().click();

		// Click the edit button to enter editing mode
		await component.locator('.bt-edit-btn-small').first().click();

		// Wait for the split editor to appear
		const splitEditor = component.locator('.bt-split-editor');
		await expect(splitEditor).toBeVisible();

		// Verify initial state - the projection pane should show current state
		const projectionPane = component.locator('.bt-projection-pane');
		await expect(projectionPane).toBeVisible();

		// Check initial projection (should be empty or just initial values)
		const initialProjection = await projectionPane.textContent();
		console.log('Initial projection:', initialProjection);

		// The projection should NOT contain "newfeelingtest" initially
		expect(initialProjection).not.toContain('newfeelingtest');

		// Click the "Add Event" button
		const addEventBtn = component.locator('.bt-add-event-btn');
		await expect(addEventBtn).toBeVisible();
		await addEventBtn.click();

		// Wait for the add event form to appear
		const addEventForm = component.locator('.bt-add-event-form');
		await expect(addEventForm).toBeVisible();

		// Form structure:
		// - select[0] = Message dropdown
		// - select[1] = Event Type dropdown (default: feeling_added)
		// - select[2] = Direction dropdown (for non-status events)

		// Event Type is already "feeling_added" by default, so we just need direction and value

		// Select direction: Alice -> Bob (value="aToB")
		const directionSelect = addEventForm.locator('select').nth(2);
		await directionSelect.selectOption('aToB');

		// Enter a unique feeling value
		const valueInput = addEventForm.locator('input[type="text"]');
		await valueInput.fill('newfeelingtest');

		// Click the "Add Event" button in the form
		const submitBtn = addEventForm.locator('button:has-text("Add Event")');
		await submitBtn.click();

		// Wait for the form to close
		await expect(addEventForm).not.toBeVisible();

		// Now check the projection pane - it should contain the new feeling
		await page.waitForTimeout(100); // Give React time to re-render

		const updatedProjection = await projectionPane.textContent();
		console.log('Updated projection:', updatedProjection);

		// The projection SHOULD now contain "newfeelingtest"
		expect(updatedProjection).toContain('newfeelingtest');
	});

	test('projection updates when adding a status change event', async ({ mount, page }) => {
		const component = await mount(<RelationshipsTabWithEventStore />);

		// Expand and enter edit mode
		await component.locator('.bt-relationship-header').first().click();
		await component.locator('.bt-edit-btn-small').first().click();

		const splitEditor = component.locator('.bt-split-editor');
		await expect(splitEditor).toBeVisible();

		// Get initial status from the projection
		const projectionPane = component.locator('.bt-projection-pane');
		await expect(projectionPane).toBeVisible();

		// The status should initially be "strangers" (from the initial event in the story)
		const initialProjection = await projectionPane.textContent();
		console.log('Initial projection:', initialProjection);
		expect(initialProjection).toContain('strangers');

		// Click "Add Event"
		await component.locator('.bt-add-event-btn').click();

		const addEventForm = component.locator('.bt-add-event-form');
		await expect(addEventForm).toBeVisible();

		// Form structure:
		// - select[0] = Message dropdown
		// - select[1] = Event Type dropdown
		// - select[2] = Direction (for non-status) OR New Status (for status_changed)

		// Change event type to "status_changed"
		const typeSelect = addEventForm.locator('select').nth(1);
		await typeSelect.selectOption('status_changed');

		// Now select[2] becomes "New Status" dropdown
		// Wait for the form to update (status select replaces direction)
		await page.waitForTimeout(50);

		// Select new status "intimate"
		const statusSelect = addEventForm.locator('select').nth(2);
		await statusSelect.selectOption('intimate');

		// Submit
		await addEventForm.locator('button:has-text("Add Event")').click();
		await expect(addEventForm).not.toBeVisible();

		// Check the status updated in projection
		await page.waitForTimeout(100);

		const updatedProjection = await projectionPane.textContent();
		console.log('Updated projection:', updatedProjection);

		// Status should now show "intimate"
		expect(updatedProjection).toContain('intimate');
	});
});
