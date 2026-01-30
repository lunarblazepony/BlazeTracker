/**
 * V2 Settings UI Component
 *
 * Complete settings panel for V2 with track toggle dependencies,
 * temperature sliders, and custom prompt editing with separate
 * system/user inputs and expandable modal.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import type {
	V2Settings,
	V2TrackSettings,
	V2TemperatureSettings,
	V2CustomPrompt,
} from '../settings/types';
import { updateV2Setting, updateV2Track, initializeV2Settings } from '../settings/manager';
import { isTrackDisabled, getTrackDependencyTooltip, DEFAULT_V2_TEMPERATURES } from '../settings';
import { setDebugEnabled, errorLog } from '../../utils/debug';
import { SelectField, CheckboxField } from '../../ui/components/form';
import { mountAllV2ProjectionDisplays } from './mountV2Display';
import { getAllV2Prompts, type PromptTemplate } from '../prompts';

// ============================================
// Types
// ============================================

interface ConnectionProfile {
	id: string;
	name?: string;
}

// ============================================
// Track Toggle Component
// ============================================

interface TrackToggleProps {
	id: string;
	label: string;
	description: string;
	trackKey: keyof V2TrackSettings;
	track: V2TrackSettings;
	onChange: (key: keyof V2TrackSettings, value: boolean) => void;
}

function TrackToggle({ id, label, description, trackKey, track, onChange }: TrackToggleProps) {
	const disabled = isTrackDisabled(trackKey, track);
	const tooltip = getTrackDependencyTooltip(trackKey, track);

	return (
		<div
			className={`bt-track-toggle ${disabled ? 'bt-track-disabled' : ''}`}
			title={tooltip || undefined}
		>
			<label className="checkbox_label">
				<input
					type="checkbox"
					id={id}
					checked={track[trackKey]}
					disabled={disabled}
					onChange={e => onChange(trackKey, e.target.checked)}
				/>
				<span>{label}</span>
				{disabled && tooltip && (
					<span className="bt-dependency-warning">
						<i className="fa-solid fa-lock" title={tooltip}></i>
					</span>
				)}
			</label>
			<small>{description}</small>
		</div>
	);
}

// ============================================
// Temperature Slider Component
// ============================================

interface TemperatureSliderProps {
	category: keyof V2TemperatureSettings;
	label: string;
	temperatures: V2TemperatureSettings;
	onChange: (category: keyof V2TemperatureSettings, value: number) => void;
}

function TemperatureSlider({ category, label, temperatures, onChange }: TemperatureSliderProps) {
	const value = temperatures[category];
	const defaultValue = DEFAULT_V2_TEMPERATURES[category];
	const isCustom = value !== defaultValue;

	const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(category, parseFloat(e.target.value));
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const num = parseFloat(e.target.value);
		if (!isNaN(num)) {
			onChange(category, Math.max(0, Math.min(2, num)));
		}
	};

	const handleReset = () => {
		onChange(category, defaultValue);
	};

	return (
		<div className="bt-temperature-row">
			<span className="bt-temperature-row-label">{label}</span>
			<input
				type="range"
				className="bt-temperature-slider"
				min="0"
				max="2"
				step="0.05"
				value={value}
				onChange={handleSliderChange}
			/>
			<input
				type="number"
				className="bt-temperature-input"
				min="0"
				max="2"
				step="0.05"
				value={value}
				onChange={handleInputChange}
			/>
			{isCustom && (
				<button
					className="bt-temperature-reset"
					onClick={handleReset}
					title={`Reset to default (${defaultValue})`}
				>
					<i className="fa-solid fa-rotate-left"></i>
				</button>
			)}
		</div>
	);
}

// ============================================
// Prompt Category Mapping
// ============================================

/**
 * Map V2 prompt names to their temperature category.
 */
