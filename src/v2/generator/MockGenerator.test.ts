import { describe, it, expect, beforeEach } from 'vitest';
import {
	type MockGenerator,
	createMockGenerator,
	GeneratorAbortError,
	isAbortError,
	buildPrompt,
	buildPromptWithPrefill,
} from './index';
import type { GeneratorSettings } from './types';

describe('MockGenerator', () => {
	let generator: MockGenerator;

	beforeEach(() => {
		generator = createMockGenerator();
	});

	describe('basic generation', () => {
		it('returns default response when no patterns match', async () => {
			const prompt = buildPrompt('System', 'User');
			const settings: GeneratorSettings = { maxTokens: 100 };

			const result = await generator.generate(prompt, settings);
			expect(result).toBe('{}');
		});

		it('allows setting custom default response', async () => {
			generator.setDefaultResponse('{"default": true}');

			const prompt = buildPrompt('System', 'User');
			const settings: GeneratorSettings = { maxTokens: 100 };

			const result = await generator.generate(prompt, settings);
			expect(result).toBe('{"default": true}');
		});

		it('allows function as default response', async () => {
			generator.setDefaultResponse(prompt => {
				return JSON.stringify({ name: prompt.name });
			});

			const prompt = buildPrompt('System', 'User', 'test-prompt');
			const settings: GeneratorSettings = { maxTokens: 100 };

			const result = await generator.generate(prompt, settings);
			expect(result).toBe('{"name":"test-prompt"}');
		});
	});

	describe('pattern matching', () => {
		it('matches string patterns in prompt content', async () => {
			generator.setResponse('time extraction', '{"hour": 10}');

			const prompt = buildPrompt(
				'You are a time extraction assistant.',
				'Extract the time from the story.',
			);
			const settings: GeneratorSettings = { maxTokens: 100 };

			const result = await generator.generate(prompt, settings);
			expect(result).toBe('{"hour": 10}');
		});

		it('matches regex patterns', async () => {
			generator.setResponse(/location/i, '{"area": "Downtown"}');

			const prompt = buildPrompt('Extract Location', 'Where is this happening?');
			const settings: GeneratorSettings = { maxTokens: 100 };

			const result = await generator.generate(prompt, settings);
			expect(result).toBe('{"area": "Downtown"}');
		});

		it('uses first matching pattern', async () => {
			generator
				.setResponse('time', '{"type": "time"}')
				.setResponse('extract', '{"type": "extract"}');

			const prompt = buildPrompt('Extract time', 'Get the time');
			const settings: GeneratorSettings = { maxTokens: 100 };

			// 'time' appears first, so should match first pattern
			const result = await generator.generate(prompt, settings);
			expect(result).toBe('{"type": "time"}');
		});

		it('allows function handlers for patterns', async () => {
			generator.setResponse('character', (prompt, settings) => {
				return JSON.stringify({
					maxTokens: settings.maxTokens,
					temperature: settings.temperature,
				});
			});

			const prompt = buildPrompt('Character', 'Extract character');
			const settings: GeneratorSettings = { maxTokens: 500, temperature: 0.7 };

			const result = await generator.generate(prompt, settings);
			expect(JSON.parse(result)).toEqual({
				maxTokens: 500,
				temperature: 0.7,
			});
		});
	});

	describe('one-time responses', () => {
		it('uses once response only once', async () => {
			generator
				.setResponseOnce('test', '{"first": true}')
				.setDefaultResponse('{"default": true}');

			const prompt = buildPrompt('test', 'test');
			const settings: GeneratorSettings = { maxTokens: 100 };

			const result1 = await generator.generate(prompt, settings);
			expect(result1).toBe('{"first": true}');

			const result2 = await generator.generate(prompt, settings);
			expect(result2).toBe('{"default": true}');
		});
	});

	describe('call recording', () => {
		it('records all calls', async () => {
			const prompt1 = buildPrompt('System1', 'User1', 'prompt1');
			const prompt2 = buildPrompt('System2', 'User2', 'prompt2');
			const settings: GeneratorSettings = { maxTokens: 100 };

			await generator.generate(prompt1, settings);
			await generator.generate(prompt2, settings);

			const calls = generator.getCalls();
			expect(calls).toHaveLength(2);
			expect(calls[0].prompt.name).toBe('prompt1');
			expect(calls[1].prompt.name).toBe('prompt2');
		});

		it('getLastCall returns the most recent call', async () => {
			const prompt1 = buildPrompt('System1', 'User1', 'first');
			const prompt2 = buildPrompt('System2', 'User2', 'last');
			const settings: GeneratorSettings = { maxTokens: 100 };

			await generator.generate(prompt1, settings);
			await generator.generate(prompt2, settings);

			expect(generator.getLastCall()?.prompt.name).toBe('last');
		});

		it('getCallsMatching filters by pattern', async () => {
			const prompt1 = buildPrompt('Time System', 'Extract time', 'time');
			const prompt2 = buildPrompt(
				'Location System',
				'Extract location',
				'location',
			);
			const prompt3 = buildPrompt('Time System', 'More time', 'time2');
			const settings: GeneratorSettings = { maxTokens: 100 };

			await generator.generate(prompt1, settings);
			await generator.generate(prompt2, settings);
			await generator.generate(prompt3, settings);

			const timeCalls = generator.getCallsMatching(/Time System/);
			expect(timeCalls).toHaveLength(2);

			const locationCalls = generator.getCallsMatching('location');
			expect(locationCalls).toHaveLength(1);
		});

		it('clearCalls removes recorded calls', async () => {
			const prompt = buildPrompt('System', 'User');
			const settings: GeneratorSettings = { maxTokens: 100 };

			await generator.generate(prompt, settings);
			expect(generator.getCalls()).toHaveLength(1);

			generator.clearCalls();
			expect(generator.getCalls()).toHaveLength(0);
		});
	});

	describe('abort handling', () => {
		it('throws abort error when already aborted', async () => {
			const controller = new AbortController();
			controller.abort();

			const prompt = buildPrompt('System', 'User');
			const settings: GeneratorSettings = {
				maxTokens: 100,
				abortSignal: controller.signal,
			};

			await expect(generator.generate(prompt, settings)).rejects.toThrow(
				GeneratorAbortError,
			);
		});

		it('throws abort error when generator.abort() called', async () => {
			generator.abort();

			const prompt = buildPrompt('System', 'User');
			const settings: GeneratorSettings = { maxTokens: 100 };

			await expect(generator.generate(prompt, settings)).rejects.toThrow(
				GeneratorAbortError,
			);
		});

		it('throws abort error during delay', async () => {
			generator.setDelay(100);

			const controller = new AbortController();
			const prompt = buildPrompt('System', 'User');
			const settings: GeneratorSettings = {
				maxTokens: 100,
				abortSignal: controller.signal,
			};

			const promise = generator.generate(prompt, settings);

			// Abort after 10ms
			setTimeout(() => controller.abort(), 10);

			await expect(promise).rejects.toThrow(GeneratorAbortError);
		});

		it('resetAbort allows generation after abort', async () => {
			generator.abort();
			generator.resetAbort();

			const prompt = buildPrompt('System', 'User');
			const settings: GeneratorSettings = { maxTokens: 100 };

			const result = await generator.generate(prompt, settings);
			expect(result).toBe('{}');
		});
	});

	describe('reset', () => {
		it('clears all state', async () => {
			generator
				.setResponse('test', '{"test": true}')
				.setDefaultResponse('{"custom": true}')
				.setDelay(10);

			const prompt = buildPrompt('test', 'test');
			const settings: GeneratorSettings = { maxTokens: 100 };

			await generator.generate(prompt, settings);
			generator.abort();

			generator.reset();

			// Should be back to defaults
			expect(generator.getCalls()).toHaveLength(0);

			const result = await generator.generate(prompt, settings);
			expect(result).toBe('{}'); // Default default response
		});
	});

	describe('chaining', () => {
		it('supports method chaining', () => {
			const result = generator
				.setResponse('a', '1')
				.setResponseOnce('b', '2')
				.setDefaultResponse('3')
				.setDelay(0)
				.clearCalls()
				.clearResponses()
				.resetAbort()
				.reset();

			expect(result).toBe(generator);
		});
	});
});

