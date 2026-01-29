// ============================================
// Common Placeholder Documentation
// ============================================

import type { PromptPlaceholder } from './types';

export const COMMON_PLACEHOLDERS: Record<string, PromptPlaceholder> = {
	messages: {
		name: '{{messages}}',
		description: 'Recent roleplay messages formatted as "Name: message content"',
		example: 'Elena: *She walked into the bar*\n\nMarcus: "You made it."',
	},
	characterInfo: {
		name: '{{characterInfo}}',
		description: 'Character name and description (only on initial extraction)',
		example: 'Name: Elena\nDescription: A cunning thief with a heart of gold...',
	},
	userInfo: {
		name: '{{userInfo}}',
		description: 'User persona name and description (only on initial extraction)',
		example: 'Name: Marcus\nDescription: A grizzled detective...',
	},
	previousState: {
		name: '{{previousState}}',
		description: 'JSON of the previous state for this extractor',
		example: '{ "area": "Downtown", "place": "Bar", ... }',
	},
	schema: {
		name: '{{schema}}',
		description: 'JSON schema defining the expected output format',
		example: '{ "type": "object", "properties": { ... } }',
	},
	schemaExample: {
		name: '{{schemaExample}}',
		description: 'Example output matching the schema',
		example: '{ "area": "Downtown Seattle", ... }',
	},
	narrativeTime: {
		name: '{{narrativeTime}}',
		description: 'Current narrative time as formatted string',
		example: 'Monday, June 15, 2024 at 2:30 PM',
	},
	location: {
		name: '{{location}}',
		description: 'Current location summary',
		example: 'Downtown Seattle - The Rusty Nail bar (Corner booth)',
	},
	currentTime: {
		name: '{{currentTime}}',
		description: 'Current narrative time for context',
		example: 'Monday, June 15, 2024 at 2:30 PM',
	},
	charactersSummary: {
		name: '{{charactersSummary}}',
		description: 'Brief summary of characters present with moods/activities',
		example: 'Elena: anxious, hopeful - Watching the door\nMarcus: scheming - Drinking wine',
	},
	currentRelationships: {
		name: '{{currentRelationships}}',
		description: 'Current relationship states between characters',
		example: 'Elena & Marcus (complicated): Elena feels trusting, hopeful; Marcus feels suspicious, curious',
	},
	currentEvents: {
		name: '{{currentEvents}}',
		description: 'Recent events in the current chapter',
		example: '- Marcus revealed his true identity\n- Elena agreed to help with the heist',
	},
	chapterSummaries: {
		name: '{{chapterSummaries}}',
		description: 'Summaries of previous chapters',
		example: 'Chapter 1: Elena and Marcus meet at the bar...',
	},
	milestoneType: {
		name: '{{milestoneType}}',
		description: 'The type of milestone to describe (e.g., first_kiss, first_embrace)',
		example: 'first_kiss',
	},
	characterPair: {
		name: '{{characterPair}}',
		description: 'The two characters involved in the milestone',
		example: 'Elena and Marcus',
	},
	timeOfDay: {
		name: '{{timeOfDay}}',
		description: 'The time of day when the milestone occurred',
		example: 'evening',
	},
	props: {
		name: '{{props}}',
		description: 'Nearby objects/props in the scene',
		example: 'worn leather couch, coffee table, dim lamp',
	},
	characters: {
		name: '{{characters}}',
		description: 'Character positions, moods, and attire',
		example: 'Elena: Position: sitting on couch | Mood: nervous, hopeful | Wearing: torso: blue dress',
	},
	relationship: {
		name: '{{relationship}}',
		description: 'Current relationship status and feelings between characters',
		example: 'Elena & Marcus (close): Elena feels: trusting, attracted | Marcus feels: protective, conflicted',
	},
	eventDetail: {
		name: '{{eventDetail}}',
		description: 'Specific detail about what happened (e.g., what secret was shared)',
		example: "Elena's past as a thief",
	},
};
