// ============================================
// Relationship Extractor
// ============================================

import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, asStringArray, isObject } from '../utils/json';
import type {
	Relationship,
	RelationshipStatus,
	RelationshipAttitude,
	RelationshipSignal,
	NarrativeDateTime,
} from '../types/state';
import { RELATIONSHIP_STATUSES } from '../types/state';
import {
	sortPair,
	createRelationship,
	createEmptyAttitude,
	addRelationshipVersion,
	addMilestone,
} from '../state/relationships';
import type { LocationState } from './extractLocation';
import { debugWarn } from '../utils/debug';

// ============================================
// Schema & Examples
// ============================================

export const RELATIONSHIP_SCHEMA = {
	type: 'object',
	description: 'Relationship state between two characters',
	additionalProperties: false,
	properties: {
		status: {
			type: 'string',
			enum: [...RELATIONSHIP_STATUSES],
			description: 'Current relationship status',
		},
		attitudes: {
			type: 'object',
			description:
				"Each character's attitude toward the other. Keys are character names.",
			additionalProperties: {
				type: 'object',
				properties: {
					toward: {
						type: 'string',
						description:
							'The other character this attitude is directed at',
					},
					feelings: {
						type: 'array',
						items: { type: 'string' },
						description:
							'Current feelings toward the other character',
					},
					secrets: {
						type: 'array',
						items: { type: 'string' },
						description:
							'Things they know that the other character does not',
					},
					wants: {
						type: 'array',
						items: { type: 'string' },
						description:
							'What they want from this relationship',
					},
				},
			},
		},
		// Support legacy aToB/bToA format for backwards compatibility
		aToB: {
			type: 'object',
			description:
				'How the first character (alphabetically) feels about the second',
			properties: {
				feelings: {
					type: 'array',
					items: { type: 'string' },
				},
				secrets: {
					type: 'array',
					items: { type: 'string' },
				},
				wants: {
					type: 'array',
					items: { type: 'string' },
				},
			},
		},
		bToA: {
			type: 'object',
			description:
				'How the second character (alphabetically) feels about the first',
			properties: {
				feelings: {
					type: 'array',
					items: { type: 'string' },
				},
				secrets: {
					type: 'array',
					items: { type: 'string' },
				},
				wants: {
					type: 'array',
					items: { type: 'string' },
				},
			},
		},
	},
	required: ['status'],
};

function createRelationshipExample(char1: string, char2: string): string {
	return JSON.stringify(
		{
			status: 'friendly',
			attitudes: {
				[char1]: {
					toward: char2,
					feelings: ['trusting', 'curious'],
					secrets: ['knows about their hidden talent'],
					wants: ['friendship', 'adventure together'],
				},
				[char2]: {
					toward: char1,
					feelings: ['grateful', 'protective'],
					secrets: [],
					wants: ['loyalty', 'emotional support'],
				},
			},
		},
		null,
		2,
	);
}

// ============================================
// Helpers
// ============================================

/**
 * Get a descriptive time of day phrase from hour.
 */
function getTimeOfDay(hour: number): string {
	if (hour >= 5 && hour < 12) return 'in the morning';
	if (hour >= 12 && hour < 17) return 'in the afternoon';
	if (hour >= 17 && hour < 21) return 'in the evening';
	return 'at night';
}

// ============================================
// Public API
// ============================================

export interface ExtractInitialRelationshipParams {
	char1: string;
	char2: string;
	messages: string;
	characterInfo: string;
	messageId?: number;
	currentTime?: NarrativeDateTime;
	currentLocation?: LocationState;
	abortSignal?: AbortSignal;
}

/**
 * Extract the initial relationship state between two characters.
 */
