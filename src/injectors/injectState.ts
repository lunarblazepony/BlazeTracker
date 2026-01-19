import type { CharacterOutfit, TrackedState, Scene, NarrativeDateTime } from '../types/state';
import type { STContext } from '../types/st';
import { getMessageState } from '../utils/messageState';
import { getSettings } from '../ui/settings';

const EXTENSION_KEY = 'blazetracker';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatOutfit(outfit: CharacterOutfit): string {
  const outfitParts = [
    outfit.torso || 'topless',
    outfit.legs || 'bottomless',
    outfit.underwear || 'no underwear',
    outfit.head || null,
    outfit.jacket || null,
    outfit.socks || null,
    outfit.footwear || null
  ];

  return outfitParts.filter((v: string | null) => v !== null).join(', ');
}

function formatClimate(climate: { weather: string, temperature: number }): string {
  return `${climate.temperature}°F, ${climate.weather}`;
}

function formatScene(scene: Scene): string {
  const tensionParts = [
    scene.tension.type,
    scene.tension.level,
    scene.tension.direction !== 'stable' ? scene.tension.direction : null
  ].filter(Boolean);

  let text = `Topic: ${scene.topic}
Tone: ${scene.tone}
Tension: ${tensionParts.join(', ')}`;

  if (scene.recentEvents.length > 0) {
    text += `\nRecent events: ${scene.recentEvents.join('; ')}`;
  }

  return text;
}

function formatNarrativeDateTime(time: NarrativeDateTime): string {
  const hour12 = time.hour % 12 || 12;
  const ampm = time.hour < 12 ? 'AM' : 'PM';
  const minuteStr = String(time.minute).padStart(2, '0');

  // "Monday, June 15th, 2024 at 2:30 PM"
  const dayOrdinal = getDayOrdinal(time.day);

  return `${time.dayOfWeek}, ${MONTH_NAMES[time.month - 1]} ${time.day}${dayOrdinal}, ${time.year} at ${hour12}:${minuteStr} ${ampm}`;
}

function getDayOrdinal(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function formatStateForInjection(state: TrackedState): string {
  const settings = getSettings();
  const showTime = settings.trackTime !== false;

  const location = [state.location.area, state.location.place, state.location.position]
    .filter(Boolean)
    .join(' - ');
  const props = state.location.props.join(', ');

  const climate = state.climate ? formatClimate(state.climate) : '';

  const characters = state.characters.map(char => {
    const parts = [`${char.name}: ${char.position}`];
    if (char.activity) parts.push(`doing: ${char.activity}`);
    if (char.mood?.length) parts.push(`mood: ${char.mood.join(', ')}`);
    if (char.goals?.length) parts.push(`goals: ${char.goals.join(', ')}`);
    if (char.physicalState?.length) parts.push(`physical: ${char.physicalState.join(', ')}`);
    if (char.outfit) parts.push(`wearing: ${formatOutfit(char.outfit)}`);
    if (char.dispositions) {
      const dispParts = Object.entries(char.dispositions)
        .map(([name, feelings]) => `${name}: ${feelings.join(', ')}`);
      if (dispParts.length) parts.push(`feelings: ${dispParts.join('; ')}`);
    }
    return parts.join('; ');
  }).join('\n');

  let output = `[Scene State]`;

  // Scene info first - it's the narrative context
  if (state.scene) {
    output += `\n${formatScene(state.scene)}`;
  }

  // Only include time if tracking is enabled
  if (showTime && state.time) {
    const timeStr = formatNarrativeDateTime(state.time);
    output += `\nTime: ${timeStr}`;
  }

  output += `
Location: ${location}
Nearby objects: ${props}`;

  if (climate) {
    output += `\nClimate: ${climate}`;
  }

  output += `
Characters present:
${characters}
[/Scene State]`;

  return output;
}

export function injectState(state: TrackedState | null) {
  const context = SillyTavern.getContext() as STContext;

  if (!state) {
    context.setExtensionPrompt(EXTENSION_KEY, '', 0, 0);
    return;
  }

  const formatted = formatStateForInjection(state);

  // Inject at depth 0 (with most recent messages), position IN_CHAT
  // Position 1 = after main prompt, before chat
  // Depth 0 = at the end (near most recent messages)
  context.setExtensionPrompt(
    EXTENSION_KEY,
    formatted,
    1,  // extension_prompt_types.IN_CHAT or similar
    0   // depth - 0 means at the bottom
  );

  console.log('[BlazeTracker] Injected state into context');
}

export function updateInjectionFromChat() {
  const context = SillyTavern.getContext() as STContext;

  // Find most recent state
  for (let i = context.chat.length - 1; i >= 0; i--) {
    const message = context.chat[i];
    const stateData = getMessageState(message) as { state?: TrackedState } | undefined;
    if (stateData?.state) {
      injectState(stateData.state);
      return;
    }
  }

  // No state found, clear injection
  injectState(null);
}
