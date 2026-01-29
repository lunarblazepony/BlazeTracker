// ============================================
// Relationship Status Extractor
// ============================================

import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, isObject } from '../utils/json';
import type {
	StatusChangedEvent,
	RelationshipStatus,
	ProjectedRelationship,
	MilestoneEvent,
	MilestoneType,
} from '../types/state';
import { RELATIONSHIP_STATUSES } from '../types/state';
import { generateUUID } from '../state/eventStore';
import { sortPair } from '../state/relationships';

/**
 * MilestoneEvents that gate progression to 'friendly'.
 */
const FRIENDLY_GATE_MILESTONES = new Set<MilestoneType>([
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
 * MilestoneEvents that gate progression to 'close'.
 */
const CLOSE_GATE_MILESTONES = new Set<MilestoneType>([
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
 * MilestoneEvents that gate progression to 'intimate'.
 */
const INTIMATE_GATE_MILESTONES = new Set<MilestoneType>([
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

// ============================================
// Public API
// ============================================

/**
 * Analyzes relationship status changes between a pair of characters.
 * Returns StatusChangedEvent[] with subkind 'status_changed' (0 or 1 events).
 *
 * Note: Status is only re-evaluated periodically (based on settings.relationshipRefreshInterval).
 * The caller is responsible for checking if enough messages have passed.
 */
export async function extractRelationshipStatus(
	messages: string,
	relationship: ProjectedRelationship,
	milestones: MilestoneEvent[],
	messageId: number,
	swipeId: number,
	abortSignal?: AbortSignal,
): Promise<StatusChangedEvent[]> {
	const settings = getSettings();

	// Status extractor just needs the pair, current status, and milestones
	const [charA, charB] = relationship.pair;
	const previousStateStr = JSON.stringify(
		{
			pair: [charA, charB],
			status: relationship.status,
			milestones: milestones.map(m => m.type),
		},
		null,
		2,
	);

	const promptParts = getPromptParts('relationship_status');
	const userPrompt = promptParts.user
		.replace('{{previousState}}', previousStateStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('relationship_status'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/RelationshipStatus',
	});

	return validateAndConvertEvents(parsed, relationship, milestones, messageId, swipeId);
}

// ============================================
// Status Helpers
// ============================================

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
 * Infer maximum relationship status based on milestones.
 */
function inferMaximumStatus(milestones: MilestoneEvent[]): RelationshipStatus {
	const types = new Set<MilestoneType>(milestones.map(m => m.type));

	if ([...INTIMATE_GATE_MILESTONES].some(m => types.has(m))) {
		return 'intimate';
	}

	if ([...CLOSE_GATE_MILESTONES].some(m => types.has(m))) {
		return 'close';
	}

	if ([...FRIENDLY_GATE_MILESTONES].some(m => types.has(m))) {
		return 'friendly';
	}

	return 'acquaintances';
}

/**
 * Infer minimum status from feelings.
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

// ============================================
// Validation
// ============================================

function validateAndConvertEvents(
	data: unknown,
	relationship: ProjectedRelationship,
	milestones: MilestoneEvent[],
	messageId: number,
	swipeId: number,
): StatusChangedEvent[] {
	if (!isObject(data)) {
		throw new Error('Invalid status response: expected object');
	}

	const parsed = data as Record<string, unknown>;

	// Validate status
	if (
		typeof parsed.status !== 'string' ||
		!RELATIONSHIP_STATUSES.includes(parsed.status as RelationshipStatus)
	) {
		return [];
	}

	const changed = parsed.changed === true;
	if (!changed) {
		return [];
	}

	let proposedStatus = parsed.status as RelationshipStatus;
	const currentStatus = relationship.status;

	// Apply constraints

	// 1. Infer minimum from feelings
	const allFeelings = [...relationship.aToB.feelings, ...relationship.bToA.feelings];
	const minStatus = inferMinimumStatus(allFeelings);
	let proposedRank = getStatusRank(proposedStatus);

	if (minStatus) {
		const minRank = getStatusRank(minStatus);
		if (proposedRank < minRank) {
			proposedRank = minRank;
		}
	}

	// 2. Cap by milestones (for positive statuses)
	if (proposedRank > 0) {
		const maxStatus = inferMaximumStatus(milestones);
		const maxRank = getStatusRank(maxStatus);
		if (proposedRank > maxRank) {
			proposedRank = maxRank;
		}
	}

	// 3. Enforce one-step progression (for positive upgrades)
	const currentRank = getStatusRank(currentStatus);
	if (proposedRank > currentRank && proposedRank > 0) {
		// Can only move one step at a time
		proposedRank = Math.min(proposedRank, currentRank + 1);
	}

	proposedStatus = getStatusFromRank(proposedRank);

	// If after all constraints, status hasn't changed, return empty
	if (proposedStatus === currentStatus) {
		return [];
	}

	const timestamp = Date.now();
	const sortedPair = sortPair(relationship.pair[0], relationship.pair[1]);

	return [
		{
			id: generateUUID(),
			messageId,
			swipeId,
			timestamp,
			kind: 'relationship',
			subkind: 'status_changed',
			pair: sortedPair,
			newStatus: proposedStatus,
			previousStatus: currentStatus,
		},
	];
}
