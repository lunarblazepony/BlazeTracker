import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MessageAndSwipe } from '../../types';
import type {
	ExtractedTimeChange,
	ExtractedLocationChange,
	ExtractedPropsChange,
	ExtractedCharacterPresenceChange,
	ExtractedOutfitChange,
	ExtractedMoodChange,
	ExtractedPositionChange,
	ExtractedActivityChange,
	ExtractedPhysicalChange,
	ExtractedPositionActivityChange,
	ExtractedMoodPhysicalChange,
	ExtractedFeelingsChange,
	ExtractedSecretsChange,
	ExtractedWantsChange,
	ExtractedStatusChange,
	ExtractedSubjects,
	ExtractedTopicToneChange,
	ExtractedTensionChange,
	ExtractedNarrativeDescription,
	ExtractedChapterEnded,
	ExtractedChapterDescription,
} from '../../types/extraction';

vi.mock('../../store/serialization', () => ({
	generateEventId: vi.fn(() => 'test-id'),
}));

import {
	mapTimeChange,
	mapLocationChange,
	mapPropsChange,
	mapPresenceChange,
	mapOutfitChange,
	mapMoodChange,
	mapPositionChange,
	mapActivityChange,
	mapPhysicalChange,
	mapPositionActivityChange,
	mapMoodPhysicalChange,
	mapFeelingsChange,
	mapSecretsChange,
	mapWantsChange,
	mapStatusChange,
	mapSubjects,
	mapTopicToneChange,
	mapTensionChange,
	mapNarrativeDescription,
	mapChapterEnded,
	mapChapterDescription,
} from './mapToEvents';

const source: MessageAndSwipe = { messageId: 5, swipeId: 0 };

beforeEach(() => {
	vi.clearAllMocks();
});

// ============================================
// Time Events
// ============================================

describe('mapTimeChange', () => {
	it('returns a TimeDeltaEvent when delta exists', () => {
		const extraction: ExtractedTimeChange = {
			reasoning: 'time passed',
			changed: true,
			delta: { days: 0, hours: 2, minutes: 30, seconds: 0 },
		};

		const events = mapTimeChange(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'time',
				subkind: 'delta',
				delta: { days: 0, hours: 2, minutes: 30, seconds: 0 },
				source,
			}),
		);
	});

	it('returns empty array when no delta', () => {
		const extraction: ExtractedTimeChange = {
			reasoning: 'no change',
			changed: false,
		};

		expect(mapTimeChange(extraction, source)).toEqual([]);
	});

	it('returns empty array when delta is undefined', () => {
		const extraction: ExtractedTimeChange = {
			reasoning: 'no change',
			changed: true,
			delta: undefined,
		};

		expect(mapTimeChange(extraction, source)).toEqual([]);
	});
});

// ============================================
// Location Events
// ============================================

describe('mapLocationChange', () => {
	it('returns a LocationMovedEvent when changed is true', () => {
		const extraction: ExtractedLocationChange = {
			reasoning: 'moved to park',
			changed: true,
			newArea: 'City Park',
			newPlace: 'Fountain',
			newPosition: 'Standing near the edge',
		};

		const events = mapLocationChange(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'location',
				subkind: 'moved',
				newArea: 'City Park',
				newPlace: 'Fountain',
				newPosition: 'Standing near the edge',
				source,
			}),
		);
	});

	it('returns empty array when changed is false', () => {
		const extraction: ExtractedLocationChange = {
			reasoning: 'no change',
			changed: false,
		};

		expect(mapLocationChange(extraction, source)).toEqual([]);
	});

	it('defaults missing fields to empty strings', () => {
		const extraction: ExtractedLocationChange = {
			reasoning: 'partial',
			changed: true,
		};

		const events = mapLocationChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				newArea: '',
				newPlace: '',
				newPosition: '',
			}),
		);
	});

	it('includes newLocationType when present', () => {
		const extraction: ExtractedLocationChange = {
			reasoning: 'went outside',
			changed: true,
			newArea: 'Garden',
			newLocationType: 'outdoor',
		};

		const events = mapLocationChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'location',
				subkind: 'moved',
				newLocationType: 'outdoor',
			}),
		);
	});

	it('omits newLocationType when not present', () => {
		const extraction: ExtractedLocationChange = {
			reasoning: 'moved',
			changed: true,
			newArea: 'Kitchen',
		};

		const events = mapLocationChange(extraction, source);

		expect(events[0]).not.toHaveProperty('newLocationType');
	});
});

