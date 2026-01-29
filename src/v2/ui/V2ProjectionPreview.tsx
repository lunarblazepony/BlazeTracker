/**
 * V2 Projection Preview
 *
 * Read-only display of a v2 Projection state.
 * Shows time, location, climate, characters, and relationships.
 */

import React, { useMemo } from 'react';
import type { Projection, CharacterState, RelationshipState } from '../types/snapshot';
import type { CharacterOutfit, OutfitSlot } from '../types/common';
import type { Event } from '../types/event';
import { getV2Settings } from '../settings';
import {
	getMilestonesForPair as getMilestonesFromEvents,
	getMilestoneDisplayName,
	type SwipeContext,
	NoSwipeFiltering,
} from '../store/projection';

interface V2ProjectionPreviewProps {
	projection: Projection;
	/** Show compact version without full character details */
	compact?: boolean;
	/** All active events from the EventStore (for querying milestones) */
	events?: readonly Event[];
	/** Swipe context for canonical path filtering */
	swipeContext?: SwipeContext;
}

interface RelationshipMilestone {
	subject: string;
	description?: string;
}

export function V2ProjectionPreview({
	projection,
	compact = false,
	events,
	swipeContext = NoSwipeFiltering,
}: V2ProjectionPreviewProps) {
	const settings = getV2Settings();
	const characters = Object.values(projection.characters);
	const relationships = Object.values(projection.relationships);

	// Pre-compute milestones for all relationship pairs using raw events
	// This ensures we capture milestones that happened on ANY turn, not just narrative turns
	const milestonesMap = useMemo(() => {
		const map = new Map<string, RelationshipMilestone[]>();
		if (!events) return map;

		for (const rel of relationships) {
			const [charA, charB] = rel.pair;
			const key = `${charA}|${charB}`;
			const milestoneInfos = getMilestonesFromEvents(
				events,
				charA,
				charB,
				swipeContext,
				projection.source.messageId,
			);
			map.set(
				key,
				milestoneInfos.map(m => ({
					subject: m.subject,
					description: m.description,
				})),
			);
		}
		return map;
	}, [events, relationships, swipeContext, projection.source.messageId]);

	return (
		<div className="bt-projection-preview">
			{/* Time */}
			{projection.time && (
				<div className="bt-projection-section">
					<h4>Time</h4>
					<div className="bt-projection-value">
						<i className="fa-regular fa-clock"></i>{' '}
						{formatTime(projection.time, settings.v2TimeFormat)}
					</div>
				</div>
			)}

			{/* Location */}
			{projection.location && (
				<div className="bt-projection-section">
					<h4>Location</h4>
					<div className="bt-projection-location">
						{projection.location.area && (
							<div className="bt-projection-area">
								<i className="fa-solid fa-map"></i>{' '}
								{projection.location.area}
							</div>
						)}
						{projection.location.place && (
							<div className="bt-projection-place">
								<i className="fa-solid fa-location-dot"></i>{' '}
								{projection.location.place}
							</div>
						)}
						{projection.location.position && (
							<div className="bt-projection-position">
								<i className="fa-solid fa-crosshairs"></i>{' '}
								{projection.location.position}
							</div>
						)}
						{projection.location.props &&
							projection.location.props.length > 0 && (
								<div className="bt-projection-props">
									<i className="fa-solid fa-cube"></i>{' '}
									{
										projection.location
											.props
											.length
									}{' '}
									props
								</div>
							)}
					</div>
				</div>
			)}

			{/* Climate */}
			{projection.climate && (
				<div className="bt-projection-section">
					<h4>Climate</h4>
					<div className="bt-projection-climate">
						<div className="bt-projection-value">
							<i className="fa-solid fa-temperature-half"></i>{' '}
							{Math.round(projection.climate.temperature)}
							°
							{projection.climate.feelsLike !==
								projection.climate.temperature && (
								<span className="bt-feels-like">
									(feels{' '}
									{Math.round(
										projection.climate
											.feelsLike,
									)}
									°)
								</span>
							)}
						</div>
						{projection.climate.conditions && (
							<div className="bt-projection-value">
								<i
									className={getWeatherIcon(
										projection.climate
											.conditionType,
									)}
								></i>{' '}
								{projection.climate.conditions}
							</div>
						)}
						{projection.climate.daylight && (
							<div className="bt-projection-value">
								<i
									className={getDaylightIcon(
										projection.climate
											.daylight,
									)}
								></i>{' '}
								{projection.climate.daylight}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Scene */}
			{projection.scene && (
				<div className="bt-projection-section">
					<h4>Scene</h4>
					<div className="bt-projection-scene">
						{projection.scene.topic && (
							<div className="bt-projection-value">
								<i className="fa-solid fa-comment"></i>{' '}
								{projection.scene.topic}
							</div>
						)}
						{projection.scene.tone && (
							<div className="bt-projection-value">
								<i className="fa-solid fa-theater-masks"></i>{' '}
								{projection.scene.tone}
							</div>
						)}
						<div className="bt-projection-value">
							<i className="fa-solid fa-bolt"></i>{' '}
							{projection.scene.tension.level}{' '}
							{projection.scene.tension.type}
							<span className="bt-tension-direction">
								(
								{projection.scene.tension.direction}
								)
							</span>
						</div>
					</div>
				</div>
			)}

			{/* Characters */}
			{characters.length > 0 && (
				<div className="bt-projection-section">
					<h4>Characters ({characters.length})</h4>
					<div className="bt-projection-characters">
						{characters.map(char => (
							<CharacterStateCard
								key={char.name}
								character={char}
								compact={compact}
							/>
						))}
					</div>
				</div>
			)}

			{/* Relationships (only show if not compact and there are relationships) */}
			{!compact && relationships.length > 0 && (
				<div className="bt-projection-section">
					<h4>Relationships ({relationships.length})</h4>
					<div className="bt-projection-relationships">
						{relationships.map(rel => {
							const key = `${rel.pair[0]}|${rel.pair[1]}`;
							return (
								<RelationshipStateCard
									key={key}
									relationship={rel}
									milestones={
										milestonesMap.get(
											key,
										) ?? []
									}
								/>
							);
						})}
					</div>
				</div>
			)}

			{/* Empty state */}
			{!projection.time &&
				!projection.location &&
				!projection.climate &&
				!projection.scene &&
				characters.length === 0 && (
					<div className="bt-projection-empty">
						<i className="fa-solid fa-ghost"></i>
						<span>No state data yet</span>
					</div>
				)}
		</div>
	);
}

// ============================================
// Character Card
// ============================================

interface CharacterStateCardProps {
	character: CharacterState;
	compact?: boolean;
}

function CharacterStateCard({ character, compact = false }: CharacterStateCardProps) {
	const outfitItems = getOutfitItems(character.outfit);

	return (
		<div className="bt-projected-character">
			<div className="bt-projected-char-header">
				<span className="bt-projected-char-name">{character.name}</span>
				{character.position && character.position !== 'unknown' && (
					<span className="bt-projected-char-position">
						{character.position}
					</span>
				)}
			</div>

			{!compact && (
				<div className="bt-projected-char-details">
					{/* Activity */}
					{character.activity && (
						<div className="bt-projected-char-activity">
							<i className="fa-solid fa-person-running"></i>{' '}
							{character.activity}
						</div>
					)}

					{/* Mood */}
					{character.mood.length > 0 && (
						<div className="bt-projected-char-mood">
							<i className="fa-regular fa-face-smile"></i>{' '}
							<span className="bt-tag-list">
								{character.mood.map(m => (
									<span
										key={m}
										className="bt-tag bt-tag-mood"
									>
										{m}
									</span>
								))}
							</span>
						</div>
					)}

					{/* Physical State */}
					{character.physicalState.length > 0 && (
						<div className="bt-projected-char-physical">
							<i className="fa-solid fa-heart-pulse"></i>{' '}
							<span className="bt-tag-list">
								{character.physicalState.map(p => (
									<span
										key={p}
										className="bt-tag bt-tag-physical"
									>
										{p}
									</span>
								))}
							</span>
						</div>
					)}

					{/* Outfit (collapsed summary) */}
					{outfitItems.length > 0 && (
						<div className="bt-projected-char-outfit">
							<i className="fa-solid fa-shirt"></i>{' '}
							<span className="bt-outfit-summary">
								{outfitItems.slice(0, 3).join(', ')}
								{outfitItems.length > 3 &&
									` +${outfitItems.length - 3} more`}
							</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ============================================
// Relationship Card
// ============================================

interface RelationshipStateCardProps {
	relationship: RelationshipState;
	milestones: RelationshipMilestone[];
}

function RelationshipStateCard({ relationship, milestones }: RelationshipStateCardProps) {
	const [charA, charB] = relationship.pair;

	return (
		<div className="bt-projected-relationship">
			<div className="bt-projected-rel-header">
				<span className="bt-projected-rel-pair">
					{charA} & {charB}
				</span>
				<span className="bt-projected-rel-status">
					{relationship.status}
				</span>
			</div>

			{/* Milestones */}
			{milestones.length > 0 && (
				<div className="bt-projected-rel-milestones">
					<div className="bt-attitude-label">
						<i
							className="fa-solid fa-star"
							style={{
								color: '#eab308',
								marginRight: '4px',
							}}
						/>
						Milestones:
					</div>
					{milestones.map((m, idx) => (
						<div key={idx} className="bt-milestone-row">
							<span className="bt-milestone-subject">
								{getMilestoneDisplayName(
									m.subject as any,
								)}
							</span>
							{m.description && (
								<span className="bt-milestone-description">
									{m.description}
								</span>
							)}
						</div>
					))}
				</div>
			)}

			{/* A's attitude toward B */}
			{(relationship.aToB.feelings.length > 0 ||
				relationship.aToB.secrets.length > 0 ||
				relationship.aToB.wants.length > 0) && (
				<div className="bt-projected-rel-attitude">
					<div className="bt-attitude-label">
						{charA} → {charB}:
					</div>
					{relationship.aToB.feelings.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-attitude-type">
								Feelings:
							</span>
							<span className="bt-tag-list">
								{relationship.aToB.feelings.map(
									f => (
										<span
											key={f}
											className="bt-tag bt-tag-feeling"
										>
											{f}
										</span>
									),
								)}
							</span>
						</div>
					)}
					{relationship.aToB.wants.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-attitude-type">
								Wants:
							</span>
							<span className="bt-tag-list">
								{relationship.aToB.wants.map(w => (
									<span
										key={w}
										className="bt-tag bt-tag-want"
									>
										{w}
									</span>
								))}
							</span>
						</div>
					)}
				</div>
			)}

			{/* B's attitude toward A */}
			{(relationship.bToA.feelings.length > 0 ||
				relationship.bToA.secrets.length > 0 ||
				relationship.bToA.wants.length > 0) && (
				<div className="bt-projected-rel-attitude">
					<div className="bt-attitude-label">
						{charB} → {charA}:
					</div>
					{relationship.bToA.feelings.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-attitude-type">
								Feelings:
							</span>
							<span className="bt-tag-list">
								{relationship.bToA.feelings.map(
									f => (
										<span
											key={f}
											className="bt-tag bt-tag-feeling"
										>
											{f}
										</span>
									),
								)}
							</span>
						</div>
					)}
					{relationship.bToA.wants.length > 0 && (
						<div className="bt-attitude-row">
							<span className="bt-attitude-type">
								Wants:
							</span>
							<span className="bt-tag-list">
								{relationship.bToA.wants.map(w => (
									<span
										key={w}
										className="bt-tag bt-tag-want"
									>
										{w}
									</span>
								))}
							</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format time for display using moment.
 * @param time - The moment to format
 * @param timeFormatSetting - The user's time format preference ('12h' or '24h')
 */
function formatTime(time: moment.Moment, timeFormatSetting?: '12h' | '24h'): string {
	const fmt =
		timeFormatSetting === '24h' ? 'ddd, MMM D YYYY, HH:mm' : 'ddd, MMM D YYYY, h:mm A';
	return time.format(fmt);
}

/**
 * Get weather icon class for a condition type.
 */
function getWeatherIcon(conditionType: string): string {
	const icons: Record<string, string> = {
		clear: 'fa-solid fa-moon',
		sunny: 'fa-solid fa-sun',
		partly_cloudy: 'fa-solid fa-cloud-sun',
		overcast: 'fa-solid fa-cloud',
		foggy: 'fa-solid fa-smog',
		drizzle: 'fa-solid fa-cloud-rain',
		rain: 'fa-solid fa-cloud-showers-heavy',
		heavy_rain: 'fa-solid fa-cloud-showers-water',
		thunderstorm: 'fa-solid fa-cloud-bolt',
		sleet: 'fa-solid fa-cloud-meatball',
		snow: 'fa-solid fa-snowflake',
		heavy_snow: 'fa-solid fa-snowflake',
		blizzard: 'fa-solid fa-icicles',
		windy: 'fa-solid fa-wind',
		hot: 'fa-solid fa-temperature-high',
		cold: 'fa-solid fa-temperature-low',
		humid: 'fa-solid fa-droplet',
	};
	return icons[conditionType] || 'fa-solid fa-question';
}

/**
 * Get daylight icon class for a daylight phase.
 */
function getDaylightIcon(daylight: string): string {
	const icons: Record<string, string> = {
		dawn: 'fa-solid fa-sun',
		day: 'fa-solid fa-sun',
		dusk: 'fa-solid fa-cloud-sun',
		night: 'fa-solid fa-moon',
	};
	return icons[daylight] || 'fa-solid fa-question';
}

/**
 * Extract non-null outfit items as an array of strings.
 */
function getOutfitItems(outfit: CharacterOutfit): string[] {
	const items: string[] = [];
	const slots: OutfitSlot[] = [
		'head',
		'neck',
		'jacket',
		'back',
		'torso',
		'legs',
		'footwear',
		'socks',
		'underwear',
	];

	for (const slot of slots) {
		const item = outfit[slot];
		if (item) {
			items.push(item);
		}
	}

	return items;
}

export default V2ProjectionPreview;
