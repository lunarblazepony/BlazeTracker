/**
 * Save Without Re-Extract Button Injection
 *
 * Injects a button into SillyTavern's message edit buttons that saves
 * the edit without triggering BlazeTracker re-extraction.
 */

// Module-level skip flag (consume-once pattern)
let skipNextExtraction = false;

/**
 * Check if the next extraction should be skipped.
 * Consumes the flag: returns true once, then resets to false.
 */
export function shouldSkipExtraction(): boolean {
	const value = skipNextExtraction;
	skipNextExtraction = false;
	return value;
}

/**
 * Set the skip flag. Used internally by the button click handler.
 * Exported for testing.
 */
export function setSkipNextExtraction(value: boolean): void {
	skipNextExtraction = value;
}

// Button class for identification
const BUTTON_CLASS = 'bt-save-no-extract';

// MutationObserver for watching edit buttons
let domObserver: MutationObserver | null = null;

// Event delegation handler reference
let delegationHandler: ((e: Event) => void) | null = null;

/**
 * Inject the save-no-extract button into a `.mes_edit_buttons` container.
 * Returns true if button was injected or already exists.
 */
function injectButton(container: Element): boolean {
	// Already injected
	if (container.querySelector(`.${BUTTON_CLASS}`)) {
		return true;
	}

	const editDone = container.querySelector('.mes_edit_done');
	if (!editDone) {
		return false;
	}

	const button = document.createElement('div');
	button.className = `${BUTTON_CLASS} menu_button fa-solid fa-floppy-disk`;
	button.title = 'Save without re-extracting';
	button.style.cssText = 'color: #f80;';

	editDone.after(button);
	return true;
}

/**
 * Scan all visible `.mes_edit_buttons` containers and inject buttons.
 */
function injectAllButtons(): void {
	const containers = document.querySelectorAll('.mes_edit_buttons');
	containers.forEach(container => injectButton(container));
}

/**
 * Initialize the save-no-extract button system.
 * Sets up MutationObserver and event delegation.
 */
export function initSaveNoExtractButton(): void {
	cleanupSaveNoExtractButton();

	// Initial injection
	injectAllButtons();

	// Watch for new edit button containers appearing
	const chat = document.getElementById('chat');
	if (chat) {
		domObserver = new MutationObserver(() => {
			injectAllButtons();
		});

		domObserver.observe(chat, {
			childList: true,
			subtree: true,
		});

		// Event delegation for button clicks
		delegationHandler = (e: Event) => {
			const target = e.target as HTMLElement;
			if (!target.classList.contains(BUTTON_CLASS)) return;

			// Set skip flag
			skipNextExtraction = true;

			// Trigger the standard save by clicking .mes_edit_done
			const container = target.closest('.mes_edit_buttons');
			if (container) {
				const editDone = container.querySelector(
					'.mes_edit_done',
				) as HTMLElement | null;
				if (editDone) {
					editDone.click();
				}
			}
		};

		chat.addEventListener('click', delegationHandler);
	}
}

/**
 * Clean up the save-no-extract button system.
 */
export function cleanupSaveNoExtractButton(): void {
	if (domObserver) {
		domObserver.disconnect();
		domObserver = null;
	}

	if (delegationHandler) {
		const chat = document.getElementById('chat');
		if (chat) {
			chat.removeEventListener('click', delegationHandler);
		}
		delegationHandler = null;
	}

	// Remove all injected buttons
	document.querySelectorAll(`.${BUTTON_CLASS}`).forEach(el => el.remove());
}
