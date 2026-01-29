import React, {
	useState,
	useCallback,
	useMemo,
	useRef,
	useImperativeHandle,
	forwardRef,
} from 'react';
import type {
	StateEvent,
	InitialTimeEvent,
	TimeEvent,
	LocationMovedEvent,
	CharacterEvent,
	CharacterEventSubkind,
	OutfitSlot,
	LocationPropEvent,
	LocationPropSubkind,
	RelationshipEvent,
	DirectionalRelationshipEvent,
	StatusChangedEvent,
	RelationshipEventSubkind,
	DirectionalRelationshipSubkind,
	RelationshipStatus,
	ProjectedState,
} from '../../types/state';
import {
	isInitialTimeEvent,
	isTimeEvent,
	isLocationMovedEvent,
	isCharacterEvent,
	isLocationPropEvent,
	isRelationshipEvent,
	RELATIONSHIP_STATUSES,
} from '../../types/state';
import { generateUUID } from '../../state/eventStore';
import {
	CHARACTER_SUBKIND_ICONS,
	STATE_EVENT_COLORS,
	getCharacterEventColor,
	getRelationshipSubkindIcon,
	getRelationshipEventColor,
	formatSubkindLabel,
} from '../icons';
import { sortPair } from '../../state/relationships';

/** Handle for accessing pending edits from parent */
export interface StateEventEditorHandle {
	/** Commit any pending inline edits and return the final events array */
	commitPendingEdits: () => StateEvent[];
}

interface StateEventEditorProps {
	events: StateEvent[];
	messageId: number;
	swipeId: number;
	onEventsChange: (events: StateEvent[]) => void;
	/** Current projected state for populating dropdowns */
	projection: ProjectedState;
}

type EventKind = 'time' | 'location' | 'location_prop' | 'character' | 'relationship';

/** Handle for inline editors to expose their current state */
interface InlineEditorHandle {
	getCurrentState: () => Partial<StateEvent>;
}

/**
 * Editor for StateEvents on a single message.
 * Shows events grouped by kind with edit/delete functionality.
 */
