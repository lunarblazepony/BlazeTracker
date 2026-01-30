/**
 * Initial Relationships Extractor
 *
 * Extracts the initial relationship states between characters from the opening messages of a roleplay.
 */

import type { Generator } from '../../generator';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import type { Snapshot, RelationshipState, RelationshipAttitude } from '../../types/snapshot';
import type { ExtractedInitialRelationships } from '../../types/extraction';
import { sortPair, getRelationshipKey } from '../../types/snapshot';
import { initialRelationshipsPrompt } from '../../prompts/initial/relationshipsPrompt';
import {
	formatMessages,
	getCharacterDescription,
	generateAndParse,
	buildNameLookup,
	findNameInLookup,
	getExtractorTemperature,
} from '../utils';
import { buildPrompt } from '../../prompts';
import { debugWarn } from '../../../utils/debug';

/**
 * Initial relationships extractor.
 * Extracts the initial relationship states between characters.
 */
export const initialRelationshipsExtractor: InitialExtractor<ExtractedInitialRelationships> = {
	name: 'initialRelationships',
	displayName: 'relationships',
	category: 'relationships',
	defaultTemperature: 0.6,
	prompt: initialRelationshipsPrompt,

	shouldRun(settings: ExtractionSettings, context: ExtractionContext): boolean {
		// Must have relationships tracking enabled
		if (!settings.track.relationships) {
			return false;
		}

		// Must have at least one message
		if (context.chat.length === 0) {
			return false;
		}

		return true;
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Check if we have at least 2 characters from partialSnapshot
		const characters = partialSnapshot.characters;
		if (!characters || Object.keys(characters).length < 2) {
			return {};
		}

		// Generate all character pairs from known character names
		const charNames = Object.keys(characters);
		const knownPairs: Array<[string, string]> = [];
		for (let i = 0; i < charNames.length; i++) {
			for (let j = i + 1; j < charNames.length; j++) {
				// Sort alphabetically
				const [a, b] = sortPair(charNames[i], charNames[j]);
				knownPairs.push([a, b]);
			}
		}

		if (knownPairs.length === 0) {
			return {};
		}

		// Format pairs for the prompt
		const pairsText = knownPairs.map(([a, b]) => `- ${a} and ${b}`).join('\n');

		// Build placeholder values
		const placeholders: Record<string, string> = {
			messages: formatMessages(context, 0, context.chat.length - 1),
			characterName: context.name2,
			characterDescription: getCharacterDescription(context),
			characterPairs: pairsText,
		};

		// Build the prompt
		const builtPrompt = buildPrompt(
			initialRelationshipsPrompt,
			placeholders,
			settings.customPrompts,
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'relationships',
			this.defaultTemperature,
		);

		// Generate and parse
		const result = await generateAndParse<ExtractedInitialRelationships>(
			generator,
			initialRelationshipsPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		if (!result.success || !result.data) {
			return {};
		}

		const extracted = result.data;

		// Build relationships map using OUR known names, not the LLM's
		const relationships: Record<string, RelationshipState> = {};

		// Create a lookup map from lowercase names to actual names
		const nameLookup = buildNameLookup(charNames);

		for (const rel of extracted.relationships) {
			// Try to match the LLM's names to our known names (with fuzzy fallback)
			const actualName1 = findNameInLookup(rel.pair[0], nameLookup, charNames);
			const actualName2 = findNameInLookup(rel.pair[1], nameLookup, charNames);

			// If we can't match both names, skip this relationship
			if (!actualName1 || !actualName2) {
				debugWarn(
					`Could not match relationship pair: ${rel.pair[0]}, ${rel.pair[1]}`,
				);
				continue;
			}

			// Normalize pair order with sortPair using OUR names
			const [a, b] = sortPair(actualName1, actualName2);

			// Determine if we need to swap aToB and bToA based on sorting
			// Compare against the LLM's original order
			const llmFirst = rel.pair[0].toLowerCase();
			const swapped = llmFirst !== a.toLowerCase();

			// Build attitudes
			const aToB: RelationshipAttitude = swapped
				? {
						feelings: [...rel.bToA.feelings],
						secrets: [...rel.bToA.secrets],
						wants: [...rel.bToA.wants],
					}
				: {
						feelings: [...rel.aToB.feelings],
						secrets: [...rel.aToB.secrets],
						wants: [...rel.aToB.wants],
					};

			const bToA: RelationshipAttitude = swapped
				? {
						feelings: [...rel.aToB.feelings],
						secrets: [...rel.aToB.secrets],
						wants: [...rel.aToB.wants],
					}
				: {
						feelings: [...rel.bToA.feelings],
						secrets: [...rel.bToA.secrets],
						wants: [...rel.bToA.wants],
					};

			// Build relationship state using OUR names
			const state: RelationshipState = {
				pair: [a, b],
				status: rel.status,
				aToB,
				bToA,
			};

			// Get key and store
			const key = getRelationshipKey([a, b]);
			relationships[key] = state;
		}

		return { relationships };
	},
};
