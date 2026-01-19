import React from 'react';
import ReactDOM from 'react-dom/client';
import type { CharacterOutfit, TrackedState, Scene } from '../types/state';
import type { STContext } from '../types/st';
import { st_echo } from 'sillytavern-utils-lib/config';
import { extractState } from '../extractors/extractState';
import { getMessageState, setMessageState } from '../utils/messageState';
import { openStateEditor } from './stateEditor';
import { updateInjectionFromChat } from '../injectors/injectState';

const EXTENSION_NAME = 'BlazeTracker';
const EXTENSION_KEY = 'blazetracker';

// --- Icon Mappings (UI concern, lives here not in state types) ---

const TENSION_LEVEL_ICONS: Record<Scene['tension']['level'], string> = {
  relaxed: 'fa-mug-hot',
  aware: 'fa-eye',
  guarded: 'fa-shield-halved',
  tense: 'fa-face-grimace',
  charged: 'fa-bolt',
  volatile: 'fa-fire',
  explosive: 'fa-explosion',
};

const TENSION_DIRECTION_ICONS: Record<Scene['tension']['direction'], string> = {
  escalating: 'fa-arrow-trend-up',
  stable: 'fa-grip-lines',
  decreasing: 'fa-arrow-trend-down',
};

const TENSION_TYPE_ICONS: Record<Scene['tension']['type'], string> = {
  confrontation: 'fa-hand-fist',
  intimate: 'fa-heart',
  vulnerable: 'fa-heart-crack',
  celebratory: 'fa-champagne-glasses',
  negotiation: 'fa-handshake',
  suspense: 'fa-hourglass-half',
  conversation: 'fa-comments',
};

const WEATHER_ICONS: Record<string, string> = {
  sunny: 'fa-sun',
  cloudy: 'fa-cloud',
  snowy: 'fa-snowflake',
  rainy: 'fa-cloud-rain',
  windy: 'fa-wind',
  thunderstorm: 'fa-cloud-bolt',
};

// --- Types ---

interface StoredStateData {
  state: TrackedState;
  extractedAt: string;
}

// Track React roots so we can unmount/update them
const roots = new Map<number, ReactDOM.Root>();

// Track ongoing extractions - exported so index.ts can check
export const extractionInProgress = new Set<number>();

// --- Helper Functions ---

function formatTime(time: TrackedState['time']): string {
  const hour = String(time.hour).padStart(2, '0');
  const minute = String(time.minute).padStart(2, '0');
  const day = time.day ? `${time.day}, ` : '';
  return `${day}${hour}:${minute}`;
}

function formatLocation(location: TrackedState['location']): string {
  const parts = [location.position, location.place, location.area];
  return parts.filter(Boolean).join(' · ');
}

function formatOutfit(outfit: CharacterOutfit): string {
  const outfitParts = [
    outfit.torso || 'topless',
    outfit.legs || 'bottomless',
    outfit.underwear || 'no underwear',
    outfit.head || null,
    outfit.jacket || null,
    outfit.footwear || null
  ];
  return outfitParts.filter((v: string | null) => v !== null).join(', ');
}

function getWeatherIcon(weather: string): string {
  return WEATHER_ICONS[weather] ?? 'fa-question';
}

/** Wait for a message element to exist in the DOM */
async function waitForMessageElement(messageId: number, maxWaitMs: number = 2000): Promise<Element | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const element = document.querySelector(`[mesid="${messageId}"]`);
    if (element && element.querySelector('.mes_text')) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.warn(`[${EXTENSION_NAME}] Timeout waiting for message element ${messageId}`);
  return null;
}

// --- React Components ---

interface SceneDisplayProps {
  scene: Scene;
}

