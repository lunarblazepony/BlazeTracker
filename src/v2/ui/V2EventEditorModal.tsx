/**
 * V2 Event Editor Modal
 *
 * Split-pane modal for editing v2 events at a specific message/swipe.
 * Left pane: Event editor
 * Right pane: Live projection preview
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import type { Event } from '../types/event';
import type { Projection } from '../types/snapshot';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { V2EventEditor, V2AddEventMenu, type V2EventEditorHandle } from './V2EventEditor';
import { V2ProjectionPreview } from './V2ProjectionPreview';
import { debugWarn } from '../../utils/debug';

export interface V2EventEditorModalProps {
	/** The event store to edit */
	eventStore: EventStore;
	/** The message ID to edit events for */
	messageId: number;
	/** The swipe ID to edit events for */
	swipeId: number;
	/** Swipe context for projection (maps messageId -> canonical swipeId) */
	swipeContext: SwipeContext;
	/** Called when the user saves changes */
	onSave: (updatedStore: EventStore) => void;
	/** Called when the modal is closed without saving */
	onClose: () => void;
}

/**
 * Modal for editing v2 events at a specific message/swipe.
 * Uses a cloned EventStore for isolated editing.
 */
export function V2EventEditorModal({
	eventStore,
	messageId,
	swipeId,
	swipeContext,
	onSave,
	onClose,
}: V2EventEditorModalProps) {
	const editorRef = useRef<V2EventEditorHandle>(null);

	// Deep clone store for isolated editing
	const [clonedStore] = useState(() => eventStore.getDeepClone());

	// Add event menu state
	const [showAddMenu, setShowAddMenu] = useState(false);

	// Track edited events at this message/swipe
	const [localEvents, setLocalEvents] = useState<Event[]>(() =>
		clonedStore.getEventsAtMessage({ messageId, swipeId }),
	);

	// Compute projection with live-updating from localEvents
	// Also returns the active events for milestone querying
	const { projection, activeEvents } = useMemo((): {
		projection: Projection | null;
		activeEvents: Event[];
	} => {
		try {
			// Create a temporary store with our local edits
			const tempStore = clonedStore.getDeepClone();

			// Delete existing events at this message/swipe
			tempStore.deleteEventsAtMessage({ messageId, swipeId });

			// Append local events
			tempStore.appendEvents(localEvents);

			// Project state at this message
			const proj = tempStore.projectStateAtMessage(messageId, swipeContext);
			return { projection: proj, activeEvents: tempStore.getActiveEvents() };
		} catch (e) {
			debugWarn('V2EventEditorModal: Failed to compute projection:', e);
			return { projection: null, activeEvents: [] };
		}
	}, [localEvents, clonedStore, messageId, swipeId, swipeContext]);

	// Handle events change from editor
	const handleEventsChange = useCallback((events: Event[]) => {
		setLocalEvents(events);
	}, []);

	// Handle adding a new event from menu
	const handleAddEvent = useCallback((event: Event) => {
		setLocalEvents(prev => [...prev, event]);
		setShowAddMenu(false);
	}, []);

	// Handle save
	const handleSave = useCallback(() => {
		// Commit any pending inline edits
		const finalEvents = editorRef.current?.commitPendingEdits() ?? localEvents;

		// Create the final store with changes
		const finalStore = eventStore.getDeepClone();
		finalStore.replaceEventsAtMessage({ messageId, swipeId }, finalEvents);

		onSave(finalStore);
	}, [localEvents, eventStore, messageId, swipeId, onSave]);

	// Handle backdrop click
	const handleBackdropClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		},
		[onClose],
	);

	// Handle escape key
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		},
		[onClose],
	);

	return (
		<div
			className="bt-v2-editor-modal-backdrop"
			onClick={handleBackdropClick}
			onKeyDown={handleKeyDown}
			tabIndex={-1}
		>
			<div className="bt-v2-editor-modal">
				<div className="bt-v2-editor-header">
					<h3>
						<i className="fa-solid fa-edit"></i>
						Edit Events - Message #{messageId}
						{swipeId > 0 && (
							<span className="bt-swipe-badge">
								Swipe {swipeId + 1}
							</span>
						)}
					</h3>
					<button
						className="bt-v2-editor-close"
						onClick={onClose}
						title="Close"
					>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>

				<div className="bt-v2-editor-split">
					{/* Left Pane: Events Editor */}
					<div className="bt-v2-editor-left">
						<div className="bt-v2-pane-header">
							<span>
								<i className="fa-solid fa-list"></i>{' '}
								Events ({localEvents.length})
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
									Add
								</button>
								{showAddMenu && projection && (
									<V2AddEventMenu
										messageId={
											messageId
										}
										swipeId={swipeId}
										onAdd={
											handleAddEvent
										}
										onClose={() =>
											setShowAddMenu(
												false,
											)
										}
										projection={
											projection
										}
									/>
								)}
							</div>
						</div>
						<div className="bt-v2-pane-content">
							{projection ? (
								<V2EventEditor
									ref={editorRef}
									events={localEvents}
									messageId={messageId}
									swipeId={swipeId}
									onEventsChange={
										handleEventsChange
									}
									projection={projection}
								/>
							) : (
								<div className="bt-v2-editor-empty">
									<i className="fa-solid fa-exclamation-triangle"></i>
									<span>
										No projection
										available
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Right Pane: Projection Preview */}
					<div className="bt-v2-editor-right">
						<div className="bt-v2-pane-header">
							<i className="fa-solid fa-eye"></i>
							Preview
						</div>
						<div className="bt-v2-pane-content">
							{projection ? (
								<V2ProjectionPreview
									projection={projection}
									events={activeEvents}
									swipeContext={swipeContext}
								/>
							) : (
								<div className="bt-v2-editor-empty">
									<i className="fa-solid fa-ghost"></i>
									<span>
										No state to preview
									</span>
								</div>
							)}
						</div>
					</div>
				</div>

				<div className="bt-v2-editor-actions">
					<button className="bt-btn" onClick={onClose}>
						<i className="fa-solid fa-times"></i>
						Cancel
					</button>
					<button
						className="bt-btn bt-btn-primary"
						onClick={handleSave}
					>
						<i className="fa-solid fa-save"></i>
						Save Changes
					</button>
				</div>
			</div>
		</div>
	);
}

export default V2EventEditorModal;
