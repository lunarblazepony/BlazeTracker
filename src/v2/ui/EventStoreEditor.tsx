/**
 * V2 EventStoreEditor Component
 *
 * A component to view projected state and edit events in the EventStore.
 * Uses the deepClone pattern for safe editing.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { EventStore } from '../store/EventStore';
import type { Projection } from '../types/snapshot';
import type { Event } from '../types/event';
import { V2StateReadOnly, V2CharacterReadOnly, V2EventCard } from './components';
import { buildSwipeContext } from '../../v2Bridge';
import type { STContext } from '../../types/st';
import { errorLog } from '../../utils/debug';

export interface EventStoreEditorProps {
	store: EventStore;
	/** Message scope - only events at this message are editable */
	messageId: number;
	swipeId: number;
	onSave: (editedStore: EventStore) => void;
	onCancel: () => void;
	temperatureUnit?: 'F' | 'C';
}

type TabId = 'state' | 'characters' | 'events';

interface TabDef {
	id: TabId;
	label: string;
	icon: string;
}

const TABS: TabDef[] = [
	{ id: 'state', label: 'State', icon: 'fa-layer-group' },
	{ id: 'characters', label: 'Characters', icon: 'fa-users' },
	{ id: 'events', label: 'Events', icon: 'fa-list' },
];

export function EventStoreEditor({
	store,
	messageId,
	swipeId,
	onSave,
	onCancel,
	temperatureUnit = 'F',
}: EventStoreEditorProps) {
	// Clone the store for editing
	const [editStore, setEditStore] = useState<EventStore>(() => store.getDeepClone());
	const [activeTab, setActiveTab] = useState<TabId>('state');
	const [hasChanges, setHasChanges] = useState(false);

	// Create swipe context for projection - uses actual swipe IDs from each message
	const swipeContext = useMemo(() => {
		const stContext = SillyTavern.getContext() as unknown as STContext;
		return buildSwipeContext(stContext);
	}, []);

	// Project state at this message
	const projection: Projection | null = useMemo(() => {
		if (!editStore.hasInitialSnapshot) return null;
		try {
			return editStore.projectStateAtMessage(messageId, swipeContext);
		} catch {
			return null;
		}
	}, [editStore, messageId, swipeContext]);

	// Filter editable events (only those at this message/swipe)
	const editableEvents = useMemo(() => {
		return editStore.events.filter(
			e =>
				e.source.messageId === messageId &&
				e.source.swipeId === swipeId &&
				!e.deleted,
		) as Event[];
	}, [editStore, messageId, swipeId]);

	// Get all active events for context
	const allActiveEvents = useMemo(() => {
		return editStore.getActiveEvents();
	}, [editStore]);

	// Handle event deletion
	const handleDeleteEvent = useCallback(
		(eventId: string) => {
			// Create a new clone with the event marked as deleted
			const newStore = editStore.getDeepClone();
			const event = newStore.events.find(e => e.id === eventId);
			if (event) {
				(event as Event).deleted = true;
			}
			setEditStore(newStore);
			setHasChanges(true);
		},
		[editStore],
	);

	// Handle save
	const handleSave = useCallback(() => {
		onSave(editStore);
	}, [editStore, onSave]);

	// Handle cancel
	const handleCancel = useCallback(() => {
		onCancel();
	}, [onCancel]);

	// Render tab content
	const renderTabContent = () => {
		switch (activeTab) {
			case 'state':
				return projection ? (
					<V2StateReadOnly
						projection={projection}
						temperatureUnit={temperatureUnit}
					/>
				) : (
					<div className="bt-no-data">
						No state projection available
					</div>
				);

			case 'characters':
				if (!projection || projection.charactersPresent.length === 0) {
					return (
						<div className="bt-no-data">
							No characters present
						</div>
					);
				}
				return (
					<div className="bt-characters-list">
						{projection.charactersPresent.map(name => {
							const character =
								projection.characters[name];
							if (!character) return null;
							return (
								<V2CharacterReadOnly
									key={name}
									character={character}
								/>
							);
						})}
					</div>
				);

			case 'events':
				return (
					<div className="bt-events-list">
						{editableEvents.length === 0 ? (
							<div className="bt-no-data">
								No events at this message
							</div>
						) : (
							<>
								<div className="bt-events-header">
									Events at Message #
									{messageId}
									{swipeId > 0 &&
										` (swipe ${swipeId})`}
								</div>
								{editableEvents.map(event => (
									<V2EventCard
										key={event.id}
										event={event}
										isEditable={true}
										onDelete={() =>
											handleDeleteEvent(
												event.id,
											)
										}
									/>
								))}
							</>
						)}
						{allActiveEvents.length > editableEvents.length && (
							<div className="bt-events-context">
								<details>
									<summary>
										Other events (
										{allActiveEvents.length -
											editableEvents.length}{' '}
										from earlier
										messages)
									</summary>
									<div className="bt-context-events">
										{allActiveEvents
											.filter(
												e =>
													e
														.source
														.messageId !==
														messageId ||
													e
														.source
														.swipeId !==
														swipeId,
											)
											.map(
												event => (
													<V2EventCard
														key={
															event.id
														}
														event={
															event
														}
														isEditable={
															false
														}
													/>
												),
											)}
									</div>
								</details>
							</div>
						)}
					</div>
				);

			default:
				return null;
		}
	};

	const modalContent = (
		<div className="bt-v2-editor-overlay" onClick={handleCancel}>
			<div className="bt-v2-editor-modal" onClick={e => e.stopPropagation()}>
				{/* Header */}
				<div className="bt-v2-editor-header">
					<h3>
						<i className="fa-solid fa-pen"></i>
						Edit State at Message #{messageId}
					</h3>
					<button className="bt-close-btn" onClick={handleCancel}>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>

				{/* Tabs */}
				<div className="bt-v2-editor-tabs">
					{TABS.map(tab => (
						<button
							key={tab.id}
							className={`bt-tab ${activeTab === tab.id ? 'bt-active' : ''}`}
							onClick={() => setActiveTab(tab.id)}
						>
							<i className={`fa-solid ${tab.icon}`}></i>
							{tab.label}
						</button>
					))}
				</div>

				{/* Content */}
				<div className="bt-v2-editor-content">{renderTabContent()}</div>

				{/* Footer */}
				<div className="bt-v2-editor-footer">
					<button className="bt-cancel-btn" onClick={handleCancel}>
						Cancel
					</button>
					<button
						className="bt-save-btn"
						onClick={handleSave}
						disabled={!hasChanges}
					>
						{hasChanges ? 'Save Changes' : 'No Changes'}
					</button>
				</div>
			</div>
		</div>
	);

	return createPortal(modalContent, document.body);
}

