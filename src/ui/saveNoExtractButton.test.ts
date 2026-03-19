// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	shouldSkipExtraction,
	setSkipNextExtraction,
	initSaveNoExtractButton,
	cleanupSaveNoExtractButton,
} from './saveNoExtractButton';

describe('saveNoExtractButton', () => {
	describe('shouldSkipExtraction', () => {
		beforeEach(() => {
			// Reset state
			setSkipNextExtraction(false);
		});

		it('returns false by default', () => {
			expect(shouldSkipExtraction()).toBe(false);
		});

		it('returns true once after flag is set, then resets to false', () => {
			setSkipNextExtraction(true);
			expect(shouldSkipExtraction()).toBe(true);
			expect(shouldSkipExtraction()).toBe(false);
		});

		it('can be set multiple times', () => {
			setSkipNextExtraction(true);
			setSkipNextExtraction(false);
			expect(shouldSkipExtraction()).toBe(false);

			setSkipNextExtraction(true);
			expect(shouldSkipExtraction()).toBe(true);
		});
	});

	describe('button injection', () => {
		beforeEach(() => {
			setSkipNextExtraction(false);
			// Set up a minimal DOM with #chat and .mes_edit_buttons
			document.body.innerHTML = `
				<div id="chat">
					<div class="mes" mesid="5">
						<div class="mes_edit_buttons">
							<div class="mes_edit_done menu_button" title="Save"></div>
						</div>
					</div>
				</div>
			`;
		});

		afterEach(() => {
			cleanupSaveNoExtractButton();
			document.body.innerHTML = '';
		});

		it('injects button after .mes_edit_done', () => {
			initSaveNoExtractButton();

			const btn = document.querySelector('.bt-save-no-extract');
			expect(btn).not.toBeNull();
			expect(btn!.classList.contains('fa-floppy-disk')).toBe(true);
			expect(btn!.getAttribute('title')).toBe('Save without re-extracting');

			// Should be right after .mes_edit_done
			const editDone = document.querySelector('.mes_edit_done');
			expect(editDone!.nextElementSibling).toBe(btn);
		});

		it('does not duplicate button on repeated calls', () => {
			initSaveNoExtractButton();
			// Manually trigger injection again
			initSaveNoExtractButton();

			const buttons = document.querySelectorAll('.bt-save-no-extract');
			// cleanupSaveNoExtractButton is called inside init, so only 1
			expect(buttons.length).toBe(1);
		});

		it('clicking button sets skip flag and triggers .mes_edit_done click', () => {
			initSaveNoExtractButton();

			const editDone = document.querySelector('.mes_edit_done') as HTMLElement;
			const clickSpy = vi.fn();
			editDone.addEventListener('click', clickSpy);

			const btn = document.querySelector('.bt-save-no-extract') as HTMLElement;
			btn.click();

			// The delegation handler clicks .mes_edit_done
			expect(clickSpy).toHaveBeenCalled();
			// Flag was set and then consumed by nothing yet, so it should still be true
			// (consume it now to verify)
			expect(shouldSkipExtraction()).toBe(true);
		});

		it('cleanup removes buttons and observer', () => {
			initSaveNoExtractButton();
			expect(document.querySelector('.bt-save-no-extract')).not.toBeNull();

			cleanupSaveNoExtractButton();
			expect(document.querySelector('.bt-save-no-extract')).toBeNull();
		});
	});
});
