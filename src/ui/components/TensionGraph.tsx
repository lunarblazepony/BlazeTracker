// ============================================
// Tension Graph Component (using Recharts)
// ============================================

import React, { useMemo } from 'react';
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	ReferenceLine,
} from 'recharts';
import type { TimestampedEvent, TensionLevel } from '../../types/state';
import { getTensionColor, getTensionValue, getTensionLevelIcon } from '../icons';

// ============================================
// Types
// ============================================

interface TensionGraphProps {
	events: TimestampedEvent[];
	/** If not provided, graph will fill its container */
	width?: number;
	/** If not provided, defaults to 250 */
	height?: number;
}

interface DataPoint {
	time: number; // minutes from epoch for X axis
	tension: number; // 1-7 for Y axis
	tensionLevel: TensionLevel;
	tensionType?: string;
	summary: string;
	displayTime: string;
}

// ============================================
// Constants
// ============================================

const TENSION_LEVELS: TensionLevel[] = [
	'relaxed',
	'aware',
	'guarded',
	'tense',
	'charged',
	'volatile',
	'explosive',
];

// ============================================
// Helpers
// ============================================

/**
 * Convert a timestamp to total minutes for X-axis positioning.
 */
function timestampToMinutes(ts: TimestampedEvent['timestamp']): number {
	const day = ts.day ?? 1;
	return day * 24 * 60 + ts.hour * 60 + ts.minute;
}

/**
 * Format minutes to display time string.
 */
function formatTime(minutes: number): string {
	const minutesInDay = minutes % (24 * 60);
	const hour = Math.floor(minutesInDay / 60) % 24;
	const minute = Math.floor(minutesInDay % 60);
	const hour12 = hour % 12 || 12;
	const ampm = hour < 12 ? 'AM' : 'PM';
	return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Custom Y-axis tick with tension icon.
 */
function CustomYAxisTick(props: {
	x?: string | number;
	y?: string | number;
	payload?: { value: number };
}) {
	const { x, y, payload } = props;
	if (x === undefined || y === undefined || !payload) return null;

	const level = TENSION_LEVELS[payload.value - 1];
	if (!level) return null;
	const iconClass = getTensionLevelIcon(level);
	const color = getTensionColor(level);

	return (
		<g transform={`translate(${x},${y})`}>
			<foreignObject x={-30} y={-10} width={25} height={20}>
				<i
					className={iconClass}
					style={{ color, fontSize: '14px' }}
					title={level}
				/>
			</foreignObject>
		</g>
	);
}

/**
 * Custom tooltip content.
 */
function CustomTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{ payload: DataPoint }>;
}) {
	if (!active || !payload || !payload[0]) return null;

	const data = payload[0].payload;
	const color = getTensionColor(data.tensionLevel);

	return (
		<div
			className="bt-graph-tooltip"
			style={{ position: 'relative', transform: 'none' }}
		>
			<div className="bt-tooltip-level" style={{ color }}>
				{data.tensionLevel} {data.tensionType && `(${data.tensionType})`}
			</div>
			<div className="bt-tooltip-time">{data.displayTime}</div>
			<div className="bt-tooltip-summary">{data.summary}</div>
		</div>
	);
}

/**
 * Custom dot renderer with tension-based colors.
 */
function CustomDot(props: { cx?: number; cy?: number; payload?: DataPoint }) {
	const { cx, cy, payload } = props;
	if (cx === undefined || cy === undefined || !payload) return null;

	return (
		<circle
			cx={cx}
			cy={cy}
			r={6}
			fill={getTensionColor(payload.tensionLevel)}
			stroke="#fff"
			strokeWidth={2}
			className="bt-graph-point"
		/>
	);
}

// ============================================
// Component
// ============================================

export function TensionGraph({ events, width, height = 250 }: TensionGraphProps) {
	// Convert events to chart data
	const data = useMemo<DataPoint[]>(() => {
		return events.map(event => ({
			time: timestampToMinutes(event.timestamp),
			tension: getTensionValue(event.tensionLevel),
			tensionLevel: event.tensionLevel,
			tensionType: event.tensionType,
			summary: event.summary,
			displayTime: formatTime(timestampToMinutes(event.timestamp)),
		}));
	}, [events]);

	// Calculate time domain
	const timeDomain = useMemo(() => {
		if (data.length === 0) return [0, 1];
		const times = data.map(d => d.time);
		const min = Math.min(...times);
		const max = Math.max(...times);
		// Add small padding if all events at same time
		if (min === max) return [min - 30, max + 30];
		return [min, max];
	}, [data]);

	if (events.length === 0) {
		return (
			<div className="bt-tension-graph bt-empty">
				<p>No events to graph.</p>
			</div>
		);
	}

	const chart = (
		<LineChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 40 }}>
			{/* Grid lines for each tension level */}
			{TENSION_LEVELS.map((_, i) => (
				<ReferenceLine
					key={i}
					y={i + 1}
					stroke="#333"
					strokeDasharray="2 2"
				/>
			))}

			<XAxis
				dataKey="time"
				type="number"
				domain={timeDomain}
				tickFormatter={formatTime}
				stroke="#666"
				tick={{ fill: '#999', fontSize: 10 }}
				tickLine={{ stroke: '#666' }}
			/>

			<YAxis
				domain={[1, 7]}
				ticks={[1, 2, 3, 4, 5, 6, 7]}
				tick={CustomYAxisTick}
				stroke="#666"
				tickLine={{ stroke: '#666' }}
				width={40}
			/>

			<Tooltip content={<CustomTooltip />} />

			<Line
				type="linear"
				dataKey="tension"
				stroke="#888"
				strokeWidth={2}
				dot={<CustomDot />}
				activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
				isAnimationActive={false}
			/>
		</LineChart>
	);

	// Use ResponsiveContainer if no fixed width
	if (width) {
		return (
			<div className="bt-tension-graph" style={{ width, height }}>
				{React.cloneElement(chart, { width, height })}
			</div>
		);
	}

	return (
		<div className="bt-tension-graph">
			<ResponsiveContainer width="100%" height={height}>
				{chart}
			</ResponsiveContainer>
		</div>
	);
}
