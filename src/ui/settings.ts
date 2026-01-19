import { settingsManager, BlazeTrackerSettings } from '../settings';

// Get ST utilities from sillytavern-utils-lib
// These components render native ST-styled UI elements
let STConnectionProfileSelect: any;
let st_echo: any;

// Dynamic import since these come from ST's runtime
async function loadSTComponents() {
  try {
    const components = await import('sillytavern-utils-lib/components/react');
    STConnectionProfileSelect = components.STConnectionProfileSelect;
  } catch (e) {
    console.warn('[BlazeTracker] Could not load ST components:', e);
  }

  try {
    const config = await import('sillytavern-utils-lib/config');
    st_echo = config.st_echo;
  } catch (e) {
    console.warn('[BlazeTracker] Could not load st_echo:', e);
  }
}

export async function initSettingsUI() {
  await loadSTComponents();

  const settingsContainer = document.getElementById('extensions_settings');
  if (!settingsContainer) {
    console.error('[BlazeTracker] Extension settings container not found.');
    return;
  }

  // Create our settings panel
  const panel = document.createElement('div');
  panel.id = 'blazetracker-settings';
  panel.className = 'extension_container';
  panel.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>🔥 BlazeTracker</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content">
        <div class="blazetracker-settings-content">

          <div class="flex-container flexFlowColumn">
            <label for="blazetracker-profile">Connection Profile</label>
            <small>Select which API connection to use for state extraction</small>
            <div id="blazetracker-profile-container"></div>
          </div>

          <hr>

          <div class="flex-container flexFlowColumn">
            <label for="blazetracker-automode">Auto Mode</label>
            <small>When to automatically extract state</small>
            <select id="blazetracker-automode" class="text_pole">
              <option value="none">None (manual only)</option>
              <option value="responses">AI responses only</option>
              <option value="inputs">User messages only</option>
              <option value="both">Both</option>
            </select>
          </div>

          <hr>

          <div class="flex-container flexFlowColumn">
            <label for="blazetracker-lastx">Max messages to Include</label>
            <small>Max. number of recent messages to send for extraction context</small>
            <input type="number" id="blazetracker-lastx" class="text_pole" min="1" max="50" step="1">
          </div>

          <hr>

          <div class="flex-container flexFlowColumn">
            <label for="blazetracker-maxtokens">Max Response Tokens</label>
            <small>Maximum tokens for extraction response</small>
            <input type="number" id="blazetracker-maxtokens" class="text_pole" min="500" max="8000" step="100">
          </div>

        </div>
      </div>
    </div>
  `;

  settingsContainer.appendChild(panel);

  // Initialize settings values
  await settingsManager.initializeSettings();
  const settings = settingsManager.getSettings();

  // Set up profile selector
  const profileContainer = panel.querySelector('#blazetracker-profile-container');
  if (profileContainer && STConnectionProfileSelect) {
    // STConnectionProfileSelect is a web component or needs special handling
    // For now, create a simple select that reads from ST's connection manager
    const context = SillyTavern.getContext();
    const connectionManager = context.extensionSettings?.connectionManager as { profiles?: Array<{ id: string; name?: string }> } | undefined;
    const profiles = connectionManager?.profiles || [];

    const select = document.createElement('select');
    select.id = 'blazetracker-profile';
    select.className = 'text_pole';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- Select a profile --';
    select.appendChild(emptyOption);

    for (const profile of profiles) {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.name || profile.id;
      if (profile.id === settings.profileId) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      updateSetting('profileId', select.value);
    });

    profileContainer.appendChild(select);
  } else {
    // Fallback: just show a text input
    if (profileContainer) {
      profileContainer.innerHTML = `
        <input type="text" id="blazetracker-profile" class="text_pole"
               placeholder="Profile ID" value="${settings.profileId || ''}">
        <small>Enter connection profile ID manually</small>
      `;
      const input = profileContainer.querySelector('#blazetracker-profile') as HTMLInputElement;
      input?.addEventListener('change', () => {
        updateSetting('profileId', input.value);
      });
    }
  }

  // Set up auto mode
  const autoModeSelect = panel.querySelector('#blazetracker-automode') as HTMLSelectElement;
  if (autoModeSelect) {
    autoModeSelect.value = settings.autoMode;
    autoModeSelect.addEventListener('change', () => {
      updateSetting('autoMode', autoModeSelect.value as BlazeTrackerSettings['autoMode']);
    });
  }

  // Set up last X messages
  const lastXInput = panel.querySelector('#blazetracker-lastx') as HTMLInputElement;
  if (lastXInput) {
    lastXInput.value = String(settings.lastXMessages);
    lastXInput.addEventListener('change', () => {
      updateSetting('lastXMessages', parseInt(lastXInput.value) || 10);
    });
  }

  // Set up max tokens
  const maxTokensInput = panel.querySelector('#blazetracker-maxtokens') as HTMLInputElement;
  if (maxTokensInput) {
    maxTokensInput.value = String(settings.maxResponseTokens);
    maxTokensInput.addEventListener('change', () => {
      updateSetting('maxResponseTokens', parseInt(maxTokensInput.value) || 2000);
    });
  }

  console.log('[BlazeTracker] Settings UI initialized');
}

function updateSetting<K extends keyof BlazeTrackerSettings>(key: K, value: BlazeTrackerSettings[K]) {
  const settings = settingsManager.getSettings();
  settings[key] = value;
  settingsManager.saveSettings();
  console.log(`[BlazeTracker] Setting ${key} = ${value}`);
}

export function getSettings(): BlazeTrackerSettings {
  return settingsManager.getSettings();
}
