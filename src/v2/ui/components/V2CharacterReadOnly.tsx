/**
 * V2 Character Read-Only Component
 *
 * Read-only display of a character's state.
 * Used in the EventStoreEditor for context display.
 */

import React from 'react';
import type { CharacterState } from '../../types/snapshot';
import type { CharacterOutfit } from '../../types/common';

export interface V2CharacterReadOnlyProps {
	character: CharacterState;
}

function formatOutfit(outfit: CharacterOutfit): string {
	const parts = [
		outfit.torso || 'topless',
		outfit.legs || 'bottomless',
		outfit.underwear || 'no underwear',
		outfit.head,
		outfit.neck,
		outfit.jacket,
		outfit.back,
		outfit.socks,
		outfit.footwear,
	];
	return parts.filter((v): v is string => v !== null).join(', ');
}

export function V2CharacterReadOnly({ character }: V2CharacterReadOnlyProps) {
	return (
		<div className="bt-v2-character-readonly">
			<div className="bt-char-readonly-header">
				<strong>{character.name}</strong>
				{character.profile && (
					<span className="bt-char-profile-basic">
						{character.profile.sex}/{character.profile.species},{' '}
						{character.profile.age}
					</span>
				)}
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

			<div className="bt-char-readonly-details">
				{/* Position */}
				<div className="bt-readonly-row">
					<i className="fa-solid fa-location-crosshairs"></i>
					<span>{character.position || 'unknown'}</span>
				</div>

				{/* Activity */}
				{character.activity && (
					<div className="bt-readonly-row">
						<i className="fa-solid fa-person-walking"></i>
						<span>{character.activity}</span>
					</div>
				)}

				{/* Mood */}
				{character.mood.length > 0 && (
					<div className="bt-readonly-row">
						<i className="fa-solid fa-face-smile"></i>
						<span>{character.mood.join(', ')}</span>
					</div>
				)}

				{/* Physical State */}
				{character.physicalState.length > 0 && (
					<div className="bt-readonly-row">
						<i className="fa-solid fa-heart-pulse"></i>
						<span>{character.physicalState.join(', ')}</span>
					</div>
				)}

				{/* Outfit */}
				<div className="bt-readonly-row">
					<i className="fa-solid fa-shirt"></i>
					<span>{formatOutfit(character.outfit)}</span>
				</div>
			</div>
		</div>
	);
}
