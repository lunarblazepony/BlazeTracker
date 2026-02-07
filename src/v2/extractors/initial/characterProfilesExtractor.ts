/**
 * Initial Character Profiles Extractor
 *
 * Extracts condensed profiles (sex, species, age, appearance tags, personality tags)
 * for characters present in the opening messages of a roleplay.
 */

import type { Generator } from '../../generator';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import type { Snapshot, CharacterState } from '../../types/snapshot';
import type { ExtractedCharacterProfile } from '../../types/extraction';
import { initialCharacterProfilesPrompt } from '../../prompts/initial/characterProfilesPrompt';
import {
	formatMessages,
	getCharacterDescription,
	getUserDescription,
	generateAndParse,
	findMatchingCharacterKey,
	getExtractorTemperature,
	limitMessageRange,
	getMaxMessages,
} from '../utils';
import { buildPrompt } from '../../prompts';
import { debugWarn } from '../../../utils/debug';
import { getWorldinfoForCharacter } from '../../utils/worldinfo';
import { computeAkas } from '../utils/akaComputation';

/**
 * Initial character profiles extractor.
 * Extracts a condensed profile for each character present in the scene.
 * Runs once per character after characters have been identified.
 */
export const initialCharacterProfilesExtractor: InitialExtractor<ExtractedCharacterProfile> = {
	name: 'initialCharacterProfiles',
	displayName: 'profiles',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: initialCharacterProfilesPrompt,

	shouldRun(settings: ExtractionSettings, context: ExtractionContext): boolean {
		// Must have character tracking enabled
		if (!settings.track.characters) {
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
		// Check if we have characters from partialSnapshot
		const characters = partialSnapshot.characters;
		if (!characters || Object.keys(characters).length === 0) {
			return {};
		}

		const characterNames = Object.keys(characters);

		// Deep clone existing characters to avoid mutation
		const updatedCharacters: Record<string, CharacterState> = {};
		for (const [name, char] of Object.entries(characters)) {
			updatedCharacters[name] = {
				...char,
				mood: [...char.mood],
				physicalState: [...char.physicalState],
				outfit: { ...char.outfit },
				akas: [...(char.akas ?? [])],
			};
		}

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		// Calculate message range with limiting (shared across all characters)
		let messageStart = 0;
		let messageEnd = context.chat.length - 1;
		const maxMessages = getMaxMessages(settings, this.name);
		({ messageStart, messageEnd } = limitMessageRange(
			messageStart,
			messageEnd,
			maxMessages,
		));

		// Get messages for worldinfo matching (shared across all characters)
		const messagesForWorldinfo: string[] = [];
		for (let i = messageStart; i <= messageEnd && i < context.chat.length; i++) {
			const msg = context.chat[i];
			if (!msg.is_system) {
				messagesForWorldinfo.push(msg.mes);
			}
		}

		// Extract profile for each character
		for (const characterName of characterNames) {
			// Fetch worldinfo for this character if enabled
			let worldinfo = '';
			if (settings.includeWorldinfo) {
				worldinfo = await getWorldinfoForCharacter(
					messagesForWorldinfo,
					characterName,
				);
			}

			// Build placeholder values for this character
			const placeholders: Record<string, string> = {
				messages: formatMessages(context, messageStart, messageEnd),
				characterName: context.name2,
				characterDescription: getCharacterDescription(context),
				userDescription: getUserDescription(context),
				targetCharacterForProfile: characterName,
				worldinfo: worldinfo || 'No worldinfo available',
			};

			// Build the prompt
			const builtPrompt = buildPrompt(
				initialCharacterProfilesPrompt,
				placeholders,
				settings.customPrompts,
			);

			// Generate and parse
			const result = await generateAndParse<ExtractedCharacterProfile>(
				generator,
				initialCharacterProfilesPrompt,
				builtPrompt,
				temperature,
				{ abortSignal },
			);

			if (!result.success || !result.data) {
				debugWarn(
					`initialCharacterProfiles extraction failed for ${characterName}:`,
					result.error,
				);
				continue;
			}

			const extracted = result.data;

			// Find matching character (case-insensitive with fuzzy fallback)
			const matchingKey = findMatchingCharacterKey(
				extracted.character,
				Object.keys(updatedCharacters),
			);

			if (!matchingKey) {
				debugWarn(
					`Character "${extracted.character}" from profile extraction not found in present characters`,
				);
				continue;
			}

			// Merge profile into character state
			const char = updatedCharacters[matchingKey];
			char.profile = {
				sex: extracted.profile.sex,
				species: extracted.profile.species,
				age: extracted.profile.age,
				appearance: [...extracted.profile.appearance],
				personality: [...extracted.profile.personality],
			};

			// Compute AKAs from extracted name, nicknames, and name parts
			const fullName =
				extracted.character !== matchingKey ? extracted.character : null;
			const nicknames = extracted.profile.nicknames ?? [];
			const akas = computeAkas(matchingKey, fullName, nicknames, characterNames);
			if (akas.length > 0) {
				// Merge with existing AKAs (case-insensitive dedup)
				const existing = new Set(
					(char.akas ?? []).map(a => a.toLowerCase()),
				);
				const merged = [...(char.akas ?? [])];
				for (const aka of akas) {
					if (!existing.has(aka.toLowerCase())) {
						merged.push(aka);
						existing.add(aka.toLowerCase());
					}
				}
				char.akas = merged;
			}
		}

		return { characters: updatedCharacters };
	},
};
