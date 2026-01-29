/**
 * V2 Narrative Modal
 *
 * Main modal for viewing narrative data (relationships and chapters).
 * Uses EventStore projections for all data display.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { createSwipeContext } from '../store/projection';
import { V2RelationshipsTab } from './tabs/V2RelationshipsTab';
import { V2ChaptersTab } from './tabs/V2ChaptersTab';
import { V2EventsTab } from './tabs/V2EventsTab';
import { V2RelationshipEditor } from './components/V2RelationshipEditor';

export interface V2NarrativeModalProps {
	eventStore: EventStore;
	chat: { swipe_id: number }[];
	onClose: () => void;
	onSave: (eventStore: EventStore) => Promise<void>;
	initialTab?: 'chapters' | 'relationships' | 'events';
	latestMessageId: number;
}

type TabType = 'chapters' | 'relationships' | 'events';

export function V2NarrativeModal({
	eventStore,
	chat,
	onClose,
	onSave,
	initialTab = 'relationships',
	latestMessageId,
}: V2NarrativeModalProps): React.ReactElement | null {
	const [activeTab, setActiveTab] = useState<TabType>(initialTab);
	const [localStore, setLocalStore] = useState(() => eventStore.getDeepClone());
	const [editingPair, setEditingPair] = useState<[string, string] | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);

	// Create SwipeContext from chat array
	const swipeContext: SwipeContext = useMemo(() => createSwipeContext(chat), [chat]);

	// Project state at latest message
	const projection = useMemo(() => {
		try {
			return localStore.projectStateAtMessage(latestMessageId, swipeContext);
		} catch {
			return null;
		}
	}, [localStore, latestMessageId, swipeContext]);

	// Count relationships, chapters, and events
	const relationshipsCount = projection ? Object.keys(projection.relationships).length : 0;
	const chaptersCount = projection ? projection.currentChapter + 1 : 0;
	const eventsCount = projection
		? projection.narrativeEvents.filter(
				e => e.chapterIndex === projection.currentChapter,
			).length
		: 0;

	// Handle editing a relationship
	const handleEditRelationship = useCallback((pair: [string, string]) => {
		setEditingPair(pair);
	}, []);

	// Handle relationship editor save
	const handleRelationshipSave = useCallback((updatedStore: EventStore) => {
		setLocalStore(updatedStore);
		setEditingPair(null);
		setHasChanges(true);
	}, []);

	// Handle main modal save
	const handleSave = useCallback(async () => {
		setIsSaving(true);
		try {
			await onSave(localStore);
			onClose();
		} finally {
			setIsSaving(false);
		}
	}, [localStore, onSave, onClose]);

	// Handle close with confirmation if there are changes
	const handleClose = useCallback(() => {
		if (hasChanges) {
			if (
				window.confirm(
					'You have unsaved changes. Are you sure you want to close?',
				)
			) {
				onClose();
			}
		} else {
			onClose();
		}
	}, [hasChanges, onClose]);

	// Handle backdrop click (close modal)
	const handleBackdropClick = useCallback(
		(e: React.MouseEvent) => {
			if (e.target === e.currentTarget) {
				handleClose();
			}
		},
		[handleClose],
	);

	// Handle keyboard events
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Escape' && !editingPair) {
				handleClose();
			}
		},
		[handleClose, editingPair],
	);

	const modalContent = (
		<div
			className="bt-v2-narrative-backdrop"
			onClick={handleBackdropClick}
			onKeyDown={handleKeyDown}
			role="dialog"
			aria-modal="true"
			aria-labelledby="narrative-modal-title"
		>
			<div className="bt-v2-narrative-modal">
				{/* Header */}
				<div className="bt-v2-narrative-header">
					<h2 id="narrative-modal-title">
						<i className="fa-solid fa-book-open" />
						Narrative State
					</h2>
					<button
						className="bt-v2-narrative-close"
						onClick={handleClose}
						aria-label="Close modal"
					>
						<i className="fa-solid fa-xmark" />
					</button>
				</div>

				{/* Tabs */}
				<div className="bt-v2-narrative-tabs">
					<button
						className={`bt-v2-narrative-tab ${activeTab === 'relationships' ? 'active' : ''}`}
						onClick={() => setActiveTab('relationships')}
					>
						<i className="fa-solid fa-heart" />
						Relationships
						<span className="bt-v2-tab-count">
							{relationshipsCount}
						</span>
					</button>
					<button
						className={`bt-v2-narrative-tab ${activeTab === 'events' ? 'active' : ''}`}
						onClick={() => setActiveTab('events')}
					>
						<i className="fa-solid fa-scroll" />
						Events
						<span className="bt-v2-tab-count">
							{eventsCount}
						</span>
					</button>
					<button
						className={`bt-v2-narrative-tab ${activeTab === 'chapters' ? 'active' : ''}`}
						onClick={() => setActiveTab('chapters')}
					>
						<i className="fa-solid fa-bookmark" />
						Chapters
						<span className="bt-v2-tab-count">
							{chaptersCount}
						</span>
					</button>
				</div>

				{/* Content */}
				<div className="bt-v2-narrative-content">
					{!projection ? (
						<div className="bt-v2-relationships-empty">
							<i className="fa-solid fa-circle-exclamation" />
							<div>
								No state available. Run initial
								extraction first.
							</div>
						</div>
					) : activeTab === 'relationships' ? (
						<V2RelationshipsTab
							projection={projection}
							eventStore={localStore}
							swipeContext={swipeContext}
							onEditRelationship={handleEditRelationship}
						/>
					) : activeTab === 'events' ? (
						<V2EventsTab projection={projection} />
					) : (
						<V2ChaptersTab
							projection={projection}
							eventStore={localStore}
							swipeContext={swipeContext}
						/>
					)}
				</div>

				{/* Footer */}
				<div className="bt-v2-narrative-footer">
					<button className="bt-v2-btn" onClick={handleClose}>
						Cancel
					</button>
					<button
						className="bt-v2-btn bt-v2-btn-primary"
						onClick={handleSave}
						disabled={isSaving || !hasChanges}
					>
						{isSaving ? (
							<>
								<i className="fa-solid fa-spinner fa-spin" />
								Saving...
							</>
						) : (
							<>
								<i className="fa-solid fa-save" />
								Save Changes
							</>
						)}
					</button>
				</div>
			</div>

			{/* Relationship Editor Modal */}
			{editingPair && (
				<V2RelationshipEditor
					pair={editingPair}
					eventStore={localStore}
					swipeContext={swipeContext}
					latestMessageId={latestMessageId}
					onClose={() => setEditingPair(null)}
					onSave={handleRelationshipSave}
				/>
			)}
		</div>
	);

	return createPortal(modalContent, document.body);
}
