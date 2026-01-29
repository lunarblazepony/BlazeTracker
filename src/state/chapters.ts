// ============================================
// Chapter Utility Functions
// ============================================

import type {
	NarrativeDateTime,
	LocationState,
	Chapter,
	DerivedChapter,
	ChapterOutcomes,
	TimestampedEvent,
} from '../types/state';
import { getSettings } from '../settings';

/** Union type for both legacy and derived chapters */
export type AnyChapter = Chapter | DerivedChapter;

// ============================================
// Time Delta Calculations
// ============================================

/**
 * Convert a NarrativeDateTime to total minutes since epoch (for comparison).
 */
function toMinutes(dt: NarrativeDateTime): number {
	// Simple conversion: assumes 30 days per month, 365 days per year
	// This is approximate but sufficient for detecting large time jumps
	const yearMinutes = dt.year * 365 * 24 * 60;
	const monthMinutes = (dt.month - 1) * 30 * 24 * 60;
	const dayMinutes = (dt.day - 1) * 24 * 60;
	const hourMinutes = dt.hour * 60;
	return yearMinutes + monthMinutes + dayMinutes + hourMinutes + dt.minute;
}

/**
 * Calculate the time delta in minutes between two NarrativeDateTimes.
 * Returns positive if 'to' is after 'from', negative otherwise.
 */
export function getTimeDeltaMinutes(from: NarrativeDateTime, to: NarrativeDateTime): number {
	return toMinutes(to) - toMinutes(from);
}

/**
 * Format a time delta in minutes to a human-readable string.
 */
