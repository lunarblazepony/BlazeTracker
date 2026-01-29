/**
 * V2 Prompt Types
 *
 * Defines the structure for all LLM prompts in the system.
 *
 * Key principles:
 * - System prompts are static (cacheable by LLM providers)
 * - User templates contain only dynamic placeholders
 * - Every prompt has a JSON schema for response validation
 * - Every prompt has a parseResponse function that validates and extracts data
 */

/**
 * JSON Schema type for response validation.
 * Simplified subset of JSON Schema for our needs.
 */
export interface JSONSchema {
	type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
	properties?: Record<string, JSONSchema>;
	items?: JSONSchema;
	required?: string[];
	enum?: (string | number | boolean)[];
	minimum?: number;
	maximum?: number;
	minLength?: number;
	maxLength?: number;
	minItems?: number;
	maxItems?: number;
	description?: string;
	additionalProperties?: boolean | JSONSchema;
}

/**
 * Placeholder definition for prompt templates.
 */
export interface Placeholder {
	/** Placeholder name without braces (e.g., "messages") */
	name: string;
	/** Description of what this placeholder contains */
	description: string;
	/** Example value for documentation */
	example: string;
}

/**
 * Prompt template definition.
 *
 * Each prompt has:
 * - Static system content (instructions, schema, examples) - cacheable
 * - Dynamic user template with {{placeholders}}
 * - JSON schema for response validation
 * - Parse function to extract and validate response
 */
export interface PromptTemplate<T = unknown> {
	/** Unique identifier for this prompt */
	name: string;

	/** Human-readable description of what this prompt does */
	description: string;

	/** Placeholders used in the user template */
	placeholders: Placeholder[];

	/**
	 * Static system prompt containing:
	 * - Instructions for the LLM
	 * - JSON schema description
	 * - Good examples (10+)
	 * - Bad examples (10+)
	 *
	 * This content is cacheable by LLM providers.
	 */
	systemPrompt: string;

	/**
	 * Dynamic user template with {{placeholders}}.
	 * Contains reinforcement and context-specific data.
	 */
	userTemplate: string;

	/** JSON schema for validating the response */
	responseSchema: JSONSchema;

	/** Default temperature for this prompt */
	defaultTemperature: number;

	/**
	 * Parse and validate the LLM response.
	 * Returns null if the response is invalid.
	 *
	 * @param response - Raw string response from LLM
	 * @returns Parsed and validated extraction result, or null on failure
	 */
	parseResponse: (response: string) => T | null;
}

/**
 * Result of building a prompt with placeholders filled in.
 */
export interface BuiltPrompt {
	system: string;
	user: string;
}

/**
 * Prompt category for organization.
 */
export type PromptCategory = 'initial' | 'event';

/**
 * Registry of all prompts by name.
 */
export type PromptRegistry = Record<string, PromptTemplate<unknown>>;

/**
 * Custom prompt overrides from user settings.
 */
export interface CustomPromptOverrides {
	[promptName: string]: {
		systemPrompt?: string;
		userTemplate?: string;
	};
}
