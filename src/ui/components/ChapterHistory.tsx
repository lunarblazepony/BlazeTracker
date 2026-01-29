// ============================================
// Chapter History Component
// ============================================

import React, { useState } from 'react';
import type {
	Chapter,
	DerivedChapter,
	NarrativeDateTime,
	TimestampedEvent,
	NarrativeEvent,
} from '../../types/state';
import { isLegacyChapter, isDerivedChapter } from '../../types/state';
import { EventList } from './EventList';
import { NarrativeEventCard } from './NarrativeEventCard';

/** Union type for both legacy and derived chapters */
type AnyChapter = Chapter | DerivedChapter;

// ============================================
// Types
// ============================================

interface ChapterHistoryProps {
	chapters: AnyChapter[];
	editMode?: boolean;
	onUpdate?: (chapters: AnyChapter[]) => void;
	/** Whether the narrative state has an event store */
	hasEventStore?: boolean;
	/** Get narrative events for a chapter index */
	getEventsForChapter?: (chapterIndex: number) => NarrativeEvent[];
	/** Update a narrative event */
	onEventUpdate?: (eventId: string, updates: Partial<NarrativeEvent>) => void;
	/** Delete a narrative event */
	onEventDelete?: (eventId: string) => void;
	/** Chapters that need summary regeneration on save */
	chaptersNeedingRegeneration?: Set<number>;
}

interface ChapterCardProps {
	chapter: AnyChapter;
	isExpanded: boolean;
	onToggle: () => void;
	editMode?: boolean;
	onUpdateChapter?: (chapter: AnyChapter) => void;
	onDeleteChapter?: () => void;
	onUpdateEvent?: (eventIndex: number, event: TimestampedEvent) => void;
	onDeleteEvent?: (eventIndex: number) => void;
	/** Narrative events from event store (for DerivedChapters) */
	narrativeEvents?: NarrativeEvent[];
	/** Update a narrative event */
	onNarrativeEventUpdate?: (eventId: string, updates: Partial<NarrativeEvent>) => void;
	/** Delete a narrative event */
	onNarrativeEventDelete?: (eventId: string) => void;
	/** Whether this chapter needs summary regeneration on save */
	needsRegeneration?: boolean;
}

// ============================================
// Helpers
// ============================================

function formatChapterTime(dt: NarrativeDateTime): string {
	const hour12 = dt.hour % 12 || 12;
	const ampm = dt.hour < 12 ? 'AM' : 'PM';
	const minute = dt.minute.toString().padStart(2, '0');

	const dayAbbrev: Record<string, string> = {
		Monday: 'Mon',
		Tuesday: 'Tue',
		Wednesday: 'Wed',
		Thursday: 'Thu',
		Friday: 'Fri',
		Saturday: 'Sat',
		Sunday: 'Sun',
	};

	const day = dayAbbrev[dt.dayOfWeek] || dt.dayOfWeek.slice(0, 3);
	return `${day} ${hour12}:${minute} ${ampm}`;
}

function formatTimeRange(start: NarrativeDateTime, end: NarrativeDateTime): string {
	const startStr = formatChapterTime(start);
	const endStr = formatChapterTime(end);

	// If same day, simplify
	if (start.dayOfWeek === end.dayOfWeek) {
		const startTime = `${start.hour % 12 || 12}:${start.minute.toString().padStart(2, '0')} ${start.hour < 12 ? 'AM' : 'PM'}`;
		const endTime = `${end.hour % 12 || 12}:${end.minute.toString().padStart(2, '0')} ${end.hour < 12 ? 'AM' : 'PM'}`;
		const dayAbbrev: Record<string, string> = {
			Monday: 'Mon',
			Tuesday: 'Tue',
			Wednesday: 'Wed',
			Thursday: 'Thu',
			Friday: 'Fri',
			Saturday: 'Sat',
			Sunday: 'Sun',
		};
		const day = dayAbbrev[start.dayOfWeek] || start.dayOfWeek.slice(0, 3);
		return `${day} ${startTime} - ${endTime}`;
	}

	return `${startStr} - ${endStr}`;
}

// ============================================
// Components
// ============================================

