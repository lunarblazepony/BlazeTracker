import { describe, it, expect } from 'vitest';
import {
	SHAKEUP_SYSTEM_PROMPT,
	buildShakeupUserPrompt,
	parseShakeupResponse,
} from './shakeupPrompt';

describe('SHAKEUP_SYSTEM_PROMPT', () => {
	it('is a non-empty string', () => {
		expect(typeof SHAKEUP_SYSTEM_PROMPT).toBe('string');
		expect(SHAKEUP_SYSTEM_PROMPT.length).toBeGreaterThan(0);
	});

	it('mentions the expected shakeup types', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('arrival');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('risk');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('interruption');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('escalation');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('emotional_shift');
	});

	it('includes good and bad example sections', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('GOOD SUGGESTIONS');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('BAD SUGGESTIONS');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('WRONG:');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('WHY THIS IS WRONG:');
	});

	it('good examples use JSON format with type/instruction/rationale', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('"type": "emotional_shift"');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('"instruction":');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('"rationale":');
	});

	it('includes three example scenes with Current Scene blocks', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('Scene 1:');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('Scene 2:');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('Scene 3:');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('[Current Scene]');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('[/Current Scene]');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('wearing:');
	});

	it('emphasises plausibility and character accuracy', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('plausible');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('personalities');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('consistently');
	});

	it('references relationship data and lorebook in rules', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('relationship data');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('lorebook');
	});

	it('includes bad examples for time violations', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('11:30 PM');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('plausible for the time of day');
	});

	it('includes bad examples for fabrication violations', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('fabricates a person');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('Do not invent');
	});

	it('includes bad examples for user character autonomy', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain("user's character");
		expect(SHAKEUP_SYSTEM_PROMPT).toContain("Dictates the user's character");
	});

	it('includes bad examples for outfit/physical state violations', () => {
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('[Current Scene] block');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('She has no jacket on');
		expect(SHAKEUP_SYSTEM_PROMPT).toContain('left arm in a sling');
	});
});

describe('buildShakeupUserPrompt', () => {
	it('includes all provided sections', () => {
		const result = buildShakeupUserPrompt({
			characterDescription: 'A brave knight',
			userDescription: 'A wandering mage',
			userName: 'Gandalf',
			characterProfiles: 'Knight (Male, Human, 30)',
			relationships: 'Knight & Mage: allies\n  Knight → Mage: feels respect',
			sceneState: 'Topic: journey\nTension: tense',
			recentMessages: 'Knight: We should rest here.',
			worldinfo: 'The kingdom is at war.',
		});

		expect(result).toContain('[Character]\nA brave knight');
		expect(result).toContain('[User Character: Gandalf]\nA wandering mage');
		expect(result).toContain('[Character Profiles]\nKnight (Male, Human, 30)');
		expect(result).toContain('[Relationships]\nKnight & Mage: allies');
		expect(result).toContain('[Current Scene]\nTopic: journey');
		expect(result).toContain('[World Info]\nThe kingdom is at war.');
		expect(result).toContain('[Recent Messages]\nKnight: We should rest here.');
		expect(result).toContain('Generate exactly 10 scene shakeup suggestions');
	});

	it('omits empty sections', () => {
		const result = buildShakeupUserPrompt({
			characterDescription: '',
			userDescription: '',
			userName: 'TestUser',
			characterProfiles: 'Knight (Male, Human, 30)',
			relationships: '',
			sceneState: 'Topic: journey',
			recentMessages: 'Knight: Hello.',
		});

		expect(result).not.toContain('[Character]\n');
		expect(result).not.toContain('[User Character:');
		expect(result).not.toContain('[World Info]');
		expect(result).not.toContain('[Relationships]');
		expect(result).toContain('[Character Profiles]');
		expect(result).toContain('[Current Scene]');
	});

	it('omits worldinfo when not provided', () => {
		const result = buildShakeupUserPrompt({
			characterDescription: 'Test',
			userDescription: 'Test',
			userName: 'TestUser',
			characterProfiles: 'Test',
			relationships: '',
			sceneState: 'Test',
			recentMessages: 'Test',
		});

		expect(result).not.toContain('[World Info]');
	});

	it('orders stable content before volatile content for prefix caching', () => {
		const result = buildShakeupUserPrompt({
			characterDescription: 'CHAR_DESC',
			userDescription: 'USER_DESC',
			userName: 'TestUser',
			characterProfiles: 'CHAR_PROFILES',
			relationships: 'RELATIONSHIPS',
			sceneState: 'SCENE_STATE',
			recentMessages: 'RECENT_MSGS',
			worldinfo: 'WORLD_INFO',
		});

		const charIdx = result.indexOf('[Character]');
		const userIdx = result.indexOf('[User Character:');
		const worldIdx = result.indexOf('[World Info]');
		const profilesIdx = result.indexOf('[Character Profiles]');
		const relIdx = result.indexOf('[Relationships]');
		const sceneIdx = result.indexOf('[Current Scene]');
		const msgsIdx = result.indexOf('[Recent Messages]');

		// Stable content first
		expect(charIdx).toBeLessThan(userIdx);
		expect(userIdx).toBeLessThan(worldIdx);
		expect(worldIdx).toBeLessThan(profilesIdx);
		// Volatile content last
		expect(profilesIdx).toBeLessThan(relIdx);
		expect(relIdx).toBeLessThan(sceneIdx);
		expect(sceneIdx).toBeLessThan(msgsIdx);
	});
});

