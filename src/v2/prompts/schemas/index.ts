/**
 * V2 JSON Schemas for LLM Response Validation
 *
 * These schemas define the expected structure of LLM responses.
 * They are used both for validation and to generate schema descriptions in prompts.
 */

import type { JSONSchema } from '../types';

// ============================================
// Common Schema Components
// ============================================

export const reasoningField: JSONSchema = {
	type: 'string',
	description: 'Your reasoning process before giving the answer',
};

export const booleanField: JSONSchema = {
	type: 'boolean',
};

export const stringField: JSONSchema = {
	type: 'string',
};

export const numberField: JSONSchema = {
	type: 'number',
};

export const stringArrayField: JSONSchema = {
	type: 'array',
	items: { type: 'string' },
};

export const characterPairField: JSONSchema = {
	type: 'array',
	items: { type: 'string' },
	minItems: 2,
	maxItems: 2,
	description: 'Two character names, alphabetically sorted',
};

// ============================================
// Time Schemas
// ============================================

export const extractedDateTimeSchema: JSONSchema = {
	type: 'object',
	properties: {
		year: { type: 'number', description: 'Four-digit year (e.g., 2024)' },
		month: { type: 'number', minimum: 1, maximum: 12, description: 'Month 1-12' },
		day: { type: 'number', minimum: 1, maximum: 31, description: 'Day of month' },
		hour: {
			type: 'number',
			minimum: 0,
			maximum: 23,
			description: 'Hour in 24-hour format',
		},
		minute: { type: 'number', minimum: 0, maximum: 59, description: 'Minutes' },
		second: { type: 'number', minimum: 0, maximum: 59, description: 'Seconds' },
		dayOfWeek: {
			type: 'string',
			enum: [
				'Sunday',
				'Monday',
				'Tuesday',
				'Wednesday',
				'Thursday',
				'Friday',
				'Saturday',
			],
			description: 'Day of the week',
		},
	},
	required: ['year', 'month', 'day', 'hour', 'minute', 'second', 'dayOfWeek'],
};

export const timeDeltaSchema: JSONSchema = {
	type: 'object',
	properties: {
		days: { type: 'number', minimum: 0, description: 'Days elapsed' },
		hours: { type: 'number', minimum: 0, maximum: 23, description: 'Hours elapsed' },
		minutes: {
			type: 'number',
			minimum: 0,
			maximum: 59,
			description: 'Minutes elapsed',
		},
		seconds: {
			type: 'number',
			minimum: 0,
			maximum: 59,
			description: 'Seconds elapsed',
		},
	},
	required: ['days', 'hours', 'minutes', 'seconds'],
};

export const initialTimeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		time: extractedDateTimeSchema,
	},
	required: ['reasoning', 'time'],
};

export const timeChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		changed: { type: 'boolean', description: 'Whether time has passed' },
		delta: timeDeltaSchema,
	},
	required: ['reasoning', 'changed'],
};

// ============================================
// Location Schemas
// ============================================

export const initialLocationSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		area: { type: 'string', description: 'Neighborhood, district, or general area' },
		place: {
			type: 'string',
			description: 'Specific building, establishment, or location',
		},
		position: { type: 'string', description: 'Exact position within the place' },
	},
	required: ['reasoning', 'area', 'place', 'position'],
};

export const locationChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		changed: { type: 'boolean', description: 'Whether location has changed' },
		newArea: { type: 'string', description: 'New area (if changed)' },
		newPlace: { type: 'string', description: 'New place (if changed)' },
		newPosition: { type: 'string', description: 'New position (if changed)' },
	},
	required: ['reasoning', 'changed'],
};

export const initialPropsSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		props: {
			type: 'array',
			items: { type: 'string' },
			description: 'List of notable objects/props in the scene',
		},
	},
	required: ['reasoning', 'props'],
};

export const propsChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		added: {
			type: 'array',
			items: { type: 'string' },
			description: 'Props that appeared',
		},
		removed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Props that disappeared',
		},
	},
	required: ['reasoning', 'added', 'removed'],
};

export const propsConfirmationSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		confirmed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Props still present',
		},
		removed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Props no longer present',
		},
	},
	required: ['reasoning', 'confirmed', 'removed'],
};

// ============================================
// Climate Schemas
// ============================================

export const initialClimateSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		temperature: { type: 'number', description: 'Temperature in Fahrenheit' },
		conditions: { type: 'string', description: 'Weather conditions description' },
		isIndoors: { type: 'boolean', description: 'Whether the scene is indoors' },
	},
	required: ['reasoning', 'temperature', 'conditions', 'isIndoors'],
};

