/**
 * V2 Initial Extractors Index
 *
 * Exports all initial extractors that produce the initial Snapshot.
 */

export { initialTimeExtractor } from './timeExtractor';
export { locationExtractor } from './locationExtractor';
export { initialForecastExtractor, climateExtractor } from './forecastExtractor';
export { initialPropsExtractor } from './propsExtractor';
export { initialCharactersPresentExtractor } from './charactersPresentExtractor';
export { initialCharacterProfilesExtractor } from './characterProfilesExtractor';
export { initialCharacterOutfitsExtractor } from './characterOutfitsExtractor';
export { initialRelationshipsExtractor } from './relationshipsExtractor';
export { initialTopicToneExtractor } from './topicToneExtractor';
export { tensionExtractor } from './tensionExtractor';

import type { InitialExtractor } from '../types';
import { initialTimeExtractor } from './timeExtractor';
import { locationExtractor } from './locationExtractor';
import { initialForecastExtractor } from './forecastExtractor';
import { initialPropsExtractor } from './propsExtractor';
import { initialCharactersPresentExtractor } from './charactersPresentExtractor';
import { initialCharacterProfilesExtractor } from './characterProfilesExtractor';
import { initialCharacterOutfitsExtractor } from './characterOutfitsExtractor';
import { initialRelationshipsExtractor } from './relationshipsExtractor';
import { initialTopicToneExtractor } from './topicToneExtractor';
import { tensionExtractor } from './tensionExtractor';

/**
 * All initial extractors in the order they should run.
 * Order matters because some extractors depend on previous results.
 *
 * Dependencies:
 * - forecastExtractor requires locationExtractor + timeExtractor (needs location area and time)
 * - characterProfilesExtractor requires charactersPresentExtractor (needs character list)
 * - characterOutfitsExtractor requires charactersPresentExtractor (needs character list)
 * - propsExtractor requires locationExtractor + characterOutfitsExtractor (needs location context, filters worn clothing)
 * - relationshipsExtractor requires charactersPresentExtractor (needs character list)
 * - tensionExtractor requires topicToneExtractor (needs scene context)
 */
export const initialExtractors: InitialExtractor[] = [
	// Core state (no dependencies)
	initialTimeExtractor,
	locationExtractor,

	// Location and time dependent
	initialForecastExtractor, // Generates 28-day weather forecast

	// Characters (no dependencies)
	initialCharactersPresentExtractor,

	// Character-dependent
	initialCharacterProfilesExtractor, // Extracts profile for each character
	initialCharacterOutfitsExtractor,
	initialRelationshipsExtractor,

	// Props (requires location + outfits to filter worn clothing from props)
	initialPropsExtractor,

	// Scene (no dependencies)
	initialTopicToneExtractor,

	// Scene-dependent
	tensionExtractor,
];
