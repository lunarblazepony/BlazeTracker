import { describe, it, expect } from 'vitest';
import {
	isValidSubject,
	isMilestoneWorthy,
	getSubjectGroup,
	SUBJECTS,
	SUBJECT_GROUPS,
	MILESTONE_WORTHY_SUBJECTS,
} from './subject';

describe('subject types', () => {
	describe('SUBJECTS constant', () => {
		it('contains all expected subjects', () => {
			// Spot check some subjects from each category
			expect(SUBJECTS).toContain('conversation');
			expect(SUBJECTS).toContain('confession');
			expect(SUBJECTS).toContain('discovery');
			expect(SUBJECTS).toContain('emotional');
			expect(SUBJECTS).toContain('laugh');
			expect(SUBJECTS).toContain('intimate_kiss');
			expect(SUBJECTS).toContain('intimate_penetrative');
			expect(SUBJECTS).toContain('combat');
			expect(SUBJECTS).toContain('promise');
			expect(SUBJECTS).toContain('marriage');
			expect(SUBJECTS).toContain('achievement');
			expect(SUBJECTS).toContain('helped');
		});

		it('has no duplicates', () => {
			const uniqueSubjects = new Set(SUBJECTS);
			expect(uniqueSubjects.size).toBe(SUBJECTS.length);
		});
	});

	describe('SUBJECT_GROUPS', () => {
		it('has expected groups', () => {
			expect(Object.keys(SUBJECT_GROUPS)).toEqual([
				'conversation',
				'discovery',
				'emotional',
				'bonding',
				'intimacy_romantic',
				'intimacy_sexual',
				'action',
				'commitment',
				'life_events',
				'social',
				'support',
			]);
		});

		it('groups contain only valid subjects', () => {
			for (const [, subjects] of Object.entries(SUBJECT_GROUPS)) {
				for (const subject of subjects) {
					expect(SUBJECTS).toContain(subject);
				}
			}
		});

		it('covers all subjects', () => {
			const groupedSubjects = new Set<string>();
			for (const subjects of Object.values(SUBJECT_GROUPS)) {
				for (const subject of subjects) {
					groupedSubjects.add(subject);
				}
			}
			for (const subject of SUBJECTS) {
				expect(groupedSubjects.has(subject)).toBe(true);
			}
		});
	});

	describe('MILESTONE_WORTHY_SUBJECTS', () => {
		it('contains only valid subjects', () => {
			for (const subject of MILESTONE_WORTHY_SUBJECTS) {
				expect(SUBJECTS).toContain(subject);
			}
		});

		it('has no duplicates', () => {
			const unique = new Set(MILESTONE_WORTHY_SUBJECTS);
			expect(unique.size).toBe(MILESTONE_WORTHY_SUBJECTS.length);
		});

		it('includes key milestone subjects', () => {
			expect(MILESTONE_WORTHY_SUBJECTS).toContain('confession');
			expect(MILESTONE_WORTHY_SUBJECTS).toContain('intimate_kiss');
			expect(MILESTONE_WORTHY_SUBJECTS).toContain('marriage');
			expect(MILESTONE_WORTHY_SUBJECTS).toContain('betrayal');
		});

		it('excludes non-milestone subjects', () => {
			expect(MILESTONE_WORTHY_SUBJECTS).not.toContain('conversation');
			expect(MILESTONE_WORTHY_SUBJECTS).not.toContain('action');
		});
	});

	describe('isValidSubject', () => {
		it('returns true for valid subjects', () => {
			for (const subject of SUBJECTS) {
				expect(isValidSubject(subject)).toBe(true);
			}
		});

		it('returns false for invalid values', () => {
			expect(isValidSubject('invalid')).toBe(false);
			expect(isValidSubject('')).toBe(false);
			expect(isValidSubject('CONVERSATION')).toBe(false); // case sensitive
			expect(isValidSubject('first kiss')).toBe(false); // spaces
		});
	});

	describe('isMilestoneWorthy', () => {
		it('returns true for milestone-worthy subjects', () => {
			expect(isMilestoneWorthy('confession')).toBe(true);
			expect(isMilestoneWorthy('intimate_kiss')).toBe(true);
			expect(isMilestoneWorthy('marriage')).toBe(true);
			expect(isMilestoneWorthy('betrayal')).toBe(true);
		});

		it('returns false for non-milestone subjects', () => {
			expect(isMilestoneWorthy('conversation')).toBe(false);
			expect(isMilestoneWorthy('action')).toBe(false);
			expect(isMilestoneWorthy('combat')).toBe(false);
			expect(isMilestoneWorthy('emotional')).toBe(false);
		});
	});

	describe('getSubjectGroup', () => {
		it('returns correct group for subjects', () => {
			expect(getSubjectGroup('conversation')).toBe('conversation');
			expect(getSubjectGroup('confession')).toBe('conversation');
			expect(getSubjectGroup('discovery')).toBe('discovery');
			expect(getSubjectGroup('emotional')).toBe('emotional');
			expect(getSubjectGroup('laugh')).toBe('bonding');
			expect(getSubjectGroup('intimate_kiss')).toBe('intimacy_romantic');
			expect(getSubjectGroup('intimate_penetrative')).toBe('intimacy_sexual');
			expect(getSubjectGroup('combat')).toBe('action');
			expect(getSubjectGroup('promise')).toBe('commitment');
			expect(getSubjectGroup('marriage')).toBe('life_events');
			expect(getSubjectGroup('achievement')).toBe('social');
			expect(getSubjectGroup('helped')).toBe('support');
		});

		it('returns null for invalid subjects', () => {
			// @ts-expect-error - testing invalid input
			expect(getSubjectGroup('invalid')).toBe(null);
		});
	});
});
