import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSharedContext, type BuildSharedContextParams } from './context';

// Mock dependencies
vi.mock('../extractors/utils/buildPrompt', () => ({
	formatCharacterProfiles: vi.fn(
		() => 'Kira (Female, Human, 25): Appearance: dark hair | Personality: guarded',
	),
}));

vi.mock('../injectors/state', () => ({
	formatStateForInjection: vi.fn(
		() => 'Topic: trust\nTone: intimate\nTime: Monday, March 18, 2026 at 11:30 PM',
	),
}));

vi.mock('../injectors/contextBudget', () => ({
	computeOptimalContext: vi.fn(async () => ({
		firstMessageInContext: 0,
		pastChapters: [{ index: 0, title: 'Chapter 1', summary: 'Summary' }],
		currentChapterEvents: [{ description: 'An event', witnesses: ['Kira'] }],
		effectiveCurrentChapter: 1,
		totalTokens: 100,
		breakdown: {
			pastChaptersTokens: 50,
			currentChapterEventsTokens: 30,
			stateTokens: 20,
		},
	})),
}));

vi.mock('../injectors/chapters', () => ({
	formatPrecomputedChapters: vi.fn(() => 'Chapter 1: Title\n  Summary'),
}));

vi.mock('../injectors/events', () => ({
	formatOutOfContextEvents: vi.fn(() => '- An event'),
}));

vi.mock('../utils/tokenCount', () => ({
	getDefaultTokenCounter: vi.fn(() => ({
		countTokens: vi.fn(async () => 10),
	})),
}));

function makeParams(overrides?: Partial<BuildSharedContextParams>): BuildSharedContextParams {
	return {
		stContext: {
			chat: [
				{ name: 'User', mes: 'Hello', is_user: true },
				{ name: 'Kira', mes: 'Hi there', is_user: false },
			],
			name1: 'User',
			name2: 'Kira',
			characterId: 0,
			characters: [
				{
					description: 'A guarded woman',
					personality: 'guarded, witty',
					scenario: 'Late night conversation',
				},
			],
			persona: 'A friendly person',
			powerUserSettings: { persona_description: 'A friendly person' },
		} as unknown as BuildSharedContextParams['stContext'],
		projection: {
			source: { messageId: 1, swipeId: 0 },
			time: null,
			location: null,
			forecasts: {},
			climate: null,
			scene: null,
			characters: {},
			relationships: {},
			currentChapter: 0,
			charactersPresent: ['Kira'],
			narrativeEvents: [],
		},
		store: {} as unknown as BuildSharedContextParams['store'],
		swipeContext: { getCanonicalSwipeId: () => 0 },
		includeWorldinfo: false,
		injectionTokenBudget: 4000,
		maxRecentChapters: 5,
		maxRecentEvents: 15,
		...overrides,
	};
}

function makeStContext(
	chat: Array<{ name: string; mes: string; is_user: boolean }>,
	overrides?: Record<string, unknown>,
) {
	return {
		chat,
		name1: 'User',
		name2: 'Kira',
		characterId: 0,
		characters: [
			{
				description: 'A guarded woman',
				personality: 'guarded, witty',
				scenario: 'Late night conversation',
			},
		],
		persona: 'A friendly person',
		powerUserSettings: { persona_description: 'A friendly person' },
		...overrides,
	} as unknown as BuildSharedContextParams['stContext'];
}

