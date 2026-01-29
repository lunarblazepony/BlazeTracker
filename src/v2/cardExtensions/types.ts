/**
 * Card Extension Types
 *
 * TypeScript interfaces for BlazeTracker character card extensions.
 * These extensions allow character creators to define starting state
 * that persists with the character card (CCv2/v3 data.extensions field).
 */

import type { LocationType, OutfitSlot, RelationshipStatus } from '../types/common';
import type { Subject } from '../types/subject';

// ============================================
// Location Extension
// ============================================

/**
 * Starting location configuration stored in character card.
 * Extension key: x-bt-location
 */
export interface BTLocationExtension {
	/** Must be true for this extension to be applied */
	enabled: boolean;
	/** City, region, or world area (e.g., "New York City, NY" or "The Shire") */
	area?: string;
	/** Building or landmark (e.g., "John's Apartment" or "The Green Dragon Inn") */
	place?: string;
	/** Room or specific spot (e.g., "Living Room" or "By the fireplace") */
	position?: string;
	/** Location type for climate calculations */
	locationType?: LocationType;
}

// ============================================
// Time Extension
// ============================================

/**
 * Starting time configuration stored in character card.
 * Extension key: x-bt-time
 */
export interface BTTimeExtension {
	/** Must be true for this extension to be applied */
	enabled: boolean;
	/** ISO 8601 datetime string (e.g., "2024-01-15T14:30:00") */
	datetime?: string;
}

// ============================================
// Outfit Extension
// ============================================

/**
 * Starting outfit configuration for {{char}}.
 * Extension key: x-bt-outfit
 *
 * Slot values:
 * - undefined: Let extraction determine
 * - null: Explicitly nothing (slot is empty)
 * - string: Specific item
 */
export interface BTOutfitExtension {
	/** Must be true for this extension to be applied */
	enabled: boolean;
	head?: string | null;
	neck?: string | null;
	jacket?: string | null;
	back?: string | null;
	torso?: string | null;
	legs?: string | null;
	underwear?: string | null;
	socks?: string | null;
	footwear?: string | null;
}

// ============================================
// Profile Extension
// ============================================

/**
 * Sex/gender for profile extension.
 */
export type ProfileSex = 'M' | 'F' | 'O';

/**
 * Starting profile configuration for {{char}}.
 * Extension key: x-bt-profile
 *
 * Field values:
 * - undefined: Let extraction determine
 * - specified value: Use this value
 */
export interface BTProfileExtension {
	/** Must be true for this extension to be applied */
	enabled: boolean;
	/** Sex/gender: M (male), F (female), O (other) */
	sex?: ProfileSex;
	/** Species (e.g., "human", "elf", "android") */
	species?: string;
	/** Age in years */
	age?: number;
	/** Appearance tags (e.g., ["tall", "blonde hair", "green eyes"]) */
	appearance?: string[];
	/** Personality tags (e.g., ["confident", "sarcastic", "loyal"]) */
	personality?: string[];
}

// ============================================
// Relationship Extension
// ============================================

/**
 * One-directional attitude definition (feelings, secrets, wants).
 */
export interface BTAttitudeExtension {
	feelings?: string[];
	secrets?: string[];
	wants?: string[];
}

/**
 * A single relationship configuration.
 */
export interface BTRelationshipExtension {
	/** Target character - "{{user}}" or a specific name like "Alice" */
	target: string;
	/** Overall relationship status */
	status?: RelationshipStatus;
	/** Pre-set milestone subjects (for status gating) */
	milestones?: Subject[];
	/** {{char}} → target attitude */
	charToTarget?: BTAttitudeExtension;
	/** target → {{char}} attitude */
	targetToChar?: BTAttitudeExtension;
}

/**
 * Array of relationship configurations.
 * Extension key: x-bt-relationships
 */
export type BTRelationshipsExtension = BTRelationshipExtension[];

// ============================================
// Combined Extensions
// ============================================

/**
 * All card extensions read from a character card.
 */
export interface CardExtensions {
	location?: BTLocationExtension;
	time?: BTTimeExtension;
	outfit?: BTOutfitExtension;
	profile?: BTProfileExtension;
	relationships?: BTRelationshipsExtension;
}

// ============================================
// Extension Keys
// ============================================

