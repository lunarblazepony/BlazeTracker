// ============================================
// Granular Extraction Progress Tracking with Timing
// ============================================

/**
 * Granular extraction steps that map to individual extractors
 */
export type GranularStep =
	| 'idle'
	// Core extractors
	| 'time'
	| 'location'
	| 'climate'
	// Character extractors
	| 'char_presence'
	| 'char_initial_outfit' // infer outfits for newly appeared characters
	| 'char_parallel' // position, activity, mood, outfit, physical run together
	| 'char_legacy' // legacy extractCharacters() for initial
	// Location props
	| 'location_props'
	// Relationship extractors
	| 'rel_feelings'
	| 'rel_secrets'
	| 'rel_wants'
	| 'rel_status'
	// Scene & Event
	| 'scene'
	| 'event'
	| 'milestone_confirm'
	// Chapter
	| 'chapter'
	| 'complete';

// Legacy type alias for backward compatibility
export type ExtractionStep =
	| 'idle'
	| 'time'
	| 'location'
	| 'climate'
	| 'characters'
	| 'scene'
	| 'event'
	| 'complete';

/**
 * Timing data for a single extractor
 */
export interface ExtractorTiming {
	totalMs: number; // Sum of all recorded durations
	count: number; // Number of recordings
}

/**
 * Timing data stored in localStorage
 */
export interface TimingData {
	user: Record<string, ExtractorTiming>;
	assistant: Record<string, ExtractorTiming>;
	version: number; // For future migrations
}

/**
 * Progress information passed to callbacks
 */
export interface GranularExtractionProgress {
	step: GranularStep;
	percentComplete: number; // 0-100
	label: string; // "[45%] Extracting character presence..."
}

// Legacy interface for backward compatibility
export interface ExtractionProgress {
	step: ExtractionStep;
	stepIndex: number;
	totalSteps: number;
}

export interface EnabledSteps {
	time: boolean;
	location: boolean;
	climate: boolean;
	characters: boolean;
	scene: boolean;
	event: boolean;
}

type ProgressCallback = (progress: GranularExtractionProgress) => void;

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'blazetracker_extraction_timing';
const TIMING_VERSION = 1;

/**
 * Default time estimates (in ms) for each step before we have timing data
 */
const DEFAULT_ESTIMATES: Record<GranularStep, number> = {
	idle: 0,
	time: 1500,
	location: 2000,
	climate: 1500,
	char_presence: 2000,
	char_initial_outfit: 2000, // Infer outfits for new characters
	char_parallel: 3000, // Parallel block takes longer
	char_legacy: 3000,
	location_props: 1500,
	rel_feelings: 1500,
	rel_secrets: 1500,
	rel_wants: 1500,
	rel_status: 1500,
	scene: 2000,
	event: 2500,
	milestone_confirm: 1000,
	chapter: 2000,
	complete: 0,
};

/**
 * Human-readable labels for each step
 */
const STEP_LABELS: Record<GranularStep, string> = {
	idle: 'Ready',
	time: 'Extracting time',
	location: 'Extracting location',
	climate: 'Extracting climate',
	char_presence: 'Detecting characters',
	char_initial_outfit: 'Inferring initial outfits',
	char_parallel: 'Extracting character details',
	char_legacy: 'Extracting characters',
	location_props: 'Extracting location props',
	rel_feelings: 'Extracting relationship feelings',
	rel_secrets: 'Extracting relationship secrets',
	rel_wants: 'Extracting relationship wants',
	rel_status: 'Extracting relationship status',
	scene: 'Extracting scene',
	event: 'Extracting events',
	milestone_confirm: 'Confirming milestones',
	chapter: 'Detecting chapter boundary',
	complete: 'Complete',
};

// ============================================
// Module State
// ============================================

let currentStep: GranularStep = 'idle';
let progressCallback: ProgressCallback | null = null;
let plannedSteps: GranularStep[] = [];
let completedSteps: GranularStep[] = [];
let isAssistantMessage = false;
let timingData: TimingData | null = null;

// Default: all steps enabled (for legacy compatibility)
let enabledSteps: EnabledSteps = {
	time: true,
	location: true,
	climate: true,
	characters: true,
	scene: true,
	event: true,
};

// All possible extraction steps (in order) - for legacy compatibility
const ALL_EXTRACTION_STEPS: ExtractionStep[] = [
	'time',
	'location',
	'climate',
	'characters',
	'scene',
	'event',
];

// ============================================
// Timing Data Persistence
// ============================================

/**
 * Load timing data from localStorage
 */
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

	// Initialize with empty data
	timingData = {
		user: {},
		assistant: {},
		version: TIMING_VERSION,
	};
	return timingData;
}

/**
 * Save timing data to localStorage
 */
function saveTimingData(): void {
	if (timingData) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(timingData));
		} catch {
			// Ignore storage errors
		}
	}
}

/**
 * Record the timing for a completed step
 */
export function recordStepTiming(
	step: GranularStep,
	durationMs: number,
	isAssistant: boolean,
): void {
	const data = loadTimingData();
	const bucket = isAssistant ? data.assistant : data.user;

	if (!bucket[step]) {
		bucket[step] = { totalMs: 0, count: 0 };
	}

	bucket[step].totalMs += durationMs;
	bucket[step].count += 1;

	saveTimingData();
}

/**
 * Get the average duration for a step
 */
function getStepAverage(step: GranularStep, isAssistant: boolean): number {
	const data = loadTimingData();
	const bucket = isAssistant ? data.assistant : data.user;
	const timing = bucket[step];

	if (timing && timing.count > 0) {
		return timing.totalMs / timing.count;
	}

	return DEFAULT_ESTIMATES[step];
}

