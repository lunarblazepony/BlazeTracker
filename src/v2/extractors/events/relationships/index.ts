/**
 * V2 Relationship Event Extractors Index
 *
 * Exports relationship-focused event extractors.
 */

// Global extractors (detect subjects for all pairs)
export { subjectsExtractor } from './subjectsExtractor';
export { subjectsConfirmationExtractor } from './subjectsConfirmationExtractor';

// Per-pair extractors (run once for each present character pair)
export { feelingsChangeExtractor } from './feelingsChangeExtractor';
export { secretsChangeExtractor } from './secretsChangeExtractor';
export { wantsChangeExtractor } from './wantsChangeExtractor';
export { statusChangeExtractor } from './statusChangeExtractor';

// Consolidation extractors (periodic cleanup)
export { relationshipAttitudeConsolidationExtractor } from './relationshipAttitudeConsolidationExtractor';

import type { EventExtractor, PerPairExtractor } from '../../types';
import { subjectsExtractor } from './subjectsExtractor';
import { subjectsConfirmationExtractor } from './subjectsConfirmationExtractor';
import { feelingsChangeExtractor } from './feelingsChangeExtractor';
import { secretsChangeExtractor } from './secretsChangeExtractor';
import { wantsChangeExtractor } from './wantsChangeExtractor';
import { statusChangeExtractor } from './statusChangeExtractor';
import { relationshipAttitudeConsolidationExtractor } from './relationshipAttitudeConsolidationExtractor';

/**
 * Relationship extractors that run globally (not per-pair).
 */
export const globalRelationshipExtractors: EventExtractor[] = [
	subjectsExtractor,
	subjectsConfirmationExtractor,
];

/**
 * Relationship extractors that run once per present character pair.
 * - relationshipAttitudeConsolidationExtractor: runs every 6 messages to consolidate lists
 */
export const perPairExtractors: PerPairExtractor[] = [
	feelingsChangeExtractor,
	secretsChangeExtractor,
	wantsChangeExtractor,
	statusChangeExtractor,
	relationshipAttitudeConsolidationExtractor,
];
