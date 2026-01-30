/**
 * Persona Defaults Merger
 *
 * Merges persona defaults (outfit, profile) into the initial snapshot.
 * Similar to card extension merger, but for the user character.
 */

import type { Snapshot } from '../types/snapshot';
import type { CharacterOutfit } from '../types/common';
import { OUTFIT_SLOTS } from '../types/common';
import type { PersonaDefaults } from '../../ui/cardDefaultsModal';
import type { BTOutfitExtension, BTProfileExtension } from './types';
import { resolveCharacterName } from './nameResolver';
import { debugLog, debugWarn } from '../../utils/debug';

/**
 * Merge persona defaults into an initial snapshot.
 * This should be called after initial extraction completes.
 *
 * @param snapshot - The extracted initial snapshot
 * @param personaDefaults - The persona defaults from extension settings
 * @param personaName - The persona name (for matching)
 * @returns A new snapshot with persona data merged in
 */
export async function mergePersonaDefaultsIntoSnapshot(
	snapshot: Snapshot,
	personaDefaults: PersonaDefaults,
	personaName: string,
): Promise<Snapshot> {
	// Check if any defaults are enabled
	const hasOutfit = personaDefaults.outfit?.enabled;
	const hasProfile = personaDefaults.profile?.enabled;

	if (!hasOutfit && !hasProfile) {
		return snapshot;
	}

	// Deep clone the snapshot to avoid mutation
	let result = cloneSnapshotForMerge(snapshot);

	// Merge outfit (for user persona)
	if (hasOutfit && personaDefaults.outfit) {
		result = await mergePersonaOutfit(result, personaDefaults.outfit, personaName);
	}

	// Merge profile (for user persona)
	if (hasProfile && personaDefaults.profile) {
		result = await mergePersonaProfile(result, personaDefaults.profile, personaName);
	}

	return result;
}

/**
 * Merge persona outfit into snapshot.
 */
async function mergePersonaOutfit(
	snapshot: Snapshot,
	outfit: BTOutfitExtension,
	personaName: string,
): Promise<Snapshot> {
	const availableNames = Object.keys(snapshot.characters);

	// Try to resolve the persona name to a character in the snapshot
	const resolution = await resolveCharacterName(
		personaName,
		availableNames,
		'persona outfit',
	);

	if (resolution.skipped || !resolution.matchedName) {
		debugLog(
			`Skipping persona outfit merge for "${personaName}" (user skipped or no match)`,
		);
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
 */
function mergeOutfitValues(
	existing: CharacterOutfit,
	extension: BTOutfitExtension,
): CharacterOutfit {
	const result = { ...existing };

	for (const slot of OUTFIT_SLOTS) {
		const extValue = extension[slot];
		if (extValue !== undefined) {
			result[slot] = extValue;
		}
	}

	return result;
}

/**
 * Merge persona profile into snapshot.
 */
async function mergePersonaProfile(
	snapshot: Snapshot,
	profile: BTProfileExtension,
	personaName: string,
): Promise<Snapshot> {
	const availableNames = Object.keys(snapshot.characters);

	// Try to resolve the persona name to a character in the snapshot
	const resolution = await resolveCharacterName(
		personaName,
		availableNames,
		'persona profile',
	);

	if (resolution.skipped || !resolution.matchedName) {
		debugLog(
			`Skipping persona profile merge for "${personaName}" (user skipped or no match)`,
		);
		return snapshot;
	}

	const matchingCharacterKey = resolution.matchedName;
	const existingChar = snapshot.characters[matchingCharacterKey];

	if (!existingChar) {
		debugWarn(`Character "${matchingCharacterKey}" not found in snapshot`);
		return snapshot;
	}

	// If no existing profile, cannot merge partial data
	const existingProfile = existingChar.profile;
	if (!existingProfile) {
		debugLog(`Skipping persona profile merge - no existing profile to merge into`);
		return snapshot;
	}

	// Build merged profile
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
