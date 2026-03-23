import { describe, it, expect, vi } from 'vitest';
import { messageEquals, isUserMessage, isAssistantMessage, evaluateRunStrategy } from './shouldRun';
import type { RunStrategy, RunStrategyContext } from '../types';

function createTestContext(overrides: Partial<RunStrategyContext> = {}): RunStrategyContext {
	return {
		store: { getActiveEvents: () => [] } as any,
		context: {
			chat: [
				{
					mes: 'msg0',
					is_user: false,
					is_system: true,
					name: 'System',
					swipe_id: 0,
				},
				{
					mes: 'msg1',
					is_user: true,
					is_system: false,
					name: 'User',
					swipe_id: 0,
				},
				{
					mes: 'msg2',
					is_user: false,
					is_system: false,
					name: 'Bot',
					swipe_id: 0,
				},
				{
					mes: 'msg3',
					is_user: true,
					is_system: false,
					name: 'User',
					swipe_id: 0,
				},
				{
					mes: 'msg4',
					is_user: false,
					is_system: false,
					name: 'Bot',
					swipe_id: 0,
				},
				{
					mes: 'msg5',
					is_user: true,
					is_system: false,
					name: 'User',
					swipe_id: 0,
				},
			],
			characters: [],
			characterId: 0,
			name1: 'User',
			name2: 'Bot',
		},
		settings: {} as any,
		currentMessage: { messageId: 5, swipeId: 0 },
		turnEvents: [],
		ranAtMessages: [],
		producedAtMessages: [],
		...overrides,
	};
}

describe('messageEquals', () => {
	it('returns true when messageId and swipeId match', () => {
		expect(
			messageEquals({ messageId: 3, swipeId: 1 }, { messageId: 3, swipeId: 1 }),
		).toBe(true);
	});

	it('returns false when messageId differs', () => {
		expect(
			messageEquals({ messageId: 3, swipeId: 1 }, { messageId: 4, swipeId: 1 }),
		).toBe(false);
	});

	it('returns false when swipeId differs', () => {
		expect(
			messageEquals({ messageId: 3, swipeId: 1 }, { messageId: 3, swipeId: 2 }),
		).toBe(false);
	});
});

describe('isUserMessage', () => {
	it('returns true when current message has is_user=true', () => {
		const ctx = createTestContext({ currentMessage: { messageId: 1, swipeId: 0 } });
		expect(isUserMessage(ctx)).toBe(true);
	});

	it('returns false when current message has is_user=false', () => {
		const ctx = createTestContext({ currentMessage: { messageId: 2, swipeId: 0 } });
		expect(isUserMessage(ctx)).toBe(false);
	});
});

describe('isAssistantMessage', () => {
	it('returns true when is_user=false and is_system=false', () => {
		const ctx = createTestContext({ currentMessage: { messageId: 2, swipeId: 0 } });
		expect(isAssistantMessage(ctx)).toBe(true);
	});

	it('returns false when is_user=true', () => {
		const ctx = createTestContext({ currentMessage: { messageId: 1, swipeId: 0 } });
		expect(isAssistantMessage(ctx)).toBe(false);
	});

	it('returns false when is_system=true', () => {
		const ctx = createTestContext({ currentMessage: { messageId: 0, swipeId: 0 } });
		expect(isAssistantMessage(ctx)).toBe(false);
	});
});