// ============================================
// Progress Calculation
// ============================================

/**
 * Calculate the percentage weight of a step relative to total planned steps
 * (Reserved for future use - e.g., per-step progress detail)
 */
function _getStepPercentage(
	step: GranularStep,
	steps: GranularStep[],
	isAssistant: boolean,
): number {
	const totalMs = steps.reduce((sum, s) => sum + getStepAverage(s, isAssistant), 0);
	if (totalMs === 0) return 0;

	return (getStepAverage(step, isAssistant) / totalMs) * 100;
}

/**
 * Calculate cumulative progress based on completed steps
 */
function calculateProgress(
	completed: GranularStep[],
	planned: GranularStep[],
	isAssistant: boolean,
): number {
	if (planned.length === 0) return 0;

	const totalMs = planned.reduce((sum, s) => sum + getStepAverage(s, isAssistant), 0);
	if (totalMs === 0) return 0;

	const completedMs = completed.reduce((sum, s) => sum + getStepAverage(s, isAssistant), 0);

	return Math.min(100, Math.round((completedMs / totalMs) * 100));
}

// ============================================
// Public API
// ============================================

/**
 * Register a callback to receive progress updates.
 */
export function onExtractionProgress(callback: ProgressCallback | null): void {
	progressCallback = callback;
}

/**
 * Configure which extraction steps are enabled for the current extraction.
 * Call this before starting extraction to ensure progress shows correct totals.
 */
export function setEnabledSteps(steps: EnabledSteps): void {
	enabledSteps = { ...steps };
}

/**
 * Get the list of currently enabled extraction steps (legacy compatibility).
 */
export function getEnabledSteps(): ExtractionStep[] {
	return ALL_EXTRACTION_STEPS.filter(step => enabledSteps[step as keyof EnabledSteps]);
}

/**
 * Set the planned steps for this extraction run.
 * This determines the total for percentage calculation.
 */
export function setPlannedSteps(steps: GranularStep[], isAssistant: boolean): void {
	plannedSteps = steps.filter(s => s !== 'idle' && s !== 'complete');
	completedSteps = [];
	isAssistantMessage = isAssistant;
	currentStep = 'idle';
}

/**
 * Mark a step as completed (for percentage tracking)
 */
export function markStepCompleted(step: GranularStep): void {
	if (!completedSteps.includes(step) && step !== 'idle' && step !== 'complete') {
		completedSteps.push(step);
	}
}

/**
 * Check if a step has been completed
 */
export function isStepCompleted(step: GranularStep): boolean {
	return completedSteps.includes(step);
}

/**
 * Set the current extraction step and notify listeners.
 */
export function setGranularStep(step: GranularStep): void {
	currentStep = step;

	if (progressCallback) {
		const percentComplete = calculateProgress(
			completedSteps,
			plannedSteps,
			isAssistantMessage,
		);
		const baseLabel = STEP_LABELS[step];

		// Format label with percentage for active steps
		let label: string;
		if (step === 'idle' || step === 'complete') {
			label = baseLabel;
		} else {
			label = `[${percentComplete}%] ${baseLabel}...`;
		}

		progressCallback({
			step,
			percentComplete,
			label,
		});
	}
}

/**
 * Legacy: Set the current extraction step (maps to granular steps).
 */
export function setExtractionStep(step: ExtractionStep): void {
	// Map legacy steps to granular steps
	const granularMap: Record<ExtractionStep, GranularStep> = {
		idle: 'idle',
		time: 'time',
		location: 'location',
		climate: 'climate',
		characters: 'char_legacy', // Default to legacy for backward compatibility
		scene: 'scene',
		event: 'event',
		complete: 'complete',
	};

	setGranularStep(granularMap[step]);
}

/**
 * Get the current extraction step.
 */
export function getExtractionStep(): ExtractionStep {
	// Map granular steps back to legacy
	const legacyMap: Partial<Record<GranularStep, ExtractionStep>> = {
		idle: 'idle',
		time: 'time',
		location: 'location',
		climate: 'climate',
		char_presence: 'characters',
		char_parallel: 'characters',
		char_legacy: 'characters',
		location_props: 'location', // Props are part of location
		rel_feelings: 'characters', // Relationships shown as characters for legacy
		rel_secrets: 'characters',
		rel_wants: 'characters',
		rel_status: 'characters',
		scene: 'scene',
		event: 'event',
		milestone_confirm: 'event',
		chapter: 'event',
		complete: 'complete',
	};

	return legacyMap[currentStep] ?? 'idle';
}

/**
 * Get the current granular step.
 */
export function getGranularStep(): GranularStep {
	return currentStep;
}

/**
 * Get a human-readable label for a granular step.
 */
export function getGranularStepLabel(step: GranularStep): string {
	return STEP_LABELS[step];
}

/**
 * Get a human-readable label for a legacy step.
 */
export function getStepLabel(step: ExtractionStep): string {
	const labels: Record<ExtractionStep, string> = {
		idle: 'Ready',
		time: 'Extracting time...',
		location: 'Extracting location...',
		climate: 'Extracting climate...',
		characters: 'Extracting characters...',
		scene: 'Extracting scene...',
		event: 'Extracting events...',
		complete: 'Complete',
	};
	return labels[step];
}

/**
 * Clear all timing data (useful for debugging/testing)
 */
export function clearTimingData(): void {
	timingData = null;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Ignore storage errors
	}
}
