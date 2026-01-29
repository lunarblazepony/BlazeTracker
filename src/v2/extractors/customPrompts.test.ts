/**
 * Custom Prompts Test
 *
 * Tests that all extractors correctly read custom system prompts
 * and custom user templates from settings.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../generator';
import type { ExtractionContext, ExtractionSettings } from './types';
import type { Snapshot, MessageAndSwipe, Event } from '../types';
import { EventStore } from '../store';

// Import all initial extractors (using their actual export names)
import { initialTimeExtractor } from './initial/timeExtractor';
import { locationExtractor } from './initial/locationExtractor';
import { initialPropsExtractor } from './initial/propsExtractor';
import { initialTopicToneExtractor } from './initial/topicToneExtractor';
import { tensionExtractor } from './initial/tensionExtractor';
import { initialCharactersPresentExtractor } from './initial/charactersPresentExtractor';

// Import event extractors
import { timeChangeExtractor } from './events/timeChangeExtractor';
import { locationChangeExtractor } from './events/locationChangeExtractor';
import { tensionChangeExtractor } from './events/tensionChangeExtractor';
import { topicToneChangeExtractor } from './events/topicToneChangeExtractor';

// Import the prompts to get their names and default content
import { initialTimePrompt } from '../prompts/initial/timePrompt';
import { initialLocationPrompt } from '../prompts/initial/locationPrompt';
import { initialPropsPrompt } from '../prompts/initial/propsPrompt';
import { initialTopicTonePrompt } from '../prompts/initial/topicTonePrompt';
import { initialTensionPrompt } from '../prompts/initial/tensionPrompt';
import { initialCharactersPresentPrompt } from '../prompts/initial/charactersPresentPrompt';
import { timeChangePrompt } from '../prompts/events/timeChangePrompt';
import { locationChangePrompt } from '../prompts/events/locationChangePrompt';
import { tensionChangePrompt } from '../prompts/events/tensionChangePrompt';
import { topicToneChangePrompt } from '../prompts/events/topicToneChangePrompt';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*The clock on the wall shows 3:47 PM as Elena enters the coffee shop. November 14th, 2024.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: '*I wave to Elena from my seat near the window.* Hey, glad you could make it.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
		],
		characters: [
			{
				name: 'Elena',
				description: 'A young woman with auburn hair and green eyes.',
				personality: 'Curious, determined',
				scenario: 'Meeting at a coffee shop.',
			},
		],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A mysterious stranger.',
		...overrides,
	};
}

/**
 * Create mock extraction settings.
 */
function createMockSettings(overrides: Partial<ExtractionSettings> = {}): ExtractionSettings {
	return {
		profileId: 'test-profile',
		track: {
			time: true,
			location: true,
			props: true,
			climate: true,
			characters: true,
			relationships: true,
			scene: true,
			narrative: true,
			chapters: true,
		},
		temperatures: {
			time: 0.3,
			location: 0.5,
			climate: 0.3,
			characters: 0.7,
			relationships: 0.6,
			scene: 0.6,
			narrative: 0.7,
			chapters: 0.5,
		},
		customPrompts: {},
		...overrides,
	};
}

/**
 * Create a mock initial snapshot for event extractors.
 */
function createMockSnapshot(): Snapshot {
	return {
		type: 'initial',
		source: { messageId: 0, swipeId: 0 },
		timestamp: Date.now(),
		swipeId: 0,
		time: '2024-11-14T15:47:00',
		location: {
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'near the window',
			props: ['coffee cup', 'menu'],
			locationType: 'heated',
		},
		forecasts: {},
		climate: {
			temperature: 22,
			outdoorTemperature: 15,
			feelsLike: 14,
			humidity: 50,
			precipitation: 0,
			cloudCover: 20,
			windSpeed: 5,
			windDirection: 'N',
			conditions: 'Partly cloudy',
			conditionType: 'partly_cloudy',
			uvIndex: 3,
			daylight: 'day',
			isIndoors: true,
		},
		characters: {
			Elena: {
				name: 'Elena',
				position: 'at the counter',
				activity: 'ordering coffee',
				mood: ['happy'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: 'leather jacket',
					back: null,
					torso: 'white blouse',
					legs: 'jeans',
					footwear: 'boots',
					socks: null,
					underwear: null,
				},
			},
		},
		relationships: {},
		scene: {
			topic: 'catching up',
			tone: 'casual',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		currentChapter: 0,
		narrativeEvents: [],
	};
}

/**
 * Create a valid time response for mock generator.
 */
function createTimeResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		time: {
			year: 2024,
			month: 11,
			day: 14,
			hour: 15,
			minute: 47,
			second: 0,
			dayOfWeek: 'Thursday',
		},
	});
}

