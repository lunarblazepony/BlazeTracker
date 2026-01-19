/**
 * BlazeTracker State Editor
 *
 * A form-based editor for TrackedState with validation against the schema.
 * Uses ST's popup system to display.
 */

import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import type { TrackedState, Character, CharacterOutfit, Climate, Scene, NarrativeDateTime } from '../types/state';

// --- Constants from Schema ---

const WEATHER_OPTIONS = ['sunny', 'cloudy', 'snowy', 'rainy', 'windy', 'thunderstorm'] as const;
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;
const OUTFIT_SLOTS = ['head', 'jacket', 'torso', 'legs', 'underwear', 'socks', 'footwear'] as const;

const TENSION_LEVELS = ['relaxed', 'aware', 'guarded', 'tense', 'charged', 'volatile', 'explosive'] as const;
const TENSION_DIRECTIONS = ['escalating', 'stable', 'decreasing'] as const;
const TENSION_TYPES = ['confrontation', 'intimate', 'vulnerable', 'celebratory', 'negotiation', 'suspense', 'conversation'] as const;

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

function createEmptyScene(): Scene {
  return {
    topic: '',
    tone: '',
    tension: { level: 'relaxed', direction: 'stable', type: 'conversation' },
    recentEvents: []
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

function createEmptyState(): TrackedState {
  return {
    time: createEmptyTime(),
    location: { area: '', place: '', position: '', props: [] },
    climate: { weather: 'sunny', temperature: 70 },
    scene: createEmptyScene(),
    characters: [],
  };
}

function createEmptyCharacter(): Character {
  return {
    name: '',
    position: '',
    activity: '',
    goals: [],
    mood: [],
    physicalState: [],
    outfit: {
      head: null,
      jacket: null,
      torso: null,
      legs: null,
      socks: null,
      underwear: null,
      footwear: null,
    },
    dispositions: {},
  };
}

function cloneState(state: TrackedState): TrackedState {
  return JSON.parse(JSON.stringify(state));
}

// --- Validation ---

function validateState(state: TrackedState): ValidationErrors {
  const errors: ValidationErrors = {};

  // Scene
  if (!state.scene?.topic?.trim()) {
    errors['scene.topic'] = 'Topic is required';
  }
  if (!state.scene?.tone?.trim()) {
    errors['scene.tone'] = 'Tone is required';
  }

  // Time
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

  // Location
  if (!state.location.area?.trim()) {
    errors['location.area'] = 'Area is required';
  }
  if (!state.location.place?.trim()) {
    errors['location.place'] = 'Place is required';
  }
  if (!state.location.position?.trim()) {
    errors['location.position'] = 'Position is required';
  }
  if (!state.location.props.length) {
    errors['location.props'] = 'Props is required';
  }

  // Climate
  if (state.climate) {
    if (!WEATHER_OPTIONS.includes(state.climate.weather as any)) {
      errors['climate.weather'] = 'Invalid weather';
    }
  }

  // Characters
  state.characters.forEach((char, idx) => {
    if (!char.name?.trim()) {
      errors[`char.${idx}.name`] = 'Name required';
    }
    if (!char.position?.trim()) {
      errors[`char.${idx}.position`] = 'Position required';
    }
  });

  return errors;
}

// --- Sub-Components ---

/** Tag input for arrays of strings (mood, physicalState, etc.) */
function TagInput({
  tags,
  onChange,
  placeholder = 'Add...'
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="bt-tag-input">
      <div className="bt-tags">
        {tags.map(tag => (
          <span key={tag} className="bt-tag">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="bt-tag-x">×</button>
          </span>
        ))}
      </div>
      <div className="bt-tag-add">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
          placeholder={placeholder}
        />
        <button type="button" onClick={addTag}>+</button>
      </div>
    </div>
  );
}

/** Event list editor - similar to TagInput but for longer items */
function EventListEditor({
  events,
  onChange,
}: {
  events: string[];
  onChange: (events: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const addEvent = () => {
    const trimmed = input.trim();
    if (trimmed && !events.includes(trimmed)) {
      onChange([...events, trimmed]);
      setInput('');
    }
  };

  const removeEvent = (idx: number) => {
    onChange(events.filter((_, i) => i !== idx));
  };

  return (
    <div className="bt-event-list">
      {events.map((event, idx) => (
        <div key={idx} className="bt-event-item">
          <span className="bt-event-text">{event}</span>
          <button type="button" onClick={() => removeEvent(idx)} className="bt-x">×</button>
        </div>
      ))}
      <div className="bt-event-add">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEvent())}
          placeholder="Add recent event..."
        />
        <button type="button" onClick={addEvent}>+</button>
      </div>
      {events.length >= 5 && (
        <div className="bt-event-hint">Max 5 events recommended</div>
      )}
    </div>
  );
}

/** Outfit editor with nullable slots */
function OutfitEditor({
  outfit,
  onChange
}: {
  outfit: CharacterOutfit;
  onChange: (o: CharacterOutfit) => void;
}) {
  const update = (slot: keyof CharacterOutfit, value: string | null) => {
    onChange({ ...outfit, [slot]: value || null });
  };

  return (
    <div className="bt-outfit-grid">
      {OUTFIT_SLOTS.map(slot => (
        <div key={slot} className="bt-outfit-slot">
          <label>{slot}</label>
          <div className="bt-outfit-row">
            <input
              type="text"
              value={outfit[slot] || ''}
              onChange={e => update(slot, e.target.value)}
              placeholder="None"
            />
            {outfit[slot] && (
              <button type="button" onClick={() => update(slot, null)} className="bt-x">×</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dispositions editor - dynamic key-value pairs */
function DispositionsEditor({
  dispositions,
  onChange,
  otherNames
}: {
  dispositions: Record<string, string[]>;
  onChange: (d: Record<string, string[]>) => void;
  otherNames: string[];
}) {
  const [newTarget, setNewTarget] = useState('');

  const addTarget = () => {
    const target = newTarget.trim();
    if (target && !(target in dispositions)) {
      onChange({ ...dispositions, [target]: [] });
      setNewTarget('');
    }
  };

  const updateFeelings = (target: string, feelings: string[]) => {
    onChange({ ...dispositions, [target]: feelings });
  };

  const removeTarget = (target: string) => {
    const { [target]: _, ...rest } = dispositions;
    onChange(rest);
  };

  return (
    <div className="bt-dispositions">
      {Object.entries(dispositions).map(([target, feelings]) => (
        <div key={target} className="bt-disposition">
          <div className="bt-disposition-header">
            <span>→ {target}</span>
            <button type="button" onClick={() => removeTarget(target)} className="bt-x-red">
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
          <TagInput
            tags={feelings}
            onChange={f => updateFeelings(target, f)}
            placeholder="Add feeling..."
          />
        </div>
      ))}
      <div className="bt-add-row">
        <select value={newTarget} onChange={e => setNewTarget(e.target.value)}>
          <option value="">+ Add disposition...</option>
          {otherNames.filter(n => !(n in dispositions)).map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <input
          type="text"
          value={newTarget}
          onChange={e => setNewTarget(e.target.value)}
          placeholder="Or type name..."
        />
        <button type="button" onClick={addTarget} disabled={!newTarget.trim()}>Add</button>
      </div>
    </div>
  );
}

/** Single character editor */
function CharacterEditor({
  character,
  index,
  onChange,
  onRemove,
  otherNames,
  errors,
}: {
  character: Character;
  index: number;
  onChange: (c: Character) => void;
  onRemove: () => void;
  otherNames: string[];
  errors: ValidationErrors;
}) {
  const [expanded, setExpanded] = useState(true);
  const prefix = `char.${index}`;

  const update = <K extends keyof Character>(field: K, value: Character[K]) => {
    onChange({ ...character, [field]: value });
  };

  return (
    <div className="bt-char-card">
      <div className="bt-char-header" onClick={() => setExpanded(!expanded)}>
        <i className={`fa-solid fa-chevron-${expanded ? 'down' : 'right'}`}></i>
        <span className="bt-char-name">{character.name || `Character ${index + 1}`}</span>
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} className="bt-x-red">
          <i className="fa-solid fa-trash"></i>
        </button>
      </div>

      {expanded && (
        <div className="bt-char-body">
          <div className="bt-field">
            <label>Name *</label>
            <input
              type="text"
              value={character.name}
              onChange={e => update('name', e.target.value)}
              className={errors[`${prefix}.name`] ? 'bt-err' : ''}
            />
          </div>

          <div className="bt-field">
            <label>Position *</label>
            <textarea
              value={character.position}
              onChange={e => update('position', e.target.value)}
              rows={2}
              placeholder="Physical position and orientation..."
              className={errors[`${prefix}.position`] ? 'bt-err' : ''}
            />
          </div>

          <div className="bt-field">
            <label>Activity</label>
            <input
              type="text"
              value={character.activity || ''}
              onChange={e => update('activity', e.target.value)}
              placeholder="Current activity..."
            />
          </div>

          <div className="bt-field">
            <label>Mood</label>
            <TagInput
              tags={character.mood || []}
              onChange={t => update('mood', t)}
              placeholder="Add mood..."
            />
          </div>

          <div className="bt-field">
            <label>Goals</label>
            <TagInput
              tags={character.goals || []}
              onChange={t => update('goals', t)}
              placeholder="Add goal..."
            />
          </div>

          <div className="bt-field">
            <label>Physical State</label>
            <TagInput
              tags={character.physicalState || []}
              onChange={t => update('physicalState', t)}
              placeholder="Add state..."
            />
          </div>

          <details className="bt-details" open>
            <summary>Outfit</summary>
            <OutfitEditor
              outfit={character.outfit || createEmptyCharacter().outfit}
              onChange={o => update('outfit', o)}
            />
          </details>

          <details className="bt-details">
            <summary>Dispositions ({Object.keys(character.dispositions || {}).length})</summary>
            <DispositionsEditor
              dispositions={character.dispositions || {}}
              onChange={d => update('dispositions', d)}
              otherNames={otherNames}
            />
          </details>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export function StateEditor({ initialState, onSave, onCancel }: StateEditorProps) {
  const [state, setState] = useState<TrackedState>(() =>
    initialState ? cloneState(initialState) : createEmptyState()
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [tab, setTab] = useState<'scene' | 'chars'>('scene');

  // Scene context
  const updateScene = (field: keyof Scene, value: any) => {
    setState(s => ({
      ...s,
      scene: { ...(s.scene || createEmptyScene()), [field]: value }
    }));
  };

  const updateTension = (field: keyof Scene['tension'], value: any) => {
    setState(s => ({
      ...s,
      scene: {
        ...(s.scene || createEmptyScene()),
        tension: { ...(s.scene?.tension || createEmptyScene().tension), [field]: value }
      }
    }));
  };

  // Time - with automatic dayOfWeek calculation
  const updateTime = (field: keyof NarrativeDateTime, value: any) => {
    setState(s => {
      const newTime = { ...s.time, [field]: value };

      // Recalculate dayOfWeek if date components change
      if (field === 'year' || field === 'month' || field === 'day') {
        // Clamp day to valid range for the month
        const maxDay = getDaysInMonth(newTime.year, newTime.month);
        if (newTime.day > maxDay) {
          newTime.day = maxDay;
        }
        newTime.dayOfWeek = getDayOfWeek(newTime.year, newTime.month, newTime.day);
      }

      return { ...s, time: newTime };
    });
  };

  // Location
  const updateLocation = (field: keyof TrackedState['location'], value: string | string[]) => {
    setState(s => ({ ...s, location: { ...s.location, [field]: value } }));
  };

  // Climate
  const updateClimate = (field: keyof Climate, value: any) => {
    setState(s => ({
      ...s,
      climate: { ...(s.climate || { weather: 'sunny', temperature: 70 }), [field]: value }
    }));
  };

  // Characters
  const updateChar = (idx: number, char: Character) => {
    setState(s => ({
      ...s,
      characters: s.characters.map((c, i) => i === idx ? char : c)
    }));
  };

  const addChar = () => {
    setState(s => ({ ...s, characters: [...s.characters, createEmptyCharacter()] }));
  };

  const removeChar = (idx: number) => {
    setState(s => ({ ...s, characters: s.characters.filter((_, i) => i !== idx) }));
  };

  const getOtherNames = (excludeIdx: number) =>
    state.characters.filter((_, i) => i !== excludeIdx).map(c => c.name).filter(Boolean);

  // Save
  const handleSave = () => {
    const errs = validateState(state);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSave(state);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  // Calculate max days for current month
  const maxDaysInMonth = getDaysInMonth(state.time.year, state.time.month);

  return (
    <div className="bt-editor">
      {/* Tabs */}
      <div className="bt-tabs">
        <button
          type="button"
          className={`bt-tab ${tab === 'scene' ? 'active' : ''}`}
          onClick={() => setTab('scene')}
        >
          <i className="fa-solid fa-location-dot"></i> Scene
        </button>
        <button
          type="button"
          className={`bt-tab ${tab === 'chars' ? 'active' : ''}`}
          onClick={() => setTab('chars')}
        >
          <i className="fa-solid fa-users"></i> Characters ({state.characters.length})
        </button>
      </div>

      {/* Scene Tab */}
      {tab === 'scene' && (
        <div className="bt-panel">
          {/* Scene Context (NEW) */}
          <fieldset className="bt-section">
            <legend><i className="fa-solid fa-clapperboard"></i> Context</legend>
            <div className="bt-row-2">
              <div className="bt-field">
                <label>Topic *</label>
                <input
                  type="text"
                  value={state.scene?.topic || ''}
                  onChange={e => updateScene('topic', e.target.value)}
                  placeholder="3-5 words: main topic of interaction"
                  className={errors['scene.topic'] ? 'bt-err' : ''}
                />
              </div>
              <div className="bt-field">
                <label>Tone *</label>
                <input
                  type="text"
                  value={state.scene?.tone || ''}
                  onChange={e => updateScene('tone', e.target.value)}
                  placeholder="2-3 words: emotional tone"
                  className={errors['scene.tone'] ? 'bt-err' : ''}
                />
              </div>
            </div>
            <div className="bt-row-3">
              <div className="bt-field">
                <label>Tension Type</label>
                <select
                  value={state.scene?.tension?.type || 'conversation'}
                  onChange={e => updateTension('type', e.target.value)}
                >
                  {TENSION_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="bt-field">
                <label>Tension Level</label>
                <select
                  value={state.scene?.tension?.level || 'relaxed'}
                  onChange={e => updateTension('level', e.target.value)}
                >
                  {TENSION_LEVELS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="bt-field">
                <label>Direction</label>
                <select
                  value={state.scene?.tension?.direction || 'stable'}
                  onChange={e => updateTension('direction', e.target.value)}
                >
                  {TENSION_DIRECTIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bt-field">
              <label>Recent Events</label>
              <EventListEditor
                events={state.scene?.recentEvents || []}
                onChange={events => updateScene('recentEvents', events)}
              />
            </div>
          </fieldset>

          {/* Date & Time */}
          <fieldset className="bt-section">
            <legend><i className="fa-solid fa-calendar-clock"></i> Date &amp; Time</legend>

            {/* Date row */}
            <div className="bt-row-3">
              <div className="bt-field">
                <label>Year</label>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={state.time.year}
                  onChange={e => updateTime('year', parseInt(e.target.value) || 2024)}
                  className={errors['time.year'] ? 'bt-err' : ''}
                />
              </div>
              <div className="bt-field">
                <label>Month</label>
                <select
                  value={state.time.month}
                  onChange={e => updateTime('month', parseInt(e.target.value))}
                  className={errors['time.month'] ? 'bt-err' : ''}
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="bt-field">
                <label>Day</label>
                <input
                  type="number"
                  min={1}
                  max={maxDaysInMonth}
                  value={state.time.day}
                  onChange={e => updateTime('day', parseInt(e.target.value) || 1)}
                  className={errors['time.day'] ? 'bt-err' : ''}
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
                  value={state.time.hour}
                  onChange={e => updateTime('hour', parseInt(e.target.value) || 0)}
                  className={errors['time.hour'] ? 'bt-err' : ''}
                />
              </div>
              <div className="bt-field">
                <label>Minute</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={state.time.minute}
                  onChange={e => updateTime('minute', parseInt(e.target.value) || 0)}
                  className={errors['time.minute'] ? 'bt-err' : ''}
                />
              </div>
              <div className="bt-field">
                <label>Day of Week</label>
                <input
                  type="text"
                  value={state.time.dayOfWeek}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>
            </div>
          </fieldset>

          {/* Location */}
          <fieldset className="bt-section">
            <legend><i className="fa-solid fa-map-marker-alt"></i> Location</legend>
            <div className="bt-field">
              <label>Area *</label>
              <input
                type="text"
                value={state.location.area}
                onChange={e => updateLocation('area', e.target.value)}
                placeholder="City, district, region..."
                className={errors['location.area'] ? 'bt-err' : ''}
              />
            </div>
            <div className="bt-field">
              <label>Place *</label>
              <input
                type="text"
                value={state.location.place}
                onChange={e => updateLocation('place', e.target.value)}
                placeholder="Building, establishment, room..."
                className={errors['location.place'] ? 'bt-err' : ''}
              />
            </div>
            <div className="bt-field">
              <label>Position *</label>
              <input
                type="text"
                value={state.location.position}
                onChange={e => updateLocation('position', e.target.value)}
                placeholder="Position within the place..."
                className={errors['location.position'] ? 'bt-err' : ''}
              />
            </div>
            <div className="bt-field">
              <label>Props</label>
              <TagInput
                tags={state.location.props || []}
                onChange={t => updateLocation('props', t)}
                placeholder="Add props..."
              />
            </div>
          </fieldset>

          {/* Climate */}
          <fieldset className="bt-section">
            <legend><i className="fa-solid fa-cloud-sun"></i> Climate</legend>
            <div className="bt-row-2">
              <div className="bt-field">
                <label>Weather</label>
                <select
                  value={state.climate?.weather || 'sunny'}
                  onChange={e => updateClimate('weather', e.target.value as Climate['weather'])}
                >
                  {WEATHER_OPTIONS.map(w => (
                    <option key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="bt-field">
                <label>Temperature (°F)</label>
                <input
                  type="number"
                  value={state.climate?.temperature ?? 70}
                  onChange={e => updateClimate('temperature', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </fieldset>
        </div>
      )}

      {/* Characters Tab */}
      {tab === 'chars' && (
        <div className="bt-panel">
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
          <button type="button" onClick={addChar} className="bt-add-char">
            <i className="fa-solid fa-plus"></i> Add Character
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
        <button type="button" onClick={onCancel} className="bt-btn">Cancel</button>
        <button type="button" onClick={handleSave} className="bt-btn bt-btn-primary">
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
  onSave: (state: TrackedState) => Promise<void>
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

  return new Promise((resolve) => {
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
      />
    );

    // Show popup
    context.callGenericPopup(container, context.POPUP_TYPE.CONFIRM, null, {
      wide: true,
      large: true,
      okButton: '',  // Hidden
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
