import { describe, it, expect } from 'vitest';
import { computeShakeupProbability, shouldTriggerShakeup } from './probability';

describe('computeShakeupProbability', () => {
	it('returns 0 when messagesSince is 0', () => {
		expect(computeShakeupProbability(0, 20)).toBe(0);
	});

	it('returns 1 when messagesSince equals maxMessages', () => {
		expect(computeShakeupProbability(20, 20)).toBe(1);
	});

	it('returns 1 when messagesSince exceeds maxMessages', () => {
		expect(computeShakeupProbability(30, 20)).toBe(1);
	});

	it('returns 1 when maxMessages is 0', () => {
		expect(computeShakeupProbability(5, 0)).toBe(1);
	});

	it('returns 0 for negative messagesSince', () => {
		expect(computeShakeupProbability(-1, 20)).toBe(0);
	});

	it('follows quadratic curve at known points (N=20)', () => {
		// msg 5 -> (5/20)^2 = 0.0625
		expect(computeShakeupProbability(5, 20)).toBeCloseTo(0.0625);
		// msg 10 -> (10/20)^2 = 0.25
		expect(computeShakeupProbability(10, 20)).toBeCloseTo(0.25);
		// msg 15 -> (15/20)^2 = 0.5625
		expect(computeShakeupProbability(15, 20)).toBeCloseTo(0.5625);
		// msg 18 -> (18/20)^2 = 0.81
		expect(computeShakeupProbability(18, 20)).toBeCloseTo(0.81);
	});

	it('works with different maxMessages values', () => {
		// N=10, msg 5 -> (5/10)^2 = 0.25
		expect(computeShakeupProbability(5, 10)).toBeCloseTo(0.25);
		// N=50, msg 25 -> (25/50)^2 = 0.25
		expect(computeShakeupProbability(25, 50)).toBeCloseTo(0.25);
	});
});

describe('shouldTriggerShakeup', () => {
	it('triggers when random value is below probability', () => {
		// probability at msg 10, N=20 = 0.25
		// random = 0.1 < 0.25 -> trigger
		expect(shouldTriggerShakeup(10, 20, 0.1)).toBe(true);
	});

	it('does not trigger when random value is above probability', () => {
		// probability at msg 10, N=20 = 0.25
		// random = 0.5 > 0.25 -> no trigger
		expect(shouldTriggerShakeup(10, 20, 0.5)).toBe(false);
	});

	it('always triggers at maxMessages', () => {
		// probability = 1.0, any random < 1 triggers
		expect(shouldTriggerShakeup(20, 20, 0.99)).toBe(true);
	});

	it('never triggers at 0 messages', () => {
		// probability = 0, no random value triggers
		expect(shouldTriggerShakeup(0, 20, 0.0)).toBe(false);
	});

	it('triggers at boundary when random equals probability', () => {
		// probability at msg 10, N=20 = 0.25
		// random = 0.25 is NOT < 0.25 -> no trigger
		expect(shouldTriggerShakeup(10, 20, 0.25)).toBe(false);
	});

	it('handles edge case of random value 0', () => {
		// Any positive probability should trigger with random=0
		expect(shouldTriggerShakeup(1, 20, 0.0)).toBe(true);
	});
});
