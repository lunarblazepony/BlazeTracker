import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractInitialOutfit } from './extractInitialOutfit';
import type { LocationState } from './extractLocation';

// Mock the dependencies
vi.mock('../settings', () => ({
	getSettings: () => ({
		profileId: 'test-profile',
		maxResponseTokens: 1000,
	}),
	getTemperature: () => 0.7,
}));

vi.mock('../prompts', () => ({
	getPromptParts: () => ({
		system: 'Test system prompt',
		user: '{{characters}}\n{{location}}\n{{messages}}',
	}),
}));

vi.mock('../utils/generator', () => ({
	makeGeneratorRequest: vi.fn(),
	buildExtractionMessages: vi.fn(() => []),
}));

vi.mock('../state/eventStore', () => ({
	generateUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2)),
}));

import { makeGeneratorRequest } from '../utils/generator';

describe('extractInitialOutfit', () => {
	const mockLocation: LocationState = {
		area: 'Downtown',
		place: 'Coffee Shop',
		position: 'Near the entrance',
		props: [],
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('generates outfit_changed events for non-null slots', async () => {
		const mockResponse = JSON.stringify({
			characters: [
				{
					name: 'Marcus',
					outfit: {
						head: null,
						neck: null,
						jacket: 'Black leather jacket',
						back: null,
						torso: 'Gray t-shirt',
						legs: 'Blue jeans',
						underwear: 'Boxers',
						socks: 'White ankle socks',
						footwear: 'Running shoes',
					},
				},
			],
		});

		vi.mocked(makeGeneratorRequest).mockResolvedValueOnce(mockResponse);

		const events = await extractInitialOutfit(
			'Marcus walked into the coffee shop.',
			mockLocation,
			[
				{
					name: 'Marcus',
					initialPosition: 'Near the door',
					initialActivity: 'Entering',
				},
			],
			5,
			0,
		);

		// Should generate events for: jacket, torso, legs, underwear, socks, footwear (6 non-null slots)
		expect(events).toHaveLength(6);

		// All events should be outfit_changed
		expect(events.every(e => e.subkind === 'outfit_changed')).toBe(true);

		// All events should be for Marcus
		expect(events.every(e => e.character === 'Marcus')).toBe(true);

		// All events should have previousValue: null (new character)
		expect(events.every(e => e.previousValue === null)).toBe(true);

		// Check specific slots
		const jacketEvent = events.find(e => e.slot === 'jacket');
		expect(jacketEvent?.newValue).toBe('Black leather jacket');

		const torsoEvent = events.find(e => e.slot === 'torso');
		expect(torsoEvent?.newValue).toBe('Gray t-shirt');

		const legsEvent = events.find(e => e.slot === 'legs');
		expect(legsEvent?.newValue).toBe('Blue jeans');
	});

	it('skips slots with null values', async () => {
		const mockResponse = JSON.stringify({
			characters: [
				{
					name: 'Pikachu',
					outfit: {
						head: null,
						neck: null,
						jacket: null,
						back: null,
						torso: null,
						legs: null,
						underwear: null,
						socks: null,
						footwear: null,
					},
				},
			],
		});

		vi.mocked(makeGeneratorRequest).mockResolvedValueOnce(mockResponse);

		const events = await extractInitialOutfit(
			'A Pikachu bounded into the room.',
			mockLocation,
			[
				{
					name: 'Pikachu',
					initialPosition: 'Center of room',
					initialActivity: 'Bouncing excitedly',
				},
			],
			5,
			0,
		);

		// No events for Pokemon with all null outfit
		expect(events).toHaveLength(0);
	});

	it('handles multiple new characters', async () => {
		const mockResponse = JSON.stringify({
			characters: [
				{
					name: 'Alice',
					outfit: {
						head: null,
						neck: 'Pearl necklace',
						jacket: null,
						back: null,
						torso: 'Blue blouse',
						legs: 'Black skirt',
						underwear: 'Lace underwear',
						socks: 'Sheer stockings',
						footwear: 'Black heels',
					},
				},
				{
					name: 'Bob',
					outfit: {
						head: 'Baseball cap',
						neck: null,
						jacket: 'Hoodie',
						back: 'Backpack',
						torso: 'T-shirt',
						legs: 'Cargo shorts',
						underwear: 'Boxers',
						socks: 'Ankle socks',
						footwear: 'Sneakers',
					},
				},
			],
		});

		vi.mocked(makeGeneratorRequest).mockResolvedValueOnce(mockResponse);

		const events = await extractInitialOutfit(
			'Alice and Bob walked in together.',
			mockLocation,
			[
				{
					name: 'Alice',
					initialPosition: 'Left side',
					initialActivity: 'Walking',
				},
				{
					name: 'Bob',
					initialPosition: 'Right side',
					initialActivity: 'Walking',
				},
			],
			5,
			0,
		);

		// Alice: 6 non-null slots (neck, torso, legs, underwear, socks, footwear)
		// Bob: 9 non-null slots (head, jacket, back, torso, legs, underwear, socks, footwear)
		const aliceEvents = events.filter(e => e.character === 'Alice');
		const bobEvents = events.filter(e => e.character === 'Bob');

		expect(aliceEvents).toHaveLength(6);
		expect(bobEvents).toHaveLength(8);
	});

	it('returns empty array when no characters provided', async () => {
		const events = await extractInitialOutfit('Some message', mockLocation, [], 5, 0);

		expect(events).toHaveLength(0);
		expect(makeGeneratorRequest).not.toHaveBeenCalled();
	});

	it('ignores characters not in the request', async () => {
		const mockResponse = JSON.stringify({
			characters: [
				{
					name: 'Marcus',
					outfit: { torso: 'Shirt', legs: 'Pants' },
				},
				{
					name: 'UnexpectedCharacter',
					outfit: { torso: 'Something', legs: 'Something else' },
				},
			],
		});

		vi.mocked(makeGeneratorRequest).mockResolvedValueOnce(mockResponse);

		const events = await extractInitialOutfit(
			'Marcus entered.',
			mockLocation,
			[{ name: 'Marcus' }],
			5,
			0,
		);

		// Only Marcus's events should be included
		expect(events.every(e => e.character === 'Marcus')).toBe(true);
		expect(events.filter(e => e.character === 'UnexpectedCharacter')).toHaveLength(0);
	});

	it('sets correct messageId and swipeId on events', async () => {
		const mockResponse = JSON.stringify({
			characters: [
				{
					name: 'Test',
					outfit: { torso: 'Shirt' },
				},
			],
		});

		vi.mocked(makeGeneratorRequest).mockResolvedValueOnce(mockResponse);

		const events = await extractInitialOutfit(
			'Test entered.',
			mockLocation,
			[{ name: 'Test' }],
			42,
			3,
		);

		expect(events).toHaveLength(1);
		expect(events[0].messageId).toBe(42);
		expect(events[0].swipeId).toBe(3);
	});

	it('handles malformed response gracefully', async () => {
		vi.mocked(makeGeneratorRequest).mockResolvedValueOnce('not valid json');

		const events = await extractInitialOutfit(
			'Someone entered.',
			mockLocation,
			[{ name: 'Someone' }],
			5,
			0,
		);

		// Should return empty array on parse failure
		expect(events).toHaveLength(0);
	});

	it('handles missing characters array in response', async () => {
		const mockResponse = JSON.stringify({ something: 'else' });

		vi.mocked(makeGeneratorRequest).mockResolvedValueOnce(mockResponse);

		const events = await extractInitialOutfit(
			'Someone entered.',
			mockLocation,
			[{ name: 'Someone' }],
			5,
			0,
		);

		expect(events).toHaveLength(0);
	});
});
