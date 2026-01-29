// ============================================
// Date Formatting Utilities
// ============================================

import type { NarrativeDateTime } from '../types/state';
import { MONTH_NAMES } from '../ui/constants';

/**
 * Day abbreviations for forecast display.
 */
const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Get the ordinal suffix for a day number.
 * @param day - Day of month (1-31)
 * @returns Ordinal suffix ('st', 'nd', 'rd', or 'th')
 */
export function getDayOrdinal(day: number): string {
	if (day >= 11 && day <= 13) return 'th';
	switch (day % 10) {
		case 1:
			return 'st';
		case 2:
			return 'nd';
		case 3:
			return 'rd';
		default:
			return 'th';
	}
}

/**
 * Format a narrative datetime for prompt injection.
 * Output format: "Monday, June 15th, 2024 at 2:30 PM"
 *
 * @param time - The narrative datetime to format
 * @returns Formatted date/time string
 */
export function formatNarrativeDateTime(time: NarrativeDateTime): string {
	const hour12 = time.hour % 12 || 12;
	const ampm = time.hour < 12 ? 'AM' : 'PM';
	const minuteStr = String(time.minute).padStart(2, '0');
	const dayOrdinal = getDayOrdinal(time.day);

	return `${time.dayOfWeek}, ${MONTH_NAMES[time.month - 1]} ${time.day}${dayOrdinal}, ${time.year} at ${hour12}:${minuteStr} ${ampm}`;
}

/**
 * Format a decimal hour to a time string.
 * @param decimalHour - Hour as decimal (e.g., 6.5 = 6:30)
 * @param format - '12h' or '24h'
 * @returns Formatted time string (e.g., "6:30 AM" or "06:30")
 */
export function formatDecimalHour(decimalHour: number, format: '12h' | '24h' = '12h'): string {
	const hours = Math.floor(decimalHour);
	const minutes = Math.round((decimalHour - hours) * 60);
	const minuteStr = String(minutes).padStart(2, '0');

	if (format === '24h') {
		return `${String(hours).padStart(2, '0')}:${minuteStr}`;
	}

	const hour12 = hours % 12 || 12;
	const ampm = hours < 12 ? 'AM' : 'PM';
	return `${hour12}:${minuteStr} ${ampm}`;
}

/**
 * Get the day abbreviation from a date string.
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Day abbreviation (e.g., "Mon", "Tue")
 */
export function getDayAbbreviation(dateStr: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	return DAY_ABBREVIATIONS[date.getDay()];
}

/**
 * Format hour for hourly forecast display.
 * @param hour - Hour (0-23)
 * @param format - '12h' or '24h'
 * @returns Formatted hour string (e.g., "2PM", "14:00")
 */
export function formatHour(hour: number, format: '12h' | '24h' = '12h'): string {
	if (format === '24h') {
		return `${String(hour).padStart(2, '0')}:00`;
	}

	if (hour === 0) return '12AM';
	if (hour === 12) return '12PM';
	if (hour < 12) return `${hour}AM`;
	return `${hour - 12}PM`;
}