describe('mapPropsChange', () => {
	it('returns added and removed prop events', () => {
		const extraction: ExtractedPropsChange = {
			reasoning: 'props changed',
			added: ['sword', 'shield'],
			removed: ['torch'],
		};

		const events = mapPropsChange(extraction, source);

		expect(events).toHaveLength(3);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'location',
				subkind: 'prop_added',
				prop: 'sword',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'location',
				subkind: 'prop_added',
				prop: 'shield',
			}),
		);
		expect(events[2]).toEqual(
			expect.objectContaining({
				kind: 'location',
				subkind: 'prop_removed',
				prop: 'torch',
			}),
		);
	});

	it('returns empty array when no changes', () => {
		const extraction: ExtractedPropsChange = {
			reasoning: 'nothing',
			added: [],
			removed: [],
		};

		expect(mapPropsChange(extraction, source)).toEqual([]);
	});
});

// ============================================
// Character Events
// ============================================

describe('mapPresenceChange', () => {
	it('returns appeared and departed events', () => {
		const extraction: ExtractedCharacterPresenceChange = {
			reasoning: 'characters changed',
			appeared: [
				{
					name: 'Alice',
					position: 'standing at the door',
					activity: 'waving',
					mood: ['happy'],
					physicalState: ['healthy'],
				},
			],
			departed: ['Bob'],
		};

		const events = mapPresenceChange(extraction, source);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
				initialPosition: 'standing at the door',
				initialActivity: 'waving',
				initialMood: ['happy'],
				initialPhysicalState: ['healthy'],
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'departed',
				character: 'Bob',
			}),
		);
	});

	it('handles optional activity as null', () => {
		const extraction: ExtractedCharacterPresenceChange = {
			reasoning: 'appeared',
			appeared: [
				{
					name: 'Alice',
					position: 'sitting',
					activity: null,
					mood: ['calm'],
					physicalState: [],
				},
			],
			departed: [],
		};

		const events = mapPresenceChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
				initialActivity: undefined,
			}),
		);
	});

	it('handles empty mood and physicalState arrays', () => {
		const extraction: ExtractedCharacterPresenceChange = {
			reasoning: 'appeared',
			appeared: [
				{
					name: 'Alice',
					position: 'standing',
					activity: null,
					mood: [],
					physicalState: [],
				},
			],
			departed: [],
		};

		const events = mapPresenceChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				initialMood: undefined,
				initialPhysicalState: undefined,
			}),
		);
	});
});

describe('mapOutfitChange', () => {
	it('maps removed slots to null and added slots to values', () => {
		const extraction: ExtractedOutfitChange = {
			reasoning: 'outfit changed',
			character: 'Alice',
			removed: ['head'],
			added: { torso: 'red dress', footwear: 'heels' },
		};

		const events = mapOutfitChange(extraction, source);

		expect(events).toHaveLength(3);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'outfit_changed',
				character: 'Alice',
				slot: 'head',
				newValue: null,
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'outfit_changed',
				character: 'Alice',
				slot: 'torso',
				newValue: 'red dress',
			}),
		);
		expect(events[2]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'outfit_changed',
				character: 'Alice',
				slot: 'footwear',
				newValue: 'heels',
			}),
		);
	});

	it('returns empty array when no changes', () => {
		const extraction: ExtractedOutfitChange = {
			reasoning: 'no change',
			character: 'Alice',
			removed: [],
			added: {},
		};

		expect(mapOutfitChange(extraction, source)).toEqual([]);
	});
});

describe('mapMoodChange', () => {
	it('returns added and removed mood events', () => {
		const extraction: ExtractedMoodChange = {
			reasoning: 'mood shifted',
			character: 'Alice',
			added: ['happy', 'excited'],
			removed: ['sad'],
		};

		const events = mapMoodChange(extraction, source);

		expect(events).toHaveLength(3);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'mood_added',
				character: 'Alice',
				mood: 'happy',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'mood_added',
				character: 'Alice',
				mood: 'excited',
			}),
		);
		expect(events[2]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'mood_removed',
				character: 'Alice',
				mood: 'sad',
			}),
		);
	});

	it('returns empty array when no changes', () => {
		const extraction: ExtractedMoodChange = {
			reasoning: 'no change',
			character: 'Alice',
			added: [],
			removed: [],
		};

		expect(mapMoodChange(extraction, source)).toEqual([]);
	});
});

