import { describe, it, expect } from 'vitest';
import moment from 'moment';
import {
	createEmptyCharacterState,
	createEmptyAttitude,
	createEmptyRelationshipState,
	createEmptySceneState,
	createEmptySnapshot,
	createProjectionFromSnapshot,
	createSnapshotFromProjection,
	getRelationshipKey,
	parseRelationshipKey,
	sortPair,
	cloneSnapshot,
	cloneProjection,
} from './snapshot';
import type { Snapshot, Projection } from './snapshot';
import { serializeMoment } from './common';

describe('snapshot utility functions', () => {
	describe('createEmptyCharacterState', () => {
		it('creates character state with all fields initialized', () => {
			const char = createEmptyCharacterState('Alice');
			expect(char).toEqual({
				name: 'Alice',
				position: '',
				activity: null,
				mood: [],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: null,
					legs: null,
					footwear: null,
					socks: null,
					underwear: null,
				},
			});
		});

		it('creates new arrays each time', () => {
			const char1 = createEmptyCharacterState('Alice');
			const char2 = createEmptyCharacterState('Alice');
			expect(char1.mood).not.toBe(char2.mood);
			expect(char1.physicalState).not.toBe(char2.physicalState);
		});
	});

	describe('createEmptyAttitude', () => {
		it('creates attitude with empty arrays', () => {
			const attitude = createEmptyAttitude();
			expect(attitude).toEqual({
				feelings: [],
				secrets: [],
				wants: [],
			});
		});

		it('creates new arrays each time', () => {
			const att1 = createEmptyAttitude();
			const att2 = createEmptyAttitude();
			expect(att1.feelings).not.toBe(att2.feelings);
		});
	});

	describe('createEmptyRelationshipState', () => {
		it('creates relationship state with defaults', () => {
			const rel = createEmptyRelationshipState(['Alice', 'Bob']);
			expect(rel).toEqual({
				pair: ['Alice', 'Bob'],
				status: 'strangers',
				aToB: { feelings: [], secrets: [], wants: [] },
				bToA: { feelings: [], secrets: [], wants: [] },
			});
		});
	});

	describe('createEmptySceneState', () => {
		it('creates scene state with defaults', () => {
			const scene = createEmptySceneState();
			expect(scene).toEqual({
				topic: '',
				tone: '',
				tension: {
					level: 'relaxed',
					type: 'conversation',
					direction: 'stable',
				},
			});
		});
	});

	describe('createEmptySnapshot', () => {
		it('creates snapshot with all fields initialized', () => {
			const source = { messageId: 0, swipeId: 0 };
			const snapshot = createEmptySnapshot(source);

			expect(snapshot.type).toBe('initial');
			expect(snapshot.source).toEqual(source);
			expect(snapshot.swipeId).toBe(0);
			expect(snapshot.time).toBeNull();
			expect(snapshot.location).toBeNull();
			expect(snapshot.climate).toBeNull();
			expect(snapshot.scene).toBeNull();
			expect(snapshot.characters).toEqual({});
			expect(snapshot.relationships).toEqual({});
			expect(snapshot.currentChapter).toBe(0);
		});
	});

	describe('getRelationshipKey', () => {
		it('creates key from pair', () => {
			expect(getRelationshipKey(['Alice', 'Bob'])).toBe('Alice|Bob');
		});
	});

	describe('parseRelationshipKey', () => {
		it('parses key back to pair', () => {
			expect(parseRelationshipKey('Alice|Bob')).toEqual(['Alice', 'Bob']);
		});
	});

	describe('sortPair', () => {
		it('sorts alphabetically', () => {
			expect(sortPair('Zoe', 'Alice')).toEqual(['Alice', 'Zoe']);
			expect(sortPair('Alice', 'Bob')).toEqual(['Alice', 'Bob']);
		});
	});
});