function getPromptCategory(name: string): keyof V2TemperatureSettings {
	// Initial prompts
	if (name === 'initial_time' || name === 'time_change') return 'time';
	if (name === 'initial_location' || name === 'location_change') return 'location';
	if (name === 'initial_props' || name.includes('props')) return 'props';
	if (name === 'initial_climate' || name === 'climate_change') return 'climate';

	// Character prompts
	if (
		name === 'initial_characters_present' ||
		name === 'initial_character_outfits' ||
		name === 'presence_change' ||
		name === 'position_change' ||
		name === 'activity_change' ||
		name === 'mood_change' ||
		name === 'outfit_change' ||
		name === 'appeared_character_outfit' ||
		name === 'position_activity_change' ||
		name === 'mood_physical_change' ||
		name === 'character_state_consolidation'
	)
		return 'characters';

	// Relationship prompts
	if (
		name === 'initial_relationships' ||
		name === 'feelings_change' ||
		name === 'secrets_change' ||
		name === 'wants_change' ||
		name === 'status_change' ||
		name === 'subjects' ||
		name === 'subjects_confirmation' ||
		name === 'relationship_attitude_consolidation'
	)
		return 'relationships';

	// Scene prompts
	if (
		name === 'initial_topic_tone' ||
		name === 'initial_tension' ||
		name === 'topic_tone_change' ||
		name === 'tension_change'
	)
		return 'scene';

	// Narrative prompts
	if (
		name === 'chapter_ended' ||
		name === 'chapter_description' ||
		name === 'narrative_description' ||
		name === 'milestone_description'
	)
		return 'narrative';

	return 'scene'; // fallback
}

// ============================================
// Expandable Modal Component
// ============================================

interface ExpandableModalProps {
	title: string;
	value: string;
	onChange: (value: string) => void;
	onClose: () => void;
	placeholder?: string;
}

function ExpandableModal({ title, value, onChange, onClose, placeholder }: ExpandableModalProps) {
	return createPortal(
		<div className="bt-expandable-modal-overlay" onClick={onClose}>
			<div className="bt-expandable-modal" onClick={e => e.stopPropagation()}>
				<div className="bt-expandable-modal-header">
					<h3>{title}</h3>
					<button className="menu_button" onClick={onClose}>
						<i className="fa-solid fa-xmark"></i>
					</button>
				</div>
				<textarea
					className="text_pole bt-expandable-textarea"
					value={value}
					onChange={e => onChange(e.target.value)}
					placeholder={placeholder}
					autoFocus
				/>
			</div>
		</div>,
		document.body,
	);
}

// ============================================
// V2 Prompt Editor Component
// ============================================

interface PromptEditorProps {
	definition: PromptTemplate<unknown>;
	customPrompts: Record<string, V2CustomPrompt>;
	promptTemperatures: Record<string, number>;
	categoryTemperatures: V2TemperatureSettings;
	onSavePrompt: (key: string, value: V2CustomPrompt | null) => void;
	onSaveTemperature: (key: string, value: number | null) => void;
	onClose: () => void;
}

