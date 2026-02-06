/**
 * Ambient module declaration for SillyTavern World Info Module
 *
 * This allows TypeScript to recognize dynamic imports of the world-info.js module.
 */

declare module '*world-info.js' {
	export interface WIGlobalScanData {
		personaDescription: string;
		characterDescription: string;
		characterPersonality: string;
		characterDepthPrompt: string;
		scenario: string;
		creatorNotes: string;
		trigger: string;
	}

	export interface WIScanEntry {
		uid: number;
		world: string;
		key: string[];
		keysecondary: string[];
		content: string;
		comment: string;
		order: number;
		constant: boolean;
		selective: boolean;
		selectiveLogic?: number;
	}

	export interface WIActivated {
		worldInfoBefore: string;
		worldInfoAfter: string;
		allActivatedEntries: Set<WIScanEntry>;
	}

	export function checkWorldInfo(
		chat: string[],
		maxContext: number,
		isDryRun: boolean,
		globalScanData?: WIGlobalScanData,
	): Promise<WIActivated>;

	export function getSortedEntries(): Promise<{
		globalLore: WIScanEntry[];
		characterLore: WIScanEntry[];
		chatLore: WIScanEntry[];
		personaLore: WIScanEntry[];
	}>;

	export function getWorldInfoPrompt(
		chat: string[],
		maxContext: number,
		isDryRun: boolean,
		globalScanData?: WIGlobalScanData,
	): Promise<{
		worldInfoString: string;
		worldInfoBefore: string;
		worldInfoAfter: string;
	}>;
}
