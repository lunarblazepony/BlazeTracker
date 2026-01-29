/**
 * Card Extensions Module
 *
 * Provides functionality for reading, writing, and merging
 * BlazeTracker extensions from character cards.
 */

// Types
export type {
	BTLocationExtension,
	BTTimeExtension,
	BTOutfitExtension,
	BTAttitudeExtension,
	BTRelationshipExtension,
	BTRelationshipsExtension,
	CardExtensions,
} from './types';

export {
	EXTENSION_KEY_LOCATION,
	EXTENSION_KEY_TIME,
	EXTENSION_KEY_OUTFIT,
	EXTENSION_KEY_RELATIONSHIPS,
	isValidBTLocationExtension,
	isValidBTTimeExtension,
	isValidBTOutfitExtension,
	isValidBTRelationshipExtension,
	isValidBTRelationshipsExtension,
	hasEnabledExtensions,
} from './types';

// Reader
export type { MacroContext, STContextWithExtensions } from './reader';

export {
	resolveMacro,
	namesMatch,
	readCardExtensions,
	readAndResolveCardExtensions,
	writeLocationExtension,
	writeTimeExtension,
	writeOutfitExtension,
	writeRelationshipsExtension,
	writeAllExtensions,
	clearExtension,
} from './reader';

// Merger
export type { MergeContext } from './merger';

export { mergeCardExtensionsIntoSnapshot } from './merger';

// Name Resolver
export type { NameResolutionResult } from './nameResolver';

export { resolveCharacterName, clearNameResolutionCache } from './nameResolver';
