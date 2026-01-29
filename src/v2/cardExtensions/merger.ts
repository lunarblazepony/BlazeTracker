/**
 * Card Extension Merger
 *
 * Merges card extension data into the initial snapshot.
 * Card data takes precedence over LLM-extracted data for enabled sections.
 *
 * Key Principle: Only replace INITIAL extractions.
 * - User's outfit: comes from extraction
 * - Other characters' outfits: come from extraction
 * - Undefined relationship pairs: come from extraction
 */

import moment from 'moment';
import type { Snapshot, RelationshipState, RelationshipAttitude } from '../types/snapshot';
import type { LocationState, CharacterOutfit } from '../types/common';
import { createEmptyRelationshipState, getRelationshipKey, sortPair } from '../types/snapshot';
import { serializeMoment, isValidLocationType, OUTFIT_SLOTS } from '../types/common';
import type {
	CardExtensions,
	BTLocationExtension,
	BTTimeExtension,
	BTOutfitExtension,
	BTProfileExtension,
	BTRelationshipsExtension,
	BTRelationshipExtension,
	BTAttitudeExtension,
} from './types';
import { hasEnabledExtensions } from './types';
import { resolveCharacterName } from './nameResolver';
import { debugLog, debugWarn } from '../../utils/debug';

/**
 * Context for merging (names for matching).
 */
export interface MergeContext {
	/** The character name (resolved from {{char}}) */
	characterName: string;
	/** The user name (resolved from {{user}}) */
	userName: string;
}

/**
 * Merge card extensions into an initial snapshot.
 * This should be called after initial extraction completes.
 *
 * @param snapshot - The extracted initial snapshot
 * @param extensions - The card extensions (already resolved)
 * @param context - Merge context with character/user names
 * @returns A new snapshot with card data merged in
 */
export async function mergeCardExtensionsIntoSnapshot(
	snapshot: Snapshot,
	extensions: CardExtensions,
	context: MergeContext,
): Promise<Snapshot> {
	// If no extensions are enabled, return unchanged
	if (!hasEnabledExtensions(extensions)) {
		return snapshot;
	}

	// Deep clone the snapshot to avoid mutation
	let result = cloneSnapshotForMerge(snapshot);

	// Merge location (synchronous - no name matching needed)
	if (extensions.location?.enabled) {
		result = mergeLocation(result, extensions.location);
	}

	// Merge time (synchronous - no name matching needed)
	if (extensions.time?.enabled) {
		result = mergeTime(result, extensions.time);
	}

	// Merge outfit (for {{char}} only) - async for user intervention
	if (extensions.outfit?.enabled) {
		result = await mergeOutfit(result, extensions.outfit, context.characterName);
	}

	// Merge profile (for {{char}} only) - async for user intervention
	if (extensions.profile?.enabled) {
		result = await mergeProfile(result, extensions.profile, context.characterName);
	}

	// Merge relationships - async for user intervention
	if (extensions.relationships && extensions.relationships.length > 0) {
		result = await mergeRelationships(result, extensions.relationships, context);
	}

	return result;
}

// ============================================
// Location Merging
// ============================================

/**
 * Merge location extension into snapshot.
 */
function mergeLocation(snapshot: Snapshot, location: BTLocationExtension): Snapshot {
	const newLocation: LocationState = {
		area: location.area ?? snapshot.location?.area ?? '',
		place: location.place ?? snapshot.location?.place ?? '',
		position: location.position ?? snapshot.location?.position ?? '',
		props: snapshot.location?.props ?? [],
		locationType:
			location.locationType && isValidLocationType(location.locationType)
				? location.locationType
				: (snapshot.location?.locationType ?? 'outdoor'),
	};

	return {
		...snapshot,
		location: newLocation,
	};
}

// ============================================
// Time Merging
// ============================================

/**
 * Merge time extension into snapshot.
 */
function mergeTime(snapshot: Snapshot, time: BTTimeExtension): Snapshot {
	if (!time.datetime) {
		return snapshot;
	}

	// Parse the datetime and serialize it
	const parsed = moment(time.datetime);
	if (!parsed.isValid()) {
		debugWarn('Invalid datetime in card extension:', time.datetime);
		return snapshot;
	}

	return {
		...snapshot,
		time: serializeMoment(parsed),
	};
}

// ============================================
// Outfit Merging
// ============================================

/**
 * Merge outfit extension into snapshot.
 * Only affects the character matching {{char}}.
 * Shows popup if automatic matching fails.
 */
