/**
 * Tests for relationship status gating rules.
 */

import { describe, it, expect } from 'vitest';
import {
	FRIENDLY_GATE_SUBJECTS,
	CLOSE_GATE_SUBJECTS,
	INTIMATE_GATE_SUBJECTS,
	getStatusRank,
	getStatusFromRank,
	inferMaximumStatus,
	applyStatusGating,
} from './statusGating';
import type { Subject } from '../../types/subject';

describe('statusGating', () => {
	describe('gate subject sets', () => {
		it('FRIENDLY_GATE_SUBJECTS contains expected subjects', () => {
			expect(FRIENDLY_GATE_SUBJECTS.has('laugh')).toBe(true);
			expect(FRIENDLY_GATE_SUBJECTS.has('gift')).toBe(true);
			expect(FRIENDLY_GATE_SUBJECTS.has('shared_meal')).toBe(true);
			expect(FRIENDLY_GATE_SUBJECTS.has('compliment')).toBe(true);
		});

		it('CLOSE_GATE_SUBJECTS contains expected subjects', () => {
			expect(CLOSE_GATE_SUBJECTS.has('emotionally_intimate')).toBe(true);
			expect(CLOSE_GATE_SUBJECTS.has('secret_shared')).toBe(true);
			expect(CLOSE_GATE_SUBJECTS.has('confession')).toBe(true);
			expect(CLOSE_GATE_SUBJECTS.has('vulnerability')).toBe(true);
		});

		it('INTIMATE_GATE_SUBJECTS contains expected subjects', () => {
			expect(INTIMATE_GATE_SUBJECTS.has('intimate_kiss')).toBe(true);
			expect(INTIMATE_GATE_SUBJECTS.has('i_love_you')).toBe(true);
			expect(INTIMATE_GATE_SUBJECTS.has('date')).toBe(true);
			expect(INTIMATE_GATE_SUBJECTS.has('marriage')).toBe(true);
		});
	});

	describe('getStatusRank', () => {
		it('returns correct ranks for positive statuses', () => {
			expect(getStatusRank('strangers')).toBe(0);
			expect(getStatusRank('acquaintances')).toBe(1);
			expect(getStatusRank('friendly')).toBe(2);
			expect(getStatusRank('close')).toBe(3);
			expect(getStatusRank('intimate')).toBe(4);
		});

		it('returns correct ranks for negative statuses', () => {
			expect(getStatusRank('hostile')).toBe(-2);
			expect(getStatusRank('strained')).toBe(-1);
		});

		it('returns 0 for complicated (special case)', () => {
			expect(getStatusRank('complicated')).toBe(0);
		});
	});

	describe('getStatusFromRank', () => {
		it('returns correct status for each rank', () => {
			expect(getStatusFromRank(-2)).toBe('hostile');
			expect(getStatusFromRank(-1)).toBe('strained');
			expect(getStatusFromRank(0)).toBe('strangers');
			expect(getStatusFromRank(1)).toBe('acquaintances');
			expect(getStatusFromRank(2)).toBe('friendly');
			expect(getStatusFromRank(3)).toBe('close');
			expect(getStatusFromRank(4)).toBe('intimate');
		});

		it('defaults to acquaintances for unknown ranks', () => {
			expect(getStatusFromRank(5)).toBe('acquaintances');
			expect(getStatusFromRank(-3)).toBe('acquaintances');
		});
	});

	describe('inferMaximumStatus', () => {
		it('returns acquaintances with no milestones', () => {
			expect(inferMaximumStatus(new Set())).toBe('acquaintances');
		});

		it('returns friendly with friendly gate subjects', () => {
			const milestones = new Set<Subject>(['laugh']);
			expect(inferMaximumStatus(milestones)).toBe('friendly');
		});

		it('returns close with close gate subjects', () => {
			const milestones = new Set<Subject>(['secret_shared']);
			expect(inferMaximumStatus(milestones)).toBe('close');
		});

		it('returns intimate with intimate gate subjects', () => {
			const milestones = new Set<Subject>(['intimate_kiss']);
			expect(inferMaximumStatus(milestones)).toBe('intimate');
		});

		it('returns highest tier when multiple gates met', () => {
			const milestones = new Set<Subject>([
				'laugh',
				'secret_shared',
				'intimate_kiss',
			]);
			expect(inferMaximumStatus(milestones)).toBe('intimate');
		});
	});

	describe('applyStatusGating', () => {
		describe('positive progression with milestone caps', () => {
			it('allows acquaintances without milestones', () => {
				const result = applyStatusGating(
					'acquaintances',
					'strangers',
					new Set(),
				);
				expect(result).toBe('acquaintances');
			});

			it('caps at acquaintances without friendly milestones', () => {
				const result = applyStatusGating(
					'friendly',
					'strangers',
					new Set(),
				);
				expect(result).toBe('acquaintances');
			});

			it('allows friendly with friendly milestone', () => {
				const milestones = new Set<Subject>(['laugh']);
				const result = applyStatusGating(
					'friendly',
					'acquaintances',
					milestones,
				);
				expect(result).toBe('friendly');
			});

			it('caps at friendly without close milestones', () => {
				const milestones = new Set<Subject>(['laugh']);
				const result = applyStatusGating('close', 'friendly', milestones);
				expect(result).toBe('friendly');
			});

			it('allows close with close milestone', () => {
				const milestones = new Set<Subject>(['laugh', 'secret_shared']);
				const result = applyStatusGating('close', 'friendly', milestones);
				expect(result).toBe('close');
			});

			it('caps at close without intimate milestones', () => {
				const milestones = new Set<Subject>(['laugh', 'secret_shared']);
				const result = applyStatusGating('intimate', 'close', milestones);
				expect(result).toBe('close');
			});

			it('allows intimate with intimate milestone', () => {
				const milestones = new Set<Subject>([
					'laugh',
					'secret_shared',
					'intimate_kiss',
				]);
				const result = applyStatusGating('intimate', 'close', milestones);
				expect(result).toBe('intimate');
			});
		});

		describe('one-step progression rule', () => {
			it('prevents jumping from strangers to close', () => {
				const milestones = new Set<Subject>(['laugh', 'secret_shared']);
				const result = applyStatusGating('close', 'strangers', milestones);
				// One step from strangers (rank 0) is acquaintances (rank 1)
				expect(result).toBe('acquaintances');
			});

			it('prevents jumping from acquaintances to intimate', () => {
				const milestones = new Set<Subject>([
					'laugh',
					'secret_shared',
					'intimate_kiss',
				]);
				const result = applyStatusGating(
					'intimate',
					'acquaintances',
					milestones,
				);
				// One step from acquaintances (rank 1) is friendly (rank 2)
				expect(result).toBe('friendly');
			});

			it('allows staying at same level', () => {
				const result = applyStatusGating(
					'friendly',
					'friendly',
					new Set<Subject>(['laugh']),
				);
				expect(result).toBe('friendly');
			});
		});

		describe('negative relationships (always allowed)', () => {
			it('allows strained from any status without milestones', () => {
				expect(applyStatusGating('strained', 'strangers', new Set())).toBe(
					'strained',
				);
				expect(applyStatusGating('strained', 'friendly', new Set())).toBe(
					'strained',
				);
				expect(applyStatusGating('strained', 'intimate', new Set())).toBe(
					'strained',
				);
			});

			it('allows hostile from any status without milestones', () => {
				expect(applyStatusGating('hostile', 'strangers', new Set())).toBe(
					'hostile',
				);
				expect(applyStatusGating('hostile', 'friendly', new Set())).toBe(
					'hostile',
				);
				expect(applyStatusGating('hostile', 'intimate', new Set())).toBe(
					'hostile',
				);
			});

			it('allows going from intimate to strained (relationship deterioration)', () => {
				// Even with intimate milestones, can still become strained
				const milestones = new Set<Subject>([
					'intimate_kiss',
					'i_love_you',
				]);
				const result = applyStatusGating(
					'strained',
					'intimate',
					milestones,
				);
				expect(result).toBe('strained');
			});
		});

		describe('complicated status', () => {
			it('allows complicated from any status without gating', () => {
				expect(
					applyStatusGating('complicated', 'strangers', new Set()),
				).toBe('complicated');
				expect(
					applyStatusGating('complicated', 'intimate', new Set()),
				).toBe('complicated');
				expect(applyStatusGating('complicated', 'hostile', new Set())).toBe(
					'complicated',
				);
			});
		});

		describe('strangers status', () => {
			it('allows going back to strangers', () => {
				// strangers has rank 0, so it's allowed
				const result = applyStatusGating(
					'strangers',
					'acquaintances',
					new Set(),
				);
				expect(result).toBe('strangers');
			});
		});

		describe('invalid status', () => {
			it('returns current status for invalid proposed status', () => {
				const result = applyStatusGating(
					'invalid_status' as any,
					'acquaintances',
					new Set(),
				);
				expect(result).toBe('acquaintances');
			});
		});
	});
});
