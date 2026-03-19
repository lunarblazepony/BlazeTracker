import { describe, it, expect } from 'vitest';
import {
	buildTensionSteeringSystemPrompt,
	buildTensionSteeringUserPrompt,
	parseTensionSteeringResponse,
} from './tensionSteering';
import type { ContinuityAuditResult, CharacterKnowledgeResult } from '../types';

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
			doesntKnow: ['User feelings'],
			assumes: ['Will be hurt'],
			wantsRightNow: 'Understanding',
			candidateActions: ['Deflect', 'Share'],
		},
	],
};

describe('buildTensionSteeringSystemPrompt', () => {
	it('includes character control rules', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('You are directing for: Kira');
		expect(prompt).toContain('You do NOT control User');
	});

	it('includes sensory allowance', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('sensory details the world presents to User');
	});

	it('includes physicality rules', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('quadrupeds cannot wave');
	});

	it('includes directive options', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('"escalate"');
		expect(prompt).toContain('"sustain"');
		expect(prompt).toContain('"release"');
		expect(prompt).toContain('"pivot"');
	});

	it('includes good and bad examples', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'User');
		const goodCount = (prompt.match(/WHY THIS IS GOOD/g) || []).length;
		const badCount = (prompt.match(/WHY THIS IS WRONG/g) || []).length;
		expect(goodCount).toBeGreaterThanOrEqual(3);
		expect(badCount).toBeGreaterThanOrEqual(3);
	});

	it('includes explicit user control prohibition section', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'TestUser');
		expect(prompt).toContain('ABSOLUTE RULE: Never Control TestUser');
		expect(prompt).toContain('TestUser will feel guilty');
		expect(prompt).toContain('TestUser apologizes');
	});

	it('has bad examples that demonstrate user control violations', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('CONTROLS USER CHARACTER');
		const controlCount = (prompt.match(/CONTROLS USER CHARACTER/g) || []).length;
		expect(controlCount).toBeGreaterThanOrEqual(3);
	});

	it('includes continuity audit addressing instructions', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('Must Address the Continuity Audit');
		expect(prompt).toContain('threadPriority MUST include');
	});

	it('includes strict JSON-only output instruction', () => {
		const prompt = buildTensionSteeringSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('CRITICAL');
		expect(prompt).toContain('single valid JSON object');
	});
});

describe('buildTensionSteeringUserPrompt', () => {
	it('includes shared context', () => {
		const prompt = buildTensionSteeringUserPrompt('shared context', null, null);
		expect(prompt).toContain('shared context');
	});

	it('includes steps 1+2 outputs when provided', () => {
		const prompt = buildTensionSteeringUserPrompt('context', STEP1, STEP2);
		expect(prompt).toContain('[Previous Analysis]');
		expect(prompt).toContain('Question asked');
		expect(prompt).toContain('Understanding');
	});

	it('omits previous analysis when both are null', () => {
		const prompt = buildTensionSteeringUserPrompt('context', null, null);
		expect(prompt).not.toContain('[Previous Analysis]');
	});

	it('includes only step 1 when step 2 is null', () => {
		const prompt = buildTensionSteeringUserPrompt('context', STEP1, null);
		expect(prompt).toContain('[Previous Analysis]');
		expect(prompt).toContain('Question asked');
		expect(prompt).not.toContain('Understanding');
	});

	it('instruction mentions addressing unresolved actions', () => {
		const prompt = buildTensionSteeringUserPrompt('context', STEP1, STEP2);
		expect(prompt).toContain('threadPriority MUST include the unresolved actions');
	});

	it('previous analysis contains both continuityAudit and characterKnowledge keys', () => {
		const prompt = buildTensionSteeringUserPrompt('context', STEP1, STEP2);
		expect(prompt).toContain('continuityAudit');
		expect(prompt).toContain('characterKnowledge');
	});
});

describe('parseTensionSteeringResponse', () => {
	it('parses valid escalate directive', () => {
		const json = JSON.stringify({
			directive: 'escalate',
			rationale: 'Scene is stalling',
			dramaticIronyOpportunities: ['User doesnt know secret'],
			threadPriority: ['Main confrontation'],
			toneTarget: 'Rising dread',
		});

		const result = parseTensionSteeringResponse(json);
		expect(result).not.toBeNull();
		expect(result!.directive).toBe('escalate');
		expect(result!.rationale).toBe('Scene is stalling');
		expect(result!.toneTarget).toBe('Rising dread');
	});

	it('parses all valid directives', () => {
		for (const directive of ['escalate', 'sustain', 'release', 'pivot']) {
			const json = JSON.stringify({
				directive,
				rationale: 'reason',
				dramaticIronyOpportunities: [],
				threadPriority: [],
				toneTarget: 'target',
			});
			const result = parseTensionSteeringResponse(json);
			expect(result).not.toBeNull();
			expect(result!.directive).toBe(directive);
		}
	});

	it('returns null for invalid directive', () => {
		const json = JSON.stringify({ directive: 'explode', rationale: 'reason' });
		expect(parseTensionSteeringResponse(json)).toBeNull();
	});

	it('returns null for missing directive', () => {
		const json = JSON.stringify({ rationale: 'reason', toneTarget: 'target' });
		expect(parseTensionSteeringResponse(json)).toBeNull();
	});

	it('returns null for invalid JSON', () => {
		expect(parseTensionSteeringResponse('not json')).toBeNull();
	});

	it('handles missing optional fields', () => {
		const json = JSON.stringify({ directive: 'sustain' });
		const result = parseTensionSteeringResponse(json);
		expect(result).not.toBeNull();
		expect(result!.rationale).toBe('');
		expect(result!.dramaticIronyOpportunities).toEqual([]);
		expect(result!.threadPriority).toEqual([]);
		expect(result!.toneTarget).toBe('');
	});

	it('handles multiple thread priorities', () => {
		const json = JSON.stringify({
			directive: 'sustain',
			threadPriority: ['Thread A (primary)', 'Thread B (secondary)', 'Thread C'],
		});
		const result = parseTensionSteeringResponse(json);
		expect(result!.threadPriority).toHaveLength(3);
	});
});
