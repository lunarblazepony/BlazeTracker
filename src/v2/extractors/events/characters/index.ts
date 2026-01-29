/**
 * V2 Character Event Extractors Index
 *
 * Exports character-focused event extractors.
 */

// Global extractors (detect presence changes and initial profiles/outfits for appeared characters)
export { presenceChangeExtractor } from './presenceChangeExtractor';
export { appearedCharacterProfileExtractor } from './appearedCharacterProfileExtractor';
export { appearedCharacterOutfitExtractor } from './appearedCharacterOutfitExtractor';

// Per-character extractors (run once for each present character)
// Individual extractors (kept for backwards compatibility)
export { positionChangeExtractor } from './positionChangeExtractor';
export { activityChangeExtractor } from './activityChangeExtractor';
export { moodChangeExtractor } from './moodChangeExtractor';
export { outfitChangeExtractor } from './outfitChangeExtractor';

// Combined extractors (for efficiency - fewer LLM calls)
export { positionActivityChangeExtractor } from './positionActivityChangeExtractor';
export { moodPhysicalChangeExtractor } from './moodPhysicalChangeExtractor';

// Consolidation extractors (periodic cleanup)
export { characterStateConsolidationExtractor } from './characterStateConsolidationExtractor';

import type { EventExtractor, PerCharacterExtractor } from '../../types';
import { presenceChangeExtractor } from './presenceChangeExtractor';
import { appearedCharacterProfileExtractor } from './appearedCharacterProfileExtractor';
import { appearedCharacterOutfitExtractor } from './appearedCharacterOutfitExtractor';
import { positionActivityChangeExtractor } from './positionActivityChangeExtractor';
import { moodPhysicalChangeExtractor } from './moodPhysicalChangeExtractor';
import { outfitChangeExtractor } from './outfitChangeExtractor';
import { characterStateConsolidationExtractor } from './characterStateConsolidationExtractor';

/**
 * Character extractors that run globally (not per-character).
 * Note: appearedCharacterProfileExtractor and appearedCharacterOutfitExtractor
 * should run AFTER presenceChangeExtractor so they can access the CharacterAppearedEvents in turnEvents.
 */
export const globalCharacterExtractors: EventExtractor[] = [
	presenceChangeExtractor,
	appearedCharacterProfileExtractor,
	appearedCharacterOutfitExtractor,
];

/**
 * Character extractors that run once per present character.
 * Uses combined extractors for efficiency:
 * - positionActivityChangeExtractor: combines position + activity (1 call instead of 2)
 * - moodPhysicalChangeExtractor: combines mood + physical state (1 call instead of 2)
 * - characterStateConsolidationExtractor: runs every 6 messages to consolidate lists
 */
export const perCharacterExtractors: PerCharacterExtractor[] = [
	positionActivityChangeExtractor,
	moodPhysicalChangeExtractor,
	outfitChangeExtractor,
	characterStateConsolidationExtractor,
];
