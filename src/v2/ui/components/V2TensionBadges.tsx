/**
 * V2 Tension Badges Component
 *
 * Displays tension level, type, and direction as color-coded badges.
 * Works with v2 types directly - no legacy dependencies.
 */

import React from 'react';
import type { TensionLevel, TensionType, TensionDirection } from '../../types/common';

export interface V2TensionBadgesProps {
	tension: {
		level: TensionLevel;
		type: TensionType;
		direction: TensionDirection;
	};
}

// Icon mappings
const TENSION_TYPE_ICONS: Record<TensionType, string> = {
	conversation: 'fa-comments',
	confrontation: 'fa-burst',
	intimate: 'fa-heart',
	suspense: 'fa-clock',
	vulnerable: 'fa-shield-halved',
	celebratory: 'fa-champagne-glasses',
	negotiation: 'fa-handshake',
};

const TENSION_LEVEL_ICONS: Record<TensionLevel, string> = {
	relaxed: 'fa-mug-hot',
	aware: 'fa-eye',
	guarded: 'fa-shield-halved',
	tense: 'fa-face-grimace',
	charged: 'fa-bolt',
	volatile: 'fa-fire',
	explosive: 'fa-explosion',
};

const TENSION_DIRECTION_ICONS: Record<TensionDirection, string> = {
	escalating: 'fa-arrow-trend-up',
	stable: 'fa-grip-lines',
	decreasing: 'fa-arrow-trend-down',
};

// Color mappings
const TENSION_TYPE_COLORS: Record<TensionType, string> = {
	conversation: '#6b7280',
	confrontation: '#ef4444',
	intimate: '#ec4899',
	suspense: '#8b5cf6',
	vulnerable: '#06b6d4',
	celebratory: '#eab308',
	negotiation: '#f97316',
};

const TENSION_LEVEL_COLORS: Record<TensionLevel, string> = {
	relaxed: '#6b7280',
	aware: '#3b82f6',
	guarded: '#22c55e',
	tense: '#f59e0b',
	charged: '#f97316',
	volatile: '#ef4444',
	explosive: '#dc2626',
};

const TENSION_DIRECTION_COLORS: Record<TensionDirection, string> = {
	escalating: '#ef4444',
	stable: '#6b7280',
	decreasing: '#22c55e',
};

export function V2TensionBadges({ tension }: V2TensionBadgesProps) {
	const typeIcon = TENSION_TYPE_ICONS[tension.type] || 'fa-circle';
	const levelIcon = TENSION_LEVEL_ICONS[tension.level] || 'fa-circle';
	const directionIcon = TENSION_DIRECTION_ICONS[tension.direction] || 'fa-circle';

	const typeColor = TENSION_TYPE_COLORS[tension.type] || '#6b7280';
	const levelColor = TENSION_LEVEL_COLORS[tension.level] || '#6b7280';
	const directionColor = TENSION_DIRECTION_COLORS[tension.direction] || '#6b7280';

	return (
		<div className="bt-scene-tension">
			<span className="bt-tension-type" title={tension.type}>
				<i
					className={`fa-solid ${typeIcon}`}
					style={{ color: typeColor }}
				></i>
				{tension.type}
			</span>
			<span className="bt-tension-level" title={tension.level}>
				<i
					className={`fa-solid ${levelIcon}`}
					style={{ color: levelColor }}
				></i>
				{tension.level}
			</span>
			<span className="bt-tension-direction" title={tension.direction}>
				<i
					className={`fa-solid ${directionIcon}`}
					style={{ color: directionColor }}
				></i>
				{tension.direction}
			</span>
		</div>
	);
}
