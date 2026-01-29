import { describe, it, expect, vi } from 'vitest';
import { formatStateForInjection } from './injectState';
import type {
	TrackedState,
	NarrativeState,
	NarrativeDateTime,
	ProjectedRelationship,
} from '../types/state';

// Mock getSettings
vi.mock('../settings', () => ({
	getSettings: vi.fn(() => ({
		trackTime: true,
		trackLocation: true,
		trackClimate: true,
		trackScene: true,
		trackCharacters: true,
		trackEvents: true,
		trackRelationships: true,
		temperatureUnit: 'fahrenheit',
		injectedChapters: 3,
		includeRelationshipSecrets: true,
	})),
}));

// Helper to create a minimal NarrativeDateTime
function createTime(overrides: Partial<NarrativeDateTime> = {}): NarrativeDateTime {
	return {
		year: 2024,
		month: 6,
		day: 15,
		hour: 14,
		minute: 30,
		second: 0,
		dayOfWeek: 'Saturday',
		...overrides,
	};
}

// Create a minimal TrackedState for testing
function createMinimalState(overrides: Partial<TrackedState> = {}): TrackedState {
	return {
		...overrides,
	};
}

// Create a minimal NarrativeState for testing
function createMinimalNarrativeState(overrides: Partial<NarrativeState> = {}): NarrativeState {
	return {
		version: 4,
		chapters: [],
		relationships: [],
		forecastCache: [],
		locationMappings: [],
		...overrides,
	} as NarrativeState;
}

