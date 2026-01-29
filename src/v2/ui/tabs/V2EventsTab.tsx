/**
 * V2 Events Tab
 *
 * Displays narrative events for the current chapter, newest first.
 * Uses projection data for all display.
 */

import React, { useMemo } from 'react';
import type { Projection, NarrativeEvent } from '../../types/snapshot';
import {
	getTensionLevelIcon,
	getTensionColor,
	getTensionIcon,
	getTensionTypeColor,
} from '../icons';

export interface V2EventsTabProps {
	projection: Projection;
	timeFormat?: '12h' | '24h';
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
 * Single narrative event item (matches ProjectionDisplay style).
 */
function NarrativeEventItem({
	event,
	timeFormat,
}: {
	event: NarrativeEvent;
	timeFormat: '12h' | '24h';
}) {
	const levelIconClass = getTensionLevelIcon(event.tension.level);
	const levelColor = getTensionColor(event.tension.level);
	const typeIconClass = getTensionIcon(event.tension.type);
	const typeColor = getTensionTypeColor(event.tension.type);

	const levelTooltip = `Level: ${event.tension.level}`;
	const typeTooltip = `Type: ${event.tension.type}`;

	return (
		<div
			className="bt-event-item"
			style={{ borderLeftColor: levelColor }}
		>
			{/* Row 1: Time (left), Tension icons (right) */}
			<div className="bt-event-header">
				<span className="bt-event-time">
					{formatNarrativeTime(event.narrativeTime, timeFormat)}
				</span>
				<div className="bt-event-header-right">
					<div className="bt-event-tension">
						<i
							className={typeIconClass}
							style={{ color: typeColor }}
							title={typeTooltip}
						/>
						<i
							className={levelIconClass}
							style={{ color: levelColor }}
							title={levelTooltip}
						/>
					</div>
				</div>
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
							<span className="bt-witnesses-label">Witnesses:</span>
							{event.witnesses.map((w, i) => (
								<span key={i} className="bt-witness">
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
							<span key={idx} className="bt-event-milestone">
								<i className="fa-solid fa-star" />
								{subject.pair.join(' & ')}: {subject.subject}
								{subject.milestoneDescription && (
									<span className="bt-milestone-desc">
										{' '}
										- {subject.milestoneDescription}
									</span>
								)}
							</span>
						))}
				</div>
			)}
		</div>
	);
}

export function V2EventsTab({
	projection,
	timeFormat = '12h',
}: V2EventsTabProps): React.ReactElement {
	// Get events for current chapter from projection, newest first
	const events = useMemo(() => {
		const chapterEvents = projection.narrativeEvents.filter(
			e => e.chapterIndex === projection.currentChapter,
		);
		// Reverse to show newest first
		return [...chapterEvents].reverse();
	}, [projection.narrativeEvents, projection.currentChapter]);

	if (events.length === 0) {
		return (
			<div className="bt-v2-events-empty">
				<i className="fa-solid fa-scroll" />
				<div>No events recorded in this chapter yet.</div>
				<div style={{ fontSize: '0.85rem', color: '#555' }}>
					Events are created as the story progresses.
				</div>
			</div>
		);
	}

	return (
		<div className="bt-v2-events-container">
			<div className="bt-v2-events-header">
				<span className="bt-v2-events-chapter">
					Chapter {projection.currentChapter + 1}
				</span>
				<span className="bt-v2-events-count">
					{events.length} event{events.length !== 1 ? 's' : ''}
				</span>
			</div>
			<div className="bt-event-list">
				{events.map((event, idx) => (
					<NarrativeEventItem
						key={`${event.source.messageId}-${event.source.swipeId}-${idx}`}
						event={event}
						timeFormat={timeFormat}
					/>
				))}
			</div>
		</div>
	);
}
