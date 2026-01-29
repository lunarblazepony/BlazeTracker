// ============================================
// Narrative Modal Component
// ============================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
	NarrativeState,
	TimestampedEvent,
	Chapter,
	DerivedChapter,
	Relationship,
	DerivedRelationship,
	ProjectedRelationship,
	NarrativeEvent,
	RelationshipEvent,
	UnifiedEventStore,
} from '../../types/state';
import { isLegacyChapter, isLegacyEventStore, isUnifiedEventStore } from '../../types/state';
import {
	projectCurrentState,
	deepCloneEventStore,
	projectRelationshipsFromCurrentState,
	addStateEvent,
} from '../../state/eventStore';
import { ChapterHistory } from './ChapterHistory';
import { TensionGraph } from './TensionGraph';
import { EventList, type EventListHandle } from './EventList';
import { RelationshipsTab } from '../tabs/RelationshipsTab';
import {
	updateNarrativeEvent,
	deleteEvent,
	reProjectRelationshipsFromEvents,
	getNarrativeEventsForChapter,
	getRelationshipEventsForPair,
	updateRelationshipEvent,
	deleteStateEvent,
	promoteNextEventForMilestone,
	getEvent,
	computeMilestonesForPair as computeMilestonesForPairFn,
	computeMilestonesForEvent as computeMilestonesForEventFn,
	recomputeFirstFor,
	pairKey,
	invalidateProjectionsFrom,
	invalidateSnapshotsFrom,
} from '../../state/eventStore';
import { regenerateChapterSummary } from '../../extractors/extractChapter';

/** Union types for both legacy and derived versions */
type AnyChapter = Chapter | DerivedChapter;
type AnyRelationship = Relationship | DerivedRelationship | ProjectedRelationship;

// ============================================
// Types
// ============================================

export type TabId = 'events' | 'chapters' | 'relationships';

/** Info about deleted events for syncing with message state */
export interface DeletedEventInfo {
	messageId: number;
	summary: string;
}

export interface NarrativeModalProps {
	narrativeState: NarrativeState;
	currentEvents?: TimestampedEvent[];
	presentCharacters?: string[];
	onClose: () => void;
	onSave?: (
		state: NarrativeState,
		deletedEvents: DeletedEventInfo[],
		updatedCurrentEvents?: TimestampedEvent[],
	) => Promise<void>;
	onRefresh?: () => void;
	initialTab?: TabId;
	/** Chat length for determining latest messageId when adding events */
	chatLength?: number;
	/** Chat messages for getting swipeId per message */
	chat?: { swipe_id: number }[];
}

// ============================================
// Component
// ============================================

