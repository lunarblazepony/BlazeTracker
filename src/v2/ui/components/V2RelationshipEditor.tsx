/**
 * V2 Relationship Editor
 *
 * Split-pane editor for editing a single relationship's events.
 * Left pane: Events grouped by message
 * Right pane: Live projection preview
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { EventStore } from '../../store/EventStore';
import type { SwipeContext } from '../../store/projection';
import {
	groupRelationshipEventsByMessage,
	getMilestonesForPair,
	getMilestoneDisplayName,
} from '../../store/projection';
import type { RelationshipEvent, RelationshipSubkind } from '../../types/event';
import {
	getRelationshipPair,
	isDirectionalRelationshipEvent,
	isRelationshipStatusChangedEvent,
	isRelationshipSubjectEvent,
} from '../../types/event';
import type { RelationshipStatus } from '../../types/common';
import type { Subject } from '../../types/subject';
import { SUBJECTS } from '../../types/subject';

export interface V2RelationshipEditorProps {
	pair: [string, string];
	eventStore: EventStore;
	swipeContext: SwipeContext;
	latestMessageId: number;
	onClose: () => void;
	onSave: (updatedStore: EventStore) => void;
}

export function V2RelationshipEditor({
	pair,
	eventStore,
	swipeContext,
	latestMessageId,
	onClose,
	onSave,
}: V2RelationshipEditorProps): React.ReactElement {
	const [charA, charB] = pair;

	// Deep clone store for isolated editing
	const [clonedStore] = useState(() => eventStore.getDeepClone());

	// Track local relationship events (edits happen here)
	const [localEvents, setLocalEvents] = useState<RelationshipEvent[]>(() =>
		clonedStore.getRelationshipEventsForPair(pair, swipeContext),
	);

	// Group events by message (newest first)
	const eventsByMessage = useMemo(
		() => groupRelationshipEventsByMessage(localEvents),
		[localEvents],
	);

	// Compute live projection with local edits
	const projection = useMemo(() => {
		try {
			const tempStore = clonedStore.getDeepClone();
			// Remove old relationship events for this pair
			tempStore.deleteRelationshipEventsForPair(pair);
			// Append local edited events
			tempStore.appendEvents(localEvents);
			// Project at latest message
			return tempStore.projectStateAtMessage(latestMessageId, swipeContext);
		} catch {
			return null;
		}
	}, [localEvents, clonedStore, pair, swipeContext, latestMessageId]);

	// Get the projected relationship state
	const relationshipKey = `${charA}|${charB}`;
	const relationship = projection?.relationships[relationshipKey] ?? null;

	// Get milestones for preview
	const milestones = useMemo(() => {
		if (!projection) return [];
		const tempStore = clonedStore.getDeepClone();
		tempStore.deleteRelationshipEventsForPair(pair);
		tempStore.appendEvents(localEvents);
		return getMilestonesForPair(
			tempStore.getActiveEvents(),
			charA,
			charB,
			swipeContext,
		);
	}, [clonedStore, localEvents, pair, charA, charB, swipeContext, projection]);

	// Add event menu state
	const [showAddMenu, setShowAddMenu] = useState(false);

	// Handle event deletion
	const handleDeleteEvent = useCallback((eventId: string) => {
		setLocalEvents(prev => prev.filter(e => e.id !== eventId));
	}, []);

	// Handle adding new event
	const handleAddEvent = useCallback(
		(subkind: RelationshipSubkind, fromChar?: string, toChar?: string) => {
			const newEvent: RelationshipEvent = {
				id: crypto.randomUUID(),
				kind: 'relationship',
				subkind,
				source: {
					messageId: latestMessageId,
					swipeId: swipeContext.getCanonicalSwipeId(latestMessageId),
				},
				timestamp: Date.now(),
				...(isDirectionalSubkind(subkind)
					? {
							fromCharacter: fromChar || charA,
							towardCharacter: toChar || charB,
							value: '',
						}
					: subkind === 'status_changed'
						? {
								pair: [charA, charB] as [
									string,
									string,
								],
								newStatus: 'acquaintances' as const,
							}
						: {
								pair: [charA, charB] as [
									string,
									string,
								],
								subject: 'conversation' as const,
							}),
			} as RelationshipEvent;
			setLocalEvents(prev => [...prev, newEvent]);
			setShowAddMenu(false);
		},
		[charA, charB, latestMessageId, swipeContext],
	);

	// Handle event value change
	const handleEventValueChange = useCallback((eventId: string, newValue: string) => {
		setLocalEvents(prev =>
			prev.map(e => {
				if (e.id !== eventId) return e;
				if ('value' in e) return { ...e, value: newValue };
				if (isRelationshipStatusChangedEvent(e)) {
					return { ...e, newStatus: newValue as RelationshipStatus };
				}
				if (isRelationshipSubjectEvent(e)) {
					return { ...e, subject: newValue as Subject };
				}
				return e;
			}),
		);
	}, []);

	// Handle milestone description change
	const handleMilestoneChange = useCallback((eventId: string, milestone: string) => {
		setLocalEvents(prev =>
			prev.map(e => {
				if (e.id !== eventId) return e;
				if (isRelationshipSubjectEvent(e)) {
					return {
						...e,
						milestoneDescription: milestone || undefined,
					};
				}
				return e;
			}),
		);
	}, []);

	// Handle save
	const handleSave = useCallback(() => {
		const finalStore = eventStore.getDeepClone();
		finalStore.replaceRelationshipEventsForPair(pair, localEvents);
		onSave(finalStore);
	}, [eventStore, pair, localEvents, onSave]);

	// Handle backdrop click
	const handleBackdropClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		},
		[onClose],
	);

	return (
		<div className="bt-v2-relationship-editor-backdrop" onClick={handleBackdropClick}>
			<div
				className="bt-v2-relationship-editor"
				onClick={e => e.stopPropagation()}
			>
				{/* Header */}
				<div className="bt-v2-relationship-editor-header">
					<h3>
						<i className="fa-solid fa-heart" />
						{charA}{' '}
						<i
							className="fa-solid fa-arrows-left-right"
							style={{
								fontSize: '0.8rem',
								margin: '0 0.35rem',
							}}
						/>{' '}
						{charB}
					</h3>
					<button
						className="bt-v2-narrative-close"
						onClick={onClose}
						aria-label="Close editor"
					>
						<i className="fa-solid fa-xmark" />
					</button>
				</div>

				{/* Split pane content */}
				<div className="bt-v2-relationship-editor-split">
					{/* Left pane: Events */}
					<div className="bt-v2-editor-events-pane">
						<div className="bt-v2-editor-pane-header">
							<span>
								<i className="fa-solid fa-list" />{' '}
								Events
							</span>
							<div style={{ position: 'relative' }}>
								<button
									className="bt-v2-add-event-btn"
									onClick={() =>
										setShowAddMenu(
											!showAddMenu,
										)
									}
								>
									<i className="fa-solid fa-plus" />{' '}
									Add Event
								</button>
								{showAddMenu && (
									<AddEventMenu
										charA={charA}
										charB={charB}
										onSelect={
											handleAddEvent
										}
										onClose={() =>
											setShowAddMenu(
												false,
											)
										}
									/>
								)}
							</div>
						</div>
						<div className="bt-v2-editor-pane-content">
							{eventsByMessage.length === 0 ? (
								<div className="bt-v2-events-empty">
									<i className="fa-solid fa-inbox" />
									<div>
										No events recorded
									</div>
								</div>
							) : (
								eventsByMessage.map(group => (
									<div
										key={
											group.messageId
										}
										className="bt-v2-events-message-group"
									>
										<div className="bt-v2-events-message-header">
											<i className="fa-solid fa-message" />
											Message #
											{
												group.messageId
											}
										</div>
										{group.events.map(
											event => (
												<RelationshipEventCard
													key={
														event.id
													}
													event={
														event
													}
													charA={
														charA
													}
													charB={
														charB
													}
													onDelete={() =>
														handleDeleteEvent(
															event.id,
														)
													}
													onValueChange={value =>
														handleEventValueChange(
															event.id,
															value,
														)
													}
													onMilestoneChange={milestone =>
														handleMilestoneChange(
															event.id,
															milestone,
														)
													}
												/>
											),
										)}
									</div>
								))
							)}
						</div>
					</div>

					{/* Right pane: Projection preview */}
					<div className="bt-v2-editor-projection-pane">
						<div className="bt-v2-editor-pane-header">
							<span>
								<i className="fa-solid fa-eye" />{' '}
								Preview
							</span>
						</div>
						<div className="bt-v2-editor-pane-content">
							{!relationship ? (
								<div className="bt-v2-events-empty">
									<i className="fa-solid fa-circle-exclamation" />
									<div>
										No projection
										available
									</div>
								</div>
							) : (
								<div className="bt-v2-projected-rel">
									{/* Status */}
									<div className="bt-v2-projected-rel-section">
										<h4>Status</h4>
										<span
											className={`bt-v2-relationship-status ${relationship.status}`}
										>
											{
												relationship.status
											}
										</span>
									</div>

									{/* A to B */}
									<div className="bt-v2-projected-rel-section">
										<h4>
											{charA}{' '}
											towards{' '}
											{charB}
										</h4>
										<AttitudePreview
											attitude={
												relationship.aToB
											}
										/>
									</div>

									{/* B to A */}
									<div className="bt-v2-projected-rel-section">
										<h4>
											{charB}{' '}
											towards{' '}
											{charA}
										</h4>
										<AttitudePreview
											attitude={
												relationship.bToA
											}
										/>
									</div>

									{/* Milestones */}
									{milestones.length > 0 && (
										<div className="bt-v2-projected-rel-section">
											<h4>
												Milestones
											</h4>
											<div className="bt-v2-milestones-list">
												{milestones.map(
													milestone => (
														<span
															key={`${milestone.subject}-${milestone.messageId}`}
															className="bt-v2-milestone-tag"
															title={
																milestone.description ||
																undefined
															}
														>
															{getMilestoneDisplayName(
																milestone.subject,
															)}
														</span>
													),
												)}
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="bt-v2-relationship-editor-footer">
					<button className="bt-v2-btn" onClick={onClose}>
						Cancel
					</button>
					<button
						className="bt-v2-btn bt-v2-btn-primary"
						onClick={handleSave}
					>
						<i className="fa-solid fa-save" />
						Apply Changes
					</button>
				</div>
			</div>
		</div>
	);
}

// Helper: Check if subkind is directional
function isDirectionalSubkind(subkind: RelationshipSubkind): boolean {
	return (
		subkind === 'feeling_added' ||
		subkind === 'feeling_removed' ||
		subkind === 'secret_added' ||
		subkind === 'secret_removed' ||
		subkind === 'want_added' ||
		subkind === 'want_removed'
	);
}

// Event card for a single relationship event
interface RelationshipEventCardProps {
	event: RelationshipEvent;
	charA: string;
	charB: string;
	onDelete: () => void;
	onValueChange: (value: string) => void;
	onMilestoneChange?: (milestone: string) => void;
}

function RelationshipEventCard({
	event,
	charA,
	charB,
	onDelete,
	onValueChange,
	onMilestoneChange,
}: RelationshipEventCardProps): React.ReactElement {
	const [isEditing, setIsEditing] = useState(false);
	const [isEditingMilestone, setIsEditingMilestone] = useState(false);
	const isSubject = isRelationshipSubjectEvent(event);

	const getDisplayValue = () => {
		if ('value' in event) return event.value;
		if ('newStatus' in event) return event.newStatus;
		if ('subject' in event) return (event as any).subject;
		return '';
	};

	const getSubkindDisplay = () => {
		const subkind = event.subkind;
		return subkind.replace(/_/g, ' ');
	};

	const getDirectionDisplay = () => {
		if (isDirectionalRelationshipEvent(event)) {
			const pair = getRelationshipPair(event);
			const from = event.fromCharacter;
			// Show arrow direction based on char positions
			if (from === pair[0]) {
				return `${charA} → ${charB}`;
			} else {
				return `${charB} → ${charA}`;
			}
		}
		return '';
	};

	const getIcon = () => {
		const subkind = event.subkind;
		if (subkind.includes('feeling')) return 'fa-heart';
		if (subkind.includes('secret')) return 'fa-user-secret';
		if (subkind.includes('want')) return 'fa-hand-holding-heart';
		if (subkind === 'status_changed') return 'fa-tags';
		if (subkind === 'subject') return 'fa-star';
		return 'fa-circle';
	};

	const getMilestoneText = () => {
		if (isSubject) {
			return (event as any).milestoneDescription ?? '';
		}
		return '';
	};

	// Format subject for display
	const formatSubject = (s: string) => s.replace(/_/g, ' ');

	return (
		<div className="bt-v2-event-rel-card">
			<div className="bt-v2-event-rel-icon">
				<i className={`fa-solid ${getIcon()}`} />
			</div>
			<div className="bt-v2-event-rel-content">
				<div className="bt-v2-event-rel-subkind">{getSubkindDisplay()}</div>
				{isEditing ? (
					isSubject ? (
						<select
							className="bt-v2-event-rel-select"
							value={getDisplayValue()}
							onChange={e => {
								onValueChange(e.target.value);
								setIsEditing(false);
							}}
							onBlur={() => setIsEditing(false)}
							autoFocus
							style={{
								background: '#1a1a1a',
								border: '1px solid #f80',
								borderRadius: '3px',
								padding: '0.2rem 0.4rem',
								color: '#fff',
								fontSize: '0.85rem',
								width: '100%',
							}}
						>
							{SUBJECTS.map(s => (
								<option key={s} value={s}>
									{formatSubject(s)}
								</option>
							))}
						</select>
					) : (
						<input
							type="text"
							className="bt-v2-event-rel-input"
							value={getDisplayValue()}
							onChange={e =>
								onValueChange(e.target.value)
							}
							onBlur={() => setIsEditing(false)}
							onKeyDown={e => {
								if (e.key === 'Enter')
									setIsEditing(false);
								if (e.key === 'Escape')
									setIsEditing(false);
							}}
							autoFocus
							style={{
								background: '#1a1a1a',
								border: '1px solid #f80',
								borderRadius: '3px',
								padding: '0.2rem 0.4rem',
								color: '#fff',
								fontSize: '0.85rem',
								width: '100%',
							}}
						/>
					)
				) : (
					<div
						className="bt-v2-event-rel-value"
						onClick={() => setIsEditing(true)}
					>
						{isSubject
							? formatSubject(getDisplayValue())
							: getDisplayValue() || (
									<em
										style={{
											color: '#555',
										}}
									>
										empty
									</em>
								)}
					</div>
				)}
				{isDirectionalRelationshipEvent(event) && (
					<div className="bt-v2-event-rel-direction">
						{getDirectionDisplay()}
					</div>
				)}
				{/* Milestone text for subject events */}
				{isSubject && (
					<div className="bt-v2-event-rel-milestone">
						{isEditingMilestone ? (
							<input
								type="text"
								placeholder="Milestone description"
								value={getMilestoneText()}
								onChange={e =>
									onMilestoneChange?.(
										e.target.value,
									)
								}
								onBlur={() =>
									setIsEditingMilestone(false)
								}
								onKeyDown={e => {
									if (e.key === 'Enter')
										setIsEditingMilestone(
											false,
										);
									if (e.key === 'Escape')
										setIsEditingMilestone(
											false,
										);
								}}
								autoFocus
								style={{
									background: '#1a1a1a',
									border: '1px solid #f80',
									borderRadius: '3px',
									padding: '0.2rem 0.4rem',
									color: '#fff',
									fontSize: '0.8rem',
									width: '100%',
								}}
							/>
						) : (
							<div
								className="bt-v2-event-rel-milestone-text"
								onClick={() =>
									setIsEditingMilestone(true)
								}
								style={{
									fontSize: '0.8rem',
									color: getMilestoneText()
										? '#eab308'
										: '#555',
									fontStyle: getMilestoneText()
										? 'normal'
										: 'italic',
									cursor: 'pointer',
								}}
							>
								<i
									className="fa-solid fa-star"
									style={{
										marginRight:
											'0.3rem',
										fontSize: '0.7rem',
									}}
								/>
								{getMilestoneText() ||
									'add milestone text'}
							</div>
						)}
					</div>
				)}
			</div>
			<div className="bt-v2-event-rel-actions">
				<button
					className="bt-v2-event-action-btn"
					onClick={() => setIsEditing(true)}
					title="Edit"
				>
					<i className="fa-solid fa-pen" />
				</button>
				<button
					className="bt-v2-event-action-btn delete"
					onClick={onDelete}
					title="Delete"
				>
					<i className="fa-solid fa-trash" />
				</button>
			</div>
		</div>
	);
}

// Add event menu
interface AddEventMenuProps {
	charA: string;
	charB: string;
	onSelect: (subkind: RelationshipSubkind, fromChar?: string, toChar?: string) => void;
	onClose: () => void;
}

function AddEventMenu({ charA, charB, onSelect, onClose }: AddEventMenuProps): React.ReactElement {
	const directionalTypes: { subkind: RelationshipSubkind; label: string; icon: string }[] = [
		{ subkind: 'feeling_added', label: 'Add Feeling', icon: 'fa-heart' },
		{ subkind: 'feeling_removed', label: 'Remove Feeling', icon: 'fa-heart-crack' },
		{ subkind: 'secret_added', label: 'Add Secret', icon: 'fa-user-secret' },
		{ subkind: 'secret_removed', label: 'Remove Secret', icon: 'fa-eye' },
		{ subkind: 'want_added', label: 'Add Want', icon: 'fa-hand-holding-heart' },
		{ subkind: 'want_removed', label: 'Remove Want', icon: 'fa-xmark' },
	];

	const [expandedSubkind, setExpandedSubkind] = useState<RelationshipSubkind | null>(null);

	return (
		<>
			<div className="bt-v2-add-event-menu-backdrop" onClick={onClose} />
			<div className="bt-v2-add-event-menu">
				{/* Status change (symmetric) */}
				<div
					className="bt-v2-add-event-option"
					onClick={() => onSelect('status_changed')}
				>
					<i className="fa-solid fa-tags" />
					Change Status
				</div>

				{/* Subject (symmetric) */}
				<div
					className="bt-v2-add-event-option"
					onClick={() => onSelect('subject')}
				>
					<i className="fa-solid fa-star" />
					Add Subject/Milestone
				</div>

				{/* Directional events */}
				{directionalTypes.map(({ subkind, label, icon }) => (
					<div key={subkind}>
						<div
							className="bt-v2-add-event-option"
							onClick={() =>
								setExpandedSubkind(
									expandedSubkind === subkind
										? null
										: subkind,
								)
							}
						>
							<i className={`fa-solid ${icon}`} />
							{label}
							<i
								className={`fa-solid ${expandedSubkind === subkind ? 'fa-chevron-up' : 'fa-chevron-down'}`}
								style={{
									marginLeft: 'auto',
									fontSize: '0.7rem',
								}}
							/>
						</div>
						{expandedSubkind === subkind && (
							<>
								<div
									className="bt-v2-add-event-option"
									style={{
										paddingLeft: '2rem',
										background: '#222',
									}}
									onClick={() =>
										onSelect(
											subkind,
											charA,
											charB,
										)
									}
								>
									{charA} → {charB}
								</div>
								<div
									className="bt-v2-add-event-option"
									style={{
										paddingLeft: '2rem',
										background: '#222',
									}}
									onClick={() =>
										onSelect(
											subkind,
											charB,
											charA,
										)
									}
								>
									{charB} → {charA}
								</div>
							</>
						)}
					</div>
				))}
			</div>
		</>
	);
}

// Attitude preview component
function AttitudePreview({
	attitude,
}: {
	attitude: { feelings: string[]; secrets: string[]; wants: string[] };
}): React.ReactElement {
	const hasContent =
		attitude.feelings.length > 0 ||
		attitude.secrets.length > 0 ||
		attitude.wants.length > 0;

	if (!hasContent) {
		return <div className="bt-v2-attitude-empty">No feelings recorded</div>;
	}

	return (
		<>
			{attitude.feelings.length > 0 && (
				<div className="bt-v2-attitude-row">
					<span className="bt-v2-attitude-label">Feels</span>
					<div className="bt-v2-attitude-tags">
						{attitude.feelings.map(feeling => (
							<span
								key={feeling}
								className="bt-v2-tag-feeling"
							>
								{feeling}
							</span>
						))}
					</div>
				</div>
			)}
			{attitude.secrets.length > 0 && (
				<div className="bt-v2-attitude-row">
					<span className="bt-v2-attitude-label">Secrets</span>
					<div className="bt-v2-attitude-tags">
						{attitude.secrets.map(secret => (
							<span
								key={secret}
								className="bt-v2-tag-secret"
							>
								{secret}
							</span>
						))}
					</div>
				</div>
			)}
			{attitude.wants.length > 0 && (
				<div className="bt-v2-attitude-row">
					<span className="bt-v2-attitude-label">Wants</span>
					<div className="bt-v2-attitude-tags">
						{attitude.wants.map(want => (
							<span key={want} className="bt-v2-tag-want">
								{want}
							</span>
						))}
					</div>
				</div>
			)}
		</>
	);
}
