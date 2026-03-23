import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateFromLegacy } from './migrateFromLegacy';

vi.mock('../../utils/debug', () => ({
	debugLog: vi.fn(),
	debugWarn: vi.fn(),
	errorLog: vi.fn(),
}));

function createMockStore() {
	return {
		replaceInitialSnapshot: vi.fn(),
		appendEvents: vi.fn(),
	} as any;
}

describe('migrateFromLegacy', () => {
	let mockStore: ReturnType<typeof createMockStore>;

	beforeEach(() => {
		mockStore = createMockStore();
	});

	describe('no legacy data', () => {
		it('does nothing when both params are null', () => {
			migrateFromLegacy(null, null, mockStore);
			expect(mockStore.replaceInitialSnapshot).not.toHaveBeenCalled();
			expect(mockStore.appendEvents).not.toHaveBeenCalled();
		});
	});

	describe('tracked state migration → creates snapshot', () => {
		it('creates snapshot with correct time, location, climate, scene, characters', () => {
			const trackedState = {
				time: {
					iso: '2024-06-15T14:30:00Z',
					formatted: 'June 15, 2024 2:30 PM',
				},
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'Near the window',
					props: ['mug', 'newspaper'],
				},
				climate: {
					temperature: 72,
					conditions: 'partly cloudy',
					isIndoors: true,
				},
				scene: {
					topic: 'catching up',
					tone: 'warm',
					tension: {
						level: 'moderate',
						type: 'social',
						direction: 'rising',
					},
				},
				characters: {
					Alice: {
						position: 'sitting',
						activity: 'drinking coffee',
						mood: ['happy', 'relaxed'],
						physicalState: ['well-rested'],
						outfit: {
							torso: 'blue blouse',
							legs: 'jeans',
							footwear: 'sneakers',
						},
					},
				},
			};

			migrateFromLegacy(null, trackedState, mockStore);

			expect(mockStore.replaceInitialSnapshot).toHaveBeenCalledOnce();
			const snapshot = mockStore.replaceInitialSnapshot.mock.calls[0][0];

			// Time
			expect(snapshot.time).toBe('2024-06-15T14:30:00Z');

			// Location
			expect(snapshot.location).toEqual({
				area: 'Downtown',
				place: 'Coffee Shop',
				position: 'Near the window',
				props: ['mug', 'newspaper'],
				locationType: 'heated',
			});

			// Climate
			expect(snapshot.climate).toMatchObject({
				temperature: 72,
				outdoorTemperature: 72,
				feelsLike: 72,
				conditions: 'partly cloudy',
				isIndoors: true,
				conditionType: 'clear',
				humidity: 50,
				precipitation: 0,
				cloudCover: 0,
				daylight: 'day',
				windSpeed: 0,
				windDirection: 'N',
				uvIndex: 5,
			});

			// Scene
			expect(snapshot.scene).toEqual({
				topic: 'catching up',
				tone: 'warm',
				tension: { level: 'moderate', type: 'social', direction: 'rising' },
			});

			// Characters
			expect(snapshot.characters.Alice).toBeDefined();
			expect(snapshot.characters.Alice.position).toBe('sitting');
			expect(snapshot.characters.Alice.activity).toBe('drinking coffee');
			expect(snapshot.characters.Alice.mood).toEqual(['happy', 'relaxed']);
			expect(snapshot.characters.Alice.physicalState).toEqual(['well-rested']);
			expect(snapshot.characters.Alice.outfit.torso).toBe('blue blouse');
			expect(snapshot.characters.Alice.outfit.legs).toBe('jeans');
			expect(snapshot.characters.Alice.outfit.footwear).toBe('sneakers');
			expect(snapshot.characters.Alice.outfit.head).toBeNull();
		});
	});

	describe('partial tracked state', () => {
		it('only time set → snapshot has time but null location/climate/scene', () => {
			const trackedState = {
				time: { iso: '2024-01-01T00:00:00Z' },
			};

			migrateFromLegacy(null, trackedState, mockStore);

			const snapshot = mockStore.replaceInitialSnapshot.mock.calls[0][0];
			expect(snapshot.time).toBe('2024-01-01T00:00:00Z');
			expect(snapshot.location).toBeNull();
			expect(snapshot.climate).toBeNull();
			expect(snapshot.scene).toBeNull();
		});

		it('only characters → snapshot has characters but null time/location', () => {
			const trackedState = {
				characters: {
					Bob: { position: 'standing', mood: ['alert'] },
				},
			};

			migrateFromLegacy(null, trackedState, mockStore);

			const snapshot = mockStore.replaceInitialSnapshot.mock.calls[0][0];
			expect(snapshot.time).toBeNull();
			expect(snapshot.location).toBeNull();
			expect(snapshot.characters.Bob).toBeDefined();
			expect(snapshot.characters.Bob.position).toBe('standing');
			expect(snapshot.characters.Bob.mood).toEqual(['alert']);
		});
	});

	describe('location type derivation', () => {
		it('isIndoors=true → locationType="heated"', () => {
			const trackedState = {
				location: { area: 'House' },
				climate: { isIndoors: true },
			};

			migrateFromLegacy(null, trackedState, mockStore);

			const snapshot = mockStore.replaceInitialSnapshot.mock.calls[0][0];
			expect(snapshot.location.locationType).toBe('heated');
		});

		it('isIndoors=false → locationType="outdoor"', () => {
			const trackedState = {
				location: { area: 'Park' },
				climate: { isIndoors: false },
			};

			migrateFromLegacy(null, trackedState, mockStore);

			const snapshot = mockStore.replaceInitialSnapshot.mock.calls[0][0];
			expect(snapshot.location.locationType).toBe('outdoor');
		});

		it('isIndoors not set → defaults to "outdoor"', () => {
			const trackedState = {
				location: { area: 'Street' },
			};

			migrateFromLegacy(null, trackedState, mockStore);

			const snapshot = mockStore.replaceInitialSnapshot.mock.calls[0][0];
			expect(snapshot.location.locationType).toBe('outdoor');
		});
	});

	describe('relationship migration', () => {
		it('creates status_changed and feeling_added events', () => {
			const narrativeState = {
				relationships: [
					{
						characters: ['Zara', 'Alice'] as [string, string],
						status: 'friends',
						attitudes: {
							aToB: {
								feelings: ['trusting', 'admiring'],
							},
							bToA: { feelings: ['grateful'] },
						},
					},
				],
			};

			migrateFromLegacy(narrativeState, null, mockStore);

			expect(mockStore.appendEvents).toHaveBeenCalledOnce();
			const events = mockStore.appendEvents.mock.calls[0][0];

			// 1 status_changed + 2 aToB feelings + 1 bToA feeling = 4
			expect(events).toHaveLength(4);

			// Status changed — pair sorted alphabetically
			expect(events[0]).toMatchObject({
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Alice', 'Zara'],
				newStatus: 'friendly',
			});

			// aToB feelings (from sorted pair[0]=Alice toward pair[1]=Zara)
			expect(events[1]).toMatchObject({
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Alice',
				towardCharacter: 'Zara',
				value: 'trusting',
			});
			expect(events[2]).toMatchObject({
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Alice',
				towardCharacter: 'Zara',
				value: 'admiring',
			});

			// bToA feeling (from sorted pair[1]=Zara toward pair[0]=Alice)
			expect(events[3]).toMatchObject({
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Zara',
				towardCharacter: 'Alice',
				value: 'grateful',
			});
		});
	});

	describe('mapLegacyStatus (tested through relationship migration)', () => {
		const statusTests: [string, string][] = [
			['strangers', 'strangers'],
			['friends', 'friendly'],
			['close friends', 'close'],
			['close_friends', 'close'],
			['romantic', 'intimate'],
			['partners', 'intimate'],
			['married', 'intimate'],
			['family', 'close'],
			['rivals', 'strained'],
			['enemies', 'hostile'],
			['something_unknown', 'acquaintances'],
		];

		it.each(statusTests)('"%s" → "%s"', (input, expected) => {
			const narrativeState = {
				relationships: [
					{
						characters: ['A', 'B'] as [string, string],
						status: input,
					},
				],
			};

			migrateFromLegacy(narrativeState, null, mockStore);

			const events = mockStore.appendEvents.mock.calls[0][0];
			expect(events[0]).toMatchObject({
				kind: 'relationship',
				subkind: 'status_changed',
				newStatus: expected,
			});
		});
	});

	describe('chapter migration', () => {
		it('creates chapter_ended for all but last, chapter_described for those with title/summary', () => {
			const narrativeState = {
				chapters: [
					{
						title: 'The Beginning',
						summary: 'Our story starts here',
					},
					{ title: 'The Middle', summary: 'Things get complicated' },
					{ title: 'The End', summary: 'Resolution' },
				],
			};

			migrateFromLegacy(narrativeState, null, mockStore);

			const events = mockStore.appendEvents.mock.calls[0][0];
			// Ch0: ended + described, Ch1: ended + described, Ch2: described only (last)
			expect(events).toHaveLength(5);

			expect(events[0]).toMatchObject({
				kind: 'chapter',
				subkind: 'ended',
				chapterIndex: 0,
			});
			expect(events[1]).toMatchObject({
				kind: 'chapter',
				subkind: 'described',
				chapterIndex: 0,
				title: 'The Beginning',
				summary: 'Our story starts here',
			});
			expect(events[2]).toMatchObject({
				kind: 'chapter',
				subkind: 'ended',
				chapterIndex: 1,
			});
			expect(events[3]).toMatchObject({
				kind: 'chapter',
				subkind: 'described',
				chapterIndex: 1,
				title: 'The Middle',
				summary: 'Things get complicated',
			});
			expect(events[4]).toMatchObject({
				kind: 'chapter',
				subkind: 'described',
				chapterIndex: 2,
				title: 'The End',
				summary: 'Resolution',
			});
		});

		it('chapter without title/summary → no described event', () => {
			const narrativeState = {
				chapters: [{}, { title: 'Second' }],
			};

			migrateFromLegacy(narrativeState, null, mockStore);

			const events = mockStore.appendEvents.mock.calls[0][0];
			// Ch0: ended only (no title/summary), Ch1: described only (last)
			expect(events).toHaveLength(2);
			expect(events[0]).toMatchObject({
				kind: 'chapter',
				subkind: 'ended',
				chapterIndex: 0,
			});
			expect(events[1]).toMatchObject({
				kind: 'chapter',
				subkind: 'described',
				chapterIndex: 1,
				title: 'Second',
			});
		});

		it('defaults title to "Chapter N+1" when title missing but summary exists', () => {
			const narrativeState = {
				chapters: [{ summary: 'A summary without title' }],
			};

			migrateFromLegacy(narrativeState, null, mockStore);

			const events = mockStore.appendEvents.mock.calls[0][0];
			expect(events).toHaveLength(1);
			expect(events[0]).toMatchObject({
				kind: 'chapter',
				subkind: 'described',
				chapterIndex: 0,
				title: 'Chapter 1',
				summary: 'A summary without title',
			});
		});
	});

	describe('combined migration', () => {
		it('both tracked state and narrative state → snapshot + events with sequential IDs', () => {
			const trackedState = {
				time: { iso: '2024-06-15T14:30:00Z' },
			};
			const narrativeState = {
				relationships: [
					{
						characters: ['Alice', 'Bob'] as [string, string],
						status: 'friends',
					},
				],
				chapters: [
					{ title: 'Ch1', summary: 'First' },
					{ title: 'Ch2', summary: 'Second' },
				],
			};

			migrateFromLegacy(narrativeState, trackedState, mockStore);

			// Snapshot created
			expect(mockStore.replaceInitialSnapshot).toHaveBeenCalledOnce();
			const snapshot = mockStore.replaceInitialSnapshot.mock.calls[0][0];
			expect(snapshot.time).toBe('2024-06-15T14:30:00Z');

			// Events created
			expect(mockStore.appendEvents).toHaveBeenCalledOnce();
			const events = mockStore.appendEvents.mock.calls[0][0];

			// 1 status_changed + 1 chapter_ended + 1 chapter_described + 1 chapter_described = 4
			expect(events).toHaveLength(4);

			// Sequential IDs
			expect(events[0].id).toBe('migrated-0');
			expect(events[1].id).toBe('migrated-1');
			expect(events[2].id).toBe('migrated-2');
			expect(events[3].id).toBe('migrated-3');

			// All events have source={messageId:0, swipeId:0}
			for (const event of events) {
				expect(event.source).toEqual({ messageId: 0, swipeId: 0 });
			}
		});
	});
});