describe('projection creation', () => {
	// Time is stored as ISO string in Snapshot
	const testTime = moment({ year: 2024, month: 1, date: 15, hour: 10, minute: 0, second: 0 }); // Feb 15, 2024
	const testTimeIso = serializeMoment(testTime);

	const createTestSnapshot = (): Snapshot => ({
		type: 'initial',
		source: { messageId: 0, swipeId: 0 },
		timestamp: Date.now(),
		swipeId: 0,
		time: testTimeIso,
		location: {
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'at the counter',
			props: ['laptop', 'coffee cup'],
			locationType: 'heated',
		},
		forecasts: {},
		climate: null,
		scene: {
			topic: 'meeting',
			tone: 'friendly',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		characters: {
			Alice: {
				name: 'Alice',
				position: 'sitting',
				activity: 'drinking coffee',
				mood: ['happy', 'relaxed'],
				physicalState: [],
				outfit: {
					head: null,
					neck: 'silver necklace',
					jacket: null,
					back: null,
					torso: 'white blouse',
					legs: 'blue jeans',
					footwear: 'sneakers',
					socks: null,
					underwear: null,
				},
			},
		},
		relationships: {
			'Alice|Bob': {
				pair: ['Alice', 'Bob'],
				status: 'acquaintances',
				aToB: { feelings: ['curious'], secrets: [], wants: ['friendship'] },
				bToA: { feelings: ['interested'], secrets: [], wants: [] },
			},
		},
		currentChapter: 0,
		narrativeEvents: [],
	});

	describe('createProjectionFromSnapshot', () => {
		it('creates projection with all fields', () => {
			const snapshot = createTestSnapshot();
			const projection = createProjectionFromSnapshot(snapshot, {
				messageId: 1,
				swipeId: 0,
			});

			expect(projection.source).toEqual({ messageId: 1, swipeId: 0 });
			// Projection time should be a moment, snapshot time is ISO string
			expect(projection.time).not.toBeNull();
			expect(moment.isMoment(projection.time)).toBe(true);
			expect(projection.time!.year()).toBe(2024);
			expect(projection.time!.month()).toBe(1); // 0-indexed, so 1 = February
			expect(projection.time!.date()).toBe(15);
			expect(projection.time!.hour()).toBe(10);
			expect(projection.location?.area).toBe('Downtown');
			expect(projection.characters.Alice?.name).toBe('Alice');
			expect(projection.relationships['Alice|Bob']?.status).toBe('acquaintances');
			expect(projection.currentChapter).toBe(0);
			expect(projection.charactersPresent).toEqual(['Alice']);
		});

		it('deep clones arrays and objects', () => {
			const snapshot = createTestSnapshot();
			const projection = createProjectionFromSnapshot(snapshot, {
				messageId: 1,
				swipeId: 0,
			});

			// Modify projection
			projection.location!.props.push('new item');
			projection.characters.Alice!.mood.push('excited');
			projection.relationships['Alice|Bob']!.aToB.feelings.push('attraction');

			// Original should be unchanged
			expect(snapshot.location!.props).not.toContain('new item');
			expect(snapshot.characters.Alice!.mood).not.toContain('excited');
			expect(snapshot.relationships['Alice|Bob']!.aToB.feelings).not.toContain(
				'attraction',
			);
		});

		it('handles null fields', () => {
			const snapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
			const projection = createProjectionFromSnapshot(snapshot, {
				messageId: 1,
				swipeId: 0,
			});

			expect(projection.time).toBeNull();
			expect(projection.location).toBeNull();
			expect(projection.climate).toBeNull();
			expect(projection.scene).toBeNull();
		});
	});

	describe('createSnapshotFromProjection', () => {
		it('creates snapshot from projection', () => {
			const snapshot = createTestSnapshot();
			const projection = createProjectionFromSnapshot(snapshot, {
				messageId: 5,
				swipeId: 0,
			});
			projection.currentChapter = 1;

			const newSnapshot = createSnapshotFromProjection(projection, 1);

			expect(newSnapshot.type).toBe('chapter');
			expect(newSnapshot.chapterIndex).toBe(1);
			expect(newSnapshot.source).toEqual({ messageId: 5, swipeId: 0 });
			// New snapshot time should be ISO string (serialized from projection's moment)
			expect(typeof newSnapshot.time).toBe('string');
			expect(newSnapshot.time).toBe(testTimeIso);
			expect(newSnapshot.location?.area).toBe(projection.location?.area);
			expect(newSnapshot.currentChapter).toBe(1);
		});

		it('deep clones data', () => {
			const snapshot = createTestSnapshot();
			const projection = createProjectionFromSnapshot(snapshot, {
				messageId: 5,
				swipeId: 0,
			});
			const newSnapshot = createSnapshotFromProjection(projection, 0);

			// Modify new snapshot
			newSnapshot.characters.Alice!.mood.push('sad');

			// Projection should be unchanged
			expect(projection.characters.Alice!.mood).not.toContain('sad');
		});
	});
});

describe('cloning functions', () => {
	const testTimeIso = serializeMoment(
		moment({ year: 2024, month: 0, date: 15, hour: 10, minute: 0, second: 0 }),
	);

	describe('cloneSnapshot', () => {
		it('creates deep clone', () => {
			const original: Snapshot = {
				type: 'initial',
				source: { messageId: 0, swipeId: 0 },
				timestamp: Date.now(),
				swipeId: 0,
				time: testTimeIso,
				location: {
					area: 'A',
					place: 'B',
					position: 'C',
					props: ['item'],
					locationType: 'heated',
				},
				forecasts: {},
				climate: null,
				scene: {
					topic: 'T',
					tone: 'friendly',
					tension: {
						level: 'relaxed',
						type: 'conversation',
						direction: 'stable',
					},
				},
				characters: {
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
							legs: null,
							footwear: null,
							socks: null,
							underwear: null,
						},
					},
				},
				relationships: {
					'Alice|Bob': {
						pair: ['Alice', 'Bob'],
						status: 'strangers',
						aToB: {
							feelings: ['curious'],
							secrets: [],
							wants: [],
						},
						bToA: { feelings: [], secrets: [], wants: [] },
					},
				},
				currentChapter: 0,
				narrativeEvents: [],
			};

			const clone = cloneSnapshot(original);

			// Modify clone
			clone.location!.props.push('new');
			clone.characters.Alice!.mood.push('sad');
			clone.relationships['Alice|Bob']!.aToB.feelings.push('attraction');

			// Original unchanged
			expect(original.location!.props).toEqual(['item']);
			expect(original.characters.Alice!.mood).toEqual(['happy']);
			expect(original.relationships['Alice|Bob']!.aToB.feelings).toEqual([
				'curious',
			]);
		});
	});

	describe('cloneProjection', () => {
		it('creates deep clone', () => {
			const testMoment = moment({
				year: 2024,
				month: 0,
				date: 15,
				hour: 10,
				minute: 0,
				second: 0,
			});
			const original: Projection = {
				source: { messageId: 1, swipeId: 0 },
				time: testMoment,
				location: {
					area: 'A',
					place: 'B',
					position: 'C',
					props: ['item'],
					locationType: 'heated',
				},
				forecasts: {},
				climate: null,
				scene: {
					topic: 'T',
					tone: 'friendly',
					tension: {
						level: 'relaxed',
						type: 'conversation',
						direction: 'stable',
					},
				},
				characters: {
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
							legs: null,
							footwear: null,
							socks: null,
							underwear: null,
						},
					},
				},
				relationships: {},
				currentChapter: 0,
				charactersPresent: ['Alice'],
				narrativeEvents: [],
			};

			const clone = cloneProjection(original);

			// Modify clone
			clone.charactersPresent.push('Bob');
			clone.characters.Alice!.mood.push('sad');

			// Original unchanged
			expect(original.charactersPresent).toEqual(['Alice']);
			expect(original.characters.Alice!.mood).toEqual(['happy']);

			// Also verify time was cloned properly (moment should be a different instance)
			expect(clone.time).not.toBe(original.time);
			expect(moment.isMoment(clone.time)).toBe(true);
			expect(clone.time!.isSame(original.time)).toBe(true);
		});
	});
});
