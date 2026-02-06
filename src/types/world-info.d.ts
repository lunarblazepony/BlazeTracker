/**
 * Type declarations for SillyTavern World Info Module
 *
 * Re-exports types from the module declaration for direct import.
 */

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
