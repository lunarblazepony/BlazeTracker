/**
 * V2 Extractors Index
 *
 * Re-exports extractor types and utilities.
 */

// Types
export type {
	ExtractionContext,
	ExtractionSettings,
	MessageStrategy,
	RunStrategy,
	RunStrategyContext,
	BaseExtractor,
	InitialExtractor,
	EventExtractor,
	PerCharacterExtractor,
	PerPairExtractor,
	ExtractorState,
	ExtractionResult,
	InitialExtractionResult,
} from './types';

export { getMessageCount, createExtractorState } from './types';

// Utilities
export * from './utils';
