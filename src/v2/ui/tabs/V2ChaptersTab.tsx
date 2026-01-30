/**
 * V2 Chapters Tab
 *
 * Displays chapters with tension graph and expandable chapter list.
 * Uses computed chapter data from snapshots + events.
 * Chapters appear newest first, with the newest auto-expanded.
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Projection, NarrativeEvent } from '../../types/snapshot';
import type { EventStore } from '../../store/EventStore';
import type { SwipeContext } from '../../store/projection';
import { V2TensionGraph } from '../components/V2TensionGraph';
import { computeAllChapters, type ComputedChapter } from '../../narrative/computeChapters';
import { getMilestoneDisplayName } from '../../store/projection';

export interface V2ChaptersTabProps {
	projection: Projection;
	eventStore: EventStore;
	swipeContext: SwipeContext;
	timeFormat?: '12h' | '24h';
	/** Callback when manual recalculation is requested */
	onRecalculateChapter?: (chapterIndex: number) => Promise<void>;
	/** Target chapter to scroll to and highlight (for "Read full summary") */
	targetChapter?: number;
}

/**
 * Format narrative time for display.
 */
function formatNarrativeTime(time: moment.Moment | null, timeFormat: '12h' | '24h'): string {
	if (!time) return '';
	if (timeFormat === '24h') {
		return time.format('ddd, MMM D [at] HH:mm');
	}
	const hour12 = time.hour() % 12 || 12;
	const ampm = time.hour() < 12 ? 'AM' : 'PM';
	const minute = time.minute().toString().padStart(2, '0');
	return `${time.format('ddd, MMM D')} at ${hour12}:${minute} ${ampm}`;
}

/**
 * Single narrative event item (matches V2EventsTab style).
 * Note: Tension icons removed from chapter events - tension data is not reliably computed.
 */