export function formatTimeElapsed(minutes: number): string {
	const absMinutes = Math.abs(minutes);

	if (absMinutes < 60) {
		return `${absMinutes} minute${absMinutes !== 1 ? 's' : ''}`;
	}

	const hours = Math.floor(absMinutes / 60);
	const remainingMinutes = absMinutes % 60;

	if (hours < 24) {
		if (remainingMinutes === 0) {
			return `${hours} hour${hours !== 1 ? 's' : ''}`;
		}
		return `${hours} hour${hours !== 1 ? 's' : ''}, ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
	}

	const days = Math.floor(hours / 24);
	const remainingHours = hours % 24;

	if (days < 7) {
		if (remainingHours === 0) {
			return `${days} day${days !== 1 ? 's' : ''}`;
		}
		return `${days} day${days !== 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
	}

	const weeks = Math.floor(days / 7);
	const remainingDays = days % 7;

	if (remainingDays === 0) {
		return `${weeks} week${weeks !== 1 ? 's' : ''}`;
	}
	return `${weeks} week${weeks !== 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`;
}

// ============================================
// Chapter Boundary Detection
// ============================================

export interface BoundaryCheckResult {
	/** Whether a chapter boundary was detected */
	triggered: boolean;
	/** Reason for the boundary (if triggered) */
	reason?: 'location_change' | 'time_jump' | 'both';
	/** Location change details (if applicable) */
	locationChange?: {
		from: string;
		to: string;
	};
	/** Time jump details (if applicable) */
	timeJump?: {
		minutes: number;
		formatted: string;
	};
}

/**
 * Check if a chapter boundary should be triggered based on location or time changes.
 * @param previousLocation Previous location state
 * @param currentLocation Current location state
 * @param previousTime Previous narrative time
 * @param currentTime Current narrative time
 * @returns BoundaryCheckResult indicating if and why a boundary was triggered
 */
export function checkChapterBoundary(
	previousLocation: LocationState | undefined,
	currentLocation: LocationState | undefined,
	previousTime: NarrativeDateTime | undefined,
	currentTime: NarrativeDateTime | undefined,
): BoundaryCheckResult {
	const settings = getSettings();
	const threshold = settings.chapterTimeThreshold ?? 60; // Default 60 minutes

	let locationChanged = false;
	let timeJumped = false;
	let locationChange: BoundaryCheckResult['locationChange'];
	let timeJump: BoundaryCheckResult['timeJump'];

	// Check for significant location change (different area or place)
	if (previousLocation && currentLocation) {
		const areaChanged =
			previousLocation.area.toLowerCase() !== currentLocation.area.toLowerCase();
		const placeChanged =
			previousLocation.place.toLowerCase() !==
			currentLocation.place.toLowerCase();

		if (areaChanged || placeChanged) {
			locationChanged = true;
			locationChange = {
				from: `${previousLocation.area} - ${previousLocation.place}`,
				to: `${currentLocation.area} - ${currentLocation.place}`,
			};
		}
	}

	// Check for time jump
	if (previousTime && currentTime) {
		const delta = getTimeDeltaMinutes(previousTime, currentTime);

		if (delta >= threshold) {
			timeJumped = true;
			timeJump = {
				minutes: delta,
				formatted: formatTimeElapsed(delta),
			};
		}
	}

	// Determine result
	if (locationChanged && timeJumped) {
		return {
			triggered: true,
			reason: 'both',
			locationChange,
			timeJump,
		};
	} else if (locationChanged) {
		return {
			triggered: true,
			reason: 'location_change',
			locationChange,
		};
	} else if (timeJumped) {
		return {
			triggered: true,
			reason: 'time_jump',
			timeJump,
		};
	}

	return { triggered: false };
}

// ============================================
// Chapter Creation
// ============================================

/**
 * Create a new chapter with default empty values.
 */
export function createEmptyChapter(index: number): Chapter {
	const now: NarrativeDateTime = {
		year: new Date().getFullYear(),
		month: 6,
		day: 15,
		hour: 12,
		minute: 0,
		second: 0,
		dayOfWeek: 'Monday',
	};

	return {
		index,
		title: `Chapter ${index + 1}`,
		summary: '',
		timeRange: {
			start: now,
			end: now,
		},
		primaryLocation: 'Unknown',
		events: [],
		outcomes: createEmptyOutcomes(),
	};
}

/**
 * Create empty chapter outcomes.
 */
export function createEmptyOutcomes(): ChapterOutcomes {
	return {
		relationshipChanges: [],
		secretsRevealed: [],
		newComplications: [],
	};
}

/**
 * Finalize a chapter with events and time range.
 */
export function finalizeChapter(
	chapter: Chapter,
	events: TimestampedEvent[],
	startTime: NarrativeDateTime,
	endTime: NarrativeDateTime,
	primaryLocation: string,
): Chapter {
	return {
		...chapter,
		events,
		timeRange: {
			start: startTime,
			end: endTime,
		},
		primaryLocation,
	};
}

// ============================================
// Formatting
// ============================================

/**
 * Format a chapter for display in prompts.
 */
export function formatChapterForPrompt(chapter: AnyChapter): string {
	const lines: string[] = [];

	lines.push(`## Chapter ${chapter.index + 1}: ${chapter.title}`);
	lines.push(`Location: ${chapter.primaryLocation}`);
	lines.push(
		`Time: ${formatDateTime(chapter.timeRange.start)} - ${formatDateTime(chapter.timeRange.end)}`,
	);
	lines.push('');
	lines.push(chapter.summary);

	if (chapter.outcomes.relationshipChanges.length > 0) {
		lines.push('');
		lines.push(
			`Relationship changes: ${chapter.outcomes.relationshipChanges.join('; ')}`,
		);
	}

	if (chapter.outcomes.secretsRevealed.length > 0) {
		lines.push(`Secrets revealed: ${chapter.outcomes.secretsRevealed.join('; ')}`);
	}

	return lines.join('\n');
}

/**
 * Format multiple chapters for injection.
 */
export function formatChaptersForInjection(chapters: AnyChapter[], limit?: number): string {
	if (chapters.length === 0) {
		return 'No previous chapters.';
	}

	const toFormat = limit ? chapters.slice(-limit) : chapters;

	return toFormat.map(formatChapterForPrompt).join('\n\n---\n\n');
}

/**
 * Format a NarrativeDateTime for display.
 */
export function formatDateTime(dt: NarrativeDateTime): string {
	const hour12 = dt.hour % 12 || 12;
	const ampm = dt.hour < 12 ? 'AM' : 'PM';
	const minute = dt.minute.toString().padStart(2, '0');

	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];

	return `${dt.dayOfWeek}, ${months[dt.month - 1]} ${dt.day}, ${dt.year} at ${hour12}:${minute} ${ampm}`;
}
