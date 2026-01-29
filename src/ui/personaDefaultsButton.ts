/**
 * Persona Defaults Button
 *
 * Injects BlazeTracker defaults buttons into the SillyTavern persona UI.
 * Each persona gets a fire icon button to open the defaults modal.
 */

import { openPersonaDefaultsModal } from './cardDefaultsModal';

// CSS class for our injected buttons
const BUTTON_CLASS = 'bt-persona-defaults-btn';
const PERSONA_DATA_ATTR = 'data-bt-persona';

// Selector for the current persona controls area
const PERSONA_CONTROLS_SELECTOR = '#persona_controls .persona_controls_buttons_block';

// Flag to prevent re-entrancy during our own DOM mutations
let isUpdating = false;

/**
 * Create a BlazeTracker defaults button element.
 */
function createDefaultsButton(personaName: string): HTMLElement {
	const btn = document.createElement('div');
	btn.className = BUTTON_CLASS;
	btn.setAttribute(PERSONA_DATA_ATTR, personaName);
	btn.title = 'BlazeTracker Defaults';
	btn.innerHTML = '<i class="fa-solid fa-fire"></i>';
	btn.addEventListener('click', e => {
		e.stopPropagation();
		e.preventDefault();
		openPersonaDefaultsModal(personaName);
	});
	return btn;
}

/**
 * Get the current persona name from SillyTavern context.
 */
function getCurrentPersonaName(): string | null {
	try {
		const ctx = SillyTavern.getContext();
		return ctx.name1 || null;
	} catch {
		return null;
	}
}

/**
 * Update the button for the current persona.
 * Only removes/recreates if the persona has actually changed.
 */
function updateButton(): void {
	if (isUpdating) return;
	isUpdating = true;

	try {
		const controlsBlock = document.querySelector(PERSONA_CONTROLS_SELECTOR);
		if (!controlsBlock) {
			return;
		}

		const currentPersona = getCurrentPersonaName();
		if (!currentPersona) {
			// No persona - remove button if exists
			const existingBtn = controlsBlock.querySelector(`.${BUTTON_CLASS}`);
			if (existingBtn) {
				existingBtn.remove();
			}
			return;
		}

		// Check if button exists and is for the right persona
		const existingBtn = controlsBlock.querySelector(`.${BUTTON_CLASS}`);
		if (existingBtn) {
			const btnPersona = existingBtn.getAttribute(PERSONA_DATA_ATTR);
			if (btnPersona === currentPersona) {
				// Button is already correct
				return;
			}
			// Wrong persona - remove it
			existingBtn.remove();
		}

		// Create and inject button for current persona
		const btn = createDefaultsButton(currentPersona);
		controlsBlock.appendChild(btn);
	} finally {
		isUpdating = false;
	}
}

/**
 * Remove all injected buttons.
 */
function removeButtons(): void {
	document.querySelectorAll(`.${BUTTON_CLASS}`).forEach(btn => btn.remove());
}

/**
 * Set up mutation observer to inject buttons when persona UI updates.
 */
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize persona defaults button injection.
 * Call this once during extension initialization.
 */
export function initPersonaDefaultsButtons(): void {
	// Clean up any existing observer
	if (observer) {
		observer.disconnect();
	}

	// Initial injection
	updateButton();

	// Watch for changes to the persona controls (persona name changes, etc.)
	const personaControls = document.getElementById('persona_controls');
	if (personaControls) {
		observer = new MutationObserver(() => {
			// Skip if we're causing the mutation
			if (isUpdating) return;

			// Debounce to avoid rapid-fire updates
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
			debounceTimer = setTimeout(updateButton, 100);
		});

		observer.observe(personaControls, {
			childList: true,
			subtree: true,
			characterData: true,
		});
	}
}

/**
 * Clean up persona defaults button injection.
 * Call this during extension cleanup.
 */
export function cleanupPersonaDefaultsButtons(): void {
	if (observer) {
		observer.disconnect();
		observer = null;
	}
	removeButtons();
}
