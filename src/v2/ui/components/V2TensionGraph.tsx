/**
 * V2 Tension Graph
 *
 * Visualizes tension levels over narrative time using Recharts.
 * Shows all 7 tension levels on Y-axis with icons.
 * X-axis shows time with regular intervals based on time span.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	ReferenceLine,
} from 'recharts';
import type { EventStore } from '../../store/EventStore';
import type { SwipeContext } from '../../store/projection';
import { TENSION_LEVELS } from '../../types/common';
import { buildTensionPoints, type TensionPoint } from '../utils/buildTensionPoints';
import { getTensionColor, getTensionLevelIcon, getTensionTypeColor } from '../icons';

// ============================================
// Types
// ============================================

export interface V2TensionGraphProps {
	store: EventStore;
	swipeContext: SwipeContext;
	upToMessage?: number;
	/** Graph height in pixels (default 250) */
	height?: number;
	/** Only show events from this chapter index (optional filter) */
	chapterFilter?: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_HEIGHT = 260;
const PADDING = { top: 20, right: 15, bottom: 5, left: 5 };

// ============================================
// Time Formatting Helpers
// ============================================

/**
 * Format timestamp for X-axis based on time span.
 */
function formatTimeAxis(timestamp: number, minTime: number, maxTime: number): string {
	const date = new Date(timestamp);
	const spanMs = maxTime - minTime;
	const spanHours = spanMs / (1000 * 60 * 60);

	if (spanHours < 2) {
		// Less than 2 hours: show h:mm a
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
		});
	} else if (spanHours < 24) {
		// Less than 24 hours: show h a
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			hour12: true,
		});
	} else {
		// 24+ hours: show MMM D
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
		});
	}
}

/**
 * Compute regular time tick intervals and domain based on time span.
 * Returns both ticks and the snapped domain that aligns with them.
 */
function computeTimeTicksAndDomain(
	minTime: number,
	maxTime: number,
): { ticks: number[]; domain: [number, number] } {
	if (minTime === maxTime) {
		// Single point - add padding
		const padding = 30 * 60 * 1000; // 30 minutes
		return {
			ticks: [minTime],
			domain: [minTime - padding, maxTime + padding],
		};
	}

	const spanMs = maxTime - minTime;
	const spanMinutes = spanMs / (1000 * 60);
	const spanHours = spanMinutes / 60;
	const spanDays = spanHours / 24;

	let intervalMs: number;
	if (spanMinutes < 30) {
		intervalMs = 5 * 60 * 1000; // 5 minutes
	} else if (spanHours < 2) {
		intervalMs = 15 * 60 * 1000; // 15 minutes
	} else if (spanHours < 6) {
		intervalMs = 30 * 60 * 1000; // 30 minutes
	} else if (spanHours < 24) {
		intervalMs = 60 * 60 * 1000; // 1 hour
	} else if (spanDays < 7) {
		intervalMs = 6 * 60 * 60 * 1000; // 6 hours
	} else {
		intervalMs = 24 * 60 * 60 * 1000; // 1 day
	}

	// Snap min down and max up to interval boundaries
	const snappedMin = Math.floor(minTime / intervalMs) * intervalMs;
	const snappedMax = Math.ceil(maxTime / intervalMs) * intervalMs;

	const ticks: number[] = [];
	for (let t = snappedMin; t <= snappedMax; t += intervalMs) {
		ticks.push(t);
	}

	// Limit to reasonable number of ticks (max 10)
	let finalTicks = ticks;
	if (ticks.length > 10) {
		const step = Math.ceil(ticks.length / 10);
		finalTicks = ticks.filter((_, i) => i % step === 0);
	}

	return {
		ticks: finalTicks,
		domain: [snappedMin, snappedMax],
	};
}

/**
 * Format timestamp for tooltip.
 */
