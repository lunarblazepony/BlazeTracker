import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, asNumber } from '../utils/json';
import type { NarrativeDateTime } from '../types/state';
import { DAYS_OF_WEEK, MONTH_NAMES } from '../ui/constants';

// Re-export for convenience (maintains backward compatibility)
export type { NarrativeDateTime };

// ============================================
// Types
// ============================================

export interface TimeDelta {
	hours: number;
	minutes: number;
	seconds: number;
}

interface TimeTrackerState {
	currentDate: Date;
	lastDeltaSeconds: number;
	initialized: boolean;
}

// ============================================
// Schemas & Examples
// ============================================

const DATETIME_SCHEMA = {
	type: 'object',
	properties: {
		year: {
			type: 'number',
			description:
				'Four digit year, e.g. 2024. Infer from context or use a reasonable default.',
		},
		month: {
			type: 'number',
			description:
				'Month 1-12. Infer from seasonal context, weather, or use a reasonable default.',
		},
		day: {
			type: 'number',
			description:
				'Day of month 1-31. Infer if possible or use a reasonable default.',
		},
		hour: { type: 'number', description: 'Hour 0-23 in 24-hour format.' },
		minute: { type: 'number', description: 'Minute 0-59.' },
		second: {
			type: 'number',
			description: 'Second 0-59. Usually 0 unless specifically mentioned.',
		},
	},
	required: ['year', 'month', 'day', 'hour', 'minute', 'second'],
};

const DATETIME_EXAMPLE = JSON.stringify(
	{
		year: 2024,
		month: 6,
		day: 15,
		hour: 14,
		minute: 30,
		second: 0,
	},
	null,
	2,
);

const DELTA_SCHEMA = {
	type: 'object',
	properties: {
		hours: { type: 'number', description: 'Hours passed. 0 if less than an hour.' },
		minutes: { type: 'number', description: 'Minutes passed (0-59). Added to hours.' },
		seconds: {
			type: 'number',
			description:
				'Seconds passed (0-59). Usually 0 unless specifically mentioned.',
		},
	},
	required: ['hours', 'minutes', 'seconds'],
};

const DELTA_EXAMPLE = JSON.stringify(
	{
		hours: 0,
		minutes: 2,
		seconds: 30,
	},
	null,
	2,
);

// ============================================
// Time Tracker State (module-level singleton)
// ============================================

const timeTracker: TimeTrackerState = {
	currentDate: new Date(),
	lastDeltaSeconds: 0,
	initialized: false,
};

// ============================================
// Public API
// ============================================

/**
 * Extract time for a message. Handles both initial datetime extraction
 * and delta extraction based on whether there's previous state.
 */
export async function extractTime(
	hasPreviousState: boolean,
	messages: string,
	abortSignal?: AbortSignal,
): Promise<NarrativeDateTime> {
	const settings = getSettings();

	if (!hasPreviousState) {
		const extracted = await extractDateTime(messages, settings.profileId, abortSignal);
		initializeTracker(extracted);
	} else {
		const delta = await extractTimeDelta(messages, settings.profileId, abortSignal);
		applyDelta(delta, settings.leapThresholdMinutes ?? 20);
	}

	return getCurrentDateTime();
}

/**
 * Get the current narrative datetime without extraction.
 */
export function getCurrentDateTime(): NarrativeDateTime {
	return dateToNarrative(timeTracker.currentDate);
}

/**
 * Check if the time tracker has been initialized.
 */
export function isTimeTrackerInitialized(): boolean {
	return timeTracker.initialized;
}

/**
 * Reset the time tracker (e.g., when switching chats).
 */
export function resetTimeTracker(): void {
	timeTracker.currentDate = new Date();
	timeTracker.lastDeltaSeconds = 0;
	timeTracker.initialized = false;
}

/**
 * Manually set the tracker state (e.g., when loading from saved state).
 */
export function setTimeTrackerState(datetime: NarrativeDateTime): void {
	timeTracker.currentDate = narrativeToDate(datetime);
	timeTracker.lastDeltaSeconds = 0;
	timeTracker.initialized = true;
}

// ============================================
// Internal: Extraction Functions
// ============================================

export async function extractDateTime(
	message: string,
	profileId: string,
	abortSignal?: AbortSignal,
): Promise<NarrativeDateTime> {
	const settings = getSettings();
	const promptParts = getPromptParts('time_datetime');
	const userPrompt = promptParts.user
		.replace('{{messages}}', message)
		.replace('{{schema}}', JSON.stringify(DATETIME_SCHEMA, null, 2))
		.replace('{{schemaExample}}', DATETIME_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('time_datetime'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/Time',
	});

	return validateDateTime(parsed);
}

