/**
 * V2 Event Application
 *
 * Pure functions for applying events to projections.
 * These functions mutate the projection in place for efficiency.
 *
 * Time handling:
 * - Events store time as ISO string
 * - Projections use moment.Moment
 * - applyTimeInitial parses ISO string to moment
 * - applyTimeDelta uses moment's add() for proper time math
 */

import type {
	Event,
	TimeInitialEvent,
	TimeDeltaEvent,
	LocationMovedEvent,
	LocationPropAddedEvent,
	LocationPropRemovedEvent,
	ForecastGeneratedEvent,
	CharacterAppearedEvent,
	CharacterDepartedEvent,
	CharacterProfileSetEvent,
	CharacterPositionChangedEvent,
	CharacterActivityChangedEvent,
	CharacterMoodAddedEvent,
	CharacterMoodRemovedEvent,
	CharacterOutfitChangedEvent,
	CharacterPhysicalAddedEvent,
	CharacterPhysicalRemovedEvent,
	RelationshipFeelingAddedEvent,
	RelationshipFeelingRemovedEvent,
	RelationshipSecretAddedEvent,
	RelationshipSecretRemovedEvent,
	RelationshipWantAddedEvent,
	RelationshipWantRemovedEvent,
	RelationshipStatusChangedEvent,
	TopicToneEvent,
	TensionEvent,
	ChapterEndedEvent,
} from '../types/event';
import {
	isTimeInitialEvent,
	isTimeDeltaEvent,
	isLocationMovedEvent,
	isLocationPropAddedEvent,
	isLocationPropRemovedEvent,
	isForecastGeneratedEvent,
	isCharacterAppearedEvent,
	isCharacterDepartedEvent,
	isCharacterProfileSetEvent,
	isCharacterPositionChangedEvent,
	isCharacterActivityChangedEvent,
	isCharacterMoodAddedEvent,
	isCharacterMoodRemovedEvent,
	isCharacterOutfitChangedEvent,
	isCharacterPhysicalAddedEvent,
	isCharacterPhysicalRemovedEvent,
	isRelationshipFeelingAddedEvent,
	isRelationshipFeelingRemovedEvent,
	isRelationshipSecretAddedEvent,
	isRelationshipSecretRemovedEvent,
	isRelationshipWantAddedEvent,
	isRelationshipWantRemovedEvent,
	isRelationshipStatusChangedEvent,
	isTopicToneEvent,
	isTensionEvent,
	isChapterEndedEvent,
	getRelationshipPair,
} from '../types/event';
import type { Projection, CharacterState, RelationshipState } from '../types/snapshot';
import {
	createEmptyCharacterState,
	createEmptyRelationshipState,
	createEmptySceneState,
	getRelationshipKey,
	sortPair,
} from '../types/snapshot';
import { createEmptyLocationState, deserializeMoment, addTimeDelta } from '../types/common';
import { debugWarn } from '../../utils/debug';

/**
 * Apply an event to a projection, mutating it in place.
 *
 * @param projection - The projection to mutate
 * @param event - The event to apply
 */
