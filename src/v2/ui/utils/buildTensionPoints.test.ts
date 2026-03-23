import { describe, it, expect, vi, beforeEach } from 'vitest';
import moment from 'moment';
import type { TensionEvent } from '../../types/event';
import type { TensionLevel } from '../../types/common';

vi.mock('../../store/projection', () => ({
	filterCanonicalEvents: vi.fn(events => events),
	filterActiveEvents: vi.fn(events => events),
	filterEventsUpToMessage: vi.fn(events => events),
}));

import { filterEventsUpToMessage } from '../../store/projection';
import { getTensionLevelValue, buildTensionPoints } from './buildTensionPoints';

function createMockStore(
	opts: {
		initialSnapshot?: any;
		events?: any[];
		projectStateAtMessage?: any;
	} = {},
) {
	return {
		initialSnapshot: opts.initialSnapshot ?? null,
		events: opts.events ?? [],
		projectStateAtMessage:
			opts.projectStateAtMessage ??
			vi.fn(() => ({
				time: moment('2024-01-15T12:00:00.000Z'),
				currentChapter: 0,
			})),
	} as any;
}

const mockSnapshot = {
	source: { messageId: 0, swipeId: 0 },
	time: '2024-01-15T10:00:00.000Z',
	scene: {
		topic: 'test',
		tone: 'casual',
		tension: {
			level: 'relaxed' as const,
			type: 'confrontation' as const,
			direction: 'stable' as const,
		},
	},
	chapterIndex: 0,
};

function makeTensionEvent(
	overrides: Partial<TensionEvent> & {
		id: string;
		source: { messageId: number; swipeId: number };
	},
): TensionEvent {
	return {
		timestamp: Date.now(),
		kind: 'tension',
		level: 'tense',
		type: 'confrontation',
		direction: 'escalating',
		...overrides,
	} as TensionEvent;
}

const swipeContext = {} as any;

describe('getTensionLevelValue', () => {
	it.each([
		['relaxed', 1],
		['aware', 2],
		['guarded', 3],
		['tense', 4],
		['charged', 5],
		['volatile', 6],
		['explosive', 7],
	] as [TensionLevel, number][])('returns %i for "%s"', (level, expected) => {
		expect(getTensionLevelValue(level)).toBe(expected);
	});

	it('returns 1 for unknown/invalid level', () => {
		expect(getTensionLevelValue('nonexistent' as TensionLevel)).toBe(1);
	});
});