/**
 * Create a valid time change response for mock generator.
 */
function createTimeChangeResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		delta: { days: 0, hours: 0, minutes: 5, seconds: 0 },
	});
}

/**
 * Create a valid location response for mock generator.
 */
function createLocationResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		area: 'Downtown',
		place: 'Coffee Shop',
		position: 'near the window',
		locationType: 'heated',
	});
}

/**
 * Create a valid location change response for mock generator.
 */
function createLocationChangeResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		changed: false,
	});
}

/**
 * Create a valid props response for mock generator.
 */
function createPropsResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		props: ['coffee cup', 'menu'],
	});
}

/**
 * Create a valid topic/tone response for mock generator.
 */
function createTopicToneResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		topic: 'catching up',
		tone: 'casual',
	});
}

/**
 * Create a valid topic/tone change response for mock generator.
 */
function createTopicToneChangeResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		changed: false,
	});
}

/**
 * Create a valid tension response for mock generator.
 */
function createTensionResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		level: 'relaxed',
		type: 'conversation',
		direction: 'stable',
	});
}

/**
 * Create a valid tension change response for mock generator.
 */
function createTensionChangeResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		changed: false,
	});
}

/**
 * Create a valid characters present response for mock generator.
 */
function createCharactersPresentResponse(): string {
	return JSON.stringify({
		reasoning: 'Test response',
		characters: ['Elena', 'User'],
	});
}

// ============================================
// Helper function to get system and user messages from call
// ============================================

function getSystemMessage(call: {
	prompt: { messages: Array<{ role: string; content: string }> };
}): string {
	const systemMsg = call.prompt.messages.find(m => m.role === 'system');
	return systemMsg?.content ?? '';
}

function getUserMessage(call: {
	prompt: { messages: Array<{ role: string; content: string }> };
}): string {
	const userMsg = call.prompt.messages.find(m => m.role === 'user');
	return userMsg?.content ?? '';
}

// ============================================
// Test Initial Extractors
// ============================================