function SceneDisplay({ scene }: SceneDisplayProps) {
  const { tension } = scene;

  return (
    <div className="bt-scene">
      <div className="bt-scene-header">
        <span className="bt-scene-topic">{scene.topic}</span>
        <span className="bt-scene-tone">{scene.tone}</span>
      </div>
      <div className="bt-scene-tension">
        <span className="bt-tension-type" title={tension.type}>
          <i className={`fa-solid ${TENSION_TYPE_ICONS[tension.type]}`}></i>
          {tension.type}
        </span>
        <span className="bt-tension-level" title={tension.level}>
          <i className={`fa-solid ${TENSION_LEVEL_ICONS[tension.level]}`}></i>
          {tension.level}
        </span>
        <span className="bt-tension-direction" title={tension.direction}>
          <i className={`fa-solid ${TENSION_DIRECTION_ICONS[tension.direction]}`}></i>
          {tension.direction}
        </span>
      </div>
      {scene.recentEvents.length > 0 && (
        <div className="bt-scene-events">
          <ul>
            {scene.recentEvents.map((event, idx) => (
              <li key={idx}>{event}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface CharacterProps {
  character: TrackedState['characters'][0];
}

function Character({ character }: CharacterProps) {
  const mood = character.mood?.join(', ') || 'unknown';

  let dispositionText = '';
  if (character.dispositions && typeof character.dispositions === 'object') {
    const entries = Array.isArray(character.dispositions)
      ? character.dispositions.map((d: any) => `${d.toward}: ${d.feelings.join(', ')}`)
      : Object.entries(character.dispositions).map(([name, feelings]) =>
        `${name}: ${(feelings as string[]).join(', ')}`
      );
    if (entries.length) {
      dispositionText = entries.join('; ');
    }
  }

  return (
    <div className="bt-character">
      <div className="bt-char-header">
        <strong>{character.name}</strong>
        <span className="bt-char-mood">{mood}</span>
      </div>
      <div className="bt-char-position">{character.position}</div>
      {character.goals && character.goals.length > 0 && (
        <div className="bt-char-goals">Goals: {character.goals.join(', ')}</div>
      )}
      {character.activity && (
        <div className="bt-char-activity">Activity: {character.activity}</div>
      )}
      {character.physicalState && character.physicalState.length > 0 && (
        <div className="bt-char-physical">Physical: {character.physicalState.join(', ')}</div>
      )}
      {character.outfit && (
        <div className="bt-char-outfit">Outfit: {formatOutfit(character.outfit)}</div>
      )}
      {dispositionText && (
        <div className="bt-char-dispositions">Feelings: {dispositionText}</div>
      )}
    </div>
  );
}

interface StateDisplayProps {
  stateData: StoredStateData | null;
  isExtracting?: boolean;
}

function StateDisplay({ stateData, isExtracting }: StateDisplayProps) {
  // Show loading state while extracting
  if (isExtracting) {
    return (
      <div className="bt-state-container bt-extracting">
        <div className="bt-loading-indicator">
          <i className="fa-solid fa-fire fa-beat-fade"></i>
          <span>Extracting scene state...</span>
        </div>
      </div>
    );
  }

  if (!stateData) {
    return null;
  }

  const { state } = stateData;

  return (
    <div className="bt-state-container">
      {/* Scene summary - always visible */}
      {state.scene && <SceneDisplay scene={state.scene} />}

      {/* Time/Weather/Location row */}
      <div className="bt-state-summary">
        <span className="bt-time">
          <i className="fa-regular fa-clock"></i> {formatTime(state.time)}
        </span>
        {state.climate && (
          <span className="bt-climate">
            <i className={`fa-solid ${getWeatherIcon(state.climate.weather)}`}></i>
            {state.climate.temperature !== undefined && ` ${state.climate.temperature}°F`}
          </span>
        )}
        <span className="bt-location">
          <i className="fa-solid fa-location-dot"></i> {formatLocation(state.location)}
        </span>
      </div>

      {/* Expandable details */}
      <details className="bt-state-details">
        <summary>Details ({state.characters.length} characters, {state.location.props.length} props)</summary>

        <div className="bt-props-section">
          <span className="bt-props-header">Props</span>
          <div className="bt-props">
            <ul>
              {state.location.props.map((prop, idx) => (
                <li key={idx}>{prop}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bt-characters">
          {state.characters.map((char, idx) => (
            <Character key={`${char.name}-${idx}`} character={char} />
          ))}
        </div>
      </details>
    </div>
  );
}

// --- State Extraction ---

function getPreviousState(context: STContext, beforeMessageId: number): TrackedState | null {
  for (let i = beforeMessageId - 1; i >= 0; i--) {
    const prev = context.chat[i];
    const trackerData = getMessageState(prev) as StoredStateData | undefined;
    if (trackerData?.state) {
      return trackerData.state;
    }
  }
  return null;
}

export async function doExtractState(messageId: number): Promise<StoredStateData | null> {
  if (extractionInProgress.has(messageId)) {
    return null;
  }

  const context = SillyTavern.getContext() as STContext;
  const message = context.chat[messageId];

  if (!message) {
    console.warn(`[${EXTENSION_NAME}] Message not found:`, messageId);
    return null;
  }

  // Mark extraction in progress
  extractionInProgress.add(messageId);

  // Try to show loading state (synchronous - DOM should be ready since we're called from
  // USER_MESSAGE_RENDERED or GENERATION_ENDED, not during streaming)
  const messageElement = document.querySelector(`[mesid="${messageId}"]`);
  const mesBlock = messageElement?.querySelector('.mes_block');

  if (messageElement && mesBlock) {
    updateMenuButtonState(messageId, true);
    renderMessageStateInternal(messageId, messageElement, null, true);
  }

  const previousState = getPreviousState(context, messageId);

  try {
    const { state } = await extractState(context, messageId, previousState);

    const stateData: StoredStateData = {
      state,
      extractedAt: new Date().toISOString(),
    };

    if (!message.extra) {
      message.extra = {};
    }
    setMessageState(message, stateData);

    await context.saveChat();

    // Render the extracted state
    if (messageElement) {
      renderMessageStateInternal(messageId, messageElement, stateData, false);
    }

    return stateData;

  } catch (e: any) {
    if (e.name === 'AbortError') {
      st_echo?.('warning', '🔥 Extraction aborted');
    } else {
      console.warn(`[${EXTENSION_NAME}] Extraction failed:`, e);
      st_echo?.('error', `🔥 Extraction failed: ${e.message}`);
    }

    // Clear loading state on error
    if (messageElement) {
      renderMessageStateInternal(messageId, messageElement, null, false);
    }

    return null;
  } finally {
    extractionInProgress.delete(messageId);
    updateMenuButtonState(messageId, false);
  }
}

// --- Menu Button ---

function updateMenuButtonState(messageId: number, isLoading: boolean) {
  const messageElement = document.querySelector(`[mesid="${messageId}"]`);
  const btn = messageElement?.querySelector('.bt-extract-btn') as HTMLElement;
  if (btn) {
    btn.classList.toggle('bt-loading', isLoading);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isLoading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-fire';
    }
  }
}

function addMenuButton(messageId: number, messageElement: Element) {
  const extraButtons = messageElement.querySelector('.extraMesButtons');
  if (!extraButtons) return;

  if (!extraButtons.querySelector('.bt-extract-btn')) {
    const extractBtn = document.createElement('div');
    extractBtn.className = 'bt-extract-btn mes_button';
    extractBtn.title = 'Extract scene state (BlazeTracker)';
    extractBtn.innerHTML = '<i class="fa-solid fa-fire"></i>';

    extractBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await doExtractState(messageId);
    });

    extraButtons.insertBefore(extractBtn, extraButtons.firstChild);
  }

  if (!extraButtons.querySelector('.bt-edit-btn')) {
    const editBtn = document.createElement('div');
    editBtn.className = 'bt-edit-btn mes_button';
    editBtn.title = 'Edit scene state (BlazeTracker)';
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';

    editBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await editMessageState(messageId);
    });

    const extractBtn = extraButtons.querySelector('.bt-extract-btn');
    if (extractBtn) {
      extractBtn.after(editBtn);
    } else {
      extraButtons.insertBefore(editBtn, extraButtons.firstChild);
    }
  }
}

// --- Internal render function (when we already have the element) ---

function renderMessageStateInternal(
  messageId: number,
  messageElement: Element,
  stateData: StoredStateData | null,
  isExtracting: boolean
) {
  addMenuButton(messageId, messageElement);
  let needsNewRoot = false;

  let container = messageElement.querySelector('.bt-state-root') as HTMLElement;
  if (!container) {
    container = document.createElement('div');
    container.className = 'bt-state-root';
    // Append to mes_block instead of after mes_text
    const mesBlock = messageElement.querySelector('.mes_block');
    mesBlock?.appendChild(container);
    needsNewRoot = true; // New container = old root is stale
  }

  let root = roots.get(messageId);
  if (needsNewRoot && root) {
    root.unmount();
    root = undefined;
  }

  if (!root) {
    root = ReactDOM.createRoot(container);
    roots.set(messageId, root);
  }

  root.render(<StateDisplay stateData={stateData} isExtracting={isExtracting} />);

  // If this is the most recent message, scroll to the end.
  const context = SillyTavern.getContext() as STContext;
  if (messageId === context.chat.length - 1) {
    setTimeout(() => {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }
}

// --- Public API ---

export function renderMessageState(messageId: number, stateData?: StoredStateData | null, isExtracting: boolean = false) {
  // Don't render if extraction is in progress (unless we're explicitly setting isExtracting)
  if (extractionInProgress.has(messageId) && !isExtracting) {
    return;
  }

  const context = SillyTavern.getContext() as STContext;
  const message = context.chat[messageId];

  const messageElement = document.querySelector(`[mesid="${messageId}"]`);
  if (!messageElement) return;

  const currentStateData = stateData !== undefined
    ? stateData
    : (getMessageState(message) as StoredStateData | undefined) ?? null;

  renderMessageStateInternal(messageId, messageElement, currentStateData, isExtracting);
}

/** Clear loading state (used when extraction is handled elsewhere) */
export function clearLoadingState(messageId: number): void {
  extractionInProgress.delete(messageId);
  renderMessageState(messageId);
}

export function unmountMessageState(messageId: number) {
  const root = roots.get(messageId);
  if (root) {
    root.unmount();
    roots.delete(messageId);
  }
}

export function renderAllStates() {
  const context = SillyTavern.getContext() as STContext;

  // Unmount and remove roots that aren't mid-extraction
  for (const [messageId, root] of roots) {
    if (!extractionInProgress.has(messageId)) {
      root.unmount();
      roots.delete(messageId);
    }
  }

  // Re-render all non-in-progress messages
  for (let i = 0; i < context.chat.length; i++) {
    if (!extractionInProgress.has(i)) {
      renderMessageState(i);
    }
  }
}

async function editMessageState(messageId: number): Promise<void> {
  const context = SillyTavern.getContext() as STContext;
  const message = context.chat[messageId];

  if (!message) {
    st_echo?.('error', 'Message not found');
    return;
  }

  const currentStateData = getMessageState(message);
  const currentState = currentStateData?.state || null;

  const saved = await openStateEditor(currentState, async (newState: TrackedState) => {
    const stateData = {
      state: newState,
      extractedAt: new Date().toISOString(),
    };

    setMessageState(message, stateData);
    await context.saveChat();

    renderMessageState(messageId, stateData);
    updateInjectionFromChat();

    st_echo?.('success', '🔥 State updated');
  });
}

export function initStateDisplay() {
  const context = SillyTavern.getContext();

  // Only handle chat change for initial render - let index.ts handle message events
  context.eventSource.on(context.event_types.CHAT_CHANGED, (() => {
    setTimeout(renderAllStates, 100);
  }) as (...args: unknown[]) => void);
}

export function injectStyles() {
  if (document.getElementById('blazetracker-styles')) return;

  const link = document.createElement('link');
  link.id = 'blazetracker-styles';
  link.rel = 'stylesheet';
  link.href = new URL('./stateDisplay.css', import.meta.url).href;
  document.head.appendChild(link);
}