/**
 * Open the EventStoreEditor as a modal.
 * Returns a promise that resolves when the editor is closed.
 */
export function openV2EventStoreEditor(
	store: EventStore,
	messageId: number,
	swipeId: number,
	onSave: (editedStore: EventStore) => Promise<void>,
): Promise<boolean> {
	return new Promise(resolve => {
		const container = document.createElement('div');
		container.id = 'bt-v2-editor-container';
		document.body.appendChild(container);

		const cleanup = () => {
			const root = (container as any).__reactRoot;
			if (root) {
				root.unmount();
			}
			container.remove();
		};

		const handleSave = async (editedStore: EventStore) => {
			try {
				await onSave(editedStore);
				cleanup();
				resolve(true);
			} catch (e) {
				errorLog('Failed to save EventStore:', e);
				cleanup();
				resolve(false);
			}
		};

		const handleCancel = () => {
			cleanup();
			resolve(false);
		};

		// Import React DOM dynamically to avoid circular dependencies
		import('react-dom/client').then(ReactDOM => {
			const root = ReactDOM.createRoot(container);
			(container as any).__reactRoot = root;
			root.render(
				<EventStoreEditor
					store={store}
					messageId={messageId}
					swipeId={swipeId}
					onSave={handleSave}
					onCancel={handleCancel}
				/>,
			);
		});
	});
}
