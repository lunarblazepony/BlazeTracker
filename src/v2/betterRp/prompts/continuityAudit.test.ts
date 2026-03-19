import { describe, it, expect } from 'vitest';
import {
	buildContinuityAuditSystemPrompt,
	buildContinuityAuditUserPrompt,
	parseContinuityAuditResponse,
} from './continuityAudit';

describe('buildContinuityAuditSystemPrompt', () => {
	it('includes character control rules', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira', 'Marcus'], 'User');
		expect(prompt).toContain('You are auditing for: Kira, Marcus');
		expect(prompt).toContain('You do NOT control User');
	});

	it('substitutes user name correctly', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira'], 'Alice');
		expect(prompt).toContain('You do NOT control Alice');
		expect(prompt).not.toContain('${userName}');
	});

	it('includes sensory allowance', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('sensory details the world presents to User');
		expect(prompt).toContain('NEVER their reactions, thoughts, dialogue, or emotions');
	});

	it('includes physicality rules', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('quadrupeds cannot wave');
		expect(prompt).toContain('bipeds cannot gallop');
		expect(prompt).toContain('species');
	});

	it('includes good examples with rationale', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira'], 'User');
		const goodCount = (prompt.match(/WHY THIS IS GOOD/g) || []).length;
		expect(goodCount).toBeGreaterThanOrEqual(3);
	});

	it('includes bad examples with explanation', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira'], 'User');
		const badCount = (prompt.match(/WHY THIS IS WRONG/g) || []).length;
		expect(badCount).toBeGreaterThanOrEqual(3);
	});

	it('includes JSON format specification', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('"unresolvedActions"');
		expect(prompt).toContain('"physicalContinuity"');
		expect(prompt).toContain('"openThreads"');
		expect(prompt).toContain('"environmentalFactors"');
	});

	it('includes strict JSON-only output instruction', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira'], 'User');
		expect(prompt).toContain('CRITICAL');
		expect(prompt).toContain('single valid JSON object');
	});

	it('lists multiple NPC names', () => {
		const prompt = buildContinuityAuditSystemPrompt(['Kira', 'Marcus', 'Lyra'], 'User');
		expect(prompt).toContain('You are auditing for: Kira, Marcus, Lyra');
	});
});

describe('buildContinuityAuditUserPrompt', () => {
	it('includes shared context', () => {
		const prompt = buildContinuityAuditUserPrompt('shared context here');
		expect(prompt).toContain('shared context here');
	});

	it('includes analysis instruction', () => {
		const prompt = buildContinuityAuditUserPrompt('context');
		expect(prompt).toContain('continuity audit');
	});

	it('shared context appears before instruction', () => {
		const prompt = buildContinuityAuditUserPrompt('CONTEXT_MARKER');
		const contextIdx = prompt.indexOf('CONTEXT_MARKER');
		const instructIdx = prompt.indexOf('continuity audit');
		expect(contextIdx).toBeLessThan(instructIdx);
	});
});

describe('parseContinuityAuditResponse', () => {
	it('parses well-formed JSON', () => {
		const json = JSON.stringify({
			unresolvedActions: ['Kira asked a question'],
			physicalContinuity: ['Kira holding wine glass'],
			openThreads: ['Trust confession unresolved'],
			environmentalFactors: ['11:30 PM, rain outside'],
		});

		const result = parseContinuityAuditResponse(json);
		expect(result).not.toBeNull();
		expect(result!.unresolvedActions).toEqual(['Kira asked a question']);
		expect(result!.physicalContinuity).toEqual(['Kira holding wine glass']);
		expect(result!.openThreads).toEqual(['Trust confession unresolved']);
		expect(result!.environmentalFactors).toEqual(['11:30 PM, rain outside']);
	});

	it('handles empty arrays', () => {
		const json = JSON.stringify({
			unresolvedActions: [],
			physicalContinuity: [],
			openThreads: [],
			environmentalFactors: [],
		});

		const result = parseContinuityAuditResponse(json);
		expect(result).not.toBeNull();
		expect(result!.unresolvedActions).toEqual([]);
	});

	it('handles missing fields gracefully', () => {
		const json = JSON.stringify({ unresolvedActions: ['something'] });
		const result = parseContinuityAuditResponse(json);
		expect(result).not.toBeNull();
		expect(result!.unresolvedActions).toEqual(['something']);
		expect(result!.physicalContinuity).toEqual([]);
		expect(result!.openThreads).toEqual([]);
		expect(result!.environmentalFactors).toEqual([]);
	});

	it('returns null for invalid JSON', () => {
		expect(parseContinuityAuditResponse('not json at all')).toBeNull();
	});

	it('handles JSON wrapped in markdown code blocks', () => {
		const json = '```json\n{"unresolvedActions": ["test"]}\n```';
		const result = parseContinuityAuditResponse(json);
		expect(result).not.toBeNull();
		expect(result!.unresolvedActions).toEqual(['test']);
	});

	it('handles multiple items per array', () => {
		const json = JSON.stringify({
			unresolvedActions: ['action 1', 'action 2', 'action 3'],
			physicalContinuity: ['item a', 'item b'],
			openThreads: ['thread x'],
			environmentalFactors: [],
		});
		const result = parseContinuityAuditResponse(json);
		expect(result!.unresolvedActions).toHaveLength(3);
		expect(result!.physicalContinuity).toHaveLength(2);
	});

	it('filters non-string items from arrays', () => {
		const json = JSON.stringify({
			unresolvedActions: ['valid', 123, null, 'also valid'],
			physicalContinuity: [],
			openThreads: [],
			environmentalFactors: [],
		});
		const result = parseContinuityAuditResponse(json);
		expect(result!.unresolvedActions).toEqual(['valid', 'also valid']);
	});

	it('returns null for empty string', () => {
		expect(parseContinuityAuditResponse('')).toBeNull();
	});

	it('handles JSON with extra whitespace', () => {
		const json = '  \n  {"unresolvedActions": ["test"]}  \n  ';
		const result = parseContinuityAuditResponse(json);
		expect(result).not.toBeNull();
	});
});
