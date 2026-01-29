// ============================================
// Relationships Tab Component
// ============================================

import React, { useState, useMemo } from 'react';
import type {
	Relationship,
	DerivedRelationship,
	ProjectedRelationship,
	RelationshipStatus,
	NarrativeDateTime,
	MilestoneType,
	RelationshipEvent,
	DirectionalRelationshipEvent,
	StatusChangedEvent,
	RelationshipEventSubkind,
	DirectionalRelationshipSubkind,
} from '../../types/state';
import { RELATIONSHIP_STATUSES, isLegacyRelationship } from '../../types/state';
import {
	getRelationshipSubkindIcon,
	getRelationshipEventColor,
	formatSubkindLabel,
} from '../icons';

/** Computed milestone from event store */
interface ComputedMilestone {
	type: MilestoneType;
	eventId: string;
	description?: string;
}

/** Union type for legacy, derived, and projected relationships */
type AnyRelationship = Relationship | DerivedRelationship | ProjectedRelationship;

// ============================================
// Helpers
// ============================================

function formatMilestoneDate(dt: NarrativeDateTime | undefined): string {
	if (!dt) return '';
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec',
	];
	const month = months[dt.month - 1] || 'Jan';
	return `${month} ${dt.day}, ${dt.year}`;
}

// ============================================
// Types
// ============================================

interface RelationshipsTabProps {
	relationships: AnyRelationship[];
	presentCharacters?: string[];
	editMode?: boolean;
	onUpdate?: (relationships: AnyRelationship[]) => void;
	/** Whether the narrative state has an event store */
	hasEventStore?: boolean;
	/** Get relationship StateEvents for a character pair */
	getStateEventsForPair?: (pair: [string, string]) => RelationshipEvent[];
	/** Compute milestones for a pair from the event store */
	computeMilestonesForPair?: (pair: [string, string]) => ComputedMilestone[];
	/** Update a relationship state event */
	onStateEventUpdate?: (eventId: string, updates: Partial<RelationshipEvent>) => void;
	/** Delete a relationship state event */
	onStateEventDelete?: (eventId: string) => void;
	/** Add a new relationship state event */
	onStateEventAdd?: (event: Omit<RelationshipEvent, 'id'>) => void;
	/** Chat length for determining latest messageId when adding events */
	chatLength?: number;
	/** Chat messages for getting swipeId per message */
	chat?: { swipe_id: number }[];
}

interface RelationshipCardProps {
	relationship: AnyRelationship;
	isExpanded: boolean;
	onToggle: () => void;
	editMode?: boolean;
	isEditing?: boolean;
	onStartEdit?: () => void;
	onDeleteRelationship?: () => void;
	/** State events (RelationshipEvents) for this pair */
	stateEvents?: RelationshipEvent[];
	/** Computed milestones for DerivedRelationships */
	computedMilestones?: ComputedMilestone[];
	/** Update a relationship state event */
	onStateEventUpdate?: (eventId: string, updates: Partial<RelationshipEvent>) => void;
	/** Delete a relationship state event */
	onStateEventDelete?: (eventId: string) => void;
	/** Add a new relationship state event */
	onStateEventAdd?: (event: Omit<RelationshipEvent, 'id'>) => void;
	/** Chat length for determining latest messageId when adding events */
	chatLength?: number;
	/** Chat messages for getting swipeId per message */
	chat?: { swipe_id: number }[];
}

// ============================================
// Constants
// ============================================

const STATUS_COLORS: Record<RelationshipStatus, string> = {
	strangers: '#6b7280',
	acquaintances: '#3b82f6',
	friendly: '#22c55e',
	close: '#f59e0b',
	intimate: '#ec4899',
	strained: '#f97316',
	hostile: '#ef4444',
	complicated: '#8b5cf6',
};

const STATUS_ICONS: Record<RelationshipStatus, string> = {
	strangers: 'fa-user-secret',
	acquaintances: 'fa-handshake',
	friendly: 'fa-users',
	close: 'fa-user-group',
	intimate: 'fa-heart',
	strained: 'fa-face-frown',
	hostile: 'fa-skull',
	complicated: 'fa-question',
};

// ============================================
// Components
// ============================================

/** Props for the projected relationship display */
interface ProjectedRelationshipDisplayProps {
	relationship: AnyRelationship;
	milestones?: ComputedMilestone[];
}

/**
 * Display the projected state of a relationship.
 * Shows status, attitudes (feelings/secrets/wants), and milestones.
 */
