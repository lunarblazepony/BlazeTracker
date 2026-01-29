// ============================================
// Event List Component
// ============================================

import React, { useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type {
	TimestampedEvent,
	NarrativeDateTime,
	EventType,
	MilestoneType,
} from '../../types/state';
import {
	getTensionLevelIcon,
	getTensionColor,
	getTensionIcon,
	getTensionTypeColor,
	getEventTypeIcon,
	getEventTypeColor,
	EVENT_TYPE_PRIORITY,
} from '../icons';
import { EventEditor, type EventEditorHandle } from './EventEditor';

// ============================================
// Types
// ============================================

export interface PendingEdit {
	index: number;
	event: TimestampedEvent;
}

export interface EventListHandle {
	/** Get any pending edit without committing (returns null if no edit in progress) */
	getPendingEdit: () => PendingEdit | null;
	/** Commit any pending edits and return true if there were pending edits */
	commitPendingEdits: () => boolean;
}

/** Computed milestone from event store */
export interface ComputedEventMilestone {
	type: MilestoneType;
	pair: [string, string];
	description?: string;
}

interface EventListProps {
	events: TimestampedEvent[];
	presentCharacters?: string[];
	maxEvents?: number;
	editMode?: boolean;
	onUpdate?: (index: number, event: TimestampedEvent) => void;
	onDelete?: (index: number) => void;
	/** Compute milestones for a specific event (by messageId) */
	computeMilestonesForEvent?: (messageId: number) => ComputedEventMilestone[];
}

interface EventItemProps {
	event: TimestampedEvent;
	index: number;
	presentCharacters?: string[];
	opacity?: number;
	editMode?: boolean;
	onEdit?: () => void;
	onDelete?: () => void;
	/** Computed milestones for this event (from event store) */
	computedMilestones?: ComputedEventMilestone[];
}

// ============================================
// Helpers
// ============================================

function formatEventTime(dt: NarrativeDateTime): string {
	const hour12 = dt.hour % 12 || 12;
	const ampm = dt.hour < 12 ? 'AM' : 'PM';
	const minute = dt.minute.toString().padStart(2, '0');
	return `${dt.dayOfWeek} ${hour12}:${minute} ${ampm}`;
}

function getAbsentWitnesses(witnesses: string[], presentCharacters: string[]): string[] {
	const presentSet = new Set(presentCharacters.map(c => c.toLowerCase()));
	return witnesses.filter(w => !presentSet.has(w.toLowerCase()));
}

/**
 * Sort event types by salience (priority) order.
 */
function sortByPriority(types: EventType[]): EventType[] {
	return [...types].sort((a, b) => {
		const aIndex = EVENT_TYPE_PRIORITY.indexOf(a);
		const bIndex = EVENT_TYPE_PRIORITY.indexOf(b);
		// Types not in priority list go to the end
		const aPos = aIndex === -1 ? EVENT_TYPE_PRIORITY.length : aIndex;
		const bPos = bIndex === -1 ? EVENT_TYPE_PRIORITY.length : bIndex;
		return aPos - bPos;
	});
}

// ============================================
// Components
// ============================================

function EventItem({
	event,
	index: _index,
	presentCharacters,
	opacity = 1,
	editMode,
	onEdit,
	onDelete,
	computedMilestones,
}: EventItemProps) {
	const levelIconClass = getTensionLevelIcon(event.tensionLevel);
	const levelColor = getTensionColor(event.tensionLevel);
	const typeIconClass = getTensionIcon(event.tensionType);
	const typeColor = getTensionTypeColor(event.tensionType);

	// Prefer computed milestones from event store, fall back to legacy format
	const milestones = computedMilestones ?? event.relationshipSignal?.milestones ?? [];

	// Get event types sorted by salience
	const eventTypes: EventType[] = event.eventTypes?.length
		? sortByPriority(event.eventTypes)
		: ['conversation'];

	// Calculate absent witnesses for dramatic irony notes
	const absentWitnesses = presentCharacters
		? getAbsentWitnesses(event.witnesses, presentCharacters)
		: [];

	// Format tooltips
	const levelTooltip = `Level: ${event.tensionLevel}`;
	const typeTooltip = `Type: ${event.tensionType}`;

	return (
		<div
			className="bt-event-item"
			style={
				{
					borderLeftColor: levelColor,
					'--bt-event-opacity': opacity,
				} as React.CSSProperties
			}
		>
			{/* Row 1: Date (left), Event type icons + edit buttons (right) */}
			<div className="bt-event-header">
				<span className="bt-event-time">
					{formatEventTime(event.timestamp)}
				</span>
				<div className="bt-event-header-right">
					<span className="bt-event-types">
						{eventTypes.map((type, idx) => (
							<i
								key={idx}
								className={getEventTypeIcon(type)}
								style={{
									color: getEventTypeColor(
										type,
									),
								}}
								title={type.replace(/_/g, ' ')}
							/>
						))}
					</span>
					{editMode && (
						<div className="bt-event-actions">
							<button
								type="button"
								className="bt-edit-btn-small"
								onClick={onEdit}
								title="Edit event"
							>
								<i className="fa-solid fa-pen"></i>
							</button>
							<button
								type="button"
								className="bt-delete-btn-small"
								onClick={onDelete}
								title="Delete event"
							>
								<i className="fa-solid fa-trash"></i>
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Row 2: Milestones (if any) */}
			{milestones.length > 0 && (
				<div className="bt-event-milestones">
					{milestones.map((m, idx) => (
						<span key={idx} className="bt-milestone-item">
							<i className="fa-solid fa-star" />
							<span className="bt-milestone-type">
								{m.type.replace(/_/g, ' ')}
							</span>
							{m.description && (
								<span className="bt-milestone-desc">
									{m.description}
								</span>
							)}
						</span>
					))}
				</div>
			)}

			{/* Row 3: Description */}
			<div className="bt-event-summary">{event.summary}</div>

			{/* Row 4: Witnesses/Participants (left), Tension icons (right) */}
			<div className="bt-event-footer">
				<div className="bt-event-people">
					{event.witnesses.length > 0 && (
						<div className="bt-event-witnesses">
							<span className="bt-witnesses-label">
								Witnesses:
							</span>
							{event.witnesses.map((w, i) => (
								<span
									key={i}
									className="bt-witness"
								>
									{w}
								</span>
							))}
						</div>
					)}

					{absentWitnesses.length > 0 && (
						<div className="bt-event-absent">
							<span className="bt-absent-label">
								Not present:
							</span>
							{absentWitnesses.map((w, i) => (
								<span
									key={i}
									className="bt-absent-witness"
								>
									{w}
								</span>
							))}
						</div>
					)}
				</div>

				<div className="bt-event-tension">
					<i
						className={typeIconClass}
						style={{ color: typeColor }}
						title={typeTooltip}
					/>
					<i
						className={levelIconClass}
						style={{ color: levelColor }}
						title={levelTooltip}
					/>
				</div>
			</div>
		</div>
	);
}

export const EventList = forwardRef<EventListHandle, EventListProps>(function EventList(
	{
		events,
		presentCharacters,
		maxEvents,
		editMode,
		onUpdate,
		onDelete,
		computeMilestonesForEvent,
	},
	ref,
) {
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const eventEditorRef = useRef<EventEditorHandle>(null);

	// Get the most recent events (from the end of the array)
	const recentEvents = maxEvents ? events.slice(-maxEvents) : events;
	// Reverse to show newest first
	const displayEvents = [...recentEvents].reverse();

	// Calculate the original index from display index
	const getOriginalIndex = (displayIndex: number): number => {
		// displayEvents is reversed, so we need to map back
		const recentIndex = displayEvents.length - 1 - displayIndex;
		// Then add the offset from slice
		const startOffset = events.length - recentEvents.length;
		return startOffset + recentIndex;
	};

	const handleEdit = (displayIndex: number) => {
		setEditingIndex(getOriginalIndex(displayIndex));
	};

	const handleDelete = (displayIndex: number) => {
		if (onDelete) {
			onDelete(getOriginalIndex(displayIndex));
		}
	};

	const handleSaveEdit = useCallback(
		(event: TimestampedEvent) => {
			if (onUpdate && editingIndex !== null) {
				onUpdate(editingIndex, event);
				setEditingIndex(null);
			}
		},
		[onUpdate, editingIndex],
	);

	const handleCancelEdit = () => {
		setEditingIndex(null);
	};

	// Get any pending edit without committing
	const getPendingEdit = useCallback((): PendingEdit | null => {
		if (editingIndex !== null && eventEditorRef.current) {
			return {
				index: editingIndex,
				event: eventEditorRef.current.getCurrentState(),
			};
		}
		return null;
	}, [editingIndex]);

	// Commit any pending edits by getting the current state from the editor
	const commitPendingEdits = useCallback((): boolean => {
		if (editingIndex !== null && eventEditorRef.current && onUpdate) {
			const currentState = eventEditorRef.current.getCurrentState();
			onUpdate(editingIndex, currentState);
			setEditingIndex(null);
			return true;
		}
		return false;
	}, [editingIndex, onUpdate]);

	// Expose methods via ref
	useImperativeHandle(
		ref,
		() => ({
			getPendingEdit,
			commitPendingEdits,
		}),
		[getPendingEdit, commitPendingEdits],
	);

	if (displayEvents.length === 0) {
		return (
			<div className="bt-event-list bt-empty">
				<p>No events recorded yet.</p>
			</div>
		);
	}

	// Find the event being edited (if any)
	const eventBeingEdited = editingIndex !== null ? events[editingIndex] : null;

	return (
		<div className="bt-event-list">
			{displayEvents.map((event, displayIndex) => {
				const originalIndex = getOriginalIndex(displayIndex);

				// Show editor in-place instead of hiding item
				if (originalIndex === editingIndex && eventBeingEdited) {
					return (
						<div
							key={originalIndex}
							className="bt-event-editor-container"
						>
							<EventEditor
								ref={eventEditorRef}
								event={eventBeingEdited}
								onSave={handleSaveEdit}
								onCancel={handleCancelEdit}
							/>
						</div>
					);
				}

				// Decrease opacity for older events: 100%, 75%, 50%, 40% (min)
				const opacity = Math.max(0.4, 1 - displayIndex * 0.25);
				// Compute milestones for this event if function is provided
				const computedMilestones =
					computeMilestonesForEvent && event.messageId !== undefined
						? computeMilestonesForEvent(event.messageId)
						: undefined;
				return (
					<EventItem
						key={originalIndex}
						event={event}
						index={originalIndex}
						presentCharacters={presentCharacters}
						opacity={editMode ? 1 : opacity}
						editMode={editMode}
						onEdit={() => handleEdit(displayIndex)}
						onDelete={() => handleDelete(displayIndex)}
						computedMilestones={computedMilestones}
					/>
				);
			})}
		</div>
	);
});