export async function extractInitialRelationship(
	params: ExtractInitialRelationshipParams,
): Promise<Relationship | null> {
	const settings = getSettings();

	const pair = sortPair(params.char1, params.char2);
	const schemaStr = JSON.stringify(RELATIONSHIP_SCHEMA, null, 2);
	const exampleStr = createRelationshipExample(pair[0], pair[1]);

	const promptParts = getPromptParts('relationship_initial');
	const userPrompt = promptParts.user
		.replace('{{messages}}', params.messages)
		.replace('{{characterInfo}}', params.characterInfo)
		.replace('{{schema}}', schemaStr)
		.replace('{{schemaExample}}', exampleStr);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	try {
		const response = await makeGeneratorRequest(llmMessages, {
			profileId: settings.profileId,
			maxTokens: settings.maxResponseTokens,
			temperature: getTemperature('relationship_initial'),
			abortSignal: params.abortSignal,
		});

		const parsed = parseJsonResponse(response, {
			shape: 'object',
			moduleName: 'BlazeTracker/Relationship',
		});

		const relationship = buildRelationship(pair, parsed, undefined, params.messageId);

		// Automatically add first_meeting milestone for new relationships
		if (
			relationship &&
			params.messageId !== undefined &&
			params.currentTime &&
			params.currentLocation
		) {
			const locationStr = [
				params.currentLocation.place,
				params.currentLocation.area,
			]
				.filter(Boolean)
				.join(', ');
			const timeOfDay = getTimeOfDay(params.currentTime.hour);
			const description = `${pair[0]} and ${pair[1]} first appear together ${timeOfDay} at ${locationStr}.`;

			addMilestone(relationship, {
				type: 'first_meeting',
				description,
				timestamp: params.currentTime,
				location: locationStr,
				messageId: params.messageId,
			});
		}

		return relationship;
	} catch (error) {
		debugWarn('Initial relationship extraction failed:', error);
		return null;
	}
}

/**
 * Apply a relationship signal from event extraction to update the relationship.
 * This is a lighter-weight update that doesn't require an LLM call.
 */
export function updateRelationshipFromSignal(
	relationship: Relationship,
	signal: RelationshipSignal,
	messageId?: number,
): Relationship {
	// Create a copy to modify
	const updated = { ...relationship };
	updated.aToB = { ...updated.aToB };
	updated.bToA = { ...updated.bToA };
	updated.milestones = [...(updated.milestones ?? [])];

	const [charA, charB] = updated.pair;

	// Apply directional changes
	if (signal.changes) {
		for (const change of signal.changes) {
			const fromLower = change.from.toLowerCase();
			const towardLower = change.toward.toLowerCase();

			// Determine direction
			if (
				fromLower === charA.toLowerCase() &&
				towardLower === charB.toLowerCase()
			) {
				// A's feeling toward B changed
				if (!updated.aToB.feelings.includes(change.feeling)) {
					updated.aToB.feelings = [
						...updated.aToB.feelings,
						change.feeling,
					];
				}
			} else if (
				fromLower === charB.toLowerCase() &&
				towardLower === charA.toLowerCase()
			) {
				// B's feeling toward A changed
				if (!updated.bToA.feelings.includes(change.feeling)) {
					updated.bToA.feelings = [
						...updated.bToA.feelings,
						change.feeling,
					];
				}
			}
		}
	}

	// Add milestones if provided and not duplicates
	let milestonesAdded = false;
	if (signal.milestones && signal.milestones.length > 0) {
		for (const milestone of signal.milestones) {
			const hasMilestone = updated.milestones.some(
				m => m.type === milestone.type,
			);
			if (!hasMilestone) {
				updated.milestones = [...updated.milestones, milestone];
				milestonesAdded = true;
			}
		}
	}

	// If milestones were added, check if we should upgrade the status
	// Milestones enable progression - if we have close milestones, we can be close
	if (milestonesAdded) {
		const maxStatus = inferMaximumStatus(updated.milestones);
		const maxRank = getStatusRank(maxStatus);
		const currentRank = getStatusRank(updated.status);

		// Only upgrade positive statuses, and respect one-step-at-a-time
		if (currentRank >= 0 && currentRank < maxRank) {
			// Check cooldown - need enough messages since last status change
			let canUpgrade = true;
			if (messageId !== undefined && updated.versions.length > 0) {
				const settings = getSettings();
				const minMessages = settings.relationshipUpgradeCooldown;
				const lastVersion = updated.versions[updated.versions.length - 1];
				const messagesSinceLastChange = messageId - lastVersion.messageId;

				if (messagesSinceLastChange < minMessages) {
					canUpgrade = false;
				}
			}

			if (canUpgrade) {
				// Upgrade one step toward the max allowed by milestones
				const newRank = currentRank + 1;
				updated.status = getStatusFromRank(newRank);

				// Record the version change
				if (messageId !== undefined) {
					updated.versions = [
						...updated.versions,
						{
							messageId,
							status: updated.status,
							aToB: updated.aToB,
							bToA: updated.bToA,
							milestones: updated.milestones,
						},
					];
				}
			}
		}
	}

	return updated;
}

/**
 * Find an attitude by character name (case-insensitive).
 */