describe('mapPositionChange', () => {
	it('returns event when changed is true and newPosition exists', () => {
		const extraction: ExtractedPositionChange = {
			reasoning: 'moved',
			character: 'Alice',
			changed: true,
			newPosition: 'sitting on the bench',
		};

		const events = mapPositionChange(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'position_changed',
				character: 'Alice',
				newValue: 'sitting on the bench',
			}),
		);
	});

	it('returns empty array when changed is false', () => {
		const extraction: ExtractedPositionChange = {
			reasoning: 'no change',
			character: 'Alice',
			changed: false,
		};

		expect(mapPositionChange(extraction, source)).toEqual([]);
	});

	it('returns empty array when changed is true but newPosition is missing', () => {
		const extraction: ExtractedPositionChange = {
			reasoning: 'changed but no position',
			character: 'Alice',
			changed: true,
		};

		expect(mapPositionChange(extraction, source)).toEqual([]);
	});
});

describe('mapActivityChange', () => {
	it('returns event when changed is true', () => {
		const extraction: ExtractedActivityChange = {
			reasoning: 'started reading',
			character: 'Alice',
			changed: true,
			newActivity: 'reading a book',
		};

		const events = mapActivityChange(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'activity_changed',
				character: 'Alice',
				newValue: 'reading a book',
			}),
		);
	});

	it('returns empty array when changed is false', () => {
		const extraction: ExtractedActivityChange = {
			reasoning: 'no change',
			character: 'Alice',
			changed: false,
		};

		expect(mapActivityChange(extraction, source)).toEqual([]);
	});

	it('maps null newActivity correctly', () => {
		const extraction: ExtractedActivityChange = {
			reasoning: 'stopped activity',
			character: 'Alice',
			changed: true,
			newActivity: null,
		};

		const events = mapActivityChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'activity_changed',
				character: 'Alice',
				newValue: null,
			}),
		);
	});

	it('maps undefined newActivity to null', () => {
		const extraction: ExtractedActivityChange = {
			reasoning: 'stopped activity',
			character: 'Alice',
			changed: true,
		};

		const events = mapActivityChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				newValue: null,
			}),
		);
	});
});

describe('mapPhysicalChange', () => {
	it('returns added and removed physical state events', () => {
		const extraction: ExtractedPhysicalChange = {
			reasoning: 'physical state changed',
			character: 'Alice',
			added: ['bruised'],
			removed: ['clean'],
		};

		const events = mapPhysicalChange(extraction, source);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'physical_added',
				character: 'Alice',
				physicalState: 'bruised',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'physical_removed',
				character: 'Alice',
				physicalState: 'clean',
			}),
		);
	});

	it('returns empty array when no changes', () => {
		const extraction: ExtractedPhysicalChange = {
			reasoning: 'no change',
			character: 'Alice',
			added: [],
			removed: [],
		};

		expect(mapPhysicalChange(extraction, source)).toEqual([]);
	});
});

// ============================================
// Combined Character Events
// ============================================

describe('mapPositionActivityChange', () => {
	it('returns both position and activity events', () => {
		const extraction: ExtractedPositionActivityChange = {
			reasoning: 'moved and started doing something',
			character: 'Alice',
			positionChanged: true,
			newPosition: 'at the desk',
			activityChanged: true,
			newActivity: 'writing',
		};

		const events = mapPositionActivityChange(extraction, source);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'position_changed',
				character: 'Alice',
				newValue: 'at the desk',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'activity_changed',
				character: 'Alice',
				newValue: 'writing',
			}),
		);
	});

	it('returns only position event when only position changed', () => {
		const extraction: ExtractedPositionActivityChange = {
			reasoning: 'only moved',
			character: 'Alice',
			positionChanged: true,
			newPosition: 'at the window',
			activityChanged: false,
		};

		const events = mapPositionActivityChange(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				subkind: 'position_changed',
			}),
		);
	});

	it('returns only activity event when only activity changed', () => {
		const extraction: ExtractedPositionActivityChange = {
			reasoning: 'only activity',
			character: 'Alice',
			positionChanged: false,
			activityChanged: true,
			newActivity: 'singing',
		};

		const events = mapPositionActivityChange(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				subkind: 'activity_changed',
			}),
		);
	});

	it('returns empty array when nothing changed', () => {
		const extraction: ExtractedPositionActivityChange = {
			reasoning: 'nothing',
			character: 'Alice',
			positionChanged: false,
			activityChanged: false,
		};

		expect(mapPositionActivityChange(extraction, source)).toEqual([]);
	});

	it('skips position event when positionChanged but no newPosition', () => {
		const extraction: ExtractedPositionActivityChange = {
			reasoning: 'position changed but missing',
			character: 'Alice',
			positionChanged: true,
			activityChanged: false,
		};

		expect(mapPositionActivityChange(extraction, source)).toEqual([]);
	});

	it('maps null newActivity correctly', () => {
		const extraction: ExtractedPositionActivityChange = {
			reasoning: 'stopped',
			character: 'Alice',
			positionChanged: false,
			activityChanged: true,
			newActivity: null,
		};

		const events = mapPositionActivityChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				newValue: null,
			}),
		);
	});
});