async function extractTimeDelta(
	message: string,
	profileId: string,
	abortSignal?: AbortSignal,
): Promise<TimeDelta> {
	const currentTimeStr = formatTimeForPrompt(timeTracker.currentDate);
	const settings = getSettings();

	const promptParts = getPromptParts('time_delta');
	const userPrompt = promptParts.user
		.replace('{{messages}}', message)
		.replace('{{currentTime}}', currentTimeStr)
		.replace('{{schema}}', JSON.stringify(DELTA_SCHEMA, null, 2))
		.replace('{{schemaExample}}', DELTA_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('time_delta'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/Time',
	});

	return validateDelta(parsed);
}

// ============================================
// Internal: Time Tracker Operations
// ============================================

function initializeTracker(datetime: NarrativeDateTime): void {
	timeTracker.currentDate = narrativeToDate(datetime);
	timeTracker.lastDeltaSeconds = 0;
	timeTracker.initialized = true;
}

function applyDelta(delta: TimeDelta, leapThresholdMinutes: number): void {
	const deltaSeconds = delta.hours * 3600 + delta.minutes * 60 + delta.seconds;
	const thresholdSeconds = leapThresholdMinutes * 60;

	// Consecutive leap detection
	const isLeap = deltaSeconds > thresholdSeconds;
	const wasLeap = timeTracker.lastDeltaSeconds > thresholdSeconds;

	const cappedSeconds = isLeap && wasLeap ? thresholdSeconds : deltaSeconds;

	// Apply to Date object - handles all edge cases (month overflow, leap years, etc.)
	timeTracker.currentDate = new Date(
		timeTracker.currentDate.getTime() + cappedSeconds * 1000,
	);

	// Store the raw delta (not capped) for next comparison
	timeTracker.lastDeltaSeconds = deltaSeconds;
}

// ============================================
// Internal: Conversion Utilities
// ============================================

function dateToNarrative(date: Date): NarrativeDateTime {
	return {
		year: date.getFullYear(),
		month: date.getMonth() + 1, // JS months are 0-indexed
		day: date.getDate(),
		hour: date.getHours(),
		minute: date.getMinutes(),
		second: date.getSeconds(),
		dayOfWeek: DAYS_OF_WEEK[date.getDay()],
	};
}

function narrativeToDate(narrative: NarrativeDateTime): Date {
	return new Date(
		narrative.year,
		narrative.month - 1, // JS months are 0-indexed
		narrative.day,
		narrative.hour,
		narrative.minute,
		narrative.second,
	);
}

function formatTimeForPrompt(date: Date): string {
	const narrative = dateToNarrative(date);

	const hour12 = narrative.hour % 12 || 12;
	const ampm = narrative.hour < 12 ? 'AM' : 'PM';
	const minuteStr = String(narrative.minute).padStart(2, '0');

	return `${narrative.dayOfWeek}, ${MONTH_NAMES[narrative.month - 1]} ${narrative.day}, ${narrative.year} at ${hour12}:${minuteStr} ${ampm}`;
}

// ============================================
// Validation
// ============================================

function validateDateTime(data: unknown): NarrativeDateTime {
	if (typeof data !== 'object' || data === null) {
		throw new Error('Invalid datetime: expected object');
	}

	const obj = data as Record<string, unknown>;

	// Parse and clamp year/month first
	const year = asNumber(obj.year, new Date().getFullYear());
	const month = clamp(asNumber(obj.month, 6), 1, 12);

	// Clamp day to valid range for this month (handles Feb 30 -> Feb 28/29, etc.)
	const maxDay = getDaysInMonth(year, month);
	const day = clamp(asNumber(obj.day, 15), 1, maxDay);

	const result: NarrativeDateTime = {
		year: clamp(year, 1, 9999),
		month,
		day,
		hour: clamp(asNumber(obj.hour, 12), 0, 23),
		minute: clamp(asNumber(obj.minute, 0), 0, 59),
		second: clamp(asNumber(obj.second, 0), 0, 59),
		dayOfWeek: '', // Will be calculated
	};

	// Get correct day of week from Date object
	const dateObj = narrativeToDate(result);
	result.dayOfWeek = DAYS_OF_WEEK[dateObj.getDay()];

	return result;
}

function getDaysInMonth(year: number, month: number): number {
	// Day 0 of next month = last day of this month
	return new Date(year, month, 0).getDate();
}

function validateDelta(data: unknown): TimeDelta {
	if (typeof data !== 'object' || data === null) {
		return { hours: 0, minutes: 0, seconds: 0 };
	}

	const obj = data as Record<string, unknown>;

	return {
		hours: Math.max(0, Math.floor(asNumber(obj.hours, 0))),
		minutes: clamp(Math.floor(asNumber(obj.minutes, 0)), 0, 59),
		seconds: clamp(Math.floor(asNumber(obj.seconds, 0)), 0, 59),
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