function findAttitudeByName(attitudes: Record<string, unknown>, name: string): unknown {
	const lowerName = name.toLowerCase();
	for (const [key, value] of Object.entries(attitudes)) {
		if (key.toLowerCase() === lowerName) {
			return value;
		}
	}
	return null;
}

/**
 * Infer minimum relationship status based on feelings.
 */
function inferMinimumStatus(feelings: string[]): RelationshipStatus | null {
	const lower = feelings.map(f => f.toLowerCase()).join(' ');

	if (/love|passionate|romantic|desire|intimate|adore/.test(lower)) return 'intimate';
	if (/trust|care|protective|devoted|loyal|deep/.test(lower)) return 'close';
	if (/like|enjoy|comfortable|fond|friendly|warm/.test(lower)) return 'friendly';
	if (/hate|despise|enemy|loathe/.test(lower)) return 'hostile';
	if (/suspicious|resentful|angry|bitter|distrust/.test(lower)) return 'strained';

	return null;
}

/**
 * Milestones that gate progression from acquaintances → friendly.
 * Requires at least one of these to become friendly.
 */
const FRIENDLY_GATE_MILESTONES = new Set([
	'first_laugh',
	'first_gift',
	'first_shared_meal',
	'first_shared_activity',
	'first_alliance',
	'first_compliment',
	'first_tease',
	'first_helped',
	'first_common_interest',
	'first_outing',
]);

/**
 * Milestones that gate progression from friendly → close.
 * Requires at least one of these to become close.
 */
const CLOSE_GATE_MILESTONES = new Set([
	'emotional_intimacy',
	'secret_shared',
	'confession',
	'first_sleepover',
	'sacrifice',
	'reconciliation',
	'first_support',
	'first_comfort',
	'defended',
	'crisis_together',
	'first_vulnerability',
	'trusted_with_task',
]);

/**
 * Milestones that gate progression from close → intimate.
 * Requires at least one of these to become intimate.
 */
const INTIMATE_GATE_MILESTONES = new Set([
	'first_kiss',
	'first_date',
	'first_i_love_you',
	'first_touch',
	'first_embrace',
	'first_heated',
	'first_foreplay',
	'first_oral',
	'first_manual',
	'first_penetrative',
	'first_climax',
	'promised_exclusivity',
	'marriage',
]);

/**
 * Infer maximum relationship status based on milestones.
 * This caps status to prevent models from over-estimating relationship depth.
 * Checks from highest to lowest tier to find the maximum allowed status.
 */
function inferMaximumStatus(milestones: Array<{ type: string }>): RelationshipStatus {
	const types = new Set(milestones.map(m => m.type));

	// Check from highest to lowest tier
	// Intimate requires romantic/physical milestones
	if ([...INTIMATE_GATE_MILESTONES].some(m => types.has(m))) {
		return 'intimate';
	}

	// Close requires deep trust/emotional milestones
	if ([...CLOSE_GATE_MILESTONES].some(m => types.has(m))) {
		return 'close';
	}

	// Friendly requires bonding milestones
	if ([...FRIENDLY_GATE_MILESTONES].some(m => types.has(m))) {
		return 'friendly';
	}

	// No qualifying milestones - cap at acquaintances
	return 'acquaintances';
}

/**
 * Get numeric rank for status to compare relative closeness.
 */
function getStatusRank(status: RelationshipStatus): number {
	const statusRank: Record<RelationshipStatus, number> = {
		hostile: -2,
		strained: -1,
		strangers: 0,
		acquaintances: 1,
		friendly: 2,
		close: 3,
		intimate: 4,
		complicated: 0,
	};
	return statusRank[status];
}

/**
 * Get status from rank.
 */
function getStatusFromRank(rank: number): RelationshipStatus {
	const rankToStatus: Record<number, RelationshipStatus> = {
		[-2]: 'hostile',
		[-1]: 'strained',
		0: 'strangers',
		1: 'acquaintances',
		2: 'friendly',
		3: 'close',
		4: 'intimate',
	};
	return rankToStatus[rank] ?? 'acquaintances';
}

/**
 * Enforce gradual relationship progression.
 * - Positive progression: can only move one step at a time (strangers → acquaintances → friendly → close)
 * - Negative progression: can move faster (conflicts escalate quickly)
 * - Cooldown: must wait relationshipUpgradeCooldown messages before upgrading again
 *
 * Returns the capped status rank.
 */