async function mergeOutfit(
	snapshot: Snapshot,
	outfit: BTOutfitExtension,
	characterName: string,
): Promise<Snapshot> {
	const availableNames = Object.keys(snapshot.characters);

	// Try to resolve the character name (may show popup)
	const resolution = await resolveCharacterName(characterName, availableNames, 'outfit');

	if (resolution.skipped || !resolution.matchedName) {
		debugLog(`Skipping outfit merge for "${characterName}" (user skipped or no match)`);
		return snapshot;
	}

	const matchingCharacterKey = resolution.matchedName;
	const existingChar = snapshot.characters[matchingCharacterKey];

	if (!existingChar) {
		debugWarn(`Character "${matchingCharacterKey}" not found in snapshot`);
		return snapshot;
	}

	const newOutfit = mergeOutfitValues(existingChar.outfit, outfit);

	return {
		...snapshot,
		characters: {
			...snapshot.characters,
			[matchingCharacterKey]: {
				...existingChar,
				outfit: newOutfit,
			},
		},
	};
}

/**
 * Merge outfit extension values into existing outfit.
 * undefined in extension = keep extraction value
 * null in extension = explicitly empty
 * string in extension = use that value
 */
function mergeOutfitValues(
	existing: CharacterOutfit,
	extension: BTOutfitExtension,
): CharacterOutfit {
	const result = { ...existing };

	for (const slot of OUTFIT_SLOTS) {
		const extValue = extension[slot];
		if (extValue !== undefined) {
			// Extension has a value (could be null or string)
			result[slot] = extValue;
		}
		// If undefined, keep the existing extracted value
	}

	return result;
}

// ============================================
// Profile Merging
// ============================================

/**
 * Merge profile extension into snapshot.
 * Only affects the character matching {{char}}.
 * Shows popup if automatic matching fails.
 */
async function mergeProfile(
	snapshot: Snapshot,
	profile: BTProfileExtension,
	characterName: string,
): Promise<Snapshot> {
	const availableNames = Object.keys(snapshot.characters);

	// Try to resolve the character name (may show popup)
	const resolution = await resolveCharacterName(characterName, availableNames, 'profile');

	if (resolution.skipped || !resolution.matchedName) {
		debugLog(
			`Skipping profile merge for "${characterName}" (user skipped or no match)`,
		);
		return snapshot;
	}

	const matchingCharacterKey = resolution.matchedName;
	const existingChar = snapshot.characters[matchingCharacterKey];

	if (!existingChar) {
		debugWarn(`Character "${matchingCharacterKey}" not found in snapshot`);
		return snapshot;
	}

	// If no existing profile and extension doesn't provide all required fields, skip
	const existingProfile = existingChar.profile;
	if (!existingProfile) {
		// Cannot create a profile from partial extension data
		// Profile needs to come from extraction first, extension just overrides
		debugLog('Skipping profile merge - no existing profile to merge into');
		return snapshot;
	}

	// Build merged profile - extension values override extraction
	const newProfile = {
		sex: profile.sex !== undefined ? profile.sex : existingProfile.sex,
		species: profile.species !== undefined ? profile.species : existingProfile.species,
		age: profile.age !== undefined ? profile.age : existingProfile.age,
		appearance:
			profile.appearance !== undefined && profile.appearance.length > 0
				? [...profile.appearance]
				: [...existingProfile.appearance],
		personality:
			profile.personality !== undefined && profile.personality.length > 0
				? [...profile.personality]
				: [...existingProfile.personality],
	};

	return {
		...snapshot,
		characters: {
			...snapshot.characters,
			[matchingCharacterKey]: {
				...existingChar,
				profile: newProfile,
			},
		},
	};
}

// ============================================
// Relationship Merging
// ============================================

/**
 * Merge relationships extensions into snapshot.
 * Only affects pairs that are explicitly defined in extensions.
 * Shows popup if automatic matching fails.
 */
async function mergeRelationships(
	snapshot: Snapshot,
	relationships: BTRelationshipsExtension,
	context: MergeContext,
): Promise<Snapshot> {
	const newRelationships = { ...snapshot.relationships };

	// Available names include characters in scene plus user name
	const availableNames = [...Object.keys(snapshot.characters), context.userName];

	for (const rel of relationships) {
		// Resolve the target (should already be resolved, but be safe)
		const resolvedTarget = rel.target;

		// Find matching character name in snapshot (for {{char}})
		const charResolution = await resolveCharacterName(
			context.characterName,
			Object.keys(snapshot.characters),
			'relationship (character)',
		);

		if (charResolution.skipped || !charResolution.matchedName) {
			debugLog(
				`Skipping relationship for "${context.characterName}" (user skipped)`,
			);
			continue;
		}

		// Find matching character name for target
		const targetResolution = await resolveCharacterName(
			resolvedTarget,
			availableNames,
			'relationship (target)',
		);

		if (targetResolution.skipped || !targetResolution.matchedName) {
			debugLog(`Skipping relationship target "${resolvedTarget}" (user skipped)`);
			continue;
		}

		const charName = charResolution.matchedName;
		const targetName = targetResolution.matchedName;

		// Create sorted pair and key
		const pair = sortPair(charName, targetName);
		const key = getRelationshipKey(pair);

		// Get or create relationship state
		const existing = newRelationships[key] ?? createEmptyRelationshipState(pair);
		const merged = mergeRelationshipState(existing, rel, charName, targetName);

		newRelationships[key] = merged;
	}

	return {
		...snapshot,
		relationships: newRelationships,
	};
}

