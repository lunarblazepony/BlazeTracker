/**
 * Debug Logging Utility
 *
 * Provides centralized logging that can be toggled on/off via settings.
 * Always prefixes log messages with [BlazeTracker] for easy identification.
 */

let debugEnabled = false;

/**
 * Enable or disable debug logging.
 * Called during initialization when settings are loaded.
 */
export function setDebugEnabled(enabled: boolean): void {
	debugEnabled = enabled;
}

/**
 * Check if debug logging is enabled.
 */
export function isDebugEnabled(): boolean {
	return debugEnabled;
}

/**
 * Log debug information (only when debug mode is enabled).
 */
export function debugLog(...args: unknown[]): void {
	if (debugEnabled) {
		console.log('[BlazeTracker]', ...args);
	}
}

/**
 * Log warnings (only when debug mode is enabled).
 */
export function debugWarn(...args: unknown[]): void {
	if (debugEnabled) {
		console.warn('[BlazeTracker]', ...args);
	}
}

/**
 * Log errors (always logs regardless of debug setting).
 * Errors should always be visible for troubleshooting.
 */
export function errorLog(...args: unknown[]): void {
	console.error('[BlazeTracker]', ...args);
}
