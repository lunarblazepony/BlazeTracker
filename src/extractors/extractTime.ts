import type { STContext } from '../types/st';
import type { ExtractedData } from 'sillytavern-utils-lib/types';
import type { Message } from 'sillytavern-utils-lib';
import { Generator } from 'sillytavern-utils-lib';
import { getSettings } from '../ui/settings';

const generator = new Generator();

// ============================================
// Types
// ============================================

export interface NarrativeDateTime {
  year: number;
  month: number;      // 1-12
  day: number;        // 1-31
  hour: number;       // 0-23
  minute: number;     // 0-59
  second: number;     // 0-59
  dayOfWeek: string;  // "Monday", "Tuesday", etc.
}

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
// Schemas
// ============================================

const DATETIME_SCHEMA = {
  type: 'object',
  properties: {
    year: { type: 'number', description: 'Four digit year, e.g. 2024. Infer from context or use a reasonable default.' },
    month: { type: 'number', description: 'Month 1-12. Infer from seasonal context, weather, or use a reasonable default.' },
    day: { type: 'number', description: 'Day of month 1-31. Infer if possible or use a reasonable default.' },
    hour: { type: 'number', description: 'Hour 0-23 in 24-hour format.' },
    minute: { type: 'number', description: 'Minute 0-59.' },
    second: { type: 'number', description: 'Second 0-59. Usually 0 unless specifically mentioned.' },
  },
  required: ['year', 'month', 'day', 'hour', 'minute', 'second'],
};

const DATETIME_EXAMPLE = JSON.stringify({
  year: 2024,
  month: 6,
  day: 15,
  hour: 14,
  minute: 30,
  second: 0,
}, null, 2);

const DELTA_SCHEMA = {
  type: 'object',
  properties: {
    hours: { type: 'number', description: 'Hours passed. 0 if less than an hour.' },
    minutes: { type: 'number', description: 'Minutes passed (0-59). Added to hours.' },
    seconds: { type: 'number', description: 'Seconds passed (0-59). Usually 0 unless specifically mentioned.' },
  },
  required: ['hours', 'minutes', 'seconds'],
};

const DELTA_EXAMPLE = JSON.stringify({
  hours: 0,
  minutes: 5,
  seconds: 0,
}, null, 2);

// ============================================
// Prompts
// ============================================

const DATETIME_PROMPT = `Analyze this roleplay scene opening and determine the narrative date and time. You must only return valid JSON with no commentary.

<instructions>
- Determine the date and time when this scene takes place.
- Look for explicit mentions: "Monday morning", "3pm", "June 15th", "winter evening", etc.
- Look for contextual clues: weather, lighting, activities, meals, seasons.
- If the year is not specified, infer from context or use a reasonable modern year.
- If the month is not specified, infer from seasonal/weather clues or use a reasonable default.
- If the day is not specified, use a reasonable default (e.g., 15 for mid-month).
- Always provide complete values for all fields - never omit anything.
- Use 24-hour format for the hour field.
</instructions>

<scene_opening>
{{message}}
</scene_opening>

<schema>
${JSON.stringify(DATETIME_SCHEMA, null, 2)}
</schema>

<output_example>
${DATETIME_EXAMPLE}
</output_example>

Extract the narrative date and time as valid JSON:`;

const DELTA_PROMPT = `Analyze these roleplay messages and determine how much narrative time has passed. You must only return valid JSON with no commentary.

<instructions>
- Determine how much time passes WITHIN this message.
- Look for explicit time jumps: "an hour later", "after a few minutes", "the next morning".
- Look for implicit time passage: travel, sleeping, waiting, activities with known durations.
- If the message is just dialogue or immediate action with no time skip, return all zeros.
- Conversations without time skips: 1-2 minutes typically.
- Walking somewhere nearby: 5-15 minutes.
- Napping: 1-3 hours typically but consider currentTime.
- Sleeping: 6-10 hours typically but dependent on currentTime.
- "A few minutes": 3-5 minutes.
- "A while": 15-30 minutes.
- "Some time": 30-60 minutes.
- Be conservative - if unsure, prefer smaller time jumps.
</instructions>

<current_time>
{{currentTime}}
</current_time>

<message>
{{message}}
</message>

<schema>
${JSON.stringify(DELTA_SCHEMA, null, 2)}
</schema>

<output_example>
${DELTA_EXAMPLE}
</output_example>

Extract the time delta as valid JSON:`;

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
  messages: string,  // Add: formatted message window, same as main extraction
  abortSignal?: AbortSignal
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
  abortSignal?: AbortSignal
): Promise<NarrativeDateTime> {
  const prompt = DATETIME_PROMPT.replace('{{message}}', message);

  const messages: Message[] = [
    { role: 'system', content: 'You are a time analysis agent. Return only valid JSON.' },
    { role: 'user', content: prompt }
  ];

  const response = await makeGeneratorRequest(messages, profileId, 100, abortSignal);
  const parsed = parseJsonResponse(response);

  return validateDateTime(parsed);
}

