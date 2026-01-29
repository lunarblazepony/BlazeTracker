/**
 * Card Extension Reader
 *
 * Reads BlazeTracker extensions from character cards.
 * Handles macro resolution ({{char}}, {{user}}) and validation.
 */

import type {
	CardExtensions,
	BTLocationExtension,
	BTTimeExtension,
	BTOutfitExtension,
	BTProfileExtension,
	BTRelationshipsExtension,
	BTRelationshipExtension,
} from './types';
import {
	EXTENSION_KEY_LOCATION,
	EXTENSION_KEY_TIME,
	EXTENSION_KEY_OUTFIT,
	EXTENSION_KEY_PROFILE,
	EXTENSION_KEY_RELATIONSHIPS,
	isValidBTLocationExtension,
	isValidBTTimeExtension,
	isValidBTOutfitExtension,
	isValidBTProfileExtension,
	isValidBTRelationshipsExtension,
} from './types';

/**
 * Extended character interface that includes CCv2/v3 data extensions.
 */
export interface CharacterWithExtensions {
	name: string;
	avatar?: string;
	description?: string;
	personality?: string;
	scenario?: string;
	first_mes?: string;
	mes_example?: string;
	data?: {
		extensions?: Record<string, unknown>;
	};
}

/**
 * Extended context with writeExtensionField support.
 */
export interface STContextWithExtensions {
	eventSource: any;
	event_types: any;
	chat: any[];
	chatMetadata: Record<string, unknown>;
	characters: CharacterWithExtensions[];
	characterId: number;
	name1: string;
	name2: string;
	powerUserSettings?: any;
	generateQuietPrompt: (options: any) => Promise<string>;
	generateRaw: (options: any) => Promise<string>;
	deactivateSendButtons: () => void;
	activateSendButtons: () => void;
	stopGeneration: () => void;
	setExtensionPrompt: (
		key: string,
		value: string,
		position: number,
		depth: number,
		scan?: boolean,
		role?: string,
	) => void;
	saveChat: () => Promise<void>;
	saveMetadataDebounced: () => void;
	extensionSettings: Record<string, unknown>;
	saveSettingsDebounced: () => void;
	Popup: any;
	callGenericPopup: any;
	POPUP_TYPE: any;
	POPUP_RESULT: any;
	streamingProcessor: any;
	writeExtensionField: (characterId: number, key: string, value: unknown) => Promise<void>;
}

/**
 * Context needed for macro resolution.
 */
export interface MacroContext {
	/** Character name (resolves {{char}}) */
	characterName: string;
	/** User name (resolves {{user}}) */
	userName: string;
}

// ============================================
// Macro Resolution
// ============================================

/**
 * Resolve {{char}} and {{user}} macros in a string.
 */
export function resolveMacro(value: string, context: MacroContext): string {
	return value
		.replace(/\{\{char\}\}/gi, context.characterName)
		.replace(/\{\{user\}\}/gi, context.userName);
}

// Re-export name matching utilities from shared module for backwards compatibility
export { namesMatch, normalizeName } from '../extractors/utils/nameMatching';

// ============================================
// Reading Extensions
// ============================================

/**
 * Read all BlazeTracker extensions from a character card.
 *
 * @param characterId - The character ID to read extensions from
 * @param context - Optional ST context (defaults to SillyTavern.getContext())
 * @returns CardExtensions object, or null if no character found
 */