export const climateChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		changed: { type: 'boolean', description: 'Whether climate has changed' },
		temperature: { type: 'number', description: 'New temperature (if changed)' },
		conditions: { type: 'string', description: 'New conditions (if changed)' },
	},
	required: ['reasoning', 'changed'],
};

// ============================================
// Character Schemas
// ============================================

export const characterPresentSchema: JSONSchema = {
	type: 'object',
	properties: {
		name: { type: 'string', description: 'Character name' },
		position: { type: 'string', description: 'Where/how they are positioned' },
		activity: { type: 'string', description: 'What they are doing (null if idle)' },
		mood: {
			type: 'array',
			items: { type: 'string' },
			description:
				'Current emotional states/feelings (e.g., anxious, happy, suspicious)',
		},
		physicalState: {
			type: 'array',
			items: { type: 'string' },
			description: 'Notable physical conditions (e.g., tired, injured, sweating)',
		},
	},
	required: ['name', 'position', 'mood', 'physicalState'],
};

export const charactersPresentSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		characters: {
			type: 'array',
			items: characterPresentSchema,
			description: 'Characters present in the scene',
		},
	},
	required: ['reasoning', 'characters'],
};

export const outfitSlotSchema: JSONSchema = {
	type: 'string',
	enum: ['head', 'neck', 'jacket', 'back', 'torso', 'legs', 'footwear', 'socks', 'underwear'],
};

export const characterOutfitSchema: JSONSchema = {
	type: 'object',
	properties: {
		head: { type: 'string', description: 'Hat, headband, hair accessory, etc.' },
		neck: { type: 'string', description: 'Necklace, scarf, collar, etc.' },
		jacket: { type: 'string', description: 'Outer layer - jacket, coat, cardigan' },
		back: { type: 'string', description: 'Backpack, bag, cape, etc.' },
		torso: {
			type: 'string',
			description: 'Main upper body - shirt, blouse, dress top',
		},
		legs: { type: 'string', description: 'Lower body - pants, skirt, shorts' },
		footwear: { type: 'string', description: 'Shoes, boots, sandals, etc.' },
		socks: { type: 'string', description: 'Socks, stockings, etc.' },
		underwear: { type: 'string', description: 'Undergarments' },
	},
	additionalProperties: false,
};

export const characterOutfitsSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		outfits: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					character: {
						type: 'string',
						description: 'Character name',
					},
					outfit: characterOutfitSchema,
				},
				required: ['character', 'outfit'],
			},
		},
	},
	required: ['reasoning', 'outfits'],
};

export const presenceChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		appeared: {
			type: 'array',
			items: characterPresentSchema,
			description: 'Characters who appeared',
		},
		departed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Names of characters who left',
		},
	},
	required: ['reasoning', 'appeared', 'departed'],
};

export const outfitChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		character: { type: 'string', description: 'Character name' },
		removed: {
			type: 'array',
			items: outfitSlotSchema,
			description: 'Slots where items were removed',
		},
		added: {
			type: 'object',
			additionalProperties: { type: 'string' },
			description: 'Slots where items were added/changed, with the new item',
		},
	},
	required: ['reasoning', 'character', 'removed', 'added'],
};

export const moodChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		character: { type: 'string', description: 'Character name' },
		added: {
			type: 'array',
			items: { type: 'string' },
			description: 'Moods that appeared',
		},
		removed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Moods that faded',
		},
	},
	required: ['reasoning', 'character', 'added', 'removed'],
};

export const positionChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		character: { type: 'string', description: 'Character name' },
		changed: { type: 'boolean', description: 'Whether position changed' },
		newPosition: { type: 'string', description: 'New position (if changed)' },
	},
	required: ['reasoning', 'character', 'changed'],
};

export const activityChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		character: { type: 'string', description: 'Character name' },
		changed: { type: 'boolean', description: 'Whether activity changed' },
		newActivity: {
			type: 'string',
			description: 'New activity (if changed, null if idle)',
		},
	},
	required: ['reasoning', 'character', 'changed'],
};

export const physicalChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		character: { type: 'string', description: 'Character name' },
		added: {
			type: 'array',
			items: { type: 'string' },
			description: 'Physical states that appeared',
		},
		removed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Physical states that resolved',
		},
	},
	required: ['reasoning', 'character', 'added', 'removed'],
};

