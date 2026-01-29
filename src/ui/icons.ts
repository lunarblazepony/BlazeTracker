// ============================================
// UI Icons and Colors for BlazeTracker
// ============================================

import type {
	TensionType,
	TensionLevel,
	TensionDirection,
	Climate,
	EventType,
	WeatherCondition,
} from '../types/state';

/**
 * Font Awesome icons for tension types.
 */
export const TENSION_TYPE_ICONS: Record<TensionType, string> = {
	conversation: 'fa-comments',
	confrontation: 'fa-burst',
	intimate: 'fa-heart',
	suspense: 'fa-clock',
	vulnerable: 'fa-shield-halved',
	celebratory: 'fa-champagne-glasses',
	negotiation: 'fa-handshake',
};

/**
 * Font Awesome icons for tension levels.
 */
export const TENSION_LEVEL_ICONS: Record<TensionLevel, string> = {
	relaxed: 'fa-mug-hot',
	aware: 'fa-eye',
	guarded: 'fa-shield-halved',
	tense: 'fa-face-grimace',
	charged: 'fa-bolt',
	volatile: 'fa-fire',
	explosive: 'fa-explosion',
};

/**
 * Font Awesome icons for tension directions.
 */
export const TENSION_DIRECTION_ICONS: Record<TensionDirection, string> = {
	escalating: 'fa-arrow-trend-up',
	stable: 'fa-grip-lines',
	decreasing: 'fa-arrow-trend-down',
};

/**
 * Font Awesome icons for weather types.
 */
export const WEATHER_ICONS: Record<Climate['weather'], string> = {
	sunny: 'fa-sun',
	cloudy: 'fa-cloud',
	snowy: 'fa-snowflake',
	rainy: 'fa-cloud-rain',
	windy: 'fa-wind',
	thunderstorm: 'fa-cloud-bolt',
};

/**
 * Get the weather icon for a weather type.
 */
export function getWeatherIcon(weather: string): string {
	return WEATHER_ICONS[weather as Climate['weather']] ?? 'fa-question';
}

/**
 * Font Awesome icons for procedural weather conditions.
 */
export const CONDITION_ICONS: Record<WeatherCondition, string> = {
	clear: 'fa-moon',
	sunny: 'fa-sun',
	partly_cloudy: 'fa-cloud-sun',
	overcast: 'fa-cloud',
	foggy: 'fa-smog',
	drizzle: 'fa-cloud-rain',
	rain: 'fa-cloud-showers-heavy',
	heavy_rain: 'fa-cloud-showers-water',
	thunderstorm: 'fa-cloud-bolt',
	sleet: 'fa-cloud-meatball',
	snow: 'fa-snowflake',
	heavy_snow: 'fa-snowflake',
	blizzard: 'fa-icicles',
	windy: 'fa-wind',
	hot: 'fa-temperature-high',
	cold: 'fa-temperature-low',
	humid: 'fa-droplet',
};

/**
 * Get the icon for a procedural weather condition.
 */
export function getConditionIcon(condition: WeatherCondition): string {
	return CONDITION_ICONS[condition] ?? 'fa-question';
}

/**
 * Night-time variants of condition icons.
 * Used for forecast display when hour is after sunset or before sunrise.
 */
export const CONDITION_ICONS_NIGHT: Record<WeatherCondition, string> = {
	clear: 'fa-moon',
	sunny: 'fa-moon', // Sunny at night = clear/moon
	partly_cloudy: 'fa-cloud-moon',
	overcast: 'fa-cloud',
	foggy: 'fa-smog',
	drizzle: 'fa-cloud-moon-rain',
	rain: 'fa-cloud-showers-heavy',
	heavy_rain: 'fa-cloud-showers-water',
	thunderstorm: 'fa-cloud-bolt',
	sleet: 'fa-cloud-meatball',
	snow: 'fa-snowflake',
	heavy_snow: 'fa-snowflake',
	blizzard: 'fa-icicles',
	windy: 'fa-wind',
	hot: 'fa-temperature-high',
	cold: 'fa-temperature-low',
	humid: 'fa-droplet',
};

/**
 * Get the icon for a weather condition with day/night awareness.
 * @param condition - The weather condition
 * @param isNight - Whether it's nighttime
 */
export function getConditionIconDayNight(condition: WeatherCondition, isNight: boolean): string {
	if (isNight) {
		return CONDITION_ICONS_NIGHT[condition] ?? 'fa-question';
	}
	return CONDITION_ICONS[condition] ?? 'fa-question';
}

/**
 * Colors for tension types.
 */
