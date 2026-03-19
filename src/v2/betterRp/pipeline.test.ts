import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBetterRpPipeline, type BetterRpPipelineParams } from './pipeline';
import type { Generator } from '../generator/Generator';
import { GeneratorAbortError } from '../generator/Generator';
import type { V2Settings } from '../settings/types';
import { createDefaultV2Settings } from '../settings/defaults';

// Mock dependencies
vi.mock('./context', () => ({
	buildSharedContext: vi.fn(async () => 'mock shared context'),
}));

vi.mock('../utils/worldinfo', () => ({
	getWorldinfoForPrompt: vi.fn(async () => 'mock worldinfo'),
}));

vi.mock('../../utils/debug', () => ({
	debugLog: vi.fn(),
	debugWarn: vi.fn(),
	errorLog: vi.fn(),
}));

vi.mock('../training', () => ({
	isTrainingCaptureEnabled: vi.fn(() => false),
	annotateLastCapture: vi.fn(),
}));

function makeGenerator(responses: string[]): Generator {
	let callIndex = 0;
	return {
		generate: vi.fn(async () => {
			const response = responses[callIndex] || '{}';
			callIndex++;
			return response;
		}),
		abort: vi.fn(),
	};
}

function makeSettings(overrides?: Partial<V2Settings>): V2Settings {
	return {
		...createDefaultV2Settings(),
		v2ProfileId: 'test-profile',
		v2BetterRpEnabled: true,
		v2BetterRpMaxTokensPerStep: 2048,
		v2IncludeWorldinfo: false,
		...overrides,
	};
}

function makeParams(
	generator: Generator,
	settings?: V2Settings,
	overrides?: Partial<BetterRpPipelineParams>,
): BetterRpPipelineParams {
	return {
		generator,
		store: {} as BetterRpPipelineParams['store'],
		stContext: {
			chat: [
				{ name: 'User', mes: 'Hello', is_user: true },
				{ name: 'Kira', mes: 'Hi', is_user: false },
			],
			name1: 'User',
			name2: 'Kira',
			characterId: 0,
			characters: [{ description: 'A character' }],
		} as unknown as BetterRpPipelineParams['stContext'],
		swipeContext: { getCanonicalSwipeId: () => 0 },
		projection: {
			source: { messageId: 1, swipeId: 0 },
			time: null,
			location: null,
			forecasts: {},
			climate: null,
			scene: null,
			characters: {
				Kira: {
					name: 'Kira',
					position: 'standing',
					activity: null,
					mood: [],
					physicalState: [],
					outfit: {},
					profile: null,
				},
			},
			relationships: {},
			currentChapter: 0,
			charactersPresent: ['User', 'Kira'],
			narrativeEvents: [],
		} as unknown as BetterRpPipelineParams['projection'],
		settings: settings || makeSettings(),
		...overrides,
	};
}

// The pipeline uses assistant prefill "{\n", so the LLM response is everything
// after that. We build valid responses by taking the full JSON and removing
// the leading "{" that the prefill already provides.
function afterPrefill(obj: unknown): string {
	const full = JSON.stringify(obj, null, 2);
	return full.slice(1);
}

const VALID_STEP1 = afterPrefill({
	unresolvedActions: ['Kira asked a question'],
	physicalContinuity: ['Kira at counter'],
	openThreads: ['Trust'],
	environmentalFactors: ['Night'],
});

const VALID_STEP2 = afterPrefill({
	characters: [
		{
			character: 'Kira',
			knows: ['User came'],
			doesntKnow: ['How user feels'],
			assumes: ['Will be hurt'],
			wantsRightNow: 'Understanding',
			candidateActions: ['Deflect', 'Share'],
		},
	],
});

const VALID_STEP3 = afterPrefill({
	directive: 'sustain',
	rationale: 'Too early',
	dramaticIronyOpportunities: ['Secret'],
	threadPriority: ['Trust'],
	toneTarget: 'Quiet tension',
});

