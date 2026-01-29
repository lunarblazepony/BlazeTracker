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