describe('mapMoodPhysicalChange', () => {
	it('returns all mood and physical events', () => {
		const extraction: ExtractedMoodPhysicalChange = {
			reasoning: 'changes',
			character: 'Alice',
			moodAdded: ['happy'],
			moodRemoved: ['sad'],
			physicalAdded: ['sweating'],
			physicalRemoved: ['cold'],
		};

		const events = mapMoodPhysicalChange(extraction, source);

		expect(events).toHaveLength(4);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'mood_added',
				character: 'Alice',
				mood: 'happy',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'mood_removed',
				character: 'Alice',
				mood: 'sad',
			}),
		);
		expect(events[2]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'physical_added',
				character: 'Alice',
				physicalState: 'sweating',
			}),
		);
		expect(events[3]).toEqual(
			expect.objectContaining({
				kind: 'character',
				subkind: 'physical_removed',
				character: 'Alice',
				physicalState: 'cold',
			}),
		);
	});

	it('returns empty array when no changes', () => {
		const extraction: ExtractedMoodPhysicalChange = {
			reasoning: 'nothing',
			character: 'Alice',
			moodAdded: [],
			moodRemoved: [],
			physicalAdded: [],
			physicalRemoved: [],
		};

		expect(mapMoodPhysicalChange(extraction, source)).toEqual([]);
	});
});

// ============================================
// Relationship Events
// ============================================

describe('mapFeelingsChange', () => {
	it('returns directional feeling added and removed events', () => {
		const extraction: ExtractedFeelingsChange = {
			reasoning: 'feelings changed',
			changes: [
				{
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					added: ['trust'],
					removed: ['suspicion'],
				},
			],
		};

		const events = mapFeelingsChange(extraction, source);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'trust',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'feeling_removed',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'suspicion',
			}),
		);
	});

	it('handles multiple directional changes', () => {
		const extraction: ExtractedFeelingsChange = {
			reasoning: 'both directions',
			changes: [
				{
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					added: ['affection'],
					removed: [],
				},
				{
					fromCharacter: 'Bob',
					towardCharacter: 'Alice',
					added: ['respect'],
					removed: [],
				},
			],
		};

		const events = mapFeelingsChange(extraction, source);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'affection',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				fromCharacter: 'Bob',
				towardCharacter: 'Alice',
				value: 'respect',
			}),
		);
	});

	it('returns empty array when no changes', () => {
		const extraction: ExtractedFeelingsChange = {
			reasoning: 'nothing',
			changes: [],
		};

		expect(mapFeelingsChange(extraction, source)).toEqual([]);
	});
});

describe('mapSecretsChange', () => {
	it('returns directional secret added and removed events', () => {
		const extraction: ExtractedSecretsChange = {
			reasoning: 'secrets changed',
			changes: [
				{
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					added: ['knows about the letter'],
					removed: ['unaware of plans'],
				},
			],
		};

		const events = mapSecretsChange(extraction, source);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'secret_added',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'knows about the letter',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'secret_removed',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'unaware of plans',
			}),
		);
	});

	it('returns empty array when no changes', () => {
		const extraction: ExtractedSecretsChange = {
			reasoning: 'nothing',
			changes: [],
		};

		expect(mapSecretsChange(extraction, source)).toEqual([]);
	});
});