describe('evaluateRunStrategy', () => {
	describe('everyMessage', () => {
		it('always returns true', () => {
			const strategy: RunStrategy = { strategy: 'everyMessage' };
			const ctx = createTestContext();
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});
	});

	describe('everyUserMessage', () => {
		it('returns true when current message is a user message', () => {
			const strategy: RunStrategy = { strategy: 'everyUserMessage' };
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('returns false when current message is an assistant message', () => {
			const strategy: RunStrategy = { strategy: 'everyUserMessage' };
			const ctx = createTestContext({
				currentMessage: { messageId: 4, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(false);
		});
	});

	describe('everyAssistantMessage', () => {
		it('returns true when current message is an assistant message', () => {
			const strategy: RunStrategy = { strategy: 'everyAssistantMessage' };
			const ctx = createTestContext({
				currentMessage: { messageId: 4, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('returns false when current message is a user message', () => {
			const strategy: RunStrategy = { strategy: 'everyAssistantMessage' };
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(false);
		});
	});

	describe('everyNMessages', () => {
		it('returns true when (messageId + 1) % n === 0', () => {
			const strategy: RunStrategy = { strategy: 'everyNMessages', n: 3 };
			const ctx = createTestContext({
				currentMessage: { messageId: 2, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('returns false when (messageId + 1) % n !== 0', () => {
			const strategy: RunStrategy = { strategy: 'everyNMessages', n: 3 };
			const ctx = createTestContext({
				currentMessage: { messageId: 3, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(false);
		});

		it('returns true for messageId=5 with n=3', () => {
			const strategy: RunStrategy = { strategy: 'everyNMessages', n: 3 };
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('respects offset parameter', () => {
			const strategy: RunStrategy = {
				strategy: 'everyNMessages',
				n: 3,
				offset: 1,
			};
			// (messageId + 1) % 3 === 1 → messageId=0: (0+1)%3=1 → true
			const ctx = createTestContext({
				currentMessage: { messageId: 0, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);

			// messageId=2: (2+1)%3=0 → false
			const ctx2 = createTestContext({
				currentMessage: { messageId: 2, swipeId: 0 },
			});
			expect(evaluateRunStrategy(strategy, ctx2)).toBe(false);
		});
	});

	describe('nSinceLastProducedEvents', () => {
		it('returns true when producedAtMessages is empty', () => {
			const strategy: RunStrategy = {
				strategy: 'nSinceLastProducedEvents',
				n: 3,
			};
			const ctx = createTestContext({ producedAtMessages: [] });
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('returns true when enough messages have passed since last production', () => {
			const strategy: RunStrategy = {
				strategy: 'nSinceLastProducedEvents',
				n: 3,
			};
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
				producedAtMessages: [{ messageId: 2, swipeId: 0 }],
			});
			// 5 - 2 = 3 >= 3 → true
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('returns false when not enough messages have passed', () => {
			const strategy: RunStrategy = {
				strategy: 'nSinceLastProducedEvents',
				n: 3,
			};
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
				producedAtMessages: [{ messageId: 3, swipeId: 0 }],
			});
			// 5 - 3 = 2 < 3 → false
			expect(evaluateRunStrategy(strategy, ctx)).toBe(false);
		});

		it('ignores producedAtMessages with non-canonical swipeId', () => {
			const strategy: RunStrategy = {
				strategy: 'nSinceLastProducedEvents',
				n: 3,
			};
			// Message 4 has canonical swipe_id=0 in chat, but producedAt has swipeId=5
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
				producedAtMessages: [{ messageId: 4, swipeId: 5 }],
			});
			// Non-canonical entry filtered out → no canonical entries → true
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});
	});

	describe('nSinceLastEventOfKind', () => {
		it('returns true when no matching events exist', () => {
			const strategy: RunStrategy = {
				strategy: 'nSinceLastEventOfKind',
				n: 2,
				kinds: [{ kind: 'time', subkind: 'delta' }],
			};
			const ctx = createTestContext({
				store: { getActiveEvents: () => [] } as any,
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('returns true when enough messages have passed since last matching event', () => {
			const strategy: RunStrategy = {
				strategy: 'nSinceLastEventOfKind',
				n: 2,
				kinds: [{ kind: 'time', subkind: 'delta' }],
			};
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
				store: {
					getActiveEvents: () => [
						{
							id: '1',
							kind: 'time',
							subkind: 'delta',
							source: { messageId: 3, swipeId: 0 },
							timestamp: 0,
							delta: {},
						},
					],
				} as any,
			});
			// 5 - 3 = 2 >= 2 → true
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('returns false when not enough messages have passed since last matching event', () => {
			const strategy: RunStrategy = {
				strategy: 'nSinceLastEventOfKind',
				n: 2,
				kinds: [{ kind: 'time', subkind: 'delta' }],
			};
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
				store: {
					getActiveEvents: () => [
						{
							id: '1',
							kind: 'time',
							subkind: 'delta',
							source: { messageId: 4, swipeId: 0 },
							timestamp: 0,
							delta: {},
						},
					],
				} as any,
			});
			// 5 - 4 = 1 < 2 → false
			expect(evaluateRunStrategy(strategy, ctx)).toBe(false);
		});

		it('ignores matching events with non-canonical swipeId', () => {
			const strategy: RunStrategy = {
				strategy: 'nSinceLastEventOfKind',
				n: 2,
				kinds: [{ kind: 'time', subkind: 'delta' }],
			};
			const ctx = createTestContext({
				currentMessage: { messageId: 5, swipeId: 0 },
				store: {
					getActiveEvents: () => [
						{
							id: '1',
							kind: 'time',
							subkind: 'delta',
							source: { messageId: 4, swipeId: 7 },
							timestamp: 0,
							delta: {},
						},
					],
				} as any,
			});
			// Non-canonical swipe → filtered out → no matches → true
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});
	});

	describe('newEventsOfKind', () => {
		it('returns true when turnEvents has a matching event', () => {
			const strategy: RunStrategy = {
				strategy: 'newEventsOfKind',
				kinds: [{ kind: 'location', subkind: 'moved' }],
			};
			const ctx = createTestContext({
				turnEvents: [
					{
						id: '1',
						kind: 'location',
						subkind: 'moved',
						source: { messageId: 5, swipeId: 0 },
						timestamp: 0,
						newArea: 'forest',
						newPlace: 'clearing',
						newPosition: 'center',
					} as any,
				],
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
		});

		it('returns false when turnEvents has no matching event', () => {
			const strategy: RunStrategy = {
				strategy: 'newEventsOfKind',
				kinds: [{ kind: 'location', subkind: 'moved' }],
			};
			const ctx = createTestContext({
				turnEvents: [
					{
						id: '1',
						kind: 'time',
						subkind: 'delta',
						source: { messageId: 5, swipeId: 0 },
						timestamp: 0,
						delta: {},
					} as any,
				],
			});
			expect(evaluateRunStrategy(strategy, ctx)).toBe(false);
		});

		it('returns false when turnEvents is empty', () => {
			const strategy: RunStrategy = {
				strategy: 'newEventsOfKind',
				kinds: [{ kind: 'location', subkind: 'moved' }],
			};
			const ctx = createTestContext({ turnEvents: [] });
			expect(evaluateRunStrategy(strategy, ctx)).toBe(false);
		});
	});

	describe('custom', () => {
		it('calls the check function with the context', () => {
			const check = vi.fn().mockReturnValue(true);
			const strategy: RunStrategy = { strategy: 'custom', check };
			const ctx = createTestContext();
			expect(evaluateRunStrategy(strategy, ctx)).toBe(true);
			expect(check).toHaveBeenCalledWith(ctx);
		});
	});
});
