/**
 * V2 ProjectionDisplay Component
 *
 * Main display component that renders a v2 Projection.
 * Works with v2 types directly - no legacy dependencies.
 */

import React, { useState, useMemo } from 'react';
import type moment from 'moment';
import type { Projection, RelationshipState, SceneState, NarrativeEvent } from '../types/snapshot';
import { getMilestoneDisplayName, type MilestoneInfo } from '../store/projection';
import {
	V2LoadingIndicator,
	V2ClimateDisplay,
	V2TensionBadges,
	V2CharacterCard,
	V2WeatherForecastModal,
	V2ChapterSummaryCard,
} from './components';
import type { LocationForecast } from '../../weather/types';
import { getTensionLevelIcon, getTensionColor, getTensionIcon, getTensionTypeColor } from './icons';
import type { ComputedChapter } from '../narrative/computeChapters';

export interface ExtractionProgress {
	step: string;
	percentComplete: number;
	label: string;
}

export interface ProjectionDisplayProps {
	projection: Projection | null;
	messageId: number;
	isExtracting?: boolean;
	extractionProgress?: ExtractionProgress;
	onExtract?: () => void;
	/** Callback to open the narrative modal (book button) */
	onOpenNarrative?: () => void;
	/** Callback to open the event store editor */
	onOpenEditor?: () => void;
	/** Callback to open the per-message event editor */
	onEditEvents?: () => void;
	temperatureUnit?: 'F' | 'C';
	timeFormat?: '12h' | '24h';
	/** Milestones that occurred at this message (from raw events) */
	milestones?: MilestoneInfo[];
	/** Whether this specific message has been extracted (has events) */
	hasEventsAtThisMessage?: boolean;
	/** Whether this is the initial snapshot message (don't show incomplete for it) */
	isInitialSnapshotMessage?: boolean;
	/** Whether this is the latest message in the chat */
	isLatestMessage?: boolean;
	/** Callback to retry extraction (delete events and re-extract) */
	onRetry?: () => void;
	/** Previous chapter data (for chapter summary card display) */
	previousChapter?: ComputedChapter | null;
	/** Callback to view chapter details in narrative modal */
	onViewChapterDetails?: (chapterIndex: number) => void;
}

/**
 * Format location for display.
 */
function formatLocation(location: { area: string; place: string; position: string }): string {
	const parts = [location.position, location.place, location.area];
	return parts.filter(Boolean).join(' · ');
}

/**
 * Scene display sub-component.
 */
function SceneSection({
	scene,
	onOpenNarrative,
	onEditEvents,
	onRetry,
	isLatestMessage,
}: {
	scene: SceneState;
	onOpenNarrative?: () => void;
	onEditEvents?: () => void;
	onRetry?: () => void;
	isLatestMessage?: boolean;
}) {
	return (
		<div className="bt-scene">
			<div className="bt-scene-header">
				<span className="bt-scene-topic">{scene.topic}</span>
				<span className="bt-scene-tone">{scene.tone}</span>
				<div className="bt-scene-actions">
					{isLatestMessage && onRetry && (
						<button
							className="bt-action-icon-btn bt-retry-icon"
							onClick={onRetry}
							title="Re-extract this message"
						>
							<i className="fa-solid fa-fire"></i>
						</button>
					)}
					{onEditEvents && (
						<button
							className="bt-action-icon-btn"
							onClick={onEditEvents}
							title="Edit events at this message"
						>
							<i className="fa-solid fa-pen-to-square"></i>
						</button>
					)}
					{onOpenNarrative && (
						<button
							className="bt-action-icon-btn"
							onClick={onOpenNarrative}
							title="View narrative overview"
						>
							<i className="fa-solid fa-book-open"></i>
						</button>
					)}
				</div>
			</div>
			<V2TensionBadges tension={scene.tension} />
		</div>
	);
}

/**
 * Format narrative time for display.
 */
function formatNarrativeTime(time: moment.Moment | null, timeFormat: '12h' | '24h'): string {
	if (!time) return '';
	if (timeFormat === '24h') {
		return time.format('ddd HH:mm');
	}
	const hour12 = time.hour() % 12 || 12;
	const ampm = time.hour() < 12 ? 'AM' : 'PM';
	const minute = time.minute().toString().padStart(2, '0');
	return `${time.format('ddd')} ${hour12}:${minute} ${ampm}`;
}

/**
 * Single narrative event item (matches v1 EventItem style).
 */
function NarrativeEventItem({
	event,
	opacity = 1,
	timeFormat,
}: {
	event: NarrativeEvent;
	opacity?: number;
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
			style={
				{
					borderLeftColor: levelColor,
					'--bt-event-opacity': opacity,
				} as React.CSSProperties
			}
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
		</div>
	);
}