/**
 * Combined position and activity change schema.
 * Extracts both in a single LLM call for efficiency.
 */
export const positionActivityChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		character: { type: 'string', description: 'Character name' },
		positionChanged: { type: 'boolean', description: 'Whether position changed' },
		newPosition: { type: 'string', description: 'New position (if positionChanged)' },
		activityChanged: { type: 'boolean', description: 'Whether activity changed' },
		newActivity: {
			type: 'string',
			description: 'New activity (if activityChanged, omit if idle)',
		},
	},
	required: ['reasoning', 'character', 'positionChanged', 'activityChanged'],
};

/**
 * Combined mood and physical state change schema.
 * Extracts both in a single LLM call for efficiency.
 */
export const moodPhysicalChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		character: { type: 'string', description: 'Character name' },
		moodAdded: {
			type: 'array',
			items: { type: 'string' },
			description: 'Moods that appeared',
		},
		moodRemoved: {
			type: 'array',
			items: { type: 'string' },
			description: 'Moods that faded',
		},
		physicalAdded: {
			type: 'array',
			items: { type: 'string' },
			description: 'Physical states that appeared',
		},
		physicalRemoved: {
			type: 'array',
			items: { type: 'string' },
			description: 'Physical states that resolved',
		},
	},
	required: [
		'reasoning',
		'character',
		'moodAdded',
		'moodRemoved',
		'physicalAdded',
		'physicalRemoved',
	],
};

// ============================================
// Relationship Schemas
// ============================================

export const attitudeSchema: JSONSchema = {
	type: 'object',
	properties: {
		feelings: {
			type: 'array',
			items: { type: 'string' },
			description: 'Emotional feelings',
		},
		secrets: { type: 'array', items: { type: 'string' }, description: 'Secrets held' },
		wants: { type: 'array', items: { type: 'string' }, description: 'Desires/goals' },
	},
	required: ['feelings', 'secrets', 'wants'],
};

export const relationshipStatusEnum: JSONSchema = {
	type: 'string',
	enum: [
		'strangers',
		'acquaintances',
		'friendly',
		'close',
		'intimate',
		'strained',
		'hostile',
		'complicated',
	],
};

export const initialRelationshipsSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		relationships: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					pair: characterPairField,
					status: relationshipStatusEnum,
					aToB: attitudeSchema,
					bToA: attitudeSchema,
				},
				required: ['pair', 'status', 'aToB', 'bToA'],
			},
		},
	},
	required: ['reasoning', 'relationships'],
};

export const feelingsChangeDirectionSchema: JSONSchema = {
	type: 'object',
	properties: {
		fromCharacter: {
			type: 'string',
			description: 'Character whose feelings are changing',
		},
		towardCharacter: {
			type: 'string',
			description: 'Character the feelings are toward',
		},
		added: { type: 'array', items: { type: 'string' }, description: 'New feelings' },
		removed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Faded feelings',
		},
	},
	required: ['fromCharacter', 'towardCharacter', 'added', 'removed'],
};

export const feelingsChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		changes: {
			type: 'array',
			items: feelingsChangeDirectionSchema,
			description:
				'Feelings changes for each direction (A toward B, and B toward A)',
			minItems: 0,
			maxItems: 2,
		},
	},
	required: ['reasoning', 'changes'],
};

export const secretsChangeDirectionSchema: JSONSchema = {
	type: 'object',
	properties: {
		fromCharacter: { type: 'string', description: 'Character who holds the secret' },
		towardCharacter: { type: 'string', description: 'Character the secret relates to' },
		added: { type: 'array', items: { type: 'string' }, description: 'New secrets' },
		removed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Revealed secrets',
		},
	},
	required: ['fromCharacter', 'towardCharacter', 'added', 'removed'],
};

export const secretsChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		changes: {
			type: 'array',
			items: secretsChangeDirectionSchema,
			description:
				'Secrets changes for each direction (A toward B, and B toward A)',
			minItems: 0,
			maxItems: 2,
		},
	},
	required: ['reasoning', 'changes'],
};

export const wantsChangeDirectionSchema: JSONSchema = {
	type: 'object',
	properties: {
		fromCharacter: {
			type: 'string',
			description: 'Character whose wants are changing',
		},
		towardCharacter: { type: 'string', description: 'Character the wants relate to' },
		added: {
			type: 'array',
			items: { type: 'string' },
			description: 'New wants/desires',
		},
		removed: {
			type: 'array',
			items: { type: 'string' },
			description: 'Fulfilled/abandoned wants',
		},
	},
	required: ['fromCharacter', 'towardCharacter', 'added', 'removed'],
};

