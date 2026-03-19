import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrainingCaptureGenerator, withTrainingCapture } from './TrainingCaptureGenerator';
import { clearTrainingPairs, getTrainingPairs, getTrainingPairCount } from './TrainingDataStore';
import type { Generator } from '../generator/Generator';
import type { GeneratorPrompt, GeneratorSettings } from '../generator/types';

// Mock settings — default enabled
const mockSettings = { v2TrainingCapture: true };
vi.mock('../settings', () => ({
	getV2Settings: vi.fn(() => mockSettings),
}));

function createMockGenerator(response = 'mock response'): Generator {
	return {
		generate: vi.fn().mockResolvedValue(response),
		abort: vi.fn(),
	};
}

function createPrompt(name: string): GeneratorPrompt {
	return {
		messages: [
			{ role: 'system', content: 'You are a test extractor.' },
			{ role: 'user', content: 'Extract something.' },
		],
		name,
	};
}

const defaultSettings: GeneratorSettings = {
	maxTokens: 4096,
	temperature: 0.3,
};

describe('TrainingCaptureGenerator', () => {
	beforeEach(() => {
		clearTrainingPairs();
		mockSettings.v2TrainingCapture = true;
	});

	it('delegates generate() to inner generator', async () => {
		const inner = createMockGenerator('the response');
		const decorator = new TrainingCaptureGenerator(inner);
		const prompt = createPrompt('test');

		const result = await decorator.generate(prompt, defaultSettings);

		expect(result).toBe('the response');
		expect(inner.generate).toHaveBeenCalledWith(prompt, defaultSettings);
	});

	it('delegates abort() to inner generator', () => {
		const inner = createMockGenerator();
		const decorator = new TrainingCaptureGenerator(inner);

		decorator.abort();

		expect(inner.abort).toHaveBeenCalled();
	});

	it('records pair in store when enabled', async () => {
		const inner = createMockGenerator('{"time": "noon"}');
		const decorator = new TrainingCaptureGenerator(inner);
		const prompt = createPrompt('timeInitial');

		await decorator.generate(prompt, {
			maxTokens: 4096,
			temperature: 0.3,
		});

		expect(getTrainingPairCount()).toBe(1);
		const pairs = getTrainingPairs();
		expect(pairs[0].promptName).toBe('timeInitial');
		expect(pairs[0].messages).toEqual([
			{ role: 'system', content: 'You are a test extractor.' },
			{ role: 'user', content: 'Extract something.' },
		]);
		expect(pairs[0].response).toBe('{"time": "noon"}');
		expect(pairs[0].temperature).toBe(0.3);
		expect(pairs[0].maxTokens).toBe(4096);
	});

	it('does not record when disabled', async () => {
		mockSettings.v2TrainingCapture = false;

		const inner = createMockGenerator('response');
		const decorator = new TrainingCaptureGenerator(inner);

		await decorator.generate(createPrompt('test'), defaultSettings);

		expect(getTrainingPairCount()).toBe(0);
	});

	it('uses default temperature when not specified', async () => {
		const inner = createMockGenerator('response');
		const decorator = new TrainingCaptureGenerator(inner);

		await decorator.generate(createPrompt('test'), { maxTokens: 2048 });

		const pairs = getTrainingPairs();
		expect(pairs[0].temperature).toBe(0.5);
	});
});

describe('withTrainingCapture', () => {
	beforeEach(() => {
		mockSettings.v2TrainingCapture = true;
	});

	it('returns decorator when enabled', () => {
		const inner = createMockGenerator();
		const result = withTrainingCapture(inner);

		expect(result).toBeInstanceOf(TrainingCaptureGenerator);
		expect(result).not.toBe(inner);
	});

	it('returns passthrough when disabled', () => {
		mockSettings.v2TrainingCapture = false;

		const inner = createMockGenerator();
		const result = withTrainingCapture(inner);

		expect(result).toBe(inner);
	});
});
