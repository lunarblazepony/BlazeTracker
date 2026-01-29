/**
 * V2 Chapters Tab
 *
 * Displays chapters with tension graph and chapter list.
 * Uses projection data for all display.
 */

import React, { useMemo } from 'react';
import type { Projection, Chapter } from '../../types/snapshot';
import type { EventStore } from '../../store/EventStore';
import type { SwipeContext } from '../../store/projection';
import { V2TensionGraph } from '../components/V2TensionGraph';
import type { ChapterEndedEvent, ChapterDescribedEvent } from '../../types/event';
import { isChapterEndedEvent, isChapterDescribedEvent } from '../../types/event';

export interface V2ChaptersTabProps {
	projection: Projection;
	eventStore: EventStore;
	swipeContext: SwipeContext;
}

export function V2ChaptersTab({
	projection,
	eventStore,
	swipeContext,
}: V2ChaptersTabProps): React.ReactElement {
	// Build chapters from chapter events
	const chapters = useMemo(() => {
		const activeEvents = eventStore.getActiveEvents();

		// Get all chapter events
		const endedEvents = activeEvents.filter(isChapterEndedEvent) as ChapterEndedEvent[];
		const describedEvents = activeEvents.filter(
			isChapterDescribedEvent,
		) as ChapterDescribedEvent[];

		// Build chapter objects
		const chapterMap = new Map<number, Chapter>();

		// Initialize chapters based on ended events
		for (const event of endedEvents) {
			chapterMap.set(event.chapterIndex, {
				index: event.chapterIndex,
				title: `Chapter ${event.chapterIndex + 1}`,
				summary: '',
				endReason: event.reason,
				endedAtMessage: event.source,
				eventCount: 0,
			});
		}

		// Add descriptions
		for (const event of describedEvents) {
			const existing = chapterMap.get(event.chapterIndex);
			if (existing) {
				existing.title = event.title || existing.title;
				existing.summary = event.summary || existing.summary;
			} else {
				chapterMap.set(event.chapterIndex, {
					index: event.chapterIndex,
					title: event.title || `Chapter ${event.chapterIndex + 1}`,
					summary: event.summary || '',
					endReason: null,
					endedAtMessage: null,
					eventCount: 0,
				});
			}
		}

		// Add current chapter if not in map
		if (!chapterMap.has(projection.currentChapter)) {
			chapterMap.set(projection.currentChapter, {
				index: projection.currentChapter,
				title: `Chapter ${projection.currentChapter + 1}`,
				summary: 'Current chapter in progress...',
				endReason: null,
				endedAtMessage: null,
				eventCount: 0,
			});
		}

		// Count events per chapter
		for (const event of projection.narrativeEvents) {
			const chapter = chapterMap.get(event.chapterIndex);
			if (chapter) {
				chapter.eventCount++;
			}
		}

		// Sort by index
		return Array.from(chapterMap.values()).sort((a, b) => a.index - b.index);
	}, [eventStore, projection]);

	// Check if we should show the tension graph
	// Show if there's an initial snapshot with time data (tension data exists)
	const hasTensionData = eventStore.hasInitialSnapshot;

	// Format end reason for display
	const formatEndReason = (reason: Chapter['endReason']): string => {
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

	if (chapters.length === 0) {
		return (
			<div className="bt-v2-chapters-empty">
				<i className="fa-solid fa-book" />
				<div>No chapters recorded yet.</div>
				<div style={{ fontSize: '0.85rem', color: '#555' }}>
					Chapters are created when significant location or time
					changes occur.
				</div>
			</div>
		);
	}

	return (
		<div className="bt-v2-chapters-container">
			{/* Tension Graph */}
			{hasTensionData && (
				<div className="bt-v2-tension-graph-container">
					<div className="bt-v2-tension-graph-header">
						<i className="fa-solid fa-chart-line" />
						Tension Over Time
					</div>
					<V2TensionGraph
						store={eventStore}
						swipeContext={swipeContext}
						upToMessage={projection.source.messageId}
					/>
				</div>
			)}

			{/* Chapters List */}
			<div className="bt-v2-chapters-list">
				{chapters.map(chapter => (
					<div key={chapter.index} className="bt-v2-chapter-card">
						<div className="bt-v2-chapter-header">
							<span className="bt-v2-chapter-index">
								Ch. {chapter.index + 1}
							</span>
							<span className="bt-v2-chapter-title">
								{chapter.title}
							</span>
							{chapter.endReason && (
								<span className="bt-v2-chapter-end-reason">
									{formatEndReason(
										chapter.endReason,
									)}
								</span>
							)}
						</div>
						{chapter.summary && (
							<div className="bt-v2-chapter-summary">
								{chapter.summary}
							</div>
						)}
						<div className="bt-v2-chapter-stats">
							<span className="bt-v2-chapter-stat">
								<i className="fa-solid fa-scroll" />
								{chapter.eventCount} events
							</span>
							{chapter.endedAtMessage && (
								<span className="bt-v2-chapter-stat">
									<i className="fa-solid fa-flag-checkered" />
									Ended at #
									{
										chapter
											.endedAtMessage
											.messageId
									}
								</span>
							)}
							{!chapter.endedAtMessage && (
								<span
									className="bt-v2-chapter-stat"
									style={{ color: '#4ade80' }}
								>
									<i className="fa-solid fa-pen" />
									In progress
								</span>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
