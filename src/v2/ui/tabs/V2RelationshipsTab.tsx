/**
 * V2 Relationships Tab
 *
 * Displays a list of relationships with character filtering.
 * Each relationship card has an edit button that opens the relationship editor.
 */

import React, { useState, useMemo } from 'react';
import type { Projection } from '../../types/snapshot';
import type { EventStore } from '../../store/EventStore';
import type { SwipeContext, MilestoneInfo } from '../../store/projection';
import { getMilestonesForPair } from '../../store/projection';
import { V2RelationshipCard } from '../components/V2RelationshipCard';

export interface V2RelationshipsTabProps {
	projection: Projection;
	eventStore: EventStore;
	swipeContext: SwipeContext;
	onEditRelationship: (pair: [string, string]) => void;
}

export function V2RelationshipsTab({
	projection,
	eventStore,
	swipeContext,
	onEditRelationship,
}: V2RelationshipsTabProps): React.ReactElement {
	const [characterFilter, setCharacterFilter] = useState<string>('all');

	// Get all unique character names from relationships
	const allCharacters = useMemo(() => {
		const characters = new Set<string>();
		Object.values(projection.relationships).forEach(rel => {
			characters.add(rel.pair[0]);
			characters.add(rel.pair[1]);
		});
		return Array.from(characters).sort();
	}, [projection.relationships]);

	// Get relationships as sorted array
	const relationships = useMemo(() => {
		return Object.values(projection.relationships).sort((a, b) => {
			// Sort by pair names
			const aKey = `${a.pair[0]}|${a.pair[1]}`;
			const bKey = `${b.pair[0]}|${b.pair[1]}`;
			return aKey.localeCompare(bKey);
		});
	}, [projection.relationships]);

	// Filter relationships by selected character
	const filteredRelationships = useMemo(() => {
		if (characterFilter === 'all') return relationships;
		return relationships.filter(
			rel => rel.pair[0] === characterFilter || rel.pair[1] === characterFilter,
		);
	}, [relationships, characterFilter]);

	// Get milestones for each relationship
	const milestonesMap = useMemo(() => {
		const map = new Map<string, MilestoneInfo[]>();
		for (const rel of relationships) {
			const key = `${rel.pair[0]}|${rel.pair[1]}`;
			const milestones = getMilestonesForPair(
				eventStore.getActiveEvents(),
				rel.pair[0],
				rel.pair[1],
				swipeContext,
			);
			map.set(key, milestones);
		}
		return map;
	}, [relationships, eventStore, swipeContext]);

	if (relationships.length === 0) {
		return (
			<div className="bt-v2-relationships-empty">
				<i className="fa-solid fa-heart-crack" />
				<div>No relationships tracked yet.</div>
				<div style={{ fontSize: '0.85rem', color: '#555' }}>
					Relationships are automatically created when two characters
					interact.
				</div>
			</div>
		);
	}

	return (
		<div className="bt-v2-relationships-container">
			{/* Character filter (only show if more than 2 characters) */}
			{allCharacters.length > 2 && (
				<div className="bt-v2-relationships-filter">
					<label htmlFor="character-filter">
						Filter by character:
					</label>
					<select
						id="character-filter"
						value={characterFilter}
						onChange={e => setCharacterFilter(e.target.value)}
					>
						<option value="all">All characters</option>
						{allCharacters.map(char => (
							<option key={char} value={char}>
								{char}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Relationships list */}
			<div className="bt-v2-relationships-list">
				{filteredRelationships.map(relationship => {
					const key = `${relationship.pair[0]}|${relationship.pair[1]}`;
					const milestones = milestonesMap.get(key) || [];
					return (
						<V2RelationshipCard
							key={key}
							relationship={relationship}
							milestones={milestones}
							onEdit={() =>
								onEditRelationship(
									relationship.pair,
								)
							}
						/>
					);
				})}
			</div>

			{filteredRelationships.length === 0 && characterFilter !== 'all' && (
				<div className="bt-v2-relationships-empty">
					<i className="fa-solid fa-filter" />
					<div>No relationships found for {characterFilter}.</div>
				</div>
			)}
		</div>
	);
}