export const TENSION_TYPE_COLORS: Record<TensionType, string> = {
	conversation: '#6b7280', // gray-500
	confrontation: '#ef4444', // red-500
	intimate: '#ec4899', // pink-500
	suspense: '#8b5cf6', // violet-500
	vulnerable: '#06b6d4', // cyan-500
	celebratory: '#eab308', // yellow-500
	negotiation: '#f97316', // orange-500
};

/**
 * Colors for tension levels.
 */
export const TENSION_LEVEL_COLORS: Record<TensionLevel, string> = {
	relaxed: '#6b7280', // gray-500
	aware: '#3b82f6', // blue-500
	guarded: '#22c55e', // green-500
	tense: '#f59e0b', // amber-500
	charged: '#f97316', // orange-500
	volatile: '#ef4444', // red-500
	explosive: '#dc2626', // red-600
};

/**
 * Get the icon class for a tension type.
 */
export function getTensionIcon(type: TensionType): string {
	return `fa-solid ${TENSION_TYPE_ICONS[type] || 'fa-circle'}`;
}

/**
 * Get the icon class for a tension level.
 */
export function getTensionLevelIcon(level: TensionLevel): string {
	return `fa-solid ${TENSION_LEVEL_ICONS[level] || 'fa-circle'}`;
}

/**
 * Get the color for a tension type.
 */
export function getTensionTypeColor(type: TensionType): string {
	return TENSION_TYPE_COLORS[type] || '#6b7280';
}

/**
 * Get the color for a tension level.
 */
export function getTensionColor(level: TensionLevel): string {
	return TENSION_LEVEL_COLORS[level] || '#6b7280';
}

/**
 * Numeric value for tension level (for graphing).
 */
export const TENSION_LEVEL_VALUES: Record<TensionLevel, number> = {
	relaxed: 1,
	aware: 2,
	guarded: 3,
	tense: 4,
	charged: 5,
	volatile: 6,
	explosive: 7,
};

/**
 * Get numeric value for a tension level.
 */
export function getTensionValue(level: TensionLevel): number {
	return TENSION_LEVEL_VALUES[level] || 1;
}

// ============================================
// Event Type Icons and Colors
// ============================================

/**
 * Font Awesome icons for event types.
 */
export const EVENT_TYPE_ICONS: Record<EventType, string> = {
	// Conversation
	conversation: 'fa-comments',
	confession: 'fa-heart-circle-exclamation',
	argument: 'fa-comment-slash',
	negotiation: 'fa-handshake',

	// Discovery
	discovery: 'fa-lightbulb',
	secret_shared: 'fa-user-secret',
	secret_revealed: 'fa-mask',

	// Emotional
	emotional: 'fa-face-smile-beam',
	emotionally_intimate: 'fa-heart-circle-check',
	supportive: 'fa-hand-holding-heart',
	rejection: 'fa-hand',
	comfort: 'fa-hands-holding',
	apology: 'fa-hands-praying',
	forgiveness: 'fa-dove',

	// Bonding
	laugh: 'fa-face-laugh-beam',
	gift: 'fa-gift',
	compliment: 'fa-face-grin-stars',
	tease: 'fa-face-grin-tongue',
	flirt: 'fa-face-grin-wink',
	date: 'fa-champagne-glasses',
	i_love_you: 'fa-heart-circle-check',
	sleepover: 'fa-bed',
	shared_meal: 'fa-utensils',
	shared_activity: 'fa-gamepad',

	// Romantic Intimacy
	intimate_touch: 'fa-hand-holding-hand',
	intimate_kiss: 'fa-face-kiss-wink-heart',
	intimate_embrace: 'fa-people-pulling',
	intimate_heated: 'fa-fire',

	// Sexual Activity
	intimate_foreplay: 'fa-fire-flame-curved',
	intimate_oral: 'fa-face-kiss-beam',
	intimate_manual: 'fa-hand-sparkles',
	intimate_penetrative: 'fa-heart',
	intimate_climax: 'fa-star',

	// Action
	action: 'fa-person-running',
	combat: 'fa-hand-fist',
	danger: 'fa-skull',

	// Commitment
	decision: 'fa-scale-balanced',
	promise: 'fa-handshake-angle',
	betrayal: 'fa-face-angry',
	lied: 'fa-face-grimace',

	// Life Events
	exclusivity: 'fa-lock',
	marriage: 'fa-ring',
	pregnancy: 'fa-baby',
	childbirth: 'fa-baby-carriage',

	// Social
	social: 'fa-users',
	achievement: 'fa-trophy',

	// Support & Protection
	helped: 'fa-hands-helping',
	common_interest: 'fa-puzzle-piece',
	outing: 'fa-map-location-dot',
	defended: 'fa-shield-halved',
	crisis_together: 'fa-person-shelter',
	vulnerability: 'fa-heart-crack',
	shared_vulnerability: 'fa-hand-holding-heart',
	entrusted: 'fa-key',
};

