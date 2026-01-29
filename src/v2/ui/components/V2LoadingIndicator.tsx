/**
 * V2 Loading Indicator Component
 *
 * Shows extraction progress with spinner and progress bar.
 * Works with v2 types directly - no legacy dependencies.
 */

import React from 'react';

export interface V2LoadingIndicatorProps {
	step: string;
	percentComplete: number;
	label?: string;
	calibrating?: boolean;
}

export function V2LoadingIndicator({
	step,
	percentComplete,
	label,
	calibrating = false,
}: V2LoadingIndicatorProps) {
	const displayLabel = label ?? step;

	return (
		<div className="bt-state-container bt-extracting">
			<div className="bt-loading-indicator">
				<i className="fa-solid fa-fire fa-beat-fade"></i>
				<span>{displayLabel}</span>
			</div>
			{calibrating ? (
				<div className="bt-progress-bar">
					<div className="bt-progress-fill bt-progress-calibrating" />
				</div>
			) : (
				percentComplete > 0 && (
					<div className="bt-progress-bar">
						<div
							className="bt-progress-fill"
							style={{ width: `${percentComplete}%` }}
						/>
					</div>
				)
			)}
		</div>
	);
}
