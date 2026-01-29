/**
 * BlazeTracker State Editor
 *
 * A form-based editor for TrackedState with validation against the schema.
 * Uses ST's popup system to display.
 *
 * Only shows sections for fields that exist in the state.
 * Preserves optionality - undefined fields stays undefined.
 *
 * Also includes an event-based editor (EventStateEditor) for the new event system.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import type {
	TrackedState,
	Character,
	Climate,
	Scene,
	NarrativeDateTime,
	LocationState,
	WeatherCondition,
	StateEvent,
	UnifiedEventStore,
	ProjectedState,
} from '../types/state';
import { toDisplayTemp, toStorageTemp } from '../utils/temperatures';
import { getSettings } from '../settings';
import {
	WEATHER_OPTIONS,
	WEATHER_CONDITIONS,
	WEATHER_CONDITION_LABELS,
	BUILDING_TYPES,
	BUILDING_TYPE_LABELS,
	DAYS_OF_WEEK,
	MONTH_NAMES,
	TENSION_LEVELS,
	TENSION_DIRECTIONS,
	TENSION_TYPES,
} from './constants';
import { TagInput, OutfitEditor } from './components/form';
import { isLegacyClimate } from '../weather';
import { StateEventEditor, type StateEventEditorHandle } from './components/StateEventEditor';
import { ProjectionPreview } from './components/ProjectionPreview';
import { getStateEventsForMessage, projectStateAtMessage } from '../state/eventStore';

// --- Types ---

interface StateEditorProps {
	initialState: TrackedState | null;
	onSave: (state: TrackedState) => void;
	onCancel: () => void;
}

type ValidationErrors = Record<string, string>;

// --- Helper Functions ---

function getDaysInMonth(year: number, month: number): number {
	// Day 0 of next month = last day of this month
	return new Date(year, month, 0).getDate();
}

function getDayOfWeek(year: number, month: number, day: number): string {
	const date = new Date(year, month - 1, day);
	return DAYS_OF_WEEK[date.getDay()];
}

function createEmptyCharacter(): Character {
	return {
		name: '',
		position: '',
		activity: '',
		// Note: goals removed in v1.0.0, now tracked in CharacterArc
		mood: [],
		physicalState: [],
		outfit: {
			head: null,
			neck: null,
			jacket: null,
			back: null,
			torso: null,
			legs: null,
			socks: null,
			underwear: null,
			footwear: null,
		},
		// Note: dispositions removed in v1.0.0, now tracked in Relationship
	};
}

function createEmptyTime(): NarrativeDateTime {
	const now = new Date();
	return {
		year: now.getFullYear(),
		month: now.getMonth() + 1,
		day: now.getDate(),
		hour: 12,
		minute: 0,
		second: 0,
		dayOfWeek: DAYS_OF_WEEK[now.getDay()],
	};
}

function createEmptyLocation(): LocationState {
	return {
		area: '',
		place: '',
		position: '',
		props: [],
	};
}

function createEmptyClimate(): Climate {
	return {
		weather: 'sunny',
		temperature: 70,
	};
}

function createEmptyScene(): Scene {
	return {
		topic: '',
		tone: '',
		tension: {
			level: 'relaxed',
			direction: 'stable',
			type: 'conversation',
		},
		// Note: recentEvents removed in v1.0.0, replaced by currentEvents on TrackedState
	};
}

function cloneState(state: TrackedState): TrackedState {
	return JSON.parse(JSON.stringify(state));
}

// --- Validation ---

function validateState(state: TrackedState): ValidationErrors {
	const errors: ValidationErrors = {};

	// Scene (only validate if present)
	if (state.scene) {
		if (!state.scene.topic?.trim()) {
			errors['scene.topic'] = 'Topic is required';
		}
		if (!state.scene.tone?.trim()) {
			errors['scene.tone'] = 'Tone is required';
		}
	}

	// Time (only validate if present)
	if (state.time) {
		if (state.time.year < 1 || state.time.year > 9999) {
			errors['time.year'] = 'Year must be 1-9999';
		}
		if (state.time.month < 1 || state.time.month > 12) {
			errors['time.month'] = 'Month must be 1-12';
		}
		const maxDay = getDaysInMonth(state.time.year, state.time.month);
		if (state.time.day < 1 || state.time.day > maxDay) {
			errors['time.day'] = `Day must be 1-${maxDay}`;
		}
		if (state.time.hour < 0 || state.time.hour > 23) {
			errors['time.hour'] = 'Hour must be 0-23';
		}
		if (state.time.minute < 0 || state.time.minute > 59) {
			errors['time.minute'] = 'Minute must be 0-59';
		}
	}

	// Location (only validate if present)
	if (state.location) {
		if (!state.location.area?.trim()) {
			errors['location.area'] = 'Area is required';
		}
		if (!state.location.place?.trim()) {
			errors['location.place'] = 'Place is required';
		}
		if (!state.location.position?.trim()) {
			errors['location.position'] = 'Position is required';
		}
		if (!state.location.props?.length) {
			errors['location.props'] = 'Props is required';
		}
	}

	// Climate (only validate if present)
	if (state.climate) {
		if (isLegacyClimate(state.climate)) {
			if (
				!(WEATHER_OPTIONS as readonly string[]).includes(
					state.climate.weather,
				)
			) {
				errors['climate.weather'] = 'Invalid weather';
			}
		} else {
			if (
				!(WEATHER_CONDITIONS as readonly string[]).includes(
					state.climate.conditionType,
				)
			) {
				errors['climate.conditionType'] = 'Invalid condition type';
			}
		}
	}

	// Characters (only validate if present)
	if (state.characters) {
		state.characters.forEach((char, idx) => {
			if (!char.name?.trim()) {
				errors[`char.${idx}.name`] = 'Name required';
			}
			if (!char.position?.trim()) {
				errors[`char.${idx}.position`] = 'Position required';
			}
		});
	}

	return errors;
}

// --- Sub-Components ---

/** Character editor */
function CharacterEditor({
	character,
	index,
	onChange,
	onRemove,
	otherNames: _otherNames,
	errors,
}: {
	character: Character;
	index: number;
	onChange: (c: Character) => void;
	onRemove: () => void;
	otherNames: string[];
	errors: ValidationErrors;
}) {
	const update = <K extends keyof Character>(field: K, value: Character[K]) => {
		onChange({ ...character, [field]: value });
	};

	return (
		<div className="bt-char-editor">
			<details>
				<summary>
					<span className="bt-char-name">
						{character.name || `Character ${index + 1}`}
					</span>
					<button
						type="button"
						onClick={e => {
							e.preventDefault();
							onRemove();
						}}
						className="bt-x"
					>
						×
					</button>
				</summary>

				<div className="bt-char-fields">
					{/* Basic Info */}
					<div className="bt-row-2">
						<div className="bt-field">
							<label>Name *</label>
							<input
								type="text"
								value={character.name}
								onChange={e =>
									update(
										'name',
										e.target.value,
									)
								}
								className={
									errors[`char.${index}.name`]
										? 'bt-err'
										: ''
								}
							/>
						</div>
						<div className="bt-field">
							<label>Activity</label>
							<input
								type="text"
								value={character.activity || ''}
								onChange={e =>
									update(
										'activity',
										e.target.value ||
											undefined,
									)
								}
							/>
						</div>
					</div>

					<div className="bt-field">
						<label>Position *</label>
						<input
							type="text"
							value={character.position}
							onChange={e =>
								update('position', e.target.value)
							}
							className={
								errors[`char.${index}.position`]
									? 'bt-err'
									: ''
							}
						/>
					</div>

					{/* Tags */}
					<div className="bt-field">
						<label>Mood</label>
						<TagInput
							tags={character.mood || []}
							onChange={t => update('mood', t)}
							placeholder="anxious, hopeful..."
						/>
					</div>

					{/* Note: Goals removed in v1.0.0, now tracked in CharacterArc */}

					<div className="bt-field">
						<label>Physical State</label>
						<TagInput
							tags={character.physicalState || []}
							onChange={t => update('physicalState', t)}
							placeholder="tired, injured..."
						/>
					</div>

					{/* Outfit */}
					<div className="bt-field">
						<label>Outfit</label>
						<OutfitEditor
							outfit={character.outfit}
							onChange={o => update('outfit', o)}
						/>
					</div>

					{/* Note: Dispositions removed in v1.0.0, now tracked in Relationship */}
				</div>
			</details>
		</div>
	);
}

