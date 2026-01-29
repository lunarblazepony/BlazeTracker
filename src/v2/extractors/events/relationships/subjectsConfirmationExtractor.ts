/**
 * Subjects Confirmation Event Extractor
 *
 * Confirms, rejects, or corrects previously detected subjects.
 * Validates each candidate subject individually with a second LLM pass.
 *
 * Rather than creating new events, it modifies turnEvents by:
 * - Marking rejected subjects as deleted
 * - Updating wrong_subject subjects with the correct subject type
 */

import type { Generator } from '../../../generator';
import type { Event, RelationshipSubjectEvent, MessageAndSwipe } from '../../../types';
import type { ExtractedSubjectsConfirmation } from '../../../types/extraction';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import { getMessageCount } from '../../types';
import { subjectsConfirmationPrompt } from '../../../prompts/events/subjectsConfirmationPrompt';
import { generateAndParse, evaluateRunStrategy, getExtractorTemperature } from '../../utils';
import { buildPrompt } from '../../../prompts';
import type { EventStore } from '../../../store';
import { debugLog, debugWarn } from '../../../../utils/debug';

/**
 * Helper to check if an event is a RelationshipSubjectEvent.
 */
function isSubjectEvent(event: Event): event is RelationshipSubjectEvent {
	return event.kind === 'relationship' && 'subkind' in event && event.subkind === 'subject';
}

/**
 * Check if a subject already exists for this pair in the CURRENT TURN only.
 * We allow the same subject to appear in different turns (historical),
 * but not twice in the same turn.
 */
function subjectExistsInTurn(
	turnEvents: Event[],
	pair: [string, string],
	subject: string,
	excludeEventId?: string,
): boolean {
	const pairKey = `${pair[0].toLowerCase()}|${pair[1].toLowerCase()}`;

	for (const event of turnEvents) {
		if (!isSubjectEvent(event) || event.deleted) continue;
		if (excludeEventId && event.id === excludeEventId) continue;
		const eventPairKey = `${event.pair[0].toLowerCase()}|${event.pair[1].toLowerCase()}`;
		if (eventPairKey === pairKey && event.subject === subject) return true;
	}

	return false;
}

/**
 * Format messages for a specific message range.
 */
function formatMessages(
	context: ExtractionContext,
	messageStart: number,
	messageEnd: number,
): string {
	const lines: string[] = [];
	for (let i = messageStart; i <= messageEnd && i < context.chat.length; i++) {
		const msg = context.chat[i];
		if (msg.is_system) continue;
		lines.push(`${msg.name}: ${msg.mes}`);
	}
	return lines.join('\n\n');
}

/**
 * Subjects confirmation event extractor.
 *
 * Validates each candidate subject from turnEvents individually.
 * Modifies turnEvents in place by marking rejected subjects as deleted
 * or updating their subject type if wrong_subject.
 */
export const subjectsConfirmationExtractor: EventExtractor<ExtractedSubjectsConfirmation> = {
	name: 'subjectsConfirmation',
	displayName: 'subjects',
	category: 'relationships',
	defaultTemperature: 0.2,
	prompt: subjectsConfirmationPrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 2 },
	runStrategy: {
		strategy: 'newEventsOfKind',
		kinds: [{ kind: 'relationship', subkind: 'subject' }],
	},

	/**
	 * Check if this extractor should run.
	 * Requires relationships tracking enabled and new subject events this turn.
	 */
	shouldRun(context: RunStrategyContext): boolean {
		// Must have relationships tracking enabled
		if (!context.settings.track.relationships) {
			return false;
		}

		// Check run strategy (new subject events this turn)
		return evaluateRunStrategy(this.runStrategy, context);
	},

	/**
	 * Run subjects confirmation extraction.
	 * Validates each candidate subject individually.
	 * Returns empty array but modifies turnEvents to mark rejected/corrected subjects.
	 */
	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		store: EventStore,
		currentMessage: MessageAndSwipe,
		turnEvents: Event[],
		abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get subject events from turnEvents
		const subjectEvents = turnEvents.filter(isSubjectEvent);

		// If no subject events in turnEvents, nothing to confirm
		if (subjectEvents.length === 0) {
			return [];
		}

		// Calculate message range for context
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Format messages once for all confirmations
		const messages = formatMessages(context, messageStart, messageEnd);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'relationships',
			this.defaultTemperature,
		);

		// Validate each candidate subject individually
		for (const subjectEvent of subjectEvents) {
			// Build placeholder values for this specific candidate
			const candidatePair = `${subjectEvent.pair[0]} and ${subjectEvent.pair[1]}`;
			const candidateSubject = subjectEvent.subject;

			const placeholderValues: Record<string, string> = {
				candidatePair,
				candidateSubject,
				messages,
			};

			// Build the prompt for this candidate
			const builtPrompt = buildPrompt(
				subjectsConfirmationPrompt,
				placeholderValues,
				settings.customPrompts,
			);

			// Generate and parse the response
			const result = await generateAndParse(
				generator,
				subjectsConfirmationPrompt,
				builtPrompt,
				temperature,
				{ abortSignal },
			);

			// Handle parse failure - skip this candidate (leave it as-is)
			if (!result.success || !result.data) {
				debugWarn(
					`Subjects confirmation failed for ${candidatePair} - ${candidateSubject}`,
				);
				continue;
			}

			const confirmation = result.data;

			// Handle the result
			switch (confirmation.result) {
				case 'accept':
					debugLog(
						`Confirmed subject: ${candidatePair} - ${candidateSubject}. Reason: ${confirmation.reasoning}`,
					);
					break;

				case 'wrong_subject':
					if (confirmation.correct_subject) {
						// Check if correcting would create a duplicate within this turn
						if (
							subjectExistsInTurn(
								turnEvents,
								subjectEvent.pair,
								confirmation.correct_subject,
								subjectEvent.id,
							)
						) {
							subjectEvent.deleted = true;
							debugLog(
								`Deleted subject (would duplicate in turn): ${candidatePair} - ${candidateSubject} -> ${confirmation.correct_subject}`,
							);
						} else {
							// Update the subject type
							subjectEvent.subject =
								confirmation.correct_subject;
							debugLog(
								`Corrected subject: ${candidatePair} - ${candidateSubject} -> ${confirmation.correct_subject}. Reason: ${confirmation.reasoning}`,
							);
						}
					} else {
						// No correct subject provided, mark as rejected
						subjectEvent.deleted = true;
						debugLog(
							`Rejected subject (no correction): ${candidatePair} - ${candidateSubject}. Reason: ${confirmation.reasoning}`,
						);
					}
					break;

				case 'reject':
					// Mark as deleted
					subjectEvent.deleted = true;
					debugLog(
						`Rejected subject: ${candidatePair} - ${candidateSubject}. Reason: ${confirmation.reasoning}`,
					);
					break;
			}
		}

		// This extractor doesn't create new events, it only modifies existing ones
		return [];
	},
};
