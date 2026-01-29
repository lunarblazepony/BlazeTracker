import React from 'react';
import type { ProjectedState, ProjectedCharacter, CharacterOutfit } from '../../types/state';
import { formatTime } from '../formatters';
import { getSettings } from '../../settings';

interface ProjectionPreviewProps {
	projection: ProjectedState;
	/** Optional: show compact version without character details */
	compact?: boolean;
}

/**
 * Read-only preview of a ProjectedState.
 * Used in the state editor to show live projection from events.
 */
export function ProjectionPreview({ projection, compact = false }: ProjectionPreviewProps) {
	const settings = getSettings();
	const characters = Array.from(projection.characters.values());

	return (
		<div className="bt-projection-preview">
			{/* Time */}
			{projection.time && (
				<div className="bt-projection-section">
					<h4>Time</h4>
					<div className="bt-projection-value">
						<i className="fa-regular fa-clock"></i>{' '}
						{formatTime(projection.time, settings.timeFormat)}
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

			{/* Characters */}
			{characters.length > 0 && (
				<div className="bt-projection-section">
					<h4>Characters ({characters.length})</h4>
					<div className="bt-projection-characters">
						{characters.map(char => (
							<ProjectedCharacterCard
								key={char.name}
								character={char}
								compact={compact}
							/>
						))}
					</div>
				</div>
			)}

			{/* Empty state */}
			{!projection.time && !projection.location && characters.length === 0 && (
				<div className="bt-projection-empty">
					<i className="fa-solid fa-ghost"></i>
					<span>No state data yet</span>
				</div>
			)}
		</div>
	);
}

interface ProjectedCharacterCardProps {
	character: ProjectedCharacter;
	compact?: boolean;
}

function ProjectedCharacterCard({ character, compact = false }: ProjectedCharacterCardProps) {
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

/**
 * Extract non-null outfit items as an array of strings.
 */
function getOutfitItems(outfit: CharacterOutfit): string[] {
	const items: string[] = [];
	const slots: (keyof CharacterOutfit)[] = [
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

export default ProjectionPreview;
