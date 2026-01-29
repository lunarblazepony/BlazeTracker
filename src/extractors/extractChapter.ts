// ============================================
// Chapter Extractor
// ============================================

import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, asString, asStringArray, asBoolean, isObject } from '../utils/json';
import type {
	Chapter,
	ChapterOutcomes,
	NarrativeDateTime,
	TimestampedEvent,
	NarrativeState,
} from '../types/state';
import { createEmptyChapter, createEmptyOutcomes, finalizeChapter } from '../state/chapters';
import { formatEventsForInjection } from '../state/events';
import { formatRelationshipsForPrompt } from '../state/relationships';
import { debugWarn } from '../utils/debug';

// ============================================
// Schema & Example
// ============================================

export const CHAPTER_BOUNDARY_SCHEMA = {
	type: 'object',
	description: 'Chapter boundary analysis result',
	additionalProperties: false,
	properties: {
		isChapterBoundary: {
			type: 'boolean',
			description: 'Whether this represents a true narrative chapter boundary',
		},
		title: {
			type: 'string',
			description: 'A short, evocative title for the chapter (3-6 words)',
		},
		summary: {
			type: 'string',
			description: '2-3 sentence summary of what happened in the chapter',
		},
		outcomes: {
			type: 'object',
			properties: {
				relationshipChanges: {
					type: 'array',
					items: { type: 'string' },
					description: 'Brief descriptions of relationship shifts',
				},
				secretsRevealed: {
					type: 'array',
					items: { type: 'string' },
					description: 'Secrets that came to light',
				},
				newComplications: {
					type: 'array',
					items: { type: 'string' },
					description: 'New problems or tensions introduced',
				},
			},
		},
	},
	required: ['isChapterBoundary', 'title', 'summary'],
};

const CHAPTER_EXAMPLE = JSON.stringify(
	{
		isChapterBoundary: true,
		title: 'The Midnight Confession',
		summary: 'Elena revealed her past to Marcus under the stars, leading to an unexpected moment of vulnerability. Their relationship deepened as secrets were shared and trust was established.',
		outcomes: {
			relationshipChanges: [
				'Elena and Marcus grew closer through shared vulnerability',
			],
			secretsRevealed: ["Elena's criminal past"],
			newComplications: ["Marcus must now decide whether to keep Elena's secret"],
		},
	},
	null,
	2,
);

// ============================================
// Public API
// ============================================

export interface ExtractChapterParams {
	events: TimestampedEvent[];
	narrativeState: NarrativeState;
	chapterIndex: number;
	startTime: NarrativeDateTime;
	endTime: NarrativeDateTime;
	primaryLocation: string;
	/** If true, always create a chapter regardless of LLM's boundary assessment */
	forceCreate?: boolean;
	abortSignal?: AbortSignal;
}

export interface ChapterExtractionResult {
	isChapterBoundary: boolean;
	chapter?: Chapter;
}

/**
 * Extract chapter information when a potential boundary is detected.
 * Returns the chapter if it's a true boundary, null otherwise.
 */