export function readCardExtensions(
	characterId?: number,
	context?: STContextWithExtensions,
): CardExtensions | null {
	const ctx = context ?? (SillyTavern.getContext() as STContextWithExtensions);
	const charId = characterId ?? ctx.characterId;

	const character = ctx.characters[charId] as CharacterWithExtensions | undefined;
	if (!character) {
		return null;
	}

	const extensions = character.data?.extensions;
	if (!extensions) {
		return {};
	}

	const result: CardExtensions = {};

	// Read location extension
	const locationData = extensions[EXTENSION_KEY_LOCATION];
	if (locationData && isValidBTLocationExtension(locationData)) {
		result.location = locationData;
	}

	// Read time extension
	const timeData = extensions[EXTENSION_KEY_TIME];
	if (timeData && isValidBTTimeExtension(timeData)) {
		result.time = timeData;
	}

	// Read outfit extension
	const outfitData = extensions[EXTENSION_KEY_OUTFIT];
	if (outfitData && isValidBTOutfitExtension(outfitData)) {
		result.outfit = outfitData;
	}

	// Read profile extension
	const profileData = extensions[EXTENSION_KEY_PROFILE];
	if (profileData && isValidBTProfileExtension(profileData)) {
		result.profile = profileData;
	}

	// Read relationships extension
	const relationshipsData = extensions[EXTENSION_KEY_RELATIONSHIPS];
	if (relationshipsData && isValidBTRelationshipsExtension(relationshipsData)) {
		result.relationships = relationshipsData;
	}

	return result;
}

/**
 * Read and resolve card extensions with macros applied.
 * This is the main entry point for reading card extensions during extraction.
 *
 * @param macroContext - Context for resolving {{char}} and {{user}} macros
 * @param characterId - Optional character ID (defaults to current character)
 * @param context - Optional ST context
 * @returns Resolved CardExtensions, or null if no character found
 */
export function readAndResolveCardExtensions(
	macroContext: MacroContext,
	characterId?: number,
	context?: STContextWithExtensions,
): CardExtensions | null {
	const raw = readCardExtensions(characterId, context);
	if (!raw) {
		return null;
	}

	const result: CardExtensions = {};

	// Location doesn't need macro resolution (pure strings)
	if (raw.location) {
		result.location = { ...raw.location };
	}

	// Time doesn't need macro resolution (pure datetime)
	if (raw.time) {
		result.time = { ...raw.time };
	}

	// Outfit doesn't need macro resolution (it's always for {{char}})
	if (raw.outfit) {
		result.outfit = { ...raw.outfit };
	}

	// Profile doesn't need macro resolution (it's always for {{char}})
	if (raw.profile) {
		result.profile = {
			...raw.profile,
			appearance: raw.profile.appearance
				? [...raw.profile.appearance]
				: undefined,
			personality: raw.profile.personality
				? [...raw.profile.personality]
				: undefined,
		};
	}

	// Relationships need target resolution
	if (raw.relationships) {
		result.relationships = raw.relationships.map(rel =>
			resolveRelationshipExtension(rel, macroContext),
		);
	}

	return result;
}

/**
 * Resolve macros in a relationship extension.
 */
function resolveRelationshipExtension(
	rel: BTRelationshipExtension,
	context: MacroContext,
): BTRelationshipExtension {
	return {
		...rel,
		target: resolveMacro(rel.target, context),
		// Attitudes don't have macros, but deep copy for safety
		charToTarget: rel.charToTarget
			? {
					feelings: [...(rel.charToTarget.feelings ?? [])],
					secrets: [...(rel.charToTarget.secrets ?? [])],
					wants: [...(rel.charToTarget.wants ?? [])],
				}
			: undefined,
		targetToChar: rel.targetToChar
			? {
					feelings: [...(rel.targetToChar.feelings ?? [])],
					secrets: [...(rel.targetToChar.secrets ?? [])],
					wants: [...(rel.targetToChar.wants ?? [])],
				}
			: undefined,
		milestones: rel.milestones ? [...rel.milestones] : undefined,
	};
}

// ============================================
// Writing Extensions
// ============================================

/**
 * Write a location extension to a character card.
 */
export async function writeLocationExtension(
	location: BTLocationExtension,
	characterId?: number,
	context?: STContextWithExtensions,
): Promise<void> {
	const ctx = context ?? (SillyTavern.getContext() as STContextWithExtensions);
	const charId = characterId ?? ctx.characterId;
	await ctx.writeExtensionField(charId, EXTENSION_KEY_LOCATION, location);
}