async function extractTimeDelta(
  message: string,
  profileId: string,
  abortSignal?: AbortSignal
): Promise<TimeDelta> {
  const currentTimeStr = formatTimeForPrompt(timeTracker.currentDate);

  const prompt = DELTA_PROMPT
    .replace('{{message}}', message)
    .replace('{{currentTime}}', currentTimeStr);

  const messages: Message[] = [
    { role: 'system', content: 'You are a time analysis agent. Return only valid JSON.' },
    { role: 'user', content: prompt }
  ];

  const response = await makeGeneratorRequest(messages, profileId, 50, abortSignal);
  const parsed = parseJsonResponse(response);

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

  const cappedSeconds = (isLeap && wasLeap)
    ? thresholdSeconds
    : deltaSeconds;

  // Apply to Date object - handles all edge cases (month overflow, leap years, etc.)
  timeTracker.currentDate = new Date(
    timeTracker.currentDate.getTime() + cappedSeconds * 1000
  );

  // Store the raw delta (not capped) for next comparison
  timeTracker.lastDeltaSeconds = deltaSeconds;
}

// ============================================
// Internal: Conversion Utilities
// ============================================

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

function dateToNarrative(date: Date): NarrativeDateTime {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,  // JS months are 0-indexed
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
    narrative.month - 1,  // JS months are 0-indexed
    narrative.day,
    narrative.hour,
    narrative.minute,
    narrative.second
  );
}

function formatTimeForPrompt(date: Date): string {
  const narrative = dateToNarrative(date);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const hour12 = narrative.hour % 12 || 12;
  const ampm = narrative.hour < 12 ? 'AM' : 'PM';
  const minuteStr = String(narrative.minute).padStart(2, '0');

  return `${narrative.dayOfWeek}, ${monthNames[narrative.month - 1]} ${narrative.day}, ${narrative.year} at ${hour12}:${minuteStr} ${ampm}`;
}

// ============================================
// Internal: LLM Communication
// ============================================

function makeGeneratorRequest(
  messages: Message[],
  profileId: string,
  maxTokens: number,
  abortSignal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    const abortController = new AbortController();

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => abortController.abort());
    }

    generator.generateRequest(
      {
        profileId,
        prompt: messages,
        maxTokens,
        custom: { signal: abortController.signal },
        overridePayload: {
          temperature: 0.3,  // Lower temp for more consistent time extraction
        }
      },
      {
        abortController,
        onFinish: (requestId, data, error) => {
          if (error) {
            return reject(error);
          }
          if (!data) {
            return reject(new DOMException('Request aborted', 'AbortError'));
          }
          const content = (data as ExtractedData).content;
          if (typeof content === 'string') {
            resolve(content);
          } else {
            resolve(JSON.stringify(content));
          }
        },
      },
    );
  });
}

// ============================================
// Internal: Response Parsing
// ============================================

function parseJsonResponse(response: string): any {
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find JSON object if there's other text
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[BlazeTracker/Time] Failed to parse response:', e);
    console.error('[BlazeTracker/Time] Response was:', response);
    throw new Error('Failed to parse time extraction response as JSON');
  }
}

function validateDateTime(data: any): NarrativeDateTime {
  // Parse and clamp year/month first
  const year = typeof data.year === 'number' ? clamp(data.year, 1, 9999) : new Date().getFullYear();
  const month = typeof data.month === 'number' ? clamp(data.month, 1, 12) : 6;

  // Clamp day to valid range for this month (handles Feb 30 -> Feb 28/29, etc.)
  const maxDay = getDaysInMonth(year, month);
  const day = typeof data.day === 'number' ? clamp(data.day, 1, maxDay) : 15;

  const result: NarrativeDateTime = {
    year,
    month,
    day,
    hour: typeof data.hour === 'number' ? clamp(data.hour, 0, 23) : 12,
    minute: typeof data.minute === 'number' ? clamp(data.minute, 0, 59) : 0,
    second: typeof data.second === 'number' ? clamp(data.second, 0, 59) : 0,
    dayOfWeek: '', // Will be calculated
  };

  // Get correct day of week from Date object
  const date = narrativeToDate(result);
  result.dayOfWeek = DAYS_OF_WEEK[date.getDay()];

  return result;
}

function getDaysInMonth(year: number, month: number): number {
  // Day 0 of next month = last day of this month
  return new Date(year, month, 0).getDate();
}

function validateDelta(data: any): TimeDelta {
  return {
    hours: typeof data.hours === 'number' ? Math.max(0, Math.floor(data.hours)) : 0,
    minutes: typeof data.minutes === 'number' ? clamp(Math.floor(data.minutes), 0, 59) : 0,
    seconds: typeof data.seconds === 'number' ? clamp(Math.floor(data.seconds), 0, 59) : 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
