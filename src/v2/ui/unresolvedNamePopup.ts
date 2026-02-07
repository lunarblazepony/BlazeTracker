/**
 * Unresolved Name Popup
 *
 * Shows a popup when extracted events reference character names that
 * couldn't be automatically matched to known characters.
 * Reuses the popup pattern from cardExtensions/nameResolver.ts.
 */

import type { STContext } from '../../types/st';
import type { UnresolvedNameMapping } from '../extractors/utils/resolveEventNames';

/**
 * Cache for user-selected unresolved name mappings within a session.
 * Key: unresolvedName (lowercased)
 */
const unresolvedNameCache = new Map<string, UnresolvedNameMapping>();

/**
 * Clear the unresolved name cache (call on chat change).
 */
export function clearUnresolvedNameCache(): void {
	unresolvedNameCache.clear();
}

/**
 * Show popups for each unresolved name, letting the user choose
 * which character to map each one to.
 *
 * @param unresolvedNames - Names that couldn't be automatically resolved
 * @param availableCharacters - Canonical character names to choose from
 * @returns Mappings from unresolved names to their resolutions
 */
export async function showUnresolvedNamePopup(
	unresolvedNames: string[],
	availableCharacters: string[],
): Promise<UnresolvedNameMapping[]> {
	const mappings: UnresolvedNameMapping[] = [];

	for (const name of unresolvedNames) {
		// Check cache first
		const cached = unresolvedNameCache.get(name.toLowerCase());
		if (cached) {
			mappings.push(cached);
			continue;
		}

		// Show popup for this name
		const mapping = await showSingleNamePopup(name, availableCharacters);

		// Cache the result
		unresolvedNameCache.set(name.toLowerCase(), mapping);
		mappings.push(mapping);
	}

	return mappings;
}

/**
 * Show a popup for a single unresolved name.
 */
async function showSingleNamePopup(
	unresolvedName: string,
	availableCharacters: string[],
): Promise<UnresolvedNameMapping> {
	return new Promise(resolve => {
		const context = SillyTavern.getContext() as unknown as STContext;

		const container = document.createElement('div');
		container.innerHTML = `
			<div style="padding: 10px;">
				<p style="margin-bottom: 15px;">
					<strong>BlazeTracker: Unknown Character Name</strong>
				</p>
				<p style="margin-bottom: 15px;">
					Extracted a reference to "<strong>${escapeHtml(unresolvedName)}</strong>"
					but couldn't match it to a known character.
				</p>
				<p style="margin-bottom: 10px;">
					Which character is this?
				</p>
				<select id="bt-unresolved-name-select" class="text_pole" style="width: 100%; margin-bottom: 15px;">
					<option value="">-- Select a character --</option>
					${availableCharacters.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}
				</select>
				<div style="display: flex; gap: 10px; justify-content: flex-end;">
					<button id="bt-unresolved-name-skip" class="menu_button" style="padding: 8px 16px;">
						Skip
					</button>
					<button id="bt-unresolved-name-apply" class="menu_button" style="padding: 8px 16px;" disabled>
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
			'bt-unresolved-name-select',
		) as HTMLSelectElement;
		const applyBtn = document.getElementById(
			'bt-unresolved-name-apply',
		) as HTMLButtonElement;
		const skipBtn = document.getElementById(
			'bt-unresolved-name-skip',
		) as HTMLButtonElement;

		// Enable apply button when selection is made
		select?.addEventListener('change', () => {
			if (applyBtn) {
				applyBtn.disabled = !select.value;
			}
		});

		const closePopup = () => {
			(document.querySelector('.popup-button-ok') as HTMLElement)?.click();
		};

		// Handle apply
		applyBtn?.addEventListener('click', () => {
			const selectedName = select?.value;
			closePopup();
			resolve({
				unresolvedName,
				resolvedTo: selectedName || null,
			});
		});

		// Handle skip
		skipBtn?.addEventListener('click', () => {
			closePopup();
			resolve({
				unresolvedName,
				resolvedTo: null,
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
