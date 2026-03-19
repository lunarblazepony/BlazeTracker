import { describe, it, expect } from 'vitest';
import {
	buildBeatPlanningSystemPrompt,
	buildBeatPlanningUserPrompt,
	parseBeatPlanningResponse,
} from './beatPlanning';
import type {
	ContinuityAuditResult,
	CharacterKnowledgeResult,
	TensionSteeringResult,
} from '../types';

const STEP1: ContinuityAuditResult = {
	unresolvedActions: ['Question asked'],
	physicalContinuity: ['Holding glass'],
	openThreads: ['Trust confession'],
	environmentalFactors: ['Late night'],
};

const STEP2: CharacterKnowledgeResult = {
	characters: [
		{
			character: 'Kira',
			knows: ['User came'],
			doesntKnow: [],
			assumes: [],
			wantsRightNow: 'Understanding',
			candidateActions: ['Deflect'],
		},
	],
};

const STEP3: TensionSteeringResult = {
	directive: 'sustain',
	rationale: 'Too early to resolve',
	dramaticIronyOpportunities: ['Hidden feeling'],
	threadPriority: ['Trust confession (primary)'],
	toneTarget: 'Quiet tension',
};

describe('buildBeatPlanningSystemPrompt', () => {
	it('frames as single NPC response turn', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira', 'Marcus'], 'User');
		expect(prompt).toContain('ONE response turn');
		expect(prompt).toContain('NOT a back-and-forth');
	});

	it('includes user control rules with directionality', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('User does NOT appear as the subject');
		expect(prompt).toContain('ALLOWED');
		expect(prompt).toContain('FORBIDDEN');
	});

	it('includes subject-of-verb test', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('WHO is the subject');
	});

	it('includes body mechanics section with quadruped rules', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('Body Mechanics');
		expect(prompt).toContain('Quadrupeds');
		expect(prompt).toContain('CANNOT');
		// Specific examples
		expect(prompt).toContain('pegasus picks up a letter with their teeth');
		expect(prompt).toContain('wolf comforts by pressing their flank');
		// Anthro rules
		expect(prompt).toContain('Bipedal anthros');
		expect(prompt).toContain('Digitigrade');
	});

	it('includes good and bad examples', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		const goodCount = (prompt.match(/WHY THIS IS GOOD/g) || []).length;
		const badCount = (prompt.match(/WHY THIS IS WRONG/g) || []).length;
		expect(goodCount).toBeGreaterThanOrEqual(1);
		expect(badCount).toBeGreaterThanOrEqual(1);
	});

	it('uses field names: narration, dialogue, sensory, intent', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('"narration"');
		expect(prompt).toContain('"dialogue"');
		expect(prompt).toContain('"sensory"');
		expect(prompt).toContain('"intent"');
	});

	it('uses "directions" as the JSON array name', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('"directions"');
	});

	it('requests 2-4 directions', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('2-4');
	});

	it('includes sensory section requiring character description grounding', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('character description');
		expect(prompt).toContain('character profiles');
		expect(prompt).toContain('ONE sense per direction');
	});

	it('sensory section forbids repeating senses', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('Do not repeat the same sense');
		expect(prompt).toContain('Check recent messages');
	});

	it('includes good sensory example grounded in character card', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('silver fur');
		expect(prompt).toContain('character card');
	});

	it('includes bad sensory example contradicting character description', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('smooth skin');
		expect(prompt).toContain('character has fur');
	});

	it('forbids duplicate directions', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('No duplicates');
		expect(prompt).toContain('DISTINCT');
	});

	it('includes strict JSON output instruction', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('CRITICAL');
		expect(prompt).toContain('single valid JSON object');
	});

	it('includes unresolved items section requiring direction 1 to respond', () => {
		const prompt = buildBeatPlanningSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('Unresolved Items');
		expect(prompt).toContain('unresolvedActions');
		expect(prompt).toContain('FIRST direction must directly address');
		expect(prompt).toContain('Direction 1');
	});
});