function formatTimeTooltip(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

// ============================================
// Custom Y-Axis Tick Component
// ============================================

interface YAxisTickProps {
	x: number;
	y: number;
	payload: { value: number };
}

function CustomYAxisTick({ x, y, payload }: YAxisTickProps): React.ReactElement | null {
	const levelValue = payload.value;
	if (levelValue < 1 || levelValue > 7) return null;

	const level = TENSION_LEVELS[levelValue - 1];
	const iconClass = getTensionLevelIcon(level);
	const color = getTensionColor(level);

	return (
		<foreignObject x={x - 25} y={y - 8} width={24} height={16}>
			<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
				<i
					className={iconClass}
					style={{ color, fontSize: '12px' }}
					title={level}
				/>
			</div>
		</foreignObject>
	);
}

// ============================================
// Custom Tooltip Component
// ============================================

interface TooltipProps {
	active?: boolean;
	payload?: Array<{ payload: TensionPoint }>;
}

function CustomTooltip({ active, payload }: TooltipProps): React.ReactElement | null {
	if (!active || !payload || payload.length === 0) return null;

	const point = payload[0].payload;
	const color = getTensionColor(point.level);
	const iconClass = getTensionLevelIcon(point.level);

	return (
		<div
			style={{
				background: '#1a1a1a',
				border: '1px solid #444',
				borderRadius: '4px',
				padding: '0.5rem 0.75rem',
				fontSize: '0.85rem',
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: '0.5rem',
					marginBottom: '0.25rem',
				}}
			>
				<i className={iconClass} style={{ color }} />
				<span style={{ color, fontWeight: 600 }}>{point.level}</span>
				<span style={{ color: '#888' }}>({point.type})</span>
			</div>
			<div style={{ color: '#aaa', fontSize: '0.75rem' }}>
				{formatTimeTooltip(point.narrativeTime)}
			</div>
			<div style={{ color: '#666', fontSize: '0.7rem', marginTop: '0.15rem' }}>
				Message #{point.messageId}
			</div>
		</div>
	);
}

// ============================================
// Custom Dot Component (colored by tension type)
// ============================================

interface DotProps {
	cx?: number;
	cy?: number;
	payload?: TensionPoint;
}

function CustomDot({ cx, cy, payload }: DotProps): React.ReactElement | null {
	if (!cx || !cy || !payload) return null;

	const color = getTensionTypeColor(payload.type);

	return (
		<circle
			cx={cx}
			cy={cy}
			r={5}
			fill={color}
			stroke="#1a1a1a"
			strokeWidth={2}
			style={{ cursor: 'pointer' }}
		/>
	);
}

// ============================================
// Main Component
// ============================================

export function V2TensionGraph({
	store,
	swipeContext,
	upToMessage,
	height = DEFAULT_HEIGHT,
	chapterFilter,
}: V2TensionGraphProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	// Track container width with ResizeObserver (for future responsive features)
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		// ResizeObserver triggers re-renders when container changes
		const observer = new ResizeObserver(() => {
			// ResponsiveContainer handles width automatically
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	// Build tension points from events
	const allPoints = useMemo(
		() => buildTensionPoints(store, swipeContext, upToMessage),
		[store, swipeContext, upToMessage],
	);

	// Filter by chapter if specified
	const points = useMemo(() => {
		if (chapterFilter === undefined) return allPoints;
		return allPoints.filter(p => p.chapterIndex === chapterFilter);
	}, [allPoints, chapterFilter]);

	// Calculate time domain and ticks for X-axis
	const { timeTicks, timeDomain, minTime, maxTime } = useMemo(() => {
		if (points.length === 0) {
			return {
				timeTicks: [],
				timeDomain: [0, 0] as [number, number],
				minTime: 0,
				maxTime: 0,
			};
		}
		const times = points.map(p => p.narrativeTime);
		const min = Math.min(...times);
		const max = Math.max(...times);
		const { ticks, domain } = computeTimeTicksAndDomain(min, max);
		return { timeTicks: ticks, timeDomain: domain, minTime: min, maxTime: max };
	}, [points]);

	// Empty state
	if (points.length === 0) {
		return (
			<div className="bt-v2-tension-graph bt-empty" ref={containerRef}>
				<p style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>
					No tension data to graph.
				</p>
			</div>
		);
	}

	// Single point state - still show the graph with just one point
	if (points.length === 1) {
		const point = points[0];
		const color = getTensionColor(point.level);
		const iconClass = getTensionLevelIcon(point.level);

		return (
			<div className="bt-v2-tension-graph" ref={containerRef}>
				<div
					style={{
						height,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						color: '#888',
					}}
				>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem',
							marginBottom: '0.5rem',
						}}
					>
						<i
							className={iconClass}
							style={{ color, fontSize: '1.5rem' }}
						/>
						<span
							style={{
								color,
								fontWeight: 600,
								fontSize: '1.1rem',
							}}
						>
							{point.level}
						</span>
					</div>
					<div style={{ fontSize: '0.85rem' }}>
						Current tension level
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="bt-v2-tension-graph" ref={containerRef}>
			<ResponsiveContainer width="100%" height={height}>
				<LineChart data={points} margin={PADDING}>
					{/* Grid lines for each tension level */}
					{TENSION_LEVELS.map((level, index) => (
						<ReferenceLine
							key={level}
							y={index + 1}
							stroke="#333"
							strokeDasharray="2 2"
						/>
					))}

					{/* X-Axis: Time with regular intervals */}
					<XAxis
						dataKey="narrativeTime"
						type="number"
						scale="time"
						domain={timeDomain}
						ticks={timeTicks}
						tickFormatter={(value: number) =>
							formatTimeAxis(value, minTime, maxTime)
						}
						stroke="#555"
						tick={{ fill: '#888', fontSize: 10 }}
						axisLine={{ stroke: '#444' }}
						tickLine={{ stroke: '#444' }}
					/>

					{/* Y-Axis: Tension levels (1-7) with icons */}
					<YAxis
						domain={[1, 7]}
						ticks={[1, 2, 3, 4, 5, 6, 7]}
						interval={0}
						tick={
							CustomYAxisTick as unknown as React.ReactElement
						}
						axisLine={{ stroke: '#444' }}
						tickLine={false}
						width={30}
					/>

					{/* Tooltip */}
					<Tooltip
						content={<CustomTooltip />}
						cursor={{ stroke: '#555', strokeDasharray: '3 3' }}
					/>

					{/* Line with dots colored by tension type */}
					<Line
						type="monotone"
						dataKey="levelValue"
						stroke="#888"
						strokeWidth={2}
						dot={<CustomDot />}
						activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
						isAnimationActive={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
