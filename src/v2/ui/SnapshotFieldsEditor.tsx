/**
 * Snapshot Fields Editor
 *
 * Controlled form component for editing all fields of an initial snapshot.
 * Uses collapsible <details> sections for each state category.
 * All updates are immutable - each change produces a new snapshot object.
 */

import { useState, useCallback } from 'react';
import type {
	Snapshot,
	CharacterState,
	CharacterProfile,
	RelationshipState,
} from '../types/snapshot';
import {
	cloneSnapshot,
	createEmptyCharacterState,
	createEmptyRelationshipState,
	createEmptySceneState,
	sortPair,
	getRelationshipKey,
} from '../types/snapshot';
import type { LocationState, OutfitSlot } from '../types/common';
import {
	LOCATION_TYPES,
	TENSION_LEVELS,
	TENSION_TYPES,
	TENSION_DIRECTIONS,
	RELATIONSHIP_STATUSES,
	OUTFIT_SLOTS,
	createEmptyLocationState,
} from '../types/common';
import { TagInput } from '../../ui/components/form/TagInput';

interface SnapshotFieldsEditorProps {
	snapshot: Snapshot;
	onChange: (snapshot: Snapshot) => void;
}

export function SnapshotFieldsEditor({ snapshot, onChange }: SnapshotFieldsEditorProps) {
	const [newCharName, setNewCharName] = useState('');
	const [newRelA, setNewRelA] = useState('');
	const [newRelB, setNewRelB] = useState('');

	// Helper to produce a new snapshot with updated fields
	const update = useCallback(
		(updater: (draft: Snapshot) => void) => {
			const next = cloneSnapshot(snapshot);
			updater(next);
			onChange(next);
		},
		[snapshot, onChange],
	);

	const characterNames = Object.keys(snapshot.characters);

	return (
		<div className="bt-snapshot-editor">
			{/* ====== Time ====== */}
			<details className="bt-snapshot-section" open>
				<summary className="bt-snapshot-section-header">
					<i className="fa-regular fa-clock"></i> Time
				</summary>
				<div className="bt-snapshot-section-body">
					{snapshot.time !== null ? (
						<div className="bt-snapshot-field">
							<input
								type="datetime-local"
								value={isoToDatetimeLocal(
									snapshot.time,
								)}
								onChange={e =>
									update(s => {
										s.time =
											datetimeLocalToIso(
												e
													.target
													.value,
											);
									})
								}
							/>
							<button
								className="bt-snapshot-remove-btn"
								onClick={() =>
									update(s => {
										s.time = null;
									})
								}
								title="Clear time"
							>
								<i className="fa-solid fa-times"></i>
							</button>
						</div>
					) : (
						<button
							className="bt-snapshot-add-btn"
							onClick={() =>
								update(s => {
									s.time =
										new Date().toISOString();
								})
							}
						>
							<i className="fa-solid fa-plus"></i> Set
							Time
						</button>
					)}
				</div>
			</details>

			{/* ====== Location ====== */}
			<details className="bt-snapshot-section" open>
				<summary className="bt-snapshot-section-header">
					<i className="fa-solid fa-location-dot"></i> Location
				</summary>
				<div className="bt-snapshot-section-body">
					{snapshot.location !== null ? (
						<>
							<div className="bt-snapshot-field">
								<label>Area</label>
								<input
									type="text"
									value={
										snapshot.location
											.area
									}
									onChange={e =>
										update(s => {
											s.location!.area =
												e.target.value;
										})
									}
									placeholder="Area name"
								/>
							</div>
							<div className="bt-snapshot-field">
								<label>Place</label>
								<input
									type="text"
									value={
										snapshot.location
											.place
									}
									onChange={e =>
										update(s => {
											s.location!.place =
												e.target.value;
										})
									}
									placeholder="Place name"
								/>
							</div>
							<div className="bt-snapshot-field">
								<label>Position</label>
								<input
									type="text"
									value={
										snapshot.location
											.position
									}
									onChange={e =>
										update(s => {
											s.location!.position =
												e.target.value;
										})
									}
									placeholder="Position description"
								/>
							</div>
							<div className="bt-snapshot-field">
								<label>Type</label>
								<select
									value={
										snapshot.location
											.locationType
									}
									onChange={e =>
										update(s => {
											s.location!.locationType =
												e
													.target
													.value as LocationState['locationType'];
										})
									}
								>
									{LOCATION_TYPES.map(t => (
										<option
											key={t}
											value={t}
										>
											{t}
										</option>
									))}
								</select>
							</div>
							<div className="bt-snapshot-field">
								<label>Props</label>
								<TagInput
									tags={
										snapshot.location
											.props
									}
									onChange={tags =>
										update(s => {
											s.location!.props =
												tags;
										})
									}
									placeholder="Add prop..."
								/>
							</div>
							<button
								className="bt-snapshot-remove-btn"
								onClick={() =>
									update(s => {
										s.location = null;
									})
								}
							>
								<i className="fa-solid fa-times"></i>{' '}
								Clear Location
							</button>
						</>
					) : (
						<button
							className="bt-snapshot-add-btn"
							onClick={() =>
								update(s => {
									s.location =
										createEmptyLocationState();
								})
							}
						>
							<i className="fa-solid fa-plus"></i> Add
							Location
						</button>
					)}
				</div>
			</details>

			{/* ====== Scene ====== */}
			<details className="bt-snapshot-section" open>
				<summary className="bt-snapshot-section-header">
					<i className="fa-solid fa-theater-masks"></i> Scene
				</summary>
				<div className="bt-snapshot-section-body">
					{snapshot.scene !== null ? (
						<>
							<div className="bt-snapshot-field">
								<label>Topic</label>
								<input
									type="text"
									value={snapshot.scene.topic}
									onChange={e =>
										update(s => {
											s.scene!.topic =
												e.target.value;
										})
									}
									placeholder="Scene topic"
								/>
							</div>
							<div className="bt-snapshot-field">
								<label>Tone</label>
								<input
									type="text"
									value={snapshot.scene.tone}
									onChange={e =>
										update(s => {
											s.scene!.tone =
												e.target.value;
										})
									}
									placeholder="Scene tone"
								/>
							</div>
							<div className="bt-snapshot-field">
								<label>Tension Level</label>
								<select
									value={
										snapshot.scene
											.tension
											.level
									}
									onChange={e =>
										update(s => {
											s.scene!.tension.level =
												e
													.target
													.value as typeof snapshot.scene.tension.level;
										})
									}
								>
									{TENSION_LEVELS.map(l => (
										<option
											key={l}
											value={l}
										>
											{l}
										</option>
									))}
								</select>
							</div>
							<div className="bt-snapshot-field">
								<label>Tension Type</label>
								<select
									value={
										snapshot.scene
											.tension
											.type
									}
									onChange={e =>
										update(s => {
											s.scene!.tension.type =
												e
													.target
													.value as typeof snapshot.scene.tension.type;
										})
									}
								>
									{TENSION_TYPES.map(t => (
										<option
											key={t}
											value={t}
										>
											{t}
										</option>
									))}
								</select>
							</div>
							<div className="bt-snapshot-field">
								<label>Tension Direction</label>
								<select
									value={
										snapshot.scene
											.tension
											.direction
									}
									onChange={e =>
										update(s => {
											s.scene!.tension.direction =
												e
													.target
													.value as typeof snapshot.scene.tension.direction;
										})
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
												{d}
											</option>
										),
									)}
								</select>
							</div>
							<button
								className="bt-snapshot-remove-btn"
								onClick={() =>
									update(s => {
										s.scene = null;
									})
								}
							>
								<i className="fa-solid fa-times"></i>{' '}
								Clear Scene
							</button>
						</>
					) : (
						<button
							className="bt-snapshot-add-btn"
							onClick={() =>
								update(s => {
									s.scene =
										createEmptySceneState();
								})
							}
						>
							<i className="fa-solid fa-plus"></i> Add
							Scene
						</button>
					)}
				</div>
			</details>

			{/* ====== Characters ====== */}
			<details className="bt-snapshot-section" open>
				<summary className="bt-snapshot-section-header">
					<i className="fa-solid fa-users"></i> Characters (
					{characterNames.length})
				</summary>
				<div className="bt-snapshot-section-body">
					{characterNames.map(name => (
						<CharacterEditor
							key={name}
							character={snapshot.characters[name]}
							onUpdate={updated =>
								update(s => {
									s.characters[name] =
										updated;
								})
							}
							onDelete={() =>
								update(s => {
									delete s.characters[name];
									// Remove relationships involving this character
									for (const key of Object.keys(
										s.relationships,
									)) {
										const rel =
											s
												.relationships[
												key
											];
										if (
											rel
												.pair[0] ===
												name ||
											rel
												.pair[1] ===
												name
										) {
											delete s
												.relationships[
												key
											];
										}
									}
								})
							}
						/>
					))}

					<div className="bt-snapshot-add-row">
						<input
							type="text"
							value={newCharName}
							onChange={e =>
								setNewCharName(e.target.value)
							}
							onKeyDown={e => {
								if (e.key === 'Enter') {
									e.preventDefault();
									addCharacter();
								}
							}}
							placeholder="Character name..."
						/>
						<button
							className="bt-snapshot-add-btn"
							onClick={addCharacter}
							disabled={
								!newCharName.trim() ||
								newCharName.trim() in
									snapshot.characters
							}
						>
							<i className="fa-solid fa-plus"></i> Add
							Character
						</button>
					</div>
				</div>
			</details>

			{/* ====== Relationships ====== */}
			<details className="bt-snapshot-section" open>
				<summary className="bt-snapshot-section-header">
					<i className="fa-solid fa-heart"></i> Relationships (
					{Object.keys(snapshot.relationships).length})
				</summary>
				<div className="bt-snapshot-section-body">
					{Object.entries(snapshot.relationships).map(
						([key, rel]) => (
							<RelationshipEditor
								key={key}
								relationship={rel}
								onUpdate={updated =>
									update(s => {
										s.relationships[
											key
										] = updated;
									})
								}
								onDelete={() =>
									update(s => {
										delete s
											.relationships[
											key
										];
									})
								}
							/>
						),
					)}

					{characterNames.length >= 2 && (
						<div className="bt-snapshot-add-row">
							<select
								value={newRelA}
								onChange={e =>
									setNewRelA(e.target.value)
								}
							>
								<option value="">
									Character A...
								</option>
								{characterNames.map(n => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
							<select
								value={newRelB}
								onChange={e =>
									setNewRelB(e.target.value)
								}
							>
								<option value="">
									Character B...
								</option>
								{characterNames
									.filter(n => n !== newRelA)
									.map(n => (
										<option
											key={n}
											value={n}
										>
											{n}
										</option>
									))}
							</select>
							<button
								className="bt-snapshot-add-btn"
								onClick={addRelationship}
								disabled={!canAddRelationship()}
							>
								<i className="fa-solid fa-plus"></i>{' '}
								Add
							</button>
						</div>
					)}
				</div>
			</details>
		</div>
	);

	function addCharacter() {
		const name = newCharName.trim();
		if (!name || name in snapshot.characters) return;
		update(s => {
			s.characters[name] = createEmptyCharacterState(name);
		});
		setNewCharName('');
	}

	function canAddRelationship(): boolean {
		if (!newRelA || !newRelB || newRelA === newRelB) return false;
		const pair = sortPair(newRelA, newRelB);
		const key = getRelationshipKey(pair);
		return !(key in snapshot.relationships);
	}

	function addRelationship() {
		if (!canAddRelationship()) return;
		const pair = sortPair(newRelA, newRelB);
		const key = getRelationshipKey(pair);
		update(s => {
			s.relationships[key] = createEmptyRelationshipState(pair);
		});
		setNewRelA('');
		setNewRelB('');
	}
}