function ChapterCard({
	chapter,
	isExpanded,
	onToggle,
	editMode,
	onUpdateChapter,
	onDeleteChapter,
	onUpdateEvent,
	onDeleteEvent,
	narrativeEvents,
	onNarrativeEventUpdate,
	onNarrativeEventDelete,
	needsRegeneration,
}: ChapterCardProps) {
	const [editingTitle, setEditingTitle] = useState(chapter.title);
	const [editingSummary, setEditingSummary] = useState(chapter.summary);

	const hasOutcomes =
		chapter.outcomes &&
		(chapter.outcomes.relationshipChanges.length > 0 ||
			chapter.outcomes.secretsRevealed.length > 0);

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setEditingTitle(e.target.value);
	};

	const handleTitleBlur = () => {
		if (onUpdateChapter && editingTitle !== chapter.title) {
			onUpdateChapter({ ...chapter, title: editingTitle });
		}
	};

	const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setEditingSummary(e.target.value);
	};

	const handleSummaryBlur = () => {
		if (onUpdateChapter && editingSummary !== chapter.summary) {
			onUpdateChapter({ ...chapter, summary: editingSummary });
		}
	};

	return (
		<div className={`bt-chapter-card ${isExpanded ? 'bt-expanded' : ''}`}>
			<div
				className="bt-chapter-header"
				onClick={editMode ? undefined : onToggle}
			>
				<div className="bt-chapter-number">
					<i className="fa-solid fa-bookmark" />
					<span>Chapter {chapter.index + 1}</span>
				</div>
				{editMode ? (
					<input
						type="text"
						className="bt-chapter-title-input"
						value={editingTitle}
						onChange={handleTitleChange}
						onBlur={handleTitleBlur}
						onClick={e => e.stopPropagation()}
					/>
				) : (
					<div className="bt-chapter-title">{chapter.title}</div>
				)}
				<div className="bt-chapter-time">
					{formatTimeRange(
						chapter.timeRange.start,
						chapter.timeRange.end,
					)}
				</div>
				{/* Regeneration indicator */}
				{editMode && needsRegeneration && (
					<span
						className="bt-regeneration-pending"
						title="Summary will be regenerated on save"
					>
						Will regenerate
					</span>
				)}
				{editMode && (
					<button
						type="button"
						className="bt-delete-btn-small"
						onClick={e => {
							e.stopPropagation();
							onDeleteChapter?.();
						}}
						title="Delete chapter"
					>
						<i className="fa-solid fa-trash"></i>
					</button>
				)}
				<i
					className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} bt-expand-icon`}
					onClick={editMode ? onToggle : undefined}
				/>
			</div>

			{isExpanded && (
				<div className="bt-chapter-details">
					{/* Summary */}
					<div className="bt-chapter-summary">
						<div className="bt-section-header">
							<i className="fa-solid fa-align-left" />{' '}
							Summary
						</div>
						{editMode ? (
							<textarea
								className="bt-chapter-summary-input"
								value={editingSummary}
								onChange={handleSummaryChange}
								onBlur={handleSummaryBlur}
								rows={3}
							/>
						) : (
							<p>{chapter.summary}</p>
						)}
					</div>

					{/* Primary Location */}
					{chapter.primaryLocation && (
						<div className="bt-chapter-location">
							<div className="bt-section-header">
								<i className="fa-solid fa-location-dot" />{' '}
								Location
							</div>
							<p>{chapter.primaryLocation}</p>
						</div>
					)}

					{/* Outcomes */}
					{hasOutcomes && chapter.outcomes && (
						<div className="bt-chapter-outcomes">
							<div className="bt-section-header">
								<i className="fa-solid fa-flag-checkered" />{' '}
								Outcomes
							</div>

							{chapter.outcomes.relationshipChanges
								.length > 0 && (
								<div className="bt-outcome-group">
									<span className="bt-outcome-label">
										Relationship
										Changes:
									</span>
									<ul>
										{chapter.outcomes.relationshipChanges.map(
											(
												change,
												i,
											) => (
												<li
													key={
														i
													}
												>
													{
														change
													}
												</li>
											),
										)}
									</ul>
								</div>
							)}

							{chapter.outcomes.secretsRevealed.length >
								0 && (
								<div className="bt-outcome-group">
									<span className="bt-outcome-label">
										Secrets Revealed:
									</span>
									<ul>
										{chapter.outcomes.secretsRevealed.map(
											(
												secret,
												i,
											) => (
												<li
													key={
														i
													}
												>
													{
														secret
													}
												</li>
											),
										)}
									</ul>
								</div>
							)}
						</div>
					)}

					{/* Archived Events (only for legacy chapters with embedded events) */}
					{isLegacyChapter(chapter) && chapter.events.length > 0 && (
						<div className="bt-chapter-events">
							<div className="bt-section-header">
								<i className="fa-solid fa-list" />{' '}
								Events ({chapter.events.length})
							</div>
							{editMode ? (
								<EventList
									events={chapter.events}
									editMode={true}
									onUpdate={onUpdateEvent}
									onDelete={onDeleteEvent}
								/>
							) : (
								<ul className="bt-events-list">
									{chapter.events.map(
										(event, i) => (
											<li
												key={
													i
												}
												className="bt-archived-event"
											>
												<span className="bt-event-time">
													{formatChapterTime(
														event.timestamp,
													)}
												</span>
												<span className="bt-event-summary">
													{
														event.summary
													}
												</span>
												<span className="bt-event-tension">
													(
													{
														event.tensionLevel
													}{' '}
													{
														event.tensionType
													}

													)
												</span>
											</li>
										),
									)}
								</ul>
							)}
						</div>
					)}

					{/* Event Store Events (for DerivedChapters in edit mode) */}
					{editMode &&
						isDerivedChapter(chapter) &&
						narrativeEvents &&
						narrativeEvents.length > 0 && (
							<div className="bt-chapter-events bt-derived-events">
								<div className="bt-section-header">
									<i className="fa-solid fa-bolt" />{' '}
									Events (
									{narrativeEvents.length})
								</div>
								<div className="bt-events-list-compact">
									{narrativeEvents.map(
										event => (
											<NarrativeEventCard
												key={
													event.id
												}
												event={
													event
												}
												compact
												onUpdate={
													onNarrativeEventUpdate
														? updates =>
																onNarrativeEventUpdate(
																	event.id,
																	updates,
																)
														: undefined
												}
												onDelete={
													onNarrativeEventDelete
														? () =>
																onNarrativeEventDelete(
																	event.id,
																)
														: undefined
												}
											/>
										),
									)}
								</div>
							</div>
						)}
				</div>
			)}
		</div>
	);
}

export function ChapterHistory({
	chapters,
	editMode,
	onUpdate,
	hasEventStore,
	getEventsForChapter,
	onEventUpdate,
	onEventDelete,
	chaptersNeedingRegeneration,
}: ChapterHistoryProps) {
	const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

	const toggleExpanded = (index: number) => {
		setExpandedIds(prev => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	};

	const expandAll = () => {
		setExpandedIds(new Set(chapters.map(c => c.index)));
	};

	const collapseAll = () => {
		setExpandedIds(new Set());
	};

	const handleUpdateChapter = (chapterIndex: number, updatedChapter: AnyChapter) => {
		if (onUpdate) {
			const newChapters = chapters.map(ch =>
				ch.index === chapterIndex ? updatedChapter : ch,
			);
			onUpdate(newChapters);
		}
	};

	const handleDeleteChapter = (chapterIndex: number) => {
		if (onUpdate) {
			const newChapters = chapters.filter(ch => ch.index !== chapterIndex);
			// Re-index remaining chapters
			const reindexedChapters = newChapters.map((ch, idx) => ({
				...ch,
				index: idx,
			}));
			onUpdate(reindexedChapters);
		}
	};

	const handleUpdateEvent = (
		chapterIndex: number,
		eventIndex: number,
		event: TimestampedEvent,
	) => {
		if (onUpdate) {
			const newChapters = chapters.map(ch => {
				if (ch.index === chapterIndex && isLegacyChapter(ch)) {
					const newEvents = [...ch.events];
					newEvents[eventIndex] = event;
					return { ...ch, events: newEvents };
				}
				return ch;
			});
			onUpdate(newChapters);
		}
	};

	const handleDeleteEvent = (chapterIndex: number, eventIndex: number) => {
		if (onUpdate) {
			const newChapters = chapters.map(ch => {
				if (ch.index === chapterIndex && isLegacyChapter(ch)) {
					const newEvents = ch.events.filter(
						(_, i) => i !== eventIndex,
					);
					return { ...ch, events: newEvents };
				}
				return ch;
			});
			onUpdate(newChapters);
		}
	};

	if (chapters.length === 0) {
		return (
			<div className="bt-chapter-history bt-empty">
				<p>No chapters recorded yet.</p>
			</div>
		);
	}

	// Show chapters in reverse order (most recent first)
	const sortedChapters = [...chapters].sort((a, b) => b.index - a.index);

	return (
		<div className="bt-chapter-history">
			{/* Controls */}
			{chapters.length > 1 && (
				<div className="bt-chapter-controls">
					<button className="bt-btn bt-btn-small" onClick={expandAll}>
						<i className="fa-solid fa-angles-down" /> Expand All
					</button>
					<button
						className="bt-btn bt-btn-small"
						onClick={collapseAll}
					>
						<i className="fa-solid fa-angles-up" /> Collapse All
					</button>
					<span className="bt-chapter-count">
						{chapters.length} chapter
						{chapters.length !== 1 ? 's' : ''}
					</span>
				</div>
			)}

			{/* Chapter list */}
			<div className="bt-chapter-list">
				{sortedChapters.map(chapter => {
					// Get events for DerivedChapter when editing
					const chapterEvents =
						editMode &&
						hasEventStore &&
						getEventsForChapter &&
						isDerivedChapter(chapter)
							? getEventsForChapter(chapter.index)
							: undefined;

					return (
						<ChapterCard
							key={chapter.index}
							chapter={chapter}
							isExpanded={expandedIds.has(chapter.index)}
							onToggle={() =>
								toggleExpanded(chapter.index)
							}
							editMode={editMode}
							onUpdateChapter={ch =>
								handleUpdateChapter(
									chapter.index,
									ch,
								)
							}
							onDeleteChapter={() =>
								handleDeleteChapter(chapter.index)
							}
							onUpdateEvent={(evtIdx, evt) =>
								handleUpdateEvent(
									chapter.index,
									evtIdx,
									evt,
								)
							}
							onDeleteEvent={evtIdx =>
								handleDeleteEvent(
									chapter.index,
									evtIdx,
								)
							}
							narrativeEvents={chapterEvents}
							onNarrativeEventUpdate={onEventUpdate}
							onNarrativeEventDelete={onEventDelete}
							needsRegeneration={chaptersNeedingRegeneration?.has(
								chapter.index,
							)}
						/>
					);
				})}
			</div>
		</div>
	);
}
