/**
 * No-Op Prompt
 *
 * A placeholder prompt for extractors that don't use LLM.
 * Used by the forecast extractor which uses the procedural weather system.
 */

import type { PromptTemplate } from '../types';

/**
 * No-op prompt for extractors that don't use LLM.
 */
export const noPrompt: PromptTemplate<null> = {
	name: 'noPrompt',
	description: 'Placeholder for extractors that do not use LLM prompts',
	placeholders: [],
	systemPrompt: '',
	userTemplate: '',
	responseSchema: {
		type: 'null',
	},
	defaultTemperature: 0,
	parseResponse: () => null,
};
