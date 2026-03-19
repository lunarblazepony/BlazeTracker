/**
 * Parse (generateAndParse) Tests
 *
 * Tests for the parse utility, including training data annotation integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Generator } from '../../generator';
import type { PromptTemplate, BuiltPrompt } from '../../prompts';
import { generateAndParse } from './parse';

// Mock settings
const mockSettings = {
	v2MaxTokens: 4096,
	v2TrainingCapture: false,
};
vi.mock('../../settings', () => ({
	getV2Settings: vi.fn(() => mockSettings),
}));

// Mock training module
const mockAnnotateLastCapture = vi.fn();
let trainingEnabled = false;
vi.mock('../../training', () => ({
	isTrainingCaptureEnabled: () => trainingEnabled,
	annotateLastCapture: (annotation: unknown) => mockAnnotateLastCapture(annotation),
}));

// Mock debug
vi.mock('../../../utils/debug', () => ({
	debugLog: vi.fn(),
	debugWarn: vi.fn(),
	errorLog: vi.fn(),
}));

// ============================================
// Helpers
// ============================================

interface TestData {
	value: string;
}

function createMockGenerator(response: string): Generator {
	return {
		generate: vi.fn().mockResolvedValue(response),
		abort: vi.fn(),
	};
}

function createMockGeneratorThrowing(error: Error): Generator {
	return {
		generate: vi.fn().mockRejectedValue(error),
		abort: vi.fn(),
	};
}

function createMockPrompt(parseResult: TestData | null): PromptTemplate<TestData> {
	return {
		name: 'test_prompt',
		description: 'Test prompt',
		placeholders: [],
		systemPrompt: 'You are a test extractor.',
		userTemplate: 'Extract: {{messages}}',
		responseSchema: { type: 'object' },
		defaultTemperature: 0.5,
		parseResponse: vi.fn(() => parseResult),
	};
}

function createBuiltPrompt(): BuiltPrompt {
	return {
		system: 'System prompt content',
		user: 'User prompt content',
	};
}

// ============================================
// Tests
// ============================================

describe('generateAndParse', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSettings.v2TrainingCapture = false;
		trainingEnabled = false;
	});

	it('returns parsed data on success', async () => {
		const generator = createMockGenerator('{"value": "hello"}');
		const prompt = createMockPrompt({ value: 'hello' });

		const result = await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
			maxRetries: 0,
		});

		expect(result.success).toBe(true);
		expect(result.data).toEqual({ value: 'hello' });
	});

	it('returns error when parse returns null after all retries', async () => {
		const generator = createMockGenerator('bad response');
		const prompt = createMockPrompt(null);

		const result = await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
			maxRetries: 0,
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('parseResponse returned null');
	});

	it('returns error when generator throws', async () => {
		const generator = createMockGeneratorThrowing(new Error('LLM failed'));
		const prompt = createMockPrompt(null);

		const result = await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
			maxRetries: 0,
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe('LLM failed');
	});

	// ============================================
	// Training Capture Annotation Tests
	// ============================================

	describe('training capture annotations', () => {
		beforeEach(() => {
			trainingEnabled = true;
		});

		it('annotates with success on successful parse', async () => {
			const parsed = { value: 'result' };
			const generator = createMockGenerator('{"value": "result"}');
			const prompt = createMockPrompt(parsed);

			await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
				maxRetries: 0,
			});

			expect(mockAnnotateLastCapture).toHaveBeenCalledWith({
				parsedResult: parsed,
				parseSuccess: true,
			});
		});

		it('annotates with failure when parseResponse returns null', async () => {
			const generator = createMockGenerator('bad response');
			const prompt = createMockPrompt(null);

			await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
				maxRetries: 0,
			});

			expect(mockAnnotateLastCapture).toHaveBeenCalledWith({
				parseSuccess: false,
				parseError: 'parseResponse returned null',
			});
		});

		it('annotates with failure when generator throws', async () => {
			const generator = createMockGeneratorThrowing(
				new Error('Connection timeout'),
			);
			const prompt = createMockPrompt(null);

			await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
				maxRetries: 0,
			});

			expect(mockAnnotateLastCapture).toHaveBeenCalledWith({
				parseSuccess: false,
				parseError: 'Connection timeout',
			});
		});

		it('annotates each retry attempt separately', async () => {
			// First attempt fails, second succeeds
			const parsed = { value: 'success' };
			const generator: Generator = {
				generate: vi
					.fn()
					.mockResolvedValueOnce('bad')
					.mockResolvedValueOnce('{"value": "success"}'),
				abort: vi.fn(),
			};
			const prompt: PromptTemplate<TestData> = {
				name: 'test_prompt',
				description: 'Test prompt',
				placeholders: [],
				systemPrompt: 'sys',
				userTemplate: 'usr',
				responseSchema: { type: 'object' },
				defaultTemperature: 0.5,
				parseResponse: vi
					.fn()
					.mockReturnValueOnce(null)
					.mockReturnValueOnce(parsed),
			};

			await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
				maxRetries: 1,
			});

			// Should have annotated twice: once for failure, once for success
			expect(mockAnnotateLastCapture).toHaveBeenCalledTimes(2);
			expect(mockAnnotateLastCapture).toHaveBeenNthCalledWith(1, {
				parseSuccess: false,
				parseError: 'parseResponse returned null',
			});
			expect(mockAnnotateLastCapture).toHaveBeenNthCalledWith(2, {
				parsedResult: parsed,
				parseSuccess: true,
			});
		});

		it('does not annotate when training capture is disabled', async () => {
			trainingEnabled = false;

			const generator = createMockGenerator('{"value": "hello"}');
			const prompt = createMockPrompt({ value: 'hello' });

			await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
				maxRetries: 0,
			});

			expect(mockAnnotateLastCapture).not.toHaveBeenCalled();
		});

		it('does not annotate on abort', async () => {
			const abortController = new AbortController();
			abortController.abort();

			const generator = createMockGenerator('response');
			const prompt = createMockPrompt({ value: 'x' });

			await generateAndParse(generator, prompt, createBuiltPrompt(), 0.5, {
				maxRetries: 0,
				abortSignal: abortController.signal,
			});

			expect(mockAnnotateLastCapture).not.toHaveBeenCalled();
		});
	});
});