/**
 * Merge a single relationship extension into existing state.
 */
function mergeRelationshipState(
	existing: RelationshipState,
	rel: BTRelationshipExtension,
	charName: string,
	_targetName: string,
): RelationshipState {
	const result = { ...existing };

	// Merge status
	if (rel.status) {
		result.status = rel.status;
	}

	// Determine which direction is aToB vs bToA based on sorted pair
	const [a] = result.pair;
	const charIsA = a === charName;

	// Merge attitudes in the correct direction
	if (rel.charToTarget) {
		if (charIsA) {
			result.aToB = mergeAttitude(result.aToB, rel.charToTarget);
		} else {
			result.bToA = mergeAttitude(result.bToA, rel.charToTarget);
		}
	}

	if (rel.targetToChar) {
		if (charIsA) {
			result.bToA = mergeAttitude(result.bToA, rel.targetToChar);
		} else {
			result.aToB = mergeAttitude(result.aToB, rel.targetToChar);
		}
	}

	// Note: Milestones are handled by subjects/events, not stored in RelationshipState
	// The milestones in the extension are for status gating - they would need to be
	// converted to RelationshipSubjectEvents during event generation, not snapshot merging

	return result;
}

/**
 * Merge attitude extension into existing attitude.
 * Extension values replace existing values (not additive).
 */
function mergeAttitude(
	existing: RelationshipAttitude,
	extension: BTAttitudeExtension,
): RelationshipAttitude {
	return {
		feelings:
			extension.feelings && extension.feelings.length > 0
				? [...extension.feelings]
				: [...existing.feelings],
		secrets:
			extension.secrets && extension.secrets.length > 0
				? [...extension.secrets]
				: [...existing.secrets],
		wants:
			extension.wants && extension.wants.length > 0
				? [...extension.wants]
				: [...existing.wants],
	};
}

// ============================================
// Utility Functions
// ============================================

/**
 * Deep clone a snapshot for merging.
 */
function cloneSnapshotForMerge(snapshot: Snapshot): Snapshot {
	return {
		...snapshot,
		source: { ...snapshot.source },
		time: snapshot.time,
		location: snapshot.location
			? { ...snapshot.location, props: [...snapshot.location.props] }
			: null,
		forecasts: snapshot.forecasts
			? Object.fromEntries(
					Object.entries(snapshot.forecasts).map(
						([areaName, forecast]) => [
							areaName,
							{
								...forecast,
								days: forecast.days.map(d => ({
									...d,
									hourly: [...d.hourly],
								})),
							},
						],
					),
				)
			: {},
		climate: snapshot.climate ? { ...snapshot.climate } : null,
		scene: snapshot.scene
			? {
					...snapshot.scene,
					tension: { ...snapshot.scene.tension },
				}
			: null,
		characters: Object.fromEntries(
			Object.entries(snapshot.characters).map(([name, char]) => [
				name,
				{
					...char,
					mood: [...char.mood],
					physicalState: [...char.physicalState],
					outfit: { ...char.outfit },
				},
			]),
		),
		relationships: Object.fromEntries(
			Object.entries(snapshot.relationships).map(([key, rel]) => [
				key,
				{
					...rel,
					aToB: {
						feelings: [...rel.aToB.feelings],
						secrets: [...rel.aToB.secrets],
						wants: [...rel.aToB.wants],
					},
					bToA: {
						feelings: [...rel.bToA.feelings],
						secrets: [...rel.bToA.secrets],
						wants: [...rel.bToA.wants],
					},
				},
			]),
		),
		narrativeEvents: (snapshot.narrativeEvents || []).map(e => ({
			...e,
			source: { ...e.source },
			witnesses: [...e.witnesses],
			tension: { ...e.tension },
			subjects: e.subjects.map(s => ({
				...s,
				pair: [...s.pair] as [string, string],
			})),
		})),
	};
}