/** Extension key for location data */
export const EXTENSION_KEY_LOCATION = 'x-bt-location';
/** Extension key for time data */
export const EXTENSION_KEY_TIME = 'x-bt-time';
/** Extension key for outfit data */
export const EXTENSION_KEY_OUTFIT = 'x-bt-outfit';
/** Extension key for profile data */
export const EXTENSION_KEY_PROFILE = 'x-bt-profile';
/** Extension key for relationships data */
export const EXTENSION_KEY_RELATIONSHIPS = 'x-bt-relationships';

// ============================================
// Validation Functions
// ============================================

/**
 * Check if a value is a valid BTLocationExtension.
 */
export function isValidBTLocationExtension(value: unknown): value is BTLocationExtension {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (typeof v.enabled !== 'boolean') return false;
	if (v.area !== undefined && typeof v.area !== 'string') return false;
	if (v.place !== undefined && typeof v.place !== 'string') return false;
	if (v.position !== undefined && typeof v.position !== 'string') return false;
	if (v.locationType !== undefined && typeof v.locationType !== 'string') return false;
	return true;
}

/**
 * Check if a value is a valid BTTimeExtension.
 */
export function isValidBTTimeExtension(value: unknown): value is BTTimeExtension {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (typeof v.enabled !== 'boolean') return false;
	if (v.datetime !== undefined && typeof v.datetime !== 'string') return false;
	return true;
}

/**
 * Check if a value is a valid BTOutfitExtension.
 */
export function isValidBTOutfitExtension(value: unknown): value is BTOutfitExtension {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (typeof v.enabled !== 'boolean') return false;

	const slots: OutfitSlot[] = [
		'head',
		'neck',
		'jacket',
		'back',
		'torso',
		'legs',
		'underwear',
		'socks',
		'footwear',
	];
	for (const slot of slots) {
		if (v[slot] !== undefined && v[slot] !== null && typeof v[slot] !== 'string') {
			return false;
		}
	}
	return true;
}

/**
 * Valid sex values for profile extension.
 */
const VALID_SEX_VALUES: ProfileSex[] = ['M', 'F', 'O'];

/**
 * Check if a value is a valid BTProfileExtension.
 */
export function isValidBTProfileExtension(value: unknown): value is BTProfileExtension {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (typeof v.enabled !== 'boolean') return false;
	if (v.sex !== undefined && !VALID_SEX_VALUES.includes(v.sex as ProfileSex)) return false;
	if (v.species !== undefined && typeof v.species !== 'string') return false;
	if (v.age !== undefined && typeof v.age !== 'number') return false;
	if (v.appearance !== undefined && !Array.isArray(v.appearance)) return false;
	if (v.personality !== undefined && !Array.isArray(v.personality)) return false;
	return true;
}

/**
 * Check if a value is a valid BTRelationshipExtension.
 */
export function isValidBTRelationshipExtension(value: unknown): value is BTRelationshipExtension {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (typeof v.target !== 'string') return false;
	if (v.status !== undefined && typeof v.status !== 'string') return false;
	if (v.milestones !== undefined && !Array.isArray(v.milestones)) return false;
	// Attitude validation
	if (v.charToTarget !== undefined && !isValidAttitudeExtension(v.charToTarget)) return false;
	if (v.targetToChar !== undefined && !isValidAttitudeExtension(v.targetToChar)) return false;
	return true;
}

/**
 * Check if a value is a valid BTAttitudeExtension.
 */
function isValidAttitudeExtension(value: unknown): value is BTAttitudeExtension {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	if (v.feelings !== undefined && !Array.isArray(v.feelings)) return false;
	if (v.secrets !== undefined && !Array.isArray(v.secrets)) return false;
	if (v.wants !== undefined && !Array.isArray(v.wants)) return false;
	return true;
}

/**
 * Check if a value is a valid BTRelationshipsExtension (array).
 */
export function isValidBTRelationshipsExtension(value: unknown): value is BTRelationshipsExtension {
	if (!Array.isArray(value)) return false;
	return value.every(isValidBTRelationshipExtension);
}

/**
 * Check if any card extensions are enabled.
 */
export function hasEnabledExtensions(extensions: CardExtensions): boolean {
	if (extensions.location?.enabled) return true;
	if (extensions.time?.enabled) return true;
	if (extensions.outfit?.enabled) return true;
	if (extensions.profile?.enabled) return true;
	if (extensions.relationships && extensions.relationships.length > 0) return true;
	return false;
}