// --- Main Component ---

export function StateEditor({ initialState, onSave, onCancel }: StateEditorProps) {
	const settings = getSettings();
	const tempUnit = settings.temperatureUnit ?? 'fahrenheit';

	// Clone the state to avoid mutating the original
	// Keep undefined fields as undefined
	const [state, setState] = useState<TrackedState>(() =>
		initialState ? cloneState(initialState) : {},
	);
	const [errors, setErrors] = useState<ValidationErrors>({});
	const [tab, setTab] = useState<'scene' | 'chars'>('scene');

	// Check what sections exist
	const hasTime = state.time !== undefined;
	const hasLocation = state.location !== undefined;
	const hasClimate = state.climate !== undefined;
	const hasScene = state.scene !== undefined;
	const hasCharacters = state.characters !== undefined;

	// Check if there's anything to show on the scene tab
	const hasSceneTabContent = hasTime || hasLocation || hasClimate || hasScene;

	// Ensure we're on a valid tab
	useEffect(() => {
		if (tab === 'scene' && !hasSceneTabContent && hasCharacters) {
			setTab('chars');
		} else if (tab === 'chars' && !hasCharacters && hasSceneTabContent) {
			setTab('scene');
		}
	}, [tab, hasSceneTabContent, hasCharacters]);

	// Scene context
	const updateScene = (field: keyof Scene, value: any) => {
		setState(s => {
			if (!s.scene) return s;
			return {
				...s,
				scene: { ...s.scene, [field]: value },
			};
		});
	};

	const updateTension = (field: keyof Scene['tension'], value: any) => {
		setState(s => {
			if (!s.scene) return s;
			return {
				...s,
				scene: {
					...s.scene,
					tension: {
						...s.scene.tension,
						[field]: value,
					},
				},
			};
		});
	};

	// Time - with automatic dayOfWeek calculation
	const updateTime = (field: keyof NarrativeDateTime, value: any) => {
		setState(s => {
			if (!s.time) return s;
			const newTime = { ...s.time, [field]: value };

			// Recalculate dayOfWeek if date components change
			if (field === 'year' || field === 'month' || field === 'day') {
				// Clamp day to valid range for the month
				const maxDay = getDaysInMonth(newTime.year, newTime.month);
				if (newTime.day > maxDay) {
					newTime.day = maxDay;
				}
				newTime.dayOfWeek = getDayOfWeek(
					newTime.year,
					newTime.month,
					newTime.day,
				);
			}

			return { ...s, time: newTime };
		});
	};

	// Location
	const updateLocation = (field: keyof LocationState, value: string | string[]) => {
		setState(s => {
			if (!s.location) return s;
			return { ...s, location: { ...s.location, [field]: value } };
		});
	};

	// Climate (handles both legacy Climate and ProceduralClimate)
	const updateClimate = (field: string, value: any) => {
		setState(s => {
			if (!s.climate) return s;
			return {
				...s,
				climate: { ...s.climate, [field]: value },
			};
		});
	};

	// Characters
	const updateChar = (idx: number, char: Character) => {
		setState(s => {
			if (!s.characters) return s;
			return {
				...s,
				characters: s.characters.map((c, i) => (i === idx ? char : c)),
			};
		});
	};

	const addChar = () => {
		setState(s => {
			if (!s.characters) return s;
			return { ...s, characters: [...s.characters, createEmptyCharacter()] };
		});
	};

	const removeChar = (idx: number) => {
		setState(s => {
			if (!s.characters) return s;
			return { ...s, characters: s.characters.filter((_, i) => i !== idx) };
		});
	};

	const getOtherNames = (excludeIdx: number) =>
		(state.characters || [])
			.filter((_, i) => i !== excludeIdx)
			.map(c => c.name)
			.filter(Boolean);

	// Add missing sections
	const addTime = () => setState(s => ({ ...s, time: createEmptyTime() }));
	const addLocation = () => setState(s => ({ ...s, location: createEmptyLocation() }));
	const addClimate = () => setState(s => ({ ...s, climate: createEmptyClimate() }));
	const addScene = () => setState(s => ({ ...s, scene: createEmptyScene() }));
	const addCharacters = () => setState(s => ({ ...s, characters: [] }));

	// Remove sections (switch tabs if needed)
	const removeTime = () => {
		setState(s => {
			const { time: _time, ...rest } = s;
			return rest;
		});
	};
	const removeLocation = () => {
		setState(s => {
			const { location: _location, ...rest } = s;
			return rest;
		});
	};
	const removeClimate = () => {
		setState(s => {
			const { climate: _climate, ...rest } = s;
			return rest;
		});
	};
	const removeScene = () => {
		setState(s => {
			const { scene: _scene, ...rest } = s;
			return rest;
		});
	};
	const removeCharacters = () => {
		setState(s => {
			const { characters: _characters, ...rest } = s;
			return rest;
		});
		// Switch to scene tab since characters tab will be gone
		setTab('scene');
	};

	// Save
	const handleSave = () => {
		const errs = validateState(state);
		setErrors(errs);
		if (Object.keys(errs).length === 0) {
			onSave(state);
		}
	};

	const hasErrors = Object.keys(errors).length > 0;

	// Calculate max days for current month (only if time exists)
	const maxDaysInMonth =
		hasTime && state.time ? getDaysInMonth(state.time.year, state.time.month) : 31;

	// Check what sections are missing (for add buttons)
	const missingSections = {
		time: !hasTime,
		location: !hasLocation,
		climate: !hasClimate,
		scene: !hasScene,
		characters: !hasCharacters,
	};
	const hasMissingSections = Object.values(missingSections).some(v => v);

	// Component for adding missing sections
	const AddSectionButtons = () => {
		if (!hasMissingSections) return null;

		return (
			<div className="bt-add-sections">
				<span className="bt-add-sections-label">Add section:</span>
				{missingSections.scene && (
					<button
						type="button"
						onClick={addScene}
						className="bt-btn-small"
					>
						<i className="fa-solid fa-clapperboard"></i> Scene
					</button>
				)}
				{missingSections.time && (
					<button
						type="button"
						onClick={addTime}
						className="bt-btn-small"
					>
						<i className="fa-regular fa-clock"></i> Time
					</button>
				)}
				{missingSections.location && (
					<button
						type="button"
						onClick={addLocation}
						className="bt-btn-small"
					>
						<i className="fa-solid fa-map-marker-alt"></i>{' '}
						Location
					</button>
				)}
				{missingSections.climate && (
					<button
						type="button"
						onClick={addClimate}
						className="bt-btn-small"
					>
						<i className="fa-solid fa-cloud-sun"></i> Climate
					</button>
				)}
				{missingSections.characters && (
					<button
						type="button"
						onClick={addCharacters}
						className="bt-btn-small"
					>
						<i className="fa-solid fa-users"></i> Characters
					</button>
				)}
			</div>
		);
	};

	// If nothing to edit at all, show add buttons
	if (!hasSceneTabContent && !hasCharacters) {
		return (
			<div className="bt-editor">
				<div className="bt-empty-state">
					<i className="fa-solid fa-info-circle"></i>
					<p>No state data to edit.</p>
					<p>Run extraction to populate, or add sections manually:</p>
					<AddSectionButtons />
				</div>
				<div className="bt-actions">
					<button type="button" onClick={onCancel} className="bt-btn">
						Close
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="bt-editor">
			{/* Tabs */}
			<div className="bt-tabs">
				{hasSceneTabContent && (
					<button
						type="button"
						className={`bt-tab ${tab === 'scene' ? 'active' : ''}`}
						onClick={() => setTab('scene')}
					>
						<i className="fa-solid fa-location-dot"></i> Scene
					</button>
				)}
				{hasCharacters && (
					<button
						type="button"
						className={`bt-tab ${tab === 'chars' ? 'active' : ''}`}
						onClick={() => setTab('chars')}
					>
						<i className="fa-solid fa-users"></i> Characters (
						{state.characters?.length || 0})
					</button>
				)}
			</div>

			{/* Scene Tab */}
			{tab === 'scene' && hasSceneTabContent && (
				<div className="bt-panel">
					{/* Scene Context */}
					{hasScene && state.scene && (
						<fieldset className="bt-section">
							<legend>
								<i className="fa-solid fa-clapperboard"></i>{' '}
								Context
								<button
									type="button"
									className="bt-section-remove"
									onClick={removeScene}
									title="Remove section"
								>
									<i className="fa-solid fa-trash"></i>
								</button>
							</legend>
							<div className="bt-row-2">
								<div className="bt-field">
									<label>Topic *</label>
									<input
										type="text"
										value={
											state.scene
												.topic
										}
										onChange={e =>
											updateScene(
												'topic',
												e
													.target
													.value,
											)
										}
										placeholder="What's the scene about?"
										className={
											errors[
												'scene.topic'
											]
												? 'bt-err'
												: ''
										}
									/>
								</div>
								<div className="bt-field">
									<label>Tone *</label>
									<input
										type="text"
										value={
											state.scene
												.tone
										}
										onChange={e =>
											updateScene(
												'tone',
												e
													.target
													.value,
											)
										}
										placeholder="Emotional atmosphere..."
										className={
											errors[
												'scene.tone'
											]
												? 'bt-err'
												: ''
										}
									/>
								</div>
							</div>

							{/* Tension */}
							<div className="bt-row-3">
								<div className="bt-field">
									<label>Tension Level</label>
									<select
										value={
											state.scene
												.tension
												.level
										}
										onChange={e =>
											updateTension(
												'level',
												e
													.target
													.value,
											)
										}
									>
										{TENSION_LEVELS.map(
											l => (
												<option
													key={
														l
													}
													value={
														l
													}
												>
													{l
														.charAt(
															0,
														)
														.toUpperCase() +
														l.slice(
															1,
														)}
												</option>
											),
										)}
									</select>
								</div>
								<div className="bt-field">
									<label>Direction</label>
									<select
										value={
											state.scene
												.tension
												.direction
										}
										onChange={e =>
											updateTension(
												'direction',
												e
													.target
													.value,
											)
										}
									>
										{TENSION_DIRECTIONS.map(
											d => (
												<option
													key={
														d
													}
													value={
														d
													}
												>
													{d
														.charAt(
															0,
														)
														.toUpperCase() +
														d.slice(
															1,
														)}
												</option>
											),
										)}
									</select>
								</div>
								<div className="bt-field">
									<label>Type</label>
									<select
										value={
											state.scene
												.tension
												.type
										}
										onChange={e =>
											updateTension(
												'type',
												e
													.target
													.value,
											)
										}
									>
										{TENSION_TYPES.map(
											t => (
												<option
													key={
														t
													}
													value={
														t
													}
												>
													{t
														.charAt(
															0,
														)
														.toUpperCase() +
														t.slice(
															1,
														)}
												</option>
											),
										)}
									</select>
								</div>
							</div>

							{/* Note: Recent Events removed in v1.0.0, replaced by currentEvents on TrackedState */}
						</fieldset>
					)}

					{/* Time */}
					{hasTime && state.time && (
						<fieldset className="bt-section">
							<legend>
								<i className="fa-regular fa-clock"></i>{' '}
								Time
								<button
									type="button"
									className="bt-section-remove"
									onClick={removeTime}
									title="Remove section"
								>
									<i className="fa-solid fa-trash"></i>
								</button>
							</legend>
							{/* Date row */}
							<div className="bt-row-3">
								<div className="bt-field">
									<label>Year</label>
									<input
										type="number"
										min={1}
										max={9999}
										value={
											state.time
												.year
										}
										onChange={e =>
											updateTime(
												'year',
												parseInt(
													e
														.target
														.value,
												) ||
													2024,
											)
										}
										className={
											errors[
												'time.year'
											]
												? 'bt-err'
												: ''
										}
									/>
								</div>
								<div className="bt-field">
									<label>Month</label>
									<select
										value={
											state.time
												.month
										}
										onChange={e =>
											updateTime(
												'month',
												parseInt(
													e
														.target
														.value,
												),
											)
										}
										className={
											errors[
												'time.month'
											]
												? 'bt-err'
												: ''
										}
									>
										{MONTH_NAMES.map(
											(
												name,
												idx,
											) => (
												<option
													key={
														idx
													}
													value={
														idx +
														1
													}
												>
													{
														name
													}
												</option>
											),
										)}
									</select>
								</div>
								<div className="bt-field">
									<label>Day</label>
									<input
										type="number"
										min={1}
										max={maxDaysInMonth}
										value={
											state.time
												.day
										}
										onChange={e =>
											updateTime(
												'day',
												parseInt(
													e
														.target
														.value,
												) ||
													1,
											)
										}
										className={
											errors[
												'time.day'
											]
												? 'bt-err'
												: ''
										}
									/>
								</div>
							</div>

							{/* Time row */}
							<div className="bt-row-3">
								<div className="bt-field">
									<label>Hour (0-23)</label>
									<input
										type="number"
										min={0}
										max={23}
										value={
											state.time
												.hour
										}
										onChange={e =>
											updateTime(
												'hour',
												parseInt(
													e
														.target
														.value,
												) ||
													0,
											)
										}
										className={
											errors[
												'time.hour'
											]
												? 'bt-err'
												: ''
										}
									/>
								</div>
								<div className="bt-field">
									<label>Minute</label>
									<input
										type="number"
										min={0}
										max={59}
										value={
											state.time
												.minute
										}
										onChange={e =>
											updateTime(
												'minute',
												parseInt(
													e
														.target
														.value,
												) ||
													0,
											)
										}
										className={
											errors[
												'time.minute'
											]
												? 'bt-err'
												: ''
										}
									/>
								</div>
								<div className="bt-field">
									<label>Day of Week</label>
									<input
										type="text"
										value={
											state.time
												.dayOfWeek
										}
										disabled
										style={{
											opacity: 0.7,
											cursor: 'not-allowed',
										}}
									/>
								</div>
							</div>
						</fieldset>
					)}

					{/* Location */}
					{hasLocation && state.location && (
						<fieldset className="bt-section">
							<legend>
								<i className="fa-solid fa-map-marker-alt"></i>{' '}
								Location
								<button
									type="button"
									className="bt-section-remove"
									onClick={removeLocation}
									title="Remove section"
								>
									<i className="fa-solid fa-trash"></i>
								</button>
							</legend>
							<div className="bt-field">
								<label>Area *</label>
								<input
									type="text"
									value={state.location.area}
									onChange={e =>
										updateLocation(
											'area',
											e.target
												.value,
										)
									}
									placeholder="City, district, region..."
									className={
										errors[
											'location.area'
										]
											? 'bt-err'
											: ''
									}
								/>
							</div>
							<div className="bt-field">
								<label>Place *</label>
								<input
									type="text"
									value={state.location.place}
									onChange={e =>
										updateLocation(
											'place',
											e.target
												.value,
										)
									}
									placeholder="Building, establishment, room..."
									className={
										errors[
											'location.place'
										]
											? 'bt-err'
											: ''
									}
								/>
							</div>
							<div className="bt-field">
								<label>Position *</label>
								<input
									type="text"
									value={
										state.location
											.position
									}
									onChange={e =>
										updateLocation(
											'position',
											e.target
												.value,
										)
									}
									placeholder="Position within the place..."
									className={
										errors[
											'location.position'
										]
											? 'bt-err'
											: ''
									}
								/>
							</div>
							<div className="bt-field">
								<label>Props</label>
								<TagInput
									tags={
										state.location
											.props || []
									}
									onChange={t =>
										updateLocation(
											'props',
											t,
										)
									}
									placeholder="Add props..."
								/>
							</div>
						</fieldset>
					)}

					{/* Climate */}
					{hasClimate && state.climate && (
						<fieldset className="bt-section">
							<legend>
								<i className="fa-solid fa-cloud-sun"></i>{' '}
								Climate
								<button
									type="button"
									className="bt-section-remove"
									onClick={removeClimate}
									title="Remove section"
								>
									<i className="fa-solid fa-trash"></i>
								</button>
							</legend>
							{isLegacyClimate(state.climate) ? (
								/* Legacy Climate Editor */
								<div className="bt-row-2">
									<div className="bt-field">
										<label>
											Weather
										</label>
										<select
											value={
												state
													.climate
													.weather
											}
											onChange={e =>
												updateClimate(
													'weather',
													e
														.target
														.value as Climate['weather'],
												)
											}
										>
											{WEATHER_OPTIONS.map(
												w => (
													<option
														key={
															w
														}
														value={
															w
														}
													>
														{w
															.charAt(
																0,
															)
															.toUpperCase() +
															w.slice(
																1,
															)}
													</option>
												),
											)}
										</select>
									</div>
									<div className="bt-field">
										<label>
											Temperature
											(
											{tempUnit ===
											'celsius'
												? '°C'
												: '°F'}
											)
										</label>
										<input
											type="number"
											value={toDisplayTemp(
												state
													.climate
													.temperature,
												tempUnit,
											)}
											onChange={e =>
												updateClimate(
													'temperature',
													toStorageTemp(
														parseInt(
															e
																.target
																.value,
														) ||
															0,
														tempUnit,
													),
												)
											}
										/>
									</div>
								</div>
							) : (
								/* Procedural Climate Editor */
								<>
									<div className="bt-row-2">
										<div className="bt-field">
											<label>
												Condition
											</label>
											<select
												value={
													state
														.climate
														.conditionType
												}
												onChange={e =>
													updateClimate(
														'conditionType',
														e
															.target
															.value as WeatherCondition,
													)
												}
											>
												{WEATHER_CONDITIONS.map(
													c => (
														<option
															key={
																c
															}
															value={
																c
															}
														>
															{
																WEATHER_CONDITION_LABELS[
																	c
																]
															}
														</option>
													),
												)}
											</select>
										</div>
										<div className="bt-field">
											<label>
												Temperature
												(
												{tempUnit ===
												'celsius'
													? '°C'
													: '°F'}
												)
											</label>
											<input
												type="number"
												value={toDisplayTemp(
													state
														.climate
														.temperature,
													tempUnit,
												)}
												onChange={e =>
													updateClimate(
														'temperature',
														toStorageTemp(
															parseInt(
																e
																	.target
																	.value,
															) ||
																0,
															tempUnit,
														),
													)
												}
											/>
										</div>
									</div>
									<div className="bt-row-2">
										<div className="bt-field">
											<label>
												Humidity
												(%)
											</label>
											<input
												type="number"
												min="0"
												max="100"
												value={
													state
														.climate
														.humidity
												}
												onChange={e =>
													updateClimate(
														'humidity',
														parseInt(
															e
																.target
																.value,
														) ||
															0,
													)
												}
											/>
										</div>
										<div className="bt-field">
											<label>
												Wind
												Speed
												(mph)
											</label>
											<input
												type="number"
												min="0"
												value={
													state
														.climate
														.windSpeed
												}
												onChange={e =>
													updateClimate(
														'windSpeed',
														parseInt(
															e
																.target
																.value,
														) ||
															0,
													)
												}
											/>
										</div>
									</div>
									<div className="bt-row-2">
										<div className="bt-field">
											<label>
												Cloud
												Cover
												(%)
											</label>
											<input
												type="number"
												min="0"
												max="100"
												value={
													state
														.climate
														.cloudCover
												}
												onChange={e =>
													updateClimate(
														'cloudCover',
														parseInt(
															e
																.target
																.value,
														) ||
															0,
													)
												}
											/>
										</div>
										<div className="bt-field">
											<label>
												Indoors
											</label>
											<select
												value={
													state
														.climate
														.isIndoors
														? 'yes'
														: 'no'
												}
												onChange={e =>
													updateClimate(
														'isIndoors',
														e
															.target
															.value ===
															'yes',
													)
												}
											>
												<option value="no">
													No
													(Outdoors)
												</option>
												<option value="yes">
													Yes
													(Indoors)
												</option>
											</select>
										</div>
									</div>
									{state.climate
										.isIndoors && (
										<div className="bt-row-2">
											<div className="bt-field">
												<label>
													Building
													Type
												</label>
												<select
													value={
														state
															.climate
															.buildingType ??
														'modern'
													}
													onChange={e =>
														updateClimate(
															'buildingType',
															e
																.target
																.value,
														)
													}
												>
													{BUILDING_TYPES.map(
														b => (
															<option
																key={
																	b
																}
																value={
																	b
																}
															>
																{
																	BUILDING_TYPE_LABELS[
																		b
																	]
																}
															</option>
														),
													)}
												</select>
											</div>
											<div className="bt-field">
												<label>
													Indoor
													Temp
													(
													{tempUnit ===
													'celsius'
														? '°C'
														: '°F'}

													)
												</label>
												<input
													type="number"
													value={toDisplayTemp(
														state
															.climate
															.indoorTemperature ??
															state
																.climate
																.temperature,
														tempUnit,
													)}
													onChange={e =>
														updateClimate(
															'indoorTemperature',
															toStorageTemp(
																parseInt(
																	e
																		.target
																		.value,
																) ||
																	0,
																tempUnit,
															),
														)
													}
												/>
											</div>
										</div>
									)}
								</>
							)}
						</fieldset>
					)}

					{/* Add section buttons for scene tab */}
					{(missingSections.scene ||
						missingSections.time ||
						missingSections.location ||
						missingSections.climate) && (
						<div className="bt-add-sections">
							<span className="bt-add-sections-label">
								Add:
							</span>
							{missingSections.scene && (
								<button
									type="button"
									onClick={addScene}
									className="bt-btn-small"
								>
									<i className="fa-solid fa-clapperboard"></i>{' '}
									Scene
								</button>
							)}
							{missingSections.time && (
								<button
									type="button"
									onClick={addTime}
									className="bt-btn-small"
								>
									<i className="fa-regular fa-clock"></i>{' '}
									Time
								</button>
							)}
							{missingSections.location && (
								<button
									type="button"
									onClick={addLocation}
									className="bt-btn-small"
								>
									<i className="fa-solid fa-map-marker-alt"></i>{' '}
									Location
								</button>
							)}
							{missingSections.climate && (
								<button
									type="button"
									onClick={addClimate}
									className="bt-btn-small"
								>
									<i className="fa-solid fa-cloud-sun"></i>{' '}
									Climate
								</button>
							)}
						</div>
					)}
				</div>
			)}

			{/* Characters Tab */}
			{tab === 'chars' && hasCharacters && state.characters && (
				<div className="bt-panel">
					<div className="bt-section-header">
						<span>Characters</span>
						<button
							type="button"
							className="bt-section-remove"
							onClick={removeCharacters}
							title="Remove all characters"
						>
							<i className="fa-solid fa-trash"></i> Remove
							Section
						</button>
					</div>
					<div className="bt-chars-list">
						{state.characters.map((char, idx) => (
							<CharacterEditor
								key={idx}
								character={char}
								index={idx}
								onChange={c => updateChar(idx, c)}
								onRemove={() => removeChar(idx)}
								otherNames={getOtherNames(idx)}
								errors={errors}
							/>
						))}
					</div>
					<button
						type="button"
						onClick={addChar}
						className="bt-add-char"
					>
						<i className="fa-solid fa-plus"></i> Add Character
					</button>
				</div>
			)}

			{/* Show characters add button if on scene tab but no characters */}
			{tab === 'scene' && missingSections.characters && (
				<div
					className="bt-add-sections"
					style={{
						marginTop: '1rem',
						borderTop: '1px solid var(--SmartThemeBorderColor)',
						paddingTop: '1rem',
					}}
				>
					<span className="bt-add-sections-label">Add:</span>
					<button
						type="button"
						onClick={() => {
							addCharacters();
							setTab('chars');
						}}
						className="bt-btn-small"
					>
						<i className="fa-solid fa-users"></i> Characters
					</button>
				</div>
			)}

			{/* Error summary */}
			{hasErrors && (
				<div className="bt-errors">
					<i className="fa-solid fa-exclamation-triangle"></i>
					Fix highlighted errors before saving.
				</div>
			)}

			{/* Actions */}
			<div className="bt-actions">
				<button type="button" onClick={onCancel} className="bt-btn">
					Cancel
				</button>
				<button
					type="button"
					onClick={handleSave}
					className="bt-btn bt-btn-primary"
				>
					<i className="fa-solid fa-save"></i> Save
				</button>
			</div>
		</div>
	);
}

// --- Integration with SillyTavern Popup ---

/**
 * Opens the state editor in a popup dialog.
 * Returns true if saved, false if cancelled.
 */
export async function openStateEditor(
	currentState: TrackedState | null,
	onSave: (state: TrackedState) => Promise<void>,
): Promise<boolean> {
	// Load CSS if not already loaded
	const cssUrl = new URL('./stateEditor.css', import.meta.url).href;
	if (!document.querySelector(`link[href="${cssUrl}"]`)) {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = cssUrl;
		document.head.appendChild(link);
	}

	const context = SillyTavern.getContext();

	return new Promise(resolve => {
		// Create container
		const container = document.createElement('div');
		container.id = 'bt-editor-root';

		let savedState: TrackedState | null = null;

		const handleSave = (state: TrackedState) => {
			savedState = state;
			// Close popup by clicking OK
			(document.querySelector('.popup-button-ok') as HTMLElement)?.click();
		};

		const handleCancel = () => {
			(document.querySelector('.popup-button-cancel') as HTMLElement)?.click();
		};

		// Use imported ReactDOM, not window.ReactDOM
		const root = ReactDOM.createRoot(container);

		root.render(
			<StateEditor
				initialState={currentState}
				onSave={handleSave}
				onCancel={handleCancel}
			/>,
		);

		// Show popup
		context.callGenericPopup(container, context.POPUP_TYPE.CONFIRM, null, {
			wide: true,
			large: true,
			okButton: '', // Hidden
			cancelButton: 'Close',
		}).then(async () => {
			root.unmount();

			if (savedState) {
				await onSave(savedState);
				resolve(true);
			} else {
				resolve(false);
			}
		});

		// Hide default OK button
		requestAnimationFrame(() => {
			const okBtn = document.querySelector('.popup-button-ok') as HTMLElement;
			if (okBtn) okBtn.style.display = 'none';
		});
	});
}

export default StateEditor;

// ============================================
// Event-Based State Editor (Split-Pane)
// ============================================

interface EventStateEditorProps {
	store: UnifiedEventStore;
	messageId: number;
	swipeId: number;
	chat?: { swipe_id?: number }[];
	onSave: (events: StateEvent[]) => void;
	onCancel: () => void;
}

/**
 * Event-based state editor with split-pane layout.
 * Left pane: Edit events for this message
 * Right pane: Live projection preview
 */
export function EventStateEditor({
	store,
	messageId,
	swipeId,
	chat,
	onSave,
	onCancel,
}: EventStateEditorProps) {
	// Get events for this message
	const initialEvents = useMemo(
		() => getStateEventsForMessage(store, messageId, swipeId),
		[store, messageId, swipeId],
	);

	const [events, setEvents] = useState<StateEvent[]>(initialEvents);

	// Ref to StateEventEditor for committing pending edits
	const stateEventEditorRef = useRef<StateEventEditorHandle>(null);

	// Compute live projection from all events up to and including this message
	const projection = useMemo((): ProjectedState => {
		// Create a temp store with all prior events plus our edited events for this message
		const tempStore: UnifiedEventStore = {
			...store,
			stateEvents: [
				// Include all events before this message (or for other swipes of this message)
				...store.stateEvents.filter(
					e =>
						!e.deleted &&
						(e.messageId < messageId ||
							(e.messageId === messageId &&
								e.swipeId !== swipeId)),
				),
				// Plus our edited events for this message
				...events,
			],
		};

		return projectStateAtMessage(tempStore, messageId, swipeId, chat ?? []);
	}, [store, messageId, swipeId, events, chat]);

	const handleSave = () => {
		// Commit any pending inline edits before saving
		const finalEvents = stateEventEditorRef.current?.commitPendingEdits() ?? events;
		onSave(finalEvents);
	};

	const hasEvents = events.length > 0;
	const hasProjection =
		projection.time || projection.location || projection.characters.size > 0;

	return (
		<div className="bt-editor bt-event-editor-container">
			<div className="bt-split-editor">
				{/* Left pane - Event editor */}
				<div className="bt-events-pane">
					<h3>
						<i className="fa-solid fa-list"></i> Events for
						Message #{messageId}
					</h3>
					<StateEventEditor
						ref={stateEventEditorRef}
						events={events}
						messageId={messageId}
						swipeId={swipeId}
						onEventsChange={setEvents}
						projection={projection}
					/>
					{!hasEvents && (
						<div className="bt-empty-events">
							<i className="fa-solid fa-info-circle"></i>
							<p>No events for this message.</p>
							<p>
								Click "Add Event" to create time,
								location, or character events.
							</p>
						</div>
					)}
				</div>

				{/* Right pane - Projection preview */}
				<div className="bt-projection-pane">
					<h3>
						<i className="fa-solid fa-eye"></i> State Preview
					</h3>
					{hasProjection ? (
						<ProjectionPreview projection={projection} />
					) : (
						<div className="bt-empty-projection">
							<i className="fa-solid fa-ghost"></i>
							<p>No state data.</p>
							<p>
								Add events to see the projected
								state.
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Actions */}
			<div className="bt-actions">
				<button type="button" onClick={onCancel} className="bt-btn">
					Cancel
				</button>
				<button
					type="button"
					onClick={handleSave}
					className="bt-btn bt-btn-primary"
				>
					<i className="fa-solid fa-save"></i> Save
				</button>
			</div>
		</div>
	);
}

/**
 * Opens the event-based state editor in a popup dialog.
 * Returns the edited events if saved, null if cancelled.
 */
export async function openEventStateEditor(
	store: UnifiedEventStore,
	messageId: number,
	swipeId: number,
	onSave: (events: StateEvent[]) => Promise<void>,
): Promise<boolean> {
	// Load CSS if not already loaded
	const cssUrl = new URL('./stateEditor.css', import.meta.url).href;
	if (!document.querySelector(`link[href="${cssUrl}"]`)) {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = cssUrl;
		document.head.appendChild(link);
	}

	const context = SillyTavern.getContext();

	return new Promise(resolve => {
		// Create container
		const container = document.createElement('div');
		container.id = 'bt-event-editor-root';

		let savedEvents: StateEvent[] | null = null;

		const handleSave = (events: StateEvent[]) => {
			savedEvents = events;
			// Close popup by clicking OK
			(document.querySelector('.popup-button-ok') as HTMLElement)?.click();
		};

		const handleCancel = () => {
			(document.querySelector('.popup-button-cancel') as HTMLElement)?.click();
		};

		const root = ReactDOM.createRoot(container);

		root.render(
			<EventStateEditor
				store={store}
				messageId={messageId}
				swipeId={swipeId}
				chat={context.chat}
				onSave={handleSave}
				onCancel={handleCancel}
			/>,
		);

		// Show popup
		context.callGenericPopup(container, context.POPUP_TYPE.CONFIRM, null, {
			wide: true,
			large: true,
			okButton: '', // Hidden
			cancelButton: 'Close',
		}).then(async () => {
			root.unmount();

			if (savedEvents) {
				await onSave(savedEvents);
				resolve(true);
			} else {
				resolve(false);
			}
		});

		// Hide default OK button
		requestAnimationFrame(() => {
			const okBtn = document.querySelector('.popup-button-ok') as HTMLElement;
			if (okBtn) okBtn.style.display = 'none';
		});
	});
}