export const wantsChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		changes: {
			type: 'array',
			items: wantsChangeDirectionSchema,
			description:
				'Wants changes for each direction (A toward B, and B toward A)',
			minItems: 0,
			maxItems: 2,
		},
	},
	required: ['reasoning', 'changes'],
};

export const statusChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		pair: characterPairField,
		changed: { type: 'boolean', description: 'Whether status changed' },
		newStatus: relationshipStatusEnum,
	},
	required: ['reasoning', 'pair', 'changed'],
};

export const subjectSchema: JSONSchema = {
	type: 'string',
	enum: [
		// Conversation & Social
		'conversation',
		'confession',
		'argument',
		'negotiation',
		// Discovery & Information
		'discovery',
		'secret_shared',
		'secret_revealed',
		// Emotional
		'emotional',
		'emotionally_intimate',
		'supportive',
		'rejection',
		'comfort',
		'apology',
		'forgiveness',
		// Bonding & Connection
		'laugh',
		'gift',
		'compliment',
		'tease',
		'flirt',
		'date',
		'i_love_you',
		'sleepover',
		'shared_meal',
		'shared_activity',
		// Intimacy Levels
		'intimate_touch',
		'intimate_kiss',
		'intimate_embrace',
		'intimate_heated',
		// Sexual Activity
		'intimate_foreplay',
		'intimate_oral',
		'intimate_manual',
		'intimate_penetrative',
		'intimate_climax',
		// Action & Physical
		'action',
		'combat',
		'danger',
		// Decisions & Commitments
		'decision',
		'promise',
		'betrayal',
		'lied',
		// Life Events
		'exclusivity',
		'marriage',
		'pregnancy',
		'childbirth',
		// Social & Achievement
		'social',
		'achievement',
		// Support & Protection
		'helped',
		'common_interest',
		'outing',
		'defended',
		'crisis_together',
		'vulnerability',
		'shared_vulnerability',
		'entrusted',
	],
};

export const subjectsSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		subjects: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					pair: characterPairField,
					subject: subjectSchema,
				},
				required: ['pair', 'subject'],
			},
		},
	},
	required: ['reasoning', 'subjects'],
};

export const subjectsConfirmationSchema: JSONSchema = {
	type: 'object',
	properties: {
		result: {
			type: 'string',
			enum: ['accept', 'wrong_subject', 'reject'],
			description: 'Classification result for the candidate subject',
		},
		reasoning: {
			type: 'string',
			description: 'Reasoning for the classification',
		},
		correct_subject: {
			...subjectSchema,
			description: 'The correct subject type if result is wrong_subject',
		},
	},
	required: ['result', 'reasoning'],
};

// ============================================
// Scene Schemas
// ============================================

export const initialTopicToneSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		topic: { type: 'string', description: 'Main topic of the scene' },
		tone: { type: 'string', description: 'Overall tone/mood of the scene' },
	},
	required: ['reasoning', 'topic', 'tone'],
};

export const topicToneChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		changed: { type: 'boolean', description: 'Whether topic/tone changed' },
		newTopic: { type: 'string', description: 'New topic (if changed)' },
		newTone: { type: 'string', description: 'New tone (if changed)' },
	},
	required: ['reasoning', 'changed'],
};

export const tensionLevelEnum: JSONSchema = {
	type: 'string',
	enum: ['relaxed', 'aware', 'guarded', 'tense', 'charged', 'volatile', 'explosive'],
};

export const tensionTypeEnum: JSONSchema = {
	type: 'string',
	enum: [
		'confrontation',
		'intimate',
		'vulnerable',
		'celebratory',
		'negotiation',
		'suspense',
		'conversation',
	],
};

export const tensionDirectionEnum: JSONSchema = {
	type: 'string',
	enum: ['escalating', 'stable', 'decreasing'],
};

/**
 * Initial tension schema.
 * Note: direction is calculated programmatically based on level change, not extracted.
 */
export const initialTensionSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		level: tensionLevelEnum,
		type: tensionTypeEnum,
	},
	required: ['reasoning', 'level', 'type'],
};

/**
 * Tension change schema.
 * Note: direction is calculated programmatically based on level change, not extracted.
 */
export const tensionChangeSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		changed: { type: 'boolean', description: 'Whether tension changed' },
		newLevel: tensionLevelEnum,
		newType: tensionTypeEnum,
	},
	required: ['reasoning', 'changed'],
};