export const StateEventEditor = forwardRef<StateEventEditorHandle, StateEventEditorProps>(
	function StateEventEditor({ events, messageId, swipeId, onEventsChange, projection }, ref) {
		const [showAddMenu, setShowAddMenu] = useState(false);
		const [collapsedGroups, setCollapsedGroups] = useState<Set<EventKind>>(new Set());

		// Track which event is being edited and its ref
		const [editingEventId, setEditingEventId] = useState<string | null>(null);
		const inlineEditorRef = useRef<InlineEditorHandle>(null);

		// Group events by kind
		const groupedEvents = useMemo(() => {
			const timeEvents: (InitialTimeEvent | TimeEvent)[] = [];
			const locationMovedEvents: LocationMovedEvent[] = [];
			const locationPropEvents: LocationPropEvent[] = [];
			const characterEvents: CharacterEvent[] = [];
			const relationshipEvents: RelationshipEvent[] = [];

			for (const event of events) {
				if (isInitialTimeEvent(event) || isTimeEvent(event)) {
					timeEvents.push(event);
				} else if (isLocationMovedEvent(event)) {
					locationMovedEvents.push(event);
				} else if (isLocationPropEvent(event)) {
					locationPropEvents.push(event);
				} else if (isCharacterEvent(event)) {
					characterEvents.push(event);
				} else if (isRelationshipEvent(event)) {
					relationshipEvents.push(event);
				}
			}

			return {
				timeEvents,
				locationMovedEvents,
				locationPropEvents,
				characterEvents,
				relationshipEvents,
			};
		}, [events]);

		const toggleGroup = useCallback((kind: EventKind) => {
			setCollapsedGroups(prev => {
				const next = new Set(prev);
				if (next.has(kind)) {
					next.delete(kind);
				} else {
					next.add(kind);
				}
				return next;
			});
		}, []);

		const handleDelete = useCallback(
			(eventId: string) => {
				onEventsChange(events.filter(e => e.id !== eventId));
			},
			[events, onEventsChange],
		);

		const handleUpdateEvent = useCallback(
			(eventId: string, updates: Partial<StateEvent>) => {
				onEventsChange(
					events.map(e =>
						e.id === eventId ? { ...e, ...updates } : e,
					) as StateEvent[],
				);
			},
			[events, onEventsChange],
		);

		const handleAddEvent = useCallback(
			(
				kind: EventKind,
				subkind?:
					| CharacterEventSubkind
					| LocationPropSubkind
					| RelationshipEventSubkind,
				prefill?: Partial<StateEvent>,
			) => {
				const baseEvent = {
					id: generateUUID(),
					messageId,
					swipeId,
					timestamp: Date.now(),
				};

				let newEvent: StateEvent;

				if (kind === 'time') {
					newEvent = {
						...baseEvent,
						kind: 'time',
						delta: { days: 0, hours: 0, minutes: 0 },
						...prefill,
					} as TimeEvent;
				} else if (kind === 'location' || kind === 'location_prop') {
					// Location events have subkinds: 'moved', 'prop_added', 'prop_removed'
					if (
						subkind === 'prop_added' ||
						subkind === 'prop_removed'
					) {
						newEvent = {
							...baseEvent,
							kind: 'location',
							subkind: subkind as
								| 'prop_added'
								| 'prop_removed',
							prop: '',
							...prefill,
						} as LocationPropEvent;
					} else {
						// Default to 'moved' subkind
						newEvent = {
							...baseEvent,
							kind: 'location',
							subkind: 'moved',
							newArea: '',
							newPlace: '',
							newPosition: '',
							...prefill,
						} as LocationMovedEvent;
					}
				} else if (kind === 'relationship') {
					newEvent = {
						...createRelationshipEvent(
							baseEvent,
							subkind as RelationshipEventSubkind,
						),
						...prefill,
					} as RelationshipEvent;
				} else {
					// Character event
					newEvent = {
						...createCharacterEvent(
							baseEvent,
							subkind as CharacterEventSubkind,
						),
						...prefill,
					} as CharacterEvent;
				}

				onEventsChange([...events, newEvent]);
				setShowAddMenu(false);
			},
			[events, messageId, swipeId, onEventsChange],
		);

		// Commit pending edits and return final events array
		const commitPendingEdits = useCallback((): StateEvent[] => {
			if (editingEventId && inlineEditorRef.current) {
				const updates = inlineEditorRef.current.getCurrentState();
				// Apply updates to the event being edited
				const finalEvents = events.map(e =>
					e.id === editingEventId ? { ...e, ...updates } : e,
				) as StateEvent[];
				// Clear editing state
				setEditingEventId(null);
				return finalEvents;
			}
			return events;
		}, [editingEventId, events]);

		// Expose commitPendingEdits via ref
		useImperativeHandle(ref, () => ({ commitPendingEdits }), [commitPendingEdits]);

		return (
			<div className="bt-event-editor">
				{/* Time Events */}
				{groupedEvents.timeEvents.length > 0 && (
					<EventGroup
						kind="time"
						label="Time Events"
						icon="fa-clock"
						count={groupedEvents.timeEvents.length}
						collapsed={collapsedGroups.has('time')}
						onToggle={() => toggleGroup('time')}
					>
						{groupedEvents.timeEvents.map((event, idx) => (
							<TimeEventCard
								key={event.id}
								event={event}
								index={idx}
								isEditing={
									editingEventId === event.id
								}
								onStartEdit={() =>
									setEditingEventId(event.id)
								}
								onEndEdit={() =>
									setEditingEventId(null)
								}
								editorRef={
									editingEventId === event.id
										? inlineEditorRef
										: undefined
								}
								onUpdate={updates =>
									handleUpdateEvent(
										event.id,
										updates,
									)
								}
								onDelete={() =>
									handleDelete(event.id)
								}
							/>
						))}
					</EventGroup>
				)}

				{/* Location Moved Events */}
				{groupedEvents.locationMovedEvents.length > 0 && (
					<EventGroup
						kind="location"
						label="Location Moves"
						icon="fa-location-dot"
						count={groupedEvents.locationMovedEvents.length}
						collapsed={collapsedGroups.has('location')}
						onToggle={() => toggleGroup('location')}
					>
						{groupedEvents.locationMovedEvents.map(
							(event, idx) => (
								<LocationEventCard
									key={event.id}
									event={event}
									index={idx}
									isEditing={
										editingEventId ===
										event.id
									}
									onStartEdit={() =>
										setEditingEventId(
											event.id,
										)
									}
									onEndEdit={() =>
										setEditingEventId(
											null,
										)
									}
									editorRef={
										editingEventId ===
										event.id
											? inlineEditorRef
											: undefined
									}
									onUpdate={updates =>
										handleUpdateEvent(
											event.id,
											updates,
										)
									}
									onDelete={() =>
										handleDelete(
											event.id,
										)
									}
								/>
							),
						)}
					</EventGroup>
				)}

				{/* Location Prop Events */}
				{groupedEvents.locationPropEvents.length > 0 && (
					<EventGroup
						kind="location_prop"
						label="Location Props"
						icon="fa-couch"
						count={groupedEvents.locationPropEvents.length}
						collapsed={collapsedGroups.has('location_prop')}
						onToggle={() => toggleGroup('location_prop')}
					>
						{groupedEvents.locationPropEvents.map(
							(event, idx) => (
								<LocationPropEventCard
									key={event.id}
									event={event}
									index={idx}
									isEditing={
										editingEventId ===
										event.id
									}
									onStartEdit={() =>
										setEditingEventId(
											event.id,
										)
									}
									onEndEdit={() =>
										setEditingEventId(
											null,
										)
									}
									editorRef={
										editingEventId ===
										event.id
											? inlineEditorRef
											: undefined
									}
									onUpdate={updates =>
										handleUpdateEvent(
											event.id,
											updates,
										)
									}
									onDelete={() =>
										handleDelete(
											event.id,
										)
									}
								/>
							),
						)}
					</EventGroup>
				)}

				{/* Character Events */}
				{groupedEvents.characterEvents.length > 0 && (
					<EventGroup
						kind="character"
						label="Character Events"
						icon="fa-user"
						count={groupedEvents.characterEvents.length}
						collapsed={collapsedGroups.has('character')}
						onToggle={() => toggleGroup('character')}
					>
						{groupedEvents.characterEvents.map((event, idx) => (
							<CharacterEventCard
								key={event.id}
								event={event}
								index={idx}
								isEditing={
									editingEventId === event.id
								}
								onStartEdit={() =>
									setEditingEventId(event.id)
								}
								onEndEdit={() =>
									setEditingEventId(null)
								}
								editorRef={
									editingEventId === event.id
										? inlineEditorRef
										: undefined
								}
								onUpdate={updates =>
									handleUpdateEvent(
										event.id,
										updates,
									)
								}
								onDelete={() =>
									handleDelete(event.id)
								}
							/>
						))}
					</EventGroup>
				)}

				{/* Relationship Events */}
				{groupedEvents.relationshipEvents.length > 0 && (
					<EventGroup
						kind="relationship"
						label="Relationship Events"
						icon="fa-heart-circle-check"
						count={groupedEvents.relationshipEvents.length}
						collapsed={collapsedGroups.has('relationship')}
						onToggle={() => toggleGroup('relationship')}
					>
						{groupedEvents.relationshipEvents.map(
							(event, idx) => (
								<RelationshipEventCard
									key={event.id}
									event={event}
									index={idx}
									isEditing={
										editingEventId ===
										event.id
									}
									onStartEdit={() =>
										setEditingEventId(
											event.id,
										)
									}
									onEndEdit={() =>
										setEditingEventId(
											null,
										)
									}
									editorRef={
										editingEventId ===
										event.id
											? inlineEditorRef
											: undefined
									}
									onUpdate={updates =>
										handleUpdateEvent(
											event.id,
											updates,
										)
									}
									onDelete={() =>
										handleDelete(
											event.id,
										)
									}
								/>
							),
						)}
					</EventGroup>
				)}

				{/* Add Event Dropdown */}
				<div className="bt-add-event-dropdown">
					<button
						className="bt-add-event-btn"
						onClick={() => setShowAddMenu(!showAddMenu)}
					>
						<i className="fa-solid fa-plus"></i>
						Add Event
					</button>

					{showAddMenu && (
						<AddEventMenu
							onAdd={handleAddEvent}
							onClose={() => setShowAddMenu(false)}
							projection={projection}
						/>
					)}
				</div>
			</div>
		);
	},
);

// =============================================
// Event Group Component
// =============================================

interface EventGroupProps {
	kind: EventKind;
	label: string;
	icon: string;
	count: number;
	collapsed: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}

function EventGroup({ label, icon, count, collapsed, onToggle, children }: EventGroupProps) {
	return (
		<div className={`bt-event-group ${collapsed ? 'collapsed' : ''}`}>
			<div className="bt-event-group-header" onClick={onToggle}>
				<i className={`fa-solid fa-chevron-down`}></i>
				<i className={`fa-solid ${icon}`}></i>
				<span>{label}</span>
				<span className="bt-event-group-count">{count}</span>
			</div>
			<div className="bt-event-group-content">{children}</div>
		</div>
	);
}

// =============================================
// Time Event Card
// =============================================

interface TimeEventCardProps {
	event: InitialTimeEvent | TimeEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<InitialTimeEvent | TimeEvent>) => void;
	onDelete: () => void;
}

function TimeEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: TimeEventCardProps) {
	const summary = isInitialTimeEvent(event)
		? formatInitialTime(event.initialTime)
		: formatDelta(event.delta);

	const isInitial = isInitialTimeEvent(event);

	if (isEditing) {
		return (
			<TimeEventEditor
				ref={editorRef}
				event={event}
				onSave={updates => {
					onUpdate(updates);
					onEndEdit();
				}}
				onCancel={onEndEdit}
			/>
		);
	}

	return (
		<div
			className="bt-event-card"
			data-kind={event.kind}
			style={
				{
					'--event-type-color': STATE_EVENT_COLORS.time,
				} as React.CSSProperties
			}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${isInitial ? 'fa-hourglass-start' : 'fa-clock'}`}
						style={{ color: STATE_EVENT_COLORS.time }}
					/>
					<span className="bt-event-subkind">
						{isInitial ? 'Initial Time' : 'Time Delta'}
					</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-value">
						{isInitial ? summary : `+${summary}`}
					</span>
				</div>
			</div>
			<div className="bt-event-actions">
				<button
					className="bt-action-btn"
					onClick={onStartEdit}
					title="Edit"
				>
					<i className="fa-solid fa-pen"></i>
				</button>
				{!isInitial && (
					<button
						className="bt-action-btn delete"
						onClick={onDelete}
						title="Delete"
					>
						<i className="fa-solid fa-trash"></i>
					</button>
				)}
			</div>
		</div>
	);
}

interface TimeEventEditorProps {
	event: InitialTimeEvent | TimeEvent;
	onSave: (updates: Partial<InitialTimeEvent | TimeEvent>) => void;
	onCancel: () => void;
}

const TimeEventEditor = forwardRef<InlineEditorHandle, TimeEventEditorProps>(
	function TimeEventEditor({ event, onSave, onCancel }, ref) {
		const [delta, setDelta] = useState(
			isTimeEvent(event) ? event.delta : { days: 0, hours: 0, minutes: 0 },
		);

		// Expose current state via ref
		useImperativeHandle(
			ref,
			() => ({
				getCurrentState: () => {
					if (isTimeEvent(event)) {
						return { delta };
					}
					return {};
				},
			}),
			[delta, event],
		);

		const handleSave = () => {
			if (isTimeEvent(event)) {
				onSave({ delta });
			}
			// For InitialTimeEvent, we'd need a full datetime editor
		};

		return (
			<div className="bt-event-card" data-kind={event.kind}>
				<div className="bt-event-card-content">
					<div className="bt-time-edit-row">
						<label>
							Days
							<input
								type="number"
								min="0"
								value={delta.days}
								onChange={e =>
									setDelta({
										...delta,
										days:
											parseInt(
												e
													.target
													.value,
											) || 0,
									})
								}
							/>
						</label>
						<label>
							Hours
							<input
								type="number"
								min="0"
								max="23"
								value={delta.hours}
								onChange={e =>
									setDelta({
										...delta,
										hours:
											parseInt(
												e
													.target
													.value,
											) || 0,
									})
								}
							/>
						</label>
						<label>
							Minutes
							<input
								type="number"
								min="0"
								max="59"
								value={delta.minutes}
								onChange={e =>
									setDelta({
										...delta,
										minutes:
											parseInt(
												e
													.target
													.value,
											) || 0,
									})
								}
							/>
						</label>
					</div>
				</div>
				<div className="bt-event-actions" style={{ opacity: 1 }}>
					<button
						className="bt-action-btn"
						onClick={handleSave}
						title="Save"
					>
						<i className="fa-solid fa-check"></i>
					</button>
					<button
						className="bt-action-btn"
						onClick={onCancel}
						title="Cancel"
					>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>
			</div>
		);
	},
);

// =============================================
// Location Event Card
// =============================================

interface LocationEventCardProps {
	event: LocationMovedEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<LocationMovedEvent>) => void;
	onDelete: () => void;
}

function LocationEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: LocationEventCardProps) {
	const summary = event.newPlace || event.newArea || 'Unknown location';

	if (isEditing) {
		return (
			<LocationEventEditor
				ref={editorRef}
				event={event}
				onSave={updates => {
					onUpdate(updates);
					onEndEdit();
				}}
				onCancel={onEndEdit}
			/>
		);
	}

	return (
		<div
			className="bt-event-card"
			data-kind="location"
			style={
				{
					'--event-type-color': STATE_EVENT_COLORS.location,
				} as React.CSSProperties
			}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className="fa-solid fa-location-dot"
						style={{ color: STATE_EVENT_COLORS.location }}
					/>
					<span className="bt-event-subkind">Location Change</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-place">{summary}</span>
					{event.newPosition && (
						<span className="bt-event-position">
							@ {event.newPosition}
						</span>
					)}
				</div>
			</div>
			<div className="bt-event-actions">
				<button
					className="bt-action-btn"
					onClick={onStartEdit}
					title="Edit"
				>
					<i className="fa-solid fa-pen"></i>
				</button>
				<button
					className="bt-action-btn delete"
					onClick={onDelete}
					title="Delete"
				>
					<i className="fa-solid fa-trash"></i>
				</button>
			</div>
		</div>
	);
}

interface LocationEventEditorProps {
	event: LocationMovedEvent;
	onSave: (updates: Partial<LocationMovedEvent>) => void;
	onCancel: () => void;
}

const LocationEventEditor = forwardRef<InlineEditorHandle, LocationEventEditorProps>(
	function LocationEventEditor({ event, onSave, onCancel }, ref) {
		const [area, setArea] = useState(event.newArea);
		const [place, setPlace] = useState(event.newPlace);
		const [position, setPosition] = useState(event.newPosition);

		// Expose current state via ref
		useImperativeHandle(
			ref,
			() => ({
				getCurrentState: () => ({
					newArea: area,
					newPlace: place,
					newPosition: position,
				}),
			}),
			[area, place, position],
		);

		return (
			<div className="bt-event-card bt-event-card-editing" data-kind="location">
				<div className="bt-event-card-content">
					<div className="bt-location-edit-fields">
						<input
							type="text"
							placeholder="Area (e.g., Downtown, NYC)"
							value={area}
							onChange={e => setArea(e.target.value)}
						/>
						<input
							type="text"
							placeholder="Place (e.g., Coffee Shop)"
							value={place}
							onChange={e => setPlace(e.target.value)}
						/>
						<input
							type="text"
							placeholder="Position (e.g., Corner booth)"
							value={position}
							onChange={e => setPosition(e.target.value)}
						/>
					</div>
				</div>
				<div className="bt-event-actions" style={{ opacity: 1 }}>
					<button
						className="bt-action-btn"
						onClick={() =>
							onSave({
								newArea: area,
								newPlace: place,
								newPosition: position,
							})
						}
						title="Save"
					>
						<i className="fa-solid fa-check"></i>
					</button>
					<button
						className="bt-action-btn"
						onClick={onCancel}
						title="Cancel"
					>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>
			</div>
		);
	},
);

// =============================================
// Character Event Card
// =============================================

interface CharacterEventCardProps {
	event: CharacterEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<CharacterEvent>) => void;
	onDelete: () => void;
}

function CharacterEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: CharacterEventCardProps) {
	const iconClass = CHARACTER_SUBKIND_ICONS[event.subkind] || 'fa-circle';
	const iconColor = getCharacterEventColor(event.subkind);

	if (isEditing) {
		return (
			<CharacterEventEditor
				ref={editorRef}
				event={event}
				onSave={updates => {
					onUpdate(updates);
					onEndEdit();
				}}
				onCancel={onEndEdit}
			/>
		);
	}

	return (
		<div
			className="bt-event-card"
			data-kind="character"
			style={{ '--event-type-color': iconColor } as React.CSSProperties}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${iconClass}`}
						style={{ color: iconColor }}
					/>
					<span className="bt-event-subkind">
						{formatSubkindLabel(event.subkind)}
					</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-char">{event.character}</span>
					{event.newValue && (
						<span className="bt-event-value">
							→ {event.newValue}
						</span>
					)}
					{event.mood && (
						<span className="bt-event-tag bt-tag-mood">
							{event.mood}
						</span>
					)}
					{event.physicalState && (
						<span className="bt-event-tag bt-tag-physical">
							{event.physicalState}
						</span>
					)}
					{event.slot && (
						<span className="bt-event-slot">
							[{event.slot}]
						</span>
					)}
				</div>
			</div>
			<div className="bt-event-actions">
				<button
					className="bt-action-btn"
					onClick={onStartEdit}
					title="Edit"
				>
					<i className="fa-solid fa-pen"></i>
				</button>
				<button
					className="bt-action-btn delete"
					onClick={onDelete}
					title="Delete"
				>
					<i className="fa-solid fa-trash"></i>
				</button>
			</div>
		</div>
	);
}

