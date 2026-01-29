/**
 * Build prompts by extracting context values and filling placeholders.
 */

import type { ExtractionContext, ExtractionSettings } from '../types';
import type { Projection, Event, CharacterOutfitChangedEvent, CharacterState } from '../../types';
import type { PromptTemplate, BuiltPrompt } from '../../prompts';
import { buildPrompt as fillPrompt } from '../../prompts';

/**
 * Format messages for prompt inclusion.
 */
export function formatMessages(
	context: ExtractionContext,
	startIndex: number,
	endIndex: number,
): string {
	const messages: string[] = [];
	for (let i = startIndex; i <= endIndex && i < context.chat.length; i++) {
		const msg = context.chat[i];
		if (msg.is_system) continue;
		messages.push(`${msg.name}: ${msg.mes}`);
	}
	return messages.join('\n\n');
}

/**
 * Get character description from context.
 */
export function getCharacterDescription(context: ExtractionContext): string {
	const char = context.characters[context.characterId];
	if (!char) return '';

	const parts: string[] = [];
	if (char.description) parts.push(char.description);
	if (char.personality) parts.push(`Personality: ${char.personality}`);
	if (char.scenario) parts.push(`Scenario: ${char.scenario}`);
	return parts.join('\n\n');
}

/**
 * Get user description from context.
 */
export function getUserDescription(context: ExtractionContext): string {
	return context.persona || '';
}

/**
 * Format location for prompt.
 */
export function formatLocation(projection: Projection): string {
	if (!projection.location) return 'Unknown';
	const parts: string[] = [];
	if (projection.location.area) parts.push(projection.location.area);
	if (projection.location.place) parts.push(projection.location.place);
	if (projection.location.position) parts.push(projection.location.position);
	return parts.join(' - ') || 'Unknown';
}

/**
 * Format time for prompt.
 */
export function formatTime(projection: Projection): string {
	if (!projection.time) return 'Unknown';
	return projection.time.format('dddd, MMMM D, YYYY [at] h:mm A');
}

/**
 * Format characters present for prompt.
 */
export function formatCharactersPresent(projection: Projection): string {
	const names = projection.charactersPresent;
	return names.length > 0 ? names.join(', ') : 'None';
}

/**
 * Format character state for prompt.
 */
export function formatCharacterState(projection: Projection, characterName: string): string {
	const char = projection.characters[characterName];
	if (!char) return 'Unknown';

	const lines: string[] = [];
	if (char.position) lines.push(`Position: ${char.position}`);
	if (char.activity) lines.push(`Activity: ${char.activity}`);
	if (char.mood.length > 0) lines.push(`Mood: ${char.mood.join(', ')}`);
	if (char.physicalState.length > 0)
		lines.push(`Physical State: ${char.physicalState.join(', ')}`);

	// Format outfit
	const outfitParts: string[] = [];
	for (const [slot, item] of Object.entries(char.outfit)) {
		if (item) outfitParts.push(`${slot}: ${item}`);
	}
	if (outfitParts.length > 0) lines.push(`Outfit: ${outfitParts.join(', ')}`);

	return lines.join('\n') || 'No state information';
}

/**
 * Format characters summary for prompt.
 */
export function formatCharactersSummary(projection: Projection): string {
	const summaries: string[] = [];
	for (const name of projection.charactersPresent) {
		const char = projection.characters[name];
		if (!char) continue;
		const parts: string[] = [`${name}:`];
		if (char.position) parts.push(`Position: ${char.position}`);
		if (char.mood.length > 0) parts.push(`Mood: ${char.mood.join(', ')}`);
		summaries.push(parts.join(' | '));
	}
	return summaries.join('\n') || 'No characters present';
}

/**
 * Format relationship pair for prompt.
 */
export function formatRelationshipPair(pair: [string, string]): string {
	return `${pair[0]} and ${pair[1]}`;
}

/**
 * Format a single character's profile for prompt inclusion.
 * Returns format: "Name (Sex, Species, Age): Appearance: tag1, tag2 | Personality: tag1, tag2"
 */
export function formatCharacterProfile(char: CharacterState): string {
	if (!char.profile) return `${char.name} (unknown profile)`;
	const { sex, species, age, appearance, personality } = char.profile;
	return `${char.name} (${sex}, ${species}, ${age}): Appearance: ${appearance.join(', ')} | Personality: ${personality.join(', ')}`;
}

/**
 * Format all present characters' profiles for prompt inclusion.
 */
export function formatCharacterProfiles(projection: Projection): string {
	const profiles: string[] = [];
	for (const name of projection.charactersPresent) {
		const char = projection.characters[name];
		if (char) {
			profiles.push(formatCharacterProfile(char));
		}
	}
	return profiles.length > 0 ? profiles.join('\n') : 'No character profiles available';
}

