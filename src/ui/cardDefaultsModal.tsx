/**
 * Defaults Modal
 *
 * Generic React modal component for editing BlazeTracker defaults.
 * Used for both character cards and personas with configurable sections.
 */

import React, { useState, useEffect, useCallback, useRef, type JSX } from 'react';
import { createPortal } from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import type {
	CardExtensions,
	BTLocationExtension,
	BTTimeExtension,
	BTOutfitExtension,
	BTProfileExtension,
	BTRelationshipExtension,
	BTRelationshipsExtension,
	ProfileSex,
} from '../v2/cardExtensions/types';
import {
	readCardExtensions,
	writeAllExtensions,
	type STContextWithExtensions,
} from '../v2/cardExtensions/reader';
import { LOCATION_TYPES, OUTFIT_SLOTS, RELATIONSHIP_STATUSES } from '../v2/types/common';
import { MILESTONE_WORTHY_SUBJECTS, type Subject } from '../v2/types/subject';
import { v2SettingsManager } from '../v2/settings/manager';
import { errorLog } from '../utils/debug';

// Debounce delay for auto-save (ms)
const SAVE_DEBOUNCE_MS = 500;

/**
 * Persona defaults stored in extension settings.
 * Only outfit and profile - no location/time/relationships.
 */
export interface PersonaDefaults {
	outfit?: BTOutfitExtension;
	profile?: BTProfileExtension;
}

// ============================================
// Persona Defaults Storage
// ============================================

/**
 * Get persona defaults from extension settings.
 */
export function getPersonaDefaults(personaName: string): PersonaDefaults {
	const settings = v2SettingsManager.getSettings();
	const allDefaults = settings.v2PersonaDefaults as
		| Record<string, PersonaDefaults>
		| undefined;
	return allDefaults?.[personaName] ?? {};
}

/**
 * Save persona defaults to extension settings.
 */
export function savePersonaDefaults(personaName: string, defaults: PersonaDefaults): void {
	const settings = v2SettingsManager.getSettings();
	if (!settings.v2PersonaDefaults) {
		settings.v2PersonaDefaults = {};
	}
	(settings.v2PersonaDefaults as Record<string, PersonaDefaults>)[personaName] = defaults;
	v2SettingsManager.saveSettings();
}

// ============================================
// Generic Defaults Modal
// ============================================

type SectionType = 'location' | 'time' | 'outfit' | 'profile' | 'relationships';

interface DefaultsModalProps {
	/** Display name for the modal title */
	displayName: string;
	/** Initial data to load */
	initialData: CardExtensions;
	/** Callback to save data */
	onSave: (data: CardExtensions) => void | Promise<void>;
	/** Which sections to show */
	sections: SectionType[];
	/** Close handler */
	onClose: () => void;
}

/**
 * Generic modal component for editing defaults.
 */