function enforceGradualProgression(
	proposedRank: number,
	existing: Relationship | undefined,
	currentMessageId: number | undefined,
): number {
	if (!existing) {
		// New relationship - start at acquaintances max (rank 1), unless negative
		if (proposedRank > 1) {
			return 1; // acquaintances
		}
		return proposedRank;
	}

	const currentRank = getStatusRank(existing.status);

	// If not upgrading (staying same or going down), allow it
	if (proposedRank <= currentRank) {
		return proposedRank;
	}

	// Upgrading - enforce one step at a time
	const maxAllowedRank = currentRank + 1;
	let cappedRank = Math.min(proposedRank, maxAllowedRank);

	// Check cooldown - need enough messages since last status change
	const settings = getSettings();
	const minMessages = settings.relationshipUpgradeCooldown;

	if (currentMessageId !== undefined && existing.versions.length > 0) {
		// Find the most recent version (last status change)
		const lastVersion = existing.versions[existing.versions.length - 1];
		const messagesSinceLastChange = currentMessageId - lastVersion.messageId;

		if (messagesSinceLastChange < minMessages) {
			// Not enough messages have passed - don't allow upgrade
			cappedRank = currentRank;
		}
	}

	return cappedRank;
}

function buildRelationship(
	pair: [string, string],
	data: unknown,
	existing?: Relationship,
	messageId?: number,
): Relationship | null {
	if (!isObject(data)) {
		return null;
	}

	const [charA, charB] = pair;
	let aToB: RelationshipAttitude;
	let bToA: RelationshipAttitude;

	// Try new attitudes format first
	if (isObject(data.attitudes)) {
		const attitudes = data.attitudes as Record<string, unknown>;
		const charAAttitude = findAttitudeByName(attitudes, charA);
		const charBAttitude = findAttitudeByName(attitudes, charB);

		aToB = validateAttitude(charAAttitude);
		bToA = validateAttitude(charBAttitude);
	} else {
		// Fall back to legacy aToB/bToA format
		aToB = validateAttitude(data.aToB);
		bToA = validateAttitude(data.bToA);
	}

	// Validate status
	let status = validateStatus(data.status);

	// Infer minimum status from feelings if status seems too low
	const minFromA = inferMinimumStatus(aToB.feelings);
	const minFromB = inferMinimumStatus(bToA.feelings);

	let currentRank = getStatusRank(status);
	const minRank = Math.max(
		minFromA ? getStatusRank(minFromA) : -999,
		minFromB ? getStatusRank(minFromB) : -999,
	);

	// Upgrade status if feelings suggest deeper connection
	if (minRank > currentRank && minRank !== -999) {
		currentRank = minRank;
		status = getStatusFromRank(currentRank);
	}

	// Apply maximum cap based on milestones (only for positive statuses)
	// This prevents relationships from jumping too high without the requisite milestones
	if (existing && currentRank > 0) {
		const maxStatus = inferMaximumStatus(existing.milestones ?? []);
		const maxRank = getStatusRank(maxStatus);
		if (currentRank > maxRank) {
			currentRank = maxRank;
			status = maxStatus;
		}
	}

	// Enforce gradual progression (one step at a time, with cooldown)
	// This prevents relationships from jumping from strangers to close in a few messages
	const gradualRank = enforceGradualProgression(currentRank, existing, messageId);
	if (gradualRank !== currentRank) {
		currentRank = gradualRank;
		status = getStatusFromRank(currentRank);
	}

	// Determine if status changed
	const statusChanged = !existing || existing.status !== status;

	// Start with existing or create new
	let relationship: Relationship;
	if (existing) {
		relationship = {
			...existing,
			status,
			aToB,
			bToA,
		};
		// Add a new version if status actually changed
		if (statusChanged && messageId !== undefined) {
			addRelationshipVersion(relationship, messageId);
		}
	} else {
		relationship = createRelationship(pair[0], pair[1], status, messageId);
		relationship.aToB = aToB;
		relationship.bToA = bToA;
	}

	return relationship;
}

function validateStatus(value: unknown): RelationshipStatus {
	if (
		typeof value === 'string' &&
		RELATIONSHIP_STATUSES.includes(value as RelationshipStatus)
	) {
		return value as RelationshipStatus;
	}
	return 'acquaintances';
}

function validateAttitude(value: unknown): RelationshipAttitude {
	if (!isObject(value)) {
		return createEmptyAttitude();
	}

	return {
		feelings: asStringArray(value.feelings),
		secrets: asStringArray(value.secrets),
		wants: asStringArray(value.wants),
	};
}