describe('formatStateForInjection', () => {
	describe('basic formatting', () => {
		it('returns empty string when no data is available', () => {
			const state = createMinimalState();
			const result = formatStateForInjection(state);
			expect(result).toBe('');
		});

		it('includes time when available', () => {
			const state = createMinimalState({
				time: createTime(),
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('Time:');
			expect(result).toContain('Saturday');
			expect(result).toContain('2:30 PM');
		});

		it('includes location when available', () => {
			const state = createMinimalState({
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'by the window',
					props: [],
				},
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('Location:');
			expect(result).toContain('Downtown');
			expect(result).toContain('Coffee Shop');
		});

		it('includes location props when available', () => {
			const state = createMinimalState({
				location: {
					area: 'Kitchen',
					place: '',
					position: '',
					props: ['knife', 'cutting board', 'vegetables'],
				},
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('Nearby objects:');
			expect(result).toContain('knife');
			expect(result).toContain('cutting board');
		});

		it('includes climate when available', () => {
			const state = createMinimalState({
				climate: { temperature: 75, weather: 'cloudy' },
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('Climate:');
			expect(result).toContain('75');
			expect(result).toContain('cloudy');
		});

		it('includes scene when available', () => {
			const state = createMinimalState({
				scene: {
					topic: 'planning a heist',
					tone: 'tense',
					tension: {
						level: 'tense',
						type: 'suspense',
						direction: 'escalating',
					},
				},
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('Topic: planning a heist');
			expect(result).toContain('Tone: tense');
			expect(result).toContain('Tension:');
		});

		it('includes characters when available', () => {
			const state = createMinimalState({
				characters: [
					{
						name: 'Alice',
						position: 'sitting on the couch',
						mood: ['happy', 'excited'],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: 'dress',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
					{
						name: 'Bob',
						position: 'standing',
						activity: 'reading a book',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: 'shirt',
							legs: 'pants',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
				],
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('Characters present:');
			expect(result).toContain('Alice');
			expect(result).toContain('sitting on the couch');
			expect(result).toContain('happy, excited');
			expect(result).toContain('Bob');
			expect(result).toContain('reading a book');
		});

		it('includes events when available', () => {
			const state = createMinimalState({
				currentEvents: [
					{
						summary: 'Alice revealed a secret',
						timestamp: createTime(),
						tensionLevel: 'tense',
						tensionType: 'vulnerable',
						witnesses: ['Alice', 'Bob'],
						location: 'the park',
						eventTypes: ['conversation'],
						messageId: 0,
					},
				],
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('[Recent Events]');
			expect(result).toContain('Alice revealed a secret');
		});
	});

	describe('projected relationships', () => {
		it('uses projectedRelationships from options when provided', () => {
			const state = createMinimalState({
				characters: [
					{
						name: 'Alice',
						position: 'here',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: '',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
					{
						name: 'Bob',
						position: 'here',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: '',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
				],
			});
			const narrativeState = createMinimalNarrativeState();
			const projectedRelationships: ProjectedRelationship[] = [
				{
					pair: ['Alice', 'Bob'],
					status: 'intimate',
					aToB: {
						feelings: ['love', 'devotion'],
						wants: [],
						secrets: [],
					},
					bToA: { feelings: ['love'], wants: [], secrets: [] },
				},
			];

			const result = formatStateForInjection(state, narrativeState, {
				projectedRelationships,
			});

			expect(result).toContain('[Relationships]');
			expect(result).toContain('intimate');
			expect(result).toContain('love');
			expect(result).toContain('devotion');
		});

		it('shows no relationships section when projectedRelationships is empty', () => {
			const state = createMinimalState({
				time: createTime(),
			});
			const narrativeState = createMinimalNarrativeState();

			const result = formatStateForInjection(state, narrativeState, {
				projectedRelationships: [],
			});

			expect(result).not.toContain('[Relationships]');
		});
	});

	describe('knowledge gaps', () => {
		it('includes knowledge gaps when characters missed events', () => {
			const state = createMinimalState({
				characters: [
					{
						name: 'Alice',
						position: 'here',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: '',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
					{
						name: 'Bob',
						position: 'here',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: '',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
				],
				currentEvents: [
					{
						summary: 'A secret meeting occurred',
						timestamp: createTime(),
						tensionLevel: 'guarded',
						tensionType: 'suspense',
						witnesses: ['Alice'], // Bob wasn't there
						location: 'secret room',
						eventTypes: ['discovery'],
						messageId: 0,
					},
				],
			});

			const result = formatStateForInjection(state);

			expect(result).toContain('[Knowledge Gaps]');
			expect(result).toContain('Bob was not present for');
			expect(result).toContain('A secret meeting occurred');
		});

		it('does not include knowledge gaps when all characters witnessed events', () => {
			const state = createMinimalState({
				characters: [
					{
						name: 'Alice',
						position: 'here',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: '',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
					{
						name: 'Bob',
						position: 'here',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: '',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
				],
				currentEvents: [
					{
						summary: 'A public announcement',
						timestamp: createTime(),
						tensionLevel: 'relaxed',
						tensionType: 'conversation',
						witnesses: ['Alice', 'Bob'],
						location: 'town square',
						eventTypes: ['conversation'],
						messageId: 0,
					},
				],
			});

			const result = formatStateForInjection(state);

			expect(result).not.toContain('[Knowledge Gaps]');
		});
	});

	describe('section structure', () => {
		it('wraps scene state in correct tags', () => {
			const state = createMinimalState({
				time: createTime(),
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('[Scene State]');
			expect(result).toContain('[/Scene State]');
		});

		it('wraps events in correct tags', () => {
			const state = createMinimalState({
				currentEvents: [
					{
						summary: 'Something happened',
						timestamp: createTime(),
						tensionLevel: 'relaxed',
						tensionType: 'conversation',
						witnesses: [],
						location: 'here',
						eventTypes: ['conversation'],
						messageId: 0,
					},
				],
			});
			const result = formatStateForInjection(state);
			expect(result).toContain('[Recent Events]');
			expect(result).toContain('[/Recent Events]');
		});

		it('wraps relationships in correct tags', () => {
			const state = createMinimalState({
				characters: [
					{
						name: 'Alice',
						position: 'here',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: '',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
					{
						name: 'Bob',
						position: 'here',
						mood: [],
						physicalState: [],
						outfit: {
							head: '',
							neck: '',
							jacket: '',
							back: '',
							torso: '',
							legs: '',
							footwear: '',
							socks: '',
							underwear: '',
						},
					},
				],
			});
			const projectedRelationships: ProjectedRelationship[] = [
				{
					pair: ['Alice', 'Bob'],
					status: 'friendly',
					aToB: { feelings: ['trust'], wants: [], secrets: [] },
					bToA: { feelings: ['respect'], wants: [], secrets: [] },
				},
			];
			const result = formatStateForInjection(state, null, {
				projectedRelationships,
			});
			expect(result).toContain('[Relationships]');
			expect(result).toContain('[/Relationships]');
		});
	});
});