describe('mapWantsChange', () => {
	it('returns directional want added and removed events', () => {
		const extraction: ExtractedWantsChange = {
			reasoning: 'wants changed',
			changes: [
				{
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					added: ['wants approval'],
					removed: ['wants distance'],
				},
			],
		};

		const events = mapWantsChange(extraction, source);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'want_added',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'wants approval',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'want_removed',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'wants distance',
			}),
		);
	});

	it('returns empty array when no changes', () => {
		const extraction: ExtractedWantsChange = {
			reasoning: 'nothing',
			changes: [],
		};

		expect(mapWantsChange(extraction, source)).toEqual([]);
	});
});

describe('mapStatusChange', () => {
	it('returns event when changed is true with sorted pair', () => {
		const extraction: ExtractedStatusChange = {
			reasoning: 'status changed',
			pair: ['Bob', 'Alice'],
			changed: true,
			newStatus: 'friendly',
		};

		const events = mapStatusChange(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Alice', 'Bob'],
				newStatus: 'friendly',
			}),
		);
	});

	it('returns empty array when changed is false', () => {
		const extraction: ExtractedStatusChange = {
			reasoning: 'no change',
			pair: ['Alice', 'Bob'],
			changed: false,
		};

		expect(mapStatusChange(extraction, source)).toEqual([]);
	});

	it('returns empty array when newStatus is missing', () => {
		const extraction: ExtractedStatusChange = {
			reasoning: 'changed but no status',
			pair: ['Alice', 'Bob'],
			changed: true,
		};

		expect(mapStatusChange(extraction, source)).toEqual([]);
	});
});

describe('mapSubjects', () => {
	it('maps subjects with sorted pairs', () => {
		const extraction: ExtractedSubjects = {
			reasoning: 'subjects detected',
			subjects: [
				{ pair: ['Bob', 'Alice'], subject: 'argument' },
				{ pair: ['Alice', 'Charlie'], subject: 'supportive' },
			],
		};

		const events = mapSubjects(extraction, source);

		expect(events).toHaveLength(2);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'subject',
				pair: ['Alice', 'Bob'],
				subject: 'argument',
			}),
		);
		expect(events[1]).toEqual(
			expect.objectContaining({
				kind: 'relationship',
				subkind: 'subject',
				pair: ['Alice', 'Charlie'],
				subject: 'supportive',
			}),
		);
	});

	it('returns empty array when no subjects', () => {
		const extraction: ExtractedSubjects = {
			reasoning: 'nothing',
			subjects: [],
		};

		expect(mapSubjects(extraction, source)).toEqual([]);
	});
});

// ============================================
// Scene Events
// ============================================

describe('mapTopicToneChange', () => {
	it('returns event when changed is true', () => {
		const extraction: ExtractedTopicToneChange = {
			reasoning: 'topic changed',
			changed: true,
			newTopic: 'adventure planning',
			newTone: 'excited',
		};

		const events = mapTopicToneChange(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'topic_tone',
				topic: 'adventure planning',
				tone: 'excited',
			}),
		);
	});

	it('returns empty array when changed is false', () => {
		const extraction: ExtractedTopicToneChange = {
			reasoning: 'no change',
			changed: false,
		};

		expect(mapTopicToneChange(extraction, source)).toEqual([]);
	});

	it('falls back to previousTopic when newTopic is missing', () => {
		const extraction: ExtractedTopicToneChange = {
			reasoning: 'tone changed',
			changed: true,
			newTone: 'somber',
		};

		const events = mapTopicToneChange(extraction, source, 'old topic', 'old tone');

		expect(events[0]).toEqual(
			expect.objectContaining({
				topic: 'old topic',
				tone: 'somber',
			}),
		);
	});

	it('falls back to previousTone when newTone is missing', () => {
		const extraction: ExtractedTopicToneChange = {
			reasoning: 'topic changed',
			changed: true,
			newTopic: 'new topic',
		};

		const events = mapTopicToneChange(extraction, source, 'old topic', 'old tone');

		expect(events[0]).toEqual(
			expect.objectContaining({
				topic: 'new topic',
				tone: 'old tone',
			}),
		);
	});

	it('falls back to "unknown" when no previous and no new values', () => {
		const extraction: ExtractedTopicToneChange = {
			reasoning: 'changed',
			changed: true,
		};

		const events = mapTopicToneChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				topic: 'unknown',
				tone: 'unknown',
			}),
		);
	});
});

