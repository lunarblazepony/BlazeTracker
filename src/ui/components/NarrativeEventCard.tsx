// ============================================
// Narrative Event Card Component
// ============================================
// Displays a NarrativeEvent with inline edit/delete capabilities

import React, { useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { NarrativeEvent, EventType, TensionLevel, TensionType } from '../../types/state';
import { EVENT_TYPES, TENSION_LEVELS, TENSION_TYPES } from '../../types/state';
import { getTensionIcon, getTensionColor, getEventTypeIcon, getEventTypeColor } from '../icons';

/** Handle for accessing current edited state */
export interface NarrativeEventCardHandle {
	getCurrentState: () => Partial<NarrativeEvent>;
}

interface NarrativeEventCardProps {
	event: NarrativeEvent;
	/** Compact display mode */
	compact?: boolean;
	/** Update callback - if provided, enables editing */
	onUpdate?: (updates: Partial<NarrativeEvent>) => void;
	/** Delete callback - if provided, enables delete button */
	onDelete?: () => void;
	/** Whether this card is currently being edited (controlled from parent) */
	isEditing?: boolean;
	/** Callback when editing starts */
	onStartEdit?: () => void;
	/** Callback when editing ends */
	onEndEdit?: () => void;
	/** Ref for accessing current edit state */
	editorRef?: React.RefObject<NarrativeEventCardHandle | null>;
}

/**
 * Displays a NarrativeEvent with optional inline edit/delete actions.
 */
export const NarrativeEventCard = forwardRef<NarrativeEventCardHandle, NarrativeEventCardProps>(
	function NarrativeEventCard(
		{
			event,
			compact = false,
			onUpdate,
			onDelete,
			isEditing: controlledIsEditing,
			onStartEdit,
			onEndEdit,
			editorRef,
		},
		ref,
	) {
		// Local editing state (used when not controlled)
		const [localIsEditing, setLocalIsEditing] = useState(false);
		const isEditing = controlledIsEditing ?? localIsEditing;

		// Edit form state
		const [editSummary, setEditSummary] = useState(event.summary);
		const [editEventTypes, setEditEventTypes] = useState<EventType[]>(event.eventTypes);
		const [editTensionLevel, setEditTensionLevel] = useState<TensionLevel>(
			event.tensionLevel,
		);
		const [editTensionType, setEditTensionType] = useState<TensionType>(
			event.tensionType,
		);

		const tensionIcon = getTensionIcon(event.tensionType);
		const tensionColor = getTensionColor(event.tensionLevel);

		// Build current state
		const getCurrentState = useCallback((): Partial<NarrativeEvent> => {
			return {
				summary: editSummary,
				eventTypes: editEventTypes,
				tensionLevel: editTensionLevel,
				tensionType: editTensionType,
			};
		}, [editSummary, editEventTypes, editTensionLevel, editTensionType]);

		// Expose getCurrentState via ref
		useImperativeHandle(ref, () => ({ getCurrentState }), [getCurrentState]);
		// Also expose via editorRef if provided
		useImperativeHandle(editorRef, () => ({ getCurrentState }), [getCurrentState]);

		const handleStartEdit = () => {
			// Reset edit state to current event values
			setEditSummary(event.summary);
			setEditEventTypes(event.eventTypes);
			setEditTensionLevel(event.tensionLevel);
			setEditTensionType(event.tensionType);
			if (onStartEdit) {
				onStartEdit();
			} else {
				setLocalIsEditing(true);
			}
		};

		const handleSave = () => {
			if (onUpdate) {
				onUpdate(getCurrentState());
			}
			if (onEndEdit) {
				onEndEdit();
			} else {
				setLocalIsEditing(false);
			}
		};

		const handleCancel = () => {
			// Reset edit state
			setEditSummary(event.summary);
			setEditEventTypes(event.eventTypes);
			setEditTensionLevel(event.tensionLevel);
			setEditTensionType(event.tensionType);
			if (onEndEdit) {
				onEndEdit();
			} else {
				setLocalIsEditing(false);
			}
		};

		const handleToggleEventType = (type: EventType) => {
			if (editEventTypes.includes(type)) {
				// Don't allow removing the last event type
				if (editEventTypes.length > 1) {
					setEditEventTypes(editEventTypes.filter(t => t !== type));
				}
			} else {
				setEditEventTypes([...editEventTypes, type]);
			}
		};

		// Inline editing mode
		if (isEditing) {
			return (
				<div className="bt-narrative-event-card bt-event-card-editing">
					{/* Header with tension selector */}
					<div className="bt-event-edit-header">
						<select
							className="bt-tension-select"
							value={editTensionLevel}
							onChange={e =>
								setEditTensionLevel(
									e.target
										.value as TensionLevel,
								)
							}
						>
							{TENSION_LEVELS.map(level => (
								<option key={level} value={level}>
									{level}
								</option>
							))}
						</select>
						<select
							className="bt-tension-select"
							value={editTensionType}
							onChange={e =>
								setEditTensionType(
									e.target
										.value as TensionType,
								)
							}
						>
							{TENSION_TYPES.map(type => (
								<option key={type} value={type}>
									{type}
								</option>
							))}
						</select>
					</div>

					{/* Summary textarea */}
					<textarea
						className="bt-event-summary-input"
						value={editSummary}
						onChange={e => setEditSummary(e.target.value)}
						rows={2}
						placeholder="Event summary..."
					/>

					{/* Event types as toggleable tags */}
					<div className="bt-event-types-edit">
						{EVENT_TYPES.map(type => {
							const isSelected =
								editEventTypes.includes(type);
							const color = getEventTypeColor(type);
							return (
								<button
									key={type}
									type="button"
									className={`bt-event-type-toggle ${isSelected ? 'selected' : ''}`}
									style={{
										borderColor:
											isSelected
												? color
												: undefined,
										color: isSelected
											? color
											: undefined,
										backgroundColor:
											isSelected
												? `${color}20`
												: undefined,
									}}
									onClick={() =>
										handleToggleEventType(
											type,
										)
									}
								>
									<i
										className={getEventTypeIcon(
											type,
										)}
									></i>
									{type.replace(/_/g, ' ')}
								</button>
							);
						})}
					</div>

					{/* Save/Cancel buttons */}
					<div className="bt-event-edit-actions">
						<button
							type="button"
							className="bt-action-btn"
							onClick={handleSave}
							title="Save"
						>
							<i className="fa-solid fa-check"></i>
						</button>
						<button
							type="button"
							className="bt-action-btn"
							onClick={handleCancel}
							title="Cancel"
						>
							<i className="fa-solid fa-times"></i>
						</button>
					</div>
				</div>
			);
		}

		// Compact display
		if (compact) {
			return (
				<div className="bt-narrative-event-card bt-compact">
					<div className="bt-event-content">
						<i
							className={`fa-solid ${tensionIcon}`}
							style={{ color: tensionColor }}
							title={`${event.tensionLevel} ${event.tensionType}`}
						/>
						<span className="bt-event-summary">
							{event.summary}
						</span>
					</div>
					{(onUpdate || onDelete) && (
						<div className="bt-event-actions">
							{onUpdate && (
								<button
									className="bt-action-btn-tiny"
									onClick={handleStartEdit}
									title="Edit"
								>
									<i className="fa-solid fa-pen"></i>
								</button>
							)}
							{onDelete && (
								<button
									className="bt-action-btn-tiny delete"
									onClick={onDelete}
									title="Delete"
								>
									<i className="fa-solid fa-trash"></i>
								</button>
							)}
						</div>
					)}
				</div>
			);
		}

		// Full display
		return (
			<div className="bt-narrative-event-card">
				<div className="bt-state-event-header">
					<i
						className={`fa-solid ${tensionIcon}`}
						style={{ color: tensionColor }}
						title={`${event.tensionLevel} ${event.tensionType}`}
					/>
					<span className="bt-event-tension-label">
						{event.tensionLevel} {event.tensionType}
					</span>
					{event.chapterIndex !== undefined && (
						<span className="bt-event-chapter">
							Ch. {event.chapterIndex + 1}
						</span>
					)}
				</div>
				<div className="bt-event-body">
					<p className="bt-event-summary">{event.summary}</p>
					{event.location && (
						<span className="bt-event-location">
							<i className="fa-solid fa-location-dot"></i>{' '}
							{event.location}
						</span>
					)}
					{event.witnesses.length > 0 && (
						<span className="bt-event-witnesses">
							<i className="fa-solid fa-users"></i>{' '}
							{event.witnesses.join(', ')}
						</span>
					)}
				</div>
				{event.eventTypes.length > 0 && (
					<div className="bt-event-types">
						{event.eventTypes.slice(0, 3).map(et => (
							<span
								key={et}
								className="bt-event-type-tag"
								style={{
									borderColor:
										getEventTypeColor(
											et,
										),
									color: getEventTypeColor(
										et,
									),
								}}
							>
								<i
									className={getEventTypeIcon(
										et,
									)}
								></i>{' '}
								{et.replace(/_/g, ' ')}
							</span>
						))}
						{event.eventTypes.length > 3 && (
							<span className="bt-event-type-more">
								+{event.eventTypes.length - 3} more
							</span>
						)}
					</div>
				)}
				{(onUpdate || onDelete) && (
					<div className="bt-event-actions">
						{onUpdate && (
							<button
								className="bt-action-btn"
								onClick={handleStartEdit}
								title="Edit"
							>
								<i className="fa-solid fa-pen"></i>
							</button>
						)}
						{onDelete && (
							<button
								className="bt-action-btn delete"
								onClick={onDelete}
								title="Delete"
							>
								<i className="fa-solid fa-trash"></i>
							</button>
						)}
					</div>
				)}
			</div>
		);
	},
);
