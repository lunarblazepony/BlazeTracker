// ============================================
// Runtime State Types
// ============================================

export interface NarrativeDateTime {
	year: number;
	month: number; // 1-12
	day: number; // 1-31
	hour: number; // 0-23
	minute: number; // 0-59
	second: number; // 0-59
	dayOfWeek: string; // "Monday", "Tuesday", etc.
}

export interface TrackedState {
	time: NarrativeDateTime;
	location: LocationState;
	climate: Climate;
	scene?: Scene;
	characters: Character[];
}

export interface LocationState {
	area: string;
	place: string;
	position: string;
	props: string[];
}

export interface Climate {
	weather: 'sunny' | 'cloudy' | 'snowy' | 'rainy' | 'windy' | 'thunderstorm';
	temperature: number;
}

export interface Scene {
	topic: string;
	tone: string;
	tension: {
		level: TensionLevel;
		direction: TensionDirection;
		type: TensionType;
	};
	recentEvents: string[];
}

export type TensionLevel =
	| 'relaxed'
	| 'aware'
	| 'guarded'
	| 'tense'
	| 'charged'
	| 'volatile'
	| 'explosive';
export type TensionDirection = 'escalating' | 'stable' | 'decreasing';
export type TensionType =
	| 'confrontation'
	| 'intimate'
	| 'vulnerable'
	| 'celebratory'
	| 'negotiation'
	| 'suspense'
	| 'conversation';

export interface Character {
	name: string;
	position: string;
	activity?: string;
	goals: string[];
	mood: string[];
	physicalState?: string[];
	outfit: CharacterOutfit;
	dispositions?: Record<string, string[]>;
}

export interface CharacterOutfit {
	head: string | null;
	jacket: string | null;
	torso: string | null;
	legs: string | null;
	footwear: string | null;
	socks: string | null;
	underwear: string | null;
}

export interface StoredStateData {
	state: TrackedState;
	extractedAt: string;
}

// ============================================
// Re-exports from individual extractors
// (for backwards compatibility)
// ============================================

// Note: Individual schemas are now defined in their respective extractor modules:
// - extractTime.ts: DATETIME_SCHEMA, DELTA_SCHEMA
// - extractLocation.ts: LOCATION_SCHEMA
// - extractClimate.ts: CLIMATE_SCHEMA
// - extractCharacters.ts: CHARACTERS_SCHEMA
// - extractScene.ts: SCENE_SCHEMA