export function applyEventToProjection(projection: Projection, event: Event): void {
	// Time events
	if (isTimeInitialEvent(event)) {
		applyTimeInitial(projection, event);
		return;
	}
	if (isTimeDeltaEvent(event)) {
		applyTimeDelta(projection, event);
		return;
	}

	// Location events
	if (isLocationMovedEvent(event)) {
		applyLocationMoved(projection, event);
		return;
	}
	if (isLocationPropAddedEvent(event)) {
		applyLocationPropAdded(projection, event);
		return;
	}
	if (isLocationPropRemovedEvent(event)) {
		applyLocationPropRemoved(projection, event);
		return;
	}

	// Forecast events
	if (isForecastGeneratedEvent(event)) {
		applyForecastGenerated(projection, event);
		return;
	}

	// Character events
	if (isCharacterAppearedEvent(event)) {
		applyCharacterAppeared(projection, event);
		return;
	}
	if (isCharacterDepartedEvent(event)) {
		applyCharacterDeparted(projection, event);
		return;
	}
	if (isCharacterProfileSetEvent(event)) {
		applyCharacterProfileSet(projection, event);
		return;
	}
	if (isCharacterPositionChangedEvent(event)) {
		applyCharacterPositionChanged(projection, event);
		return;
	}
	if (isCharacterActivityChangedEvent(event)) {
		applyCharacterActivityChanged(projection, event);
		return;
	}
	if (isCharacterMoodAddedEvent(event)) {
		applyCharacterMoodAdded(projection, event);
		return;
	}
	if (isCharacterMoodRemovedEvent(event)) {
		applyCharacterMoodRemoved(projection, event);
		return;
	}
	if (isCharacterOutfitChangedEvent(event)) {
		applyCharacterOutfitChanged(projection, event);
		return;
	}
	if (isCharacterPhysicalAddedEvent(event)) {
		applyCharacterPhysicalAdded(projection, event);
		return;
	}
	if (isCharacterPhysicalRemovedEvent(event)) {
		applyCharacterPhysicalRemoved(projection, event);
		return;
	}

	// Relationship events
	if (isRelationshipFeelingAddedEvent(event)) {
		applyRelationshipFeelingAdded(projection, event);
		return;
	}
	if (isRelationshipFeelingRemovedEvent(event)) {
		applyRelationshipFeelingRemoved(projection, event);
		return;
	}
	if (isRelationshipSecretAddedEvent(event)) {
		applyRelationshipSecretAdded(projection, event);
		return;
	}
	if (isRelationshipSecretRemovedEvent(event)) {
		applyRelationshipSecretRemoved(projection, event);
		return;
	}
	if (isRelationshipWantAddedEvent(event)) {
		applyRelationshipWantAdded(projection, event);
		return;
	}
	if (isRelationshipWantRemovedEvent(event)) {
		applyRelationshipWantRemoved(projection, event);
		return;
	}
	if (isRelationshipStatusChangedEvent(event)) {
		applyRelationshipStatusChanged(projection, event);
		return;
	}

	// Topic/Tone events
	if (isTopicToneEvent(event)) {
		applyTopicTone(projection, event);
		return;
	}

	// Tension events
	if (isTensionEvent(event)) {
		applyTension(projection, event);
		return;
	}

	// Chapter events
	if (isChapterEndedEvent(event)) {
		applyChapterEnded(projection, event);
		return;
	}

	// Unknown event type - ignore (don't crash)
}

// ============================================
// Time Event Application
// ============================================

/**
 * Apply a time initial event.
 * Event stores time as ISO string, projection uses moment.Moment.
 */
function applyTimeInitial(projection: Projection, event: TimeInitialEvent): void {
	projection.time = deserializeMoment(event.time);
}

/**
 * Apply a time delta event.
 * Uses moment's add() for proper time math including seconds.
 */
function applyTimeDelta(projection: Projection, event: TimeDeltaEvent): void {
	if (!projection.time) {
		// No base time to apply delta to - skip
		debugWarn('Skipping time delta - no base time in projection');
		return;
	}
	projection.time = addTimeDelta(projection.time, event.delta);
}

// ============================================
// Location Event Application
// ============================================

function applyLocationMoved(projection: Projection, event: LocationMovedEvent): void {
	if (!projection.location) {
		projection.location = createEmptyLocationState();
	}
	// Check if we're actually moving to a different place before clearing props
	const oldPlace = projection.location.place;
	const isNewPlace = event.newPlace && event.newPlace !== oldPlace;

	// Only update fields if the event specifies new values (preserve existing if empty)
	projection.location.area = event.newArea || projection.location.area;
	projection.location.place = event.newPlace || projection.location.place;
	projection.location.position = event.newPosition || projection.location.position;

	// Update locationType if the event specifies a new one
	if (event.newLocationType) {
		projection.location.locationType = event.newLocationType;
	}

	// Only clear props if we actually moved to a different place
	if (isNewPlace) {
		projection.location.props = [];
	}
}

function applyLocationPropAdded(projection: Projection, event: LocationPropAddedEvent): void {
	if (!projection.location) {
		projection.location = createEmptyLocationState();
	}
	if (!projection.location.props.includes(event.prop)) {
		projection.location.props.push(event.prop);
	}
}