describe('parseShakeupResponse', () => {
	it('parses valid response', () => {
		const response = JSON.stringify({
			suggestions: [
				{
					type: 'interruption',
					instruction: 'A loud knock on the door.',
					rationale: 'Breaks the tension.',
				},
				{
					type: 'arrival',
					instruction: 'A messenger arrives with urgent news.',
					rationale: 'Introduces new plot element.',
				},
			],
		});

		const result = parseShakeupResponse(response);
		expect(result).not.toBeNull();
		expect(result!.suggestions).toHaveLength(2);
		expect(result!.suggestions[0].type).toBe('interruption');
		expect(result!.suggestions[0].instruction).toBe('A loud knock on the door.');
		expect(result!.suggestions[1].type).toBe('arrival');
	});

	it('handles markdown-wrapped JSON', () => {
		const response =
			'```json\n{"suggestions": [{"type": "environment", "instruction": "It starts raining.", "rationale": "Weather shift."}]}\n```';

		const result = parseShakeupResponse(response);
		expect(result).not.toBeNull();
		expect(result!.suggestions).toHaveLength(1);
		expect(result!.suggestions[0].type).toBe('environment');
	});

	it('returns null for empty suggestions array', () => {
		const response = JSON.stringify({ suggestions: [] });
		expect(parseShakeupResponse(response)).toBeNull();
	});

	it('returns null for missing suggestions key', () => {
		const response = JSON.stringify({ events: [] });
		expect(parseShakeupResponse(response)).toBeNull();
	});

	it('returns null for garbage input', () => {
		expect(parseShakeupResponse('not json at all')).toBeNull();
	});

	it('filters out suggestions with missing fields', () => {
		const response = JSON.stringify({
			suggestions: [
				{
					type: 'interruption',
					instruction: 'A knock.',
					rationale: 'Breaks tension.',
				},
				{
					type: 'arrival',
					// missing instruction and rationale
				},
				{
					type: 'environment',
					instruction: 'Power goes out.',
					rationale: 'Creates urgency.',
				},
			],
		});

		const result = parseShakeupResponse(response);
		expect(result).not.toBeNull();
		expect(result!.suggestions).toHaveLength(2);
		expect(result!.suggestions[0].type).toBe('interruption');
		expect(result!.suggestions[1].type).toBe('environment');
	});

	it('handles response with thinking block', () => {
		const response =
			'<think>I need to generate suggestions...</think>\n' +
			JSON.stringify({
				suggestions: [
					{
						type: 'callback',
						instruction: 'The letter arrives.',
						rationale: 'Earlier plot point resurfaces.',
					},
				],
			});

		const result = parseShakeupResponse(response);
		expect(result).not.toBeNull();
		expect(result!.suggestions).toHaveLength(1);
	});
});
