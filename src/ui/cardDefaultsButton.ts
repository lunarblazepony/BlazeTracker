/**
 * Card Defaults Button Injection
 *
 * Injects a BlazeTracker Defaults button into the SillyTavern character editor.
 * The button opens a modal for editing character card extensions.
 */

import type { STContext } from '../types/st';

// Button element ID
const BUTTON_ID = 'bt_defaults_button';

// Container selector for ST's character editor buttons
const BUTTON_CONTAINER_SELECTOR = '.form_create_bottom_buttons_block';

// Reference to the button click handler for cleanup
let buttonClickHandler: (() => void) | null = null;

// Callback for when the modal should open
let onOpenModal: ((characterId: number) => void) | null = null;

// MutationObserver for watching DOM changes
let domObserver: MutationObserver | null = null;

/**
 * Set the callback to be invoked when the BlazeTracker button is clicked.
 */
export function setCardDefaultsModalCallback(callback: (characterId: number) => void): void {
	onOpenModal = callback;
}

/**
 * Inject the BlazeTracker Defaults button into the character editor.
 * Called when the character editor is detected/opened.
 */
export function injectCardDefaultsButton(): boolean {
	// Check if button already exists
	if (document.getElementById(BUTTON_ID)) {
		return true;
	}

	// Find the button container
	const container = document.querySelector(BUTTON_CONTAINER_SELECTOR);
	if (!container) {
		return false;
	}

	// Create the button
	const button = document.createElement('div');
	button.id = BUTTON_ID;
	button.className = 'menu_button fa-solid fa-fire';
	button.title = 'BlazeTracker Defaults';
	button.style.cssText = 'color: #f80;'; // BlazeTracker orange

	// Create click handler
	buttonClickHandler = () => {
		const context = SillyTavern.getContext() as STContext;
		const characterId = context.characterId;
		if (onOpenModal && characterId !== undefined) {
			onOpenModal(characterId);
		}
	};

	button.addEventListener('click', buttonClickHandler);

	// Find the Advanced Definitions button to insert after
	const advancedBtn = document.getElementById('advanced_div');
	if (advancedBtn && advancedBtn.parentNode === container) {
		advancedBtn.after(button);
	} else {
		// Insert at the end if Advanced button not found
		container.appendChild(button);
	}

	return true;
}

/**
 * Remove the BlazeTracker Defaults button from the character editor.
 */
export function removeCardDefaultsButton(): void {
	const button = document.getElementById(BUTTON_ID);
	if (button) {
		if (buttonClickHandler) {
			button.removeEventListener('click', buttonClickHandler);
			buttonClickHandler = null;
		}
		button.remove();
	}
}

/**
 * Start observing for the character editor to appear.
 * Uses MutationObserver to detect when the button container becomes available.
 */
export function startCharacterEditorObserver(): void {
	// Stop any existing observer
	stopCharacterEditorObserver();

	// Initial check
	injectCardDefaultsButton();

	// Create observer
	domObserver = new MutationObserver(_mutations => {
		// Try to inject button whenever DOM changes
		// This handles cases where the character editor opens dynamically
		const existingButton = document.getElementById(BUTTON_ID);
		const container = document.querySelector(BUTTON_CONTAINER_SELECTOR);

		if (container && !existingButton) {
			injectCardDefaultsButton();
		} else if (!container && existingButton) {
			// Editor was closed, remove button reference
			removeCardDefaultsButton();
		}
	});

	// Observe the entire document for childList changes
	domObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});
}

/**
 * Stop observing for the character editor.
 */
export function stopCharacterEditorObserver(): void {
	if (domObserver) {
		domObserver.disconnect();
		domObserver = null;
	}
	removeCardDefaultsButton();
}

/**
 * Initialize the card defaults button system.
 * Sets up observers and event handlers.
 *
 * @param openModalCallback - Callback invoked when button is clicked
 */
export function initCardDefaultsButton(openModalCallback: (characterId: number) => void): void {
	setCardDefaultsModalCallback(openModalCallback);
	startCharacterEditorObserver();
}

/**
 * Clean up the card defaults button system.
 */
export function cleanupCardDefaultsButton(): void {
	stopCharacterEditorObserver();
	onOpenModal = null;
}
