import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	deserializeEventStore,
	isValidEvent,
	isValidSnapshot,
	serializeEvents,
	serializeSnapshots,
	serializeEventStore,
	generateEventId,
	STORE_VERSION,
} from './serialization';
import { createEmptySnapshot } from '../types/snapshot';
import type { Event } from '../types/event';
import type { Snapshot } from '../types/snapshot';

vi.mock('../../utils/debug', () => ({
	debugWarn: vi.fn(),
	errorLog: vi.fn(),
	debugLog: vi.fn(),
}));

import { debugWarn } from '../../utils/debug';

const makeSource = (messageId = 1, swipeId = 0) => ({ messageId, swipeId });

function makeValidEvent(overrides: Partial<Event> = {}): Event {
	return {
		id: 'test-id-1234',
		source: makeSource(),
		timestamp: Date.now(),
		kind: 'time',
		subkind: 'initial',
		time: '2024-01-01T12:00:00Z',
		...overrides,
	} as Event;
}

function makeValidSnapshot(): Snapshot {
	return createEmptySnapshot(makeSource());
}

describe('deserializeEventStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns null for null', () => {
		expect(deserializeEventStore(null)).toBeNull();
	});

	it('returns null for undefined', () => {
		expect(deserializeEventStore(undefined)).toBeNull();
	});

	it('returns null for non-object (string)', () => {
		expect(deserializeEventStore('hello')).toBeNull();
	});

	it('returns null for non-object (number)', () => {
		expect(deserializeEventStore(42)).toBeNull();
	});

	it('returns null when version is missing', () => {
		expect(deserializeEventStore({ snapshots: [], events: [] })).toBeNull();
	});

	it('returns null when version is not a number', () => {
		expect(
			deserializeEventStore({ version: '1', snapshots: [], events: [] }),
		).toBeNull();
	});

	it('warns but does NOT return null for unknown version', () => {
		const result = deserializeEventStore({
			version: 999,
			snapshots: [],
			events: [],
		});
		expect(result).not.toBeNull();
		expect(result).toEqual({ snapshots: [], events: [] });
		expect(debugWarn).toHaveBeenCalledWith(
			expect.stringContaining('Unknown event store version: 999'),
		);
	});

	it('returns null when snapshots is not an array', () => {
		expect(
			deserializeEventStore({
				version: STORE_VERSION,
				snapshots: 'not-array',
				events: [],
			}),
		).toBeNull();
	});

	it('returns null when events is not an array', () => {
		expect(
			deserializeEventStore({
				version: STORE_VERSION,
				snapshots: [],
				events: 'not-array',
			}),
		).toBeNull();
	});

	it('valid data returns snapshots and events', () => {
		const snapshot = makeValidSnapshot();
		const event = makeValidEvent();
		const result = deserializeEventStore({
			version: STORE_VERSION,
			snapshots: [snapshot],
			events: [event],
		});
		expect(result).not.toBeNull();
		expect(result!.snapshots).toHaveLength(1);
		expect(result!.events).toHaveLength(1);
		expect(result!.snapshots[0].type).toBe('initial');
		expect(result!.events[0].id).toBe('test-id-1234');
	});

	it('migrates old snapshots missing forecasts field', () => {
		const snapshot = makeValidSnapshot();
		// Remove forecasts to simulate old data
		delete (snapshot as unknown as Record<string, unknown>).forecasts;

		const result = deserializeEventStore({
			version: STORE_VERSION,
			snapshots: [snapshot],
			events: [],
		});

		expect(result).not.toBeNull();
		expect(result!.snapshots[0].forecasts).toEqual({});
	});
});