/**
 * Colors for event types.
 */
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
	// Conversation - grays/blues
	conversation: '#6b7280',
	confession: '#ec4899',
	argument: '#ef4444',
	negotiation: '#f59e0b',

	// Discovery - yellows
	discovery: '#eab308',
	secret_shared: '#8b5cf6',
	secret_revealed: '#a855f7',

	// Emotional - cyans
	emotional: '#06b6d4',
	emotionally_intimate: '#ec4899', // pink-500 - milestone-worthy
	supportive: '#22d3ee',
	rejection: '#f43f5e',
	comfort: '#14b8a6', // teal-500
	apology: '#a78bfa', // violet-400
	forgiveness: '#34d399', // emerald-400

	// Bonding - warm greens and oranges
	laugh: '#facc15', // yellow-400
	gift: '#f472b6', // pink-400
	compliment: '#fbbf24', // amber-400
	tease: '#fb923c', // orange-400
	flirt: '#f87171', // red-400
	date: '#a78bfa', // violet-400
	i_love_you: '#f43f5e', // rose-500
	sleepover: '#818cf8', // indigo-400
	shared_meal: '#4ade80', // green-400
	shared_activity: '#60a5fa', // blue-400

	// Romantic Intimacy - pinks
	intimate_touch: '#fda4af',
	intimate_kiss: '#fb7185',
	intimate_embrace: '#f472b6',
	intimate_heated: '#ec4899',

	// Sexual Activity - deeper pinks/magentas
	intimate_foreplay: '#db2777',
	intimate_oral: '#be185d',
	intimate_manual: '#9d174d',
	intimate_penetrative: '#831843',
	intimate_climax: '#701a75',

	// Action - blues/reds
	action: '#3b82f6',
	combat: '#dc2626',
	danger: '#991b1b',

	// Commitment - purples/oranges
	decision: '#8b5cf6',
	promise: '#22c55e',
	betrayal: '#b91c1c',
	lied: '#f97316', // orange-500

	// Life Events - golds/teals
	exclusivity: '#0d9488', // teal-600
	marriage: '#d97706', // amber-600
	pregnancy: '#ec4899', // pink-500
	childbirth: '#8b5cf6', // violet-500

	// Social - greens
	social: '#22c55e',
	achievement: '#f59e0b',

	// Support & Protection - teals/blues
	helped: '#14b8a6', // teal-500
	common_interest: '#06b6d4', // cyan-500
	outing: '#3b82f6', // blue-500
	defended: '#6366f1', // indigo-500
	crisis_together: '#ef4444', // red-500
	vulnerability: '#a855f7', // purple-500
	shared_vulnerability: '#d946ef', // fuchsia-500 - milestone-worthy
	entrusted: '#f59e0b', // amber-500
};

/**
 * Priority order for selecting "primary" icon when multiple types.
 * Higher priority items appear first.
 */
export const EVENT_TYPE_PRIORITY: readonly EventType[] = [
	// Life events take highest priority (rare, significant)
	'childbirth',
	'marriage',
	'pregnancy',
	'exclusivity',
	// Sexual activity takes visual priority (highest intensity first)
	'intimate_climax',
	'intimate_penetrative',
	'intimate_oral',
	'intimate_manual',
	'intimate_foreplay',
	// Then romantic intimacy
	'intimate_heated',
	'intimate_kiss',
	'intimate_embrace',
	'intimate_touch',
	// Then high-drama events
	'crisis_together',
	'combat',
	'danger',
	'defended',
	'betrayal',
	'confession',
	'argument',
	// Then emotional/discovery
	'emotionally_intimate',
	'shared_vulnerability',
	'emotional',
	'comfort',
	'apology',
	'forgiveness',
	'secret_revealed',
	'secret_shared',
	'discovery',
	// Then decisions
	'decision',
	'promise',
	'rejection',
	// Then bonding/social
	'i_love_you',
	'date',
	'sleepover',
	'gift',
	'laugh',
	'compliment',
	'flirt',
	'tease',
	'shared_meal',
	'shared_activity',
	// Then social/support
	'supportive',
	'vulnerability', // General vulnerability (not milestone)
	'entrusted',
	'helped',
	'common_interest',
	'outing',
	'achievement',
	'social',
	'negotiation',
	// Default
	'conversation',
	'action',
];

/**
 * Get the primary event type from an array of types based on priority.
 */
export function getPrimaryEventType(types: EventType[]): EventType {
	for (const priority of EVENT_TYPE_PRIORITY) {
		if (types.includes(priority)) return priority;
	}
	return types[0] || 'conversation';
}

