import { test, expect } from '@playwright/experimental-ct-react';
import { V2SnapshotEditorModalTestWrapper } from './V2SnapshotEditorModalTestWrapper';

// ============================================
// Modal Structure
// ============================================

test.describe('V2SnapshotEditorModal', () => {
	test('renders header, pane labels, and action buttons', async ({ mount, page }) => {
		await mount(<V2SnapshotEditorModalTestWrapper />);

		// The modal uses position:fixed so query the full page
		await expect(page.getByText('Edit Initial Snapshot - Message #1')).toBeVisible();
		await expect(page.getByText('Snapshot Fields')).toBeVisible();
		await expect(page.getByText('Preview')).toBeVisible();
		await expect(page.getByText('Cancel')).toBeVisible();
		await expect(page.getByText('Save Changes')).toBeVisible();
	});

	test('Cancel calls onClose without onSave', async ({ mount, page }) => {
		await mount(<V2SnapshotEditorModalTestWrapper />);

		await page.getByText('Cancel').click();
		// The wrapper writes results to data attributes on a hidden div
		const result = page.locator('#test-result');
		await expect(result).toHaveAttribute('data-close-called', 'true');
		await expect(result).toHaveAttribute('data-save-called', 'false');
	});

	test('Save Changes calls onSave with an EventStore', async ({ mount, page }) => {
		await mount(<V2SnapshotEditorModalTestWrapper />);

		await page.getByText('Save Changes').click();
		const result = page.locator('#test-result');
		await expect(result).toHaveAttribute('data-save-called', 'true');
		await expect(result).toHaveAttribute('data-save-has-snapshot', 'true');
	});

	test('close button calls onClose', async ({ mount, page }) => {
		await mount(<V2SnapshotEditorModalTestWrapper />);

		await page.locator('.bt-v2-editor-close').click();
		const result = page.locator('#test-result');
		await expect(result).toHaveAttribute('data-close-called', 'true');
	});

	test('live preview shows location from snapshot', async ({ mount, page }) => {
		await mount(<V2SnapshotEditorModalTestWrapper />);

		// The populated snapshot has location "Downtown" / "Coffee Shop"
		const rightPane = page.locator('.bt-v2-editor-right');
		await expect(rightPane.getByText('Downtown')).toBeVisible();
		await expect(rightPane.getByText('Coffee Shop')).toBeVisible();
	});
});
