/**
 * Relationship Status Gating Rules
 *
 * Defines which subjects (milestones) must be achieved before a relationship
 * can progress to certain status levels. This prevents the LLM from
 * over-escalating relationships (e.g., "intimate" without ever kissing).
 */

import type { Subject } from '../../types/subject';
import type { RelationshipStatus } from '../../types/common';
import { RELATIONSHIP_STATUSES } from '../../types/common';

/**
 * Subjects that gate progression to 'friendly'.
 * At least one of these must have occurred as a milestone.
 */
export const FRIENDLY_GATE_SUBJECTS = new Set<Subject>([
	'laugh',
	'gift',
	'shared_meal',
	'shared_activity',
	'compliment',
	'tease',
	'helped',
	'common_interest',
	'outing',
]);

/**
 * Subjects that gate progression to 'close'.
 * At least one of these must have occurred as a milestone.
 */
export const CLOSE_GATE_SUBJECTS = new Set<Subject>([
	'emotionally_intimate',
	'secret_shared',
	'confession',
	'sleepover',
	'forgiveness',
	'supportive',
	'comfort',
	'defended',
	'crisis_together',
	'vulnerability',
	'shared_vulnerability',
	'entrusted',
]);

/**
 * Subjects that gate progression to 'intimate'.
 * At least one of these must have occurred as a milestone.
 */
export const INTIMATE_GATE_SUBJECTS = new Set<Subject>([
	'intimate_kiss',
	'date',
	'i_love_you',
	'intimate_touch',
	'intimate_embrace',
	'intimate_heated',
	'intimate_foreplay',
	'intimate_oral',
	'intimate_manual',
	'intimate_penetrative',
	'intimate_climax',
	'exclusivity',
	'marriage',
]);

/**
 * Status rank for ordering (higher = more advanced relationship).
 * Negative ranks are for negative relationships.
 */
const STATUS_RANK: Record<RelationshipStatus, number> = {
	hostile: -2,
	strained: -1,
	strangers: 0,
	acquaintances: 1,
	friendly: 2,
	close: 3,
	intimate: 4,
	complicated: 0, // Special case - can exist at any level
};

/**
 * Get the rank of a status for comparison.
 */
export function getStatusRank(status: RelationshipStatus): number {
	return STATUS_RANK[status];
}

/**
 * Get the status for a given rank.
 */
export function getStatusFromRank(rank: number): RelationshipStatus {
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
 * Infer the maximum allowed relationship status based on achieved milestone subjects.
 *
 * @param milestoneSubjects - Set of subjects that have been achieved as milestones for the pair
 * @returns The maximum status the relationship can be at
 */
export function inferMaximumStatus(milestoneSubjects: Set<Subject>): RelationshipStatus {
	// Check intimate gates first (highest tier)
	for (const subject of INTIMATE_GATE_SUBJECTS) {
		if (milestoneSubjects.has(subject)) {
			return 'intimate';
		}
	}

	// Check close gates
	for (const subject of CLOSE_GATE_SUBJECTS) {
		if (milestoneSubjects.has(subject)) {
			return 'close';
		}
	}

	// Check friendly gates
	for (const subject of FRIENDLY_GATE_SUBJECTS) {
		if (milestoneSubjects.has(subject)) {
			return 'friendly';
		}
	}

	// No qualifying milestones - max is acquaintances
	return 'acquaintances';
}

/**
 * Apply gating rules to constrain a proposed status change.
 *
 * Rules:
 * 1. Positive statuses (friendly, close, intimate) require corresponding milestones
 * 2. Status can only advance one step at a time (for positive progression)
 * 3. Negative statuses (strained, hostile) and 'complicated' are always allowed
 *
 * Note: Milestone gates are CAPS, not floors. You can always go lower
 * (e.g., from intimate to strained after a betrayal), but you can't go
 * higher without the appropriate milestones (e.g., can't be intimate
 * without having kissed).
 *
 * @param proposedStatus - The status the LLM proposed
 * @param currentStatus - The current relationship status
 * @param milestoneSubjects - Set of subjects achieved as milestones for this pair
 * @returns The constrained status (may be lower than proposed, or same as current if invalid)
 */
export function applyStatusGating(
	proposedStatus: RelationshipStatus,
	currentStatus: RelationshipStatus,
	milestoneSubjects: Set<Subject>,
): RelationshipStatus {
	// Validate proposed status
	if (!RELATIONSHIP_STATUSES.includes(proposedStatus)) {
		return currentStatus;
	}

	// 'complicated', 'strained', 'hostile' are always allowed without gates
	// These represent relationship deterioration which doesn't require milestones
	if (
		proposedStatus === 'complicated' ||
		proposedStatus === 'strained' ||
		proposedStatus === 'hostile'
	) {
		return proposedStatus;
	}

	const proposedRank = getStatusRank(proposedStatus);
	const currentRank = getStatusRank(currentStatus);

	// For positive statuses, apply milestone caps
	if (proposedRank > 0) {
		const maxStatus = inferMaximumStatus(milestoneSubjects);
		const maxRank = getStatusRank(maxStatus);

		// Cap at maximum allowed by milestones
		if (proposedRank > maxRank) {
			return getStatusFromRank(maxRank);
		}

		// Enforce one-step progression (only for positive upgrades)
		if (proposedRank > currentRank) {
			const cappedRank = Math.min(proposedRank, currentRank + 1);
			return getStatusFromRank(cappedRank);
		}
	}

	return proposedStatus;
}
