import { describe, it, expect } from 'vitest';
import {
	buildCharacterKnowledgeSystemPrompt,
	buildCharacterKnowledgeUserPrompt,
	parseCharacterKnowledgeResponse,
} from './characterKnowledge';
import type { ContinuityAuditResult } from '../types';

describe('buildCharacterKnowledgeSystemPrompt', () => {
	it('includes character control rules', () => {
		const prompt = buildCharacterKnowledgeSystemPrompt(['Kira', 'Marcus'], 'User');
		expect(prompt).toContain('You are analyzing: Kira, Marcus');
		expect(prompt).toContain('You do NOT control User');
	});

	it('substitutes user name correctly', () => {
		const prompt = buildCharacterKnowledgeSystemPrompt(['Kira'], 'Alice');
		expect(prompt).toContain('You do NOT control Alice');
	});

	it('includes sensory allowance', () => {
		const prompt = buildCharacterKnowledgeSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('sensory details the world presents to User');
	});

	it('includes physicality rules', () => {
		const prompt = buildCharacterKnowledgeSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('quadrupeds cannot wave');
		expect(prompt).toContain('species');
	});

	it('includes good and bad examples', () => {
		const prompt = buildCharacterKnowledgeSystemPrompt(['Kira'], 'User');
		const goodCount = (prompt.match(/WHY THIS IS GOOD/g) || []).length;
		const badCount = (prompt.match(/WHY THIS IS WRONG/g) || []).length;
		expect(goodCount).toBeGreaterThanOrEqual(3);
		expect(badCount).toBeGreaterThanOrEqual(3);
	});

	it('includes JSON format specification', () => {
		const prompt = buildCharacterKnowledgeSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('"characters"');
		expect(prompt).toContain('"knows"');
		expect(prompt).toContain('"doesntKnow"');
		expect(prompt).toContain('"wantsRightNow"');
		expect(prompt).toContain('"candidateActions"');
	});

	it('includes strict JSON-only output instruction', () => {
		const prompt = buildCharacterKnowledgeSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('CRITICAL');
		expect(prompt).toContain('single valid JSON object');
	});

	it('includes limited perspective instruction', () => {
		const prompt = buildCharacterKnowledgeSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('LIMITED perspective');
		expect(prompt).toContain('only know what they');
	});
});

describe('buildCharacterKnowledgeUserPrompt', () => {
	it('includes shared context', () => {
		const prompt = buildCharacterKnowledgeUserPrompt('shared context', null);
		expect(prompt).toContain('shared context');
	});

	it('includes step 1 output when provided', () => {
		const step1: ContinuityAuditResult = {
			unresolvedActions: ['Kira asked a question'],
			physicalContinuity: ['Kira holding glass'],
			openThreads: ['Trust issue'],
			environmentalFactors: ['Late night'],
		};
		const prompt = buildCharacterKnowledgeUserPrompt('context', step1);
		expect(prompt).toContain('[Previous Analysis]');
		expect(prompt).toContain('Kira asked a question');
		expect(prompt).toContain('Kira holding glass');
	});

	it('omits previous analysis when step 1 is null', () => {
		const prompt = buildCharacterKnowledgeUserPrompt('context', null);
		expect(prompt).not.toContain('[Previous Analysis]');
	});

	it('step 1 output is valid JSON in the prompt', () => {
		const step1: ContinuityAuditResult = {
			unresolvedActions: ['test'],
			physicalContinuity: [],
			openThreads: [],
			environmentalFactors: [],
		};
		const prompt = buildCharacterKnowledgeUserPrompt('context', step1);
		const jsonStart =
			prompt.indexOf('[Previous Analysis]\n') + '[Previous Analysis]\n'.length;
		const jsonStr = prompt.substring(jsonStart, prompt.indexOf('\n\nAnalyze'));
		expect(() => JSON.parse(jsonStr)).not.toThrow();
	});
});

describe('parseCharacterKnowledgeResponse', () => {
	it('parses well-formed JSON', () => {
		const json = JSON.stringify({
			characters: [
				{
					character: 'Kira',
					knows: ['User came when asked'],
					doesntKnow: ['How user feels'],
					assumes: ['Vulnerability will be punished'],
					wantsRightNow: 'To be understood',
					candidateActions: [
						'Deflect with sarcasm',
						'Share a detail',
					],
				},
			],
		});

		const result = parseCharacterKnowledgeResponse(json);
		expect(result).not.toBeNull();
		expect(result!.characters).toHaveLength(1);
		expect(result!.characters[0].character).toBe('Kira');
		expect(result!.characters[0].knows).toEqual(['User came when asked']);
		expect(result!.characters[0].wantsRightNow).toBe('To be understood');
	});

	it('handles multiple characters', () => {
		const json = JSON.stringify({
			characters: [
				{
					character: 'Kira',
					knows: [],
					doesntKnow: [],
					assumes: [],
					wantsRightNow: 'Peace',
					candidateActions: ['Wait'],
				},
				{
					character: 'Marcus',
					knows: ['Something'],
					doesntKnow: [],
					assumes: [],
					wantsRightNow: 'Food',
					candidateActions: ['Eat'],
				},
			],
		});

		const result = parseCharacterKnowledgeResponse(json);
		expect(result!.characters).toHaveLength(2);
		expect(result!.characters[1].character).toBe('Marcus');
	});

	it('returns null for missing characters array', () => {
		expect(parseCharacterKnowledgeResponse('{"noCharacters": true}')).toBeNull();
	});

	it('skips entries without character name', () => {
		const json = JSON.stringify({
			characters: [
				{ knows: ['something'], wantsRightNow: 'stuff' },
				{
					character: 'Kira',
					knows: [],
					doesntKnow: [],
					assumes: [],
					wantsRightNow: 'Peace',
					candidateActions: [],
				},
			],
		});

		const result = parseCharacterKnowledgeResponse(json);
		expect(result!.characters).toHaveLength(1);
		expect(result!.characters[0].character).toBe('Kira');
	});

	it('returns null for invalid JSON', () => {
		expect(parseCharacterKnowledgeResponse('garbage')).toBeNull();
	});

	it('handles missing optional fields in character entry', () => {
		const json = JSON.stringify({
			characters: [
				{
					character: 'Kira',
					wantsRightNow: 'Something',
				},
			],
		});
		const result = parseCharacterKnowledgeResponse(json);
		expect(result!.characters[0].knows).toEqual([]);
		expect(result!.characters[0].doesntKnow).toEqual([]);
		expect(result!.characters[0].assumes).toEqual([]);
		expect(result!.characters[0].candidateActions).toEqual([]);
	});

	it('handles empty characters array', () => {
		const json = JSON.stringify({ characters: [] });
		const result = parseCharacterKnowledgeResponse(json);
		expect(result).not.toBeNull();
		expect(result!.characters).toEqual([]);
	});
});
