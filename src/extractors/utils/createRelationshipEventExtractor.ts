// ============================================
// Relationship Event Extractor Factory
// ============================================
//
// Creates extractor functions for relationship attributes (feelings, secrets, wants).
// These extractors share 95% identical code - the factory reduces duplication.

import { getSettings, getTemperature } from '../../settings';
import { getPromptParts } from '../../prompts';
import type { PromptKey } from '../../prompts/types';
import { makeGeneratorRequest, buildExtractionMessages } from '../../utils/generator';
import { parseJsonResponse, isObject } from '../../utils/json';
import type { DirectionalRelationshipEvent, ProjectedRelationship } from '../../types/state';
import { generateUUID } from '../../state/eventStore';

// ============================================
// Types
// ============================================

type RelationshipField = 'feelings' | 'secrets' | 'wants';

type FieldSubkinds = {
	feelings: 'feeling_added' | 'feeling_removed';
	secrets: 'secret_added' | 'secret_removed';
	wants: 'want_added' | 'want_removed';
};

interface RelationshipEventRaw {
	subkind: string;
	fromCharacter: string;
	towardCharacter: string;
	value: string;
}

interface ExtractorConfig {
	/** The relationship field this extractor handles */
	field: RelationshipField;
	/** The prompt key to use (e.g., 'relationship_feelings') */
	promptKey: PromptKey;
	/** Module name for error messages */
	moduleName: string;
	/** Temperature key for settings (defaults to promptKey) */
	temperatureKey?: string;
}

// ============================================
// Subkind Mapping
// ============================================

const FIELD_SUBKINDS: Record<RelationshipField, [string, string]> = {
	feelings: ['feeling_added', 'feeling_removed'],
	secrets: ['secret_added', 'secret_removed'],
	wants: ['want_added', 'want_removed'],
};

// ============================================
// Factory Function
// ============================================

/**
 * Creates a relationship event extractor function.
 *
 * @param config - Configuration for the extractor
 * @returns An async function that extracts relationship events
 */
export function createRelationshipEventExtractor(config: ExtractorConfig) {
	const { field, promptKey, moduleName, temperatureKey = promptKey } = config;
	const [addedSubkind, removedSubkind] = FIELD_SUBKINDS[field];

	return async function extractRelationshipAttribute(
		messages: string,
		relationship: ProjectedRelationship,
		messageId: number,
		swipeId: number,
		abortSignal?: AbortSignal,
	): Promise<DirectionalRelationshipEvent[]> {
		const settings = getSettings();

		// Build natural format: { "CharA": { toward: "CharB", [field]: [...] }, ... }
		const [charA, charB] = relationship.pair;
		const previousStateStr = JSON.stringify(
			{
				pair: relationship.pair,
				attitudes: {
					[charA]: {
						toward: charB,
						[field]: relationship.aToB[field],
					},
					[charB]: {
						toward: charA,
						[field]: relationship.bToA[field],
					},
				},
			},
			null,
			2,
		);

		const promptParts = getPromptParts(promptKey);
		const userPrompt = promptParts.user
			.replace('{{previousState}}', previousStateStr)
			.replace('{{messages}}', messages);

		const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

		const response = await makeGeneratorRequest(llmMessages, {
			profileId: settings.profileId,
			maxTokens: settings.maxResponseTokens,
			temperature: getTemperature(temperatureKey),
			abortSignal,
		});

		const parsed = parseJsonResponse(response, {
			shape: 'object',
			moduleName,
		});

		return validateAndConvertEvents(
			parsed,
			messageId,
			swipeId,
			addedSubkind,
			removedSubkind,
			moduleName,
		);
	};
}

// ============================================
// Validation
// ============================================

function validateAndConvertEvents(
	data: unknown,
	messageId: number,
	swipeId: number,
	addedSubkind: string,
	removedSubkind: string,
	moduleName: string,
): DirectionalRelationshipEvent[] {
	if (!isObject(data)) {
		throw new Error(`Invalid ${moduleName} response: expected object`);
	}

	const events = (data as Record<string, unknown>).events;
	if (!Array.isArray(events)) {
		return [];
	}

	const timestamp = Date.now();

	return events
		.filter((e): e is RelationshipEventRaw => {
			if (!isObject(e)) return false;
			if (typeof e.fromCharacter !== 'string') return false;
			if (typeof e.towardCharacter !== 'string') return false;
			if (e.subkind !== addedSubkind && e.subkind !== removedSubkind)
				return false;
			if (typeof e.value !== 'string' || !e.value.trim()) return false;
			return true;
		})
		.map(
			(e): DirectionalRelationshipEvent => ({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'relationship',
				subkind: e.subkind as FieldSubkinds[RelationshipField],
				fromCharacter: e.fromCharacter,
				towardCharacter: e.towardCharacter,
				value: e.value.trim(),
			}),
		);
}

// ============================================
// Pre-configured Extractors
// ============================================

/**
 * Analyzes feeling changes between a pair of characters.
 * Returns DirectionalRelationshipEvent[] with subkind 'feeling_added' or 'feeling_removed'.
 */
export const extractRelationshipFeelings = createRelationshipEventExtractor({
	field: 'feelings',
	promptKey: 'relationship_feelings',
	moduleName: 'BlazeTracker/RelationshipFeelings',
});

/**
 * Analyzes secret changes between a pair of characters.
 * Returns DirectionalRelationshipEvent[] with subkind 'secret_added' or 'secret_removed'.
 */
export const extractRelationshipSecrets = createRelationshipEventExtractor({
	field: 'secrets',
	promptKey: 'relationship_secrets',
	moduleName: 'BlazeTracker/RelationshipSecrets',
});

/**
 * Analyzes want changes between a pair of characters.
 * Returns DirectionalRelationshipEvent[] with subkind 'want_added' or 'want_removed'.
 */
export const extractRelationshipWants = createRelationshipEventExtractor({
	field: 'wants',
	promptKey: 'relationship_wants',
	moduleName: 'BlazeTracker/RelationshipWants',
});