const VALID_STEP4 = afterPrefill({
	directions: [
		{
			narration: 'Kira sets glass down',
			dialogue: 'Answers the question — names what kept her silent',
			sensory: 'The clink of glass on granite',
			intent: 'Testing whether honesty will be punished',
		},
	],
});

describe('runBetterRpPipeline', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ========================================
	// Happy path
	// ========================================

	it('runs all 4 steps sequentially with valid responses', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const result = await runBetterRpPipeline(makeParams(gen));

		expect(gen.generate).toHaveBeenCalledTimes(4);
		expect(result.continuityAudit).not.toBeNull();
		expect(result.characterKnowledge).not.toBeNull();
		expect(result.tensionSteering).not.toBeNull();
		expect(result.beatPlanning).not.toBeNull();
		expect(result.errors).toHaveLength(0);
	});

	it('parses step 1 result correctly', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const result = await runBetterRpPipeline(makeParams(gen));

		expect(result.continuityAudit!.unresolvedActions).toEqual([
			'Kira asked a question',
		]);
		expect(result.continuityAudit!.physicalContinuity).toEqual(['Kira at counter']);
		expect(result.continuityAudit!.openThreads).toEqual(['Trust']);
		expect(result.continuityAudit!.environmentalFactors).toEqual(['Night']);
	});

	it('parses step 2 result correctly', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const result = await runBetterRpPipeline(makeParams(gen));

		expect(result.characterKnowledge!.characters).toHaveLength(1);
		expect(result.characterKnowledge!.characters[0].character).toBe('Kira');
		expect(result.characterKnowledge!.characters[0].wantsRightNow).toBe(
			'Understanding',
		);
	});

	it('parses step 3 result correctly', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const result = await runBetterRpPipeline(makeParams(gen));

		expect(result.tensionSteering!.directive).toBe('sustain');
		expect(result.tensionSteering!.toneTarget).toBe('Quiet tension');
	});

	it('parses step 4 result correctly', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const result = await runBetterRpPipeline(makeParams(gen));

		expect(result.beatPlanning!.directions).toHaveLength(1);
		expect(result.beatPlanning!.directions[0].narration).toBe('Kira sets glass down');
		expect(result.beatPlanning!.directions[0].dialogue).toBe(
			'Answers the question — names what kept her silent',
		);
		expect(result.beatPlanning!.directions[0].sensory).toBe(
			'The clink of glass on granite',
		);
	});

	// ========================================
	// Assistant prefill
	// ========================================

	it('uses assistant prefill to force JSON output', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		await runBetterRpPipeline(makeParams(gen));

		for (const call of (gen.generate as ReturnType<typeof vi.fn>).mock.calls) {
			const prompt = call[0];
			const assistantMsg = prompt.messages.find(
				(m: { role: string }) => m.role === 'assistant',
			);
			expect(assistantMsg).toBeDefined();
			expect(assistantMsg.content).toBe('{\n');
		}
	});

	it('each prompt has system, user, and assistant messages', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		await runBetterRpPipeline(makeParams(gen));

		for (const call of (gen.generate as ReturnType<typeof vi.fn>).mock.calls) {
			const prompt = call[0];
			const roles = prompt.messages.map((m: { role: string }) => m.role);
			expect(roles).toEqual(['system', 'user', 'assistant']);
		}
	});

	// ========================================
	// Retry behavior
	// ========================================

	it('retries on parse failure with lower temperature', async () => {
		let callCount = 0;
		const gen: Generator = {
			generate: vi.fn(async (_prompt, settings) => {
				callCount++;
				if (callCount === 1) return 'not valid json at all';
				if (callCount === 2) {
					expect(settings?.temperature).toBe(0.1);
					return VALID_STEP1;
				}
				if (callCount === 3) return VALID_STEP2;
				if (callCount === 4) return VALID_STEP3;
				return VALID_STEP4;
			}),
			abort: vi.fn(),
		};

		const result = await runBetterRpPipeline(makeParams(gen));
		expect(callCount).toBe(5);
		expect(result.continuityAudit).not.toBeNull();
		expect(result.errors).toHaveLength(0);
	});

	it('retries up to 3 times total (initial + 2 retries)', async () => {
		let step1Calls = 0;
		const gen: Generator = {
			generate: vi.fn(async () => {
				step1Calls++;
				if (step1Calls <= 3) return 'bad'; // All 3 attempts for step 1 fail
				// Steps 2-4 would succeed, but each also fails 3 times
				return 'bad';
			}),
			abort: vi.fn(),
		};

		const result = await runBetterRpPipeline(makeParams(gen));
		// 4 steps × 3 attempts each = 12
		expect(gen.generate).toHaveBeenCalledTimes(12);
		expect(result.errors).toHaveLength(4);
	});

	it('uses initial temperature on first attempt, retry temperature on subsequent', async () => {
		const temperatures: number[] = [];
		let callCount = 0;
		const gen: Generator = {
			generate: vi.fn(async (_prompt, settings) => {
				callCount++;
				temperatures.push(settings?.temperature ?? -1);
				if (callCount <= 2) return 'bad'; // Step 1: fail first 2
				if (callCount === 3) return VALID_STEP1; // Step 1: succeed on 3rd
				if (callCount === 4) return VALID_STEP2;
				if (callCount === 5) return VALID_STEP3;
				return VALID_STEP4;
			}),
			abort: vi.fn(),
		};

		await runBetterRpPipeline(makeParams(gen));

		// Step 1: attempt 1 at 0.4, attempt 2 at 0.1, attempt 3 at 0.1
		expect(temperatures[0]).toBe(0.4);
		expect(temperatures[1]).toBe(0.1);
		expect(temperatures[2]).toBe(0.1);
	});

	// ========================================
	// Graceful degradation
	// ========================================

	it('continues after step failure when all retries exhausted', async () => {
		let callCount = 0;
		const gen: Generator = {
			generate: vi.fn(async () => {
				callCount++;
				if (callCount === 1) return VALID_STEP1;
				if (callCount <= 4) return 'invalid'; // Step 2: 3 attempts fail
				if (callCount === 5) return VALID_STEP3;
				return VALID_STEP4;
			}),
			abort: vi.fn(),
		};

		const result = await runBetterRpPipeline(makeParams(gen));

		expect(result.continuityAudit).not.toBeNull();
		expect(result.characterKnowledge).toBeNull();
		expect(result.tensionSteering).not.toBeNull();
		expect(result.beatPlanning).not.toBeNull();
		expect(result.errors.some(e => e.step === 'characterKnowledge')).toBe(true);
	});

	it('returns all nulls when all steps fail', async () => {
		const gen: Generator = {
			generate: vi.fn(async () => 'bad'),
			abort: vi.fn(),
		};
		const result = await runBetterRpPipeline(makeParams(gen));

		expect(result.continuityAudit).toBeNull();
		expect(result.characterKnowledge).toBeNull();
		expect(result.tensionSteering).toBeNull();
		expect(result.beatPlanning).toBeNull();
		expect(result.errors.length).toBe(4);
	});

	it('continues when generator throws non-abort error on final retry', async () => {
		let callCount = 0;
		const gen: Generator = {
			generate: vi.fn(async () => {
				callCount++;
				if (callCount <= 2) return 'bad'; // Fail parse twice
				if (callCount === 3) throw new Error('Network error'); // Throw on 3rd
				// Steps 2-4 succeed
				if (callCount === 4) return VALID_STEP2;
				if (callCount === 5) return VALID_STEP3;
				return VALID_STEP4;
			}),
			abort: vi.fn(),
		};

		const result = await runBetterRpPipeline(makeParams(gen));

		expect(result.continuityAudit).toBeNull();
		expect(result.characterKnowledge).not.toBeNull();
		expect(result.errors.some(e => e.step === 'continuityAudit')).toBe(true);
	});

	it('step 3 still works when step 2 failed (null propagation)', async () => {
		let callCount = 0;
		const gen: Generator = {
			generate: vi.fn(async () => {
				callCount++;
				if (callCount === 1) return VALID_STEP1;
				if (callCount <= 4) return 'bad'; // Step 2 fails all 3 attempts
				if (callCount === 5) return VALID_STEP3; // Step 3 works
				return VALID_STEP4;
			}),
			abort: vi.fn(),
		};

		const result = await runBetterRpPipeline(makeParams(gen));

		expect(result.characterKnowledge).toBeNull();
		expect(result.tensionSteering).not.toBeNull();
		expect(result.tensionSteering!.directive).toBe('sustain');
	});

	// ========================================
	// Abort handling
	// ========================================

	it('stops on abort signal between steps', async () => {
		const controller = new AbortController();
		let callCount = 0;
		const gen: Generator = {
			generate: vi.fn(async () => {
				callCount++;
				controller.abort();
				return VALID_STEP1;
			}),
			abort: vi.fn(),
		};

		const result = await runBetterRpPipeline(
			makeParams(gen, undefined, { abortSignal: controller.signal }),
		);

		expect(callCount).toBe(1);
		expect(result.continuityAudit).not.toBeNull();
		expect(result.characterKnowledge).toBeNull();
		expect(result.tensionSteering).toBeNull();
		expect(result.beatPlanning).toBeNull();
	});

	it('returns partial result when aborted mid-pipeline', async () => {
		const controller = new AbortController();
		let callCount = 0;
		const gen: Generator = {
			generate: vi.fn(async () => {
				callCount++;
				if (callCount === 1) return VALID_STEP1;
				if (callCount === 2) return VALID_STEP2;
				// Abort before step 3
				controller.abort();
				return VALID_STEP3;
			}),
			abort: vi.fn(),
		};

		const result = await runBetterRpPipeline(
			makeParams(gen, undefined, { abortSignal: controller.signal }),
		);

		expect(result.continuityAudit).not.toBeNull();
		expect(result.characterKnowledge).not.toBeNull();
		// Step 3 returned valid but abort was set, then checked before step 4
		expect(result.tensionSteering).not.toBeNull();
		expect(result.beatPlanning).toBeNull();
	});

	it('handles pre-aborted signal', async () => {
		const controller = new AbortController();
		controller.abort(); // Already aborted before pipeline starts

		const gen = makeGenerator([]);
		const result = await runBetterRpPipeline(
			makeParams(gen, undefined, { abortSignal: controller.signal }),
		);

		expect(gen.generate).not.toHaveBeenCalled();
		expect(result.continuityAudit).toBeNull();
	});

	it('stops immediately when generator throws AbortError', async () => {
		const gen: Generator = {
			generate: vi.fn(async () => {
				throw new GeneratorAbortError('Aborted');
			}),
			abort: vi.fn(),
		};

		const result = await runBetterRpPipeline(makeParams(gen));

		expect(gen.generate).toHaveBeenCalledTimes(1);
		expect(result.continuityAudit).toBeNull();
		expect(result.characterKnowledge).toBeNull();
		expect(result.errors).toHaveLength(0); // Abort is not an error
	});

	// ========================================
	// NPC handling
	// ========================================

	it('returns empty result when no NPC characters present', async () => {
		const gen = makeGenerator([]);
		const params = makeParams(gen);
		params.projection = {
			...params.projection,
			charactersPresent: ['User'],
		} as typeof params.projection;

		const result = await runBetterRpPipeline(params);
		expect(gen.generate).not.toHaveBeenCalled();
		expect(result.beatPlanning).toBeNull();
	});

	it('filters user from NPC names (case insensitive)', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const params = makeParams(gen);
		params.projection = {
			...params.projection,
			charactersPresent: ['user', 'Kira', 'Marcus'], // lowercase 'user'
		} as typeof params.projection;

		await runBetterRpPipeline(params);

		// Check system prompt contains NPC names but not User
		const firstCall = (gen.generate as ReturnType<typeof vi.fn>).mock.calls[0];
		const systemMsg = firstCall[0].messages[0].content;
		expect(systemMsg).toContain('Kira');
		expect(systemMsg).toContain('Marcus');
		expect(systemMsg).not.toMatch(/auditing for:.*user/i);
	});

	it('handles multiple NPC characters', async () => {
		const step2MultiNpc = afterPrefill({
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
					knows: [],
					doesntKnow: [],
					assumes: [],
					wantsRightNow: 'Food',
					candidateActions: ['Eat'],
				},
			],
		});

		const gen = makeGenerator([VALID_STEP1, step2MultiNpc, VALID_STEP3, VALID_STEP4]);
		const params = makeParams(gen);
		params.projection = {
			...params.projection,
			charactersPresent: ['User', 'Kira', 'Marcus'],
		} as typeof params.projection;

		const result = await runBetterRpPipeline(params);

		expect(result.characterKnowledge!.characters).toHaveLength(2);
		expect(result.characterKnowledge!.characters[0].character).toBe('Kira');
		expect(result.characterKnowledge!.characters[1].character).toBe('Marcus');
	});

	// ========================================
	// Status callbacks
	// ========================================

	it('calls setStatus for each step', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const setStatus = vi.fn();
		await runBetterRpPipeline(makeParams(gen, undefined, { setStatus }));

		expect(setStatus).toHaveBeenCalledWith('Auditing continuity... (1/4)');
		expect(setStatus).toHaveBeenCalledWith('Analyzing characters... (2/4)');
		expect(setStatus).toHaveBeenCalledWith('Planning direction... (3/4)');
		expect(setStatus).toHaveBeenCalledWith('Plotting beats... (4/4)');
		expect(setStatus).toHaveBeenCalledTimes(4);
	});

	it('does not call setStatus for skipped steps (abort)', async () => {
		const controller = new AbortController();
		controller.abort();

		const gen = makeGenerator([]);
		const setStatus = vi.fn();
		await runBetterRpPipeline(
			makeParams(gen, undefined, { setStatus, abortSignal: controller.signal }),
		);

		expect(setStatus).not.toHaveBeenCalled();
	});

	// ========================================
	// Prompt prefix/suffix
	// ========================================

	it('applies prompt prefix and suffix to user prompts', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const settings = makeSettings({
			v2PromptPrefix: '/nothink',
			v2PromptSuffix: 'END',
		});

		await runBetterRpPipeline(makeParams(gen, settings));

		for (const call of (gen.generate as ReturnType<typeof vi.fn>).mock.calls) {
			const prompt = call[0];
			const userMessage = prompt.messages.find(
				(m: { role: string }) => m.role === 'user',
			);
			expect(userMessage.content).toMatch(/^\/nothink\n/);
			expect(userMessage.content).toMatch(/\nEND$/);
		}
	});

	it('works without prefix/suffix (empty strings)', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const settings = makeSettings({ v2PromptPrefix: '', v2PromptSuffix: '' });

		await runBetterRpPipeline(makeParams(gen, settings));

		for (const call of (gen.generate as ReturnType<typeof vi.fn>).mock.calls) {
			const prompt = call[0];
			const userMessage = prompt.messages.find(
				(m: { role: string }) => m.role === 'user',
			);
			// Should start with the shared context, not a newline
			expect(userMessage.content).toMatch(/^mock shared context/);
		}
	});

	// ========================================
	// Shakeup passthrough
	// ========================================

	it('passes shakeup instruction through to context', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const { buildSharedContext } = await import('./context');
		const mockBuild = vi.mocked(buildSharedContext);

		await runBetterRpPipeline(
			makeParams(gen, undefined, { shakeupInstruction: 'An earthquake happens' }),
		);

		expect(mockBuild).toHaveBeenCalledWith(
			expect.objectContaining({
				shakeupInstruction: 'An earthquake happens',
			}),
		);
	});

	it('passes null shakeup when not provided', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const { buildSharedContext } = await import('./context');
		const mockBuild = vi.mocked(buildSharedContext);

		await runBetterRpPipeline(makeParams(gen));

		expect(mockBuild).toHaveBeenCalledWith(
			expect.objectContaining({
				shakeupInstruction: undefined,
			}),
		);
	});

	// ========================================
	// Step output propagation
	// ========================================

	it('step 2 user prompt contains step 1 output', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		await runBetterRpPipeline(makeParams(gen));

		const step2Call = (gen.generate as ReturnType<typeof vi.fn>).mock.calls[1];
		const userMsg = step2Call[0].messages[1].content;
		expect(userMsg).toContain('[Previous Analysis]');
		expect(userMsg).toContain('Kira asked a question');
	});

	it('step 3 user prompt contains steps 1+2 output', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		await runBetterRpPipeline(makeParams(gen));

		const step3Call = (gen.generate as ReturnType<typeof vi.fn>).mock.calls[2];
		const userMsg = step3Call[0].messages[1].content;
		expect(userMsg).toContain('[Previous Analysis]');
		expect(userMsg).toContain('Kira asked a question'); // Step 1
		expect(userMsg).toContain('Understanding'); // Step 2
	});

	it('step 4 user prompt contains steps 1+2+3 output', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		await runBetterRpPipeline(makeParams(gen));

		const step4Call = (gen.generate as ReturnType<typeof vi.fn>).mock.calls[3];
		const userMsg = step4Call[0].messages[1].content;
		expect(userMsg).toContain('[Previous Analysis]');
		expect(userMsg).toContain('Kira asked a question'); // Step 1
		expect(userMsg).toContain('Understanding'); // Step 2
		expect(userMsg).toContain('sustain'); // Step 3
	});

	it('step 3 still gets step 1 output when step 2 failed', async () => {
		let callCount = 0;
		const gen: Generator = {
			generate: vi.fn(async () => {
				callCount++;
				if (callCount === 1) return VALID_STEP1;
				if (callCount <= 4) return 'bad'; // Step 2 fails 3 times
				if (callCount === 5) return VALID_STEP3;
				return VALID_STEP4;
			}),
			abort: vi.fn(),
		};

		await runBetterRpPipeline(makeParams(gen));

		// Step 3 is call index 4 (0-indexed), but due to retries it's call 5
		const step3Call = (gen.generate as ReturnType<typeof vi.fn>).mock.calls[4];
		const userMsg = step3Call[0].messages[1].content;
		expect(userMsg).toContain('[Previous Analysis]');
		expect(userMsg).toContain('Kira asked a question'); // Step 1 present
		// Step 2 is null so characterKnowledge key should not appear
	});

	// ========================================
	// Max tokens setting
	// ========================================

	it('passes maxTokens setting to each generate call', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		const settings = makeSettings({ v2BetterRpMaxTokensPerStep: 4096 });

		await runBetterRpPipeline(makeParams(gen, settings));

		for (const call of (gen.generate as ReturnType<typeof vi.fn>).mock.calls) {
			expect(call[1].maxTokens).toBe(4096);
		}
	});

	// ========================================
	// Prompt naming
	// ========================================

	it('names each prompt for debug logging', async () => {
		const gen = makeGenerator([VALID_STEP1, VALID_STEP2, VALID_STEP3, VALID_STEP4]);
		await runBetterRpPipeline(makeParams(gen));

		const names = (gen.generate as ReturnType<typeof vi.fn>).mock.calls.map(
			(call: unknown[]) => (call[0] as { name: string }).name,
		);
		expect(names).toEqual([
			'betterRp-continuityAudit',
			'betterRp-characterKnowledge',
			'betterRp-tensionSteering',
			'betterRp-beatPlanning',
		]);
	});
});