function ProjectedRelationshipDisplay({
	relationship,
	milestones = [],
}: ProjectedRelationshipDisplayProps) {
	const [char1, char2] = relationship.pair;
	const statusColor = STATUS_COLORS[relationship.status] || '#6b7280';
	const statusIcon = STATUS_ICONS[relationship.status] || 'fa-circle';

	return (
		<div className="bt-projected-relationship">
			{/* Status */}
			<div className="bt-projection-section">
				<h4>Status</h4>
				<div
					className="bt-relationship-status-display"
					style={{ color: statusColor }}
				>
					<i className={`fa-solid ${statusIcon}`} />
					<span>{relationship.status}</span>
				</div>
			</div>

			{/* Attitudes - A towards B */}
			<div className="bt-projection-section">
				<h4>
					{char1} → {char2}
				</h4>
				<div className="bt-attitude-display">
					{relationship.aToB.feelings.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-label">Feels:</span>
							<span className="bt-value">
								{relationship.aToB.feelings.join(
									', ',
								)}
							</span>
						</div>
					)}
					{relationship.aToB.wants.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-label">Wants:</span>
							<span className="bt-value">
								{relationship.aToB.wants.join(', ')}
							</span>
						</div>
					)}
					{relationship.aToB.secrets.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-label">Secrets:</span>
							<span className="bt-value">
								{relationship.aToB.secrets.join(
									', ',
								)}
							</span>
						</div>
					)}
					{relationship.aToB.feelings.length === 0 &&
						relationship.aToB.wants.length === 0 &&
						relationship.aToB.secrets.length === 0 && (
							<div className="bt-empty-attitude">
								No data
							</div>
						)}
				</div>
			</div>

			{/* Attitudes - B towards A */}
			<div className="bt-projection-section">
				<h4>
					{char2} → {char1}
				</h4>
				<div className="bt-attitude-display">
					{relationship.bToA.feelings.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-label">Feels:</span>
							<span className="bt-value">
								{relationship.bToA.feelings.join(
									', ',
								)}
							</span>
						</div>
					)}
					{relationship.bToA.wants.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-label">Wants:</span>
							<span className="bt-value">
								{relationship.bToA.wants.join(', ')}
							</span>
						</div>
					)}
					{relationship.bToA.secrets.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-label">Secrets:</span>
							<span className="bt-value">
								{relationship.bToA.secrets.join(
									', ',
								)}
							</span>
						</div>
					)}
					{relationship.bToA.feelings.length === 0 &&
						relationship.bToA.wants.length === 0 &&
						relationship.bToA.secrets.length === 0 && (
							<div className="bt-empty-attitude">
								No data
							</div>
						)}
				</div>
			</div>

			{/* Milestones */}
			{milestones.length > 0 && (
				<div className="bt-projection-section">
					<h4>
						<i className="fa-solid fa-star" /> Milestones
					</h4>
					<ul className="bt-milestones-list">
						{milestones.map((m, i) => (
							<li key={m.eventId || i}>
								<span className="bt-milestone-type">
									{m.type.replace(/_/g, ' ')}
								</span>
								{m.description && (
									<span className="bt-milestone-desc">
										{' '}
										- {m.description}
									</span>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

/** Props for the relationship state events list */
interface RelationshipStateEventsListProps {
	events: RelationshipEvent[];
	editMode?: boolean;
	onEventUpdate?: (eventId: string, updates: Partial<RelationshipEvent>) => void;
	onEventDelete?: (eventId: string) => void;
	/** Chat length for messageId dropdown */
	chatLength?: number;
	/** Chat messages for getting swipeId per message */
	chat?: { swipe_id: number }[];
}

/**
 * Display a single relationship state event card (like StateEventEditor).
 */
function RelationshipStateEventCard({
	event,
	index,
	editMode,
	onUpdate,
	onDelete,
	chatLength,
	chat,
}: {
	event: RelationshipEvent;
	index: number;
	editMode?: boolean;
	onUpdate?: (updates: Partial<RelationshipEvent>) => void;
	onDelete?: () => void;
	chatLength?: number;
	chat?: { swipe_id: number }[];
}) {
	const [isEditing, setIsEditing] = useState(false);
	const isStatusEvent = event.subkind === 'status_changed';

	// Type-safe access to event properties
	const dirEvent = isStatusEvent ? null : (event as DirectionalRelationshipEvent);
	const statusEvent = isStatusEvent ? (event as StatusChangedEvent) : null;

	const [editValue, setEditValue] = useState(dirEvent?.value ?? '');
	const [editStatus, setEditStatus] = useState<RelationshipStatus>(
		statusEvent?.newStatus ?? 'acquaintances',
	);
	const [editMessageId, setEditMessageId] = useState(event.messageId);

	const iconClass = getRelationshipSubkindIcon(event.subkind);
	const iconColor = getRelationshipEventColor(event.subkind);

	const directionDisplay = dirEvent
		? `${dirEvent.fromCharacter} → ${dirEvent.towardCharacter}`
		: null;

	const handleSave = () => {
		if (onUpdate) {
			const updates: Partial<RelationshipEvent> = {};

			if (isStatusEvent && statusEvent) {
				if (editStatus !== statusEvent.newStatus) {
					(updates as Partial<StatusChangedEvent>).newStatus =
						editStatus;
				}
			} else if (dirEvent) {
				if (editValue !== dirEvent.value) {
					(updates as Partial<DirectionalRelationshipEvent>).value =
						editValue;
				}
			}

			// Check if messageId changed
			if (editMessageId !== event.messageId) {
				updates.messageId = editMessageId;
				// Update swipeId to match the new message
				updates.swipeId = chat?.[editMessageId]?.swipe_id ?? 0;
			}

			if (Object.keys(updates).length > 0) {
				onUpdate(updates);
			}
		}
		setIsEditing(false);
	};

	const handleCancel = () => {
		setEditValue(dirEvent?.value ?? '');
		setEditStatus(statusEvent?.newStatus ?? 'acquaintances');
		setEditMessageId(event.messageId);
		setIsEditing(false);
	};

	// Generate messageId options
	const maxMessageId = chatLength ? chatLength - 1 : 0;
	const messageIdOptions = Array.from({ length: maxMessageId + 1 }, (_, i) => i);

	// Editing mode
	if (isEditing) {
		return (
			<div
				className="bt-event-card bt-event-card-editing"
				data-kind="relationship"
				style={{ '--event-type-color': iconColor } as React.CSSProperties}
			>
				<div className="bt-event-card-content">
					<div className="bt-state-event-header">
						<span className="bt-event-index">#{index + 1}</span>
						<i
							className={iconClass}
							style={{ color: iconColor }}
						/>
						<span className="bt-event-subkind">
							{formatSubkindLabel(event.subkind)}
						</span>
					</div>
					<div className="bt-relationship-edit-inline">
						{/* MessageId dropdown */}
						{chatLength && chatLength > 0 && (
							<select
								value={editMessageId}
								onChange={e =>
									setEditMessageId(
										Number(
											e.target
												.value,
										),
									)
								}
								className="bt-message-select"
								title="Message"
							>
								{messageIdOptions.map(id => (
									<option key={id} value={id}>
										Msg #{id + 1}
										{id === maxMessageId
											? ' (Latest)'
											: ''}
									</option>
								))}
							</select>
						)}
						{isStatusEvent ? (
							<select
								value={editStatus}
								onChange={e =>
									setEditStatus(
										e.target
											.value as RelationshipStatus,
									)
								}
								className="bt-status-select"
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
						) : (
							<input
								type="text"
								value={editValue}
								onChange={e =>
									setEditValue(e.target.value)
								}
								placeholder="Value..."
								className="bt-value-input"
							/>
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
						onClick={handleCancel}
						title="Cancel"
					>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>
			</div>
		);
	}

	// Display mode
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
					{directionDisplay && (
						<span className="bt-event-direction">
							({directionDisplay})
						</span>
					)}
					{dirEvent?.value && (
						<span className="bt-event-value">
							"{dirEvent.value}"
						</span>
					)}
					{statusEvent?.newStatus && (
						<span className="bt-event-status">
							→ {statusEvent.newStatus}
						</span>
					)}
				</div>
			</div>
			{editMode && (onUpdate || onDelete) && (
				<div className="bt-event-actions">
					{onUpdate && (
						<button
							className="bt-action-btn"
							onClick={() => setIsEditing(true)}
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
}

/**
 * Display a list of relationship state events (like StateEventEditor).
 */
function RelationshipStateEventsList({
	events,
	editMode,
	onEventUpdate,
	onEventDelete,
	chatLength,
	chat,
}: RelationshipStateEventsListProps) {
	// Group events by messageId - useMemo must be called unconditionally (before any early returns)
	const groupedEvents = useMemo(() => {
		if (events.length === 0) {
			return new Map<number, RelationshipEvent[]>();
		}
		// Sort by messageId (chronological)
		const sortedEvents = [...events].sort((a, b) => a.messageId - b.messageId);
		const groups: Map<number, RelationshipEvent[]> = new Map();
		for (const event of sortedEvents) {
			const msgId = event.messageId;
			if (!groups.has(msgId)) {
				groups.set(msgId, []);
			}
			groups.get(msgId)!.push(event);
		}
		return groups;
	}, [events]);

	if (events.length === 0) {
		return (
			<div className="bt-events-list-empty">
				<i className="fa-solid fa-ghost"></i>
				<span>No relationship events for this pair</span>
			</div>
		);
	}

	// Global index counter for event numbering
	let globalIndex = 0;

	return (
		<div className="bt-relationship-events-list">
			{Array.from(groupedEvents.entries()).map(([messageId, messageEvents]) => (
				<div key={messageId} className="bt-events-message-group">
					<div className="bt-events-message-header">
						<i className="fa-solid fa-message"></i>
						<span>Message #{messageId + 1}</span>
						<span className="bt-events-count">
							({messageEvents.length} event
							{messageEvents.length !== 1 ? 's' : ''})
						</span>
					</div>
					{messageEvents.map(event => {
						const idx = globalIndex++;
						return (
							<RelationshipStateEventCard
								key={event.id}
								event={event}
								index={idx}
								editMode={editMode}
								chatLength={chatLength}
								chat={chat}
								onUpdate={
									onEventUpdate
										? updates =>
												onEventUpdate(
													event.id,
													updates,
												)
										: undefined
								}
								onDelete={
									onEventDelete
										? () =>
												onEventDelete(
													event.id,
												)
										: undefined
								}
							/>
						);
					})}
				</div>
			))}
		</div>
	);
}

// ============================================
// Add Event Form
// ============================================

/** All available relationship event subkinds */
const RELATIONSHIP_EVENT_SUBKINDS: RelationshipEventSubkind[] = [
	'feeling_added',
	'feeling_removed',
	'secret_added',
	'secret_removed',
	'want_added',
	'want_removed',
	'status_changed',
];

interface AddEventFormProps {
	pair: [string, string];
	relationship: AnyRelationship;
	onAdd: (event: Omit<RelationshipEvent, 'id'>) => void;
	onCancel: () => void;
	/** Chat length for determining latest messageId when adding events */
	chatLength?: number;
	/** Chat messages for getting swipeId per message */
	chat?: { swipe_id: number }[];
}

/**
 * Form for adding a new relationship event.
 */
function AddEventForm({
	pair,
	relationship,
	onAdd,
	onCancel,
	chatLength,
	chat,
}: AddEventFormProps) {
	const [char1, char2] = pair;
	const [subkind, setSubkind] = useState<RelationshipEventSubkind>('feeling_added');
	const [direction, setDirection] = useState<'aToB' | 'bToA'>('aToB');
	const [value, setValue] = useState('');
	const [newStatus, setNewStatus] = useState<RelationshipStatus>(relationship.status);

	// Calculate max messageId (0-indexed, so chatLength-1)
	const maxMessageId = chatLength ? chatLength - 1 : 0;
	// Default to second-to-last message to avoid edge cases with current message
	const defaultMessageId = Math.max(0, maxMessageId - 1);
	const [messageId, setMessageId] = useState(defaultMessageId);

	// Generate options: 0 to maxMessageId
	const messageIdOptions = Array.from({ length: maxMessageId + 1 }, (_, i) => i);

	// Determine which character is "from" and which is "toward" based on direction
	const fromCharacter = direction === 'aToB' ? char1 : char2;
	const towardCharacter = direction === 'aToB' ? char2 : char1;

	// Get current values for removal dropdowns
	const currentAttitude = direction === 'aToB' ? relationship.aToB : relationship.bToA;

	// Determine if this is a removal type (needs dropdown instead of text input)
	const isRemovalType = subkind.endsWith('_removed');
	const isStatusChange = subkind === 'status_changed';

	// Get items for removal dropdown
	const getRemovalItems = (): string[] => {
		if (subkind === 'feeling_removed') return currentAttitude.feelings;
		if (subkind === 'secret_removed') return currentAttitude.secrets;
		if (subkind === 'want_removed') return currentAttitude.wants;
		return [];
	};

	const removalItems = getRemovalItems();

	const handleSubmit = () => {
		// Get the swipeId for the selected message from the chat
		const swipeId = chat?.[messageId]?.swipe_id ?? 0;

		if (isStatusChange) {
			// Status events require explicit pair
			const statusEvent: Omit<StatusChangedEvent, 'id'> = {
				kind: 'relationship',
				subkind: 'status_changed',
				pair,
				messageId,
				swipeId,
				timestamp: Date.now(),
				newStatus,
				previousStatus: relationship.status,
			};
			onAdd(statusEvent);
		} else {
			// Directional events - pair is derived from fromCharacter/towardCharacter
			const dirEvent: Omit<DirectionalRelationshipEvent, 'id'> = {
				kind: 'relationship',
				subkind: subkind as DirectionalRelationshipSubkind,
				messageId,
				swipeId,
				timestamp: Date.now(),
				fromCharacter,
				towardCharacter,
				value,
			};
			onAdd(dirEvent);
		}
	};

	const isValid = isStatusChange || (isRemovalType ? value !== '' : value.trim() !== '');

	return (
		<div className="bt-add-event-form">
			<div className="bt-form-row">
				<label>Message</label>
				<select
					value={messageId}
					onChange={e => setMessageId(Number(e.target.value))}
					className="bt-select"
				>
					{messageIdOptions.map(id => (
						<option key={id} value={id}>
							Message #{id + 1}
							{id === maxMessageId && ' (Latest)'}
						</option>
					))}
				</select>
			</div>

			<div className="bt-form-row">
				<label>Event Type</label>
				<select
					value={subkind}
					onChange={e => {
						setSubkind(
							e.target.value as RelationshipEventSubkind,
						);
						setValue(''); // Reset value when changing type
					}}
					className="bt-select"
				>
					{RELATIONSHIP_EVENT_SUBKINDS.map(sk => (
						<option key={sk} value={sk}>
							{formatSubkindLabel(sk)}
						</option>
					))}
				</select>
			</div>

			{!isStatusChange && (
				<div className="bt-form-row">
					<label>Direction</label>
					<select
						value={direction}
						onChange={e =>
							setDirection(
								e.target.value as 'aToB' | 'bToA',
							)
						}
						className="bt-select"
					>
						<option value="aToB">
							{char1} → {char2}
						</option>
						<option value="bToA">
							{char2} → {char1}
						</option>
					</select>
				</div>
			)}

			{isStatusChange ? (
				<div className="bt-form-row">
					<label>New Status</label>
					<select
						value={newStatus}
						onChange={e =>
							setNewStatus(
								e.target
									.value as RelationshipStatus,
							)
						}
						className="bt-select"
					>
						{RELATIONSHIP_STATUSES.map(status => (
							<option key={status} value={status}>
								{status.charAt(0).toUpperCase() +
									status.slice(1)}
							</option>
						))}
					</select>
				</div>
			) : isRemovalType ? (
				<div className="bt-form-row">
					<label>Value to Remove</label>
					{removalItems.length > 0 ? (
						<select
							value={value}
							onChange={e => setValue(e.target.value)}
							className="bt-select"
						>
							<option value="">Select...</option>
							{removalItems.map(item => (
								<option key={item} value={item}>
									{item}
								</option>
							))}
						</select>
					) : (
						<div className="bt-no-items">
							No items to remove
						</div>
					)}
				</div>
			) : (
				<div className="bt-form-row">
					<label>Value</label>
					<input
						type="text"
						value={value}
						onChange={e => setValue(e.target.value)}
						placeholder={
							subkind === 'feeling_added'
								? 'e.g., trust, affection'
								: subkind === 'secret_added'
									? 'e.g., knows their true identity'
									: 'e.g., protection, approval'
						}
						className="bt-input"
					/>
				</div>
			)}

			<div className="bt-form-actions">
				<button
					type="button"
					className="bt-btn bt-btn-secondary"
					onClick={onCancel}
				>
					Cancel
				</button>
				<button
					type="button"
					className="bt-btn bt-btn-primary"
					onClick={handleSubmit}
					disabled={!isValid}
				>
					Add Event
				</button>
			</div>
		</div>
	);
}

function RelationshipCard({
	relationship,
	isExpanded,
	onToggle,
	editMode,
	isEditing,
	onStartEdit,
	onDeleteRelationship,
	stateEvents,
	computedMilestones,
	onStateEventUpdate,
	onStateEventDelete,
	onStateEventAdd,
	chatLength,
	chat,
}: RelationshipCardProps) {
	const [char1, char2] = relationship.pair;
	const statusColor = STATUS_COLORS[relationship.status] || '#6b7280';
	const statusIcon = STATUS_ICONS[relationship.status] || 'fa-circle';

	// State for showing the add event form
	const [showAddForm, setShowAddForm] = useState(false);

	// Helper to check if this is a legacy relationship with milestones
	// Note: ProjectedRelationship has no milestones - they are computed separately via computeMilestonesForPair()
	const hasLegacyMilestones =
		'milestones' in relationship &&
		isLegacyRelationship(relationship as Relationship | DerivedRelationship) &&
		((relationship as Relationship).milestones?.length ?? 0) > 0;

	// Helper to determine if we should show milestones
	// Prefer computed milestones (from event store) over legacy milestones
	const hasComputedMilestones = computedMilestones && computedMilestones.length > 0;
	const showMilestones = hasComputedMilestones || hasLegacyMilestones || isEditing;

	return (
		<div
			className={`bt-relationship-card ${isExpanded ? 'bt-expanded' : ''} ${isEditing ? 'bt-editing' : ''}`}
		>
			<div
				className="bt-relationship-header"
				onClick={isEditing ? undefined : onToggle}
			>
				<div className="bt-relationship-pair">
					<span className="bt-char-name">{char1}</span>
					<i
						className={`fa-solid ${statusIcon}`}
						style={{ color: statusColor }}
					/>
					<span className="bt-char-name">{char2}</span>
				</div>
				<div
					className="bt-relationship-status"
					style={{ color: statusColor }}
				>
					{relationship.status}
				</div>
				{editMode && !isEditing && (
					<div className="bt-relationship-actions">
						<button
							type="button"
							className="bt-edit-btn-small"
							onClick={e => {
								e.stopPropagation();
								onStartEdit?.();
							}}
							title="Edit relationship"
						>
							<i className="fa-solid fa-pen"></i>
						</button>
						<button
							type="button"
							className="bt-delete-btn-small"
							onClick={e => {
								e.stopPropagation();
								onDeleteRelationship?.();
							}}
							title="Delete relationship"
						>
							<i className="fa-solid fa-trash"></i>
						</button>
					</div>
				)}
				{isEditing && (
					<button
						type="button"
						className="bt-delete-btn-small"
						onClick={e => {
							e.stopPropagation();
							onDeleteRelationship?.();
						}}
						title="Delete relationship"
					>
						<i className="fa-solid fa-trash"></i>
					</button>
				)}
				<i
					className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} bt-expand-icon`}
					onClick={isEditing ? onToggle : undefined}
				/>
			</div>

			{isExpanded && isEditing && stateEvents && (
				<div className="bt-split-editor">
					{/* Left pane - State Events */}
					<div className="bt-events-pane">
						<div className="bt-events-pane-header">
							<h3>
								<i className="fa-solid fa-list"></i>{' '}
								Relationship Events
							</h3>
							{onStateEventAdd && !showAddForm && (
								<button
									type="button"
									className="bt-add-event-btn"
									onClick={() =>
										setShowAddForm(true)
									}
									title="Add new event"
								>
									<i className="fa-solid fa-plus"></i>
								</button>
							)}
						</div>
						{showAddForm && onStateEventAdd && (
							<AddEventForm
								pair={relationship.pair}
								relationship={relationship}
								onAdd={event => {
									onStateEventAdd(event);
									setShowAddForm(false);
								}}
								onCancel={() =>
									setShowAddForm(false)
								}
								chatLength={chatLength}
								chat={chat}
							/>
						)}
						<RelationshipStateEventsList
							events={stateEvents}
							editMode={true}
							onEventUpdate={onStateEventUpdate}
							onEventDelete={onStateEventDelete}
							chatLength={chatLength}
							chat={chat}
						/>
					</div>

					{/* Right pane - Projected State */}
					<div className="bt-projection-pane">
						<h3>
							<i className="fa-solid fa-eye"></i> Current
							State
						</h3>
						<ProjectedRelationshipDisplay
							relationship={relationship}
							milestones={computedMilestones}
						/>
					</div>
				</div>
			)}

			{isExpanded && !isEditing && (
				<div className="bt-relationship-details">
					{/* Attitudes - A towards B */}
					<div className="bt-attitude-section">
						<div className="bt-attitude-header">
							{char1} → {char2}
						</div>
						<div className="bt-attitude-content">
							{relationship.aToB.feelings.length > 0 && (
								<div className="bt-attitude-row">
									<span className="bt-label">
										Feels:
									</span>
									<span className="bt-value">
										{relationship.aToB.feelings.join(
											', ',
										)}
									</span>
								</div>
							)}
							{relationship.aToB.wants.length > 0 && (
								<div className="bt-attitude-row">
									<span className="bt-label">
										Wants:
									</span>
									<span className="bt-value">
										{relationship.aToB.wants.join(
											', ',
										)}
									</span>
								</div>
							)}
							{relationship.aToB.secrets.length > 0 && (
								<div className="bt-attitude-row">
									<span className="bt-label">
										Secrets:
									</span>
									<span className="bt-value">
										{relationship.aToB.secrets.join(
											', ',
										)}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Attitudes - B towards A */}
					<div className="bt-attitude-section">
						<div className="bt-attitude-header">
							{char2} → {char1}
						</div>
						<div className="bt-attitude-content">
							{relationship.bToA.feelings.length > 0 && (
								<div className="bt-attitude-row">
									<span className="bt-label">
										Feels:
									</span>
									<span className="bt-value">
										{relationship.bToA.feelings.join(
											', ',
										)}
									</span>
								</div>
							)}
							{relationship.bToA.wants.length > 0 && (
								<div className="bt-attitude-row">
									<span className="bt-label">
										Wants:
									</span>
									<span className="bt-value">
										{relationship.bToA.wants.join(
											', ',
										)}
									</span>
								</div>
							)}
							{relationship.bToA.secrets.length > 0 && (
								<div className="bt-attitude-row">
									<span className="bt-label">
										Secrets:
									</span>
									<span className="bt-value">
										{relationship.bToA.secrets.join(
											', ',
										)}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Milestones */}
					{showMilestones && (
						<div className="bt-milestones-section">
							<div className="bt-milestones-header">
								<i className="fa-solid fa-star" />{' '}
								Milestones
							</div>
							{hasComputedMilestones ? (
								<ul className="bt-milestones-list">
									{computedMilestones.map(
										(milestone, i) => (
											<li
												key={
													milestone.eventId ||
													i
												}
											>
												<span className="bt-milestone-type">
													{milestone.type.replace(
														/_/g,
														' ',
													)}
												</span>
												{milestone.description && (
													<span className="bt-milestone-desc">
														{' '}
														-{' '}
														{
															milestone.description
														}
													</span>
												)}
											</li>
										),
									)}
								</ul>
							) : 'milestones' in relationship &&
							  isLegacyRelationship(
									relationship as
										| Relationship
										| DerivedRelationship,
							  ) &&
							  hasLegacyMilestones ? (
								<ul className="bt-milestones-list">
									{relationship.milestones.map(
										(milestone, i) => {
											const dateStr =
												formatMilestoneDate(
													milestone.timestamp,
												);
											return (
												<li
													key={
														i
													}
												>
													<span className="bt-milestone-type">
														{milestone.type.replace(
															/_/g,
															' ',
														)}
													</span>
													{dateStr && (
														<span className="bt-milestone-date">
															{' '}
															(
															{
																dateStr
															}

															)
														</span>
													)}
													{milestone.description && (
														<span className="bt-milestone-desc">
															{' '}
															-{' '}
															{
																milestone.description
															}
														</span>
													)}
												</li>
											);
										},
									)}
								</ul>
							) : (
								<p className="bt-empty-message">
									No milestones yet.
								</p>
							)}
						</div>
					)}

					{/* History */}
					{'history' in relationship &&
						relationship.history.length > 0 && (
							<div className="bt-history-section">
								<div className="bt-history-header">
									<i className="fa-solid fa-clock-rotate-left" />{' '}
									History
								</div>
								<ul className="bt-history-list">
									{relationship.history.map(
										(snapshot, i) => (
											<li key={i}>
												<span className="bt-history-chapter">
													Ch.{' '}
													{snapshot.chapterIndex +
														1}

													:
												</span>
												<span className="bt-history-status">
													{
														snapshot.status
													}
												</span>
												{snapshot.summary && (
													<span className="bt-history-summary">
														{' '}
														-{' '}
														{
															snapshot.summary
														}
													</span>
												)}
											</li>
										),
									)}
								</ul>
							</div>
						)}
				</div>
			)}
		</div>
	);
}

export function RelationshipsTab({
	relationships,
	presentCharacters,
	editMode,
	onUpdate,
	hasEventStore,
	getStateEventsForPair,
	computeMilestonesForPair,
	onStateEventUpdate,
	onStateEventDelete,
	onStateEventAdd,
	chatLength,
	chat,
}: RelationshipsTabProps) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const [filterCharacter, setFilterCharacter] = useState<string>('');
	const [editingPairKey, setEditingPairKey] = useState<string | null>(null);

	// Get unique characters for filter dropdown
	const allCharacters = useMemo(() => {
		const chars = new Set<string>();
		for (const rel of relationships) {
			chars.add(rel.pair[0]);
			chars.add(rel.pair[1]);
		}
		return Array.from(chars).sort();
	}, [relationships]);

	// Filter relationships
	const filteredRelationships = useMemo(() => {
		if (!filterCharacter) return relationships;
		return relationships.filter(
			rel =>
				rel.pair[0].toLowerCase() === filterCharacter.toLowerCase() ||
				rel.pair[1].toLowerCase() === filterCharacter.toLowerCase(),
		);
	}, [relationships, filterCharacter]);

	// Sort: present characters first, then by status
	const sortedRelationships = useMemo(() => {
		const presentSet = presentCharacters
			? new Set(presentCharacters.map(c => c.toLowerCase()))
			: null;

		const statusOrder: RelationshipStatus[] = [
			'intimate',
			'close',
			'friendly',
			'acquaintances',
			'strangers',
			'strained',
			'hostile',
			'complicated',
		];

		return [...filteredRelationships].sort((a, b) => {
			// Present characters first
			if (presentSet) {
				const aPresent = a.pair.some(p => presentSet.has(p.toLowerCase()));
				const bPresent = b.pair.some(p => presentSet.has(p.toLowerCase()));
				if (aPresent && !bPresent) return -1;
				if (!aPresent && bPresent) return 1;
			}

			// Then by status (closer = higher)
			const aStatus = statusOrder.indexOf(a.status);
			const bStatus = statusOrder.indexOf(b.status);
			return aStatus - bStatus;
		});
	}, [filteredRelationships, presentCharacters]);

	const toggleExpanded = (pairKey: string) => {
		setExpandedIds(prev => {
			const next = new Set(prev);
			if (next.has(pairKey)) {
				next.delete(pairKey);
			} else {
				next.add(pairKey);
			}
			return next;
		});
	};

	const getPairKey = (rel: AnyRelationship) => rel.pair.join('|');

	const handleStartEdit = (pairKey: string) => {
		// Expand the card when starting to edit
		setExpandedIds(prev => {
			const next = new Set(prev);
			next.add(pairKey);
			return next;
		});
		setEditingPairKey(pairKey);
	};

	const handleDeleteRelationship = (pairKey: string) => {
		if (onUpdate) {
			const newRelationships = relationships.filter(
				rel => getPairKey(rel) !== pairKey,
			);
			onUpdate(newRelationships);
			// Clear editing if we deleted the one being edited
			if (editingPairKey === pairKey) {
				setEditingPairKey(null);
			}
		}
	};

	// Clear editing state when leaving edit mode
	React.useEffect(() => {
		if (!editMode) {
			setEditingPairKey(null);
		}
	}, [editMode]);

	if (relationships.length === 0) {
		return (
			<div className="bt-relationships-tab bt-empty">
				<p>No relationships established yet.</p>
			</div>
		);
	}

	return (
		<div className="bt-relationships-tab">
			{/* Filter bar */}
			{allCharacters.length > 2 && (
				<div className="bt-filter-bar">
					<label htmlFor="bt-char-filter">Filter by character:</label>
					<select
						id="bt-char-filter"
						value={filterCharacter}
						onChange={e => setFilterCharacter(e.target.value)}
					>
						<option value="">All</option>
						{allCharacters.map(char => (
							<option key={char} value={char}>
								{char}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Relationship cards */}
			<div className="bt-relationship-list">
				{sortedRelationships.map(rel => {
					const pk = getPairKey(rel);
					const isEditing = editingPairKey === pk;
					// Get state events for this pair when editing
					const pairStateEvents =
						isEditing && hasEventStore && getStateEventsForPair
							? getStateEventsForPair(rel.pair)
							: undefined;
					// Compute milestones for relationships (from event store)
					const milestones =
						hasEventStore && computeMilestonesForPair
							? computeMilestonesForPair(rel.pair)
							: undefined;
					return (
						<RelationshipCard
							key={pk}
							relationship={rel}
							isExpanded={expandedIds.has(pk)}
							onToggle={() => toggleExpanded(pk)}
							editMode={editMode}
							isEditing={isEditing}
							onStartEdit={() => handleStartEdit(pk)}
							onDeleteRelationship={() =>
								handleDeleteRelationship(pk)
							}
							stateEvents={pairStateEvents}
							computedMilestones={milestones}
							onStateEventUpdate={onStateEventUpdate}
							onStateEventDelete={onStateEventDelete}
							onStateEventAdd={onStateEventAdd}
							chatLength={chatLength}
							chat={chat}
						/>
					);
				})}
			</div>

			{filteredRelationships.length === 0 && filterCharacter && (
				<p className="bt-no-results">
					No relationships found for {filterCharacter}.
				</p>
			)}
		</div>
	);
}
