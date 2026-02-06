/**
 * V2 Snapshot Editor Modal
 *
 * Split-pane modal for editing the initial snapshot directly.
 * Left pane: Snapshot fields editor
 * Right pane: Live projection preview
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Snapshot, Projection } from '../types/snapshot';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { cloneSnapshot, createProjectionFromSnapshot } from '../types/snapshot';
import { SnapshotFieldsEditor } from './SnapshotFieldsEditor';
import { V2ProjectionPreview } from './V2ProjectionPreview';
import { debugWarn } from '../../utils/debug';

export interface V2SnapshotEditorModalProps {
	/** The event store to edit */
	eventStore: EventStore;
	/** The message ID (initial snapshot message) */
	messageId: number;
	/** The swipe ID */
	swipeId: number;
	/** Swipe context for projection */
	swipeContext: SwipeContext;
	/** Called when the user saves changes */
	onSave: (updatedStore: EventStore) => void;
	/** Called when the modal is closed without saving */
	onClose: () => void;
}

/**
 * Modal for editing the initial snapshot directly.
 * Uses a cloned snapshot for isolated editing.
 */
export function V2SnapshotEditorModal({
	eventStore,
	messageId,
	swipeId,
	swipeContext,
	onSave,
	onClose,
}: V2SnapshotEditorModalProps) {
	// Deep-clone the initial snapshot for editing
	const [editedSnapshot, setEditedSnapshot] = useState<Snapshot>(() => {
		const initial = eventStore.initialSnapshot;
		if (!initial) {
			throw new Error('V2SnapshotEditorModal: No initial snapshot found');
		}
		return cloneSnapshot(initial);
	});

	// Compute live preview projection from the edited snapshot
	const projection = useMemo((): Projection | null => {
		try {
			return createProjectionFromSnapshot(editedSnapshot, {
				messageId,
				swipeId,
			});
		} catch (e) {
			debugWarn('V2SnapshotEditorModal: Failed to compute projection:', e);
			return null;
		}
	}, [editedSnapshot, messageId, swipeId]);

	// Handle save
	const handleSave = useCallback(() => {
		const finalStore = eventStore.getDeepClone();
		finalStore.replaceInitialSnapshot(editedSnapshot);
		onSave(finalStore);
	}, [editedSnapshot, eventStore, onSave]);

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
						<i className="fa-solid fa-camera"></i>
						Edit Initial Snapshot - Message #{messageId}
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
					{/* Left Pane: Snapshot Fields Editor */}
					<div className="bt-v2-editor-left">
						<div className="bt-v2-pane-header">
							<span>
								<i className="fa-solid fa-sliders"></i>{' '}
								Snapshot Fields
							</span>
						</div>
						<div className="bt-v2-pane-content">
							<SnapshotFieldsEditor
								snapshot={editedSnapshot}
								onChange={setEditedSnapshot}
							/>
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

export default V2SnapshotEditorModal;
