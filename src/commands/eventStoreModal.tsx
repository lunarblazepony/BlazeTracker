/**
 * Event Store Modal
 *
 * A modal to browse and inspect all events in the V2 event store.
 * Shows canonical vs non-canonical events, deleted events, etc.
 */

import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import type { EventStore } from '../v2/store/EventStore';
import type { Event, EventKind } from '../v2/types/event';
import type { SwipeContext } from '../v2/store/projection';
import { V2EventCard } from '../v2/ui/components/V2EventCard';

export interface EventStoreModalProps {
	store: EventStore;
	swipeContext: SwipeContext;
	onClose: () => void;
}

type FilterMode = 'all' | 'canonical' | 'deleted';
type SortMode = 'message' | 'timestamp' | 'kind';

const EVENT_KINDS: EventKind[] = [
	'time',
	'location',
	'forecast_generated',
	'character',
	'relationship',
	'topic_tone',
	'tension',
	'narrative_description',
	'chapter',
];

function EventStoreModal({ store, swipeContext, onClose }: EventStoreModalProps) {
	const [filterMode, setFilterMode] = useState<FilterMode>('all');
	const [sortMode, setSortMode] = useState<SortMode>('message');
	const [kindFilter, setKindFilter] = useState<EventKind | 'all'>('all');
	const [messageFilter, setMessageFilter] = useState<string>('');

	// Get all events from the store
	const allEvents = useMemo(() => {
		return [...store.events];
	}, [store]);

	// Filter and sort events
	const filteredEvents = useMemo(() => {
		let events = allEvents;

		// Filter by mode
		if (filterMode === 'canonical') {
			events = events.filter(e => {
				if (e.deleted) return false;
				const canonicalSwipe = swipeContext.getCanonicalSwipeId(
					e.source.messageId,
				);
				return e.source.swipeId === canonicalSwipe;
			});
		} else if (filterMode === 'deleted') {
			events = events.filter(e => e.deleted);
		}

		// Filter by kind
		if (kindFilter !== 'all') {
			events = events.filter(e => e.kind === kindFilter);
		}

		// Filter by message ID
		if (messageFilter) {
			const msgId = parseInt(messageFilter, 10);
			if (!isNaN(msgId)) {
				events = events.filter(e => e.source.messageId === msgId);
			}
		}

		// Sort events
		if (sortMode === 'message') {
			events = [...events].sort((a, b) => {
				const msgDiff = a.source.messageId - b.source.messageId;
				if (msgDiff !== 0) return msgDiff;
				return a.timestamp - b.timestamp;
			});
		} else if (sortMode === 'timestamp') {
			events = [...events].sort((a, b) => a.timestamp - b.timestamp);
		} else if (sortMode === 'kind') {
			events = [...events].sort((a, b) => {
				const kindDiff = a.kind.localeCompare(b.kind);
				if (kindDiff !== 0) return kindDiff;
				return a.source.messageId - b.source.messageId;
			});
		}

		return events;
	}, [allEvents, filterMode, sortMode, kindFilter, messageFilter, swipeContext]);

	// Calculate stats
	const stats = useMemo(() => {
		const total = allEvents.length;
		const deleted = allEvents.filter(e => e.deleted).length;
		const canonical = allEvents.filter(e => {
			if (e.deleted) return false;
			const canonicalSwipe = swipeContext.getCanonicalSwipeId(e.source.messageId);
			return e.source.swipeId === canonicalSwipe;
		}).length;
		const nonCanonical = total - deleted - canonical;

		return { total, deleted, canonical, nonCanonical };
	}, [allEvents, swipeContext]);

	// Check if event is canonical
	const isCanonical = (event: Event): boolean => {
		if (event.deleted) return false;
		const canonicalSwipe = swipeContext.getCanonicalSwipeId(event.source.messageId);
		return event.source.swipeId === canonicalSwipe;
	};

	const modalContent = (
		<div className="bt-event-store-overlay" onClick={onClose}>
			<div className="bt-event-store-modal" onClick={e => e.stopPropagation()}>
				{/* Header */}
				<div className="bt-event-store-header">
					<h3>
						<i className="fa-solid fa-database"></i>
						Event Store
					</h3>
					<button className="bt-close-btn" onClick={onClose}>
						<i className="fa-solid fa-times"></i>
					</button>
				</div>

				{/* Stats */}
				<div className="bt-event-store-stats">
					<div className="bt-stat">
						<span className="bt-stat-value">{stats.total}</span>
						<span className="bt-stat-label">Total</span>
					</div>
					<div className="bt-stat bt-stat-canonical">
						<span className="bt-stat-value">
							{stats.canonical}
						</span>
						<span className="bt-stat-label">Canonical</span>
					</div>
					<div className="bt-stat bt-stat-noncanonical">
						<span className="bt-stat-value">
							{stats.nonCanonical}
						</span>
						<span className="bt-stat-label">Non-Canonical</span>
					</div>
					<div className="bt-stat bt-stat-deleted">
						<span className="bt-stat-value">
							{stats.deleted}
						</span>
						<span className="bt-stat-label">Deleted</span>
					</div>
				</div>

				{/* Filters */}
				<div className="bt-event-store-filters">
					<div className="bt-filter-group">
						<label>Filter:</label>
						<select
							value={filterMode}
							onChange={e =>
								setFilterMode(
									e.target
										.value as FilterMode,
								)
							}
						>
							<option value="all">All Events</option>
							<option value="canonical">
								Canonical Only
							</option>
							<option value="deleted">
								Deleted Only
							</option>
						</select>
					</div>

					<div className="bt-filter-group">
						<label>Kind:</label>
						<select
							value={kindFilter}
							onChange={e =>
								setKindFilter(
									e.target.value as
										| EventKind
										| 'all',
								)
							}
						>
							<option value="all">All Kinds</option>
							{EVENT_KINDS.map(kind => (
								<option key={kind} value={kind}>
									{kind}
								</option>
							))}
						</select>
					</div>

					<div className="bt-filter-group">
						<label>Message:</label>
						<input
							type="text"
							value={messageFilter}
							onChange={e =>
								setMessageFilter(e.target.value)
							}
							placeholder="Message ID"
							style={{ width: '80px' }}
						/>
					</div>

					<div className="bt-filter-group">
						<label>Sort:</label>
						<select
							value={sortMode}
							onChange={e =>
								setSortMode(
									e.target.value as SortMode,
								)
							}
						>
							<option value="message">By Message</option>
							<option value="timestamp">
								By Timestamp
							</option>
							<option value="kind">By Kind</option>
						</select>
					</div>
				</div>

				{/* Event List */}
				<div className="bt-event-store-list">
					{filteredEvents.length === 0 ? (
						<div className="bt-no-events">
							No events match the current filters.
						</div>
					) : (
						<div className="bt-events-grid">
							{filteredEvents.map(event => (
								<div
									key={event.id}
									className={`bt-event-wrapper ${
										event.deleted
											? 'bt-deleted-event'
											: isCanonical(
														event,
												  )
												? 'bt-canonical-event'
												: 'bt-noncanonical-event'
									}`}
								>
									<div className="bt-event-badge">
										{event.deleted
											? 'Deleted'
											: isCanonical(
														event,
												  )
												? 'Canonical'
												: 'Non-Canonical'}
									</div>
									<V2EventCard
										event={event}
										isEditable={false}
									/>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="bt-event-store-footer">
					<span className="bt-showing-count">
						Showing {filteredEvents.length} of {stats.total}{' '}
						events
					</span>
					<button className="bt-close-btn-footer" onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</div>
	);

	return createPortal(modalContent, document.body);
}

// Modal management
let modalRoot: ReactDOM.Root | null = null;
let modalContainer: HTMLElement | null = null;

function closeModal(): void {
	if (modalRoot) {
		modalRoot.unmount();
		modalRoot = null;
	}
	if (modalContainer) {
		modalContainer.remove();
		modalContainer = null;
	}
}

/**
 * Open the event store modal.
 */
export function openEventStoreModal(store: EventStore, swipeContext: SwipeContext): void {
	// Close existing modal if any
	closeModal();

	// Create container
	modalContainer = document.createElement('div');
	modalContainer.id = 'bt-event-store-modal-container';
	document.body.appendChild(modalContainer);

	// Create root and render
	modalRoot = ReactDOM.createRoot(modalContainer);
	modalRoot.render(
		<EventStoreModal store={store} swipeContext={swipeContext} onClose={closeModal} />,
	);
}