function applyLocationPropRemoved(projection: Projection, event: LocationPropRemovedEvent): void {
	if (!projection.location) return;
	const index = projection.location.props.indexOf(event.prop);
	if (index !== -1) {
		projection.location.props.splice(index, 1);
	}
}

// ============================================
// Forecast Event Application
// ============================================

/**
 * Apply a forecast generated event.
 * Stores the forecast in the projection's forecasts map.
 * Climate is computed separately from forecasts + time + location.
 */
function applyForecastGenerated(projection: Projection, event: ForecastGeneratedEvent): void {
	projection.forecasts[event.areaName] = event.forecast;
}

// ============================================
// Character Event Application
// ============================================

function ensureCharacter(projection: Projection, name: string): CharacterState {
	if (!projection.characters[name]) {
		projection.characters[name] = createEmptyCharacterState(name);
	}
	return projection.characters[name];
}

function applyCharacterAppeared(projection: Projection, event: CharacterAppearedEvent): void {
	const char = ensureCharacter(projection, event.character);
	char.position = event.initialPosition || '';
	char.activity = event.initialActivity || null;
	if (event.initialMood?.length) {
		char.mood = [...event.initialMood];
	}
	if (event.initialPhysicalState?.length) {
		char.physicalState = [...event.initialPhysicalState];
	}
	if (!projection.charactersPresent.includes(event.character)) {
		// Create relationship pairs with all already-present characters
		// ensureRelationship() only creates if the pair doesn't exist - won't overwrite existing relationships
		for (const otherChar of projection.charactersPresent) {
			const pair = sortPair(event.character, otherChar);
			ensureRelationship(projection, pair);
		}
		projection.charactersPresent.push(event.character);
	}
}

function applyCharacterDeparted(projection: Projection, event: CharacterDepartedEvent): void {
	const index = projection.charactersPresent.indexOf(event.character);
	if (index !== -1) {
		projection.charactersPresent.splice(index, 1);
	}
	// Note: We keep the character data for historical reference
}

function applyCharacterProfileSet(projection: Projection, event: CharacterProfileSetEvent): void {
	const char = ensureCharacter(projection, event.character);
	char.profile = {
		sex: event.profile.sex,
		species: event.profile.species,
		age: event.profile.age,
		appearance: [...event.profile.appearance],
		personality: [...event.profile.personality],
	};
}

function applyCharacterPositionChanged(
	projection: Projection,
	event: CharacterPositionChangedEvent,
): void {
	const char = ensureCharacter(projection, event.character);
	char.position = event.newValue;
}

function applyCharacterActivityChanged(
	projection: Projection,
	event: CharacterActivityChangedEvent,
): void {
	const char = ensureCharacter(projection, event.character);
	char.activity = event.newValue;
}

function applyCharacterMoodAdded(projection: Projection, event: CharacterMoodAddedEvent): void {
	const char = ensureCharacter(projection, event.character);
	if (!char.mood.includes(event.mood)) {
		char.mood.push(event.mood);
	}
}

function applyCharacterMoodRemoved(projection: Projection, event: CharacterMoodRemovedEvent): void {
	const char = projection.characters[event.character];
	if (!char) return;
	const index = char.mood.indexOf(event.mood);
	if (index !== -1) {
		char.mood.splice(index, 1);
	}
}

function applyCharacterOutfitChanged(
	projection: Projection,
	event: CharacterOutfitChangedEvent,
): void {
	const char = ensureCharacter(projection, event.character);
	char.outfit[event.slot] = event.newValue;
}

function applyCharacterPhysicalAdded(
	projection: Projection,
	event: CharacterPhysicalAddedEvent,
): void {
	const char = ensureCharacter(projection, event.character);
	if (!char.physicalState.includes(event.physicalState)) {
		char.physicalState.push(event.physicalState);
	}
}

function applyCharacterPhysicalRemoved(
	projection: Projection,
	event: CharacterPhysicalRemovedEvent,
): void {
	const char = projection.characters[event.character];
	if (!char) return;
	const index = char.physicalState.indexOf(event.physicalState);
	if (index !== -1) {
		char.physicalState.splice(index, 1);
	}
}

// ============================================
// Relationship Event Application
// ============================================