describe('buildBeatPlanningUserPrompt', () => {
	it('includes shared context', () => {
		const prompt = buildBeatPlanningUserPrompt('shared context', null, null, null);
		expect(prompt).toContain('shared context');
	});

	it('includes steps 1+2+3 outputs when provided', () => {
		const prompt = buildBeatPlanningUserPrompt('context', STEP1, STEP2, STEP3);
		expect(prompt).toContain('[Previous Analysis]');
		expect(prompt).toContain('Question asked');
		expect(prompt).toContain('Understanding');
		expect(prompt).toContain('sustain');
	});

	it('handles all null previous steps', () => {
		const prompt = buildBeatPlanningUserPrompt('context', null, null, null);
		expect(prompt).not.toContain('[Previous Analysis]');
	});

	it('requests 2-4 directions', () => {
		const prompt = buildBeatPlanningUserPrompt('ctx', STEP1, STEP2, STEP3);
		expect(prompt).toContain('2-4');
	});

	it('mentions narration, dialogue, sensory, intent fields', () => {
		const prompt = buildBeatPlanningUserPrompt('ctx', STEP1, STEP2, STEP3);
		expect(prompt).toContain('narration');
		expect(prompt).toContain('dialogue');
		expect(prompt).toContain('sensory');
		expect(prompt).toContain('intent');
	});

	it('requires direction 1 to address unresolved items', () => {
		const prompt = buildBeatPlanningUserPrompt('ctx', STEP1, STEP2, STEP3);
		expect(prompt).toContain('Direction 1 MUST');
		expect(prompt).toContain('unresolved');
	});

	it('mentions no duplicates', () => {
		const prompt = buildBeatPlanningUserPrompt('ctx', STEP1, STEP2, STEP3);
		expect(prompt).toContain('No duplicates');
	});
});

describe('parseBeatPlanningResponse', () => {
	it('parses well-formed directions with dialogue', () => {
		const json = JSON.stringify({
			directions: [
				{
					narration: 'Kira sets down the wine glass.',
					dialogue: 'Answers the question — names the fear.',
					sensory: 'The clink of glass on granite.',
					intent: 'Testing whether honesty will be punished.',
				},
				{
					narration: 'Her gaze drops to her hands.',
					dialogue: 'No dialogue.',
					sensory: 'Silver fur catches the lamplight.',
					intent: 'She removed her own shield.',
				},
			],
		});

		const result = parseBeatPlanningResponse(json);
		expect(result).not.toBeNull();
		expect(result!.directions).toHaveLength(2);
		expect(result!.directions[0].narration).toBe('Kira sets down the wine glass.');
		expect(result!.directions[0].dialogue).toBe(
			'Answers the question — names the fear.',
		);
		expect(result!.directions[0].sensory).toBe('The clink of glass on granite.');
		expect(result!.directions[0].intent).toBe(
			'Testing whether honesty will be punished.',
		);
		expect(result!.directions[1].dialogue).toBe('No dialogue.');
	});

	it('accepts legacy "beats" field name with old sub-fields', () => {
		const json = JSON.stringify({
			beats: [
				{
					action: 'Kira sets glass down',
					dialogueDirection: 'Quiet',
					subtext: 'Removing shield',
					knowledgeNotes: 'Knows user came',
					continuityNotes: 'Glass on counter',
				},
			],
		});

		const result = parseBeatPlanningResponse(json);
		expect(result).not.toBeNull();
		expect(result!.directions).toHaveLength(1);
		expect(result!.directions[0].narration).toBe('Kira sets glass down');
	});

	it('skips entries without narration or action', () => {
		const json = JSON.stringify({
			directions: [
				{ sensory: 'Something', intent: 'X' },
				{
					narration: 'Valid moment',
					sensory: 'Detail',
					intent: 'Feeling',
				},
			],
		});

		const result = parseBeatPlanningResponse(json);
		expect(result!.directions).toHaveLength(1);
		expect(result!.directions[0].narration).toBe('Valid moment');
	});

	it('returns null when no valid directions', () => {
		const json = JSON.stringify({
			directions: [{ sensory: 'Something' }],
		});
		expect(parseBeatPlanningResponse(json)).toBeNull();
	});

	it('returns null for missing directions/beats array', () => {
		expect(parseBeatPlanningResponse('{"other": true}')).toBeNull();
	});

	it('returns null for invalid JSON', () => {
		expect(parseBeatPlanningResponse('not json')).toBeNull();
	});

	it('handles missing optional fields', () => {
		const json = JSON.stringify({
			directions: [{ narration: 'Just narration' }],
		});
		const result = parseBeatPlanningResponse(json);
		expect(result).not.toBeNull();
		expect(result!.directions[0].dialogue).toBe('');
		expect(result!.directions[0].sensory).toBe('');
		expect(result!.directions[0].intent).toBe('');
	});

	it('parses 4 directions', () => {
		const json = JSON.stringify({
			directions: Array.from({ length: 4 }, (_, i) => ({
				narration: `Moment ${i}`,
				sensory: `Sense ${i}`,
				intent: `Intent ${i}`,
			})),
		});
		const result = parseBeatPlanningResponse(json);
		expect(result!.directions).toHaveLength(4);
	});

	it('returns null for empty string', () => {
		expect(parseBeatPlanningResponse('')).toBeNull();
	});

	it('handles JSON with thinking block prefix', () => {
		const json =
			'</think>\n' +
			JSON.stringify({
				directions: [
					{
						narration: 'Test action',
						sensory: 'Test sense',
						intent: 'Test intent',
					},
				],
			});
		const result = parseBeatPlanningResponse(json);
		expect(result).not.toBeNull();
		expect(result!.directions[0].narration).toBe('Test action');
	});
});