// ============================================
// Character Editor
// ============================================

interface CharacterEditorProps {
	character: CharacterState;
	onUpdate: (character: CharacterState) => void;
	onDelete: () => void;
}

function CharacterEditor({ character, onUpdate, onDelete }: CharacterEditorProps) {
	const updateField = <K extends keyof CharacterState>(key: K, value: CharacterState[K]) => {
		onUpdate({ ...character, [key]: value });
	};

	const updateProfile = (profile: CharacterProfile | undefined) => {
		onUpdate({ ...character, profile });
	};

	const updateOutfitSlot = (slot: OutfitSlot, value: string | null) => {
		onUpdate({
			...character,
			outfit: { ...character.outfit, [slot]: value || null },
		});
	};

	return (
		<details className="bt-snapshot-char-card">
			<summary className="bt-snapshot-char-header">
				<span className="bt-snapshot-char-name">{character.name}</span>
				<button
					className="bt-snapshot-remove-btn bt-snapshot-delete-char"
					onClick={e => {
						e.preventDefault();
						onDelete();
					}}
					title="Delete character"
				>
					<i className="fa-solid fa-trash"></i>
				</button>
			</summary>
			<div className="bt-snapshot-char-body">
				{/* Profile */}
				<div className="bt-snapshot-subsection">
					<div className="bt-snapshot-subsection-header">
						<span>Profile</span>
						{character.profile ? (
							<button
								className="bt-snapshot-remove-btn"
								onClick={() =>
									updateProfile(undefined)
								}
							>
								<i className="fa-solid fa-times"></i>
							</button>
						) : (
							<button
								className="bt-snapshot-add-btn"
								onClick={() =>
									updateProfile({
										sex: 'O',
										species: '',
										age: 0,
										appearance: [],
										personality: [],
									})
								}
							>
								<i className="fa-solid fa-plus"></i>{' '}
								Add
							</button>
						)}
					</div>
					{character.profile && (
						<div className="bt-snapshot-profile-fields">
							<div className="bt-snapshot-field">
								<label>Sex</label>
								<select
									value={
										character.profile
											.sex
									}
									onChange={e =>
										updateProfile({
											...character.profile!,
											sex: e
												.target
												.value as CharacterProfile['sex'],
										})
									}
								>
									<option value="M">
										Male
									</option>
									<option value="F">
										Female
									</option>
									<option value="O">
										Other
									</option>
								</select>
							</div>
							<div className="bt-snapshot-field">
								<label>Species</label>
								<input
									type="text"
									value={
										character.profile
											.species
									}
									onChange={e =>
										updateProfile({
											...character.profile!,
											species: e
												.target
												.value,
										})
									}
									placeholder="Species"
								/>
							</div>
							<div className="bt-snapshot-field">
								<label>Age</label>
								<input
									type="number"
									value={
										character.profile
											.age
									}
									onChange={e =>
										updateProfile({
											...character.profile!,
											age:
												parseInt(
													e
														.target
														.value,
												) ||
												0,
										})
									}
									min="0"
								/>
							</div>
							<div className="bt-snapshot-field">
								<label>Appearance</label>
								<TagInput
									tags={
										character.profile
											.appearance
									}
									onChange={tags =>
										updateProfile({
											...character.profile!,
											appearance: tags,
										})
									}
									placeholder="Add trait..."
								/>
							</div>
							<div className="bt-snapshot-field">
								<label>Personality</label>
								<TagInput
									tags={
										character.profile
											.personality
									}
									onChange={tags =>
										updateProfile({
											...character.profile!,
											personality:
												tags,
										})
									}
									placeholder="Add trait..."
								/>
							</div>
						</div>
					)}
				</div>

				{/* Position & Activity */}
				<div className="bt-snapshot-field">
					<label>Position</label>
					<input
						type="text"
						value={character.position}
						onChange={e =>
							updateField('position', e.target.value)
						}
						placeholder="Position"
					/>
				</div>
				<div className="bt-snapshot-field">
					<label>Activity</label>
					<input
						type="text"
						value={character.activity || ''}
						onChange={e =>
							updateField(
								'activity',
								e.target.value || null,
							)
						}
						placeholder="Activity"
					/>
				</div>

				{/* Mood & Physical State */}
				<div className="bt-snapshot-field">
					<label>Mood</label>
					<TagInput
						tags={character.mood}
						onChange={tags => updateField('mood', tags)}
						placeholder="Add mood..."
					/>
				</div>
				<div className="bt-snapshot-field">
					<label>Physical State</label>
					<TagInput
						tags={character.physicalState}
						onChange={tags =>
							updateField('physicalState', tags)
						}
						placeholder="Add state..."
					/>
				</div>

				{/* Outfit */}
				<div className="bt-snapshot-subsection">
					<div className="bt-snapshot-subsection-header">
						<span>Outfit</span>
					</div>
					<div className="bt-outfit-grid">
						{OUTFIT_SLOTS.map(slot => (
							<div key={slot} className="bt-outfit-slot">
								<label>{slot}</label>
								<div className="bt-outfit-row">
									<input
										type="text"
										value={
											character
												.outfit[
												slot
											] || ''
										}
										onChange={e =>
											updateOutfitSlot(
												slot,
												e
													.target
													.value,
											)
										}
										placeholder="None"
									/>
									{character.outfit[slot] && (
										<button
											type="button"
											onClick={() =>
												updateOutfitSlot(
													slot,
													null,
												)
											}
											className="bt-x"
										>
											&times;
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</details>
	);
}

// ============================================
// Relationship Editor
// ============================================

interface RelationshipEditorProps {
	relationship: RelationshipState;
	onUpdate: (relationship: RelationshipState) => void;
	onDelete: () => void;
}

function RelationshipEditor({ relationship, onUpdate, onDelete }: RelationshipEditorProps) {
	const [charA, charB] = relationship.pair;

	return (
		<details className="bt-snapshot-rel-card">
			<summary className="bt-snapshot-rel-header">
				<span className="bt-snapshot-rel-pair">
					{charA} & {charB}
				</span>
				<span className="bt-snapshot-rel-status">
					{relationship.status}
				</span>
				<button
					className="bt-snapshot-remove-btn bt-snapshot-delete-rel"
					onClick={e => {
						e.preventDefault();
						onDelete();
					}}
					title="Delete relationship"
				>
					<i className="fa-solid fa-trash"></i>
				</button>
			</summary>
			<div className="bt-snapshot-rel-body">
				<div className="bt-snapshot-field">
					<label>Status</label>
					<select
						value={relationship.status}
						onChange={e =>
							onUpdate({
								...relationship,
								status: e.target
									.value as RelationshipState['status'],
							})
						}
					>
						{RELATIONSHIP_STATUSES.map(s => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				</div>

				{/* A → B */}
				<div className="bt-snapshot-attitude">
					<div className="bt-snapshot-attitude-label">
						{charA} → {charB}
					</div>
					<div className="bt-snapshot-field">
						<label>Feelings</label>
						<TagInput
							tags={relationship.aToB.feelings}
							onChange={tags =>
								onUpdate({
									...relationship,
									aToB: {
										...relationship.aToB,
										feelings: tags,
									},
								})
							}
							placeholder="Add feeling..."
						/>
					</div>
					<div className="bt-snapshot-field">
						<label>Secrets</label>
						<TagInput
							tags={relationship.aToB.secrets}
							onChange={tags =>
								onUpdate({
									...relationship,
									aToB: {
										...relationship.aToB,
										secrets: tags,
									},
								})
							}
							placeholder="Add secret..."
						/>
					</div>
					<div className="bt-snapshot-field">
						<label>Wants</label>
						<TagInput
							tags={relationship.aToB.wants}
							onChange={tags =>
								onUpdate({
									...relationship,
									aToB: {
										...relationship.aToB,
										wants: tags,
									},
								})
							}
							placeholder="Add want..."
						/>
					</div>
				</div>

				{/* B → A */}
				<div className="bt-snapshot-attitude">
					<div className="bt-snapshot-attitude-label">
						{charB} → {charA}
					</div>
					<div className="bt-snapshot-field">
						<label>Feelings</label>
						<TagInput
							tags={relationship.bToA.feelings}
							onChange={tags =>
								onUpdate({
									...relationship,
									bToA: {
										...relationship.bToA,
										feelings: tags,
									},
								})
							}
							placeholder="Add feeling..."
						/>
					</div>
					<div className="bt-snapshot-field">
						<label>Secrets</label>
						<TagInput
							tags={relationship.bToA.secrets}
							onChange={tags =>
								onUpdate({
									...relationship,
									bToA: {
										...relationship.bToA,
										secrets: tags,
									},
								})
							}
							placeholder="Add secret..."
						/>
					</div>
					<div className="bt-snapshot-field">
						<label>Wants</label>
						<TagInput
							tags={relationship.bToA.wants}
							onChange={tags =>
								onUpdate({
									...relationship,
									bToA: {
										...relationship.bToA,
										wants: tags,
									},
								})
							}
							placeholder="Add want..."
						/>
					</div>
				</div>
			</div>
		</details>
	);
}

// ============================================
// Helpers
// ============================================

/**
 * Convert ISO string to datetime-local input format.
 */
function isoToDatetimeLocal(iso: string): string {
	const d = new Date(iso);
	if (isNaN(d.getTime())) return '';
	// Format as YYYY-MM-DDThh:mm
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local input value to ISO string.
 */
function datetimeLocalToIso(value: string): string {
	if (!value) return new Date().toISOString();
	return new Date(value).toISOString();
}
