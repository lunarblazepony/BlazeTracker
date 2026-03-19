import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	captureRawPair,
	annotateLastCapture,
	getTrainingPairCount,
	getTrainingPairs,
	clearTrainingPairs,
	exportTrainingDataAsJsonl,
	downloadTrainingData,
	isTrainingCaptureEnabled,
} from './TrainingDataStore';

// Mock settings
vi.mock('../settings', () => ({
	getV2Settings: vi.fn(() => ({
		v2TrainingCapture: true,
	})),
}));

describe('TrainingDataStore', () => {
	beforeEach(() => {
		clearTrainingPairs();
	});

	describe('isTrainingCaptureEnabled', () => {
		it('returns true when setting is enabled', () => {
			expect(isTrainingCaptureEnabled()).toBe(true);
		});
	});

	describe('captureRawPair', () => {
		it('adds a pair with correct defaults', () => {
			captureRawPair({
				promptName: 'timeInitial',
				messages: [
					{ role: 'system', content: 'You are a time extractor.' },
					{ role: 'user', content: 'Extract the time.' },
				],
				response: '{"time": "morning"}',
				temperature: 0.3,
				maxTokens: 4096,
			});

			expect(getTrainingPairCount()).toBe(1);
			const pairs = getTrainingPairs();
			expect(pairs[0].promptName).toBe('timeInitial');
			expect(pairs[0].messages).toHaveLength(2);
			expect(pairs[0].messages[0].role).toBe('system');
			expect(pairs[0].response).toBe('{"time": "morning"}');
			expect(pairs[0].parseSuccess).toBe(false);
			expect(pairs[0].parsedResult).toBeUndefined();
			expect(pairs[0].temperature).toBe(0.3);
			expect(pairs[0].maxTokens).toBe(4096);
			expect(pairs[0].timestamp).toBeTruthy();
		});

		it('adds multiple pairs', () => {
			captureRawPair({
				promptName: 'timeInitial',
				messages: [{ role: 'user', content: 'a' }],
				response: 'r1',
				temperature: 0.3,
				maxTokens: 4096,
			});
			captureRawPair({
				promptName: 'locationUpdate',
				messages: [{ role: 'user', content: 'b' }],
				response: 'r2',
				temperature: 0.5,
				maxTokens: 4096,
			});

			expect(getTrainingPairCount()).toBe(2);
		});
	});

	describe('annotateLastCapture', () => {
		it('updates the most recent unannotated pair', () => {
			captureRawPair({
				promptName: 'timeInitial',
				messages: [{ role: 'user', content: 'a' }],
				response: '{"time": "noon"}',
				temperature: 0.3,
				maxTokens: 4096,
			});

			annotateLastCapture({
				parsedResult: { time: 'noon' },
				parseSuccess: true,
			});

			const pairs = getTrainingPairs();
			expect(pairs[0].parseSuccess).toBe(true);
			expect(pairs[0].parsedResult).toEqual({ time: 'noon' });
			expect(pairs[0].parseError).toBeUndefined();
		});

		it('skips already-annotated pairs', () => {
			captureRawPair({
				promptName: 'first',
				messages: [{ role: 'user', content: 'a' }],
				response: 'r1',
				temperature: 0.3,
				maxTokens: 4096,
			});
			annotateLastCapture({
				parsedResult: { v: 1 },
				parseSuccess: true,
			});

			captureRawPair({
				promptName: 'second',
				messages: [{ role: 'user', content: 'b' }],
				response: 'r2',
				temperature: 0.5,
				maxTokens: 4096,
			});
			annotateLastCapture({
				parsedResult: { v: 2 },
				parseSuccess: true,
			});

			const pairs = getTrainingPairs();
			expect(pairs[0].parsedResult).toEqual({ v: 1 });
			expect(pairs[1].parsedResult).toEqual({ v: 2 });
		});

		it('records parse errors', () => {
			captureRawPair({
				promptName: 'test',
				messages: [{ role: 'user', content: 'a' }],
				response: 'invalid json',
				temperature: 0.3,
				maxTokens: 4096,
			});

			annotateLastCapture({
				parseSuccess: false,
				parseError: 'parseResponse returned null',
			});

			const pairs = getTrainingPairs();
			expect(pairs[0].parseSuccess).toBe(false);
			expect(pairs[0].parseError).toBe('parseResponse returned null');
		});
	});

	describe('clearTrainingPairs', () => {
		it('empties the store', () => {
			captureRawPair({
				promptName: 'test',
				messages: [{ role: 'user', content: 'a' }],
				response: 'r',
				temperature: 0.3,
				maxTokens: 4096,
			});
			expect(getTrainingPairCount()).toBe(1);

			clearTrainingPairs();
			expect(getTrainingPairCount()).toBe(0);
			expect(getTrainingPairs()).toHaveLength(0);
		});
	});

	describe('exportTrainingDataAsJsonl', () => {
		it('returns one JSON object per line', () => {
			captureRawPair({
				promptName: 'first',
				messages: [
					{ role: 'system', content: 'sys' },
					{ role: 'user', content: 'usr' },
				],
				response: 'resp1',
				temperature: 0.3,
				maxTokens: 4096,
			});
			annotateLastCapture({ parsedResult: { v: 1 }, parseSuccess: true });

			captureRawPair({
				promptName: 'second',
				messages: [{ role: 'user', content: 'usr2' }],
				response: 'resp2',
				temperature: 0.5,
				maxTokens: 2048,
			});
			annotateLastCapture({ parsedResult: { v: 2 }, parseSuccess: true });

			const jsonl = exportTrainingDataAsJsonl();
			const lines = jsonl.split('\n');
			expect(lines).toHaveLength(2);

			const first = JSON.parse(lines[0]);
			expect(first.promptName).toBe('first');
			expect(first.messages).toHaveLength(2);
			expect(first.response).toBe('resp1');
			expect(first.parseSuccess).toBe(true);

			const second = JSON.parse(lines[1]);
			expect(second.promptName).toBe('second');
			expect(second.response).toBe('resp2');
		});

		it('returns empty string for empty store', () => {
			expect(exportTrainingDataAsJsonl()).toBe('');
		});
	});

	describe('downloadTrainingData', () => {
		it('creates and clicks a download link', () => {
			// Set up minimal DOM stubs for node environment
			const clickMock = vi.fn();
			const fakeAnchor = { href: '', download: '', click: clickMock };
			const origDocument = globalThis.document;
			globalThis.document = {
				createElement: vi.fn(() => fakeAnchor),
			} as unknown as Document;

			const createObjectURLMock = vi.fn(() => 'blob:test-url');
			const revokeObjectURLMock = vi.fn();
			global.URL.createObjectURL = createObjectURLMock;
			global.URL.revokeObjectURL = revokeObjectURLMock;

			captureRawPair({
				promptName: 'test',
				messages: [{ role: 'user', content: 'a' }],
				response: 'r',
				temperature: 0.3,
				maxTokens: 4096,
			});

			downloadTrainingData();

			expect(createObjectURLMock).toHaveBeenCalled();
			expect(clickMock).toHaveBeenCalled();
			expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
			expect(fakeAnchor.download).toMatch(/^blazetracker-training-.*\.jsonl$/);

			globalThis.document = origDocument;
		});

		it('does nothing when store is empty', () => {
			const createObjectURLMock = vi.fn();
			global.URL.createObjectURL = createObjectURLMock;

			downloadTrainingData();

			expect(createObjectURLMock).not.toHaveBeenCalled();
		});
	});
});
