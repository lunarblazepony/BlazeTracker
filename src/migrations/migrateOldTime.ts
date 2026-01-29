// migration.ts

import type { STContext } from '../types/st';
import type { TrackedState, NarrativeDateTime } from '../types/state';
import { getMessageState, setMessageState } from '../utils/messageState';
import { extractDateTime } from '../extractors/extractTime';
import { st_echo } from 'sillytavern-utils-lib/config';
import { DAYS_OF_WEEK } from '../ui/constants';
import { errorLog } from '../utils/debug';

interface OldTimeFormat {
	hour: number;
	minute: number;
	day: string;
}

function isOldTimeFormat(time: any): time is OldTimeFormat {
	return time && typeof time.day === 'string' && !time.dayOfWeek;
}

function getDayIndex(dayName: string): number {
	return DAYS_OF_WEEK.indexOf(dayName as (typeof DAYS_OF_WEEK)[number]);
}

function daysBetween(fromDay: string, toDay: string): number {
	const fromIdx = getDayIndex(fromDay);
	const toIdx = getDayIndex(toDay);
	if (fromIdx === -1 || toIdx === -1) return 0;

	// Calculate forward distance (handles wrap-around)
	let diff = toIdx - fromIdx;
	if (diff <= 0) diff += 7; // Went to next week
	if (diff === 7) diff = 0; // Same day
	return diff;
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

function dateToNarrativeTime(date: Date, hour: number, minute: number): NarrativeDateTime {
	return {
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		day: date.getDate(),
		hour,
		minute,
		second: 0,
		dayOfWeek: DAYS_OF_WEEK[date.getDay()],
	};
}

function narrativeToDate(time: NarrativeDateTime): Date {
	return new Date(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
}

/**
 * Migrate old time formats to NarrativeDateTime.
 * Call on CHAT_CHANGED after loading states.
 */
export async function migrateOldTimeFormats(
	context: STContext,
	profileId: string,
): Promise<boolean> {
	let needsMigration = false;
	let firstOldStateIdx = -1;

	// First pass: check if any states need migration
	for (let i = 0; i < context.chat.length; i++) {
		const stored = getMessageState(context.chat[i]);
		if (stored?.state && isOldTimeFormat(stored.state.time)) {
			needsMigration = true;
			if (firstOldStateIdx === -1) {
				firstOldStateIdx = i;
			}
			break;
		}
	}

	if (!needsMigration) {
		return false;
	}

	st_echo?.('warning', '🔥 Updating date/time to v0.3.0 format.');

	// Get messages up to and including the first state for context
	const contextMessages = context.chat
		.slice(0, Math.min(firstOldStateIdx + 1, 5))
		.map(m => `${m.name}: ${m.mes}`)
		.join('\n\n');

	// Use LLM to infer baseline date
	let baselineTime: NarrativeDateTime;
	try {
		baselineTime = await extractDateTime(contextMessages, profileId);
	} catch (e) {
		errorLog('Failed to infer baseline date, using defaults:', e);
		baselineTime = {
			year: new Date().getFullYear(),
			month: 6,
			day: 15,
			hour: 12,
			minute: 0,
			second: 0,
			dayOfWeek: 'Monday',
		};
	}

	// Adjust baseline to match the first state's day of week
	const firstStored = getMessageState(context.chat[firstOldStateIdx]);

	let currentDate = narrativeToDate(baselineTime);

	const firstTime = firstStored?.state?.time;
	if (firstTime && isOldTimeFormat(firstTime)) {
		const targetDayIdx = getDayIndex(firstTime.day);
		const currentDayIdx = currentDate.getDay();
		if (targetDayIdx !== -1 && targetDayIdx !== currentDayIdx) {
			let diff = targetDayIdx - currentDayIdx;
			if (diff > 0) diff -= 7;
			currentDate = addDays(currentDate, diff);
		}
	}

	let lastDayOfWeek: string | null = null;

	// Second pass: migrate each state
	for (let i = 0; i < context.chat.length; i++) {
		const msg = context.chat[i];
		const stored = getMessageState(msg);

		if (!stored?.state || !isOldTimeFormat(stored.state.time)) {
			continue;
		}

		const oldTime = stored.state.time as OldTimeFormat;

		// If day changed, advance the date
		if (lastDayOfWeek !== null && oldTime.day !== lastDayOfWeek) {
			const daysToAdd = daysBetween(lastDayOfWeek, oldTime.day);
			currentDate = addDays(currentDate, daysToAdd);
		}

		// Create new time format, preserving the original hour/minute
		const newTime = dateToNarrativeTime(currentDate, oldTime.hour, oldTime.minute);

		// Update state
		const newState: TrackedState = {
			...stored.state,
			time: newTime,
		};

		setMessageState(msg, { ...stored, state: newState });
		lastDayOfWeek = oldTime.day;
	}

	// Save the chat to persist migrations
	const saveContext = SillyTavern.getContext();
	await saveContext.saveChat();

	return true;
}