function ensureRelationship(projection: Projection, pair: [string, string]): RelationshipState {
	const key = getRelationshipKey(pair);
	if (!projection.relationships[key]) {
		projection.relationships[key] = createEmptyRelationshipState(pair);
	}
	return projection.relationships[key];
}

function getAttitude(rel: RelationshipState, from: string, _toward: string) {
	return rel.pair[0] === from ? rel.aToB : rel.bToA;
}

function applyRelationshipFeelingAdded(
	projection: Projection,
	event: RelationshipFeelingAddedEvent,
): void {
	const pair = getRelationshipPair(event);
	const rel = ensureRelationship(projection, pair);
	const attitude = getAttitude(rel, event.fromCharacter, event.towardCharacter);
	if (!attitude.feelings.includes(event.value)) {
		attitude.feelings.push(event.value);
	}
}

function applyRelationshipFeelingRemoved(
	projection: Projection,
	event: RelationshipFeelingRemovedEvent,
): void {
	const pair = getRelationshipPair(event);
	const key = getRelationshipKey(pair);
	const rel = projection.relationships[key];
	if (!rel) return;
	const attitude = getAttitude(rel, event.fromCharacter, event.towardCharacter);
	const index = attitude.feelings.indexOf(event.value);
	if (index !== -1) {
		attitude.feelings.splice(index, 1);
	}
}

function applyRelationshipSecretAdded(
	projection: Projection,
	event: RelationshipSecretAddedEvent,
): void {
	const pair = getRelationshipPair(event);
	const rel = ensureRelationship(projection, pair);
	const attitude = getAttitude(rel, event.fromCharacter, event.towardCharacter);
	if (!attitude.secrets.includes(event.value)) {
		attitude.secrets.push(event.value);
	}
}

function applyRelationshipSecretRemoved(
	projection: Projection,
	event: RelationshipSecretRemovedEvent,
): void {
	const pair = getRelationshipPair(event);
	const key = getRelationshipKey(pair);
	const rel = projection.relationships[key];
	if (!rel) return;
	const attitude = getAttitude(rel, event.fromCharacter, event.towardCharacter);
	const index = attitude.secrets.indexOf(event.value);
	if (index !== -1) {
		attitude.secrets.splice(index, 1);
	}
}

function applyRelationshipWantAdded(
	projection: Projection,
	event: RelationshipWantAddedEvent,
): void {
	const pair = getRelationshipPair(event);
	const rel = ensureRelationship(projection, pair);
	const attitude = getAttitude(rel, event.fromCharacter, event.towardCharacter);
	if (!attitude.wants.includes(event.value)) {
		attitude.wants.push(event.value);
	}
}

function applyRelationshipWantRemoved(
	projection: Projection,
	event: RelationshipWantRemovedEvent,
): void {
	const pair = getRelationshipPair(event);
	const key = getRelationshipKey(pair);
	const rel = projection.relationships[key];
	if (!rel) return;
	const attitude = getAttitude(rel, event.fromCharacter, event.towardCharacter);
	const index = attitude.wants.indexOf(event.value);
	if (index !== -1) {
		attitude.wants.splice(index, 1);
	}
}

function applyRelationshipStatusChanged(
	projection: Projection,
	event: RelationshipStatusChangedEvent,
): void {
	const rel = ensureRelationship(projection, event.pair);
	rel.status = event.newStatus;
}

// ============================================
// Topic/Tone Event Application
// ============================================

function applyTopicTone(projection: Projection, event: TopicToneEvent): void {
	if (!projection.scene) {
		projection.scene = createEmptySceneState();
	}
	projection.scene.topic = event.topic;
	projection.scene.tone = event.tone;
}

// ============================================
// Tension Event Application
// ============================================

function applyTension(projection: Projection, event: TensionEvent): void {
	if (!projection.scene) {
		projection.scene = createEmptySceneState();
	}
	projection.scene.tension.level = event.level;
	projection.scene.tension.type = event.type;
	projection.scene.tension.direction = event.direction;
}

// ============================================
// Chapter Event Application
// ============================================

function applyChapterEnded(projection: Projection, event: ChapterEndedEvent): void {
	projection.currentChapter = event.chapterIndex + 1;
}