export async function extractChapterBoundary(
	params: ExtractChapterParams,
): Promise<ChapterExtractionResult> {
	const settings = getSettings();

	const schemaStr = JSON.stringify(CHAPTER_BOUNDARY_SCHEMA, null, 2);
	const eventsStr = formatEventsForInjection(params.events);
	const relationshipsStr = formatRelationshipsForPrompt(params.narrativeState.relationships);

	const promptParts = getPromptParts('chapter_boundary');
	const userPrompt = promptParts.user
		.replace('{{currentEvents}}', eventsStr)
		.replace('{{currentRelationships}}', relationshipsStr)
		.replace('{{schema}}', schemaStr)
		.replace('{{schemaExample}}', CHAPTER_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	try {
		const response = await makeGeneratorRequest(llmMessages, {
			profileId: settings.profileId,
			maxTokens: settings.maxResponseTokens,
			temperature: getTemperature('chapter_boundary'),
			abortSignal: params.abortSignal,
		});

		const parsed = parseJsonResponse(response, {
			shape: 'object',
			moduleName: 'BlazeTracker/Chapter',
		});

		const result = validateChapterData(parsed);

		// If not forcing and LLM says it's not a boundary, return false
		if (!params.forceCreate && !result.isChapterBoundary) {
			return { isChapterBoundary: false };
		}

		// Create the chapter with extracted data (either forced or natural boundary)
		const chapter = createEmptyChapter(params.chapterIndex);
		chapter.title = result.title;
		chapter.summary = result.summary;
		chapter.outcomes = result.outcomes;

		// Finalize with time range and events
		const finalizedChapter = finalizeChapter(
			chapter,
			params.events,
			params.startTime,
			params.endTime,
			params.primaryLocation,
		);

		return {
			isChapterBoundary: true,
			chapter: finalizedChapter,
		};
	} catch (error) {
		debugWarn('Chapter extraction failed:', error);
		// On error, assume it's not a chapter boundary
		return { isChapterBoundary: false };
	}
}

// ============================================
// Validation
// ============================================

interface ValidatedChapterData {
	isChapterBoundary: boolean;
	title: string;
	summary: string;
	outcomes: ChapterOutcomes;
}

function validateChapterData(data: unknown): ValidatedChapterData {
	if (!isObject(data)) {
		return {
			isChapterBoundary: false,
			title: '',
			summary: '',
			outcomes: createEmptyOutcomes(),
		};
	}

	const isChapterBoundary = asBoolean(data.isChapterBoundary, false);
	const title = asString(data.title, 'Untitled Chapter');
	const summary = asString(data.summary, '');
	const outcomes = validateOutcomes(data.outcomes);

	return {
		isChapterBoundary,
		title,
		summary,
		outcomes,
	};
}

function validateOutcomes(data: unknown): ChapterOutcomes {
	if (!isObject(data)) {
		return createEmptyOutcomes();
	}

	return {
		relationshipChanges: asStringArray(data.relationshipChanges),
		secretsRevealed: asStringArray(data.secretsRevealed),
		newComplications: asStringArray(data.newComplications),
	};
}

// ============================================
// Chapter Summary Regeneration
// ============================================

/** Minimal event info needed for chapter regeneration */
export interface ChapterEventSummary {
	summary: string;
	tensionLevel: string;
	tensionType: string;
	witnesses?: string[];
}

export interface RegenerateChapterSummaryParams {
	chapter: Chapter;
	/** Event summaries for the chapter */
	eventSummaries: ChapterEventSummary[];
	narrativeState: NarrativeState;
	abortSignal?: AbortSignal;
}

export interface RegeneratedChapterSummary {
	title: string;
	summary: string;
	outcomes: ChapterOutcomes;
}

/**
 * Format event summaries for chapter regeneration prompt.
 */
function formatEventSummaries(events: ChapterEventSummary[]): string {
	if (events.length === 0) {
		return 'No events in this chapter.';
	}

	return events
		.map((event, i) => {
			const lines: string[] = [];
			lines.push(`[Event ${i + 1}]`);
			lines.push(event.summary);
			lines.push(`Tension: ${event.tensionLevel} ${event.tensionType}`);
			if (event.witnesses && event.witnesses.length > 0) {
				lines.push(`Witnesses: ${event.witnesses.join(', ')}`);
			}
			return lines.join('\n');
		})
		.join('\n\n');
}

/**
 * Regenerate a chapter's summary based on updated events.
 * Used when events in a completed chapter are edited.
 */
export async function regenerateChapterSummary(
	params: RegenerateChapterSummaryParams,
): Promise<RegeneratedChapterSummary> {
	const settings = getSettings();

	const schemaStr = JSON.stringify(CHAPTER_BOUNDARY_SCHEMA, null, 2);
	const eventsStr = formatEventSummaries(params.eventSummaries);
	const relationshipsStr = formatRelationshipsForPrompt(params.narrativeState.relationships);

	const promptParts = getPromptParts('chapter_boundary');
	const userPrompt = promptParts.user
		.replace('{{currentEvents}}', eventsStr)
		.replace('{{currentRelationships}}', relationshipsStr)
		.replace('{{schema}}', schemaStr)
		.replace('{{schemaExample}}', CHAPTER_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	try {
		const response = await makeGeneratorRequest(llmMessages, {
			profileId: settings.profileId,
			maxTokens: settings.maxResponseTokens,
			temperature: getTemperature('chapter_boundary'),
			abortSignal: params.abortSignal,
		});

		const parsed = parseJsonResponse(response, {
			shape: 'object',
			moduleName: 'BlazeTracker/ChapterRegen',
		});

		const result = validateChapterData(parsed);

		return {
			title: result.title || params.chapter.title,
			summary: result.summary || params.chapter.summary,
			outcomes: result.outcomes,
		};
	} catch (error) {
		debugWarn('Chapter summary regeneration failed:', error);
		// Return existing values on error
		return {
			title: params.chapter.title,
			summary: params.chapter.summary,
			outcomes: params.chapter.outcomes || createEmptyOutcomes(),
		};
	}
}
