import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../generator';
import { generateShakeup, type GenerateShakeupParams } from './generateShakeup';
import { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import type { Projection } from '../types/snapshot';
import moment from 'moment';

function makeSwipeContext(): SwipeContext {
	return {
		getCanonicalSwipeId: () => 0,
	};
}

function makeProjection(): Projection {
	return {
		source: { messageId: 10, swipeId: 0 },
		time: moment('2024-01-15T14:30:00'),
		location: {
			area: 'Castle',
			place: 'Throne Room',
			position: 'center',
			props: ['sword', 'shield'],
			locationType: 'heated',
		},
		forecasts: {},
		climate: null,
		scene: {
			topic: 'negotiation',
			tone: 'tense',
			tension: {
				level: 'charged',
				type: 'negotiation',
				direction: 'escalating',
			},
		},
		characters: {},
		charactersPresent: [],
		relationships: {},
		currentChapter: 0,
		narrativeEvents: [],
	};
}

function makeParams(generator: MockGenerator): GenerateShakeupParams {
	return {
		generator,
		projection: makeProjection(),
		store: new EventStore(),
		swipeContext: makeSwipeContext(),
		characterDescription: 'A noble knight',
		userDescription: 'A mysterious traveler',
		characterProfiles: 'Knight (Male, Human, 35)',
		relationships:
			'Knight & Traveler: wary allies\n  Knight → Traveler: feels distrust',
		recentMessages: 'Knight: We must discuss the treaty.',
	};
}

describe('generateShakeup', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	it('returns suggestions from valid LLM response', async () => {
		mockGenerator.setResponse(
			'shakeup',
			JSON.stringify({
				suggestions: [
					{
						type: 'interruption',
						instruction: 'A messenger bursts in.',
						rationale: 'Breaks the negotiation.',
					},
					{
						type: 'environment',
						instruction: 'Thunder rumbles outside.',
						rationale: 'Atmospheric tension.',
					},
				],
			}),
		);

		const result = await generateShakeup(makeParams(mockGenerator));

		expect(result).not.toBeNull();
		expect(result!.suggestions).toHaveLength(2);
		expect(result!.suggestions[0].type).toBe('interruption');
		expect(result!.suggestions[1].type).toBe('environment');
	});

	it('uses temperature 0.9', async () => {
		mockGenerator.setDefaultResponse(
			JSON.stringify({
				suggestions: [
					{
						type: 'arrival',
						instruction: 'Test.',
						rationale: 'Test.',
					},
				],
			}),
		);

		await generateShakeup(makeParams(mockGenerator));

		const call = mockGenerator.getLastCall();
		expect(call).toBeDefined();
		expect(call!.settings.temperature).toBe(0.9);
	});

	it('uses maxTokens 1024', async () => {
		mockGenerator.setDefaultResponse(
			JSON.stringify({
				suggestions: [
					{
						type: 'arrival',
						instruction: 'Test.',
						rationale: 'Test.',
					},
				],
			}),
		);

		await generateShakeup(makeParams(mockGenerator));

		const call = mockGenerator.getLastCall();
		expect(call).toBeDefined();
		expect(call!.settings.maxTokens).toBe(2048);
	});

	it('returns null on invalid JSON response', async () => {
		mockGenerator.setDefaultResponse('This is not JSON at all.');

		const result = await generateShakeup(makeParams(mockGenerator));
		expect(result).toBeNull();
	});

	it('returns null when generator throws', async () => {
		mockGenerator.setDefaultResponse(() => {
			throw new Error('LLM unavailable');
		});

		const result = await generateShakeup(makeParams(mockGenerator));
		expect(result).toBeNull();
	});

	it('includes worldinfo in prompt when provided', async () => {
		mockGenerator.setDefaultResponse(
			JSON.stringify({
				suggestions: [
					{
						type: 'callback',
						instruction: 'Test.',
						rationale: 'Test.',
					},
				],
			}),
		);

		const params = makeParams(mockGenerator);
		params.worldinfo = 'The ancient prophecy speaks of a chosen one.';

		await generateShakeup(params);

		const call = mockGenerator.getLastCall();
		expect(call).toBeDefined();
		const userContent =
			call!.prompt.messages.find(m => m.role === 'user')?.content ?? '';
		expect(userContent).toContain('The ancient prophecy speaks of a chosen one.');
		expect(userContent).toContain('[World Info]');
	});

	it('does not include worldinfo section when not provided', async () => {
		mockGenerator.setDefaultResponse(
			JSON.stringify({
				suggestions: [
					{
						type: 'arrival',
						instruction: 'Test.',
						rationale: 'Test.',
					},
				],
			}),
		);

		await generateShakeup(makeParams(mockGenerator));

		const call = mockGenerator.getLastCall();
		const userContent =
			call!.prompt.messages.find(m => m.role === 'user')?.content ?? '';
		expect(userContent).not.toContain('[World Info]');
	});

	it('includes scene state in the prompt', async () => {
		mockGenerator.setDefaultResponse(
			JSON.stringify({
				suggestions: [
					{
						type: 'arrival',
						instruction: 'Test.',
						rationale: 'Test.',
					},
				],
			}),
		);

		await generateShakeup(makeParams(mockGenerator));

		const call = mockGenerator.getLastCall();
		const userContent =
			call!.prompt.messages.find(m => m.role === 'user')?.content ?? '';
		expect(userContent).toContain('[Current Scene]');
		expect(userContent).toContain('Throne Room');
	});

	it('includes relationships in the prompt', async () => {
		mockGenerator.setDefaultResponse(
			JSON.stringify({
				suggestions: [
					{
						type: 'revelation',
						instruction: 'Test.',
						rationale: 'Test.',
					},
				],
			}),
		);

		await generateShakeup(makeParams(mockGenerator));

		const call = mockGenerator.getLastCall();
		const userContent =
			call!.prompt.messages.find(m => m.role === 'user')?.content ?? '';
		expect(userContent).toContain('[Relationships]');
		expect(userContent).toContain('Knight & Traveler: wary allies');
	});

	it('includes character description in the prompt', async () => {
		mockGenerator.setDefaultResponse(
			JSON.stringify({
				suggestions: [
					{
						type: 'arrival',
						instruction: 'Test.',
						rationale: 'Test.',
					},
				],
			}),
		);

		await generateShakeup(makeParams(mockGenerator));

		const call = mockGenerator.getLastCall();
		const userContent =
			call!.prompt.messages.find(m => m.role === 'user')?.content ?? '';
		expect(userContent).toContain('A noble knight');
	});
});