/**
 * Narrative events display sub-component.
 * Shows last 3 narrative events with reducing opacity (like v1 EventList).
 */
function NarrativeEventsSection({
	events,
	timeFormat,
}: {
	events: NarrativeEvent[];
	timeFormat: '12h' | '24h';
}) {
	if (events.length === 0) return null;

	// Get last 3 events and reverse to show newest first
	const recentEvents = events.slice(-3);
	const displayEvents = [...recentEvents].reverse();

	return (
		<div className="bt-event-list">
			{displayEvents.map((event, displayIndex) => {
				// Decrease opacity for older events: 100%, 75%, 50%, 40% (min)
				const opacity = Math.max(0.4, 1 - displayIndex * 0.25);
				return (
					<NarrativeEventItem
						key={displayIndex}
						event={event}
						opacity={opacity}
						timeFormat={timeFormat}
					/>
				);
			})}
		</div>
	);
}

/**
 * Milestone row - achievement unlocked style display.
 * Shows when milestones occurred at this message with a gamified feel.
 */
function MilestoneRow({ milestones }: { milestones: MilestoneInfo[] }) {
	return (
		<div className="bt-milestone-row">
			<div className="bt-milestone-icon">
				<i className="fa-solid fa-star"></i>
			</div>
			<div className="bt-milestone-content">
				{milestones.map((m, idx) => {
					const name = getMilestoneDisplayName(m.subject);
					const pairStr = m.pair.join(' & ');
					return (
						<div key={idx} className="bt-milestone-achievement">
							<span className="bt-milestone-label">
								{name}
							</span>
							<span className="bt-milestone-pair">
								{pairStr}
							</span>
							{m.description && (
								<span
									className="bt-milestone-desc"
									title={m.description}
								>
									{m.description}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function ProjectionDisplay({
	projection,
	messageId: _messageId,
	isExtracting,
	extractionProgress,
	onExtract: _onExtract,
	onOpenNarrative,
	onOpenEditor: _onOpenEditor,
	onEditEvents,
	temperatureUnit = 'F',
	timeFormat = '12h',
	milestones = [],
	hasEventsAtThisMessage = true,
	isInitialSnapshotMessage = false,
	isLatestMessage = false,
	onRetry,
	previousChapter = null,
	onViewChapterDetails,
}: ProjectionDisplayProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [showForecastModal, setShowForecastModal] = useState(false);

	// Filter narrative events to current chapter only
	const currentChapterEvents = useMemo(() => {
		if (!projection) return [];
		const currentChapter = projection.currentChapter;
		return projection.narrativeEvents.filter(e => e.chapterIndex === currentChapter);
	}, [projection]);

	// Determine if we should show the chapter summary card
	// Show when: < 3 events in current chapter AND previous chapter exists
	const showChapterSummary = useMemo(() => {
		if (!projection || !previousChapter) return false;
		return currentChapterEvents.length < 3 && previousChapter.summary !== '';
	}, [projection, previousChapter, currentChapterEvents]);

	// Show loading state while extracting
	if (isExtracting && extractionProgress) {
		return (
			<V2LoadingIndicator
				step={extractionProgress.step}
				percentComplete={extractionProgress.percentComplete}
				label={extractionProgress.label}
				calibrating={_messageId < 3}
			/>
		);
	}

	// Nothing to display - no projection available
	if (!projection) {
		return null;
	}

	// If this message hasn't been extracted (no events) AND it's not the initial snapshot message,
	// show incomplete state. The initial snapshot message has its state in the snapshot itself.
	if (!hasEventsAtThisMessage && !isInitialSnapshotMessage) {
		return (
			<div className="bt-state-container bt-v2 bt-incomplete">
				<div className="bt-incomplete-message">
					<i className="fa-solid fa-hourglass-half"></i>
					<span>Extraction not complete</span>
					{isLatestMessage && onRetry && (
						<button
							className="bt-retry-btn"
							onClick={onRetry}
							title="Retry extraction"
						>
							<i className="fa-solid fa-fire"></i>
							<span>Extract</span>
						</button>
					)}
				</div>
			</div>
		);
	}

	// Get latest 3 narrative events from current chapter only
	const recentNarrativeEvents = currentChapterEvents.slice(-3);

	// Check what we have to display
	const hasTime = projection.time !== null;
	const hasLocation = projection.location !== null;
	const hasClimate = projection.climate !== null;
	const hasScene = projection.scene !== null;
	const hasCharacters = projection.charactersPresent.length > 0;
	const hasProps = (projection.location?.props?.length ?? 0) > 0;
	const hasNarrativeEvents = recentNarrativeEvents.length > 0;

	// Get forecast for current area if available
	const currentArea = projection.location?.area;
	const forecast: LocationForecast | null = currentArea
		? (projection.forecasts[currentArea] ?? null)
		: null;
	const currentHour = projection.time?.hour() ?? 12;

	// If nothing to show, render nothing
	const hasAnythingToShow =
		hasTime ||
		hasLocation ||
		hasClimate ||
		hasScene ||
		hasCharacters ||
		hasNarrativeEvents;
	if (!hasAnythingToShow) {
		return null;
	}

	// Get relationships for character cards
	const relationships: RelationshipState[] = Object.values(projection.relationships);

	// Calculate details summary
	const characterCount = projection.charactersPresent.length;
	const propsCount = projection.location?.props?.length ?? 0;
	const showDetails = characterCount > 0 || propsCount > 0;

	return (
		<div className="bt-state-container bt-v2">
			{/* Time/Climate/Location row */}
			{(hasTime || hasClimate || hasLocation) && (
				<div className="bt-state-summary">
					{hasTime && projection.time && (
						<span className="bt-time">
							<i className="fa-regular fa-clock"></i>{' '}
							{projection.time.format(
								timeFormat === '24h'
									? 'ddd, MMM D YYYY, HH:mm'
									: 'ddd, MMM D YYYY, h:mm A',
							)}
						</span>
					)}
					{hasClimate && projection.climate && (
						<span className="bt-climate-group">
							<V2ClimateDisplay
								climate={projection.climate}
								temperatureUnit={temperatureUnit}
							/>
							{forecast && (
								<button
									className="bt-forecast-btn"
									onClick={() =>
										setShowForecastModal(
											true,
										)
									}
									title="View weather forecast"
								>
									<i className="fa-solid fa-calendar-days"></i>
								</button>
							)}
						</span>
					)}
					{hasLocation && projection.location && (
						<span className="bt-location">
							<i className="fa-solid fa-location-dot"></i>{' '}
							{formatLocation(projection.location)}
						</span>
					)}
				</div>
			)}

			{/* Milestone row - achievement unlocked style */}
			{milestones.length > 0 && <MilestoneRow milestones={milestones} />}

			{/* Scene section */}
			{hasScene && projection.scene && (
				<SceneSection
					scene={projection.scene}
					onOpenNarrative={onOpenNarrative}
					onEditEvents={onEditEvents}
					onRetry={onRetry}
					isLatestMessage={isLatestMessage}
				/>
			)}

			{/* Latest 3 narrative events from current chapter */}
			{hasNarrativeEvents && (
				<NarrativeEventsSection
					events={recentNarrativeEvents}
					timeFormat={timeFormat}
				/>
			)}

			{/* Chapter summary card (shows when 0-2 events in new chapter, below narrative events) */}
			{showChapterSummary && previousChapter && (
				<V2ChapterSummaryCard
					chapter={previousChapter}
					onViewDetails={onViewChapterDetails}
					timeFormat={timeFormat}
				/>
			)}

			{/* Expandable details */}
			{showDetails && (
				<details
					className="bt-state-details"
					open={isExpanded}
					onToggle={e =>
						setIsExpanded((e.target as HTMLDetailsElement).open)
					}
				>
					<summary>
						Details
						{characterCount > 0 &&
							` (${characterCount} characters`}
						{propsCount > 0 &&
							`${characterCount > 0 ? ', ' : ' ('}${propsCount} props`}
						{(characterCount > 0 || propsCount > 0) && ')'}
					</summary>

					{/* Props */}
					{hasProps && projection.location && (
						<div className="bt-props-section">
							<span className="bt-props-header">
								Props
							</span>
							<div className="bt-props">
								<ul>
									{projection.location.props.map(
										(prop, idx) => (
											<li
												key={
													idx
												}
											>
												{
													prop
												}
											</li>
										),
									)}
								</ul>
							</div>
						</div>
					)}

					{/* Characters */}
					{hasCharacters && (
						<div className="bt-characters">
							{projection.charactersPresent.map(name => {
								const character =
									projection.characters[name];
								if (!character) return null;
								return (
									<V2CharacterCard
										key={name}
										character={
											character
										}
										relationships={
											relationships
										}
									/>
								);
							})}
						</div>
					)}
				</details>
			)}

			{/* Weather Forecast Modal */}
			{showForecastModal && forecast && (
				<V2WeatherForecastModal
					forecast={forecast}
					currentHour={currentHour}
					temperatureUnit={temperatureUnit}
					timeFormat={timeFormat}
					areaName={currentArea}
					onClose={() => setShowForecastModal(false)}
				/>
			)}
		</div>
	);
}
