/**
 * V2 Extractor Utilities Index
 *
 * Re-exports all extractor utility functions.
 */

// Run strategy evaluation
export { messageEquals, isUserMessage, isAssistantMessage, evaluateRunStrategy } from './shouldRun';

// Name matching utilities
export {
	namesMatch,
	normalizeName,
	findMatchingCharacterKey,
	buildNameLookup,
	findNameInLookup,
} from './nameMatching';

// Prompt building
export type { BuildPlaceholderOptions } from './buildPrompt';
export {
	formatMessages,
	getCharacterDescription,
	getUserDescription,
	formatLocation,
	formatTime,
	formatCharactersPresent,
	formatCharacterState,
	formatCharactersSummary,
	formatRelationshipPair,
	formatRelationshipProfiles,
	formatRelationshipState,
	formatTension,
	formatCharacterOutfits,
	getAllOutfitItems,
	filterPropsAgainstOutfits,
	formatOutfitChangesFromEvents,
	getRemovedOutfitItems,
	getAddedOutfitItems,
	buildPlaceholderValues,
	buildExtractorPrompt,
} from './buildPrompt';

// Parse utilities
export type { ParseOptions, ParseResult } from './parse';
export { extractReasoning, generateAndParse, generateAndParseOnce } from './parse';

// Event mapping
export {
	baseEvent,
	mapTimeChange,
	mapLocationChange,
	mapPropsChange,
	mapPresenceChange,
	mapOutfitChange,
	mapMoodChange,
	mapPositionChange,
	mapActivityChange,
	mapPhysicalChange,
	mapPositionActivityChange,
	mapMoodPhysicalChange,
	mapFeelingsChange,
	mapSecretsChange,
	mapWantsChange,
	mapStatusChange,
	mapSubjects,
	mapTopicToneChange,
	mapTensionChange,
	mapNarrativeDescription,
	mapChapterEnded,
	mapChapterDescription,
} from './mapToEvents';

// Temperature resolution
export type { TemperatureCategory } from './temperature';
export { getExtractorTemperature } from './temperature';

// Validation utilities
export {
	buildSwipeContextFromExtraction,
	projectWithTurnEvents,
	getPriorProjection,
	dedupeStrings,
	filterMoodsToAdd,
	filterMoodsToRemove,
	filterPhysicalToAdd,
	filterPhysicalToRemove,
	filterOutfitSlotsToRemove,
	filterOutfitSlotsToAdd,
	getRelationshipState,
	getDirectedRelationship,
	filterFeelingsToAdd,
	filterFeelingsToRemove,
	filterWantsToAdd,
	filterWantsToRemove,
	filterSecretsToAdd,
	filterSecretsToRemove,
	filterPropsToAdd,
	filterPropsToRemove,
	filterCharactersAppeared,
	filterCharactersDeparted,
} from './validation';