export function NarrativeModal({
	narrativeState,
	currentEvents = [],
	presentCharacters,
	onClose,
	onSave,
	onRefresh: _onRefresh,
	initialTab = 'chapters',
	chatLength,
	chat,
}: NarrativeModalProps) {
	const [activeTab, setActiveTab] = useState<TabId>(initialTab);
	const [editMode, setEditMode] = useState(false);
	const [saving, setSaving] = useState(false);

	// Ref to access EventList's pending edit state
	const eventListRef = useRef<EventListHandle>(null);

	// Working copies for edit mode
	const [editChapters, setEditChapters] = useState<AnyChapter[]>([]);
	const [editRelationships, setEditRelationships] = useState<AnyRelationship[]>([]);
	const [editCurrentEvents, setEditCurrentEvents] = useState<TimestampedEvent[]>([]);

	// Track deleted events for syncing back to messages
	const [deletedEvents, setDeletedEvents] = useState<DeletedEventInfo[]>([]);

	// Track chapters needing summary regeneration (by chapter index)
	const [chaptersNeedingRegeneration, setChaptersNeedingRegeneration] = useState<Set<number>>(
		new Set(),
	);

	// Version counter to force re-renders when event store is modified
	const [eventStoreVersion, setEventStoreVersion] = useState(0);

	// Temporary event store for editing (edits only committed on Save)
	const [editEventStore, setEditEventStore] = useState<UnifiedEventStore | null>(null);

	// Get event store for event-based editing
	const eventStore = narrativeState.eventStore;
	const hasEventStore = isLegacyEventStore(eventStore) || isUnifiedEventStore(eventStore);

	// Helper to find if an event's chapterIndex corresponds to a completed chapter
	// and mark it for regeneration if so
	const markChapterForRegenerationIfCompleted = useCallback(
		(event: NarrativeEvent | undefined) => {
			if (!event || event.chapterIndex === undefined) return;

			// Find the chapter by index in editChapters
			const chapter = editChapters.find(ch => ch.index === event.chapterIndex);
			if (!chapter) return;

			// A chapter is "completed" if it has an endedAt timestamp (for legacy)
			// or endMessageId (for derived)
			const isCompleted =
				('endedAt' in chapter && chapter.endedAt !== undefined) ||
				('endMessageId' in chapter && chapter.endMessageId !== undefined);

			if (isCompleted) {
				setChaptersNeedingRegeneration(prev => {
					const next = new Set(prev);
					next.add(event.chapterIndex!);
					return next;
				});
			}
		},
		[editChapters],
	);

	// Event-based editing handlers (works with both legacy and unified event stores)
	// Uses editEventStore when in edit mode for temporary changes
	const handleNarrativeEventUpdate = useCallback(
		(eventId: string, updates: Partial<NarrativeEvent>) => {
			// Use temp store during editing, fall back to real store
			const store = editEventStore ?? eventStore;
			if (!store) return;

			// Get event BEFORE update to check if eventTypes changed
			const oldEvent = getEvent(store, eventId);

			updateNarrativeEvent(store, eventId, updates);

			// If eventTypes changed, recompute milestones for affected pairs
			if (updates.eventTypes && oldEvent) {
				const affectedPairKeys = new Set(
					oldEvent.affectedPairs.map(ap => pairKey(ap.pair)),
				);
				recomputeFirstFor(store, oldEvent.messageId, affectedPairKeys);
			}

			// Re-project relationships if affectedPairs or eventTypes changed
			if (updates.affectedPairs || updates.eventTypes) {
				if (isUnifiedEventStore(store)) {
					const newRelationships =
						projectRelationshipsFromCurrentState(
							store,
							chat ?? [],
						);
					setEditRelationships(newRelationships);
				} else {
					const newRelationships =
						reProjectRelationshipsFromEvents(store);
					setEditRelationships(newRelationships);
				}
			}

			// Invalidate projections and snapshots from this event's messageId onward
			if (oldEvent && isUnifiedEventStore(store)) {
				invalidateProjectionsFrom(store, oldEvent.messageId);
				invalidateSnapshotsFrom(store, oldEvent.messageId);
			}

			// Check if this event belongs to a completed chapter and mark for regeneration
			markChapterForRegenerationIfCompleted(oldEvent ?? undefined);

			// Increment version to force UI re-render with updated event data
			setEventStoreVersion(v => v + 1);
		},
		[editEventStore, eventStore, markChapterForRegenerationIfCompleted, chat],
	);

	const handleNarrativeEventDelete = useCallback(
		(eventId: string) => {
			// Use temp store during editing, fall back to real store
			const store = editEventStore ?? eventStore;
			if (!store) return;

			const event = getEvent(store, eventId);

			// Handle milestone promotion if this event had firstFor designations
			if (event) {
				for (const ap of event.affectedPairs) {
					if (ap.firstFor?.length) {
						for (const mt of ap.firstFor) {
							promoteNextEventForMilestone(
								store,
								ap.pair,
								mt,
							);
						}
					}
				}
			}

			// Soft delete the event
			deleteEvent(store, eventId);

			// Re-project relationships using proper projection for StateEvents
			if (isUnifiedEventStore(store)) {
				const newRelationships = projectRelationshipsFromCurrentState(
					store,
					chat ?? [],
				);
				setEditRelationships(newRelationships);
			} else {
				const newRelationships = reProjectRelationshipsFromEvents(store);
				setEditRelationships(newRelationships);
			}

			// Invalidate projections and snapshots from this event's messageId onward
			if (event && isUnifiedEventStore(store)) {
				invalidateProjectionsFrom(store, event.messageId);
				invalidateSnapshotsFrom(store, event.messageId);
			}

			// Check if this event belongs to a completed chapter and mark for regeneration
			markChapterForRegenerationIfCompleted(event ?? undefined);

			// Increment version to force UI re-render
			setEventStoreVersion(v => v + 1);
		},
		[editEventStore, eventStore, markChapterForRegenerationIfCompleted, chat],
	);

	// Get events for a chapter (used by ChapterHistory in edit mode)
	// Depends on eventStoreVersion to force re-fetch when events change
	const getEventsForChapter = useCallback(
		(chapterIndex: number): NarrativeEvent[] => {
			void eventStoreVersion; // Force dependency
			const store = editEventStore ?? eventStore;
			if (!store) return [];
			return getNarrativeEventsForChapter(store, chapterIndex);
		},
		[editEventStore, eventStore, eventStoreVersion],
	);

	// Compute milestones for a pair (used by RelationshipsTab for milestone display)
	// Depends on eventStoreVersion to force re-compute when events change
	const computeMilestonesForPair = useCallback(
		(pair: [string, string]) => {
			void eventStoreVersion; // Force dependency
			const store = editEventStore ?? eventStore;
			if (!store) return [];
			return computeMilestonesForPairFn(store, pair);
		},
		[editEventStore, eventStore, eventStoreVersion],
	);

	// Compute milestones for an event (used by EventList for milestone display)
	// Depends on eventStoreVersion to force re-compute when events change
	const computeMilestonesForEvent = useCallback(
		(messageId: number) => {
			void eventStoreVersion; // Force dependency
			const store = editEventStore ?? eventStore;
			if (!store) return [];
			return computeMilestonesForEventFn(store, messageId);
		},
		[editEventStore, eventStore, eventStoreVersion],
	);

	// Get state events (RelationshipEvents) for a pair (used by RelationshipsTab in edit mode)
	// Depends on eventStoreVersion to force re-fetch when events change
	const getStateEventsForPair = useCallback(
		(pair: [string, string]): RelationshipEvent[] => {
			void eventStoreVersion; // Force dependency
			const store = editEventStore ?? eventStore;
			if (!isUnifiedEventStore(store)) return [];
			return getRelationshipEventsForPair(store, pair);
		},
		[editEventStore, eventStore, eventStoreVersion],
	);

	// Handle state event updates (RelationshipEvents)
	const handleStateEventUpdate = useCallback(
		(eventId: string, updates: Partial<RelationshipEvent>) => {
			const store = editEventStore ?? eventStore;
			if (!isUnifiedEventStore(store)) return;

			updateRelationshipEvent(store, eventId, updates);

			// Re-project relationships using proper projection for StateEvents
			const newRelationships = projectRelationshipsFromCurrentState(
				store,
				chat ?? [],
			);
			setEditRelationships(newRelationships);

			// Increment version to force UI re-render
			setEventStoreVersion(v => v + 1);
		},
		[editEventStore, eventStore, chat],
	);

	// Handle state event deletion (RelationshipEvents)
	const handleStateEventDelete = useCallback(
		(eventId: string) => {
			const store = editEventStore ?? eventStore;
			if (!isUnifiedEventStore(store)) return;

			deleteStateEvent(store, eventId);

			// Re-project relationships using proper projection for StateEvents
			const newRelationships = projectRelationshipsFromCurrentState(
				store,
				chat ?? [],
			);
			setEditRelationships(newRelationships);

			// Increment version to force UI re-render
			setEventStoreVersion(v => v + 1);
		},
		[editEventStore, eventStore, chat],
	);

	// Handle state event addition (RelationshipEvents)
	const handleStateEventAdd = useCallback(
		(event: Omit<RelationshipEvent, 'id'>) => {
			const store = editEventStore ?? eventStore;
			if (!isUnifiedEventStore(store)) return;

			addStateEvent(store, event);

			// Invalidate cached projections and snapshots from this event's messageId onward
			invalidateProjectionsFrom(store, event.messageId);
			invalidateSnapshotsFrom(store, event.messageId);

			// Re-project relationships using proper projection for StateEvents
			const newRelationships = projectRelationshipsFromCurrentState(
				store,
				chat ?? [],
			);
			setEditRelationships(newRelationships);

			// Increment version to force UI re-render
			setEventStoreVersion(v => v + 1);
		},
		[editEventStore, eventStore, chat],
	);

	// Initialize edit state when entering edit mode
	const enterEditMode = useCallback(() => {
		setEditChapters(JSON.parse(JSON.stringify(narrativeState.chapters)));

		// Create deep copy of event store for editing (changes only committed on save)
		if (isUnifiedEventStore(eventStore)) {
			const clonedStore = deepCloneEventStore(eventStore);
			setEditEventStore(clonedStore);

			// Seed edit relationships from projection
			const projectedRels = projectRelationshipsFromCurrentState(
				clonedStore,
				chat ?? [],
			);
			setEditRelationships(projectedRels);
		} else {
			setEditEventStore(null);
			setEditRelationships(
				JSON.parse(JSON.stringify(narrativeState.relationships)),
			);
		}

		setEditCurrentEvents(JSON.parse(JSON.stringify(currentEvents)));
		setDeletedEvents([]);
		setChaptersNeedingRegeneration(new Set());
		setEditMode(true);
	}, [narrativeState, currentEvents, eventStore, chat]);

	const cancelEditMode = useCallback(() => {
		// Simply discard the temporary event store (no changes to real store)
		setEditEventStore(null);
		setEditMode(false);
		setEditChapters([]);
		setEditRelationships([]);
		setEditCurrentEvents([]);
		setDeletedEvents([]);
		setChaptersNeedingRegeneration(new Set());
	}, []);

	const handleSave = useCallback(async () => {
		if (!onSave) return;

		// Get any pending event edits and apply them directly
		// (we can't rely on setState being synchronous)
		let finalCurrentEvents = editCurrentEvents;
		const pendingEdit = eventListRef.current?.getPendingEdit();
		if (pendingEdit) {
			finalCurrentEvents = [...editCurrentEvents];
			finalCurrentEvents[pendingEdit.index] = pendingEdit.event;
		}

		setSaving(true);
		try {
			// Commit editEventStore to real eventStore
			if (editEventStore && isUnifiedEventStore(eventStore)) {
				// Copy the edited events back to the real store
				eventStore.stateEvents = editEventStore.stateEvents;
				eventStore.narrativeEvents = editEventStore.narrativeEvents;
				// Copy any projection-related data
				if (editEventStore.initialProjection) {
					eventStore.initialProjection =
						editEventStore.initialProjection;
				}
				if (editEventStore.chapterSnapshots) {
					eventStore.chapterSnapshots =
						editEventStore.chapterSnapshots;
				}
				if (editEventStore.projectionInvalidFrom !== undefined) {
					eventStore.projectionInvalidFrom =
						editEventStore.projectionInvalidFrom;
				}
			}

			// Regenerate summaries for affected chapters
			// Use editEventStore (which has been committed above) or real eventStore
			const storeForRegeneration = editEventStore ?? eventStore;
			const chaptersToSave = [...editChapters];
			if (chaptersNeedingRegeneration.size > 0 && storeForRegeneration) {
				console.log(
					`[BlazeTracker] Regenerating summaries for chapters:`,
					Array.from(chaptersNeedingRegeneration),
				);

				for (const chapterIndex of chaptersNeedingRegeneration) {
					const chapterIdx = chaptersToSave.findIndex(
						ch => ch.index === chapterIndex,
					);
					if (chapterIdx === -1) continue;

					const chapter = chaptersToSave[chapterIdx];
					// Get events for this chapter
					const chapterEvents = getNarrativeEventsForChapter(
						storeForRegeneration,
						chapterIndex,
					);

					// Convert NarrativeEvents to event summaries for regeneration
					const eventSummaries = chapterEvents.map(ne => ({
						summary: ne.summary,
						tensionLevel: ne.tensionLevel,
						tensionType: ne.tensionType,
						witnesses: ne.witnesses,
					}));

					if (eventSummaries.length > 0 && isLegacyChapter(chapter)) {
						try {
							const regenerated =
								await regenerateChapterSummary({
									chapter,
									eventSummaries,
									narrativeState,
								});

							chaptersToSave[chapterIdx] = {
								...chapter,
								title: regenerated.title,
								summary: regenerated.summary,
								outcomes: regenerated.outcomes,
							};
						} catch (error) {
							console.warn(
								`[BlazeTracker] Failed to regenerate chapter ${chapterIndex}:`,
								error,
							);
						}
					}
				}
			}

			// Convert ProjectedRelationships to DerivedRelationship format for persistence
			// (ProjectedRelationship lacks milestoneEventIds and history which are needed for storage)
			const relationshipsForSave: (Relationship | DerivedRelationship)[] =
				editRelationships.map(rel => {
					// If it already has milestoneEventIds or milestones, keep as-is
					if ('milestoneEventIds' in rel || 'milestones' in rel) {
						return rel as Relationship | DerivedRelationship;
					}
					// Convert ProjectedRelationship to DerivedRelationship
					return {
						...rel,
						milestoneEventIds: [],
						history: [],
					} as DerivedRelationship;
				});

			const updatedState: NarrativeState = {
				...narrativeState,
				chapters: chaptersToSave,
				relationships: relationshipsForSave,
			};
			await onSave(updatedState, deletedEvents, finalCurrentEvents);

			// Clear temp store and exit edit mode
			setEditEventStore(null);
			setEditMode(false);
		} finally {
			setSaving(false);
		}
	}, [
		onSave,
		narrativeState,
		editChapters,
		editRelationships,
		editCurrentEvents,
		deletedEvents,
		chaptersNeedingRegeneration,
		editEventStore,
		eventStore,
	]);

	// Handle chapter updates
	const handleChaptersUpdate = useCallback(
		(chapters: AnyChapter[]) => {
			// Track deleted events from legacy chapters (DerivedChapters don't have embedded events)
			const newChapterEventIds = new Set(
				chapters.flatMap(ch =>
					isLegacyChapter(ch)
						? ch.events.map(e => `${e.messageId}-${e.summary}`)
						: [],
				),
			);
			const oldEvents = editChapters.flatMap(ch =>
				isLegacyChapter(ch) ? ch.events : [],
			);
			for (const event of oldEvents) {
				if (
					!newChapterEventIds.has(
						`${event.messageId}-${event.summary}`,
					)
				) {
					if (event.messageId !== undefined) {
						setDeletedEvents(prev => [
							...prev,
							{
								messageId: event.messageId!,
								summary: event.summary,
							},
						]);
					}
				}
			}
			setEditChapters(chapters);
		},
		[editChapters],
	);

	// Handle current events updates
	const handleCurrentEventUpdate = useCallback(
		(index: number, event: TimestampedEvent) => {
			const oldEvent = editCurrentEvents[index];

			// Update local state
			const newEvents = [...editCurrentEvents];
			newEvents[index] = event;
			setEditCurrentEvents(newEvents);

			// If the event has an ID and we have an event store, also update the store
			// This ensures milestones are recalculated when event types change
			// Check if this is a NarrativeEvent (has id property)
			const oldNarrativeEvent = oldEvent as unknown as NarrativeEvent;
			const hasEventId =
				'id' in oldEvent &&
				typeof (oldEvent as { id?: string }).id === 'string';
			if (hasEventStore && eventStore && hasEventId && oldNarrativeEvent.id) {
				// Build updates object from changed fields
				const updates: Partial<NarrativeEvent> = {};

				if (event.summary !== oldEvent.summary) {
					updates.summary = event.summary;
				}
				if (
					JSON.stringify(event.eventTypes) !==
					JSON.stringify(oldEvent.eventTypes)
				) {
					updates.eventTypes = event.eventTypes;
				}
				if (event.tensionLevel !== oldEvent.tensionLevel) {
					updates.tensionLevel = event.tensionLevel;
				}
				if (event.tensionType !== oldEvent.tensionType) {
					updates.tensionType = event.tensionType;
				}

				// Only update the store if there are actual changes
				if (Object.keys(updates).length > 0) {
					updateNarrativeEvent(
						eventStore,
						oldNarrativeEvent.id,
						updates,
					);

					// If eventTypes changed, recompute milestones for affected pairs
					if (updates.eventTypes && oldNarrativeEvent.affectedPairs) {
						const affectedPairKeys = new Set<string>(
							oldNarrativeEvent.affectedPairs.map(ap =>
								pairKey(ap.pair),
							),
						);
						recomputeFirstFor(
							eventStore,
							oldEvent.messageId ?? 0,
							affectedPairKeys,
						);
					}

					// Re-project relationships if eventTypes changed
					if (updates.eventTypes) {
						const newRelationships =
							reProjectRelationshipsFromEvents(
								eventStore,
							);
						setEditRelationships(newRelationships);
					}

					// Invalidate projections and snapshots
					if (
						isUnifiedEventStore(eventStore) &&
						oldEvent.messageId !== undefined
					) {
						invalidateProjectionsFrom(
							eventStore,
							oldEvent.messageId,
						);
						invalidateSnapshotsFrom(
							eventStore,
							oldEvent.messageId,
						);
					}

					// Force UI re-render
					setEventStoreVersion(v => v + 1);
				}
			}
		},
		[editCurrentEvents, eventStore, hasEventStore],
	);

	const handleCurrentEventDelete = useCallback(
		(index: number) => {
			const event = editCurrentEvents[index];
			if (event.messageId !== undefined) {
				setDeletedEvents(prev => [
					...prev,
					{ messageId: event.messageId!, summary: event.summary },
				]);
			}
			setEditCurrentEvents(editCurrentEvents.filter((_, i) => i !== index));
		},
		[editCurrentEvents],
	);

	// Close on escape key (only if not in edit mode)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !editMode) {
				onClose();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [onClose, editMode]);

	// Prevent scrolling of body while modal is open
	useEffect(() => {
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
	}, []);

	// Use edit state or original state based on mode
	const displayChapters = editMode ? editChapters : narrativeState.chapters;

	// In view mode, use projected relationships from current state
	// In edit mode, use the edit copy (which is also seeded from projection)
	let displayRelationships: AnyRelationship[];
	if (editMode) {
		displayRelationships = editRelationships;
	} else if (isUnifiedEventStore(eventStore)) {
		// Get current projection for live view
		const projection = projectCurrentState(eventStore, chat ?? []);
		displayRelationships = Array.from(projection.relationships.values());
		console.log(
			`[BlazeTracker] NarrativeModal: projection.relationships.size =`,
			projection.relationships.size,
			'relationships:',
			displayRelationships.map(r => ({ pair: r.pair, status: r.status })),
		);
		// Also log the relationship events
		const relEvents = eventStore.stateEvents.filter(
			e => e.kind === 'relationship' && !e.deleted,
		);
		console.log(
			`[BlazeTracker] NarrativeModal: ${relEvents.length} relationship events in store`,
		);
	} else {
		displayRelationships = narrativeState.relationships;
	}

	const displayCurrentEvents = editMode ? editCurrentEvents : currentEvents;

	// Get all events from all chapters (handles both legacy and derived chapters)
	const allChapterEvents = displayChapters.flatMap(ch => {
		if (isLegacyChapter(ch)) {
			return ch.events;
		}
		// For derived chapters, events are in the event store, but we don't have access here
		// Return empty for now - the TensionGraph will need to be updated to use event store
		return [];
	});
	// All events for tension graph (including current)
	const allEvents = [...allChapterEvents, ...displayCurrentEvents];

	// Render to body via portal to avoid container positioning issues
	return createPortal(
		<div
			className="bt-modal-overlay"
			onClick={e => {
				if (e.target === e.currentTarget && !editMode) onClose();
			}}
		>
			<div className="bt-modal-container bt-narrative-modal">
				{/* Header */}
				<div className="bt-modal-header">
					<h2>
						{editMode
							? 'Editing Narrative'
							: 'Narrative Overview'}
					</h2>
					<div className="bt-modal-header-actions">
						{editMode ? (
							<>
								<button
									className="bt-btn bt-btn-secondary"
									onClick={cancelEditMode}
									disabled={saving}
								>
									Cancel
								</button>
								<button
									className="bt-btn bt-btn-primary"
									onClick={handleSave}
									disabled={saving}
								>
									{saving ? (
										<>
											<i className="fa-solid fa-spinner fa-spin"></i>
											Saving...
										</>
									) : (
										<>
											<i className="fa-solid fa-check"></i>
											Save
										</>
									)}
								</button>
							</>
						) : (
							onSave && (
								<button
									className="bt-btn bt-btn-secondary"
									onClick={enterEditMode}
									title="Enable editing of narrative state"
								>
									<i className="fa-solid fa-pen"></i>
									Enable Editing
								</button>
							)
						)}
						{!editMode && (
							<button
								className="bt-modal-close"
								onClick={onClose}
							>
								<i className="fa-solid fa-xmark"></i>
							</button>
						)}
					</div>
				</div>

				{/* Tabs */}
				<div className="bt-modal-tabs">
					<button
						className={`bt-tab ${activeTab === 'events' ? 'bt-tab-active' : ''}`}
						onClick={() => setActiveTab('events')}
					>
						<i className="fa-solid fa-bolt"></i>
						<span>Events ({displayCurrentEvents.length})</span>
					</button>
					<button
						className={`bt-tab ${activeTab === 'chapters' ? 'bt-tab-active' : ''}`}
						onClick={() => setActiveTab('chapters')}
					>
						<i className="fa-solid fa-book"></i>
						<span>Chapters ({displayChapters.length})</span>
					</button>
					<button
						className={`bt-tab ${activeTab === 'relationships' ? 'bt-tab-active' : ''}`}
						onClick={() => setActiveTab('relationships')}
					>
						<i className="fa-solid fa-heart"></i>
						<span>
							Relationships ({displayRelationships.length}
							)
						</span>
					</button>
				</div>

				{/* Tab Content */}
				<div className="bt-modal-content">
					{activeTab === 'events' && (
						<div className="bt-events-tab-content">
							{displayCurrentEvents.length > 0 ? (
								<EventList
									ref={eventListRef}
									events={
										displayCurrentEvents
									}
									presentCharacters={
										presentCharacters
									}
									editMode={editMode}
									onUpdate={
										handleCurrentEventUpdate
									}
									onDelete={
										handleCurrentEventDelete
									}
									computeMilestonesForEvent={
										computeMilestonesForEvent
									}
								/>
							) : (
								<p className="bt-empty-message">
									No events recorded yet.
								</p>
							)}
						</div>
					)}

					{activeTab === 'chapters' && (
						<div className="bt-chapters-tab-content">
							{/* Tension Graph (if there are events) */}
							{allEvents.length > 0 && !editMode && (
								<div className="bt-tension-graph-section">
									<h3>
										<i className="fa-solid fa-chart-line"></i>
										Tension Over Time
									</h3>
									<TensionGraph
										events={allEvents}
									/>
								</div>
							)}

							{/* Chapter History */}
							<ChapterHistory
								chapters={displayChapters}
								editMode={editMode}
								onUpdate={handleChaptersUpdate}
								hasEventStore={hasEventStore}
								getEventsForChapter={
									getEventsForChapter
								}
								onEventUpdate={
									handleNarrativeEventUpdate
								}
								onEventDelete={
									handleNarrativeEventDelete
								}
								chaptersNeedingRegeneration={
									chaptersNeedingRegeneration
								}
							/>
						</div>
					)}

					{activeTab === 'relationships' && (
						<RelationshipsTab
							relationships={displayRelationships}
							presentCharacters={presentCharacters}
							editMode={editMode}
							onUpdate={setEditRelationships}
							hasEventStore={hasEventStore}
							getStateEventsForPair={
								getStateEventsForPair
							}
							computeMilestonesForPair={
								computeMilestonesForPair
							}
							onStateEventUpdate={handleStateEventUpdate}
							onStateEventDelete={handleStateEventDelete}
							onStateEventAdd={handleStateEventAdd}
							chatLength={chatLength}
							chat={chat}
						/>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}
