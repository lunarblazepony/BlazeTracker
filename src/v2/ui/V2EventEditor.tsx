/**
 * V2 Event Editor
 *
 * Editor for v2 events at a specific message/swipe.
 * Displays events grouped by kind with inline editing capabilities.
 */

import React, {
	useState,
	useCallback,
	useMemo,
	useRef,
	useImperativeHandle,
	forwardRef,
} from 'react';
import type {
	Event,
	TimeEvent,
	TimeDeltaEvent,
	LocationEvent,
	LocationMovedEvent,
	LocationPropAddedEvent,
	LocationPropRemovedEvent,
	CharacterEvent,
	CharacterAppearedEvent,
	CharacterDepartedEvent,
	CharacterPositionChangedEvent,
	CharacterActivityChangedEvent,
	CharacterMoodAddedEvent,
	CharacterMoodRemovedEvent,
	CharacterOutfitChangedEvent,
	CharacterPhysicalAddedEvent,
	CharacterPhysicalRemovedEvent,
	RelationshipEvent,
	RelationshipStatusChangedEvent,
	RelationshipFeelingAddedEvent,
	RelationshipFeelingRemovedEvent,
	RelationshipSecretAddedEvent,
	RelationshipSecretRemovedEvent,
	RelationshipWantAddedEvent,
	RelationshipWantRemovedEvent,
	TensionEvent,
	TopicToneEvent,
	ChapterEvent,
} from '../types/event';
import {
	isTimeEvent,
	isTimeInitialEvent,
	isLocationEvent,
	isLocationMovedEvent,
	isLocationPropAddedEvent,
	isLocationPropRemovedEvent,
	isCharacterEvent,
	isRelationshipEvent,
	isRelationshipStatusChangedEvent,
	isRelationshipSubjectEvent,
	isDirectionalRelationshipEvent,
	isTensionEvent,
	isTopicToneEvent,
	isChapterEvent,
} from '../types/event';
import type { RelationshipSubjectEvent } from '../types/event';
import type { Subject } from '../types/subject';
import { SUBJECTS } from '../types/subject';
import type { Projection } from '../types/snapshot';
import type {
	OutfitSlot,
	TensionLevel,
	TensionType,
	TensionDirection,
	RelationshipStatus,
	TimeDelta,
} from '../types/common';
import {
	TENSION_LEVELS,
	TENSION_TYPES,
	TENSION_DIRECTIONS,
	RELATIONSHIP_STATUSES,
	OUTFIT_SLOTS,
} from '../types/common';
import { sortPair } from '../types/snapshot';