describe('buildTensionPoints', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns empty array when no initial snapshot', () => {
		const store = createMockStore({ initialSnapshot: null });
		const result = buildTensionPoints(store, swipeContext);
		expect(result).toEqual([]);
	});

	it('returns empty array when snapshot has no time', () => {
		const store = createMockStore({
			initialSnapshot: {
				source: { messageId: 0, swipeId: 0 },
				time: null,
				scene: mockSnapshot.scene,
				chapterIndex: 0,
			},
		});
		const result = buildTensionPoints(store, swipeContext);
		expect(result).toEqual([]);
	});

	it('returns empty array when snapshot has no scene', () => {
		const store = createMockStore({
			initialSnapshot: {
				source: { messageId: 0, swipeId: 0 },
				time: '2024-01-15T10:00:00.000Z',
				scene: null,
				chapterIndex: 0,
			},
		});
		const result = buildTensionPoints(store, swipeContext);
		expect(result).toEqual([]);
	});

	it('returns single point from snapshot when no tension events', () => {
		const store = createMockStore({ initialSnapshot: mockSnapshot, events: [] });
		const result = buildTensionPoints(store, swipeContext);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			narrativeTime: moment('2024-01-15T10:00:00.000Z').valueOf(),
			messageId: 0,
			level: 'relaxed',
			type: 'confrontation',
			direction: 'stable',
			levelValue: 1,
			chapterIndex: 0,
		});
	});

	it('returns initial point plus points from tension events', () => {
		const tensionEvent = makeTensionEvent({
			id: 'evt-1',
			source: { messageId: 3, swipeId: 0 },
			level: 'tense',
			type: 'confrontation',
			direction: 'escalating',
		});

		const projectionTime = moment('2024-01-15T14:00:00.000Z');
		const store = createMockStore({
			initialSnapshot: mockSnapshot,
			events: [tensionEvent],
			projectStateAtMessage: vi.fn(() => ({
				time: projectionTime,
				currentChapter: 0,
			})),
		});

		const result = buildTensionPoints(store, swipeContext);

		expect(result).toHaveLength(2);
		expect(result[0].messageId).toBe(0);
		expect(result[0].level).toBe('relaxed');
		expect(result[1].messageId).toBe(3);
		expect(result[1].level).toBe('tense');
		expect(result[1].levelValue).toBe(4);
		expect(result[1].type).toBe('confrontation');
		expect(result[1].direction).toBe('escalating');
		expect(result[1].chapterIndex).toBe(0);
	});

	it('sorts points by narrativeTime', () => {
		const earlyEvent = makeTensionEvent({
			id: 'evt-early',
			source: { messageId: 5, swipeId: 0 },
			level: 'volatile',
			type: 'confrontation',
			direction: 'escalating',
		});
		const lateEvent = makeTensionEvent({
			id: 'evt-late',
			source: { messageId: 3, swipeId: 0 },
			level: 'charged',
			type: 'intimate',
			direction: 'decreasing',
		});

		const store = createMockStore({
			initialSnapshot: mockSnapshot,
			events: [lateEvent, earlyEvent],
			projectStateAtMessage: vi.fn((messageId: number) => {
				if (messageId === 5) {
					return {
						time: moment('2024-01-15T11:00:00.000Z'),
						currentChapter: 0,
					};
				}
				return {
					time: moment('2024-01-15T16:00:00.000Z'),
					currentChapter: 0,
				};
			}),
		});

		const result = buildTensionPoints(store, swipeContext);

		expect(result).toHaveLength(3);
		expect(result[0].messageId).toBe(0); // snapshot at 10:00
		expect(result[1].messageId).toBe(5); // early at 11:00
		expect(result[2].messageId).toBe(3); // late at 16:00
	});

	it('passes upToMessage to filterEventsUpToMessage', () => {
		const store = createMockStore({ initialSnapshot: mockSnapshot, events: [] });
		buildTensionPoints(store, swipeContext, 10);

		expect(filterEventsUpToMessage).toHaveBeenCalledWith(expect.any(Array), 10);
	});

	it('does not call filterEventsUpToMessage when upToMessage is undefined', () => {
		const store = createMockStore({ initialSnapshot: mockSnapshot, events: [] });
		buildTensionPoints(store, swipeContext);

		expect(filterEventsUpToMessage).not.toHaveBeenCalled();
	});

	it('skips tension event when projection throws', () => {
		const tensionEvent = makeTensionEvent({
			id: 'evt-fail',
			source: { messageId: 3, swipeId: 0 },
		});

		const store = createMockStore({
			initialSnapshot: mockSnapshot,
			events: [tensionEvent],
			projectStateAtMessage: vi.fn(() => {
				throw new Error('projection failed');
			}),
		});

		const result = buildTensionPoints(store, swipeContext);

		expect(result).toHaveLength(1);
		expect(result[0].messageId).toBe(0);
	});

	it('skips tension event when projection has no time', () => {
		const tensionEvent = makeTensionEvent({
			id: 'evt-notime',
			source: { messageId: 3, swipeId: 0 },
		});

		const store = createMockStore({
			initialSnapshot: mockSnapshot,
			events: [tensionEvent],
			projectStateAtMessage: vi.fn(() => ({
				time: null,
				currentChapter: 0,
			})),
		});

		const result = buildTensionPoints(store, swipeContext);

		expect(result).toHaveLength(1);
		expect(result[0].messageId).toBe(0);
	});

	it('ignores non-tension events', () => {
		const nonTensionEvent = {
			id: 'evt-time',
			source: { messageId: 2, swipeId: 0 },
			timestamp: Date.now(),
			kind: 'time',
			subkind: 'delta',
			delta: { days: 0, hours: 1, minutes: 0, seconds: 0 },
		};

		const store = createMockStore({
			initialSnapshot: mockSnapshot,
			events: [nonTensionEvent],
		});

		const result = buildTensionPoints(store, swipeContext);

		expect(result).toHaveLength(1);
		expect(result[0].messageId).toBe(0);
	});
});