/**
 * Format profiles for a relationship pair.
 */
export function formatRelationshipProfiles(projection: Projection, pair: [string, string]): string {
	const profiles: string[] = [];
	for (const name of pair) {
		const char = projection.characters[name];
		if (char) {
			profiles.push(formatCharacterProfile(char));
		}
	}
	return profiles.length > 0 ? profiles.join('\n') : 'No character profiles available';
}

/**
 * Format relationship state for prompt.
 */
export function formatRelationshipState(projection: Projection, pair: [string, string]): string {
	const key = pair.join('|');
	const rel = projection.relationships[key];
	if (!rel) return 'No established relationship';

	const lines: string[] = [`Status: ${rel.status}`];

	lines.push(`${pair[0]} toward ${pair[1]}:`);
	if (rel.aToB.feelings.length > 0) lines.push(`  Feelings: ${rel.aToB.feelings.join(', ')}`);
	if (rel.aToB.secrets.length > 0) lines.push(`  Secrets: ${rel.aToB.secrets.join(', ')}`);
	if (rel.aToB.wants.length > 0) lines.push(`  Wants: ${rel.aToB.wants.join(', ')}`);

	lines.push(`${pair[1]} toward ${pair[0]}:`);
	if (rel.bToA.feelings.length > 0) lines.push(`  Feelings: ${rel.bToA.feelings.join(', ')}`);
	if (rel.bToA.secrets.length > 0) lines.push(`  Secrets: ${rel.bToA.secrets.join(', ')}`);
	if (rel.bToA.wants.length > 0) lines.push(`  Wants: ${rel.bToA.wants.join(', ')}`);

	return lines.join('\n');
}

/**
 * Format tension for prompt.
 */
export function formatTension(projection: Projection): string {
	if (!projection.scene) return 'Unknown';
	return `Level: ${projection.scene.tension.level} | Type: ${projection.scene.tension.type} | Direction: ${projection.scene.tension.direction}`;
}

/**
 * Format character outfits for prompt.
 * Returns a string listing each character and their worn items.
 */
export function formatCharacterOutfits(projection: Projection): string {
	const lines: string[] = [];
	for (const name of projection.charactersPresent) {
		const char = projection.characters[name];
		if (!char) continue;

		const items: string[] = [];
		for (const [_slot, item] of Object.entries(char.outfit)) {
			if (item) items.push(item);
		}

		if (items.length > 0) {
			lines.push(`${name}: ${items.join(', ')}`);
		}
	}
	return lines.length > 0 ? lines.join('\n') : 'None tracked';
}

/**
 * Get all outfit items from a projection as a flat array.
 */
export function getAllOutfitItems(projection: Projection): string[] {
	const items: string[] = [];
	for (const char of Object.values(projection.characters)) {
		for (const item of Object.values(char.outfit)) {
			if (item) items.push(item.toLowerCase());
		}
	}
	return items;
}

/**
 * Filter props that match outfit items (fuzzy match).
 * Returns props that are NOT worn by any character.
 */
export function filterPropsAgainstOutfits(props: string[], outfitItems: string[]): string[] {
	return props.filter(prop => {
		const propLower = prop.toLowerCase();
		// Check if any outfit item matches this prop
		return !outfitItems.some(item => {
			// Fuzzy match: item contains prop, prop contains item, or significant word overlap
			if (item.includes(propLower) || propLower.includes(item)) {
				return true;
			}
			// Check for significant word overlap (3+ char words)
			const propWords = propLower.split(/\s+/).filter(w => w.length >= 3);
			const itemWords = item.split(/\s+/).filter(w => w.length >= 3);
			const overlap = propWords.filter(pw =>
				itemWords.some(iw => pw.includes(iw) || iw.includes(pw)),
			);
			return overlap.length > 0;
		});
	});
}

/**
 * Format outfit changes from turn events.
 * Returns a string showing what each character added/removed.
 */
export function formatOutfitChangesFromEvents(turnEvents: Event[]): string {
	// Group outfit changes by character
	const changesByCharacter: Record<string, { added: string[]; removed: string[] }> = {};

	for (const event of turnEvents) {
		if (event.kind !== 'character' || event.subkind !== 'outfit_changed') continue;
		const outfitEvent = event as CharacterOutfitChangedEvent;
		const char = outfitEvent.character;

		if (!changesByCharacter[char]) {
			changesByCharacter[char] = { added: [], removed: [] };
		}

		if (outfitEvent.newValue) {
			changesByCharacter[char].added.push(outfitEvent.newValue);
		}
		if (outfitEvent.previousValue) {
			changesByCharacter[char].removed.push(outfitEvent.previousValue);
		}
	}

	// Format as string
	const lines: string[] = [];
	for (const [char, changes] of Object.entries(changesByCharacter)) {
		const removedStr = changes.removed.length > 0 ? changes.removed.join(', ') : 'none';
		const addedStr = changes.added.length > 0 ? changes.added.join(', ') : 'none';
		lines.push(`${char}: removed: ${removedStr} | added: ${addedStr}`);
	}

	return lines.length > 0 ? lines.join('\n') : 'None';
}