// ============================================
// Narrative Schemas
// ============================================

export const narrativeDescriptionSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		description: {
			type: 'string',
			description:
				'Brief factual description of what happened in the last 2 messages',
		},
	},
	required: ['reasoning', 'description'],
};

export const milestoneDescriptionSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		description: {
			type: 'string',
			description: 'Evocative description of this milestone moment',
		},
	},
	required: ['reasoning', 'description'],
};

// ============================================
// Chapter Schemas
// ============================================

export const chapterEndedSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		shouldEnd: { type: 'boolean', description: 'Whether the chapter should end' },
		reason: {
			type: 'string',
			enum: ['location_change', 'time_jump', 'both'],
			description: 'Why the chapter is ending',
		},
	},
	required: ['reasoning', 'shouldEnd'],
};

export const chapterDescriptionSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		title: { type: 'string', description: 'Chapter title (short, evocative)' },
		summary: {
			type: 'string',
			description: 'Brief summary of what happened in the chapter',
		},
	},
	required: ['reasoning', 'title', 'summary'],
};

// ============================================
// Consolidation Schemas
// ============================================

/**
 * Schema for character state consolidation.
 * Used to consolidate mood and physical state lists (2-5 items, no synonyms).
 */
export const stateConsolidationSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		consolidatedMoods: {
			type: 'array',
			items: { type: 'string' },
			minItems: 2,
			maxItems: 5,
			description: 'Consolidated moods (2-5 items, no synonyms)',
		},
		consolidatedPhysical: {
			type: 'array',
			items: { type: 'string' },
			minItems: 2,
			maxItems: 5,
			description: 'Consolidated physical states (2-5 items, no synonyms)',
		},
	},
	required: ['reasoning', 'consolidatedMoods', 'consolidatedPhysical'],
};

/**
 * Schema for relationship attitude consolidation (single direction).
 * Used to consolidate feelings and wants for one direction (2-5 items, no synonyms).
 */
export const attitudeConsolidationSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		consolidatedFeelings: {
			type: 'array',
			items: { type: 'string' },
			minItems: 2,
			maxItems: 5,
			description: 'Consolidated feelings (2-5 items, no synonyms)',
		},
		consolidatedWants: {
			type: 'array',
			items: { type: 'string' },
			minItems: 2,
			maxItems: 5,
			description: 'Consolidated wants (2-5 items, no synonyms)',
		},
	},
	required: ['reasoning', 'consolidatedFeelings', 'consolidatedWants'],
};

// ============================================
// Schema Utilities
// ============================================

/**
 * Convert a JSON schema to a string description for prompts.
 */
export function schemaToString(schema: JSONSchema, indent: number = 0): string {
	const pad = '  '.repeat(indent);

	if (schema.type === 'object' && schema.properties) {
		const props = Object.entries(schema.properties)
			.map(([key, value]) => {
				const required = schema.required?.includes(key) ? '' : '?';
				const desc = value.description ? ` // ${value.description}` : '';
				return `${pad}  "${key}"${required}: ${schemaToString(value, indent + 1)}${desc}`;
			})
			.join(',\n');
		return `{\n${props}\n${pad}}`;
	}

	if (schema.type === 'array' && schema.items) {
		return `[${schemaToString(schema.items, indent)}]`;
	}

	if (schema.enum) {
		return schema.enum.map(v => JSON.stringify(v)).join(' | ');
	}

	return schema.type;
}

/**
 * Format a schema as a JSON example for prompts.
 */
export function schemaToExample(schema: JSONSchema): string {
	if (schema.type === 'object' && schema.properties) {
		const obj: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(schema.properties)) {
			obj[key] = schemaToExampleValue(value);
		}
		return JSON.stringify(obj, null, 2);
	}
	return JSON.stringify(schemaToExampleValue(schema));
}

function schemaToExampleValue(schema: JSONSchema): unknown {
	if (schema.enum) {
		return schema.enum[0];
	}

	switch (schema.type) {
		case 'string':
			return schema.description || 'string';
		case 'number':
			return schema.minimum ?? 0;
		case 'boolean':
			return false;
		case 'null':
			return null;
		case 'array':
			return schema.items ? [schemaToExampleValue(schema.items)] : [];
		case 'object':
			if (schema.properties) {
				const obj: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(schema.properties)) {
					obj[key] = schemaToExampleValue(value);
				}
				return obj;
			}
			return {};
		default:
			return null;
	}
}
