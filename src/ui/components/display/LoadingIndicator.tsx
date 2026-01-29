import React from 'react';

export interface LoadingIndicatorProps {
	stepLabel: string;
	percentComplete?: number;
}

export function LoadingIndicator({ stepLabel, percentComplete }: LoadingIndicatorProps) {
	return (
		<div className="bt-state-container bt-extracting">
			<div className="bt-loading-indicator">
				<i className="fa-solid fa-fire fa-beat-fade"></i>
				<span>{stepLabel}</span>
			</div>
			{percentComplete !== undefined && (
				<div className="bt-progress-bar">
					<div
						className="bt-progress-fill"
						style={{ width: `${percentComplete}%` }}
					/>
				</div>
			)}
		</div>
	);
}
