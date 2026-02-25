import { describe, it, expect } from 'vitest';
import { getMessagesSinceLastShakeup, addShakeupTrigger } from './history';
import type { ShakeupHistory } from './types';
import { createEmptyShakeupHistory } from './types';
import type { SwipeContext } from '../store/projection';

function makeSwipeContext(swipeMap: Record<number, number> = {}): SwipeContext {
	return {
		getCanonicalSwipeId: (messageId: number) => swipeMap[messageId] ?? 0,
	};
}

describe('getMessagesSinceLastShakeup', () => {
	it('returns currentMessageId when history is empty', () => {
		const history = createEmptyShakeupHistory();
		const swipeContext = makeSwipeContext();
		expect(getMessagesSinceLastShakeup(history, 15, swipeContext)).toBe(15);
	});

	it('returns distance from most recent canonical trigger', () => {
		const history: ShakeupHistory = {
			triggers: [
				{ messageId: 5, swipeId: 0 },
				{ messageId: 10, swipeId: 0 },
			],
		};
		const swipeContext = makeSwipeContext();
		expect(getMessagesSinceLastShakeup(history, 18, swipeContext)).toBe(8);
	});

	it('excludes non-canonical triggers', () => {
		const history: ShakeupHistory = {
			triggers: [
				{ messageId: 5, swipeId: 0 },
				{ messageId: 12, swipeId: 1 }, // non-canonical (canonical is 0)
			],
		};
		const swipeContext = makeSwipeContext({ 12: 0 }); // canonical swipe for msg 12 is 0
		// msg 12 trigger has swipeId 1 but canonical is 0, so excluded
		expect(getMessagesSinceLastShakeup(history, 18, swipeContext)).toBe(13);
	});

	it('includes trigger when it matches canonical swipe', () => {
		const history: ShakeupHistory = {
			triggers: [
				{ messageId: 5, swipeId: 0 },
				{ messageId: 12, swipeId: 2 }, // this IS canonical
			],
		};
		const swipeContext = makeSwipeContext({ 12: 2 }); // canonical swipe for msg 12 is 2
		expect(getMessagesSinceLastShakeup(history, 18, swipeContext)).toBe(6);
	});

	it('handles single trigger', () => {
		const history: ShakeupHistory = {
			triggers: [{ messageId: 3, swipeId: 0 }],
		};
		const swipeContext = makeSwipeContext();
		expect(getMessagesSinceLastShakeup(history, 10, swipeContext)).toBe(7);
	});

	it('returns 0 when last trigger is at current message', () => {
		const history: ShakeupHistory = {
			triggers: [{ messageId: 10, swipeId: 0 }],
		};
		const swipeContext = makeSwipeContext();
		expect(getMessagesSinceLastShakeup(history, 10, swipeContext)).toBe(0);
	});
});

describe('addShakeupTrigger', () => {
	it('appends trigger to history', () => {
		const history = createEmptyShakeupHistory();
		addShakeupTrigger(history, { messageId: 5, swipeId: 0 });
		expect(history.triggers).toHaveLength(1);
		expect(history.triggers[0]).toEqual({ messageId: 5, swipeId: 0 });
	});

	it('accumulates multiple triggers', () => {
		const history = createEmptyShakeupHistory();
		addShakeupTrigger(history, { messageId: 5, swipeId: 0 });
		addShakeupTrigger(history, { messageId: 12, swipeId: 1 });
		expect(history.triggers).toHaveLength(2);
	});
});
