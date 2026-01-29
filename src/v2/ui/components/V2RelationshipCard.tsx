/**
 * V2 Relationship Card
 *
 * Displays a relationship between two characters with their status,
 * attitudes (feelings, secrets, wants), and milestones.
 */

import React from 'react';
import type { RelationshipState, RelationshipAttitude } from '../../types/snapshot';
import type { MilestoneInfo } from '../../store/projection';
import { getMilestoneDisplayName } from '../../store/projection';

export interface V2RelationshipCardProps {
	relationship: RelationshipState;
	milestones: MilestoneInfo[];
	onEdit: () => void;
}

export function V2RelationshipCard({
	relationship,
	milestones,
	onEdit,
}: V2RelationshipCardProps): React.ReactElement {
	const [charA, charB] = relationship.pair;

	return (
		<div className="bt-v2-relationship-card">
			{/* Header */}
			<div className="bt-v2-relationship-card-header">
				<div className="bt-v2-relationship-pair">
					<span className="bt-v2-relationship-char">{charA}</span>
					<span className="bt-v2-relationship-arrow">
						<i className="fa-solid fa-arrows-left-right" />
					</span>
					<span className="bt-v2-relationship-char">{charB}</span>
				</div>
				<span
					className={`bt-v2-relationship-status ${relationship.status}`}
				>
					{relationship.status}
				</span>
				<button className="bt-v2-relationship-edit-btn" onClick={onEdit}>
					<i className="fa-solid fa-pen" />
					Edit
				</button>
			</div>

			{/* Body with attitudes */}
			<div className="bt-v2-relationship-body">
				<AttitudeSection
					characterName={charA}
					otherName={charB}
					attitude={relationship.aToB}
				/>
				<AttitudeSection
					characterName={charB}
					otherName={charA}
					attitude={relationship.bToA}
				/>

				{/* Milestones */}
				{milestones.length > 0 && (
					<div className="bt-v2-milestones-section">
						<div className="bt-v2-milestones-header">
							<i className="fa-solid fa-star" />
							Milestones
						</div>
						<div className="bt-v2-milestones-list">
							{milestones.map(milestone => (
								<span
									key={`${milestone.subject}-${milestone.messageId}`}
									className="bt-v2-milestone-tag"
									title={
										milestone.description ||
										undefined
									}
								>
									{getMilestoneDisplayName(
										milestone.subject,
									)}
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

interface AttitudeSectionProps {
	characterName: string;
	otherName: string;
	attitude: RelationshipAttitude;
}

function AttitudeSection({
	characterName,
	otherName,
	attitude,
}: AttitudeSectionProps): React.ReactElement {
	const hasContent =
		attitude.feelings.length > 0 ||
		attitude.secrets.length > 0 ||
		attitude.wants.length > 0;

	return (
		<div className="bt-v2-attitude-section">
			<div className="bt-v2-attitude-header">
				<span className="name">{characterName}</span> towards {otherName}
			</div>

			{!hasContent ? (
				<div className="bt-v2-attitude-empty">No feelings recorded</div>
			) : (
				<>
					{attitude.feelings.length > 0 && (
						<div className="bt-v2-attitude-row">
							<span className="bt-v2-attitude-label">
								Feels
							</span>
							<div className="bt-v2-attitude-tags">
								{attitude.feelings.map(feeling => (
									<span
										key={feeling}
										className="bt-v2-tag-feeling"
									>
										{feeling}
									</span>
								))}
							</div>
						</div>
					)}
					{attitude.secrets.length > 0 && (
						<div className="bt-v2-attitude-row">
							<span className="bt-v2-attitude-label">
								Secrets
							</span>
							<div className="bt-v2-attitude-tags">
								{attitude.secrets.map(secret => (
									<span
										key={secret}
										className="bt-v2-tag-secret"
									>
										{secret}
									</span>
								))}
							</div>
						</div>
					)}
					{attitude.wants.length > 0 && (
						<div className="bt-v2-attitude-row">
							<span className="bt-v2-attitude-label">
								Wants
							</span>
							<div className="bt-v2-attitude-tags">
								{attitude.wants.map(want => (
									<span
										key={want}
										className="bt-v2-tag-want"
									>
										{want}
									</span>
								))}
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
