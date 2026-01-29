import React from 'react';
import type {
	Character,
	Relationship,
	DerivedRelationship,
	ProjectedRelationship,
	RelationshipStatus,
} from '@/types/state';
import { formatOutfit } from '../../formatters';

/** Union type for legacy, derived, and projected relationships */
type AnyRelationship = Relationship | DerivedRelationship | ProjectedRelationship;

export interface CharacterCardProps {
	character: Character;
	relationships?: AnyRelationship[];
}

const STATUS_COLORS: Record<RelationshipStatus, string> = {
	strangers: '#6b7280',
	acquaintances: '#3b82f6',
	friendly: '#22c55e',
	close: '#f59e0b',
	intimate: '#ec4899',
	strained: '#f97316',
	hostile: '#ef4444',
	complicated: '#8b5cf6',
};

export function CharacterCard({ character, relationships }: CharacterCardProps) {
	const mood = character.mood?.join(', ') || 'unknown';

	// Filter relationships to those involving this character
	const charRelationships =
		relationships?.filter(
			r => r.pair[0] === character.name || r.pair[1] === character.name,
		) ?? [];

	return (
		<div className="bt-character">
			<div className="bt-char-header">
				<strong>{character.name}</strong>
				<span className="bt-char-mood">{mood}</span>
			</div>

			<div className="bt-char-position">
				<i className="fa-solid fa-location-crosshairs" title="Position"></i>
				<span>{character.position}</span>
			</div>

			<div className="bt-char-details">
				{character.activity && (
					<div className="bt-char-row bt-char-activity">
						<i
							className="fa-solid fa-person-walking"
							title="Activity"
						></i>
						<span>{character.activity}</span>
					</div>
				)}

				{character.physicalState && character.physicalState.length > 0 && (
					<div className="bt-char-row bt-char-physical">
						<i
							className="fa-solid fa-heart-pulse"
							title="Physical state"
						></i>
						<span>{character.physicalState.join(', ')}</span>
					</div>
				)}

				{character.outfit && (
					<div className="bt-char-row bt-char-outfit">
						<i className="fa-solid fa-shirt" title="Outfit"></i>
						<span>{formatOutfit(character.outfit)}</span>
					</div>
				)}

				{/* Relationship badges */}
				{charRelationships.length > 0 && (
					<div className="bt-char-relationships">
						<i
							className="fa-solid fa-heart"
							title="Relationships"
						></i>
						<div className="bt-relationship-badges">
							{charRelationships.map(rel => {
								const otherChar =
									rel.pair[0] ===
									character.name
										? rel.pair[1]
										: rel.pair[0];
								const attitude =
									rel.pair[0] ===
									character.name
										? rel.aToB
										: rel.bToA;
								const feelings = attitude.feelings
									.slice(0, 2)
									.join(', ');
								return (
									<span
										key={otherChar}
										className="bt-relationship-badge"
										style={{
											borderColor:
												STATUS_COLORS[
													rel
														.status
												],
										}}
										title={`${rel.status}${feelings ? `: ${feelings}` : ''}`}
									>
										<span className="bt-rel-name">
											{otherChar}
										</span>
										<span
											className="bt-rel-status"
											style={{
												color: STATUS_COLORS[
													rel
														.status
												],
											}}
										>
											{rel.status}
										</span>
									</span>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