describe('Custom Prompts - Initial Extractors', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	describe('initialTimeExtractor', () => {
		const promptName = initialTimePrompt.name; // 'initial_time'

		it('uses default system prompt when no custom prompt is set', async () => {
			const context = createMockContext();
			const settings = createMockSettings({ customPrompts: {} });

			mockGenerator.setDefaultResponse(createTimeResponse());
			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			// Should contain distinctive text from the default system prompt
			expect(systemContent).toContain('analyzing roleplay messages');
			expect(systemContent).toContain('Time Clue Priority');
		});

		it('uses default user template when no custom prompt is set', async () => {
			const context = createMockContext();
			const settings = createMockSettings({ customPrompts: {} });

			mockGenerator.setDefaultResponse(createTimeResponse());
			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			const userContent = getUserMessage(call);
			// Should contain placeholders filled with context values
			expect(userContent).toContain('Elena');
			expect(userContent).toContain('Messages to Analyze');
		});

		it('uses custom system prompt when set', async () => {
			const context = createMockContext();
			const customSystem = 'CUSTOM_SYSTEM_PROMPT_FOR_TIME_EXTRACTION';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createTimeResponse());
			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent).toBe(customSystem);
			// Should NOT contain default system prompt content
			expect(systemContent).not.toContain('Time Clue Priority');
		});

		it('uses custom user template when set', async () => {
			const context = createMockContext();
			const customUser = 'CUSTOM_USER_TEMPLATE {{characterName}} {{messages}}';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { userTemplate: customUser },
				},
			});

			mockGenerator.setDefaultResponse(createTimeResponse());
			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			const userContent = getUserMessage(call);
			// Should contain the custom template with placeholders replaced
			expect(userContent).toContain('CUSTOM_USER_TEMPLATE');
			expect(userContent).toContain('Elena'); // {{characterName}} replaced
		});

		it('uses both custom prompts when both are set', async () => {
			const context = createMockContext();
			const customSystem = 'CUSTOM_SYSTEM_FOR_TIME';
			const customUser = 'CUSTOM_USER_FOR_TIME {{characterName}}';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: {
						systemPrompt: customSystem,
						userTemplate: customUser,
					},
				},
			});

			mockGenerator.setDefaultResponse(createTimeResponse());
			await initialTimeExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
			expect(getUserMessage(call)).toContain('CUSTOM_USER_FOR_TIME');
			expect(getUserMessage(call)).toContain('Elena');
		});
	});

	describe('locationExtractor', () => {
		const promptName = initialLocationPrompt.name; // 'initial_location'

		it('uses default prompts when no custom prompt is set', async () => {
			const context = createMockContext();
			const settings = createMockSettings({ customPrompts: {} });

			mockGenerator.setDefaultResponse(createLocationResponse());
			await locationExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent).toContain('location');
		});

		it('uses custom system prompt when set', async () => {
			const context = createMockContext();
			const customSystem = 'CUSTOM_LOCATION_SYSTEM_PROMPT';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createLocationResponse());
			await locationExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});

		it('uses custom user template when set', async () => {
			const context = createMockContext();
			const customUser = 'CUSTOM_LOCATION_USER {{messages}}';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { userTemplate: customUser },
				},
			});

			mockGenerator.setDefaultResponse(createLocationResponse());
			await locationExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			expect(getUserMessage(call)).toContain('CUSTOM_LOCATION_USER');
		});
	});

	describe('initialPropsExtractor', () => {
		const promptName = initialPropsPrompt.name; // 'initial_props'

		it('uses default prompts when no custom prompt is set', async () => {
			const context = createMockContext();
			const settings = createMockSettings({ customPrompts: {} });
			const partialSnapshot: Partial<Snapshot> = {
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'inside',
					props: [],
					locationType: 'heated',
				},
			};

			mockGenerator.setDefaultResponse(createPropsResponse());
			await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent.length).toBeGreaterThan(100);
		});

		it('uses custom system prompt when set', async () => {
			const context = createMockContext();
			const customSystem = 'CUSTOM_PROPS_SYSTEM';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});
			const partialSnapshot: Partial<Snapshot> = {
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'inside',
					props: [],
					locationType: 'heated',
				},
			};

			mockGenerator.setDefaultResponse(createPropsResponse());
			await initialPropsExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});
	});

	describe('initialTopicToneExtractor', () => {
		const promptName = initialTopicTonePrompt.name; // 'initial_topic_tone'

		it('uses default prompts when no custom prompt is set', async () => {
			const context = createMockContext();
			const settings = createMockSettings({ customPrompts: {} });

			mockGenerator.setDefaultResponse(createTopicToneResponse());
			await initialTopicToneExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent.length).toBeGreaterThan(100);
		});

		it('uses custom system prompt when set', async () => {
			const context = createMockContext();
			const customSystem = 'CUSTOM_TOPIC_TONE_SYSTEM';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createTopicToneResponse());
			await initialTopicToneExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});

		it('uses custom user template when set', async () => {
			const context = createMockContext();
			const customUser = 'CUSTOM_TOPIC_TONE_USER {{messages}}';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { userTemplate: customUser },
				},
			});

			mockGenerator.setDefaultResponse(createTopicToneResponse());
			await initialTopicToneExtractor.run(mockGenerator, context, settings, {});

			const call = mockGenerator.getLastCall()!;
			expect(getUserMessage(call)).toContain('CUSTOM_TOPIC_TONE_USER');
		});
	});

	describe('tensionExtractor', () => {
		const promptName = initialTensionPrompt.name; // 'initial_tension'

		// tensionExtractor requires partialSnapshot.scene to exist (topic/tone must be extracted first)
		const partialSnapshotWithScene: Partial<Snapshot> = {
			scene: {
				topic: 'catching up',
				tone: 'casual',
				tension: {
					level: 'relaxed',
					type: 'conversation',
					direction: 'stable',
				},
			},
		};

		it('uses default prompts when no custom prompt is set', async () => {
			const context = createMockContext();
			const settings = createMockSettings({ customPrompts: {} });

			mockGenerator.setDefaultResponse(createTensionResponse());
			await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshotWithScene,
			);

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent.length).toBeGreaterThan(100);
		});

		it('uses custom system prompt when set', async () => {
			const context = createMockContext();
			const customSystem = 'CUSTOM_TENSION_SYSTEM';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createTensionResponse());
			await tensionExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshotWithScene,
			);

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});
	});

	describe('initialCharactersPresentExtractor', () => {
		const promptName = initialCharactersPresentPrompt.name; // 'initial_characters_present'

		it('uses default prompts when no custom prompt is set', async () => {
			const context = createMockContext();
			const settings = createMockSettings({ customPrompts: {} });

			mockGenerator.setDefaultResponse(createCharactersPresentResponse());
			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent.length).toBeGreaterThan(100);
		});

		it('uses custom system prompt when set', async () => {
			const context = createMockContext();
			const customSystem = 'CUSTOM_CHARACTERS_PRESENT_SYSTEM';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createCharactersPresentResponse());
			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});

		it('uses custom user template when set', async () => {
			const context = createMockContext();
			const customUser = 'CUSTOM_CHARACTERS_USER {{characterName}}';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { userTemplate: customUser },
				},
			});

			mockGenerator.setDefaultResponse(createCharactersPresentResponse());
			await initialCharactersPresentExtractor.run(
				mockGenerator,
				context,
				settings,
				{},
			);

			const call = mockGenerator.getLastCall()!;
			expect(getUserMessage(call)).toContain('CUSTOM_CHARACTERS_USER');
			expect(getUserMessage(call)).toContain('Elena');
		});
	});
});

