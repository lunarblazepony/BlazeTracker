/**
 * Training Data Capture Types
 *
 * Types for capturing LLM input/output pairs for fine-tuning training data.
 * Uses conversation-format messages (pre-formatting) and JSONL export.
 */

/**
 * A single message in conversation format.
 */
export interface TrainingMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * A captured LLM input/output pair.
 *
 * Stores messages in conversation format (before API-specific formatting)
 * along with the raw response and parse metadata.
 */
export interface TrainingPair {
	/** Human-readable prompt name (e.g. "timeInitial", "locationChange", "shakeup") */
	promptName: string;
	/** Input messages in conversation format — system + user (pre-formatting) */
	messages: TrainingMessage[];
	/** Raw LLM response text */
	response: string;
	/** Parsed result object (null until annotated) */
	parsedResult?: unknown;
	/** Whether parsing succeeded */
	parseSuccess: boolean;
	/** Parse error message if failed */
	parseError?: string;
	/** Temperature used for generation */
	temperature: number;
	/** Max tokens setting */
	maxTokens: number;
	/** ISO timestamp */
	timestamp: string;
}
