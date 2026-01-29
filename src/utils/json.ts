/**
 * Expected shape of the JSON response.
 * 'object' will match {...}
 * 'array' will match [...]
 * 'auto' will try object first, then array
 */
export type JsonShape = 'object' | 'array' | 'auto';

export interface ParseOptions {
	/** Expected shape of the response */
	shape?: JsonShape;
	/** Module name for error logging */
	moduleName?: string;
}

// ============================================
// JSON Repair Functions
// ============================================

/**
 * Common thinking block close tags from various models.
 */
const THINKING_CLOSERS = [
	'</think>',
	'</thinking>',
	'</thought>',
	'</reasoning>',
	'</reason>',
	'</reflection>',
	'[/THINK]',
	'[/THINKING]',
	'[/THOUGHT]',
	'[/REASONING]',
	'[/REASON]',
	'[/REFLECTION]',
];

/**
 * Strip content before thinking block closers and trim to JSON boundaries.
 */
function preprocessJsonResponse(input: string): string {
	let result = input;

	// Strip everything up to and including thinking close tags
	for (const closer of THINKING_CLOSERS) {
		const idx = result.toLowerCase().indexOf(closer.toLowerCase());
		if (idx !== -1) {
			result = result.slice(idx + closer.length);
		}
	}

	// Find the first { or [ and last } or ]
	const firstBrace = result.indexOf('{');
	const firstBracket = result.indexOf('[');
	const lastBrace = result.lastIndexOf('}');
	const lastBracket = result.lastIndexOf(']');

	// Determine start position (first { or [)
	let start = -1;
	if (firstBrace !== -1 && firstBracket !== -1) {
		start = Math.min(firstBrace, firstBracket);
	} else if (firstBrace !== -1) {
		start = firstBrace;
	} else if (firstBracket !== -1) {
		start = firstBracket;
	}

	// Determine end position (last } or ])
	let end = -1;
	if (lastBrace !== -1 && lastBracket !== -1) {
		end = Math.max(lastBrace, lastBracket);
	} else if (lastBrace !== -1) {
		end = lastBrace;
	} else if (lastBracket !== -1) {
		end = lastBracket;
	}

	// Extract JSON portion if valid boundaries found
	if (start !== -1 && end !== -1 && end > start) {
		result = result.slice(start, end + 1);
	}

	return result.trim();
}

/**
 * Fix directional/smart quotes to straight quotes.
 * " " „ → "
 * ' ' ‚ → '
 */
function repairSmartQuotes(jsonStr: string): string {
	return jsonStr
		.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
		.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
}

/**
 * Fix single-quoted strings to double-quoted.
 * Uses a state machine approach for reliability.
 */
function repairSingleQuotes(jsonStr: string): string {
	const result: string[] = [];
	let i = 0;
	let inDoubleQuote = false;
	let inSingleQuote = false;

	while (i < jsonStr.length) {
		const char = jsonStr[i];
		const prevChar = i > 0 ? jsonStr[i - 1] : '';

		if (char === '"' && prevChar !== '\\') {
			if (!inSingleQuote) {
				inDoubleQuote = !inDoubleQuote;
			}
			result.push(char);
		} else if (char === "'" && prevChar !== '\\') {
			if (!inDoubleQuote) {
				// Convert single quote to double quote
				result.push('"');
				inSingleQuote = !inSingleQuote;
			} else {
				// Inside double-quoted string, keep as-is
				result.push(char);
			}
		} else {
			result.push(char);
		}
		i++;
	}

	return result.join('');
}

/**
 * Fix unquoted keys in JSON strings.
 * Converts: { footwear: null } -> { "footwear": null }
 */
function repairUnquotedKeys(jsonStr: string): string {
	return jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
}

/**
 * Fix unquoted keys with trailing apostrophe typo.
 * mood': → mood:
 * Must run before repairUnquotedKeys and repairSingleQuotes.
 */
