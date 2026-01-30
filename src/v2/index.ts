/**
 * V2 Event System - Public API
 *
 * This is the main entry point for the v2 event-sourced state system.
 */

// Types
export type {
	Event,
	EventKind,
	TimeEvent,
	LocationEvent,
	CharacterEvent,
	RelationshipEvent,
	TopicToneEvent,
	TensionEvent,
	NarrativeDescriptionEvent,
	ChapterEvent,
	KindAndSubkind,
} from './types/event';

export type {
	Snapshot,
	Projection,
	CharacterState,
	RelationshipState,
	SceneState,
	NarrativeEvent,
	Chapter,
} from './types/snapshot';

export type { MessageAndSwipe, LocationState, TimeDelta, ClimateForecast } from './types/common';
export type { Subject } from './types/subject';

// Store
export { EventStore } from './store';

// Generator
export type { Generator, GeneratorPrompt, GeneratorSettings } from './generator';
export { SillyTavernGenerator, MockGenerator, buildPrompt } from './generator';

// Extractors
export type {
	ExtractionContext,
	ExtractionSettings,
	ExtractionResult,
	InitialExtractor,
	EventExtractor,
	PerCharacterExtractor,
	PerPairExtractor,
} from './extractors/types';

// Orchestrators
export {
	extractTurn,
	reextractFromMessage,
	extractInitialSnapshot,
	extractEvents,
} from './orchestrators';

// Narrative
export { computeNarrativeEvents, computeChapters } from './narrative';

// Injectors
export { injectState, formatStateSummary, type InjectOptions } from './injectors';

// Settings
export type { V2Settings } from './settings';
export {
	createDefaultSettings,
	mergeWithDefaults,
	DEFAULT_TRACK,
	DEFAULT_TEMPERATURES,
} from './settings';

// Migration
export { migrateFromLegacy } from './migration';

// Card Extensions
export type {
	BTLocationExtension,
	BTTimeExtension,
	BTOutfitExtension,
	BTRelationshipExtension,
	BTRelationshipsExtension,
	CardExtensions,
	MacroContext,
} from './cardExtensions';

export {
	readCardExtensions,
	readAndResolveCardExtensions,
	writeAllExtensions,
	mergeCardExtensionsIntoSnapshot,
	hasEnabledExtensions,
	namesMatch,
	resolveMacro,
} from './cardExtensions';