describe('buildSharedContext', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ========================================
	// Section inclusion
	// ========================================

	it('includes character description section', async () => {
		const result = await buildSharedContext(makeParams());
		expect(result).toContain('[Character Description]');
		expect(result).toContain('A guarded woman');
		expect(result).toContain('[/Character Description]');
	});

	it('includes user character section', async () => {
		const result = await buildSharedContext(makeParams());
		expect(result).toContain('[User Character]');
		expect(result).toContain('A friendly person');
		expect(result).toContain('[/User Character]');
	});

	it('includes character profiles section', async () => {
		const result = await buildSharedContext(makeParams());
		expect(result).toContain('[Character Profiles]');
		expect(result).toContain('Kira');
		expect(result).toContain('[/Character Profiles]');
	});

	it('includes current scene section', async () => {
		const result = await buildSharedContext(makeParams());
		expect(result).toContain('[Current Scene]');
		expect(result).toContain('[/Current Scene]');
	});

	it('includes narrative context section', async () => {
		const result = await buildSharedContext(makeParams());
		expect(result).toContain('[Narrative Context]');
		expect(result).toContain('[/Narrative Context]');
	});

	it('includes recent messages section', async () => {
		// Default chat ends with assistant message (swipe scenario),
		// so the last assistant message is excluded
		const result = await buildSharedContext(makeParams());
		expect(result).toContain('[Recent Messages]');
		expect(result).toContain('User: Hello');
		// Kira's message is excluded (last message is assistant = swipe/regen)
		expect(result).not.toContain('Kira: Hi there');
		expect(result).toContain('[/Recent Messages]');
	});

	// ========================================
	// Optional sections
	// ========================================

	it('includes worldinfo when provided', async () => {
		const result = await buildSharedContext(
			makeParams({ worldinfo: 'Kira is from the Northern Kingdom' }),
		);
		expect(result).toContain('[World Info]');
		expect(result).toContain('Kira is from the Northern Kingdom');
		expect(result).toContain('[/World Info]');
	});

	it('omits worldinfo when not provided', async () => {
		const result = await buildSharedContext(makeParams());
		expect(result).not.toContain('[World Info]');
	});

	it('includes mandatory scene event when shakeup provided', async () => {
		const result = await buildSharedContext(
			makeParams({
				shakeupInstruction: 'A sudden earthquake shakes the building',
			}),
		);
		expect(result).toContain('[Mandatory Scene Event]');
		expect(result).toContain('A sudden earthquake shakes the building');
		expect(result).toContain('[/Mandatory Scene Event]');
	});

	it('omits mandatory scene event when not provided', async () => {
		const result = await buildSharedContext(makeParams());
		expect(result).not.toContain('[Mandatory Scene Event]');
	});

	it('omits mandatory scene event when shakeup is null', async () => {
		const result = await buildSharedContext(makeParams({ shakeupInstruction: null }));
		expect(result).not.toContain('[Mandatory Scene Event]');
	});

	it('omits mandatory scene event when shakeup is empty string', async () => {
		const result = await buildSharedContext(makeParams({ shakeupInstruction: '' }));
		expect(result).not.toContain('[Mandatory Scene Event]');
	});

	// ========================================
	// Missing data handling
	// ========================================

	it('omits character description when character has no data', async () => {
		const result = await buildSharedContext(
			makeParams({
				stContext: makeStContext(
					[{ name: 'User', mes: 'Hello', is_user: true }],
					{ characters: [{}], characterId: 0 },
				),
			}),
		);
		expect(result).not.toContain('[Character Description]');
	});

	it('omits user character when no persona set', async () => {
		const result = await buildSharedContext(
			makeParams({
				stContext: makeStContext(
					[{ name: 'User', mes: 'Hello', is_user: true }],
					{ persona: '', powerUserSettings: {} },
				),
			}),
		);
		expect(result).not.toContain('[User Character]');
	});

	it('handles empty chat gracefully', async () => {
		const result = await buildSharedContext(
			makeParams({
				stContext: makeStContext([]),
			}),
		);
		// Should not throw, should not include recent messages
		expect(result).not.toContain('[Recent Messages]');
	});

	// ========================================
	// Swipe awareness
	// ========================================

	it('excludes last assistant message from recent messages during swipe/regen', async () => {
		const result = await buildSharedContext(
			makeParams({
				stContext: makeStContext([
					{ name: 'User', mes: 'What do you think?', is_user: true },
					{
						name: 'Kira',
						mes: 'Old response being swiped away',
						is_user: false,
					},
				]),
			}),
		);
		expect(result).toContain('What do you think?');
		expect(result).not.toContain('Old response being swiped away');
	});

	it('includes last user message in recent messages during normal generation', async () => {
		const result = await buildSharedContext(
			makeParams({
				stContext: makeStContext([
					{
						name: 'Kira',
						mes: 'Previous assistant message',
						is_user: false,
					},
					{ name: 'User', mes: 'My latest message', is_user: true },
				]),
			}),
		);
		expect(result).toContain('My latest message');
		expect(result).toContain('Previous assistant message');
	});

	it('excludes only the last assistant message, keeps earlier ones', async () => {
		const result = await buildSharedContext(
			makeParams({
				stContext: makeStContext([
					{ name: 'Kira', mes: 'Earlier response', is_user: false },
					{ name: 'User', mes: 'User reply', is_user: true },
					{
						name: 'Kira',
						mes: 'Response being swiped',
						is_user: false,
					},
				]),
			}),
		);
		expect(result).toContain('Earlier response');
		expect(result).toContain('User reply');
		expect(result).not.toContain('Response being swiped');
	});

	it('limits recent messages to count parameter (5 by default)', async () => {
		const chat = [];
		for (let i = 0; i < 10; i++) {
			chat.push({
				name: i % 2 === 0 ? 'User' : 'Kira',
				mes: `Message ${i}`,
				is_user: i % 2 === 0,
			});
		}
		// Last message is User (even index 9... no wait, 10 messages, indices 0-9)
		// Index 9 is odd = Kira = assistant, so it gets excluded
		// We should see messages 4-8 (5 messages, excluding last assistant)
		const result = await buildSharedContext(
			makeParams({ stContext: makeStContext(chat) }),
		);
		expect(result).not.toContain('Message 0');
		expect(result).not.toContain('Message 1');
		expect(result).not.toContain('Message 2');
		expect(result).not.toContain('Message 3');
		expect(result).toContain('Message 4');
		expect(result).toContain('Message 8');
		expect(result).not.toContain('Message 9'); // Excluded (last assistant)
	});

	// ========================================
	// Section ordering
	// ========================================

	it('orders stable content before volatile content', async () => {
		const result = await buildSharedContext(makeParams({ worldinfo: 'lore data' }));
		const charDescIdx = result.indexOf('[Character Description]');
		const userCharIdx = result.indexOf('[User Character]');
		const worldInfoIdx = result.indexOf('[World Info]');
		const profilesIdx = result.indexOf('[Character Profiles]');
		const sceneIdx = result.indexOf('[Current Scene]');
		const narrativeIdx = result.indexOf('[Narrative Context]');
		const messagesIdx = result.indexOf('[Recent Messages]');

		// Stable content first
		expect(charDescIdx).toBeLessThan(userCharIdx);
		expect(userCharIdx).toBeLessThan(worldInfoIdx);
		expect(worldInfoIdx).toBeLessThan(profilesIdx);

		// Then volatile
		expect(profilesIdx).toBeLessThan(sceneIdx);
		expect(sceneIdx).toBeLessThan(narrativeIdx);
		expect(narrativeIdx).toBeLessThan(messagesIdx);
	});

	it('places shakeup between narrative context and recent messages', async () => {
		const result = await buildSharedContext(
			makeParams({ shakeupInstruction: 'Earthquake!' }),
		);
		const narrativeIdx = result.indexOf('[Narrative Context]');
		const shakeupIdx = result.indexOf('[Mandatory Scene Event]');
		const messagesIdx = result.indexOf('[Recent Messages]');

		expect(narrativeIdx).toBeLessThan(shakeupIdx);
		expect(shakeupIdx).toBeLessThan(messagesIdx);
	});

	// ========================================
	// Calls correct dependencies
	// ========================================

	it('passes half budget to computeOptimalContext', async () => {
		const { computeOptimalContext } = await import('../injectors/contextBudget');
		const mockCompute = vi.mocked(computeOptimalContext);

		await buildSharedContext(makeParams({ injectionTokenBudget: 8000 }));

		expect(mockCompute).toHaveBeenCalledWith(
			expect.objectContaining({
				budget: 4000, // Half of 8000
			}),
		);
	});

	it('passes formatStateForInjection without chapters/events/relationships', async () => {
		const { formatStateForInjection } = await import('../injectors/state');
		const mockFormat = vi.mocked(formatStateForInjection);

		await buildSharedContext(makeParams());

		expect(mockFormat).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				includeChapters: false,
				includeEvents: false,
				includeRelationships: false,
			}),
		);
	});
});