// Generate UUID for new events
function generateUUID(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/** Handle for accessing pending edits from parent */
export interface V2EventEditorHandle {
	/** Commit any pending inline edits and return the final events array */
	commitPendingEdits: () => Event[];
}

interface V2EventEditorProps {
	events: Event[];
	messageId: number;
	swipeId: number;
	onEventsChange: (events: Event[]) => void;
	/** Current projected state for populating dropdowns */
	projection: Projection;
}

type V2EventGroupKind = 'time' | 'location' | 'character' | 'relationship' | 'scene' | 'chapter';

/** Handle for inline editors to expose their current state */
interface InlineEditorHandle {
	getCurrentState: () => Partial<Event>;
}

// ============================================
// Color and Icon Constants
// ============================================

const V2_EVENT_COLORS = {
	time: '#8b5cf6', // purple
	location: '#10b981', // emerald
	character: '#3b82f6', // blue
	relationship: '#ec4899', // pink
	scene: '#f59e0b', // amber
	chapter: '#6366f1', // indigo
	add: '#22c55e', // green
	remove: '#ef4444', // red
	change: '#3b82f6', // blue
};

const V2_EVENT_ICONS: Record<string, string> = {
	// Time
	time_initial: 'fa-hourglass-start',
	time_delta: 'fa-clock',
	// Location
	location_moved: 'fa-location-dot',
	location_prop_added: 'fa-plus',
	location_prop_removed: 'fa-minus',
	// Character
	character_appeared: 'fa-user-plus',
	character_departed: 'fa-user-minus',
	character_profile_set: 'fa-id-card',
	character_position_changed: 'fa-arrows-up-down-left-right',
	character_activity_changed: 'fa-person-running',
	character_mood_added: 'fa-face-smile',
	character_mood_removed: 'fa-face-meh',
	character_outfit_changed: 'fa-shirt',
	character_physical_added: 'fa-heart-pulse',
	character_physical_removed: 'fa-heart',
	// Relationship
	relationship_status_changed: 'fa-people-arrows',
	relationship_feeling_added: 'fa-heart-circle-plus',
	relationship_feeling_removed: 'fa-heart-circle-minus',
	relationship_secret_added: 'fa-user-secret',
	relationship_secret_removed: 'fa-mask',
	relationship_want_added: 'fa-star',
	relationship_want_removed: 'fa-star-half-stroke',
	relationship_subject: 'fa-comment-dots',
	// Scene
	topic_tone: 'fa-comment',
	tension: 'fa-bolt',
	// Chapter
	chapter_ended: 'fa-flag-checkered',
	chapter_described: 'fa-book',
};

function getEventIcon(event: Event): string {
	const key = `${event.kind}_${'subkind' in event ? (event as any).subkind : ''}`.replace(
		/_$/,
		'',
	);
	return V2_EVENT_ICONS[key] || 'fa-circle';
}

function getEventColor(event: Event): string {
	if (isTimeEvent(event)) return V2_EVENT_COLORS.time;
	if (isLocationEvent(event)) {
		if (isLocationPropAddedEvent(event)) return V2_EVENT_COLORS.add;
		if (isLocationPropRemovedEvent(event)) return V2_EVENT_COLORS.remove;
		return V2_EVENT_COLORS.location;
	}
	if (isCharacterEvent(event)) {
		const subkind = event.subkind;
		if (
			subkind === 'appeared' ||
			subkind === 'mood_added' ||
			subkind === 'physical_added'
		) {
			return V2_EVENT_COLORS.add;
		}
		if (
			subkind === 'departed' ||
			subkind === 'mood_removed' ||
			subkind === 'physical_removed'
		) {
			return V2_EVENT_COLORS.remove;
		}
		return V2_EVENT_COLORS.character;
	}
	if (isRelationshipEvent(event)) return V2_EVENT_COLORS.relationship;
	if (isTensionEvent(event) || isTopicToneEvent(event)) return V2_EVENT_COLORS.scene;
	if (isChapterEvent(event)) return V2_EVENT_COLORS.chapter;
	return '#6b7280';
}

function formatSubkindLabel(subkind: string): string {
	return subkind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * V2 Event Editor Component
 */
export const V2EventEditor = forwardRef<V2EventEditorHandle, V2EventEditorProps>(
	function V2EventEditor({ events, messageId, swipeId, onEventsChange, projection }, ref) {
		const [showAddMenu, setShowAddMenu] = useState(false);
		const [collapsedGroups, setCollapsedGroups] = useState<Set<V2EventGroupKind>>(
			new Set(),
		);

		// Track which event is being edited and its ref
		const [editingEventId, setEditingEventId] = useState<string | null>(null);
		const inlineEditorRef = useRef<InlineEditorHandle>(null);

		// Group events by kind
		const groupedEvents = useMemo(() => {
			const timeEvents: TimeEvent[] = [];
			const locationEvents: LocationEvent[] = [];
			const characterEvents: CharacterEvent[] = [];
			const relationshipEvents: RelationshipEvent[] = [];
			const sceneEvents: (TensionEvent | TopicToneEvent)[] = [];
			const chapterEvents: ChapterEvent[] = [];

			for (const event of events) {
				if (isTimeEvent(event)) {
					timeEvents.push(event);
				} else if (isLocationEvent(event)) {
					locationEvents.push(event);
				} else if (isCharacterEvent(event)) {
					characterEvents.push(event);
				} else if (isRelationshipEvent(event)) {
					relationshipEvents.push(event);
				} else if (isTensionEvent(event) || isTopicToneEvent(event)) {
					sceneEvents.push(event);
				} else if (isChapterEvent(event)) {
					chapterEvents.push(event);
				}
			}

			return {
				timeEvents,
				locationEvents,
				characterEvents,
				relationshipEvents,
				sceneEvents,
				chapterEvents,
			};
		}, [events]);

		const toggleGroup = useCallback((kind: V2EventGroupKind) => {
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
			(eventId: string, updates: Partial<Event>) => {
				onEventsChange(
					events.map(e =>
						e.id === eventId ? { ...e, ...updates } : e,
					) as Event[],
				);
			},
			[events, onEventsChange],
		);

		const handleAddEvent = useCallback(
			(newEvent: Event) => {
				onEventsChange([...events, newEvent]);
				setShowAddMenu(false);
			},
			[events, onEventsChange],
		);

		// Commit pending edits and return final events array
		const commitPendingEdits = useCallback((): Event[] => {
			if (editingEventId && inlineEditorRef.current) {
				const updates = inlineEditorRef.current.getCurrentState();
				const finalEvents = events.map(e =>
					e.id === editingEventId ? { ...e, ...updates } : e,
				) as Event[];
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
							<V2TimeEventCard
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

				{/* Location Events */}
				{groupedEvents.locationEvents.length > 0 && (
					<EventGroup
						kind="location"
						label="Location Events"
						icon="fa-location-dot"
						count={groupedEvents.locationEvents.length}
						collapsed={collapsedGroups.has('location')}
						onToggle={() => toggleGroup('location')}
					>
						{groupedEvents.locationEvents.map((event, idx) => (
							<V2LocationEventCard
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
							<V2CharacterEventCard
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
								<V2RelationshipEventCard
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
									projection={projection}
								/>
							),
						)}
					</EventGroup>
				)}

				{/* Scene Events */}
				{groupedEvents.sceneEvents.length > 0 && (
					<EventGroup
						kind="scene"
						label="Scene Events"
						icon="fa-bolt"
						count={groupedEvents.sceneEvents.length}
						collapsed={collapsedGroups.has('scene')}
						onToggle={() => toggleGroup('scene')}
					>
						{groupedEvents.sceneEvents.map((event, idx) => (
							<V2SceneEventCard
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

				{/* Chapter Events */}
				{groupedEvents.chapterEvents.length > 0 && (
					<EventGroup
						kind="chapter"
						label="Chapter Events"
						icon="fa-book"
						count={groupedEvents.chapterEvents.length}
						collapsed={collapsedGroups.has('chapter')}
						onToggle={() => toggleGroup('chapter')}
					>
						{groupedEvents.chapterEvents.map((event, idx) => (
							<V2ChapterEventCard
								key={event.id}
								event={event}
								index={idx}
								onDelete={() =>
									handleDelete(event.id)
								}
							/>
						))}
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
						<V2AddEventMenu
							messageId={messageId}
							swipeId={swipeId}
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
	kind: V2EventGroupKind;
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

interface V2TimeEventCardProps {
	event: TimeEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<TimeEvent>) => void;
	onDelete: () => void;
}

function V2TimeEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: V2TimeEventCardProps) {
	const isInitial = isTimeInitialEvent(event);
	const summary = isInitial
		? new Date(event.time).toLocaleString()
		: formatTimeDelta(event.delta);

	if (isEditing && !isInitial) {
		return (
			<V2TimeDeltaEditor
				ref={editorRef}
				event={event as TimeDeltaEvent}
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
			data-kind="time"
			style={
				{
					'--event-type-color': V2_EVENT_COLORS.time,
				} as React.CSSProperties
			}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${getEventIcon(event)}`}
						style={{ color: V2_EVENT_COLORS.time }}
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
				{!isInitial && (
					<>
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
					</>
				)}
			</div>
		</div>
	);
}

interface V2TimeDeltaEditorProps {
	event: TimeDeltaEvent;
	onSave: (updates: Partial<TimeDeltaEvent>) => void;
	onCancel: () => void;
}

const V2TimeDeltaEditor = forwardRef<InlineEditorHandle, V2TimeDeltaEditorProps>(
	function V2TimeDeltaEditor({ event, onSave, onCancel }, ref) {
		const [delta, setDelta] = useState<TimeDelta>(event.delta);

		useImperativeHandle(
			ref,
			() => ({
				getCurrentState: () => ({ delta }),
			}),
			[delta],
		);

		return (
			<div className="bt-event-card bt-event-card-editing" data-kind="time">
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
						onClick={() => onSave({ delta })}
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

function formatTimeDelta(delta: TimeDelta): string {
	const parts: string[] = [];
	if (delta.days > 0) parts.push(`${delta.days}d`);
	if (delta.hours > 0) parts.push(`${delta.hours}h`);
	if (delta.minutes > 0) parts.push(`${delta.minutes}m`);
	if (delta.seconds > 0) parts.push(`${delta.seconds}s`);
	return parts.length > 0 ? parts.join(' ') : '0m';
}

// =============================================
// Location Event Card
// =============================================

interface V2LocationEventCardProps {
	event: LocationEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<LocationEvent>) => void;
	onDelete: () => void;
}

function V2LocationEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: V2LocationEventCardProps) {
	const isMoved = isLocationMovedEvent(event);
	const isPropAdded = isLocationPropAddedEvent(event);
	const color = getEventColor(event);

	let summary: string;
	let subkindLabel: string;

	if (isMoved) {
		summary = event.newPlace || event.newArea || 'Unknown location';
		subkindLabel = 'Location Change';
	} else if (isPropAdded) {
		summary = event.prop || '(empty)';
		subkindLabel = 'Prop Added';
	} else {
		summary = (event as LocationPropRemovedEvent).prop || '(empty)';
		subkindLabel = 'Prop Removed';
	}

	if (isEditing) {
		if (isMoved) {
			return (
				<V2LocationMovedEditor
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
			<V2LocationPropEditor
				ref={editorRef}
				event={event as LocationPropAddedEvent | LocationPropRemovedEvent}
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
			style={{ '--event-type-color': color } as React.CSSProperties}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${getEventIcon(event)}`}
						style={{ color }}
					/>
					<span className="bt-event-subkind">{subkindLabel}</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-place">{summary}</span>
					{isMoved && event.newPosition && (
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

const V2LocationMovedEditor = forwardRef<
	InlineEditorHandle,
	{
		event: LocationMovedEvent;
		onSave: (updates: Partial<LocationMovedEvent>) => void;
		onCancel: () => void;
	}
>(function V2LocationMovedEditor({ event, onSave, onCancel }, ref) {
	const [area, setArea] = useState(event.newArea);
	const [place, setPlace] = useState(event.newPlace);
	const [position, setPosition] = useState(event.newPosition);

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
						placeholder="Area (e.g., Downtown)"
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
				<button className="bt-action-btn" onClick={onCancel} title="Cancel">
					<i className="fa-solid fa-times"></i>
				</button>
			</div>
		</div>
	);
});

const V2LocationPropEditor = forwardRef<
	InlineEditorHandle,
	{
		event: LocationPropAddedEvent | LocationPropRemovedEvent;
		onSave: (
			updates: Partial<LocationPropAddedEvent | LocationPropRemovedEvent>,
		) => void;
		onCancel: () => void;
	}
>(function V2LocationPropEditor({ event, onSave, onCancel }, ref) {
	const [prop, setProp] = useState(event.prop);

	useImperativeHandle(
		ref,
		() => ({
			getCurrentState: () => ({ prop }),
		}),
		[prop],
	);

	return (
		<div className="bt-event-card bt-event-card-editing" data-kind="location">
			<div className="bt-event-card-content">
				<div className="bt-location-edit-fields">
					<input
						type="text"
						placeholder="Prop name"
						value={prop}
						onChange={e => setProp(e.target.value)}
					/>
				</div>
			</div>
			<div className="bt-event-actions" style={{ opacity: 1 }}>
				<button
					className="bt-action-btn"
					onClick={() => onSave({ prop })}
					title="Save"
				>
					<i className="fa-solid fa-check"></i>
				</button>
				<button className="bt-action-btn" onClick={onCancel} title="Cancel">
					<i className="fa-solid fa-times"></i>
				</button>
			</div>
		</div>
	);
});

// =============================================
// Character Event Card
// =============================================

interface V2CharacterEventCardProps {
	event: CharacterEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<CharacterEvent>) => void;
	onDelete: () => void;
}

function V2CharacterEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: V2CharacterEventCardProps) {
	const color = getEventColor(event);

	if (isEditing) {
		return (
			<V2CharacterEventEditor
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
			style={{ '--event-type-color': color } as React.CSSProperties}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${getEventIcon(event)}`}
						style={{ color }}
					/>
					<span className="bt-event-subkind">
						{formatSubkindLabel(event.subkind)}
					</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-char">{event.character}</span>
					{renderCharacterEventDetails(event)}
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

function renderCharacterEventDetails(event: CharacterEvent): React.ReactNode {
	switch (event.subkind) {
		case 'appeared':
			return event.initialPosition ? (
				<span className="bt-event-value">@ {event.initialPosition}</span>
			) : null;
		case 'profile_set':
			return (
				<span className="bt-event-value">
					{event.profile.sex}/{event.profile.species},{' '}
					{event.profile.age}
				</span>
			);
		case 'position_changed':
		case 'activity_changed':
			return event.newValue ? (
				<span className="bt-event-value">→ {event.newValue}</span>
			) : null;
		case 'mood_added':
		case 'mood_removed':
			return <span className="bt-event-tag bt-tag-mood">{event.mood}</span>;
		case 'physical_added':
		case 'physical_removed':
			return (
				<span className="bt-event-tag bt-tag-physical">
					{event.physicalState}
				</span>
			);
		case 'outfit_changed':
			return (
				<>
					<span className="bt-event-slot">[{event.slot}]</span>
					<span className="bt-event-value">
						→ {event.newValue || '(removed)'}
					</span>
				</>
			);
		default:
			return null;
	}
}

const V2CharacterEventEditor = forwardRef<
	InlineEditorHandle,
	{
		event: CharacterEvent;
		onSave: (updates: Partial<CharacterEvent>) => void;
		onCancel: () => void;
	}
>(function V2CharacterEventEditor({ event, onSave, onCancel }, ref) {
	const [character, setCharacter] = useState(event.character);
	const [newValue, setNewValue] = useState(
		'newValue' in event ? ((event as any).newValue ?? '') : '',
	);
	const [mood, setMood] = useState('mood' in event ? ((event as any).mood ?? '') : '');
	const [physicalState, setPhysicalState] = useState(
		'physicalState' in event ? ((event as any).physicalState ?? '') : '',
	);
	const [slot, setSlot] = useState<OutfitSlot>(
		'slot' in event ? ((event as any).slot ?? 'torso') : 'torso',
	);
	const [initialPosition, setInitialPosition] = useState(
		'initialPosition' in event ? ((event as any).initialPosition ?? '') : '',
	);
	const [initialActivity, setInitialActivity] = useState(
		'initialActivity' in event ? ((event as any).initialActivity ?? '') : '',
	);
	// Profile fields
	const [profileSex, setProfileSex] = useState<'M' | 'F' | 'O'>(
		'profile' in event ? ((event as any).profile?.sex ?? 'O') : 'O',
	);
	const [profileSpecies, setProfileSpecies] = useState(
		'profile' in event ? ((event as any).profile?.species ?? 'Human') : 'Human',
	);
	const [profileAge, setProfileAge] = useState<number>(
		'profile' in event ? ((event as any).profile?.age ?? 30) : 30,
	);
	const [profileAppearance, setProfileAppearance] = useState<string>(
		'profile' in event ? ((event as any).profile?.appearance?.join(', ') ?? '') : '',
	);
	const [profilePersonality, setProfilePersonality] = useState<string>(
		'profile' in event ? ((event as any).profile?.personality?.join(', ') ?? '') : '',
	);

	const getCurrentState = useCallback((): Partial<CharacterEvent> => {
		const updates: Record<string, any> = { character };

		switch (event.subkind) {
			case 'appeared':
				updates.initialPosition = initialPosition || undefined;
				updates.initialActivity = initialActivity || undefined;
				break;
			case 'profile_set':
				updates.profile = {
					sex: profileSex,
					species: profileSpecies,
					age: profileAge,
					appearance: profileAppearance
						.split(',')
						.map(s => s.trim())
						.filter(s => s),
					personality: profilePersonality
						.split(',')
						.map(s => s.trim())
						.filter(s => s),
				};
				break;
			case 'position_changed':
			case 'activity_changed':
				updates.newValue = newValue || '';
				break;
			case 'mood_added':
			case 'mood_removed':
				updates.mood = mood;
				break;
			case 'physical_added':
			case 'physical_removed':
				updates.physicalState = physicalState;
				break;
			case 'outfit_changed':
				updates.slot = slot;
				updates.newValue = newValue || null;
				break;
		}

		return updates as Partial<CharacterEvent>;
	}, [
		character,
		newValue,
		mood,
		physicalState,
		slot,
		initialPosition,
		initialActivity,
		profileSex,
		profileSpecies,
		profileAge,
		profileAppearance,
		profilePersonality,
		event.subkind,
	]);

	useImperativeHandle(ref, () => ({ getCurrentState }), [getCurrentState]);

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

					{event.subkind === 'appeared' && (
						<>
							<input
								type="text"
								placeholder="Initial position"
								value={initialPosition}
								onChange={e =>
									setInitialPosition(
										e.target.value,
									)
								}
							/>
							<input
								type="text"
								placeholder="Initial activity"
								value={initialActivity}
								onChange={e =>
									setInitialActivity(
										e.target.value,
									)
								}
							/>
						</>
					)}

					{event.subkind === 'profile_set' && (
						<>
							<div className="bt-profile-edit-row">
								<select
									value={profileSex}
									onChange={e =>
										setProfileSex(
											e.target
												.value as
												| 'M'
												| 'F'
												| 'O',
										)
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
								<input
									type="text"
									placeholder="Species"
									value={profileSpecies}
									onChange={e =>
										setProfileSpecies(
											e.target
												.value,
										)
									}
								/>
								<input
									type="number"
									placeholder="Age"
									min="0"
									value={profileAge}
									onChange={e =>
										setProfileAge(
											parseInt(
												e
													.target
													.value,
											) || 30,
										)
									}
								/>
							</div>
							<input
								type="text"
								placeholder="Appearance (comma-separated tags)"
								value={profileAppearance}
								onChange={e =>
									setProfileAppearance(
										e.target.value,
									)
								}
							/>
							<input
								type="text"
								placeholder="Personality (comma-separated tags)"
								value={profilePersonality}
								onChange={e =>
									setProfilePersonality(
										e.target.value,
									)
								}
							/>
						</>
					)}

					{(event.subkind === 'position_changed' ||
						event.subkind === 'activity_changed') && (
						<input
							type="text"
							placeholder={
								event.subkind === 'position_changed'
									? 'New position'
									: 'New activity'
							}
							value={newValue}
							onChange={e => setNewValue(e.target.value)}
						/>
					)}

					{(event.subkind === 'mood_added' ||
						event.subkind === 'mood_removed') && (
						<input
							type="text"
							placeholder="Mood"
							value={mood}
							onChange={e => setMood(e.target.value)}
						/>
					)}

					{(event.subkind === 'physical_added' ||
						event.subkind === 'physical_removed') && (
						<input
							type="text"
							placeholder="Physical state"
							value={physicalState}
							onChange={e =>
								setPhysicalState(e.target.value)
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
								{OUTFIT_SLOTS.map(s => (
									<option key={s} value={s}>
										{s
											.charAt(0)
											.toUpperCase() +
											s.slice(1)}
									</option>
								))}
							</select>
							<input
								type="text"
								placeholder="New item (empty = removed)"
								value={newValue}
								onChange={e =>
									setNewValue(e.target.value)
								}
							/>
						</>
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
				<button className="bt-action-btn" onClick={onCancel} title="Cancel">
					<i className="fa-solid fa-times"></i>
				</button>
			</div>
		</div>
	);
});

// =============================================
// Relationship Event Card
// =============================================

interface V2RelationshipEventCardProps {
	event: RelationshipEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<RelationshipEvent>) => void;
	onDelete: () => void;
	projection: Projection;
}

function V2RelationshipEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
	projection,
}: V2RelationshipEventCardProps) {
	const color = getEventColor(event);
	const isStatus = isRelationshipStatusChangedEvent(event);
	const isDirectional = isDirectionalRelationshipEvent(event);

	let pairDisplay: string;
	let valueDisplay: React.ReactNode = null;

	if (isStatus) {
		pairDisplay = `${event.pair[0]} & ${event.pair[1]}`;
		valueDisplay = <span className="bt-event-status">→ {event.newStatus}</span>;
	} else if (isDirectional) {
		pairDisplay = `${event.fromCharacter} → ${event.towardCharacter}`;
		valueDisplay = <span className="bt-event-value">"{event.value}"</span>;
	} else {
		// Subject event
		const subjectEvent = event as any;
		pairDisplay = `${subjectEvent.pair[0]} & ${subjectEvent.pair[1]}`;
		valueDisplay = (
			<>
				<span className="bt-event-value">
					{subjectEvent.subject.replace(/_/g, ' ')}
				</span>
				{subjectEvent.milestoneDescription && (
					<span className="bt-event-milestone-desc">
						<i
							className="fa-solid fa-star"
							style={{ color: '#eab308' }}
						/>
						{subjectEvent.milestoneDescription}
					</span>
				)}
			</>
		);
	}

	if (isEditing) {
		return (
			<V2RelationshipEventEditor
				ref={editorRef}
				event={event}
				projection={projection}
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
			data-kind="relationship"
			style={{ '--event-type-color': color } as React.CSSProperties}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${getEventIcon(event)}`}
						style={{ color }}
					/>
					<span className="bt-event-subkind">
						{formatSubkindLabel(event.subkind)}
					</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-pair">{pairDisplay}</span>
					{valueDisplay}
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

const V2RelationshipEventEditor = forwardRef<
	InlineEditorHandle,
	{
		event: RelationshipEvent;
		projection: Projection;
		onSave: (updates: Partial<RelationshipEvent>) => void;
		onCancel: () => void;
	}
>(function V2RelationshipEventEditor({ event, projection, onSave, onCancel }, ref) {
	const isStatus = isRelationshipStatusChangedEvent(event);
	const isDirectional = isDirectionalRelationshipEvent(event);
	const isSubject = isRelationshipSubjectEvent(event);

	// Get character names from projection
	const characterNames = useMemo(
		() => Object.keys(projection.characters),
		[projection.characters],
	);

	const [charA, setCharA] = useState(
		isStatus
			? event.pair[0]
			: isDirectional
				? event.fromCharacter
				: isSubject
					? (event as RelationshipSubjectEvent).pair[0]
					: '',
	);
	const [charB, setCharB] = useState(
		isStatus
			? event.pair[1]
			: isDirectional
				? event.towardCharacter
				: isSubject
					? (event as RelationshipSubjectEvent).pair[1]
					: '',
	);
	const [value, setValue] = useState(isDirectional ? event.value : '');
	const [newStatus, setNewStatus] = useState<RelationshipStatus>(
		isStatus ? event.newStatus : 'acquaintances',
	);
	const [subject, setSubject] = useState<Subject>(
		isSubject ? (event as RelationshipSubjectEvent).subject : 'conversation',
	);
	const [milestoneDescription, setMilestoneDescription] = useState(
		isSubject ? (event as RelationshipSubjectEvent).milestoneDescription ?? '' : '',
	);

	const getCurrentState = useCallback((): Partial<RelationshipEvent> => {
		if (isStatus) {
			return {
				pair: sortPair(charA, charB),
				newStatus,
			} as Partial<RelationshipStatusChangedEvent>;
		}
		if (isDirectional) {
			return {
				fromCharacter: charA,
				towardCharacter: charB,
				value,
			} as Partial<
				| RelationshipFeelingAddedEvent
				| RelationshipFeelingRemovedEvent
				| RelationshipSecretAddedEvent
				| RelationshipSecretRemovedEvent
				| RelationshipWantAddedEvent
				| RelationshipWantRemovedEvent
			>;
		}
		// Subject event
		return {
			pair: sortPair(charA, charB),
			subject,
			milestoneDescription: milestoneDescription || undefined,
		} as Partial<RelationshipSubjectEvent>;
	}, [charA, charB, value, newStatus, isStatus, isDirectional, subject, milestoneDescription]);

	useImperativeHandle(ref, () => ({ getCurrentState }), [getCurrentState]);

	// Format subject for display
	const formatSubject = (s: Subject) => s.replace(/_/g, ' ');

	return (
		<div className="bt-event-card bt-event-card-editing" data-kind="relationship">
			<div className="bt-event-card-content">
				<div className="bt-relationship-edit-fields">
					<div className="bt-pair-inputs">
						<select
							value={charA}
							onChange={e => setCharA(e.target.value)}
						>
							<option value="">
								{isDirectional ? 'From character' : 'Character A'}
							</option>
							{characterNames.map(name => (
								<option key={name} value={name}>
									{name}
								</option>
							))}
						</select>
						<span>{isDirectional ? '→' : '&'}</span>
						<select
							value={charB}
							onChange={e => setCharB(e.target.value)}
						>
							<option value="">
								{isDirectional ? 'Toward character' : 'Character B'}
							</option>
							{characterNames.map(name => (
								<option key={name} value={name}>
									{name}
								</option>
							))}
						</select>
					</div>

					{isDirectional && (
						<input
							type="text"
							placeholder="Value (feeling/secret/want)"
							value={value}
							onChange={e => setValue(e.target.value)}
						/>
					)}

					{isStatus && (
						<select
							value={newStatus}
							onChange={e =>
								setNewStatus(e.target.value as RelationshipStatus)
							}
						>
							{RELATIONSHIP_STATUSES.map(status => (
								<option key={status} value={status}>
									{status.charAt(0).toUpperCase() + status.slice(1)}
								</option>
							))}
						</select>
					)}

					{isSubject && (
						<>
							<select
								value={subject}
								onChange={e => setSubject(e.target.value as Subject)}
							>
								{SUBJECTS.map(s => (
									<option key={s} value={s}>
										{formatSubject(s)}
									</option>
								))}
							</select>
							<input
								type="text"
								placeholder="Milestone description (optional)"
								value={milestoneDescription}
								onChange={e => setMilestoneDescription(e.target.value)}
							/>
						</>
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
				<button className="bt-action-btn" onClick={onCancel} title="Cancel">
					<i className="fa-solid fa-times"></i>
				</button>
			</div>
		</div>
	);
});

// =============================================
// Scene Event Card (Tension / TopicTone)
// =============================================

interface V2SceneEventCardProps {
	event: TensionEvent | TopicToneEvent;
	index: number;
	isEditing: boolean;
	onStartEdit: () => void;
	onEndEdit: () => void;
	editorRef?: React.RefObject<InlineEditorHandle | null>;
	onUpdate: (updates: Partial<TensionEvent | TopicToneEvent>) => void;
	onDelete: () => void;
}

function V2SceneEventCard({
	event,
	index,
	isEditing,
	onStartEdit,
	onEndEdit,
	editorRef,
	onUpdate,
	onDelete,
}: V2SceneEventCardProps) {
	const isTension = isTensionEvent(event);
	const color = V2_EVENT_COLORS.scene;

	let summary: string;
	if (isTension) {
		summary = `${event.level} ${event.type} (${event.direction})`;
	} else {
		summary = `${event.topic} / ${event.tone}`;
	}

	if (isEditing) {
		if (isTension) {
			return (
				<V2TensionEventEditor
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
			<V2TopicToneEventEditor
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
			data-kind="scene"
			style={{ '--event-type-color': color } as React.CSSProperties}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${isTension ? 'fa-bolt' : 'fa-comment'}`}
						style={{ color }}
					/>
					<span className="bt-event-subkind">
						{isTension ? 'Tension' : 'Topic/Tone'}
					</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-value">{summary}</span>
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

const V2TensionEventEditor = forwardRef<
	InlineEditorHandle,
	{
		event: TensionEvent;
		onSave: (updates: Partial<TensionEvent>) => void;
		onCancel: () => void;
	}
>(function V2TensionEventEditor({ event, onSave, onCancel }, ref) {
	const [level, setLevel] = useState<TensionLevel>(event.level);
	const [type, setType] = useState<TensionType>(event.type);
	const [direction, setDirection] = useState<TensionDirection>(event.direction);

	useImperativeHandle(
		ref,
		() => ({
			getCurrentState: () => ({ level, type, direction }),
		}),
		[level, type, direction],
	);

	return (
		<div className="bt-event-card bt-event-card-editing" data-kind="scene">
			<div className="bt-event-card-content">
				<div className="bt-char-edit-fields">
					<select
						value={level}
						onChange={e =>
							setLevel(e.target.value as TensionLevel)
						}
					>
						{TENSION_LEVELS.map(l => (
							<option key={l} value={l}>
								{l.charAt(0).toUpperCase() +
									l.slice(1)}
							</option>
						))}
					</select>
					<select
						value={type}
						onChange={e =>
							setType(e.target.value as TensionType)
						}
					>
						{TENSION_TYPES.map(t => (
							<option key={t} value={t}>
								{t.charAt(0).toUpperCase() +
									t.slice(1)}
							</option>
						))}
					</select>
					<select
						value={direction}
						onChange={e =>
							setDirection(
								e.target.value as TensionDirection,
							)
						}
					>
						{TENSION_DIRECTIONS.map(d => (
							<option key={d} value={d}>
								{d.charAt(0).toUpperCase() +
									d.slice(1)}
							</option>
						))}
					</select>
				</div>
			</div>
			<div className="bt-event-actions" style={{ opacity: 1 }}>
				<button
					className="bt-action-btn"
					onClick={() => onSave({ level, type, direction })}
					title="Save"
				>
					<i className="fa-solid fa-check"></i>
				</button>
				<button className="bt-action-btn" onClick={onCancel} title="Cancel">
					<i className="fa-solid fa-times"></i>
				</button>
			</div>
		</div>
	);
});

const V2TopicToneEventEditor = forwardRef<
	InlineEditorHandle,
	{
		event: TopicToneEvent;
		onSave: (updates: Partial<TopicToneEvent>) => void;
		onCancel: () => void;
	}
>(function V2TopicToneEventEditor({ event, onSave, onCancel }, ref) {
	const [topic, setTopic] = useState(event.topic);
	const [tone, setTone] = useState(event.tone);

	useImperativeHandle(
		ref,
		() => ({
			getCurrentState: () => ({ topic, tone }),
		}),
		[topic, tone],
	);

	return (
		<div className="bt-event-card bt-event-card-editing" data-kind="scene">
			<div className="bt-event-card-content">
				<div className="bt-char-edit-fields">
					<input
						type="text"
						placeholder="Topic"
						value={topic}
						onChange={e => setTopic(e.target.value)}
					/>
					<input
						type="text"
						placeholder="Tone"
						value={tone}
						onChange={e => setTone(e.target.value)}
					/>
				</div>
			</div>
			<div className="bt-event-actions" style={{ opacity: 1 }}>
				<button
					className="bt-action-btn"
					onClick={() => onSave({ topic, tone })}
					title="Save"
				>
					<i className="fa-solid fa-check"></i>
				</button>
				<button className="bt-action-btn" onClick={onCancel} title="Cancel">
					<i className="fa-solid fa-times"></i>
				</button>
			</div>
		</div>
	);
});

// =============================================
// Chapter Event Card (Read-Only)
// =============================================

interface V2ChapterEventCardProps {
	event: ChapterEvent;
	index: number;
	onDelete: () => void;
}

function V2ChapterEventCard({ event, index, onDelete }: V2ChapterEventCardProps) {
	const isEnded = event.subkind === 'ended';
	const color = V2_EVENT_COLORS.chapter;

	let summary: string;
	if (isEnded) {
		summary = `Chapter ${event.chapterIndex + 1} ended (${event.reason})`;
	} else {
		summary = `"${event.title}"`;
	}

	return (
		<div
			className="bt-event-card"
			data-kind="chapter"
			style={{ '--event-type-color': color } as React.CSSProperties}
		>
			<div className="bt-event-card-content">
				<div className="bt-state-event-header">
					<span className="bt-event-index">#{index + 1}</span>
					<i
						className={`fa-solid ${getEventIcon(event)}`}
						style={{ color }}
					/>
					<span className="bt-event-subkind">
						{isEnded ? 'Chapter Ended' : 'Chapter Described'}
					</span>
				</div>
				<div className="bt-event-details">
					<span className="bt-event-value">{summary}</span>
				</div>
			</div>
			<div className="bt-event-actions">
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

// =============================================
// Add Event Menu
// =============================================

interface V2AddEventMenuProps {
	messageId: number;
	swipeId: number;
	onAdd: (event: Event) => void;
	onClose: () => void;
	projection: Projection;
}

type V2SubmenuType =
	| 'prop_removed'
	| 'departed'
	| 'mood_removed'
	| 'physical_removed'
	| 'outfit_changed'
	| 'position_changed'
	| 'activity_changed'
	| null;

function V2AddEventMenu({ messageId, swipeId, onAdd, onClose, projection }: V2AddEventMenuProps) {
	const [submenu, setSubmenu] = useState<V2SubmenuType>(null);
	const [selectedChar, setSelectedChar] = useState<string | null>(null);

	const characterNames = useMemo(
		() => Object.keys(projection.characters),
		[projection.characters],
	);
	const props = projection.location?.props ?? [];

	const createBaseEvent = () => ({
		id: generateUUID(),
		source: { messageId, swipeId },
		timestamp: Date.now(),
	});

	const handleBack = () => {
		if (selectedChar) {
			setSelectedChar(null);
		} else {
			setSubmenu(null);
		}
	};

	// Submenu for prop removal
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
									onAdd({
										...createBaseEvent(),
										kind: 'location',
										subkind: 'prop_removed',
										prop,
									} as LocationPropRemovedEvent);
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

	// Submenu for character departure
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
									onAdd({
										...createBaseEvent(),
										kind: 'character',
										subkind: 'departed',
										character: name,
									} as CharacterDepartedEvent);
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

	// Submenu for mood removal
	if (submenu === 'mood_removed') {
		if (!selectedChar) {
			const charsWithMoods = characterNames.filter(
				n => projection.characters[n]?.mood?.length > 0,
			);
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
						{charsWithMoods.length === 0 ? (
							<div className="bt-add-event-empty">
								No characters have moods
							</div>
						) : (
							charsWithMoods.map(name => (
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
										{projection
											.characters[
											name
										]?.mood?.length ??
											0}
										)
									</span>
								</div>
							))
						)}
					</div>
				</>
			);
		}

		const moods = projection.characters[selectedChar]?.mood ?? [];
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
								onAdd({
									...createBaseEvent(),
									kind: 'character',
									subkind: 'mood_removed',
									character: selectedChar,
									mood,
								} as CharacterMoodRemovedEvent);
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

	// Submenu for physical removal
	if (submenu === 'physical_removed') {
		if (!selectedChar) {
			const charsWithPhysical = characterNames.filter(
				n => projection.characters[n]?.physicalState?.length > 0,
			);
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
						{charsWithPhysical.length === 0 ? (
							<div className="bt-add-event-empty">
								No characters have physical states
							</div>
						) : (
							charsWithPhysical.map(name => (
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
										{projection
											.characters[
											name
										]?.physicalState
											?.length ??
											0}
										)
									</span>
								</div>
							))
						)}
					</div>
				</>
			);
		}

		const states = projection.characters[selectedChar]?.physicalState ?? [];
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
								onAdd({
									...createBaseEvent(),
									kind: 'character',
									subkind: 'physical_removed',
									character: selectedChar,
									physicalState: state,
								} as CharacterPhysicalRemovedEvent);
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

	// Submenu for outfit change
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

		const outfit = projection.characters[selectedChar]?.outfit;
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
					{OUTFIT_SLOTS.map(slot => {
						const currentItem = outfit?.[slot] ?? null;
						return (
							<div
								key={slot}
								className="bt-add-event-option"
								onClick={() => {
									onAdd({
										...createBaseEvent(),
										kind: 'character',
										subkind: 'outfit_changed',
										character: selectedChar,
										slot,
										newValue: null,
										previousValue:
											currentItem,
									} as CharacterOutfitChangedEvent);
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

	// Submenu for position/activity change
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
							const char = projection.characters[name];
							const current = isPosition
								? char?.position
								: char?.activity;
							return (
								<div
									key={name}
									className="bt-add-event-option"
									onClick={() => {
										const event =
											isPosition
												? ({
														...createBaseEvent(),
														kind: 'character',
														subkind: 'position_changed',
														character: name,
														newValue: '',
														previousValue:
															current ??
															'',
													} as CharacterPositionChangedEvent)
												: ({
														...createBaseEvent(),
														kind: 'character',
														subkind: 'activity_changed',
														character: name,
														newValue: null,
														previousValue:
															current,
													} as CharacterActivityChangedEvent);
										onAdd(event);
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
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'time',
							subkind: 'delta',
							delta: {
								days: 0,
								hours: 0,
								minutes: 0,
								seconds: 0,
							},
						} as TimeDeltaEvent)
					}
				>
					<i className="fa-regular fa-clock"></i>
					Time Delta
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'location',
							subkind: 'moved',
							newArea: '',
							newPlace: '',
							newPosition: '',
						} as LocationMovedEvent)
					}
				>
					<i className="fa-solid fa-location-dot"></i>
					Location Change
				</div>

				<div className="bt-add-event-section-label">Location Props</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'location',
							subkind: 'prop_added',
							prop: '',
						} as LocationPropAddedEvent)
					}
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
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'character',
							subkind: 'appeared',
							character: '',
						} as CharacterAppearedEvent)
					}
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
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'character',
							subkind: 'mood_added',
							character: '',
							mood: '',
						} as CharacterMoodAddedEvent)
					}
				>
					<i className="fa-regular fa-face-smile"></i>
					Mood Added
				</div>
				<div
					className={`bt-add-event-option ${
						characterNames.filter(
							n =>
								projection.characters[n]?.mood
									?.length > 0,
						).length === 0
							? 'disabled'
							: ''
					}`}
					onClick={() => {
						if (
							characterNames.filter(
								n =>
									projection.characters[n]
										?.mood?.length > 0,
							).length > 0
						) {
							setSubmenu('mood_removed');
						}
					}}
				>
					<i className="fa-regular fa-face-meh"></i>
					Mood Removed
					{characterNames.filter(
						n => projection.characters[n]?.mood?.length > 0,
					).length > 0 && (
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
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'character',
							subkind: 'physical_added',
							character: '',
							physicalState: '',
						} as CharacterPhysicalAddedEvent)
					}
				>
					<i className="fa-solid fa-heart-pulse"></i>
					Physical State Added
				</div>
				<div
					className={`bt-add-event-option ${
						characterNames.filter(
							n =>
								projection.characters[n]
									?.physicalState?.length > 0,
						).length === 0
							? 'disabled'
							: ''
					}`}
					onClick={() => {
						if (
							characterNames.filter(
								n =>
									projection.characters[n]
										?.physicalState
										?.length > 0,
							).length > 0
						) {
							setSubmenu('physical_removed');
						}
					}}
				>
					<i className="fa-solid fa-heart"></i>
					Physical State Removed
					{characterNames.filter(
						n =>
							projection.characters[n]?.physicalState
								?.length > 0,
					).length > 0 && (
						<i className="fa-solid fa-chevron-right bt-submenu-arrow"></i>
					)}
				</div>

				<div className="bt-add-event-section-label">
					Relationship Events
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'relationship',
							subkind: 'feeling_added',
							fromCharacter: '',
							towardCharacter: '',
							value: '',
						} as RelationshipFeelingAddedEvent)
					}
				>
					<i className="fa-solid fa-heart-circle-plus"></i>
					Feeling Added
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'relationship',
							subkind: 'feeling_removed',
							fromCharacter: '',
							towardCharacter: '',
							value: '',
						} as RelationshipFeelingRemovedEvent)
					}
				>
					<i className="fa-solid fa-heart-circle-minus"></i>
					Feeling Removed
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'relationship',
							subkind: 'secret_added',
							fromCharacter: '',
							towardCharacter: '',
							value: '',
						} as RelationshipSecretAddedEvent)
					}
				>
					<i className="fa-solid fa-user-secret"></i>
					Secret Added
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'relationship',
							subkind: 'secret_removed',
							fromCharacter: '',
							towardCharacter: '',
							value: '',
						} as RelationshipSecretRemovedEvent)
					}
				>
					<i className="fa-solid fa-mask"></i>
					Secret Removed
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'relationship',
							subkind: 'want_added',
							fromCharacter: '',
							towardCharacter: '',
							value: '',
						} as RelationshipWantAddedEvent)
					}
				>
					<i className="fa-solid fa-star"></i>
					Want Added
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'relationship',
							subkind: 'want_removed',
							fromCharacter: '',
							towardCharacter: '',
							value: '',
						} as RelationshipWantRemovedEvent)
					}
				>
					<i className="fa-solid fa-star-half-stroke"></i>
					Want Removed
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'relationship',
							subkind: 'status_changed',
							pair: ['', ''],
							newStatus: 'acquaintances',
						} as RelationshipStatusChangedEvent)
					}
				>
					<i className="fa-solid fa-people-arrows"></i>
					Status Changed
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'relationship',
							subkind: 'subject',
							pair: ['', ''],
							subject: 'conversation',
						} as RelationshipSubjectEvent)
					}
				>
					<i className="fa-solid fa-comment-dots"></i>
					Subject
				</div>

				<div className="bt-add-event-section-label">Scene Events</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'tension',
							level: 'relaxed',
							type: 'conversation',
							direction: 'stable',
						} as TensionEvent)
					}
				>
					<i className="fa-solid fa-bolt"></i>
					Tension Change
				</div>
				<div
					className="bt-add-event-option"
					onClick={() =>
						onAdd({
							...createBaseEvent(),
							kind: 'topic_tone',
							topic: '',
							tone: '',
						} as TopicToneEvent)
					}
				>
					<i className="fa-solid fa-comment"></i>
					Topic/Tone Change
				</div>
			</div>
		</>
	);
}

export default V2EventEditor;