// ============================================
// Test Event Extractors
// ============================================

describe('Custom Prompts - Event Extractors', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	// Helper to create event extraction context
	function createEventExtractionParams() {
		const context = createMockContext();
		const settings = createMockSettings();
		const currentMessage: MessageAndSwipe = { messageId: 1, swipeId: 0 };
		const turnEvents: Event[] = [];
		return { context, settings, currentMessage, turnEvents };
	}

	describe('timeChangeExtractor', () => {
		const promptName = timeChangePrompt.name; // 'time_change'

		it('uses default prompts when no custom prompt is set', async () => {
			const { context, settings, currentMessage, turnEvents } =
				createEventExtractionParams();

			mockGenerator.setDefaultResponse(createTimeChangeResponse());
			await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent).toContain('time');
		});

		it('uses custom system prompt when set', async () => {
			const { context, currentMessage, turnEvents } =
				createEventExtractionParams();
			const customSystem = 'CUSTOM_TIME_CHANGE_SYSTEM';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createTimeChangeResponse());
			await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});

		it('uses custom user template when set', async () => {
			const { context, currentMessage, turnEvents } =
				createEventExtractionParams();
			const customUser = 'CUSTOM_TIME_CHANGE_USER {{messages}}';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { userTemplate: customUser },
				},
			});

			mockGenerator.setDefaultResponse(createTimeChangeResponse());
			await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			expect(getUserMessage(call)).toContain('CUSTOM_TIME_CHANGE_USER');
		});
	});

	describe('locationChangeExtractor', () => {
		const promptName = locationChangePrompt.name; // 'location_change'

		it('uses default prompts when no custom prompt is set', async () => {
			const { context, settings, currentMessage, turnEvents } =
				createEventExtractionParams();

			mockGenerator.setDefaultResponse(createLocationChangeResponse());
			await locationChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent.length).toBeGreaterThan(100);
		});

		it('uses custom system prompt when set', async () => {
			const { context, currentMessage, turnEvents } =
				createEventExtractionParams();
			const customSystem = 'CUSTOM_LOCATION_CHANGE_SYSTEM';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createLocationChangeResponse());
			await locationChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});
	});

	describe('tensionChangeExtractor', () => {
		const promptName = tensionChangePrompt.name; // 'tension_change'

		it('uses default prompts when no custom prompt is set', async () => {
			const { context, settings, currentMessage, turnEvents } =
				createEventExtractionParams();

			mockGenerator.setDefaultResponse(createTensionChangeResponse());
			await tensionChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent.length).toBeGreaterThan(100);
		});

		it('uses custom system prompt when set', async () => {
			const { context, currentMessage, turnEvents } =
				createEventExtractionParams();
			const customSystem = 'CUSTOM_TENSION_CHANGE_SYSTEM';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createTensionChangeResponse());
			await tensionChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});
	});

	describe('topicToneChangeExtractor', () => {
		const promptName = topicToneChangePrompt.name; // 'topic_tone_change'

		it('uses default prompts when no custom prompt is set', async () => {
			const { context, settings, currentMessage, turnEvents } =
				createEventExtractionParams();

			mockGenerator.setDefaultResponse(createTopicToneChangeResponse());
			await topicToneChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			const systemContent = getSystemMessage(call);
			expect(systemContent.length).toBeGreaterThan(100);
		});

		it('uses custom system prompt when set', async () => {
			const { context, currentMessage, turnEvents } =
				createEventExtractionParams();
			const customSystem = 'CUSTOM_TOPIC_TONE_CHANGE_SYSTEM';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: { systemPrompt: customSystem },
				},
			});

			mockGenerator.setDefaultResponse(createTopicToneChangeResponse());
			await topicToneChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
		});

		it('uses both custom prompts when both are set', async () => {
			const { context, currentMessage, turnEvents } =
				createEventExtractionParams();
			const customSystem = 'CUSTOM_TOPIC_SYSTEM';
			const customUser = 'CUSTOM_TOPIC_USER {{characterName}}';
			const settings = createMockSettings({
				customPrompts: {
					[promptName]: {
						systemPrompt: customSystem,
						userTemplate: customUser,
					},
				},
			});

			mockGenerator.setDefaultResponse(createTopicToneChangeResponse());
			await topicToneChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall()!;
			expect(getSystemMessage(call)).toBe(customSystem);
			expect(getUserMessage(call)).toContain('CUSTOM_TOPIC_USER');
			expect(getUserMessage(call)).toContain('Elena');
		});
	});
});
