/**
 * V2 State Read-Only Component
 *
 * Read-only display of time, location, climate, and scene from a projection.
 * Used in the EventStoreEditor for context display.
 */

import React from 'react';
import type { Projection } from '../../types/snapshot';
import { V2ClimateDisplay } from './V2ClimateDisplay';
import { V2TensionBadges } from './V2TensionBadges';

export interface V2StateReadOnlyProps {
	projection: Projection;
	temperatureUnit?: 'F' | 'C';
}

function formatLocation(location: { area: string; place: string; position: string }): string {
	const parts = [location.position, location.place, location.area];
	return parts.filter(Boolean).join(' · ');
}

export function V2StateReadOnly({ projection, temperatureUnit = 'F' }: V2StateReadOnlyProps) {
	return (
		<div className="bt-v2-state-readonly">
			{/* Time */}
			{projection.time && (
				<div className="bt-readonly-row">
					<i className="fa-regular fa-clock"></i>
					<span>
						{projection.time.format('ddd, MMM D YYYY, h:mm A')}
					</span>
				</div>
			)}

			{/* Location */}
			{projection.location && (
				<div className="bt-readonly-row">
					<i className="fa-solid fa-location-dot"></i>
					<span>{formatLocation(projection.location)}</span>
				</div>
			)}

			{/* Climate */}
			{projection.climate && (
				<div className="bt-readonly-row">
					<V2ClimateDisplay
						climate={projection.climate}
						temperatureUnit={temperatureUnit}
					/>
				</div>
			)}

			{/* Scene */}
			{projection.scene && (
				<div className="bt-readonly-section">
					<div className="bt-readonly-row bt-scene-info">
						<span className="bt-scene-topic">
							{projection.scene.topic}
						</span>
						<span className="bt-scene-tone">
							{projection.scene.tone}
						</span>
					</div>
					<V2TensionBadges tension={projection.scene.tension} />
				</div>
			)}

			{/* Props */}
			{projection.location?.props && projection.location.props.length > 0 && (
				<div className="bt-readonly-section">
					<div className="bt-readonly-label">Nearby Props</div>
					<div className="bt-props-list">
						{projection.location.props.map((prop, idx) => (
							<span key={idx} className="bt-tag">
								{prop}
							</span>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
