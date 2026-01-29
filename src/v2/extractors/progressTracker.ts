/**
 * V2 Extraction Progress Tracker
 *
 * Tracks progress using sections (phases) rather than individual extractors.
 * This handles variable numbers of per-character/per-pair extractors gracefully.
 */

// ============================================
// Types
// ============================================

export interface V2ExtractionProgress {
	step: string;
	percentComplete: number;
	label: string;
}

interface SectionTiming {
	totalMs: number;
	count: number;
}

interface TimingData {
	sections: Record<string, SectionTiming>;
	version: number;
}

type ProgressCallback = (progress: V2ExtractionProgress) => void;

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'blazetracker_v2_section_timing';
const TIMING_VERSION = 2;

/**
 * Sections in order of execution for event extraction.
 * Each section may contain multiple extractors, but progress is tracked per-section.
 */
export const EVENT_SECTIONS = [
	'core', // time, location, climate, topic/tone, tension
	'characterPresence', // presence change
	'perCharacter', // all per-character extractors (outfit, mood, activity, etc.)
	'props', // props change (after outfit to integrate clothing)
	'relationshipSubjects', // relationship subject extraction
	'perPair', // all per-pair extractors (feelings, secrets, wants, status)
	'narrative', // narrative description
	'chapter', // chapter end detection
] as const;

export type SectionName = (typeof EVENT_SECTIONS)[number];

/**
 * Sections for initial extraction (different from event extraction).
 */
export const INITIAL_SECTIONS = [
	'initial_time',
	'initial_location',
	'initial_climate',
	'initial_scene',
	'initial_characters',
	'initial_relationships',
	'initial_props',
] as const;

export type InitialSectionName = (typeof INITIAL_SECTIONS)[number];

/** Default time estimates (ms) per section before we have real data */
const DEFAULT_SECTION_ESTIMATES: Record<string, number> = {
	// Event extraction sections
	core: 8000, // time + location + climate + topic/tone + tension
	characterPresence: 2000,
	perCharacter: 12000, // variable, but average across typical character counts
	props: 2000,
	relationshipSubjects: 2000,
	perPair: 10000, // variable, but average across typical pair counts
	narrative: 2500,
	chapter: 2000,

	// Initial extraction sections
	initial_time: 1500,
	initial_location: 2000,
	initial_climate: 1500,
	initial_scene: 2000,
	initial_characters: 3000,
	initial_relationships: 2500,
	initial_props: 1500,
};

// ============================================
// Module State
// ============================================

let timingData: TimingData | null = null;
let progressCallback: ProgressCallback | null = null;

// Current extraction run state
let plannedSections: string[] = [];
let completedSections: string[] = [];
let currentSection: string | null = null;
let sectionStartTime: number = 0;
let currentLabel: string = '';

// ============================================
// Timing Data Persistence
// ============================================

function loadTimingData(): TimingData {
	if (timingData !== null) {
		return timingData;
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as TimingData;
			if (parsed.version === TIMING_VERSION) {
				timingData = parsed;
				return timingData;
			}
		}
	} catch {
		// Ignore parse errors
	}

	timingData = {
		sections: {},
		version: TIMING_VERSION,
	};
	return timingData;
}

function saveTimingData(): void {
	if (timingData) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(timingData));
		} catch {
			// Ignore storage errors
		}
	}
}

function getSectionAverage(name: string): number {
	const data = loadTimingData();
	const timing = data.sections[name];

	if (timing && timing.count > 0) {
		return timing.totalMs / timing.count;
	}

	return DEFAULT_SECTION_ESTIMATES[name] ?? 3000;
}

function recordSectionTiming(name: string, durationMs: number): void {
	const data = loadTimingData();

	if (!data.sections[name]) {
		data.sections[name] = { totalMs: 0, count: 0 };
	}

	data.sections[name].totalMs += durationMs;
	data.sections[name].count += 1;

	saveTimingData();
}

// ============================================
// Progress Calculation
// ============================================

function calculateProgress(): number {
	if (plannedSections.length === 0) return 0;

	// Calculate total expected time for all sections
	const totalExpectedMs = plannedSections.reduce(
		(sum, name) => sum + getSectionAverage(name),
		0,
	);

	if (totalExpectedMs === 0) return 0;

	// Calculate completed time
	const completedMs = completedSections.reduce(
		(sum, name) => sum + getSectionAverage(name),
		0,
	);

	// Add elapsed time for current section (interpolate during run)
	let elapsedMs = completedMs;
	if (currentSection && sectionStartTime > 0) {
		const currentElapsed = Date.now() - sectionStartTime;
		const currentExpected = getSectionAverage(currentSection);
		// Cap at 95% of expected time to avoid exceeding during slow sections
		elapsedMs += Math.min(currentElapsed, currentExpected * 0.95);
	}

	return Math.min(99, Math.round((elapsedMs / totalExpectedMs) * 100));
}

