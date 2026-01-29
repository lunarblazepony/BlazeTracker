/**
 * V2 Character Card Component
 *
 * Displays a character's state with position, activity, mood, outfit, and relationships.
 * Works with v2 CharacterState and RelationshipState types directly.
 */

import React from 'react';
import type { CharacterState, RelationshipState } from '../../types/snapshot';
import type { CharacterOutfit, RelationshipStatus } from '../../types/common';

export interface V2CharacterCardProps {
	character: CharacterState;
	relationships?: RelationshipState[];
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

function formatOutfit(outfit: CharacterOutfit): string {
	const parts = [
		outfit.torso || 'topless',
		outfit.legs || 'bottomless',
		outfit.underwear || 'no underwear',
		outfit.head || null,
		outfit.neck || null,
		outfit.jacket || null,
		outfit.back || null,
		outfit.socks || null,
		outfit.footwear || null,
	];
	return parts.filter((v): v is string => v !== null).join(', ');
}

export function V2CharacterCard({ character, relationships }: V2CharacterCardProps) {
	const mood = character.mood.length > 0 ? character.mood.join(', ') : 'unknown';

	// Filter relationships to those involving this character (case-insensitive)
	const charName = character.name.toLowerCase();
	const charRelationships =
		relationships?.filter(
			r =>
				r.pair[0].toLowerCase() === charName ||
				r.pair[1].toLowerCase() === charName,
		) ?? [];

	return (
		<div className="bt-character">
			<div className="bt-char-header">
				<strong>{character.name}</strong>
				{character.profile && (
					<span className="bt-char-profile-basic">
						{character.profile.sex}/{character.profile.species},{' '}
						{character.profile.age}
					</span>
				)}
				<span className="bt-char-mood">{mood}</span>
			</div>

			{character.profile && (
				<div className="bt-char-profile-tags">
					<span
						className="bt-profile-appearance"
						title={`Appearance: ${character.profile.appearance.join(', ')}`}
					>
						<i className="fa-solid fa-eye"></i>
						{character.profile.appearance
							.slice(0, 3)
							.join(', ')}
						{character.profile.appearance.length > 3 && '…'}
					</span>
					<span
						className="bt-profile-personality"
						title={`Personality: ${character.profile.personality.join(', ')}`}
					>
						<i className="fa-solid fa-brain"></i>
						{character.profile.personality
							.slice(0, 3)
							.join(', ')}
						{character.profile.personality.length > 3 && '…'}
					</span>
				</div>
			)}

			<div className="bt-char-position">
				<i className="fa-solid fa-location-crosshairs" title="Position"></i>
				<span>{character.position || 'unknown'}</span>
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

				{character.physicalState.length > 0 && (
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

				{charRelationships.length > 0 && (
					<div className="bt-char-relationships">
						<i
							className="fa-solid fa-heart"
							title="Relationships"
						></i>
						<div className="bt-relationship-badges">
							{charRelationships.map(rel => {
								const isFirst =
									rel.pair[0].toLowerCase() ===
									charName;
								const otherChar = isFirst
									? rel.pair[1]
									: rel.pair[0];
								const attitude = isFirst
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
