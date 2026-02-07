import { describe, it, expect } from 'vitest';
import {
	buildAkaLookup,
	resolveCharacterName,
	resolveNamesInEvents,
	applyUserMappings,
} from './resolveEventNames';
import type { CharacterState } from '../../types/snapshot';
import type { Event } from '../../types/event';
import { createEmptyCharacterState } from '../../types/snapshot';

function makeCharacter(name: string, akas: string[] = []): CharacterState {
	return {
		...createEmptyCharacterState(name),
		akas,
	};
}

function makeSource(messageId = 1, swipeId = 0) {
	return { messageId, swipeId };
}

describe('buildAkaLookup', () => {
	it('maps canonical names to themselves', () => {
		const characters: Record<string, CharacterState> = {
			John: makeCharacter('John'),
			Alice: makeCharacter('Alice'),
		};
		const lookup = buildAkaLookup(characters);
		expect(lookup.get('john')).toBe('John');
		expect(lookup.get('alice')).toBe('Alice');
	});

	it('maps AKAs to canonical names', () => {
		const characters: Record<string, CharacterState> = {
			John: makeCharacter('John', ['Johnny', 'Dr. Smith']),
		};
		const lookup = buildAkaLookup(characters);
		expect(lookup.get('johnny')).toBe('John');
		expect(lookup.get('dr. smith')).toBe('John');
	});

	it('handles characters without AKAs', () => {
		const characters: Record<string, CharacterState> = {
			John: makeCharacter('John'),
		};
		const lookup = buildAkaLookup(characters);
		expect(lookup.get('john')).toBe('John');
		expect(lookup.size).toBe(1);
	});

	it('handles empty characters', () => {
		const lookup = buildAkaLookup({});
		expect(lookup.size).toBe(0);
	});
});

describe('resolveCharacterName', () => {
	const characters: Record<string, CharacterState> = {
		John: makeCharacter('John', ['Johnny', 'John Smith']),
		Alice: makeCharacter('Alice', ['Ali']),
	};
	const lookup = buildAkaLookup(characters);
	const canonicalNames = ['John', 'Alice'];

	it('resolves via direct AKA lookup', () => {
		expect(resolveCharacterName('Johnny', lookup, canonicalNames)).toBe('John');
	});

	it('resolves via canonical name directly', () => {
		expect(resolveCharacterName('John', lookup, canonicalNames)).toBe('John');
	});

	it('resolves case-insensitively', () => {
		expect(resolveCharacterName('JOHNNY', lookup, canonicalNames)).toBe('John');
	});

	it('returns null for unresolvable names', () => {
		expect(resolveCharacterName('Bob', lookup, canonicalNames)).toBeNull();
	});

	it('resolves via fuzzy match against canonical names', () => {
		// namesMatch handles partial matches
		expect(resolveCharacterName('Dr. John', lookup, canonicalNames)).toBe('John');
	});
});

describe('resolveNamesInEvents', () => {
	const characters: Record<string, CharacterState> = {
		John: makeCharacter('John', ['Johnny']),
		Alice: makeCharacter('Alice'),
	};
	const lookup = buildAkaLookup(characters);
	const canonicalNames = ['John', 'Alice'];

	it('resolves character event names', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'position_changed',
				character: 'Johnny',
				newValue: 'sitting',
			} as Event,
		];

		const result = resolveNamesInEvents(events, lookup, canonicalNames);
		expect(result.unresolvedNames).toEqual([]);
		expect((events[0] as any).character).toBe('John');
	});

	it('collects unresolved names', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'UnknownPerson',
				initialPosition: '',
				initialActivity: undefined,
				initialMood: [],
				initialPhysicalState: [],
			} as Event,
		];

		const result = resolveNamesInEvents(events, lookup, canonicalNames);
		expect(result.unresolvedNames).toContain('UnknownPerson');
	});

	it('resolves directional relationship event names', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Johnny',
				towardCharacter: 'Alice',
				value: 'trust',
			} as Event,
		];

		resolveNamesInEvents(events, lookup, canonicalNames);
		expect((events[0] as any).fromCharacter).toBe('John');
		expect((events[0] as any).towardCharacter).toBe('Alice');
	});

	it('resolves pair-based relationship event names and re-sorts', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Johnny', 'Alice'] as [string, string],
				newStatus: 'friendly',
			} as Event,
		];

		resolveNamesInEvents(events, lookup, canonicalNames);
		// After resolution, pair should be sorted
		expect((events[0] as any).pair).toEqual(['Alice', 'John']);
	});

	it('skips akas_add events', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'akas_add',
				character: 'SomeName',
				akas: ['Alias1'],
			} as Event,
		];

		const result = resolveNamesInEvents(events, lookup, canonicalNames);
		// Should NOT try to resolve the character field in akas_add events
		expect((events[0] as any).character).toBe('SomeName');
		expect(result.unresolvedNames).toEqual([]);
	});

	it('handles empty events list', () => {
		const result = resolveNamesInEvents([], lookup, canonicalNames);
		expect(result.resolvedEvents).toEqual([]);
		expect(result.unresolvedNames).toEqual([]);
	});

	it('does not duplicate unresolved names', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'position_changed',
				character: 'Bob',
				newValue: 'standing',
			} as Event,
			{
				id: '2',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'activity_changed',
				character: 'Bob',
				newValue: 'talking',
			} as Event,
		];

		const result = resolveNamesInEvents(events, lookup, canonicalNames);
		expect(result.unresolvedNames).toEqual(['Bob']);
	});
});

describe('applyUserMappings', () => {
	it('applies mappings to character events', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'position_changed',
				character: 'Bob',
				newValue: 'sitting',
			} as Event,
		];

		applyUserMappings(events, [{ unresolvedName: 'Bob', resolvedTo: 'John' }]);
		expect((events[0] as any).character).toBe('John');
	});

	it('skips mappings with null resolvedTo', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'position_changed',
				character: 'Bob',
				newValue: 'sitting',
			} as Event,
		];

		applyUserMappings(events, [{ unresolvedName: 'Bob', resolvedTo: null }]);
		expect((events[0] as any).character).toBe('Bob');
	});

	it('applies mappings to directional relationship events', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Bob',
				towardCharacter: 'Alice',
				value: 'trust',
			} as Event,
		];

		applyUserMappings(events, [{ unresolvedName: 'Bob', resolvedTo: 'John' }]);
		expect((events[0] as any).fromCharacter).toBe('John');
	});

	it('applies mappings to pair-based events and re-sorts', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Bob', 'Alice'] as [string, string],
				newStatus: 'friendly',
			} as Event,
		];

		applyUserMappings(events, [{ unresolvedName: 'Bob', resolvedTo: 'John' }]);
		expect((events[0] as any).pair).toEqual(['Alice', 'John']);
	});

	it('skips akas_add events', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'akas_add',
				character: 'Bob',
				akas: ['Bobby'],
			} as Event,
		];

		applyUserMappings(events, [{ unresolvedName: 'Bob', resolvedTo: 'John' }]);
		expect((events[0] as any).character).toBe('Bob');
	});

	it('does nothing with empty mappings', () => {
		const events: Event[] = [
			{
				id: '1',
				source: makeSource(),
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'position_changed',
				character: 'Bob',
				newValue: 'sitting',
			} as Event,
		];

		applyUserMappings(events, []);
		expect((events[0] as any).character).toBe('Bob');
	});
});