function repairUnquotedKeyApostropheTypo(jsonStr: string): string {
	// Match: after { or , (with any whitespace including newlines),
	// an identifier followed by apostrophe, then colon
	return jsonStr.replace(/([{,][\s]*)([a-zA-Z_][a-zA-Z0-9_]*)'([\s]*:)/g, '$1$2$3');
}

/**
 * Fix double-quoted keys with trailing apostrophe typo before colon.
 * "mood': → "mood":
 */
function repairKeyApostropheTypo(jsonStr: string): string {
	return jsonStr.replace(/"([^"]+)'(\s*:)/g, '"$1"$2');
}

/**
 * Fix the bizarre '. pattern that appears in some malformed output.
 * jacket'.null → jacket: null
 */
function repairDotApostropheTypo(jsonStr: string): string {
	return jsonStr.replace(/'\.(\s*)/g, ': ');
}

/**
 * Fix unquoted string values (risky but sometimes necessary).
 * Only attempts to fix values that look like unquoted strings.
 */
function repairUnquotedValues(jsonStr: string): string {
	return jsonStr.replace(/:\s*([a-zA-Z][^,}\]\n]*?)(\s*[,}\]])/g, (match, value, ending) => {
		const trimmed = value.trim();

		// Don't quote JSON literals
		if (['null', 'true', 'false'].includes(trimmed)) {
			return `: ${trimmed}${ending}`;
		}

		// Don't quote if already quoted
		if (/^["'].*["']$/.test(trimmed)) {
			return match;
		}

		// Don't quote numbers
		if (/^-?\d+\.?\d*$/.test(trimmed)) {
			return `: ${trimmed}${ending}`;
		}

		// Quote the unquoted string value
		const escaped = trimmed.replace(/"/g, '\\"');
		return `: "${escaped}"${ending}`;
	});
}

/**
 * Apply all repair functions to a JSON string.
 * Order matters - some repairs depend on others running first.
 */
function repairJson(jsonStr: string): string {
	let repaired = jsonStr;

	// Phase 1: Normalize smart quote characters to straight quotes
	repaired = repairSmartQuotes(repaired);

	// Phase 2: Fix apostrophe typos BEFORE single quote conversion
	// (otherwise the state machine thinks stray apostrophes are string delimiters)
	repaired = repairUnquotedKeyApostropheTypo(repaired);
	repaired = repairKeyApostropheTypo(repaired);
	repaired = repairDotApostropheTypo(repaired);

	// Phase 3: Convert single quotes to double quotes
	repaired = repairSingleQuotes(repaired);

	// Phase 4: Fix unquoted keys
	repaired = repairUnquotedKeys(repaired);

	// Phase 5: Fix unquoted values (riskiest, run last)
	repaired = repairUnquotedValues(repaired);

	return repaired;
}

// ============================================
// Main Parser
// ============================================

/**
 * Parse a JSON response from an LLM, handling markdown code blocks
 * and extracting the JSON object or array.
 */
export function parseJsonResponse<T = unknown>(response: string, options: ParseOptions = {}): T {
	const { shape = 'auto', moduleName = 'BlazeTracker' } = options;

	let jsonStr = response.trim();

	// Strip markdown code blocks
	const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (jsonMatch) {
		jsonStr = jsonMatch[1].trim();
	}

	// Preprocess: strip thinking blocks and extract JSON boundaries
	jsonStr = preprocessJsonResponse(jsonStr);

	// Extract based on expected shape
	if (shape === 'array') {
		const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
		if (arrayMatch) {
			jsonStr = arrayMatch[0];
		}
	} else if (shape === 'object') {
		const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
		if (objectMatch) {
			jsonStr = objectMatch[0];
		}
	} else {
		// Auto: try object first, then array
		const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
		const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);

		if (objectMatch && arrayMatch) {
			// Use whichever comes first in the string
			jsonStr =
				jsonStr.indexOf('{') < jsonStr.indexOf('[')
					? objectMatch[0]
					: arrayMatch[0];
		} else if (objectMatch) {
			jsonStr = objectMatch[0];
		} else if (arrayMatch) {
			jsonStr = arrayMatch[0];
		}
	}

	// Try parsing as-is first
	try {
		return JSON.parse(jsonStr) as T;
	} catch {
		// Try with repairs
		const repaired = repairJson(jsonStr);
		try {
			return JSON.parse(repaired) as T;
		} catch (e) {
			console.error(`[${moduleName}] Failed to parse response:`, e);
			console.error(`[${moduleName}] Original:`, jsonStr);
			console.error(`[${moduleName}] After repair:`, repaired);
			throw new Error(`Failed to parse ${moduleName} response as JSON`);
		}
	}
}

/**
 * Safely extract a string from an unknown value.
 */
export function asString(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

/**
 * Safely extract a string or null from an unknown value.
 */
export function asStringOrNull(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

/**
 * Safely extract a number from an unknown value.
 */
export function asNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' ? value : fallback;
}

/**
 * Safely extract a boolean from an unknown value.
 */
export function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/**
 * Safely extract an array of strings from an unknown value.
 */
export function asStringArray(value: unknown, maxItems?: number): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const filtered = value.filter((v): v is string => typeof v === 'string');
	return maxItems ? filtered.slice(0, maxItems) : filtered;
}

/**
 * Check if value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse a JSON response, returning null on failure instead of throwing.
 * Useful for prompt parseResponse functions.
 */
export function parseJSON<T = unknown>(response: string, options: ParseOptions = {}): T | null {
	try {
		return parseJsonResponse<T>(response, options);
	} catch {
		return null;
	}
}
