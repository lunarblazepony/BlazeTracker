/**
 * Build Tension Points Utility
 *
 * Builds an array of tension data points from all tension events on the canonical path.
 * Used by V2TensionGraph for time-based visualization.
 */

import type { EventStore } from '../../store/EventStore';
import type { SwipeContext } from '../../store/projection';
import {
	filterCanonicalEvents,
	filterActiveEvents,
	filterEventsUpToMessage,
} from '../../store/projection';
import type { TensionEvent } from '../../types/event';
import { isTensionEvent } from '../../types/event';
import type { TensionLevel, TensionType, TensionDirection } from '../../types/common';
import { TENSION_LEVELS, deserializeMoment } from '../../types/common';

/**
 * A point on the tension graph.
 */
export interface TensionPoint {
	/** Unix timestamp (for Recharts) */
	narrativeTime: number;
	/** Message ID where this tension was recorded */
	messageId: number;
	/** Tension level */
	level: TensionLevel;
	/** Tension type */
	type: TensionType;
	/** Tension direction */
	direction: TensionDirection;
	/** Numeric value 1-7 for Y-axis */
	levelValue: number;
}

/**
 * Get numeric value (1-7) for a tension level.
 */
export function getTensionLevelValue(level: TensionLevel): number {
	const index = TENSION_LEVELS.indexOf(level);
	return index >= 0 ? index + 1 : 1;
}

/**
 * Build tension points from all tension events on the canonical path.
 *
 * Starts with the initial snapshot's tension (if available) and includes
 * all tension events up to the specified message.
 *
 * @param store - The event store
 * @param swipeContext - Context for determining canonical swipes
 * @param upToMessage - Optional message ID to limit events (inclusive)
 * @returns Array of tension points sorted by narrative time
 */
export function buildTensionPoints(
	store: EventStore,
	swipeContext: SwipeContext,
	upToMessage?: number,
): TensionPoint[] {
	const points: TensionPoint[] = [];

	// Get initial snapshot for starting tension
	const initialSnapshot = store.initialSnapshot;
	if (!initialSnapshot) {
		return points;
	}

	// Add initial point from snapshot (if it has time and scene data)
	if (initialSnapshot.time && initialSnapshot.scene) {
		const snapshotTime = deserializeMoment(initialSnapshot.time);
		points.push({
			narrativeTime: snapshotTime.valueOf(),
			messageId: initialSnapshot.source.messageId,
			level: initialSnapshot.scene.tension.level,
			type: initialSnapshot.scene.tension.type,
			direction: initialSnapshot.scene.tension.direction,
			levelValue: getTensionLevelValue(initialSnapshot.scene.tension.level),
		});
	}

	// Get all canonical, active events
	const allEvents = store.events;
	let events = filterCanonicalEvents(allEvents, swipeContext);
	events = filterActiveEvents(events);

	// Filter up to message if specified
	if (upToMessage !== undefined) {
		events = filterEventsUpToMessage(events, upToMessage);
	}

	// Filter to tension events only
	const tensionEvents = events.filter(isTensionEvent) as TensionEvent[];

	// For each tension event, we need the narrative time
	// We project state at each tension event's message to get the time
	for (const event of tensionEvents) {
		try {
			const projection = store.projectStateAtMessage(
				event.source.messageId,
				swipeContext,
			);

			if (projection.time) {
				points.push({
					narrativeTime: projection.time.valueOf(),
					messageId: event.source.messageId,
					level: event.level,
					type: event.type,
					direction: event.direction,
					levelValue: getTensionLevelValue(event.level),
				});
			}
		} catch {
			// Skip if projection fails (shouldn't happen normally)
		}
	}

	// Sort by narrative time
	points.sort((a, b) => a.narrativeTime - b.narrativeTime);

	return points;
}