function DefaultsModal({
	displayName,
	initialData,
	onSave,
	sections,
	onClose,
}: DefaultsModalProps): JSX.Element {
	const [extensions, setExtensions] = useState<CardExtensions>(initialData);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set([sections[0]]),
	);
	const [isSaving, setIsSaving] = useState(false);

	// Ref for debounced save
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Auto-save with debounce
	const saveExtensions = useCallback(
		async (newExtensions: CardExtensions) => {
			setIsSaving(true);
			try {
				await onSave(newExtensions);
			} catch (e) {
				errorLog('Failed to save defaults:', e);
			} finally {
				setIsSaving(false);
			}
		},
		[onSave],
	);

	const debouncedSave = useCallback(
		(newExtensions: CardExtensions) => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
			saveTimeoutRef.current = setTimeout(() => {
				saveExtensions(newExtensions);
			}, SAVE_DEBOUNCE_MS);
		},
		[saveExtensions],
	);

	// Update extensions and trigger save
	const updateExtensions = useCallback(
		(updater: (prev: CardExtensions) => CardExtensions) => {
			setExtensions(prev => {
				const updated = updater(prev);
				debouncedSave(updated);
				return updated;
			});
		},
		[debouncedSave],
	);

	// Toggle section expanded state
	const toggleSection = (section: string) => {
		setExpandedSections(prev => {
			const next = new Set(prev);
			if (next.has(section)) {
				next.delete(section);
			} else {
				next.add(section);
			}
			return next;
		});
	};

	// Handle overlay click (close on background click)
	const handleOverlayClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	// Clean up timeout on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, []);

	return createPortal(
		<div className="bt-card-defaults-overlay" onClick={handleOverlayClick}>
			<div className="bt-card-defaults-modal" onClick={e => e.stopPropagation()}>
				<div className="bt-card-defaults-header">
					<div className="bt-card-defaults-title">
						<i className="fa-solid fa-fire" />
						BlazeTracker Defaults
					</div>
					<div
						className="bt-card-defaults-save-indicator"
						data-saving={isSaving}
					>
						{isSaving ? 'Saving...' : 'Auto-saved'}
					</div>
					<button
						className="bt-card-defaults-close"
						onClick={e => {
							e.stopPropagation();
							onClose();
						}}
					>
						<i className="fa-solid fa-times" />
					</button>
				</div>

				<div className="bt-card-defaults-body">
					{sections.includes('location') && (
						<LocationSection
							location={extensions.location}
							expanded={expandedSections.has('location')}
							onToggle={() => toggleSection('location')}
							onChange={location =>
								updateExtensions(prev => ({
									...prev,
									location,
								}))
							}
						/>
					)}

					{sections.includes('time') && (
						<TimeSection
							time={extensions.time}
							expanded={expandedSections.has('time')}
							onToggle={() => toggleSection('time')}
							onChange={time =>
								updateExtensions(prev => ({
									...prev,
									time,
								}))
							}
						/>
					)}

					{sections.includes('outfit') && (
						<OutfitSection
							outfit={extensions.outfit}
							characterName={displayName}
							expanded={expandedSections.has('outfit')}
							onToggle={() => toggleSection('outfit')}
							onChange={outfit =>
								updateExtensions(prev => ({
									...prev,
									outfit,
								}))
							}
						/>
					)}

					{sections.includes('profile') && (
						<ProfileSection
							profile={extensions.profile}
							characterName={displayName}
							expanded={expandedSections.has('profile')}
							onToggle={() => toggleSection('profile')}
							onChange={profile =>
								updateExtensions(prev => ({
									...prev,
									profile,
								}))
							}
						/>
					)}

					{sections.includes('relationships') && (
						<RelationshipsSection
							relationships={extensions.relationships}
							characterName={displayName}
							expanded={expandedSections.has(
								'relationships',
							)}
							onToggle={() =>
								toggleSection('relationships')
							}
							onChange={relationships =>
								updateExtensions(prev => ({
									...prev,
									relationships,
								}))
							}
						/>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}

// ============================================
// Character Card Modal (Full)
// ============================================

interface CardDefaultsModalProps {
	characterId: number;
	onClose: () => void;
}

/**
 * Modal for editing character card defaults (all sections).
 */
export function CardDefaultsModal({ characterId, onClose }: CardDefaultsModalProps): JSX.Element {
	const [initialData, setInitialData] = useState<CardExtensions>({});
	const [characterName, setCharacterName] = useState('{{char}}');
	const [loaded, setLoaded] = useState(false);

	// Load extensions on mount
	useEffect(() => {
		const ctx = SillyTavern.getContext() as unknown as STContextWithExtensions;
		const loaded = readCardExtensions(characterId, ctx);
		if (loaded) {
			setInitialData(loaded);
		}
		// Get character name for display
		const char = ctx.characters[characterId];
		if (char?.name) {
			setCharacterName(char.name);
		}
		setLoaded(true);
	}, [characterId]);

	const handleSave = useCallback(
		async (data: CardExtensions) => {
			const ctx = SillyTavern.getContext() as unknown as STContextWithExtensions;
			await writeAllExtensions(data, characterId, ctx);
		},
		[characterId],
	);

	if (!loaded) {
		return <></>;
	}

	return (
		<DefaultsModal
			displayName={characterName}
			initialData={initialData}
			onSave={handleSave}
			sections={['location', 'time', 'outfit', 'profile', 'relationships']}
			onClose={onClose}
		/>
	);
}

// ============================================
// Persona Modal (Outfit & Profile only)
// ============================================

interface PersonaDefaultsModalProps {
	personaName: string;
	onClose: () => void;
}

/**
 * Modal for editing persona defaults (outfit & profile only).
 */
export function PersonaDefaultsModal({
	personaName,
	onClose,
}: PersonaDefaultsModalProps): JSX.Element {
	const [initialData, setInitialData] = useState<CardExtensions>({});
	const [loaded, setLoaded] = useState(false);

	// Load persona defaults on mount
	useEffect(() => {
		const defaults = getPersonaDefaults(personaName);
		setInitialData(defaults);
		setLoaded(true);
	}, [personaName]);

	const handleSave = useCallback(
		(data: CardExtensions) => {
			// Only save outfit and profile for personas
			const personaData: PersonaDefaults = {
				outfit: data.outfit,
				profile: data.profile,
			};
			savePersonaDefaults(personaName, personaData);
		},
		[personaName],
	);

	if (!loaded) {
		return <></>;
	}

	return (
		<DefaultsModal
			displayName={personaName}
			initialData={initialData}
			onSave={handleSave}
			sections={['outfit', 'profile']}
			onClose={onClose}
		/>
	);
}

// ============================================
// Section Components
// ============================================

interface SectionProps<T> {
	expanded: boolean;
	onToggle: () => void;
	onChange: (value: T | undefined) => void;
}

/**
 * Location section component.
 */
function LocationSection({
	location,
	expanded,
	onToggle,
	onChange,
}: SectionProps<BTLocationExtension> & { location?: BTLocationExtension }): JSX.Element {
	const enabled = location?.enabled ?? false;

	const updateField = <K extends keyof BTLocationExtension>(
		key: K,
		value: BTLocationExtension[K],
	) => {
		onChange({
			...location,
			enabled: location?.enabled ?? false,
			[key]: value,
		});
	};

	return (
		<div className={`bt-defaults-section ${expanded ? 'expanded' : ''}`}>
			<div className="bt-defaults-section-header" onClick={onToggle}>
				<div className="bt-defaults-section-title">
					<i className="fa-solid fa-location-dot" />
					Starting Location
				</div>
				<div className="bt-defaults-section-toggle">
					<label
						className="bt-defaults-enable-label"
						onClick={e => e.stopPropagation()}
					>
						<input
							type="checkbox"
							checked={enabled}
							onChange={e =>
								updateField(
									'enabled',
									e.target.checked,
								)
							}
						/>
						Enable
					</label>
					<i className="fa-solid fa-chevron-down bt-defaults-section-arrow" />
				</div>
			</div>

			<div
				className={`bt-defaults-section-content ${!enabled ? 'disabled' : ''}`}
			>
				<div className="bt-defaults-field">
					<label>Area (city, region, world)</label>
					<input
						type="text"
						value={location?.area ?? ''}
						onChange={e => updateField('area', e.target.value)}
						placeholder='e.g., "New York City, NY" or "The Shire"'
						disabled={!enabled}
					/>
				</div>

				<div className="bt-defaults-field">
					<label>Place (building, landmark)</label>
					<input
						type="text"
						value={location?.place ?? ''}
						onChange={e => updateField('place', e.target.value)}
						placeholder="e.g., John's Apartment or The Green Dragon Inn"
						disabled={!enabled}
					/>
				</div>

				<div className="bt-defaults-field">
					<label>Position (room, specific spot)</label>
					<input
						type="text"
						value={location?.position ?? ''}
						onChange={e =>
							updateField('position', e.target.value)
						}
						placeholder='e.g., "Living Room" or "By the fireplace"'
						disabled={!enabled}
					/>
				</div>

				<div className="bt-defaults-field">
					<label>Location Type</label>
					<select
						value={location?.locationType ?? 'outdoor'}
						onChange={e =>
							updateField(
								'locationType',
								e.target
									.value as BTLocationExtension['locationType'],
							)
						}
						disabled={!enabled}
					>
						{LOCATION_TYPES.map(type => (
							<option key={type} value={type}>
								{formatLocationType(type)}
							</option>
						))}
					</select>
				</div>
			</div>
		</div>
	);
}

/**
 * Time section component.
 */
function TimeSection({
	time,
	expanded,
	onToggle,
	onChange,
}: SectionProps<BTTimeExtension> & { time?: BTTimeExtension }): JSX.Element {
	const enabled = time?.enabled ?? false;

	const updateField = <K extends keyof BTTimeExtension>(
		key: K,
		value: BTTimeExtension[K],
	) => {
		onChange({
			...time,
			enabled: time?.enabled ?? false,
			[key]: value,
		});
	};

	// Convert datetime to datetime-local format
	const datetimeValue = time?.datetime
		? time.datetime.slice(0, 16) // "YYYY-MM-DDTHH:mm"
		: '';

	return (
		<div className={`bt-defaults-section ${expanded ? 'expanded' : ''}`}>
			<div className="bt-defaults-section-header" onClick={onToggle}>
				<div className="bt-defaults-section-title">
					<i className="fa-solid fa-clock" />
					Starting Time
				</div>
				<div className="bt-defaults-section-toggle">
					<label
						className="bt-defaults-enable-label"
						onClick={e => e.stopPropagation()}
					>
						<input
							type="checkbox"
							checked={enabled}
							onChange={e =>
								updateField(
									'enabled',
									e.target.checked,
								)
							}
						/>
						Enable
					</label>
					<i className="fa-solid fa-chevron-down bt-defaults-section-arrow" />
				</div>
			</div>

			<div
				className={`bt-defaults-section-content ${!enabled ? 'disabled' : ''}`}
			>
				<div className="bt-defaults-field">
					<label>Date and Time</label>
					<input
						type="datetime-local"
						value={datetimeValue}
						onChange={e =>
							updateField(
								'datetime',
								e.target.value + ':00',
							)
						}
						disabled={!enabled}
					/>
					<div className="bt-defaults-help">
						Sets the starting narrative date/time for new chats.
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Outfit section component.
 */
function OutfitSection({
	outfit,
	characterName,
	expanded,
	onToggle,
	onChange,
}: SectionProps<BTOutfitExtension> & {
	outfit?: BTOutfitExtension;
	characterName: string;
}): JSX.Element {
	const enabled = outfit?.enabled ?? false;

	const updateEnabled = (value: boolean) => {
		onChange({
			...outfit,
			enabled: value,
		});
	};

	const updateSlot = (slot: keyof BTOutfitExtension, value: string | null | undefined) => {
		onChange({
			...outfit,
			enabled: outfit?.enabled ?? false,
			[slot]: value,
		});
	};

	return (
		<div className={`bt-defaults-section ${expanded ? 'expanded' : ''}`}>
			<div className="bt-defaults-section-header" onClick={onToggle}>
				<div className="bt-defaults-section-title">
					<i className="fa-solid fa-shirt" />
					{characterName}'s Starting Outfit
				</div>
				<div className="bt-defaults-section-toggle">
					<label
						className="bt-defaults-enable-label"
						onClick={e => e.stopPropagation()}
					>
						<input
							type="checkbox"
							checked={enabled}
							onChange={e =>
								updateEnabled(e.target.checked)
							}
						/>
						Enable
					</label>
					<i className="fa-solid fa-chevron-down bt-defaults-section-arrow" />
				</div>
			</div>

			<div
				className={`bt-defaults-section-content ${!enabled ? 'disabled' : ''}`}
			>
				{OUTFIT_SLOTS.map(slot => (
					<OutfitSlotInput
						key={slot}
						slot={slot}
						value={outfit?.[slot]}
						onChange={value => updateSlot(slot, value)}
						disabled={!enabled}
					/>
				))}
				<div className="bt-defaults-help">
					Leave empty to let extraction determine. Check "Nothing" to
					explicitly set empty.
				</div>
			</div>
		</div>
	);
}

/**
 * Single outfit slot input with "Nothing" checkbox.
 */
function OutfitSlotInput({
	slot,
	value,
	onChange,
	disabled,
}: {
	slot: string;
	value: string | null | undefined;
	onChange: (value: string | null | undefined) => void;
	disabled: boolean;
}): JSX.Element {
	const isNothing = value === null;
	const textValue = value === null || value === undefined ? '' : value;

	return (
		<div className="bt-defaults-outfit-slot">
			<label>{slot}</label>
			<input
				type="text"
				value={textValue}
				onChange={e => onChange(e.target.value || undefined)}
				placeholder={`e.g., "${getSlotPlaceholder(slot)}"`}
				disabled={disabled || isNothing}
			/>
			<label className="bt-defaults-outfit-nothing">
				<input
					type="checkbox"
					checked={isNothing}
					onChange={e =>
						onChange(e.target.checked ? null : undefined)
					}
					disabled={disabled}
				/>
				Nothing
			</label>
		</div>
	);
}

/**
 * Profile section component.
 */
function ProfileSection({
	profile,
	characterName,
	expanded,
	onToggle,
	onChange,
}: SectionProps<BTProfileExtension> & {
	profile?: BTProfileExtension;
	characterName: string;
}): JSX.Element {
	const enabled = profile?.enabled ?? false;

	const updateEnabled = (value: boolean) => {
		onChange({
			...profile,
			enabled: value,
		});
	};

	const updateField = <K extends keyof BTProfileExtension>(
		key: K,
		value: BTProfileExtension[K],
	) => {
		onChange({
			...profile,
			enabled: profile?.enabled ?? false,
			[key]: value,
		});
	};

	return (
		<div className={`bt-defaults-section ${expanded ? 'expanded' : ''}`}>
			<div className="bt-defaults-section-header" onClick={onToggle}>
				<div className="bt-defaults-section-title">
					<i className="fa-solid fa-user" />
					{characterName}'s Profile
				</div>
				<div className="bt-defaults-section-toggle">
					<label
						className="bt-defaults-enable-label"
						onClick={e => e.stopPropagation()}
					>
						<input
							type="checkbox"
							checked={enabled}
							onChange={e =>
								updateEnabled(e.target.checked)
							}
						/>
						Enable
					</label>
					<i className="fa-solid fa-chevron-down bt-defaults-section-arrow" />
				</div>
			</div>

			<div
				className={`bt-defaults-section-content ${!enabled ? 'disabled' : ''}`}
			>
				<div className="bt-defaults-field">
					<label>Sex</label>
					<select
						value={profile?.sex ?? ''}
						onChange={e =>
							updateField(
								'sex',
								e.target.value === ''
									? undefined
									: (e.target
											.value as ProfileSex),
							)
						}
						disabled={!enabled}
					>
						<option value="">Let extraction determine</option>
						<option value="M">Male (M)</option>
						<option value="F">Female (F)</option>
						<option value="O">Other (O)</option>
					</select>
				</div>

				<div className="bt-defaults-field">
					<label>Species</label>
					<input
						type="text"
						value={profile?.species ?? ''}
						onChange={e =>
							updateField(
								'species',
								e.target.value || undefined,
							)
						}
						placeholder='e.g., "human", "elf", "android"'
						disabled={!enabled}
					/>
				</div>

				<div className="bt-defaults-field">
					<label>Age</label>
					<input
						type="number"
						value={profile?.age ?? ''}
						onChange={e =>
							updateField(
								'age',
								e.target.value
									? parseInt(
											e.target
												.value,
											10,
										)
									: undefined,
							)
						}
						placeholder="e.g., 25"
						disabled={!enabled}
						min={0}
					/>
				</div>

				<PillInputWithLabel
					label="Appearance"
					values={profile?.appearance ?? []}
					onChange={appearance =>
						updateField('appearance', appearance)
					}
					placeholder='e.g., "tall", "blonde hair", "green eyes"'
					disabled={!enabled}
				/>

				<PillInputWithLabel
					label="Personality"
					values={profile?.personality ?? []}
					onChange={personality =>
						updateField('personality', personality)
					}
					placeholder='e.g., "confident", "sarcastic", "loyal"'
					disabled={!enabled}
				/>

				<div className="bt-defaults-help">
					Leave empty to let extraction determine. Specified values
					will override extraction.
				</div>
			</div>
		</div>
	);
}

/**
 * Relationships section component.
 */
function RelationshipsSection({
	relationships,
	characterName,
	expanded,
	onToggle,
	onChange,
}: SectionProps<BTRelationshipsExtension> & {
	relationships?: BTRelationshipsExtension;
	characterName: string;
}): JSX.Element {
	const addRelationship = () => {
		const newRel: BTRelationshipExtension = {
			target: '{{user}}',
			status: 'strangers',
		};
		onChange([...(relationships ?? []), newRel]);
	};

	const updateRelationship = (index: number, updated: BTRelationshipExtension) => {
		const newRels = [...(relationships ?? [])];
		newRels[index] = updated;
		onChange(newRels);
	};

	const removeRelationship = (index: number) => {
		const newRels = [...(relationships ?? [])];
		newRels.splice(index, 1);
		onChange(newRels.length > 0 ? newRels : undefined);
	};

	return (
		<div className={`bt-defaults-section ${expanded ? 'expanded' : ''}`}>
			<div className="bt-defaults-section-header" onClick={onToggle}>
				<div className="bt-defaults-section-title">
					<i className="fa-solid fa-heart" />
					Relationships
				</div>
				<div className="bt-defaults-section-toggle">
					<i className="fa-solid fa-chevron-down bt-defaults-section-arrow" />
				</div>
			</div>

			<div className="bt-defaults-section-content">
				<div className="bt-defaults-help" style={{ marginBottom: '12px' }}>
					Define {characterName}'s relationships with other
					characters. These override extracted relationships for these
					pairs.
				</div>

				{(relationships ?? []).map((rel, index) => (
					<RelationshipCard
						key={index}
						relationship={rel}
						characterName={characterName}
						onChange={updated =>
							updateRelationship(index, updated)
						}
						onRemove={() => removeRelationship(index)}
					/>
				))}

				<button
					className="bt-defaults-add-relationship"
					onClick={addRelationship}
				>
					<i className="fa-solid fa-plus" />
					Add Relationship
				</button>
			</div>
		</div>
	);
}

/**
 * Single relationship card component.
 */
function RelationshipCard({
	relationship,
	characterName,
	onChange,
	onRemove,
}: {
	relationship: BTRelationshipExtension;
	characterName: string;
	onChange: (updated: BTRelationshipExtension) => void;
	onRemove: () => void;
}): JSX.Element {
	const updateField = <K extends keyof BTRelationshipExtension>(
		key: K,
		value: BTRelationshipExtension[K],
	) => {
		onChange({ ...relationship, [key]: value });
	};

	return (
		<div className="bt-defaults-relationship">
			<div className="bt-defaults-relationship-header">
				<div className="bt-defaults-relationship-target bt-defaults-field">
					<label>Relationship with</label>
					<input
						type="text"
						value={relationship.target}
						onChange={e =>
							updateField('target', e.target.value)
						}
						placeholder='e.g., "{{user}}" or character name'
					/>
				</div>
				<button
					className="bt-defaults-relationship-remove"
					onClick={onRemove}
				>
					<i className="fa-solid fa-trash" />
				</button>
			</div>

			<div className="bt-defaults-field">
				<label>Status</label>
				<select
					value={relationship.status ?? 'strangers'}
					onChange={e =>
						updateField(
							'status',
							e.target
								.value as BTRelationshipExtension['status'],
						)
					}
				>
					{RELATIONSHIP_STATUSES.map(status => (
						<option key={status} value={status}>
							{formatStatus(status)}
						</option>
					))}
				</select>
			</div>

			{/* {{char}} → Target */}
			<div className="bt-defaults-attitude">
				<div className="bt-defaults-attitude-title">
					{characterName} → {relationship.target || 'Target'}
				</div>
				<PillInput
					label="Feelings"
					values={relationship.charToTarget?.feelings ?? []}
					onChange={feelings =>
						updateField('charToTarget', {
							...(relationship.charToTarget ?? {}),
							feelings,
						})
					}
					placeholder="e.g., curious, attracted"
				/>
				<PillInput
					label="Secrets"
					values={relationship.charToTarget?.secrets ?? []}
					onChange={secrets =>
						updateField('charToTarget', {
							...(relationship.charToTarget ?? {}),
							secrets,
						})
					}
					placeholder="e.g., has a crush"
				/>
				<PillInput
					label="Wants"
					values={relationship.charToTarget?.wants ?? []}
					onChange={wants =>
						updateField('charToTarget', {
							...(relationship.charToTarget ?? {}),
							wants,
						})
					}
					placeholder="e.g., to get closer"
				/>
			</div>

			{/* Target → {{char}} */}
			<div className="bt-defaults-attitude">
				<div className="bt-defaults-attitude-title">
					{relationship.target || 'Target'} → {characterName}
				</div>
				<PillInput
					label="Feelings"
					values={relationship.targetToChar?.feelings ?? []}
					onChange={feelings =>
						updateField('targetToChar', {
							...(relationship.targetToChar ?? {}),
							feelings,
						})
					}
					placeholder="e.g., friendly, trusting"
				/>
				<PillInput
					label="Secrets"
					values={relationship.targetToChar?.secrets ?? []}
					onChange={secrets =>
						updateField('targetToChar', {
							...(relationship.targetToChar ?? {}),
							secrets,
						})
					}
					placeholder="e.g., secretly admires"
				/>
				<PillInput
					label="Wants"
					values={relationship.targetToChar?.wants ?? []}
					onChange={wants =>
						updateField('targetToChar', {
							...(relationship.targetToChar ?? {}),
							wants,
						})
					}
					placeholder="e.g., friendship"
				/>
			</div>

			{/* Milestones */}
			<div className="bt-defaults-milestones">
				<div className="bt-defaults-milestones-title">
					Milestones (pre-set for status gating)
				</div>
				<MilestonesCheckboxes
					selected={relationship.milestones ?? []}
					onChange={milestones =>
						updateField('milestones', milestones)
					}
				/>
			</div>
		</div>
	);
}

/**
 * Pill input component for array values (feelings, secrets, wants).
 */
function PillInput({
	label,
	values,
	onChange,
	placeholder,
}: {
	label: string;
	values: string[];
	onChange: (values: string[]) => void;
	placeholder: string;
}): JSX.Element {
	const [inputValue, setInputValue] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const addValue = (value: string) => {
		const trimmed = value.trim();
		if (trimmed && !values.includes(trimmed)) {
			onChange([...values, trimmed]);
		}
		setInputValue('');
	};

	const removeValue = (index: number) => {
		const newValues = [...values];
		newValues.splice(index, 1);
		onChange(newValues);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && inputValue.trim()) {
			e.preventDefault();
			addValue(inputValue);
		} else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
			removeValue(values.length - 1);
		}
	};

	return (
		<div className="bt-defaults-pill-input">
			<div className="bt-defaults-pill-label">{label}</div>
			<div
				className="bt-defaults-pills-container"
				onClick={() => inputRef.current?.focus()}
			>
				{values.map((value, index) => (
					<span key={index} className="bt-defaults-pill">
						{value}
						<button
							className="bt-defaults-pill-remove"
							onClick={e => {
								e.stopPropagation();
								removeValue(index);
							}}
						>
							×
						</button>
					</span>
				))}
				<input
					ref={inputRef}
					type="text"
					className="bt-defaults-pill-input-field"
					value={inputValue}
					onChange={e => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => inputValue.trim() && addValue(inputValue)}
					placeholder={values.length === 0 ? placeholder : ''}
				/>
			</div>
		</div>
	);
}

/**
 * Pill input with label for the profile section.
 * Similar to PillInput but supports disabled state.
 */
function PillInputWithLabel({
	label,
	values,
	onChange,
	placeholder,
	disabled,
}: {
	label: string;
	values: string[];
	onChange: (values: string[]) => void;
	placeholder: string;
	disabled: boolean;
}): JSX.Element {
	const [inputValue, setInputValue] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const addValue = (value: string) => {
		if (disabled) return;
		const trimmed = value.trim();
		if (trimmed && !values.includes(trimmed)) {
			onChange([...values, trimmed]);
		}
		setInputValue('');
	};

	const removeValue = (index: number) => {
		if (disabled) return;
		const newValues = [...values];
		newValues.splice(index, 1);
		onChange(newValues);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return;
		if (e.key === 'Enter' && inputValue.trim()) {
			e.preventDefault();
			addValue(inputValue);
		} else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
			removeValue(values.length - 1);
		}
	};

	return (
		<div className="bt-defaults-field">
			<label>{label}</label>
			<div
				className={`bt-defaults-pills-container ${disabled ? 'disabled' : ''}`}
				onClick={() => !disabled && inputRef.current?.focus()}
			>
				{values.map((value, index) => (
					<span key={index} className="bt-defaults-pill">
						{value}
						<button
							className="bt-defaults-pill-remove"
							onClick={e => {
								e.stopPropagation();
								removeValue(index);
							}}
							disabled={disabled}
						>
							×
						</button>
					</span>
				))}
				<input
					ref={inputRef}
					type="text"
					className="bt-defaults-pill-input-field"
					value={inputValue}
					onChange={e => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => inputValue.trim() && addValue(inputValue)}
					placeholder={values.length === 0 ? placeholder : ''}
					disabled={disabled}
				/>
			</div>
		</div>
	);
}

/**
 * Milestones checkboxes component.
 */
function MilestonesCheckboxes({
	selected,
	onChange,
}: {
	selected: Subject[];
	onChange: (milestones: Subject[]) => void;
}): JSX.Element {
	const toggleMilestone = (subject: Subject) => {
		if (selected.includes(subject)) {
			onChange(selected.filter(s => s !== subject));
		} else {
			onChange([...selected, subject]);
		}
	};

	// Group milestones by category for display
	const displayMilestones = MILESTONE_WORTHY_SUBJECTS.slice(0, 20); // Limit for UI

	return (
		<div className="bt-defaults-milestones-grid">
			{displayMilestones.map(subject => (
				<label key={subject} className="bt-defaults-milestone-check">
					<input
						type="checkbox"
						checked={selected.includes(subject)}
						onChange={() => toggleMilestone(subject)}
					/>
					{formatSubject(subject)}
				</label>
			))}
		</div>
	);
}

// ============================================
// Helper Functions
// ============================================

function formatLocationType(type: string): string {
	const labels: Record<string, string> = {
		outdoor: 'Outdoor',
		modern: 'Modern (HVAC)',
		heated: 'Heated (Fireplace)',
		unheated: 'Unheated (Barn)',
		underground: 'Underground',
		tent: 'Tent',
		vehicle: 'Vehicle',
	};
	return labels[type] ?? type;
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatSubject(subject: string): string {
	return subject.replace(/_/g, ' ');
}

function getSlotPlaceholder(slot: string): string {
	const placeholders: Record<string, string> = {
		head: 'Baseball cap',
		neck: 'Silver necklace',
		torso: 'White t-shirt',
		jacket: 'Leather jacket',
		back: 'Backpack',
		legs: 'Blue jeans',
		underwear: 'Boxers',
		socks: 'White socks',
		footwear: 'Sneakers',
	};
	return placeholders[slot] ?? slot;
}

// ============================================
// Export Modal Controllers
// ============================================

let modalRoot: HTMLDivElement | null = null;
let activeRoot: ReactDOMClient.Root | null = null;

/**
 * Close any open defaults modal.
 */
export function closeDefaultsModal(): void {
	if (activeRoot) {
		activeRoot.unmount();
		activeRoot = null;
	}
	if (modalRoot) {
		modalRoot.remove();
		modalRoot = null;
	}
}

/**
 * Open the card defaults modal for a character.
 */
export function openCardDefaultsModal(characterId: number): void {
	// Close any existing modal
	closeDefaultsModal();

	// Create root element
	modalRoot = document.createElement('div');
	modalRoot.id = 'bt-card-defaults-root';
	document.body.appendChild(modalRoot);

	// Render using React 18 createRoot
	activeRoot = ReactDOMClient.createRoot(modalRoot);
	activeRoot.render(
		<CardDefaultsModal characterId={characterId} onClose={closeDefaultsModal} />,
	);
}

/**
 * Open the persona defaults modal.
 */
export function openPersonaDefaultsModal(personaName: string): void {
	// Close any existing modal
	closeDefaultsModal();

	// Create root element
	modalRoot = document.createElement('div');
	modalRoot.id = 'bt-persona-defaults-root';
	document.body.appendChild(modalRoot);

	// Render using React 18 createRoot
	activeRoot = ReactDOMClient.createRoot(modalRoot);
	activeRoot.render(
		<PersonaDefaultsModal personaName={personaName} onClose={closeDefaultsModal} />,
	);
}

// Keep old function name for backwards compatibility
export const closeCardDefaultsModal = closeDefaultsModal;
