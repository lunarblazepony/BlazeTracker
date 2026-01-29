import { describe, it, expect } from 'vitest';
import { getAllV2Prompts, getV2Prompt, hasV2Prompt, V2_PROMPT_REGISTRY } from './registry';

describe('V2 Prompt Registry', () => {
	describe('V2_PROMPT_REGISTRY', () => {
		it('should be an object with string keys', () => {
			expect(typeof V2_PROMPT_REGISTRY).toBe('object');
			expect(V2_PROMPT_REGISTRY).not.toBeNull();
		});

		it('should contain at least 25 prompts', () => {
			const promptCount = Object.keys(V2_PROMPT_REGISTRY).length;
			expect(promptCount).toBeGreaterThanOrEqual(25);
		});
	});

	describe('getAllV2Prompts', () => {
		it('should return an array of prompts', () => {
			const prompts = getAllV2Prompts();
			expect(Array.isArray(prompts)).toBe(true);
			expect(prompts.length).toBeGreaterThan(0);
		});

		it('should return all prompts from the registry', () => {
			const prompts = getAllV2Prompts();
			const registryCount = Object.keys(V2_PROMPT_REGISTRY).length;
			expect(prompts.length).toBe(registryCount);
		});

		it('should have unique names for all prompts', () => {
			const prompts = getAllV2Prompts();
			const names = prompts.map(p => p.name);
			const uniqueNames = new Set(names);
			expect(uniqueNames.size).toBe(names.length);
		});

		it('should not contain any v1 prompt names', () => {
			const prompts = getAllV2Prompts();
			const v1PromptNames = [
				'time_datetime',
				'milestone_confirm',
				'location_initial',
				'characters_initial',
				'scene_initial',
				'event_detect',
			];
			const promptNames = prompts.map(p => p.name);
			v1PromptNames.forEach(v1Name => {
				expect(promptNames).not.toContain(v1Name);
			});
		});

		it('should include all v2 initial prompts', () => {
			const prompts = getAllV2Prompts();
			const names = prompts.map(p => p.name);

			// Check for initial prompts
			expect(names).toContain('initial_time');
			expect(names).toContain('initial_location');
			expect(names).toContain('initial_props');
			expect(names).toContain('initial_climate');
			expect(names).toContain('initial_characters_present');
			expect(names).toContain('initial_character_outfits');
			expect(names).toContain('initial_relationships');
			expect(names).toContain('initial_topic_tone');
			expect(names).toContain('initial_tension');
		});

		it('should include key v2 event prompts', () => {
			const prompts = getAllV2Prompts();
			const names = prompts.map(p => p.name);

			// Check for event prompts
			expect(names).toContain('time_change');
			expect(names).toContain('location_change');
			expect(names).toContain('chapter_ended');
			expect(names).toContain('chapter_description');
		});
	});

	describe('getV2Prompt', () => {
		it('should retrieve a prompt by name', () => {
			const prompt = getV2Prompt('initial_time');
			expect(prompt).toBeDefined();
			expect(prompt?.name).toBe('initial_time');
		});

		it('should return undefined for unknown prompt', () => {
			const prompt = getV2Prompt('nonexistent_prompt');
			expect(prompt).toBeUndefined();
		});

		it('should return undefined for v1 prompt names', () => {
			const prompt = getV2Prompt('time_datetime');
			expect(prompt).toBeUndefined();
		});
	});

	describe('hasV2Prompt', () => {
		it('should return true for existing prompts', () => {
			expect(hasV2Prompt('initial_time')).toBe(true);
			expect(hasV2Prompt('time_change')).toBe(true);
			expect(hasV2Prompt('chapter_ended')).toBe(true);
		});

		it('should return false for non-existing prompts', () => {
			expect(hasV2Prompt('nonexistent')).toBe(false);
			expect(hasV2Prompt('time_datetime')).toBe(false);
		});
	});

	describe('Prompt Structure', () => {
		it('should have required fields for all prompts', () => {
			const prompts = getAllV2Prompts();
			prompts.forEach(prompt => {
				expect(prompt.name).toBeTruthy();
				expect(typeof prompt.name).toBe('string');

				expect(prompt.description).toBeTruthy();
				expect(typeof prompt.description).toBe('string');

				expect(prompt.placeholders).toBeInstanceOf(Array);

				expect(prompt.systemPrompt).toBeTruthy();
				expect(typeof prompt.systemPrompt).toBe('string');

				expect(prompt.userTemplate).toBeTruthy();
				expect(typeof prompt.userTemplate).toBe('string');

				expect(typeof prompt.defaultTemperature).toBe('number');
				expect(prompt.defaultTemperature).toBeGreaterThanOrEqual(0);
				expect(prompt.defaultTemperature).toBeLessThanOrEqual(2);

				expect(typeof prompt.parseResponse).toBe('function');
			});
		});

		it('should have valid placeholder structures', () => {
			const prompts = getAllV2Prompts();
			prompts.forEach(prompt => {
				prompt.placeholders.forEach(placeholder => {
					expect(placeholder.name).toBeTruthy();
					expect(typeof placeholder.name).toBe('string');
					expect(placeholder.description).toBeTruthy();
					expect(typeof placeholder.description).toBe('string');
				});
			});
		});

		it('should have systemPrompt containing instructions', () => {
			const prompts = getAllV2Prompts();
			prompts.forEach(prompt => {
				// System prompts should be substantial (contain instructions, examples)
				expect(prompt.systemPrompt.length).toBeGreaterThan(100);
			});
		});

		it('should have userTemplate containing placeholders or task description', () => {
			const prompts = getAllV2Prompts();
			prompts.forEach(prompt => {
				// User templates should contain something
				expect(prompt.userTemplate.length).toBeGreaterThan(10);
			});
		});
	});
});
