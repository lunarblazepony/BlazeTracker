/**
 * Name Resolver
 *
 * Handles fuzzy name matching with user intervention when automatic matching fails.
 * Shows a popup letting the user choose which character to map to.
 */

import { namesMatch } from './reader';

/**
 * Result of a name resolution attempt.
 */
export interface NameResolutionResult {
	/** The matched name from the available options, or null if skipped */
	matchedName: string | null;
	/** Whether the user chose to skip this mapping */
	skipped: boolean;
}

/**
 * Cache for user-selected name mappings within a session.
 * Key: `${cardName}:${contextKey}` where contextKey identifies the character list context
 */
const nameResolutionCache = new Map<string, NameResolutionResult>();

/**
 * Clear the name resolution cache (call on chat change).
 */
export function clearNameResolutionCache(): void {
	nameResolutionCache.clear();
}

/**
 * Try to match a name against available options.
 * First tries fuzzy matching, then falls back to user popup if needed.
 *
 * @param cardName - The name from the card extension (e.g., resolved {{char}})
 * @param availableNames - List of character names from the snapshot
 * @param contextLabel - Label for the popup (e.g., "outfit" or "relationship")
 * @returns The matched name or null if skipped
 */
export async function resolveCharacterName(
	cardName: string,
	availableNames: string[],
	contextLabel: string,
): Promise<NameResolutionResult> {
	// Try exact match first
	const exactMatch = availableNames.find(
		name => name.toLowerCase() === cardName.toLowerCase(),
	);
	if (exactMatch) {
		return { matchedName: exactMatch, skipped: false };
	}

	// Try fuzzy matching
	const fuzzyMatch = availableNames.find(name => namesMatch(cardName, name));
	if (fuzzyMatch) {
		return { matchedName: fuzzyMatch, skipped: false };
	}

	// Check cache for previous user decision
	const cacheKey = `${cardName.toLowerCase()}:${availableNames.sort().join(',')}`;
	const cached = nameResolutionCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	// No automatic match - ask user
	const result = await showNameResolutionPopup(cardName, availableNames, contextLabel);

	// Cache the result
	nameResolutionCache.set(cacheKey, result);

	return result;
}

/**
 * Show a popup asking the user to select which character to map to.
 */
async function showNameResolutionPopup(
	cardName: string,
	availableNames: string[],
	contextLabel: string,
): Promise<NameResolutionResult> {
	return new Promise(resolve => {
		const context = SillyTavern.getContext();

		const container = document.createElement('div');
		container.innerHTML = `
			<div style="padding: 10px;">
				<p style="margin-bottom: 15px;">
					<strong>BlazeTracker: Character Name Mismatch</strong>
				</p>
				<p style="margin-bottom: 15px;">
					Could not automatically match "<strong>${escapeHtml(cardName)}</strong>"
					from the card's ${escapeHtml(contextLabel)} extension to any character in the scene.
				</p>
				<p style="margin-bottom: 10px;">
					Which character should this apply to?
				</p>
				<select id="bt-name-resolve-select" class="text_pole" style="width: 100%; margin-bottom: 15px;">
					<option value="">-- Select a character --</option>
					${availableNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}
				</select>
				<div style="display: flex; gap: 10px; justify-content: flex-end;">
					<button id="bt-name-resolve-skip" class="menu_button" style="padding: 8px 16px;">
						Skip
					</button>
					<button id="bt-name-resolve-apply" class="menu_button" style="padding: 8px 16px;" disabled>
						Apply
					</button>
				</div>
			</div>
		`;

		// Show popup
		context.callGenericPopup(container, context.POPUP_TYPE.TEXT, null, {
			wide: false,
		});

		const select = document.getElementById(
			'bt-name-resolve-select',
		) as HTMLSelectElement;
		const applyBtn = document.getElementById(
			'bt-name-resolve-apply',
		) as HTMLButtonElement;
		const skipBtn = document.getElementById(
			'bt-name-resolve-skip',
		) as HTMLButtonElement;

		// Enable apply button when selection is made
		select?.addEventListener('change', () => {
			if (applyBtn) {
				applyBtn.disabled = !select.value;
			}
		});

		const closePopup = () => {
			// Click the popup's close button
			(document.querySelector('.popup-button-ok') as HTMLElement)?.click();
		};

		// Handle apply
		applyBtn?.addEventListener('click', () => {
			const selectedName = select?.value;
			closePopup();
			resolve({
				matchedName: selectedName || null,
				skipped: !selectedName,
			});
		});

		// Handle skip
		skipBtn?.addEventListener('click', () => {
			closePopup();
			resolve({
				matchedName: null,
				skipped: true,
			});
		});
	});
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}
