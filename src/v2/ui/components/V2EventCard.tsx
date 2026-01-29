/**
 * V2 Event Card Component
 *
 * Displays an event with its kind, subkind, and details.
 * Optionally shows delete button for editable events.
 */

import React from 'react';
import type { Event, EventKind } from '../../types/event';

export interface V2EventCardProps {
	event: Event;
	isEditable: boolean;
	onDelete?: () => void;
}

// Icon mappings for event kinds
const EVENT_KIND_ICONS: Record<EventKind, string> = {
	time: 'fa-clock',
	location: 'fa-location-dot',
	forecast_generated: 'fa-cloud-sun',
	character: 'fa-user',
	relationship: 'fa-heart',
	topic_tone: 'fa-comments',
	tension: 'fa-bolt',
	narrative_description: 'fa-book',
	chapter: 'fa-bookmark',
};

// Color mappings for event kinds
const EVENT_KIND_COLORS: Record<EventKind, string> = {
	time: '#8b5cf6',
	location: '#f59e0b',
	forecast_generated: '#06b6d4',
	character: '#3b82f6',
	relationship: '#ec4899',
	topic_tone: '#6b7280',
	tension: '#ef4444',
	narrative_description: '#22c55e',
	chapter: '#a855f7',
};

/**
 * Get a human-readable summary of an event.
 */
function getEventSummary(event: Event): string {
	switch (event.kind) {
		case 'time': {
			if (event.subkind === 'initial') {
				return `Time set to ${event.time}`;
			}
			const d = event.delta;
			const parts: string[] = [];
			if (d.days) parts.push(`${d.days}d`);
			if (d.hours) parts.push(`${d.hours}h`);
			if (d.minutes) parts.push(`${d.minutes}m`);
			if (d.seconds) parts.push(`${d.seconds}s`);
			return `Time passed: ${parts.join(' ') || '0s'}`;
		}

		case 'location':
			if (event.subkind === 'moved') {
				return `Moved to ${event.newPosition} at ${event.newPlace}`;
			}
			if (event.subkind === 'prop_added') {
				return `Prop added: ${event.prop}`;
			}
			if (event.subkind === 'prop_removed') {
				return `Prop removed: ${event.prop}`;
			}
			return 'Location change';

		case 'forecast_generated':
			return `Forecast for ${event.areaName} (${event.startDate})`;

		case 'character':
			switch (event.subkind) {
				case 'appeared':
					return `${event.character} appeared`;
				case 'departed':
					return `${event.character} departed`;
				case 'position_changed':
					return `${event.character} moved to ${event.newValue}`;
				case 'activity_changed':
					return `${event.character}: ${event.newValue || 'idle'}`;
				case 'mood_added':
					return `${event.character} feeling ${event.mood}`;
				case 'mood_removed':
					return `${event.character} no longer ${event.mood}`;
				case 'outfit_changed':
					return `${event.character}'s ${event.slot}: ${event.newValue || 'removed'}`;
				case 'physical_added':
					return `${event.character}: ${event.physicalState}`;
				case 'physical_removed':
					return `${event.character} recovered from ${event.physicalState}`;
				default:
					return 'Character change';
			}

		case 'relationship':
			if (event.subkind === 'status_changed') {
				return `${event.pair[0]} & ${event.pair[1]}: ${event.newStatus}`;
			}
			if (event.subkind === 'subject') {
				return `${event.pair[0]} & ${event.pair[1]}: ${event.subject}`;
			}
			if (event.subkind === 'feeling_added') {
				return `${event.fromCharacter} feels ${event.value} toward ${event.towardCharacter}`;
			}
			if (event.subkind === 'feeling_removed') {
				return `${event.fromCharacter} no longer feels ${event.value} toward ${event.towardCharacter}`;
			}
			if (event.subkind === 'secret_added') {
				return `${event.fromCharacter} hides ${event.value} from ${event.towardCharacter}`;
			}
			if (event.subkind === 'secret_removed') {
				return `${event.fromCharacter} revealed ${event.value} to ${event.towardCharacter}`;
			}
			if (event.subkind === 'want_added') {
				return `${event.fromCharacter} wants ${event.value} from ${event.towardCharacter}`;
			}
			if (event.subkind === 'want_removed') {
				return `${event.fromCharacter} no longer wants ${event.value} from ${event.towardCharacter}`;
			}
			return 'Relationship change';

		case 'topic_tone':
			return `${event.topic} (${event.tone})`;

		case 'tension':
			return `Tension: ${event.type} ${event.level} (${event.direction})`;

		case 'narrative_description':
			return event.description;

		case 'chapter':
			if (event.subkind === 'ended') {
				return `Chapter ${event.chapterIndex + 1} ended (${event.reason})`;
			}
			if (event.subkind === 'described') {
				return `Chapter ${event.chapterIndex + 1}: ${event.title}`;
			}
			return 'Chapter event';

		default:
			return 'Unknown event';
	}
}

/**
 * Get subkind display name.
 */
function formatSubkind(subkind: string): string {
	return subkind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function V2EventCard({ event, isEditable, onDelete }: V2EventCardProps) {
	const icon = EVENT_KIND_ICONS[event.kind] || 'fa-circle';
	const color = EVENT_KIND_COLORS[event.kind] || '#6b7280';
	const subkind = 'subkind' in event ? (event as { subkind: string }).subkind : null;
	const summary = getEventSummary(event);

	return (
		<div className={`bt-v2-event-card ${event.deleted ? 'bt-deleted' : ''}`}>
			<div className="bt-event-card-header">
				<i className={`fa-solid ${icon}`} style={{ color }}></i>
				<span className="bt-event-kind">{event.kind}</span>
				{subkind && (
					<span className="bt-event-subkind">
						{formatSubkind(subkind)}
					</span>
				)}
				{isEditable && onDelete && (
					<button
						className="bt-event-delete-btn"
						onClick={onDelete}
						title="Delete this event"
					>
						<i className="fa-solid fa-trash"></i>
					</button>
				)}
			</div>
			<div className="bt-event-card-summary">{summary}</div>
			<div className="bt-event-card-meta">
				Message #{event.source.messageId}
				{event.source.swipeId > 0 && ` (swipe ${event.source.swipeId})`}
			</div>
		</div>
	);
}