function PromptEditor({
	definition,
	customPrompts,
	promptTemperatures,
	categoryTemperatures,
	onSavePrompt,
	onSaveTemperature,
	onClose,
}: PromptEditorProps) {
	const customPrompt = customPrompts[definition.name];
	const category = getPromptCategory(definition.name);
	const categoryTemp = categoryTemperatures[category];
	const promptTemp = promptTemperatures[definition.name];

	// Separate state for system and user prompts
	const [systemPrompt, setSystemPrompt] = useState(
		customPrompt?.systemPrompt ?? definition.systemPrompt,
	);
	const [userTemplate, setUserTemplate] = useState(
		customPrompt?.userTemplate ?? definition.userTemplate,
	);
	const [temperature, setTemperature] = useState(promptTemp ?? categoryTemp);
	const [showSystemModal, setShowSystemModal] = useState(false);
	const [showUserModal, setShowUserModal] = useState(false);

	const handleSave = () => {
		// Check if prompts have been modified from defaults
		const isSystemModified = systemPrompt.trim() !== definition.systemPrompt.trim();
		const isUserModified = userTemplate.trim() !== definition.userTemplate.trim();

		if (isSystemModified || isUserModified) {
			onSavePrompt(definition.name, {
				systemPrompt: isSystemModified ? systemPrompt.trim() : undefined,
				userTemplate: isUserModified ? userTemplate.trim() : undefined,
			});
		} else {
			// Reset to default (remove from custom prompts)
			onSavePrompt(definition.name, null);
		}

		// Handle temperature: save only if different from category default
		if (temperature !== categoryTemp) {
			onSaveTemperature(definition.name, temperature);
		} else {
			onSaveTemperature(definition.name, null);
		}

		onClose();
	};

	const handleReset = () => {
		setSystemPrompt(definition.systemPrompt);
		setUserTemplate(definition.userTemplate);
		setTemperature(categoryTemp);
	};

	const handleTemperatureSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTemperature(parseFloat(e.target.value));
	};

	const handleTemperatureInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const num = parseFloat(e.target.value);
		if (!isNaN(num)) {
			setTemperature(Math.max(0, Math.min(2, num)));
		}
	};

	return (
		<div className="bt-prompt-editor">
			{/* Header */}
			<div className="bt-prompt-editor-header">
				<strong>{definition.name}</strong>
				<small>{definition.description}</small>
			</div>

			{/* Temperature Section */}
			<div className="bt-prompt-temperature-section">
				<label>
					Temperature{' '}
					<small>
						(category default: {categoryTemp}, prompt default:{' '}
						{definition.defaultTemperature})
					</small>
				</label>
				<div className="bt-temperature-row">
					<input
						type="range"
						className="bt-temperature-slider"
						min="0"
						max="2"
						step="0.05"
						value={temperature}
						onChange={handleTemperatureSlider}
					/>
					<input
						type="number"
						className="bt-temperature-input"
						min="0"
						max="2"
						step="0.05"
						value={temperature}
						onChange={handleTemperatureInput}
					/>
					{temperature !== categoryTemp && (
						<button
							className="bt-temperature-reset"
							onClick={() => setTemperature(categoryTemp)}
							title="Reset to category default"
						>
							<i className="fa-solid fa-rotate-left"></i>
						</button>
					)}
				</div>
			</div>

			{/* Placeholder Documentation */}
			{definition.placeholders.length > 0 && (
				<div className="bt-prompt-placeholders">
					<label>Available Placeholders</label>
					<div className="bt-placeholder-list">
						{definition.placeholders.map(placeholder => (
							<div
								key={placeholder.name}
								className="bt-placeholder-item"
							>
								<code>
									{'{{' +
										placeholder.name +
										'}}'}
								</code>
								<span>
									{placeholder.description}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* System Prompt Section */}
			<div className="bt-prompt-section">
				<div className="bt-prompt-section-header">
					<label>
						System Prompt{' '}
						<small>(static, cacheable by LLM providers)</small>
					</label>
					<button
						className="menu_button bt-expand-button"
						onClick={() => setShowSystemModal(true)}
						title="Expand to full screen"
					>
						<i className="fa-solid fa-expand"></i>
					</button>
				</div>
				<textarea
					className="text_pole bt-prompt-textarea"
					value={systemPrompt}
					onChange={e => setSystemPrompt(e.target.value)}
					rows={5}
				/>
				{systemPrompt.trim() !== definition.systemPrompt.trim() && (
					<small className="bt-modified-indicator">
						<i className="fa-solid fa-pen"></i> Modified
					</small>
				)}
			</div>

			{/* User Template Section */}
			<div className="bt-prompt-section">
				<div className="bt-prompt-section-header">
					<label>
						User Template{' '}
						<small>(dynamic, with placeholders)</small>
					</label>
					<button
						className="menu_button bt-expand-button"
						onClick={() => setShowUserModal(true)}
						title="Expand to full screen"
					>
						<i className="fa-solid fa-expand"></i>
					</button>
				</div>
				<textarea
					className="text_pole bt-prompt-textarea"
					value={userTemplate}
					onChange={e => setUserTemplate(e.target.value)}
					rows={5}
				/>
				{userTemplate.trim() !== definition.userTemplate.trim() && (
					<small className="bt-modified-indicator">
						<i className="fa-solid fa-pen"></i> Modified
					</small>
				)}
			</div>

			{/* Actions */}
			<div className="bt-prompt-actions">
				<button className="menu_button" onClick={handleSave}>
					<i className="fa-solid fa-check"></i> Save
				</button>
				<button className="menu_button" onClick={handleReset}>
					<i className="fa-solid fa-rotate-left"></i> Reset to Default
				</button>
				<button className="menu_button" onClick={onClose}>
					<i className="fa-solid fa-xmark"></i> Cancel
				</button>
			</div>

			{/* Expandable Modals */}
			{showSystemModal && (
				<ExpandableModal
					title="System Prompt"
					value={systemPrompt}
					onChange={setSystemPrompt}
					onClose={() => setShowSystemModal(false)}
					placeholder="Enter system prompt..."
				/>
			)}
			{showUserModal && (
				<ExpandableModal
					title="User Template"
					value={userTemplate}
					onChange={setUserTemplate}
					onClose={() => setShowUserModal(false)}
					placeholder="Enter user template with {{placeholders}}..."
				/>
			)}
		</div>
	);
}

// ============================================
// Prompt List Item Component
// ============================================

interface PromptListItemProps {
	definition: PromptTemplate<unknown>;
	isCustomized: boolean;
	hasCustomTemperature: boolean;
	customTemperature?: number;
	onClick: () => void;
}

function PromptListItem({
	definition,
	isCustomized,
	hasCustomTemperature,
	customTemperature,
	onClick,
}: PromptListItemProps) {
	return (
		<div className="bt-prompt-item" onClick={onClick}>
			<div className="bt-prompt-item-header">
				<div className="bt-prompt-item-title">
					<span className="bt-prompt-name">{definition.name}</span>
				</div>
				<div className="bt-prompt-item-badges">
					{hasCustomTemperature && (
						<span
							className="bt-prompt-badge bt-prompt-temp-badge"
							title="Custom temperature"
						>
							<i className="fa-solid fa-temperature-half"></i>{' '}
							{customTemperature?.toFixed(2)}
						</span>
					)}
					{isCustomized && (
						<span
							className="bt-prompt-badge bt-prompt-customized"
							title="Custom prompt"
						>
							<i className="fa-solid fa-pen"></i>
						</span>
					)}
				</div>
			</div>
			<small className="bt-prompt-description">{definition.description}</small>
		</div>
	);
}

// ============================================
// Main V2 Settings Panel
// ============================================

function V2SettingsPanel() {
	const [settings, setSettings] = useState<V2Settings | null>(null);
	const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
	const [editingPrompt, setEditingPrompt] = useState<PromptTemplate<unknown> | null>(null);

	// Get all V2 prompt definitions
	const promptDefinitions = useMemo(() => getAllV2Prompts(), []);

	// Load settings and profiles
	useEffect(() => {
		const loadSettings = async () => {
			const loaded = await initializeV2Settings();
			setSettings(loaded);
			// Apply debug setting
			setDebugEnabled(loaded.v2DebugLogging);
		};
		loadSettings();

		// Load connection profiles
		const context = SillyTavern.getContext();
		const connectionManager = context.extensionSettings?.connectionManager as
			| { profiles?: ConnectionProfile[] }
			| undefined;
		setProfiles(connectionManager?.profiles || []);
	}, []);

	const handleUpdate = useCallback(
		<K extends keyof V2Settings>(key: K, value: V2Settings[K]) => {
			updateV2Setting(key, value);
			setSettings(prev => (prev ? { ...prev, [key]: value } : null));

			// Update debug mode immediately when changed
			if (key === 'v2DebugLogging') {
				setDebugEnabled(value as boolean);
			}

			// Re-render displays when display-related settings change
			if (
				key === 'v2TemperatureUnit' ||
				key === 'v2TimeFormat' ||
				key === 'v2DisplayPosition'
			) {
				mountAllV2ProjectionDisplays();
			}
		},
		[],
	);

	const handleTrackChange = useCallback(
		(key: keyof V2TrackSettings, value: boolean) => {
			if (!settings) return;
			const newTrack = { ...settings.v2Track, [key]: value };
			const enforced = updateV2Track(newTrack);
			setSettings(prev => (prev ? { ...prev, v2Track: enforced } : null));
		},
		[settings],
	);

	const handleTemperatureChange = useCallback(
		(category: keyof V2TemperatureSettings, value: number) => {
			if (!settings) return;
			const newTemps = { ...settings.v2Temperatures, [category]: value };
			handleUpdate('v2Temperatures', newTemps);
		},
		[settings, handleUpdate],
	);

	const handlePromptUpdate = useCallback(
		(key: string, value: V2CustomPrompt | null) => {
			if (!settings) return;
			const newPrompts = { ...settings.v2CustomPrompts };
			if (value === null) {
				delete newPrompts[key];
			} else {
				newPrompts[key] = value;
			}
			handleUpdate('v2CustomPrompts', newPrompts);
		},
		[settings, handleUpdate],
	);

	const handlePromptTemperatureUpdate = useCallback(
		(key: string, value: number | null) => {
			if (!settings) return;
			const newTemps = { ...settings.v2PromptTemperatures };
			if (value === null) {
				delete newTemps[key];
			} else {
				newTemps[key] = value;
			}
			handleUpdate('v2PromptTemperatures', newTemps);
		},
		[settings, handleUpdate],
	);

	if (!settings) {
		return <div className="bt-settings-loading">Loading...</div>;
	}

	return (
		<div className="blazetracker-settings-content">
			{/* Connection Profile */}
			<div className="flex-container flexFlowColumn">
				<label htmlFor="bt-v2-profile">Connection Profile</label>
				<small>
					Select which API connection to use for state extraction
				</small>
				<select
					id="bt-v2-profile"
					className="text_pole"
					value={settings.v2ProfileId}
					onChange={e => handleUpdate('v2ProfileId', e.target.value)}
				>
					<option value="">-- Select a profile --</option>
					{profiles.map(profile => (
						<option key={profile.id} value={profile.id}>
							{profile.name || profile.id}
						</option>
					))}
				</select>
			</div>

			<hr />

			{/* Auto Extract Toggle */}
			<CheckboxField
				id="bt-v2-autoextract"
				label="Auto Extract"
				description="Automatically extract state from new messages"
				checked={settings.v2AutoExtract}
				onChange={checked => handleUpdate('v2AutoExtract', checked)}
			/>
			{!settings.v2AutoExtract && (
				<div className="bt-warning-box">
					<i className="fa-solid fa-triangle-exclamation"></i>
					<span>
						<strong>Not Recommended:</strong> Some extractors
						will not run when manually extracting.
					</span>
				</div>
			)}

			<hr />

			{/* Display Settings */}
			<div className="bt-section-header">
				<strong>Display</strong>
			</div>

			<SelectField
				id="bt-v2-position"
				label="State Display Position"
				description="Show state block above or below the message"
				value={settings.v2DisplayPosition}
				options={[
					{ value: 'below', label: 'Below message' },
					{ value: 'above', label: 'Above message' },
				]}
				onChange={v =>
					handleUpdate('v2DisplayPosition', v as 'above' | 'below')
				}
			/>

			<SelectField
				id="bt-v2-tempunit"
				label="Temperature Unit"
				description="Display temperatures in Fahrenheit or Celsius"
				value={settings.v2TemperatureUnit}
				options={[
					{ value: 'fahrenheit', label: 'Fahrenheit (°F)' },
					{ value: 'celsius', label: 'Celsius (°C)' },
				]}
				onChange={v =>
					handleUpdate(
						'v2TemperatureUnit',
						v as 'fahrenheit' | 'celsius',
					)
				}
			/>

			<SelectField
				id="bt-v2-timeformat"
				label="Time Format"
				description="Display time in 12-hour or 24-hour format"
				value={settings.v2TimeFormat}
				options={[
					{ value: '12h', label: '12-hour (2:30 PM)' },
					{ value: '24h', label: '24-hour (14:30)' },
				]}
				onChange={v => handleUpdate('v2TimeFormat', v as '12h' | '24h')}
			/>

			<hr />

			{/* Tracking Toggles */}
			<div className="bt-section-header">
				<strong>Tracking</strong>
				<small>Enable or disable specific extraction modules</small>
			</div>

			<div className="bt-track-toggles">
				<TrackToggle
					id="bt-v2-track-time"
					label="Time"
					description="Track narrative date and time"
					trackKey="time"
					track={settings.v2Track}
					onChange={handleTrackChange}
				/>

				<TrackToggle
					id="bt-v2-track-location"
					label="Location"
					description="Track area, place, and position"
					trackKey="location"
					track={settings.v2Track}
					onChange={handleTrackChange}
				/>

				<TrackToggle
					id="bt-v2-track-props"
					label="Props"
					description="Track nearby objects and items"
					trackKey="props"
					track={settings.v2Track}
					onChange={handleTrackChange}
				/>

				<TrackToggle
					id="bt-v2-track-climate"
					label="Climate"
					description="Track weather and temperature"
					trackKey="climate"
					track={settings.v2Track}
					onChange={handleTrackChange}
				/>

				<TrackToggle
					id="bt-v2-track-characters"
					label="Characters"
					description="Track character positions, moods, and outfits"
					trackKey="characters"
					track={settings.v2Track}
					onChange={handleTrackChange}
				/>

				<TrackToggle
					id="bt-v2-track-relationships"
					label="Relationships"
					description="Track character relationships and attitudes"
					trackKey="relationships"
					track={settings.v2Track}
					onChange={handleTrackChange}
				/>

				<TrackToggle
					id="bt-v2-track-scene"
					label="Scene"
					description="Track scene topic, tone, and tension"
					trackKey="scene"
					track={settings.v2Track}
					onChange={handleTrackChange}
				/>

				<TrackToggle
					id="bt-v2-track-narrative"
					label="Narrative"
					description="Track events, milestones, and chapters"
					trackKey="narrative"
					track={settings.v2Track}
					onChange={handleTrackChange}
				/>
			</div>

			<hr />

			{/* Debug Toggle */}
			<CheckboxField
				id="bt-v2-debug"
				label="Debug Logging"
				description="Log debug information to browser console"
				checked={settings.v2DebugLogging}
				onChange={checked => handleUpdate('v2DebugLogging', checked)}
			/>

			<hr />

			{/* Custom Prompts Section - uses ST inline-drawer */}
			<div className="inline-drawer">
				<div className="inline-drawer-toggle inline-drawer-header">
					<b>Custom Prompts</b>
					<div className="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
				</div>
				<div className="inline-drawer-content" style={{ display: 'none' }}>
					<small className="bt-drawer-description">
						Override default extraction prompts and temperatures
					</small>
					<div className="bt-prompts-content">
						{editingPrompt ? (
							<PromptEditor
								definition={editingPrompt}
								customPrompts={
									settings.v2CustomPrompts
								}
								promptTemperatures={
									settings.v2PromptTemperatures
								}
								categoryTemperatures={
									settings.v2Temperatures
								}
								onSavePrompt={handlePromptUpdate}
								onSaveTemperature={
									handlePromptTemperatureUpdate
								}
								onClose={() =>
									setEditingPrompt(null)
								}
							/>
						) : (
							<div className="bt-prompts-list">
								{promptDefinitions.map(def => {
									const isCustomized =
										!!settings
											.v2CustomPrompts[
											def.name
										];
									const customTemp =
										settings
											.v2PromptTemperatures[
											def.name
										];
									const hasCustomTemp =
										customTemp !==
										undefined;

									return (
										<PromptListItem
											key={
												def.name
											}
											definition={
												def
											}
											isCustomized={
												isCustomized
											}
											hasCustomTemperature={
												hasCustomTemp
											}
											customTemperature={
												customTemp
											}
											onClick={() =>
												setEditingPrompt(
													def,
												)
											}
										/>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Advanced Section - uses ST inline-drawer */}
			<div className="inline-drawer">
				<div className="inline-drawer-toggle inline-drawer-header">
					<b>Advanced Settings</b>
					<div className="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
				</div>
				<div className="inline-drawer-content" style={{ display: 'none' }}>
					<small className="bt-drawer-description">
						LLM configuration and category temperature defaults
					</small>
					<div className="bt-advanced-content">
						{/* Max Tokens */}
						<div
							className="flex-container flexFlowColumn"
							style={{ marginBottom: '1em' }}
						>
							<label htmlFor="bt-v2-maxtokens">
								Max Tokens
							</label>
							<small>
								Maximum tokens for LLM extraction
								responses
							</small>
							<input
								id="bt-v2-maxtokens"
								type="number"
								className="text_pole"
								min="256"
								max="16384"
								step="256"
								value={settings.v2MaxTokens}
								onChange={e => {
									const value = parseInt(
										e.target.value,
										10,
									);
									if (
										!isNaN(value) &&
										value >= 256
									) {
										handleUpdate(
											'v2MaxTokens',
											value,
										);
									}
								}}
								style={{ width: '120px' }}
							/>
						</div>

						{/* Max Requests Per Minute */}
						<div
							className="flex-container flexFlowColumn"
							style={{ marginBottom: '1em' }}
						>
							<label htmlFor="bt-v2-maxreqs">
								Max Requests/Minute
							</label>
							<small>
								Rate limit for LLM calls (0 = no
								limit)
							</small>
							<input
								id="bt-v2-maxreqs"
								type="number"
								className="text_pole"
								min="0"
								max="300"
								step="1"
								value={settings.v2MaxReqsPerMinute}
								onChange={e => {
									const value = parseInt(
										e.target.value,
										10,
									);
									if (
										!isNaN(value) &&
										value >= 0
									) {
										handleUpdate(
											'v2MaxReqsPerMinute',
											value,
										);
									}
								}}
								style={{ width: '120px' }}
							/>
						</div>

						{/* Temperature Sliders */}
						<div className="bt-temperature-section">
							<div className="bt-section-header">
								<strong>
									Category Temperatures
								</strong>
								<small>
									Default temperatures per
									category (individual prompts
									can override)
								</small>
							</div>

							<div className="bt-temperature-grid">
								<TemperatureSlider
									category="time"
									label="Time"
									temperatures={
										settings.v2Temperatures
									}
									onChange={
										handleTemperatureChange
									}
								/>
								<TemperatureSlider
									category="location"
									label="Location"
									temperatures={
										settings.v2Temperatures
									}
									onChange={
										handleTemperatureChange
									}
								/>
								<TemperatureSlider
									category="props"
									label="Props"
									temperatures={
										settings.v2Temperatures
									}
									onChange={
										handleTemperatureChange
									}
								/>
								<TemperatureSlider
									category="climate"
									label="Climate"
									temperatures={
										settings.v2Temperatures
									}
									onChange={
										handleTemperatureChange
									}
								/>
								<TemperatureSlider
									category="characters"
									label="Characters"
									temperatures={
										settings.v2Temperatures
									}
									onChange={
										handleTemperatureChange
									}
								/>
								<TemperatureSlider
									category="relationships"
									label="Relationships"
									temperatures={
										settings.v2Temperatures
									}
									onChange={
										handleTemperatureChange
									}
								/>
								<TemperatureSlider
									category="scene"
									label="Scene"
									temperatures={
										settings.v2Temperatures
									}
									onChange={
										handleTemperatureChange
									}
								/>
								<TemperatureSlider
									category="narrative"
									label="Narrative"
									temperatures={
										settings.v2Temperatures
									}
									onChange={
										handleTemperatureChange
									}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// ============================================
// Mount Function
// ============================================

let v2SettingsRoot: ReactDOM.Root | null = null;

/**
 * Initialize V2 settings UI.
 * Replaces the V1 settings panel content.
 */
export async function initV2SettingsUI() {
	// Find the existing BlazeTracker settings container
	const existingRoot = document.getElementById('blazetracker-settings-root');
	if (existingRoot && v2SettingsRoot) {
		// Already mounted
		return;
	}

	if (existingRoot) {
		// Replace existing content with V2 UI
		v2SettingsRoot = ReactDOM.createRoot(existingRoot);
		v2SettingsRoot.render(<V2SettingsPanel />);
		return;
	}

	// If no existing container, create one
	const settingsContainer = document.getElementById('extensions_settings');
	if (!settingsContainer) {
		errorLog('Extension settings container not found.');
		return;
	}

	// Create wrapper with drawer structure
	const panel = document.createElement('div');
	panel.id = 'blazetracker-settings';
	panel.className = 'extension_container';
	panel.innerHTML = `
		<div class="inline-drawer">
			<div class="inline-drawer-toggle inline-drawer-header">
				<b>BlazeTracker</b>
				<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
			</div>
			<div class="inline-drawer-content">
				<div id="blazetracker-settings-root"></div>
			</div>
		</div>
	`;

	settingsContainer.appendChild(panel);

	// Mount React component
	const root = document.getElementById('blazetracker-settings-root');
	if (root) {
		v2SettingsRoot = ReactDOM.createRoot(root);
		v2SettingsRoot.render(<V2SettingsPanel />);
	}
}

/**
 * Unmount V2 settings UI.
 */
export function unmountV2SettingsUI() {
	if (v2SettingsRoot) {
		v2SettingsRoot.unmount();
		v2SettingsRoot = null;
	}
}

export default V2SettingsPanel;
