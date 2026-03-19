import { describe, it, expect } from 'vitest';
import { formatBeatPlanInjection } from './inject';
import type { BetterRpResult, Direction } from './types';

function makeDirection(overrides?: Partial<Direction>): Direction {
	return {
		narration: 'Kira sets down the wine glass on the counter with deliberate control.',
		dialogue: 'Answers the question directly — names the specific fear that kept her silent.',
		sensory: 'The clink of glass on granite is sharp in the silent kitchen.',
		intent: 'She is testing whether honesty will be punished. The specificity is a calculated risk.',
		...overrides,
	};
}

function makeResult(overrides?: Partial<BetterRpResult>): BetterRpResult {
	return {
		continuityAudit: null,
		characterKnowledge: null,
		tensionSteering: null,
		beatPlanning: {
			directions: [
				makeDirection(),
				makeDirection({
					narration: 'Her gaze drops to her own hands, now empty. The fur along her forearms lies flat.',
					dialogue: 'No dialogue.',
					sensory: 'The coarse silver fur catches the warm lamplight.',
					intent: 'She removed her own shield and is waiting to see what happens.',
				}),
			],
		},
		errors: [],
		...overrides,
	};
}

describe('formatBeatPlanInjection', () => {
	// ========================================
	// Null returns
	// ========================================

	it('returns null when beatPlanning is null', () => {
		const result = formatBeatPlanInjection(
			makeResult({ beatPlanning: null }),
			['Kira'],
			'User',
		);
		expect(result).toBeNull();
	});

	it('returns null when directions array is empty', () => {
		const result = formatBeatPlanInjection(
			makeResult({ beatPlanning: { directions: [] } }),
			['Kira'],
			'User',
		);
		expect(result).toBeNull();
	});

	// ========================================
	// Directive structure
	// ========================================

	it('includes mandatory directive header and footer', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'User')!;
		expect(result).toContain('[MANDATORY RESPONSE DIRECTION');
		expect(result).toContain('MUST FOLLOW');
		expect(result).toContain('[/MANDATORY RESPONSE DIRECTION]');
	});

	it('starts with opening tag and ends with closing tag', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'User')!;
		expect(result.startsWith('[MANDATORY RESPONSE DIRECTION')).toBe(true);
		expect(result.endsWith('[/MANDATORY RESPONSE DIRECTION]')).toBe(true);
	});

	it('includes HOW TO USE instructions', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'User')!;
		expect(result).toContain('HOW TO USE THIS DIRECTION');
		expect(result).toContain('flowing prose');
		expect(result).toContain('Do not skip');
		expect(result).toContain('Do not reorder');
	});

	// ========================================
	// Character control rules
	// ========================================

	it('includes NPC names in writing-for line', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira', 'Marcus'], 'Alice')!;
		expect(result).toContain('writing ONLY for: Kira, Marcus');
	});

	it('includes user name in do-not-act line', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'Alice')!;
		expect(result).toContain('Alice does NOT act, speak, think, feel, or decide');
	});

	it('specifies NPC can interact with user', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'Bob')!;
		expect(result).toContain('Kira CAN interact with Bob');
		expect(result).toContain('Bob NEVER responds, reacts');
	});

	it('includes sensory writing rule', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'Bob')!;
		expect(result).toContain('sensory details');
		expect(result).toContain("Never write Bob's reaction");
	});

	// ========================================
	// Direction formatting
	// ========================================

	it('formats directions with all fields', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'User')!;

		expect(result).toContain('Direction 1:');
		expect(result).toContain('What happens: Kira sets down the wine glass');
		expect(result).toContain('Dialogue: Answers the question directly');
		expect(result).toContain(
			'Sensory detail to include: The clink of glass on granite',
		);
		expect(result).toContain('Emotional undercurrent: She is testing whether honesty');

		expect(result).toContain('Direction 2:');
		expect(result).toContain('Her gaze drops');
	});

	it('omits dialogue field when "No dialogue."', () => {
		const noDialogue = makeResult({
			beatPlanning: {
				directions: [makeDirection({ dialogue: 'No dialogue.' })],
			},
		});
		const result = formatBeatPlanInjection(noDialogue, ['Kira'], 'User')!;
		expect(result).not.toContain('Dialogue:');
	});

	it('numbers directions sequentially', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'User')!;
		expect(result).toContain('Direction 1:');
		expect(result).toContain('Direction 2:');
		expect(result).not.toContain('Direction 0:');
		expect(result).not.toContain('Direction 3:');
	});

	it('handles single direction', () => {
		const single = makeResult({
			beatPlanning: { directions: [makeDirection()] },
		});
		const result = formatBeatPlanInjection(single, ['Kira'], 'User')!;
		expect(result).toContain('Direction 1:');
		expect(result).not.toContain('Direction 2:');
	});

	it('handles 4 directions', () => {
		const four = makeResult({
			beatPlanning: {
				directions: Array.from({ length: 4 }, (_, i) =>
					makeDirection({ narration: `Moment ${i + 1}` }),
				),
			},
		});
		const result = formatBeatPlanInjection(four, ['Kira'], 'User')!;
		for (let i = 1; i <= 4; i++) {
			expect(result).toContain(`Direction ${i}:`);
		}
	});

	it('omits empty sensory field', () => {
		const noSensory = makeResult({
			beatPlanning: {
				directions: [makeDirection({ sensory: '' })],
			},
		});
		const result = formatBeatPlanInjection(noSensory, ['Kira'], 'User')!;
		expect(result).not.toContain('Sensory detail to include:');
	});

	it('omits empty intent field', () => {
		const noIntent = makeResult({
			beatPlanning: {
				directions: [makeDirection({ intent: '' })],
			},
		});
		const result = formatBeatPlanInjection(noIntent, ['Kira'], 'User')!;
		expect(result).not.toContain('Emotional undercurrent:');
	});

	// ========================================
	// Closing instructions
	// ========================================

	it('includes closing instructions', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'User')!;
		expect(result).toContain('Follow the directions above exactly');
	});

	it('repeats user prohibition in closing', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'Alice')!;
		expect(result).toContain(
			"Do not write Alice's actions, dialogue, thoughts, or feelings",
		);
	});

	// ========================================
	// NPC names
	// ========================================

	it('handles single NPC name', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'User')!;
		expect(result).toContain('writing ONLY for: Kira');
	});

	it('handles many NPC names', () => {
		const result = formatBeatPlanInjection(
			makeResult(),
			['Kira', 'Marcus', 'Lyra', 'Fenris'],
			'User',
		)!;
		expect(result).toContain('writing ONLY for: Kira, Marcus, Lyra, Fenris');
	});

	// ========================================
	// Direction delimiters
	// ========================================

	it('includes BEGIN/END direction markers', () => {
		const result = formatBeatPlanInjection(makeResult(), ['Kira'], 'User')!;
		expect(result).toContain('--- BEGIN DIRECTIONS ---');
		expect(result).toContain('--- END DIRECTIONS ---');
	});
});
