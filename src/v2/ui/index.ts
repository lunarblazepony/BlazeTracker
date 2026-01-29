/**
 * V2 UI Module - Exports
 */

// Main Components
export {
	ProjectionDisplay,
	type ProjectionDisplayProps,
	type ExtractionProgress,
} from './ProjectionDisplay';
export {
	EventStoreEditor,
	openV2EventStoreEditor,
	type EventStoreEditorProps,
} from './EventStoreEditor';

// Sub-components
export {
	V2LoadingIndicator,
	V2TensionBadges,
	V2ClimateDisplay,
	V2CharacterCard,
	V2StateReadOnly,
	V2CharacterReadOnly,
	V2EventCard,
} from './components';

// V2 Event Editor
export { V2EventEditor, type V2EventEditorHandle } from './V2EventEditor';
export { V2EventEditorModal, type V2EventEditorModalProps } from './V2EventEditorModal';
export { V2ProjectionPreview } from './V2ProjectionPreview';

// Mount functions
export {
	mountV2ProjectionDisplay,
	mountAllV2ProjectionDisplays,
	unmountV2ProjectionDisplay,
	unmountAllV2ProjectionDisplays,
	rerenderV2ProjectionDisplay,
	hasV2DisplaysMounted,
	isV2ExtractionInProgress,
	setV2ExtractionInProgress,
	updateV2ExtractionProgress,
} from './mountV2Display';

// V2 Settings UI
export { initV2SettingsUI, unmountV2SettingsUI, default as V2SettingsPanel } from './V2SettingsUI';

// CSS Injection
export function injectV2Styles(): void {
	// Load stateDisplay.css (for projection display styling)
	if (!document.getElementById('blazetracker-state-display-styles')) {
		const stateDisplayLink = document.createElement('link');
		stateDisplayLink.id = 'blazetracker-state-display-styles';
		stateDisplayLink.rel = 'stylesheet';
		stateDisplayLink.href = new URL('../../ui/stateDisplay.css', import.meta.url).href;
		document.head.appendChild(stateDisplayLink);
	}

	// Load stateEditor.css (for event editor styling)
	if (!document.getElementById('blazetracker-state-editor-styles')) {
		const stateEditorLink = document.createElement('link');
		stateEditorLink.id = 'blazetracker-state-editor-styles';
		stateEditorLink.rel = 'stylesheet';
		stateEditorLink.href = new URL('../../ui/stateEditor.css', import.meta.url).href;
		document.head.appendChild(stateEditorLink);
	}

	// Load settings.css (for settings panel styling)
	if (!document.getElementById('blazetracker-settings-styles')) {
		const settingsLink = document.createElement('link');
		settingsLink.id = 'blazetracker-settings-styles';
		settingsLink.rel = 'stylesheet';
		settingsLink.href = new URL('../../ui/settings.css', import.meta.url).href;
		document.head.appendChild(settingsLink);
	}

	// Load cardDefaults.css (for character card defaults modal)
	if (!document.getElementById('blazetracker-card-defaults-styles')) {
		const cardDefaultsLink = document.createElement('link');
		cardDefaultsLink.id = 'blazetracker-card-defaults-styles';
		cardDefaultsLink.rel = 'stylesheet';
		cardDefaultsLink.href = new URL('../../ui/cardDefaults.css', import.meta.url).href;
		document.head.appendChild(cardDefaultsLink);
	}

	// Load V2NarrativeModal.css (for V2 narrative modal)
	if (!document.getElementById('blazetracker-v2-narrative-styles')) {
		const v2NarrativeLink = document.createElement('link');
		v2NarrativeLink.id = 'blazetracker-v2-narrative-styles';
		v2NarrativeLink.rel = 'stylesheet';
		v2NarrativeLink.href = new URL('./V2NarrativeModal.css', import.meta.url).href;
		document.head.appendChild(v2NarrativeLink);
	}
}
