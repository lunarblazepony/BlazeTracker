/**
 * Training Data Store
 *
 * In-memory singleton store for captured LLM training pairs.
 * Session-scoped — data is exported then cleared, no persistence needed.
 */

import type { TrainingPair, TrainingMessage } from './types';
import { getV2Settings } from '../settings';

// ============================================
// Module-level state
// ============================================

let pairs: TrainingPair[] = [];

// ============================================
// Public API
// ============================================

/**
 * Check if training capture is enabled in settings.
 */
export function isTrainingCaptureEnabled(): boolean {
	try {
		return getV2Settings().v2TrainingCapture;
	} catch {
		return false;
	}
}

/**
 * Capture a raw LLM input/output pair.
 * Called by the TrainingCaptureGenerator after each generate() call.
 *
 * The pair is stored with parseSuccess=false until annotateLastCapture() is called.
 */
export function captureRawPair(params: {
	promptName: string;
	messages: TrainingMessage[];
	response: string;
	temperature: number;
	maxTokens: number;
}): void {
	pairs.push({
		promptName: params.promptName,
		messages: params.messages,
		response: params.response,
		parsedResult: undefined,
		parseSuccess: false,
		temperature: params.temperature,
		maxTokens: params.maxTokens,
		timestamp: new Date().toISOString(),
	});
}

/**
 * Annotate the most recent unannotated pair with parse results.
 *
 * Safe to call sequentially — extractors run one at a time so there's
 * no interleaving. Finds the last pair where parsedResult is still undefined.
 */
export function annotateLastCapture(annotation: {
	parsedResult?: unknown;
	parseSuccess: boolean;
	parseError?: string;
}): void {
	// Find the last unannotated pair (parsedResult === undefined)
	for (let i = pairs.length - 1; i >= 0; i--) {
		if (pairs[i].parsedResult === undefined && !pairs[i].parseError) {
			pairs[i].parsedResult = annotation.parsedResult ?? null;
			pairs[i].parseSuccess = annotation.parseSuccess;
			if (annotation.parseError) {
				pairs[i].parseError = annotation.parseError;
			}
			return;
		}
	}
}

/**
 * Get the number of captured pairs.
 */
export function getTrainingPairCount(): number {
	return pairs.length;
}

/**
 * Get all captured pairs (read-only copy).
 */
export function getTrainingPairs(): readonly TrainingPair[] {
	return pairs;
}

/**
 * Clear all captured pairs.
 */
export function clearTrainingPairs(): void {
	pairs = [];
}

/**
 * Export training pairs as JSONL string.
 * Each line is a self-contained JSON object.
 */
export function exportTrainingDataAsJsonl(): string {
	return pairs.map(pair => JSON.stringify(pair)).join('\n');
}

/**
 * Download training data as a JSONL file.
 * Creates a temporary <a> element to trigger browser download.
 */
export function downloadTrainingData(): void {
	if (pairs.length === 0) return;

	const jsonl = exportTrainingDataAsJsonl();
	const blob = new Blob([jsonl], { type: 'application/jsonl' });
	const url = URL.createObjectURL(blob);

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const filename = `blazetracker-training-${timestamp}.jsonl`;

	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();

	URL.revokeObjectURL(url);
}