describe('buildPrompt', () => {
	it('creates prompt with system and user messages', () => {
		const prompt = buildPrompt('System prompt', 'User prompt');

		expect(prompt.messages).toHaveLength(2);
		expect(prompt.messages[0]).toEqual({ role: 'system', content: 'System prompt' });
		expect(prompt.messages[1]).toEqual({ role: 'user', content: 'User prompt' });
	});

	it('includes optional name', () => {
		const prompt = buildPrompt('System', 'User', 'my-prompt');
		expect(prompt.name).toBe('my-prompt');
	});
});

describe('buildPromptWithPrefill', () => {
	it('creates prompt with assistant prefill', () => {
		const prompt = buildPromptWithPrefill('System', 'User', '{"reasoning":');

		expect(prompt.messages).toHaveLength(3);
		expect(prompt.messages[2]).toEqual({ role: 'assistant', content: '{"reasoning":' });
	});
});

describe('isAbortError', () => {
	it('returns true for GeneratorAbortError', () => {
		expect(isAbortError(new GeneratorAbortError())).toBe(true);
	});

	it('returns true for DOMException with AbortError name', () => {
		expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
	});

	it('returns true for Error with AbortError name', () => {
		const error = new Error('Aborted');
		error.name = 'AbortError';
		expect(isAbortError(error)).toBe(true);
	});

	it('returns false for other errors', () => {
		expect(isAbortError(new Error('Random error'))).toBe(false);
		expect(isAbortError(new TypeError('Type error'))).toBe(false);
		expect(isAbortError(null)).toBe(false);
		expect(isAbortError('string')).toBe(false);
	});
});