function NarrativeEventItem({
	event,
	timeFormat,
}: {
	event: NarrativeEvent;
	timeFormat: '12h' | '24h';
}) {
	return (
		<div className="bt-event-item">
			{/* Row 1: Time only (no tension icons) */}
			<div className="bt-event-header">
				<span className="bt-event-time">
					{formatNarrativeTime(event.narrativeTime, timeFormat)}
				</span>
			</div>

			{/* Row 2: Description */}
			<div className="bt-event-summary">{event.description}</div>

			{/* Row 3: Location */}
			{event.location && (
				<div className="bt-event-location">
					<i className="fa-solid fa-location-dot" />
					<span>{event.location}</span>
				</div>
			)}

			{/* Row 4: Witnesses */}
			{event.witnesses.length > 0 && (
				<div className="bt-event-footer">
					<div className="bt-event-people">
						<div className="bt-event-witnesses">
							<span className="bt-witnesses-label">
								Witnesses:
							</span>
							{event.witnesses.map((w, i) => (
								<span
									key={i}
									className="bt-witness"
								>
									{w}
								</span>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Milestones */}
			{event.subjects.filter(s => s.isMilestone).length > 0 && (
				<div className="bt-event-milestones">
					{event.subjects
						.filter(s => s.isMilestone)
						.map((subject, idx) => (
							<span
								key={idx}
								className="bt-event-milestone"
							>
								<i className="fa-solid fa-star" />
								{subject.pair.join(' & ')}:{' '}
								{subject.subject}
								{subject.milestoneDescription && (
									<span className="bt-milestone-desc">
										{' '}
										-{' '}
										{
											subject.milestoneDescription
										}
									</span>
								)}
							</span>
						))}
				</div>
			)}
		</div>
	);
}

/**
 * Single expandable chapter card.
 */
function ChapterCard({
	chapter,
	isCurrentChapter,
	isExpanded,
	isHighlighted,
	onToggle,
	eventStore,
	swipeContext,
	timeFormat,
	onRecalculate,
	isRecalculating,
}: {
	chapter: ComputedChapter;
	isCurrentChapter: boolean;
	isExpanded: boolean;
	isHighlighted?: boolean;
	onToggle: () => void;
	eventStore: EventStore;
	swipeContext: SwipeContext;
	timeFormat: '12h' | '24h';
	onRecalculate?: () => void;
	isRecalculating?: boolean;
}) {
	// Format end reason for display
	const formatEndReason = (reason: string | null): string => {
		if (!reason) return '';
		switch (reason) {
			case 'location_change':
				return 'Location change';
			case 'time_jump':
				return 'Time jump';
			case 'both':
				return 'Location & time change';
			case 'manual':
				return 'Manual';
			default:
				return reason;
		}
	};

	// Split summary into paragraphs
	const summaryParagraphs = chapter.summary
		? chapter.summary.split('\n\n').filter(p => p.trim())
		: [];

	// Reverse events to show newest first
	const eventsNewestFirst = [...chapter.narrativeEvents].reverse();

	return (
		<div
			className={`bt-v2-chapter-card ${isExpanded ? 'bt-expanded' : ''} ${isCurrentChapter ? 'bt-current' : ''} ${isHighlighted ? 'bt-highlighted' : ''}`}
		>
			{/* Header - always visible, clickable */}
			<div className="bt-v2-chapter-header" onClick={onToggle}>
				<span className="bt-v2-chapter-index">Ch. {chapter.index + 1}</span>
				<span className="bt-v2-chapter-title">{chapter.title}</span>
				{isCurrentChapter && (
					<span className="bt-v2-chapter-current-badge">
						<i className="fa-solid fa-pen" />
						Current
					</span>
				)}
				<button
					className="bt-v2-chapter-expand-btn"
					onClick={e => {
						e.stopPropagation();
						onToggle();
					}}
					aria-label={isExpanded ? 'Collapse' : 'Expand'}
				>
					<i
						className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}
					/>
				</button>
			</div>

			{/* Summary - always visible */}
			{summaryParagraphs.length > 0 && (
				<div className="bt-v2-chapter-description">
					{summaryParagraphs.map((para, i) => (
						<p key={i}>{para}</p>
					))}
				</div>
			)}

			{/* Stats row - always visible */}
			<div className="bt-v2-chapter-stats-row">
				<span className="bt-v2-chapter-stat">
					<i className="fa-solid fa-scroll" />
					<span>
						{chapter.eventCount} event
						{chapter.eventCount !== 1 ? 's' : ''}
					</span>
				</span>
				{chapter.milestones.length > 0 && (
					<span className="bt-v2-chapter-stat bt-milestone-stat">
						<i className="fa-solid fa-star" />
						<span>
							{chapter.milestones.length} milestone
							{chapter.milestones.length !== 1 ? 's' : ''}
						</span>
					</span>
				)}
				{chapter.endReason && (
					<span className="bt-v2-chapter-stat bt-end-reason">
						<i className="fa-solid fa-flag-checkered" />
						<span>{formatEndReason(chapter.endReason)}</span>
					</span>
				)}
				{/* Recalculate button - only for completed chapters, not current */}
				{!isCurrentChapter && onRecalculate && (
					<button
						className="bt-v2-chapter-recalc-btn"
						onClick={e => {
							e.stopPropagation();
							onRecalculate();
						}}
						disabled={isRecalculating}
						title="Recalculate chapter description"
					>
						<i
							className={`fa-solid ${isRecalculating ? 'fa-spinner fa-spin' : 'fa-rotate'}`}
						/>
						<span>Recalculate</span>
					</button>
				)}
			</div>

			{/* Expanded content */}
			{isExpanded && (
				<div className="bt-v2-chapter-expanded-content">
					{/* Milestones */}
					{chapter.milestones.length > 0 && (
						<div className="bt-v2-chapter-milestones">
							<h4>
								<i className="fa-solid fa-star" />
								<span>Milestones</span>
							</h4>
							<div className="bt-v2-milestone-list">
								{chapter.milestones.map((m, i) => (
									<div
										key={i}
										className="bt-v2-milestone-item"
									>
										<span className="bt-v2-milestone-subject">
											{getMilestoneDisplayName(
												m.subject,
											)}
										</span>
										<span className="bt-v2-milestone-pair">
											{m.pair.join(
												' & ',
											)}
										</span>
										{m.description && (
											<span className="bt-v2-milestone-desc">
												{
													m.description
												}
											</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Per-chapter tension graph */}
					{chapter.narrativeEvents.length > 0 && (
						<div className="bt-v2-chapter-tension">
							<h4>
								<i className="fa-solid fa-chart-line" />
								<span>Tension</span>
							</h4>
							<V2TensionGraph
								store={eventStore}
								swipeContext={swipeContext}
								upToMessage={
									chapter.endedAtMessage
										?.messageId ??
									undefined
								}
								chapterFilter={chapter.index}
								height={200}
							/>
						</div>
					)}

					{/* Narrative events - reuse event item styling */}
					{chapter.narrativeEvents.length > 0 && (
						<div className="bt-v2-chapter-events">
							<h4>
								<i className="fa-solid fa-book" />
								<span>
									Events (
									{
										chapter
											.narrativeEvents
											.length
									}
									)
								</span>
							</h4>
							<div className="bt-event-list">
								{eventsNewestFirst.map(
									(event, i) => (
										<NarrativeEventItem
											key={i}
											event={
												event
											}
											timeFormat={
												timeFormat
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

export function V2ChaptersTab({
	projection,
	eventStore,
	swipeContext,
	timeFormat = '12h',
	onRecalculateChapter,
	targetChapter,
}: V2ChaptersTabProps): React.ReactElement {
	// Compute all chapter data from snapshots + events
	const chapters = useMemo(() => {
		const all = computeAllChapters(eventStore, swipeContext);
		// Reverse to show newest first
		return [...all].reverse();
	}, [eventStore, swipeContext]);

	// Get the newest chapter index (for auto-expand)
	const newestChapterIndex = chapters.length > 0 ? chapters[0].index : null;

	// Refs for scrolling to target chapter
	const chapterRefs = useRef<Map<number, HTMLDivElement>>(new Map());

	// Start with newest chapter expanded, or target chapter if specified
	const [expandedChapter, setExpandedChapter] = useState<number | null>(
		targetChapter ?? newestChapterIndex,
	);
	const [highlightedChapter, setHighlightedChapter] = useState<number | null>(
		targetChapter ?? null,
	);
	const [recalculatingChapter, setRecalculatingChapter] = useState<number | null>(null);

	// Scroll to and highlight target chapter on mount
	useEffect(() => {
		if (targetChapter !== undefined) {
			setExpandedChapter(targetChapter);
			setHighlightedChapter(targetChapter);

			// Scroll to chapter after a brief delay for DOM update
			setTimeout(() => {
				const element = chapterRefs.current.get(targetChapter);
				if (element) {
					element.scrollIntoView({
						behavior: 'smooth',
						block: 'center',
					});
				}
			}, 100);

			// Clear highlight after 2 seconds
			setTimeout(() => {
				setHighlightedChapter(null);
			}, 2000);
		}
	}, [targetChapter]);

	// Handle chapter recalculation
	const handleRecalculate = async (chapterIndex: number) => {
		if (!onRecalculateChapter) return;

		setRecalculatingChapter(chapterIndex);
		try {
			await onRecalculateChapter(chapterIndex);
		} finally {
			setRecalculatingChapter(null);
		}
	};

	if (chapters.length === 0) {
		return (
			<div className="bt-v2-chapters-empty">
				<i className="fa-solid fa-book" />
				<div>No chapters recorded yet.</div>
				<div className="bt-v2-chapters-empty-hint">
					Chapters are created when significant location or time
					changes occur.
				</div>
			</div>
		);
	}

	return (
		<div className="bt-v2-chapters-container">
			{/* Chapters List - newest first */}
			<div className="bt-v2-chapters-list">
				{chapters.map(chapter => (
					<div
						key={chapter.index}
						ref={el => {
							if (el)
								chapterRefs.current.set(
									chapter.index,
									el,
								);
						}}
					>
						<ChapterCard
							chapter={chapter}
							isCurrentChapter={
								chapter.index ===
								projection.currentChapter
							}
							isExpanded={
								expandedChapter === chapter.index
							}
							isHighlighted={
								highlightedChapter === chapter.index
							}
							onToggle={() =>
								setExpandedChapter(
									expandedChapter ===
										chapter.index
										? null
										: chapter.index,
								)
							}
							eventStore={eventStore}
							swipeContext={swipeContext}
							timeFormat={timeFormat}
							onRecalculate={
								onRecalculateChapter
									? () =>
											handleRecalculate(
												chapter.index,
											)
									: undefined
							}
							isRecalculating={
								recalculatingChapter ===
								chapter.index
							}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
