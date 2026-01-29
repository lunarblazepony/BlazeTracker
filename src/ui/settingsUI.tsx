/**
 * Settings UI - Delegates to V2 Settings UI
 *
 * This file provides backward-compatible exports while using the V2 settings UI.
 */

import { initV2SettingsUI, unmountV2SettingsUI } from '../v2/ui/V2SettingsUI';

/**
 * Initialize the settings UI panel.
 * Delegates to V2 settings UI.
 */
export async function initSettingsUI(): Promise<void> {
	await initV2SettingsUI();
}

/**
 * Unmount the settings UI panel.
 */
export function unmountSettingsUI(): void {
	unmountV2SettingsUI();
}