/**
 * Write a time extension to a character card.
 */
export async function writeTimeExtension(
	time: BTTimeExtension,
	characterId?: number,
	context?: STContextWithExtensions,
): Promise<void> {
	const ctx = context ?? (SillyTavern.getContext() as STContextWithExtensions);
	const charId = characterId ?? ctx.characterId;
	await ctx.writeExtensionField(charId, EXTENSION_KEY_TIME, time);
}

/**
 * Write an outfit extension to a character card.
 */
export async function writeOutfitExtension(
	outfit: BTOutfitExtension,
	characterId?: number,
	context?: STContextWithExtensions,
): Promise<void> {
	const ctx = context ?? (SillyTavern.getContext() as STContextWithExtensions);
	const charId = characterId ?? ctx.characterId;
	await ctx.writeExtensionField(charId, EXTENSION_KEY_OUTFIT, outfit);
}

/**
 * Write a profile extension to a character card.
 */
export async function writeProfileExtension(
	profile: BTProfileExtension,
	characterId?: number,
	context?: STContextWithExtensions,
): Promise<void> {
	const ctx = context ?? (SillyTavern.getContext() as STContextWithExtensions);
	const charId = characterId ?? ctx.characterId;
	await ctx.writeExtensionField(charId, EXTENSION_KEY_PROFILE, profile);
}

/**
 * Write a relationships extension to a character card.
 */
export async function writeRelationshipsExtension(
	relationships: BTRelationshipsExtension,
	characterId?: number,
	context?: STContextWithExtensions,
): Promise<void> {
	const ctx = context ?? (SillyTavern.getContext() as STContextWithExtensions);
	const charId = characterId ?? ctx.characterId;
	await ctx.writeExtensionField(charId, EXTENSION_KEY_RELATIONSHIPS, relationships);
}

/**
 * Write all card extensions at once.
 */
export async function writeAllExtensions(
	extensions: CardExtensions,
	characterId?: number,
	context?: STContextWithExtensions,
): Promise<void> {
	const ctx = context ?? (SillyTavern.getContext() as STContextWithExtensions);
	const charId = characterId ?? ctx.characterId;

	const promises: Promise<void>[] = [];

	if (extensions.location !== undefined) {
		promises.push(
			ctx.writeExtensionField(
				charId,
				EXTENSION_KEY_LOCATION,
				extensions.location,
			),
		);
	}

	if (extensions.time !== undefined) {
		promises.push(ctx.writeExtensionField(charId, EXTENSION_KEY_TIME, extensions.time));
	}

	if (extensions.outfit !== undefined) {
		promises.push(
			ctx.writeExtensionField(charId, EXTENSION_KEY_OUTFIT, extensions.outfit),
		);
	}

	if (extensions.profile !== undefined) {
		promises.push(
			ctx.writeExtensionField(charId, EXTENSION_KEY_PROFILE, extensions.profile),
		);
	}

	if (extensions.relationships !== undefined) {
		promises.push(
			ctx.writeExtensionField(
				charId,
				EXTENSION_KEY_RELATIONSHIPS,
				extensions.relationships,
			),
		);
	}

	await Promise.all(promises);
}

/**
 * Clear a specific extension from a character card.
 */
export async function clearExtension(
	key:
		| typeof EXTENSION_KEY_LOCATION
		| typeof EXTENSION_KEY_TIME
		| typeof EXTENSION_KEY_OUTFIT
		| typeof EXTENSION_KEY_PROFILE
		| typeof EXTENSION_KEY_RELATIONSHIPS,
	characterId?: number,
	context?: STContextWithExtensions,
): Promise<void> {
	const ctx = context ?? (SillyTavern.getContext() as STContextWithExtensions);
	const charId = characterId ?? ctx.characterId;
	await ctx.writeExtensionField(charId, key, null);
}