describe('mapTensionChange', () => {
	it('returns event when changed is true', () => {
		const extraction: ExtractedTensionChange = {
			reasoning: 'tension increased',
			changed: true,
			newLevel: 'tense',
			newType: 'confrontation',
		};

		const events = mapTensionChange(extraction, source, 'aware', 'conversation');

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'tension',
				level: 'tense',
				type: 'confrontation',
				direction: 'escalating',
			}),
		);
	});

	it('returns empty array when changed is false', () => {
		const extraction: ExtractedTensionChange = {
			reasoning: 'no change',
			changed: false,
		};

		expect(mapTensionChange(extraction, source)).toEqual([]);
	});

	it('falls back to previous level when newLevel is missing', () => {
		const extraction: ExtractedTensionChange = {
			reasoning: 'type changed',
			changed: true,
			newType: 'suspense',
		};

		const events = mapTensionChange(extraction, source, 'guarded', 'conversation');

		expect(events[0]).toEqual(
			expect.objectContaining({
				level: 'guarded',
				type: 'suspense',
			}),
		);
	});

	it('falls back to "relaxed" when no previous and no new level', () => {
		const extraction: ExtractedTensionChange = {
			reasoning: 'changed',
			changed: true,
		};

		const events = mapTensionChange(extraction, source);

		expect(events[0]).toEqual(
			expect.objectContaining({
				level: 'relaxed',
				type: 'conversation',
			}),
		);
	});

	it('falls back to previous type when newType is missing', () => {
		const extraction: ExtractedTensionChange = {
			reasoning: 'level changed',
			changed: true,
			newLevel: 'volatile',
		};

		const events = mapTensionChange(extraction, source, 'tense', 'confrontation');

		expect(events[0]).toEqual(
			expect.objectContaining({
				type: 'confrontation',
			}),
		);
	});

	// calculateTensionDirection tests via mapTensionChange
	describe('tension direction calculation', () => {
		it('returns stable when no new level', () => {
			const extraction: ExtractedTensionChange = {
				reasoning: 'type only',
				changed: true,
				newType: 'suspense',
			};

			const events = mapTensionChange(extraction, source, 'tense');

			expect(events[0]).toEqual(
				expect.objectContaining({
					direction: 'stable',
				}),
			);
		});

		it('returns stable when no previous level', () => {
			const extraction: ExtractedTensionChange = {
				reasoning: 'first tension',
				changed: true,
				newLevel: 'tense',
			};

			const events = mapTensionChange(extraction, source);

			expect(events[0]).toEqual(
				expect.objectContaining({
					direction: 'stable',
				}),
			);
		});

		it('returns stable when same level', () => {
			const extraction: ExtractedTensionChange = {
				reasoning: 'same',
				changed: true,
				newLevel: 'guarded',
			};

			const events = mapTensionChange(extraction, source, 'guarded');

			expect(events[0]).toEqual(
				expect.objectContaining({
					direction: 'stable',
				}),
			);
		});

		it('returns escalating when level increases (relaxed -> tense)', () => {
			const extraction: ExtractedTensionChange = {
				reasoning: 'escalated',
				changed: true,
				newLevel: 'tense',
			};

			const events = mapTensionChange(extraction, source, 'relaxed');

			expect(events[0]).toEqual(
				expect.objectContaining({
					direction: 'escalating',
				}),
			);
		});

		it('returns escalating when level increases (aware -> volatile)', () => {
			const extraction: ExtractedTensionChange = {
				reasoning: 'escalated a lot',
				changed: true,
				newLevel: 'volatile',
			};

			const events = mapTensionChange(extraction, source, 'aware');

			expect(events[0]).toEqual(
				expect.objectContaining({
					direction: 'escalating',
				}),
			);
		});

		it('returns decreasing when level decreases (explosive -> aware)', () => {
			const extraction: ExtractedTensionChange = {
				reasoning: 'calmed down',
				changed: true,
				newLevel: 'aware',
			};

			const events = mapTensionChange(extraction, source, 'explosive');

			expect(events[0]).toEqual(
				expect.objectContaining({
					direction: 'decreasing',
				}),
			);
		});

		it('returns decreasing when level decreases (charged -> guarded)', () => {
			const extraction: ExtractedTensionChange = {
				reasoning: 'tension eased',
				changed: true,
				newLevel: 'guarded',
			};

			const events = mapTensionChange(extraction, source, 'charged');

			expect(events[0]).toEqual(
				expect.objectContaining({
					direction: 'decreasing',
				}),
			);
		});

		it('returns stable for unknown tension levels', () => {
			const extraction: ExtractedTensionChange = {
				reasoning: 'unknown',
				changed: true,
				newLevel: 'mystery_level' as never,
			};

			const events = mapTensionChange(
				extraction,
				source,
				'also_unknown' as never,
			);

			expect(events[0]).toEqual(
				expect.objectContaining({
					direction: 'stable',
				}),
			);
		});
	});
});

