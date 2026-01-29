/**
 * Evaluate whether an extractor should run based on its run strategy.
 *
 * IMPORTANT: These strategies are SWIPE-AWARE. When checking past events or messages,
 * we only consider those where the swipeId matches the current canonical swipe for that messageId.
 *
 * Example: if we have producedAtMessages [{messageId: 4, swipeId: 7}, {messageId: 6, swipeId: 3}]
 * and the current canonical swipe for messageId 6 is 4 (not 3), we ignore that entry
 * because it's from an old swipe that's no longer active.
 */

import type { RunStrategy, RunStrategyContext } from '../types';
import type { MessageAndSwipe, Event } from '../../types';

/**
 * Check if two MessageAndSwipe references are equal.
 */
export function messageEquals(a: MessageAndSwipe, b: MessageAndSwipe): boolean {
	return a.messageId === b.messageId && a.swipeId === b.swipeId;
}

/**
 * Get the canonical swipe ID for a message from the chat context.
 */
function getCanonicalSwipeId(context: RunStrategyContext, messageId: number): number {
	const message = context.context.chat[messageId];
	return message?.swipe_id ?? 0;
}

/**
 * Check if a MessageAndSwipe is on the canonical swipe path.
 * Returns true if the swipeId matches the current canonical swipe for that messageId.
 */
function isOnCanonicalPath(context: RunStrategyContext, msg: MessageAndSwipe): boolean {
	const canonicalSwipeId = getCanonicalSwipeId(context, msg.messageId);
	return msg.swipeId === canonicalSwipeId;
}

/**
 * Check if an event is on the canonical swipe path.
 */
function isEventOnCanonicalPath(context: RunStrategyContext, event: Event): boolean {
	return isOnCanonicalPath(context, event.source);
}

/**
 * Check if a message is a user message.
 */
export function isUserMessage(context: RunStrategyContext): boolean {
	const msg = context.context.chat[context.currentMessage.messageId];
	return msg?.is_user === true;
}

/**
 * Check if a message is an assistant message.
 */
export function isAssistantMessage(context: RunStrategyContext): boolean {
	const msg = context.context.chat[context.currentMessage.messageId];
	return msg?.is_user === false && msg?.is_system === false;
}

/**
 * Evaluate a run strategy to determine if extractor should run.
 */
export function evaluateRunStrategy(strategy: RunStrategy, context: RunStrategyContext): boolean {
	switch (strategy.strategy) {
		case 'everyMessage':
			return true;

		case 'everyUserMessage':
			return isUserMessage(context);

		case 'everyAssistantMessage':
			return isAssistantMessage(context);

		case 'everyNMessages': {
			// Run every N messages (count from start, 0-indexed)
			return (context.currentMessage.messageId + 1) % strategy.n === 0;
		}

		case 'nSinceLastProducedEvents': {
			// Run if N messages have passed since this extractor last produced events
			// SWIPE-AWARE: Only consider entries on the canonical swipe path
			if (context.producedAtMessages.length === 0) return true;

			// Filter to only canonical swipe entries and find the latest valid one
			const canonicalProduced = context.producedAtMessages.filter(msg =>
				isOnCanonicalPath(context, msg),
			);
			if (canonicalProduced.length === 0) return true;

			const lastProduced = canonicalProduced[canonicalProduced.length - 1];
			const messagesSince =
				context.currentMessage.messageId - lastProduced.messageId;
			return messagesSince >= strategy.n;
		}

		case 'nSinceLastEventOfKind': {
			// Run if N messages have passed since last event of specified kind(s)
			// SWIPE-AWARE: Only consider events on the canonical swipe path
			const events = context.store.getActiveEvents();

			// Filter to matching kinds AND on canonical swipe path
			const matching = events.filter(
				e =>
					isEventOnCanonicalPath(context, e) &&
					strategy.kinds.some(
						k =>
							e.kind === k.kind &&
							('subkind' in e
								? e.subkind === k.subkind
								: !k.subkind),
					),
			);
			if (matching.length === 0) return true;

			const lastMatch = matching[matching.length - 1];
			const messagesSince =
				context.currentMessage.messageId - lastMatch.source.messageId;
			return messagesSince >= strategy.n;
		}

		case 'newEventsOfKind': {
			// Run if there are new events of specified kind(s) this turn
			return context.turnEvents.some(e =>
				strategy.kinds.some(
					k =>
						e.kind === k.kind &&
						('subkind' in e
							? e.subkind === k.subkind
							: !k.subkind),
				),
			);
		}

		case 'custom':
			return strategy.check(context);
	}
}
