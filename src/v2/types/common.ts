/**
 * V2 Common Types
 *
 * Foundation types used throughout the V2 event system.
 * Uses moment.js for all date/time handling.
 */

import moment from 'moment';

/**
 * Reference to a specific message and swipe combination.
 * Used to track which message/swipe generated an event.
 */
export interface MessageAndSwipe {
	messageId: number;
	swipeId: number;
}

/**
 * Time delta for incremental time changes.
 * Uses moment.Duration for proper time math.
 */
export interface TimeDelta {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

/**
 * Create a TimeDelta from a moment.Duration.
 */
export function durationToTimeDelta(duration: moment.Duration): TimeDelta {
	return {
		days: Math.floor(duration.asDays()),
		hours: duration.hours(),
		minutes: duration.minutes(),
		seconds: duration.seconds(),
	};
}

/**
 * Create a moment.Duration from a TimeDelta.
 */
export function timeDeltaToDuration(delta: TimeDelta): moment.Duration {
	return moment.duration({
		days: delta.days,
		hours: delta.hours,
		minutes: delta.minutes,
		seconds: delta.seconds,
	});
}

/**
 * Add a TimeDelta to a moment, returning a new moment.
 */
export function addTimeDelta(time: moment.Moment, delta: TimeDelta): moment.Moment {
	return time.clone().add(timeDeltaToDuration(delta));
}

/**
 * Serialize a moment to ISO string for JSON storage.
 */
export function serializeMoment(m: moment.Moment): string {
	return m.toISOString();
}

/**
 * Deserialize an ISO string back to moment.
 */
export function deserializeMoment(iso: string): moment.Moment {
	return moment(iso);
}

/**
 * Create a zero TimeDelta.
 */
export function zeroTimeDelta(): TimeDelta {
	return { days: 0, hours: 0, minutes: 0, seconds: 0 };
}

/**
 * Convert an extracted datetime (from LLM) to moment.
 * Extracted datetime uses 1-indexed months (human readable).
 */
export function extractedDateTimeToMoment(extracted: {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}): moment.Moment {
	return moment({
		year: extracted.year,
		month: extracted.month - 1, // Convert from 1-indexed to 0-indexed
		date: extracted.day,
		hour: extracted.hour,
		minute: extracted.minute,
		second: extracted.second,
	});
}

/**
 * Convert an extracted datetime (from LLM) directly to ISO string.
 */
export function extractedDateTimeToIsoString(extracted: {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
}): string {
	return serializeMoment(extractedDateTimeToMoment(extracted));
}

/**
 * Location type for climate/temperature calculations.
 * - outdoor: Outside, exposed to weather
 * - modern: Climate-controlled (HVAC) - offices, malls, hotels, hospitals
 * - heated: Traditional heating (fireplace, radiator) - homes, cabins, taverns
 * - unheated: Shelter but no climate control - barns, warehouses, sheds
 * - underground: Below ground, stable temperature - caves, basements, tunnels
 * - tent: Minimal shelter - tents, campsites
 * - vehicle: Enclosed transport - cars, trains, planes, ships
 */
export type LocationType =
	| 'outdoor'
	| 'modern'
	| 'heated'
	| 'unheated'
	| 'underground'
	| 'tent'
	| 'vehicle';

export const LOCATION_TYPES: readonly LocationType[] = [
	'outdoor',
	'modern',
	'heated',
	'unheated',
	'underground',
	'tent',
	'vehicle',
] as const;

export function isValidLocationType(value: string): value is LocationType {
	return LOCATION_TYPES.includes(value as LocationType);
}

/**
 * Location state representation.
 */
export interface LocationState {
	area: string;
	place: string;
	position: string;
	props: string[];
	/** Type of location for climate calculations */
	locationType: LocationType;
}

/**
 * Weather condition types.
 */
export type WeatherCondition =
	| 'clear'
	| 'sunny'
	| 'partly_cloudy'
	| 'overcast'
	| 'foggy'
	| 'drizzle'
	| 'rain'
	| 'heavy_rain'
	| 'thunderstorm'
	| 'sleet'
	| 'snow'
	| 'heavy_snow'
	| 'blizzard'
	| 'windy'
	| 'hot'
	| 'cold'
	| 'humid';

/**
 * Daylight phase of day.
 */
export type DaylightPhase = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * Building type for indoor temperature calculations.
 */
export type BuildingType = 'modern' | 'heated' | 'unheated' | 'underground' | 'tent' | 'vehicle';

/**
 * Climate forecast data.
 */
export interface ClimateForecast {
	temperature: number;
	outdoorTemperature: number;
	indoorTemperature?: number;
	feelsLike: number;
	humidity: number;
	precipitation: number;
	cloudCover: number;
	windSpeed: number;
	windDirection: string;
	conditions: string;
	conditionType: WeatherCondition;
	uvIndex: number;
	daylight: DaylightPhase;
	isIndoors: boolean;
	buildingType?: BuildingType;
}

/**
 * Tension levels from relaxed to explosive.
 */
export type TensionLevel =
	| 'relaxed'
	| 'aware'
	| 'guarded'
	| 'tense'
	| 'charged'
	| 'volatile'
	| 'explosive';

/**
 * Direction of tension change.
 */
export type TensionDirection = 'escalating' | 'stable' | 'decreasing';

/**
 * Type/nature of the tension.
 */
export type TensionType =
	| 'confrontation'
	| 'intimate'
	| 'vulnerable'
	| 'celebratory'
	| 'negotiation'
	| 'suspense'
	| 'conversation';

/**
 * Relationship status levels.
 */
export type RelationshipStatus =
	| 'strangers'
	| 'acquaintances'
	| 'friendly'
	| 'close'
	| 'intimate'
	| 'strained'
	| 'hostile'
	| 'complicated';

/**
 * Outfit slot names for character clothing.
 */
export type OutfitSlot =
	| 'head'
	| 'neck'
	| 'jacket'
	| 'back'
	| 'torso'
	| 'legs'
	| 'footwear'
	| 'socks'
	| 'underwear';

/**
 * Character outfit state.
 */
export interface CharacterOutfit {
	head: string | null;
	neck: string | null;
	jacket: string | null;
	back: string | null;
	torso: string | null;
	legs: string | null;
	footwear: string | null;
	socks: string | null;
	underwear: string | null;
}

/**
 * Constants
 */
export const TENSION_LEVELS: readonly TensionLevel[] = [
	'relaxed',
	'aware',
	'guarded',
	'tense',
	'charged',
	'volatile',
	'explosive',
] as const;

export const TENSION_TYPES: readonly TensionType[] = [
	'confrontation',
	'intimate',
	'vulnerable',
	'celebratory',
	'negotiation',
	'suspense',
	'conversation',
] as const;

export const TENSION_DIRECTIONS: readonly TensionDirection[] = [
	'escalating',
	'stable',
	'decreasing',
] as const;

export const RELATIONSHIP_STATUSES: readonly RelationshipStatus[] = [
	'strangers',
	'acquaintances',
	'friendly',
	'close',
	'intimate',
	'strained',
	'hostile',
	'complicated',
] as const;

export const OUTFIT_SLOTS: readonly OutfitSlot[] = [
	'head',
	'neck',
	'jacket',
	'back',
	'torso',
	'legs',
	'footwear',
	'socks',
	'underwear',
] as const;

export const DAYS_OF_WEEK = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
] as const;

/**
 * Type guards
 */
export function isValidTensionLevel(value: string): value is TensionLevel {
	return TENSION_LEVELS.includes(value as TensionLevel);
}

export function isValidTensionType(value: string): value is TensionType {
	return TENSION_TYPES.includes(value as TensionType);
}

export function isValidTensionDirection(value: string): value is TensionDirection {
	return TENSION_DIRECTIONS.includes(value as TensionDirection);
}

export function isValidRelationshipStatus(value: string): value is RelationshipStatus {
	return RELATIONSHIP_STATUSES.includes(value as RelationshipStatus);
}

export function isValidOutfitSlot(value: string): value is OutfitSlot {
	return OUTFIT_SLOTS.includes(value as OutfitSlot);
}

/**
 * Create an empty outfit with all slots null.
 */
export function createEmptyOutfit(): CharacterOutfit {
	return {
		head: null,
		neck: null,
		jacket: null,
		back: null,
		torso: null,
		legs: null,
		footwear: null,
		socks: null,
		underwear: null,
	};
}

/**
 * Create an empty location state.
 */
export function createEmptyLocationState(): LocationState {
	return {
		area: '',
		place: '',
		position: '',
		props: [],
		locationType: 'outdoor',
	};
}