// ============================================
// Narrative Events
// ============================================

describe('mapNarrativeDescription', () => {
	it('returns event when description exists', () => {
		const extraction: ExtractedNarrativeDescription = {
			reasoning: 'summarized',
			description: 'Alice and Bob discussed their plans.',
		};

		const events = mapNarrativeDescription(extraction, source);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'narrative_description',
				description: 'Alice and Bob discussed their plans.',
				source,
			}),
		);
	});

	it('returns empty array when description is empty', () => {
		const extraction: ExtractedNarrativeDescription = {
			reasoning: 'nothing',
			description: '',
		};

		expect(mapNarrativeDescription(extraction, source)).toEqual([]);
	});
});

// ============================================
// Chapter Events
// ============================================

describe('mapChapterEnded', () => {
	it('returns event when shouldEnd is true', () => {
		const extraction: ExtractedChapterEnded = {
			reasoning: 'chapter should end',
			shouldEnd: true,
			reason: 'time_jump',
		};

		const events = mapChapterEnded(extraction, source, 3);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'chapter',
				subkind: 'ended',
				chapterIndex: 3,
				reason: 'time_jump',
			}),
		);
	});

	it('returns empty array when shouldEnd is false', () => {
		const extraction: ExtractedChapterEnded = {
			reasoning: 'continue',
			shouldEnd: false,
		};

		expect(mapChapterEnded(extraction, source, 0)).toEqual([]);
	});

	it('defaults reason to location_change when not provided', () => {
		const extraction: ExtractedChapterEnded = {
			reasoning: 'end it',
			shouldEnd: true,
		};

		const events = mapChapterEnded(extraction, source, 1);

		expect(events[0]).toEqual(
			expect.objectContaining({
				reason: 'location_change',
			}),
		);
	});

	it('passes through "both" reason', () => {
		const extraction: ExtractedChapterEnded = {
			reasoning: 'both reasons',
			shouldEnd: true,
			reason: 'both',
		};

		const events = mapChapterEnded(extraction, source, 2);

		expect(events[0]).toEqual(
			expect.objectContaining({
				reason: 'both',
			}),
		);
	});
});

describe('mapChapterDescription', () => {
	it('always returns an event with title and summary', () => {
		const extraction: ExtractedChapterDescription = {
			reasoning: 'described',
			title: 'The Beginning',
			summary: 'Our heroes set out on their journey.',
		};

		const events = mapChapterDescription(extraction, source, 0);

		expect(events).toHaveLength(1);
		expect(events[0]).toEqual(
			expect.objectContaining({
				kind: 'chapter',
				subkind: 'described',
				chapterIndex: 0,
				title: 'The Beginning',
				summary: 'Our heroes set out on their journey.',
				source,
			}),
		);
	});

	it('passes through the chapterIndex', () => {
		const extraction: ExtractedChapterDescription = {
			reasoning: 'chapter 5',
			title: 'Climax',
			summary: 'Everything comes to a head.',
		};

		const events = mapChapterDescription(extraction, source, 5);

		expect(events[0]).toEqual(
			expect.objectContaining({
				chapterIndex: 5,
			}),
		);
	});
});

// ============================================
// Base Event Fields
// ============================================

describe('baseEvent fields', () => {
	it('all events include id, source, and timestamp', () => {
		const extraction: ExtractedTimeChange = {
			reasoning: 'check base fields',
			changed: true,
			delta: { days: 0, hours: 1, minutes: 0, seconds: 0 },
		};

		const events = mapTimeChange(extraction, source);

		expect(events[0]).toHaveProperty('id', 'test-id');
		expect(events[0]).toHaveProperty('source', source);
		expect(events[0]).toHaveProperty('timestamp');
		expect(typeof events[0].timestamp).toBe('number');
	});
});