function emitProgress(label: string): void {
	if (!progressCallback) return;

	const percentComplete = calculateProgress();

	progressCallback({
		step: currentSection ?? 'idle',
		percentComplete,
		label,
	});
}

// ============================================
// Public API
// ============================================

/**
 * Register a callback to receive progress updates.
 */
export function setProgressCallback(callback: ProgressCallback | null): void {
	progressCallback = callback;
}

/**
 * Start a new extraction run with planned sections.
 */
export function startExtractionRun(sectionNames: string[]): void {
	plannedSections = [...sectionNames];
	completedSections = [];
	currentSection = null;
	sectionStartTime = 0;
	currentLabel = '';

	emitProgress('Starting extraction...');
}

/**
 * Start a section.
 */
export function startSection(name: string, label?: string): void {
	currentSection = name;
	sectionStartTime = Date.now();
	currentLabel = label ?? `Processing ${name}...`;

	emitProgress(currentLabel);
}

/**
 * Update the label for the current section (for showing sub-progress).
 */
export function updateSectionLabel(label: string): void {
	currentLabel = label;
	emitProgress(label);
}

/**
 * Complete a section and record its timing.
 */
export function completeSection(name: string): void {
	if (sectionStartTime > 0 && currentSection === name) {
		const duration = Date.now() - sectionStartTime;
		recordSectionTiming(name, duration);
	}

	if (!completedSections.includes(name)) {
		completedSections.push(name);
	}

	currentSection = null;
	sectionStartTime = 0;

	// Emit updated progress
	const remaining = plannedSections.length - completedSections.length;
	if (remaining > 0) {
		emitProgress(
			`${completedSections.length}/${plannedSections.length} phases complete`,
		);
	}
}

/**
 * Mark extraction run as complete.
 */
export function completeExtractionRun(): void {
	currentSection = null;
	sectionStartTime = 0;

	if (progressCallback) {
		progressCallback({
			step: 'complete',
			percentComplete: 100,
			label: 'Extraction complete',
		});
	}
}

/**
 * Clear all timing data (for testing/debugging).
 */
export function clearTimingData(): void {
	timingData = null;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Ignore storage errors
	}
}

/**
 * Get timing stats for debugging.
 */
export function getTimingStats(): Record<string, { avgMs: number; count: number }> {
	const data = loadTimingData();
	const stats: Record<string, { avgMs: number; count: number }> = {};

	for (const [name, timing] of Object.entries(data.sections)) {
		stats[name] = {
			avgMs: timing.count > 0 ? Math.round(timing.totalMs / timing.count) : 0,
			count: timing.count,
		};
	}

	return stats;
}

/**
 * @deprecated No longer used - calibrating mode is now determined by messageId < 3 in ProjectionDisplay.
 * Check if we're still calibrating timing estimates.
 * Returns true if we have fewer than 2 samples for most sections.
 */
export function isCalibrating(): boolean {
	const data = loadTimingData();
	const sectionNames = Object.keys(DEFAULT_SECTION_ESTIMATES);

	// Count how many sections have >= 2 samples
	let calibratedCount = 0;
	for (const name of sectionNames) {
		const timing = data.sections[name];
		if (timing && timing.count >= 2) {
			calibratedCount++;
		}
	}

	// Consider calibrated if at least half the sections have enough data
	return calibratedCount < sectionNames.length / 2;
}

// ============================================
// Legacy API (for backwards compatibility)
// ============================================

/**
 * @deprecated Use startSection instead. This is kept for backwards compatibility.
 */
export function startExtractor(_name: string, label?: string): void {
	// Update label without changing section
	if (label) {
		currentLabel = label;
		emitProgress(label);
	}
}

/**
 * @deprecated Use completeSection instead. This is kept for backwards compatibility.
 */
export function completeExtractor(_name: string): void {
	// No-op - section completion handles progress
}

/**
 * @deprecated No longer needed with section-based tracking.
 */
export function addPlannedExtractors(_names: string[]): void {
	// No-op - sections are pre-planned
}