/**
 * Get the icon class for an event type.
 */
export function getEventTypeIcon(type: EventType): string {
	return `fa-solid ${EVENT_TYPE_ICONS[type] || 'fa-circle'}`;
}

/**
 * Get the color for an event type.
 */
export function getEventTypeColor(type: EventType): string {
	return EVENT_TYPE_COLORS[type] || '#6b7280';
}

// ============================================
// State Event Icons and Colors (Phase 2)
// ============================================

import type { CharacterEventSubkind, RelationshipEventSubkind } from '../types/state';

/**
 * Font Awesome icons for character event subkinds.
 */
export const CHARACTER_SUBKIND_ICONS: Record<CharacterEventSubkind, string> = {
	appeared: 'fa-user-plus',
	departed: 'fa-user-minus',
	mood_added: 'fa-face-smile',
	mood_removed: 'fa-face-meh',
	outfit_changed: 'fa-shirt',
	position_changed: 'fa-arrows-up-down-left-right',
	activity_changed: 'fa-person-running',
	physical_state_added: 'fa-heart-pulse',
	physical_state_removed: 'fa-heart',
};

/**
 * Font Awesome icons for state event kinds.
 */
export const STATE_EVENT_KIND_ICONS: Record<string, string> = {
	time: 'fa-clock',
	time_initial: 'fa-hourglass-start',
	location: 'fa-location-dot',
	location_prop: 'fa-couch',
	character: 'fa-user',
	relationship: 'fa-heart-circle-check',
};

/**
 * Colors by operation type for state events.
 */
export const STATE_EVENT_COLORS = {
	add: '#22c55e', // green - appeared, mood_added, physical_state_added
	remove: '#ef4444', // red - departed, mood_removed, physical_state_removed
	change: '#3b82f6', // blue - position, activity, outfit changes
	time: '#8b5cf6', // purple
	location: '#f59e0b', // amber
};

/**
 * Get the color for a character event subkind.
 */
export function getCharacterEventColor(subkind: CharacterEventSubkind): string {
	if (['appeared', 'mood_added', 'physical_state_added'].includes(subkind)) {
		return STATE_EVENT_COLORS.add;
	}
	if (['departed', 'mood_removed', 'physical_state_removed'].includes(subkind)) {
		return STATE_EVENT_COLORS.remove;
	}
	return STATE_EVENT_COLORS.change;
}

/**
 * Get the icon for a character event subkind.
 */
export function getCharacterSubkindIcon(subkind: CharacterEventSubkind): string {
	return `fa-solid ${CHARACTER_SUBKIND_ICONS[subkind] || 'fa-circle'}`;
}

/**
 * Get the icon for a state event kind.
 */
export function getStateEventKindIcon(kind: string): string {
	return `fa-solid ${STATE_EVENT_KIND_ICONS[kind] || 'fa-circle'}`;
}

/**
 * Format a subkind label for display.
 * Converts "mood_added" to "Mood Added".
 */
export function formatSubkindLabel(subkind: string): string {
	return subkind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================
// Relationship Event Icons and Colors
// ============================================

/**
 * Font Awesome icons for relationship event subkinds.
 */
export const RELATIONSHIP_SUBKIND_ICONS: Record<RelationshipEventSubkind, string> = {
	feeling_added: 'fa-heart-circle-plus',
	feeling_removed: 'fa-heart-circle-minus',
	secret_added: 'fa-user-secret',
	secret_removed: 'fa-mask',
	want_added: 'fa-star',
	want_removed: 'fa-star-half-stroke',
	status_changed: 'fa-people-arrows',
};

/**
 * Colors for relationship event subkinds.
 */
export const RELATIONSHIP_SUBKIND_COLORS: Record<RelationshipEventSubkind, string> = {
	feeling_added: '#ec4899', // pink-500
	feeling_removed: '#f472b6', // pink-400
	secret_added: '#8b5cf6', // violet-500
	secret_removed: '#a78bfa', // violet-400
	want_added: '#f59e0b', // amber-500
	want_removed: '#fbbf24', // amber-400
	status_changed: '#3b82f6', // blue-500
};

/**
 * Get the icon for a relationship event subkind.
 */
export function getRelationshipSubkindIcon(subkind: RelationshipEventSubkind): string {
	return `fa-solid ${RELATIONSHIP_SUBKIND_ICONS[subkind] || 'fa-circle'}`;
}

/**
 * Get the color for a relationship event subkind.
 */
export function getRelationshipEventColor(subkind: RelationshipEventSubkind): string {
	return RELATIONSHIP_SUBKIND_COLORS[subkind] || '#6b7280';
}