describe('isValidEvent', () => {
	it('returns false for null', () => {
		expect(isValidEvent(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isValidEvent(undefined)).toBe(false);
	});

	it('returns false for non-object', () => {
		expect(isValidEvent('string')).toBe(false);
		expect(isValidEvent(42)).toBe(false);
	});

	it('returns false when missing id', () => {
		expect(
			isValidEvent({
				source: makeSource(),
				timestamp: 123,
				kind: 'time',
			}),
		).toBe(false);
	});

	it('returns false when missing source', () => {
		expect(
			isValidEvent({
				id: 'abc',
				timestamp: 123,
				kind: 'time',
			}),
		).toBe(false);
	});

	it('returns false when missing timestamp', () => {
		expect(
			isValidEvent({
				id: 'abc',
				source: makeSource(),
				kind: 'time',
			}),
		).toBe(false);
	});

	it('returns false when missing kind', () => {
		expect(
			isValidEvent({
				id: 'abc',
				source: makeSource(),
				timestamp: 123,
			}),
		).toBe(false);
	});

	it('returns false when source missing messageId', () => {
		expect(
			isValidEvent({
				id: 'abc',
				source: { swipeId: 0 },
				timestamp: 123,
				kind: 'time',
			}),
		).toBe(false);
	});

	it('returns false when source missing swipeId', () => {
		expect(
			isValidEvent({
				id: 'abc',
				source: { messageId: 1 },
				timestamp: 123,
				kind: 'time',
			}),
		).toBe(false);
	});

	it('returns true for valid event with all required fields', () => {
		expect(isValidEvent(makeValidEvent())).toBe(true);
	});
});

describe('isValidSnapshot', () => {
	it('returns false for null', () => {
		expect(isValidSnapshot(null)).toBe(false);
	});

	it('returns false for undefined', () => {
		expect(isValidSnapshot(undefined)).toBe(false);
	});

	it('returns false for non-object', () => {
		expect(isValidSnapshot('string')).toBe(false);
		expect(isValidSnapshot(123)).toBe(false);
	});

	it('returns false when missing type', () => {
		const s = makeValidSnapshot();
		delete (s as unknown as Record<string, unknown>).type;
		expect(isValidSnapshot(s)).toBe(false);
	});

	it('returns false when missing source', () => {
		const s = makeValidSnapshot();
		delete (s as unknown as Record<string, unknown>).source;
		expect(isValidSnapshot(s)).toBe(false);
	});

	it('returns false when missing timestamp', () => {
		const s = makeValidSnapshot();
		delete (s as unknown as Record<string, unknown>).timestamp;
		expect(isValidSnapshot(s)).toBe(false);
	});

	it('returns false when missing swipeId', () => {
		const s = makeValidSnapshot();
		delete (s as unknown as Record<string, unknown>).swipeId;
		expect(isValidSnapshot(s)).toBe(false);
	});

	it('returns false when source missing messageId', () => {
		const s = makeValidSnapshot();
		(s as unknown as Record<string, unknown>).source = { swipeId: 0 };
		expect(isValidSnapshot(s)).toBe(false);
	});

	it('returns false when source missing swipeId', () => {
		const s = makeValidSnapshot();
		(s as unknown as Record<string, unknown>).source = { messageId: 1 };
		expect(isValidSnapshot(s)).toBe(false);
	});

	it('returns true for valid snapshot', () => {
		expect(isValidSnapshot(makeValidSnapshot())).toBe(true);
	});
});

describe('serializeEvents', () => {
	it('clones events so modifying clone does not affect original', () => {
		const original = makeValidEvent();
		const cloned = serializeEvents([original]);

		cloned[0].id = 'modified';
		expect(original.id).toBe('test-id-1234');
	});

	it('clones source object', () => {
		const original = makeValidEvent();
		const cloned = serializeEvents([original]);

		cloned[0].source.messageId = 999;
		expect(original.source.messageId).toBe(1);
	});

	it('clones witnesses array if present', () => {
		const original = makeValidEvent({
			witnesses: ['Alice', 'Bob'],
		} as Partial<Event>);
		const cloned = serializeEvents([original]);

		(cloned[0] as unknown as Record<string, unknown>).witnesses = ['Charlie'];
		expect((original as unknown as Record<string, unknown>).witnesses).toEqual([
			'Alice',
			'Bob',
		]);
	});

	it('clones pair array if present', () => {
		const original = {
			...makeValidEvent(),
			pair: ['Alice', 'Bob'] as [string, string],
		};
		const cloned = serializeEvents([original as Event]);

		((cloned[0] as unknown as Record<string, unknown>).pair as string[])[0] = 'Charlie';
		expect(original.pair).toEqual(['Alice', 'Bob']);
	});
});

describe('serializeSnapshots', () => {
	it('deep clones snapshots via cloneSnapshot', () => {
		const original = makeValidSnapshot();
		original.characters = {
			Alice: {
				name: 'Alice',
				position: 'standing',
				activity: null,
				mood: ['happy'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'shirt',
					legs: 'jeans',
					footwear: null,
					socks: null,
					underwear: null,
				},
				akas: [],
			},
		};

		const cloned = serializeSnapshots([original]);

		// Modify the clone and verify original is unaffected
		cloned[0].characters.Alice.mood.push('sad');
		expect(original.characters.Alice.mood).toEqual(['happy']);

		cloned[0].characters.Alice.name = 'Bob';
		expect(original.characters.Alice.name).toBe('Alice');
	});
});

describe('serializeEventStore', () => {
	it('returns correct version, snapshots, and events', () => {
		const snapshot = makeValidSnapshot();
		const event = makeValidEvent();

		const result = serializeEventStore([snapshot], [event]);

		expect(result.version).toBe(STORE_VERSION);
		expect(result.snapshots).toHaveLength(1);
		expect(result.events).toHaveLength(1);
		expect(result.snapshots[0].type).toBe('initial');
		expect(result.events[0].id).toBe('test-id-1234');
	});
});

describe('generateEventId', () => {
	it('returns a string', () => {
		const id = generateEventId();
		expect(typeof id).toBe('string');
	});

	it('returns UUID format (8-4-4-4-12 hex pattern)', () => {
		const id = generateEventId();
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
		expect(id).toMatch(uuidRegex);
	});

	it('returns unique IDs on successive calls', () => {
		const id1 = generateEventId();
		const id2 = generateEventId();
		const id3 = generateEventId();
		expect(id1).not.toBe(id2);
		expect(id2).not.toBe(id3);
		expect(id1).not.toBe(id3);
	});
});