/**
 * Get items removed from outfits this turn (now potential scene props).
 */
export function getRemovedOutfitItems(turnEvents: Event[]): string[] {
	const removed: string[] = [];
	for (const event of turnEvents) {
		if (event.kind !== 'character' || event.subkind !== 'outfit_changed') continue;
		const outfitEvent = event as CharacterOutfitChangedEvent;
		if (outfitEvent.previousValue) {
			removed.push(outfitEvent.previousValue.toLowerCase());
		}
	}
	return removed;
}

/**
 * Get items added to outfits this turn (now worn, not scene props).
 */
export function getAddedOutfitItems(turnEvents: Event[]): string[] {
	const added: string[] = [];
	for (const event of turnEvents) {
		if (event.kind !== 'character' || event.subkind !== 'outfit_changed') continue;
		const outfitEvent = event as CharacterOutfitChangedEvent;
		if (outfitEvent.newValue) {
			added.push(outfitEvent.newValue.toLowerCase());
		}
	}
	return added;
}

/**
 * Options for building placeholder values.
 */
export interface BuildPlaceholderOptions {
	/** Target character for character-specific extractors */
	targetCharacter?: string;
	/** Relationship pair for relationship extractors */
	relationshipPair?: [string, string];
	/**
	 * Additional placeholder values to merge in.
	 * Use this for extractor-specific values that aren't part of the core set.
	 * These will override any core values with the same key.
	 */
	additionalValues?: Record<string, string>;
}

/**
 * Build placeholder values from context and projection.
 */
export function buildPlaceholderValues(
	context: ExtractionContext,
	projection: Projection,
	messageStart: number,
	messageEnd: number,
	options?: BuildPlaceholderOptions,
): Record<string, string> {
	const values: Record<string, string> = {
		messages: formatMessages(context, messageStart, messageEnd),
		characterName: context.name2,
		characterDescription: getCharacterDescription(context),
		userName: context.name1,
		userDescription: getUserDescription(context),
		currentTime: formatTime(projection),
		currentLocation: formatLocation(projection),
		currentArea: projection.location?.area || 'Unknown',
		currentPlace: projection.location?.place || 'Unknown',
		currentPosition: projection.location?.position || 'Unknown',
		currentProps: projection.location?.props.join(', ') || 'None',
		currentWeather: projection.climate?.conditions || 'Unknown',
		charactersPresent: formatCharactersPresent(projection),
		charactersSummary: formatCharactersSummary(projection),
		characterProfiles: formatCharacterProfiles(projection),
		currentTopic: projection.scene?.topic || 'Unknown',
		currentTone: projection.scene?.tone || 'Unknown',
		currentTension: formatTension(projection),
		characterOutfits: formatCharacterOutfits(projection),
	};

	// Add target character if specified
	if (options?.targetCharacter) {
		values.targetCharacter = options.targetCharacter;
		values.targetCharacterState = formatCharacterState(
			projection,
			options.targetCharacter,
		);
		// Add character profile for this specific character
		const targetChar = projection.characters[options.targetCharacter];
		if (targetChar) {
			values.characterProfile = formatCharacterProfile(targetChar);
		}
	}

	// Add relationship pair if specified
	if (options?.relationshipPair) {
		values.relationshipPair = formatRelationshipPair(options.relationshipPair);
		values.relationshipState = formatRelationshipState(
			projection,
			options.relationshipPair,
		);
		// Add profiles for both characters in the relationship
		values.relationshipProfiles = formatRelationshipProfiles(
			projection,
			options.relationshipPair,
		);
	}

	// Merge additional values (allows extractors to add custom placeholders)
	if (options?.additionalValues) {
		Object.assign(values, options.additionalValues);
	}

	return values;
}

/**
 * Build a prompt with context values filled in.
 */
export function buildExtractorPrompt<T>(
	prompt: PromptTemplate<T>,
	context: ExtractionContext,
	projection: Projection,
	settings: ExtractionSettings,
	messageStart: number,
	messageEnd: number,
	options?: BuildPlaceholderOptions,
): BuiltPrompt {
	const values = buildPlaceholderValues(
		context,
		projection,
		messageStart,
		messageEnd,
		options,
	);
	const overrides = settings.customPrompts;
	return fillPrompt(prompt, values, overrides);
}