interface CharacterEventEditorProps {
	event: CharacterEvent;
	onSave: (updates: Partial<CharacterEvent>) => void;
	onCancel: () => void;
}

const CharacterEventEditor = forwardRef<InlineEditorHandle, CharacterEventEditorProps>(
	function CharacterEventEditor({ event, onSave, onCancel }, ref) {
		const [character, setCharacter] = useState(event.character);
		const [newValue, setNewValue] = useState(event.newValue ?? '');
		const [mood, setMood] = useState(event.mood ?? '');
		const [physicalState, setPhysicalState] = useState(event.physicalState ?? '');
		const [slot, setSlot] = useState(event.slot ?? 'torso');

		// Build current state based on event subkind
		const getCurrentState = useCallback((): Partial<CharacterEvent> => {
			const updates: Partial<CharacterEvent> = { character };

			switch (event.subkind) {
				case 'position_changed':
				case 'activity_changed':
					updates.newValue = newValue || null;
					break;
				case 'mood_added':
				case 'mood_removed':
					updates.mood = mood;
					break;
				case 'physical_state_added':
				case 'physical_state_removed':
					updates.physicalState = physicalState;
					break;
				case 'outfit_changed':
					updates.slot = slot as OutfitSlot;
					updates.newValue = newValue || null;
					break;
			}

			return updates;
		}, [character, newValue, mood, physicalState, slot, event.subkind]);

		// Expose current state via ref
		useImperativeHandle(ref, () => ({ getCurrentState }), [getCurrentState]);

		const handleSave = () => {
			onSave(getCurrentState());
		};

		return (
			<div className="bt-event-card bt-event-card-editing" data-kind="character">
				<div className="bt-event-card-content">
					<div className="bt-char-edit-fields">
						<input
							type="text"
							placeholder="Character name"
							value={character}
							onChange={e => setCharacter(e.target.value)}
						/>

						{(event.subkind === 'position_changed' ||
							event.subkind === 'activity_changed') && (
							<input
								type="text"
								placeholder={
									event.subkind ===
									'position_changed'
										? 'New position'
										: 'New activity'
								}
								value={newValue}
								onChange={e =>
									setNewValue(e.target.value)
								}
							/>
						)}

						{(event.subkind === 'mood_added' ||
							event.subkind === 'mood_removed') && (
							<input
								type="text"
								placeholder="Mood"
								value={mood}
								onChange={e =>
									setMood(e.target.value)
								}
							/>
						)}

						{(event.subkind === 'physical_state_added' ||
							event.subkind ===
								'physical_state_removed') && (
							<input
								type="text"
								placeholder="Physical state"
								value={physicalState}
								onChange={e =>
									setPhysicalState(
										e.target.value,
									)
								}
							/>
						)}

						{event.subkind === 'outfit_changed' && (
							<>
								<select
									value={slot}
									onChange={e =>
										setSlot(
											e.target
												.value as OutfitSlot,
										)
									}
								>
									<option value="head">
										Head
									</option>
									<option value="neck">
										Neck
									</option>
									<option value="jacket">
										Jacket
									</option>
									<option value="back">
										Back
									</option>
									<option value="torso">
										Torso
									</option>
									<option value="legs">
										Legs
									</option>
									<option value="footwear">
										Footwear
									</option>
									<option value="socks">
										Socks
									</option>
									<option value="underwear">
										Underwear
									</option>
								</select>
								<input
									type="text"
									placeholder="New item (empty = removed)"
									value={newValue}
									onChange={e =>
										setNewValue(
											e.target
												.value,
										)
									}
								/>
							</>
						)}
					</div>
				</div>
				<div className="bt-event-actions" style={{ opacity: 1 }}>
					<button
						className="bt-action-btn"
						onClick={handleSave}
						title="Save"
					>
						<i className="fa-solid fa-check"></i>
					</button>
					<button
						className="bt-action-btn"
						onClick={onCancel}
						title="Cancel"
					>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>
			</div>
		);
	},
);

// =============================================
// Location Prop Event Card
// =============================================

interface LocationPropEventCardProps {
	event: LocationPropEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<LocationPropEvent>) => void;
	onDelete: () => void;
}

function LocationPropEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: LocationPropEventCardProps) {
	const isAdded = event.subkind === 'prop_added';
	const iconColor = isAdded ? STATE_EVENT_COLORS.add : STATE_EVENT_COLORS.remove;

	if (isEditing) {
		return (
			<LocationPropEventEditor
				ref={editorRef}
				event={event}
				onSave={updates => {
					onUpdate(updates);
					onEndEdit();
				}}
				onCancel={onEndEdit}
			/>
		);
	}

	return (
		<div
			className="bt-event-card"
			data-kind="location_prop"
			style={{ '--event-type-color': iconColor } as React.CSSProperties}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${isAdded ? 'fa-plus' : 'fa-minus'}`}
						style={{ color: iconColor }}
					/>
					<span className="bt-event-subkind">
						{isAdded ? 'Prop Added' : 'Prop Removed'}
					</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-value">
						{event.prop || '(empty)'}
					</span>
				</div>
			</div>
			<div className="bt-event-actions">
				<button
					className="bt-action-btn"
					onClick={onStartEdit}
					title="Edit"
				>
					<i className="fa-solid fa-pen"></i>
				</button>
				<button
					className="bt-action-btn delete"
					onClick={onDelete}
					title="Delete"
				>
					<i className="fa-solid fa-trash"></i>
				</button>
			</div>
		</div>
	);
}

interface LocationPropEventEditorProps {
	event: LocationPropEvent;
	onSave: (updates: Partial<LocationPropEvent>) => void;
	onCancel: () => void;
}

const LocationPropEventEditor = forwardRef<InlineEditorHandle, LocationPropEventEditorProps>(
	function LocationPropEventEditor({ event, onSave, onCancel }, ref) {
		const [prop, setProp] = useState(event.prop);
		const [subkind, setSubkind] = useState<LocationPropSubkind>(event.subkind);

		useImperativeHandle(
			ref,
			() => ({
				getCurrentState: () => ({ prop, subkind }),
			}),
			[prop, subkind],
		);

		return (
			<div
				className="bt-event-card bt-event-card-editing"
				data-kind="location_prop"
			>
				<div className="bt-event-card-content">
					<div className="bt-prop-edit-fields">
						<select
							value={subkind}
							onChange={e =>
								setSubkind(
									e.target
										.value as LocationPropSubkind,
								)
							}
						>
							<option value="prop_added">
								Prop Added
							</option>
							<option value="prop_removed">
								Prop Removed
							</option>
						</select>
						<input
							type="text"
							placeholder="Prop name (e.g., coffee table, bookshelf)"
							value={prop}
							onChange={e => setProp(e.target.value)}
						/>
					</div>
				</div>
				<div className="bt-event-actions" style={{ opacity: 1 }}>
					<button
						className="bt-action-btn"
						onClick={() => onSave({ prop, subkind })}
						title="Save"
					>
						<i className="fa-solid fa-check"></i>
					</button>
					<button
						className="bt-action-btn"
						onClick={onCancel}
						title="Cancel"
					>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>
			</div>
		);
	},
);

// =============================================
// Relationship Event Card
// =============================================

interface RelationshipEventCardProps {
	event: RelationshipEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<RelationshipEvent>) => void;
	onDelete: () => void;
}

function RelationshipEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: RelationshipEventCardProps) {
	const iconClass = getRelationshipSubkindIcon(event.subkind);
	const iconColor = getRelationshipEventColor(event.subkind);

	if (isEditing) {
		return (
			<RelationshipEventEditor
				ref={editorRef}
				event={event}
				onSave={updates => {
					onUpdate(updates);
					onEndEdit();
				}}
				onCancel={onEndEdit}
			/>
		);
	}

	// Determine display based on event type
	const isStatusEvent = event.subkind === 'status_changed';
	let pairDisplay: string;
	let directionDisplay: string | null = null;
	let valueDisplay: string | null = null;
	let statusDisplay: RelationshipStatus | null = null;

	if (isStatusEvent) {
		const statusEvent = event as StatusChangedEvent;
		pairDisplay = `${statusEvent.pair[0]} & ${statusEvent.pair[1]}`;
		statusDisplay = statusEvent.newStatus;
	} else {
		const dirEvent = event as DirectionalRelationshipEvent;
		pairDisplay = `${dirEvent.fromCharacter} & ${dirEvent.towardCharacter}`;
		directionDisplay = `${dirEvent.fromCharacter} → ${dirEvent.towardCharacter}`;
		valueDisplay = dirEvent.value;
	}

	return (
		<div
			className="bt-event-card"
			data-kind="relationship"
			style={{ '--event-type-color': iconColor } as React.CSSProperties}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i className={iconClass} style={{ color: iconColor }} />
					<span className="bt-event-subkind">
						{formatSubkindLabel(event.subkind)}
					</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-pair">{pairDisplay}</span>
					{directionDisplay && (
						<span className="bt-event-direction">
							({directionDisplay})
						</span>
					)}
					{valueDisplay && (
						<span className="bt-event-value">
							"{valueDisplay}"
						</span>
					)}
					{statusDisplay && (
						<span className="bt-event-status">
							→ {statusDisplay}
						</span>
					)}
				</div>
			</div>
			<div className="bt-event-actions">
				<button
					className="bt-action-btn"
					onClick={onStartEdit}
					title="Edit"
				>
					<i className="fa-solid fa-pen"></i>
				</button>
				<button
					className="bt-action-btn delete"
					onClick={onDelete}
					title="Delete"
				>
					<i className="fa-solid fa-trash"></i>
				</button>
			</div>
		</div>
	);
}

interface RelationshipEventEditorProps {
	event: RelationshipEvent;
	onSave: (updates: Partial<RelationshipEvent>) => void;
	onCancel: () => void;
}

const RelationshipEventEditor = forwardRef<InlineEditorHandle, RelationshipEventEditorProps>(
	function RelationshipEventEditor({ event, onSave, onCancel }, ref) {
		const isStatusEvent = event.subkind === 'status_changed';

		// Initialize state based on event type
		const initialCharA = isStatusEvent
			? (event as StatusChangedEvent).pair[0]
			: (event as DirectionalRelationshipEvent).fromCharacter;
		const initialCharB = isStatusEvent
			? (event as StatusChangedEvent).pair[1]
			: (event as DirectionalRelationshipEvent).towardCharacter;

		const [charA, setCharA] = useState(initialCharA);
		const [charB, setCharB] = useState(initialCharB);
		const [fromCharacter, setFromCharacter] = useState(
			isStatusEvent ? '' : (event as DirectionalRelationshipEvent).fromCharacter,
		);
		const [towardCharacter, setTowardCharacter] = useState(
			isStatusEvent
				? ''
				: (event as DirectionalRelationshipEvent).towardCharacter,
		);
		const [value, setValue] = useState(
			isStatusEvent ? '' : (event as DirectionalRelationshipEvent).value,
		);
		const [newStatus, setNewStatus] = useState<RelationshipStatus>(
			isStatusEvent ? (event as StatusChangedEvent).newStatus : 'acquaintances',
		);

		const isDirectionalEvent = !isStatusEvent;

		const getCurrentState = useCallback((): Partial<RelationshipEvent> => {
			if (isStatusEvent) {
				const sorted = sortPair(charA, charB);
				return {
					pair: sorted,
					newStatus,
				} as Partial<StatusChangedEvent>;
			}
			// Directional events don't have pair - it's derived from fromCharacter/towardCharacter
			return {
				fromCharacter,
				towardCharacter,
				value,
			} as Partial<DirectionalRelationshipEvent>;
		}, [charA, charB, fromCharacter, towardCharacter, value, newStatus, isStatusEvent]);

		useImperativeHandle(ref, () => ({ getCurrentState }), [getCurrentState]);

		return (
			<div
				className="bt-event-card bt-event-card-editing"
				data-kind="relationship"
			>
				<div className="bt-event-card-content">
					<div className="bt-relationship-edit-fields">
						<div className="bt-pair-inputs">
							<input
								type="text"
								placeholder="Character A"
								value={charA}
								onChange={e =>
									setCharA(e.target.value)
								}
							/>
							<span>&</span>
							<input
								type="text"
								placeholder="Character B"
								value={charB}
								onChange={e =>
									setCharB(e.target.value)
								}
							/>
						</div>

						{isDirectionalEvent && (
							<>
								<div className="bt-direction-inputs">
									<input
										type="text"
										placeholder="From character"
										value={
											fromCharacter
										}
										onChange={e =>
											setFromCharacter(
												e
													.target
													.value,
											)
										}
									/>
									<span>→</span>
									<input
										type="text"
										placeholder="Toward character"
										value={
											towardCharacter
										}
										onChange={e =>
											setTowardCharacter(
												e
													.target
													.value,
											)
										}
									/>
								</div>
								<input
									type="text"
									placeholder="Value (feeling/secret/want)"
									value={value}
									onChange={e =>
										setValue(
											e.target
												.value,
										)
									}
								/>
							</>
						)}

						{isStatusEvent && (
							<select
								value={newStatus}
								onChange={e =>
									setNewStatus(
										e.target
											.value as RelationshipStatus,
									)
								}
							>
								{RELATIONSHIP_STATUSES.map(
									status => (
										<option
											key={status}
											value={
												status
											}
										>
											{status
												.charAt(
													0,
												)
												.toUpperCase() +
												status.slice(
													1,
												)}
										</option>
									),
								)}
							</select>
						)}
					</div>
				</div>
				<div className="bt-event-actions" style={{ opacity: 1 }}>
					<button
						className="bt-action-btn"
						onClick={() => onSave(getCurrentState())}
						title="Save"
					>
						<i className="fa-solid fa-check"></i>
					</button>
					<button
						className="bt-action-btn"
						onClick={onCancel}
						title="Cancel"
					>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>
			</div>
		);
	},
);

// =============================================
// Add Event Menu
// =============================================

/** Extended add callback that can include pre-filled values */
type AddEventCallback = (
	kind: EventKind,
	subkind?: CharacterEventSubkind | LocationPropSubkind | RelationshipEventSubkind,
	prefill?: Partial<StateEvent>,
) => void;

interface AddEventMenuProps {
	onAdd: AddEventCallback;
	onClose: () => void;
	projection: ProjectedState;
}

type SubmenuType =
	| 'prop_removed'
	| 'departed'
	| 'mood_removed'
	| 'physical_state_removed'
	| 'outfit_changed'
	| 'position_changed'
	| 'activity_changed'
	| null;

function AddEventMenu({ onAdd, onClose, projection }: AddEventMenuProps) {
	const [submenu, setSubmenu] = useState<SubmenuType>(null);
	const [selectedChar, setSelectedChar] = useState<string | null>(null);

	const characterNames = useMemo(
		() => Array.from(projection.characters.keys()),
		[projection.characters],
	);
	const props = projection.location?.props ?? [];

	// Get character-specific data
	const getCharacterMoods = (name: string) => projection.characters.get(name)?.mood ?? [];
	const getCharacterPhysicalStates = (name: string) =>
		projection.characters.get(name)?.physicalState ?? [];
	const getCharacterOutfit = (name: string) => projection.characters.get(name)?.outfit;

	const handleBack = () => {
		if (selectedChar) {
			setSelectedChar(null);
		} else {
			setSubmenu(null);
		}
	};

	// Render submenu for prop removal
	if (submenu === 'prop_removed') {
		return (
			<>
				<div className="bt-add-event-backdrop" onClick={onClose}></div>
				<div className="bt-add-event-menu">
					<div
						className="bt-add-event-submenu-header"
						onClick={handleBack}
					>
						<i className="fa-solid fa-arrow-left"></i>
						Remove Prop
					</div>
					{props.length === 0 ? (
						<div className="bt-add-event-empty">
							No props to remove
						</div>
					) : (
						props.map(prop => (
							<div
								key={prop}
								className="bt-add-event-option"
								onClick={() => {
									onAdd(
										'location_prop',
										'prop_removed',
										{ prop },
									);
									onClose();
								}}
							>
								<i className="fa-solid fa-minus"></i>
								{prop}
							</div>
						))
					)}
				</div>
			</>
		);
	}

	// Render submenu for character departure
	if (submenu === 'departed') {
		return (
			<>
				<div className="bt-add-event-backdrop" onClick={onClose}></div>
				<div className="bt-add-event-menu">
					<div
						className="bt-add-event-submenu-header"
						onClick={handleBack}
					>
						<i className="fa-solid fa-arrow-left"></i>
						Character Departed
					</div>
					{characterNames.length === 0 ? (
						<div className="bt-add-event-empty">
							No characters present
						</div>
					) : (
						characterNames.map(name => (
							<div
								key={name}
								className="bt-add-event-option"
								onClick={() => {
									onAdd(
										'character',
										'departed',
										{ character: name },
									);
									onClose();
								}}
							>
								<i className="fa-solid fa-user-minus"></i>
								{name}
							</div>
						))
					)}
				</div>
			</>
		);
	}

	// Render submenu for mood removal - first select character, then mood
	if (submenu === 'mood_removed') {
		if (!selectedChar) {
			return (
				<>
					<div
						className="bt-add-event-backdrop"
						onClick={onClose}
					></div>
					<div className="bt-add-event-menu">
						<div
							className="bt-add-event-submenu-header"
							onClick={handleBack}
						>
							<i className="fa-solid fa-arrow-left"></i>
							Remove Mood - Select Character
						</div>
						{characterNames.filter(
							n => getCharacterMoods(n).length > 0,
						).length === 0 ? (
							<div className="bt-add-event-empty">
								No characters have moods
							</div>
						) : (
							characterNames
								.filter(
									n =>
										getCharacterMoods(n)
											.length > 0,
								)
								.map(name => (
									<div
										key={name}
										className="bt-add-event-option"
										onClick={() =>
											setSelectedChar(
												name,
											)
										}
									>
										<i className="fa-solid fa-user"></i>
										{name}
										<span className="bt-add-event-count">
											(
											{
												getCharacterMoods(
													name,
												)
													.length
											}
											)
										</span>
									</div>
								))
						)}
					</div>
				</>
			);
		}

		const moods = getCharacterMoods(selectedChar);
		return (
			<>
				<div className="bt-add-event-backdrop" onClick={onClose}></div>
				<div className="bt-add-event-menu">
					<div
						className="bt-add-event-submenu-header"
						onClick={handleBack}
					>
						<i className="fa-solid fa-arrow-left"></i>
						{selectedChar}'s Moods
					</div>
					{moods.map(mood => (
						<div
							key={mood}
							className="bt-add-event-option"
							onClick={() => {
								onAdd('character', 'mood_removed', {
									character: selectedChar,
									mood,
								});
								onClose();
							}}
						>
							<i className="fa-regular fa-face-meh"></i>
							{mood}
						</div>
					))}
				</div>
			</>
		);
	}

	// Render submenu for physical state removal
	if (submenu === 'physical_state_removed') {
		if (!selectedChar) {
			return (
				<>
					<div
						className="bt-add-event-backdrop"
						onClick={onClose}
					></div>
					<div className="bt-add-event-menu">
						<div
							className="bt-add-event-submenu-header"
							onClick={handleBack}
						>
							<i className="fa-solid fa-arrow-left"></i>
							Remove Physical State - Select Character
						</div>
						{characterNames.filter(
							n =>
								getCharacterPhysicalStates(n)
									.length > 0,
						).length === 0 ? (
							<div className="bt-add-event-empty">
								No characters have physical states
							</div>
						) : (
							characterNames
								.filter(
									n =>
										getCharacterPhysicalStates(
											n,
										).length > 0,
								)
								.map(name => (
									<div
										key={name}
										className="bt-add-event-option"
										onClick={() =>
											setSelectedChar(
												name,
											)
										}
									>
										<i className="fa-solid fa-user"></i>
										{name}
										<span className="bt-add-event-count">
											(
											{
												getCharacterPhysicalStates(
													name,
												)
													.length
											}
											)
										</span>
									</div>
								))
						)}
					</div>
				</>
			);
		}

		const states = getCharacterPhysicalStates(selectedChar);
		return (
			<>
				<div className="bt-add-event-backdrop" onClick={onClose}></div>
				<div className="bt-add-event-menu">
					<div
						className="bt-add-event-submenu-header"
						onClick={handleBack}
					>
						<i className="fa-solid fa-arrow-left"></i>
						{selectedChar}'s Physical States
					</div>
					{states.map(state => (
						<div
							key={state}
							className="bt-add-event-option"
							onClick={() => {
								onAdd(
									'character',
									'physical_state_removed',
									{
										character: selectedChar,
										physicalState:
											state,
									},
								);
								onClose();
							}}
						>
							<i className="fa-solid fa-heart"></i>
							{state}
						</div>
					))}
				</div>
			</>
		);
	}

	// Render submenu for outfit change - select character first
	if (submenu === 'outfit_changed') {
		if (!selectedChar) {
			return (
				<>
					<div
						className="bt-add-event-backdrop"
						onClick={onClose}
					></div>
					<div className="bt-add-event-menu">
						<div
							className="bt-add-event-submenu-header"
							onClick={handleBack}
						>
							<i className="fa-solid fa-arrow-left"></i>
							Outfit Changed - Select Character
						</div>
						{characterNames.length === 0 ? (
							<div className="bt-add-event-empty">
								No characters present
							</div>
						) : (
							characterNames.map(name => (
								<div
									key={name}
									className="bt-add-event-option"
									onClick={() =>
										setSelectedChar(
											name,
										)
									}
								>
									<i className="fa-solid fa-user"></i>
									{name}
								</div>
							))
						)}
					</div>
				</>
			);
		}

		const outfit = getCharacterOutfit(selectedChar);
		const slots: OutfitSlot[] = [
			'head',
			'neck',
			'jacket',
			'back',
			'torso',
			'legs',
			'underwear',
			'socks',
			'footwear',
		];

		return (
			<>
				<div className="bt-add-event-backdrop" onClick={onClose}></div>
				<div className="bt-add-event-menu">
					<div
						className="bt-add-event-submenu-header"
						onClick={handleBack}
					>
						<i className="fa-solid fa-arrow-left"></i>
						{selectedChar}'s Outfit Slots
					</div>
					{slots.map(slot => {
						const currentItem = outfit?.[slot] ?? null;
						return (
							<div
								key={slot}
								className="bt-add-event-option"
								onClick={() => {
									onAdd(
										'character',
										'outfit_changed',
										{
											character: selectedChar,
											slot,
											previousValue:
												currentItem,
										},
									);
									onClose();
								}}
							>
								<i className="fa-solid fa-shirt"></i>
								<span className="bt-slot-name">
									{slot}
								</span>
								{currentItem && (
									<span className="bt-slot-current">
										({currentItem})
									</span>
								)}
							</div>
						);
					})}
				</div>
			</>
		);
	}

	// Render submenu for position/activity change - select character
	if (submenu === 'position_changed' || submenu === 'activity_changed') {
		const isPosition = submenu === 'position_changed';
		return (
			<>
				<div className="bt-add-event-backdrop" onClick={onClose}></div>
				<div className="bt-add-event-menu">
					<div
						className="bt-add-event-submenu-header"
						onClick={handleBack}
					>
						<i className="fa-solid fa-arrow-left"></i>
						{isPosition ? 'Position' : 'Activity'} Changed -
						Select Character
					</div>
					{characterNames.length === 0 ? (
						<div className="bt-add-event-empty">
							No characters present
						</div>
					) : (
						characterNames.map(name => {
							const char =
								projection.characters.get(name);
							const current = isPosition
								? char?.position
								: char?.activity;
							return (
								<div
									key={name}
									className="bt-add-event-option"
									onClick={() => {
										onAdd(
											'character',
											submenu,
											{
												character: name,
												previousValue:
													current ??
													'',
											},
										);
										onClose();
									}}
								>
									<i className="fa-solid fa-user"></i>
									{name}
									{current && (
										<span className="bt-slot-current">
											({current})
										</span>
									)}
								</div>
							);
						})
					)}
				</div>
			</>
		);
	}

	// Main menu
	return (
		<>
			<div className="bt-add-event-backdrop" onClick={onClose}></div>
			<div className="bt-add-event-menu">
				<div className="bt-add-event-option" onClick={() => onAdd('time')}>
					<i className="fa-regular fa-clock"></i>
					Time Delta
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('location')}
				>
					<i className="fa-solid fa-location-dot"></i>
					Location Change
				</div>

				<div className="bt-add-event-section-label">Location Props</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('location_prop', 'prop_added')}
				>
					<i className="fa-solid fa-plus"></i>
					Prop Added
				</div>
				<div
					className={`bt-add-event-option ${props.length === 0 ? 'disabled' : ''}`}
					onClick={() =>
						props.length > 0 && setSubmenu('prop_removed')
					}
				>
					<i className="fa-solid fa-minus"></i>
					Prop Removed
					{props.length > 0 && (
						<i className="fa-solid fa-chevron-right bt-submenu-arrow"></i>
					)}
				</div>

				<div className="bt-add-event-section-label">Character Events</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('character', 'appeared')}
				>
					<i className="fa-solid fa-user-plus"></i>
					Character Appeared
				</div>
				<div
					className={`bt-add-event-option ${characterNames.length === 0 ? 'disabled' : ''}`}
					onClick={() =>
						characterNames.length > 0 && setSubmenu('departed')
					}
				>
					<i className="fa-solid fa-user-minus"></i>
					Character Departed
					{characterNames.length > 0 && (
						<i className="fa-solid fa-chevron-right bt-submenu-arrow"></i>
					)}
				</div>
				<div
					className={`bt-add-event-option ${characterNames.length === 0 ? 'disabled' : ''}`}
					onClick={() =>
						characterNames.length > 0 &&
						setSubmenu('position_changed')
					}
				>
					<i className="fa-solid fa-arrows-up-down-left-right"></i>
					Position Changed
					{characterNames.length > 0 && (
						<i className="fa-solid fa-chevron-right bt-submenu-arrow"></i>
					)}
				</div>
				<div
					className={`bt-add-event-option ${characterNames.length === 0 ? 'disabled' : ''}`}
					onClick={() =>
						characterNames.length > 0 &&
						setSubmenu('activity_changed')
					}
				>
					<i className="fa-solid fa-person-running"></i>
					Activity Changed
					{characterNames.length > 0 && (
						<i className="fa-solid fa-chevron-right bt-submenu-arrow"></i>
					)}
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('character', 'mood_added')}
				>
					<i className="fa-regular fa-face-smile"></i>
					Mood Added
				</div>
				<div
					className={`bt-add-event-option ${characterNames.filter(n => getCharacterMoods(n).length > 0).length === 0 ? 'disabled' : ''}`}
					onClick={() =>
						characterNames.filter(
							n => getCharacterMoods(n).length > 0,
						).length > 0 && setSubmenu('mood_removed')
					}
				>
					<i className="fa-regular fa-face-meh"></i>
					Mood Removed
					{characterNames.filter(n => getCharacterMoods(n).length > 0)
						.length > 0 && (
						<i className="fa-solid fa-chevron-right bt-submenu-arrow"></i>
					)}
				</div>
				<div
					className={`bt-add-event-option ${characterNames.length === 0 ? 'disabled' : ''}`}
					onClick={() =>
						characterNames.length > 0 &&
						setSubmenu('outfit_changed')
					}
				>
					<i className="fa-solid fa-shirt"></i>
					Outfit Changed
					{characterNames.length > 0 && (
						<i className="fa-solid fa-chevron-right bt-submenu-arrow"></i>
					)}
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('character', 'physical_state_added')}
				>
					<i className="fa-solid fa-heart-pulse"></i>
					Physical State Added
				</div>
				<div
					className={`bt-add-event-option ${characterNames.filter(n => getCharacterPhysicalStates(n).length > 0).length === 0 ? 'disabled' : ''}`}
					onClick={() =>
						characterNames.filter(
							n =>
								getCharacterPhysicalStates(n)
									.length > 0,
						).length > 0 && setSubmenu('physical_state_removed')
					}
				>
					<i className="fa-solid fa-heart"></i>
					Physical State Removed
					{characterNames.filter(
						n => getCharacterPhysicalStates(n).length > 0,
					).length > 0 && (
						<i className="fa-solid fa-chevron-right bt-submenu-arrow"></i>
					)}
				</div>

				<div className="bt-add-event-section-label">
					Relationship Events
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('relationship', 'feeling_added')}
				>
					<i className="fa-solid fa-heart-circle-plus"></i>
					Feeling Added
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('relationship', 'feeling_removed')}
				>
					<i className="fa-solid fa-heart-circle-minus"></i>
					Feeling Removed
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('relationship', 'secret_added')}
				>
					<i className="fa-solid fa-user-secret"></i>
					Secret Added
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('relationship', 'secret_removed')}
				>
					<i className="fa-solid fa-mask"></i>
					Secret Removed
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('relationship', 'want_added')}
				>
					<i className="fa-solid fa-star"></i>
					Want Added
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('relationship', 'want_removed')}
				>
					<i className="fa-solid fa-star-half-stroke"></i>
					Want Removed
				</div>
				<div
					className="bt-add-event-option"
					onClick={() => onAdd('relationship', 'status_changed')}
				>
					<i className="fa-solid fa-people-arrows"></i>
					Status Changed
				</div>
			</div>
		</>
	);
}

// =============================================
// Helper Functions
// =============================================

function formatInitialTime(time: {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}): string {
	const date = new Date(time.year, time.month - 1, time.day, time.hour, time.minute);
	return date.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

function formatDelta(delta: { days: number; hours: number; minutes: number }): string {
	const parts: string[] = [];
	if (delta.days > 0) parts.push(`${delta.days}d`);
	if (delta.hours > 0) parts.push(`${delta.hours}h`);
	if (delta.minutes > 0) parts.push(`${delta.minutes}m`);
	return parts.length > 0 ? parts.join(' ') : '0m';
}

function createCharacterEvent(
	base: { id: string; messageId: number; swipeId: number; timestamp: number },
	subkind: CharacterEventSubkind,
): CharacterEvent {
	const event: CharacterEvent = {
		...base,
		kind: 'character',
		subkind,
		character: '',
	};

	switch (subkind) {
		case 'appeared':
			event.initialPosition = '';
			event.initialActivity = '';
			break;
		case 'position_changed':
		case 'activity_changed':
			event.newValue = '';
			event.previousValue = '';
			break;
		case 'mood_added':
		case 'mood_removed':
			event.mood = '';
			break;
		case 'outfit_changed':
			event.slot = 'torso';
			event.newValue = '';
			event.previousValue = '';
			break;
		case 'physical_state_added':
		case 'physical_state_removed':
			event.physicalState = '';
			break;
	}

	return event;
}

function createRelationshipEvent(
	base: { id: string; messageId: number; swipeId: number; timestamp: number },
	subkind: RelationshipEventSubkind,
): RelationshipEvent {
	if (subkind === 'status_changed') {
		return {
			...base,
			kind: 'relationship',
			subkind: 'status_changed',
			pair: ['', ''],
			newStatus: 'acquaintances',
		} as StatusChangedEvent;
	}

	// Directional events
	return {
		...base,
		kind: 'relationship',
		subkind: subkind as DirectionalRelationshipSubkind,
		fromCharacter: '',
		towardCharacter: '',
		value: '',
	} as DirectionalRelationshipEvent;
}

export default StateEventEditor;
