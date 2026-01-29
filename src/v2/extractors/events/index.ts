/**
 * V2 Event Extractors Index
 *
 * Exports all event extractors that produce events from message changes.
 */

// Core extractors
export { timeChangeExtractor } from './timeChangeExtractor';
export { locationChangeExtractor } from './locationChangeExtractor';
export { propsChangeExtractor } from './propsChangeExtractor';
export { propsConfirmationExtractor } from './propsConfirmationExtractor';
export { forecastExtractor, climateChangeExtractor } from './forecastExtractor';
export { topicToneChangeExtractor } from './topicToneChangeExtractor';
export { tensionChangeExtractor } from './tensionChangeExtractor';

// Narrative extractors
export { narrativeDescriptionExtractor } from './narrativeDescriptionExtractor';
export { milestoneDescriptionExtractor } from './milestoneDescriptionExtractor';

// Chapter extractors
export { chapterEndedExtractor } from './chapterEndedExtractor';
export { chapterDescriptionExtractor } from './chapterDescriptionExtractor';

// Character extractors (re-export from subdirectory)
export * from './characters';

// Relationship extractors (re-export from subdirectory)
export * from './relationships';

import type { EventExtractor } from '../types';
import { timeChangeExtractor } from './timeChangeExtractor';
import { locationChangeExtractor } from './locationChangeExtractor';
import { propsChangeExtractor } from './propsChangeExtractor';
import { propsConfirmationExtractor } from './propsConfirmationExtractor';
import { forecastExtractor } from './forecastExtractor';
import { topicToneChangeExtractor } from './topicToneChangeExtractor';
import { tensionChangeExtractor } from './tensionChangeExtractor';
import { narrativeDescriptionExtractor } from './narrativeDescriptionExtractor';
import { milestoneDescriptionExtractor } from './milestoneDescriptionExtractor';
import { chapterEndedExtractor } from './chapterEndedExtractor';
import { chapterDescriptionExtractor } from './chapterDescriptionExtractor';

/**
 * Core event extractors - run on every turn for environment/scene tracking.
 * Note: forecastExtractor generates weather forecasts when needed (area change or time exceeds range).
 * Climate is computed from forecasts + time + location during projection.
 * Note: Props extractors are separate and run AFTER character extractors (to access outfit changes).
 */
export const coreEventExtractors: EventExtractor[] = [
	timeChangeExtractor,
	locationChangeExtractor,
	forecastExtractor, // Generates forecasts on area change or time exceeds range
	topicToneChangeExtractor,
	tensionChangeExtractor,
];

/**
 * Props event extractors - run AFTER character extractors to access outfit changes.
 * When a character removes clothing, those items should be added as scene props.
 * When a character puts on clothing, those items should be removed from scene props.
 */
export const propsEventExtractors: EventExtractor[] = [
	propsChangeExtractor,
	propsConfirmationExtractor,
];

/**
 * Narrative event extractors - run for narrative tracking.
 */
export const narrativeEventExtractors: EventExtractor[] = [
	narrativeDescriptionExtractor,
	milestoneDescriptionExtractor,
];

/**
 * Chapter event extractors - run for chapter boundary detection.
 */
export const chapterEventExtractors: EventExtractor[] = [
	chapterEndedExtractor,
	chapterDescriptionExtractor,
];
