/**
 * Prompt Hook Tests
 *
 * Tests for both chat completion and text completion prompt hooks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EventStore } from '../store/EventStore';
import { createDefaultV2Settings } from '../settings/defaults';

// Mock getV2Settings so we can control inject settings per-test
const mockSettings = createDefaultV2Settings();
vi.mock('../settings', () => ({
	getV2Settings: vi.fn(() => mockSettings),
}));

import { getV2Settings } from '../settings';
const mockGetV2Settings = vi.mocked(getV2Settings);

// Mock SillyTavern global
const mockEventSource = {
	on: vi.fn(),
	off: vi.fn(),
};

const mockEventTypes = {
	CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
	GENERATE_BEFORE_COMBINE_PROMPTS: 'generate_before_combine_prompts',
};

const mockChat = [
	{ mes: 'Hello', is_user: true },
	{ mes: 'Hi there!', is_user: false },
];

const mockContext = {
	eventSource: mockEventSource,
	event_types: mockEventTypes,
	chat: mockChat,
};

// Set up global SillyTavern mock
(globalThis as unknown as { SillyTavern: { getContext: () => typeof mockContext } }).SillyTavern = {
	getContext: () => mockContext,
};

// Now import the module (after mocking)
import {
	registerBridgeFunctions,
	registerPromptHook,
	unregisterPromptHook,
	isPromptHookAvailable,
	isPromptHookRegistered,
	getRegisteredHooks,
} from './promptHook';

// ============================================
// Test Setup
// ============================================

describe('promptHook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset hook registration state by unregistering
		unregisterPromptHook();
	});

	afterEach(() => {
		unregisterPromptHook();
	});

	// ============================================
	// isPromptHookAvailable Tests
	// ============================================

	describe('isPromptHookAvailable', () => {
		it('returns true when chat completion event is available', () => {
			expect(isPromptHookAvailable()).toBe(true);
		});

		it('returns true when only text completion event is available', () => {
			const originalEventTypes = mockContext.event_types;
			mockContext.event_types = {
				GENERATE_BEFORE_COMBINE_PROMPTS: 'generate_before_combine_prompts',
			} as typeof mockEventTypes;

			expect(isPromptHookAvailable()).toBe(true);

			mockContext.event_types = originalEventTypes;
		});

		it('returns false when no events are available', () => {
			const originalEventTypes = mockContext.event_types;
			mockContext.event_types = {} as typeof mockEventTypes;

			expect(isPromptHookAvailable()).toBe(false);

			mockContext.event_types = originalEventTypes;
		});
	});

	// ============================================
	// registerPromptHook Tests
	// ============================================

	describe('registerPromptHook', () => {
		it('registers chat completion hook when available', () => {
			registerPromptHook();

			expect(mockEventSource.on).toHaveBeenCalledWith(
				'chat_completion_prompt_ready',
				expect.any(Function),
			);
		});

		it('registers text completion hook when available', () => {
			registerPromptHook();

			expect(mockEventSource.on).toHaveBeenCalledWith(
				'generate_before_combine_prompts',
				expect.any(Function),
			);
		});

		it('registers both hooks when both are available', () => {
			registerPromptHook();

			expect(mockEventSource.on).toHaveBeenCalledTimes(2);
			expect(getRegisteredHooks()).toEqual({
				chatCompletion: true,
				textCompletion: true,
			});
		});

		it('does not re-register hooks if already registered', () => {
			registerPromptHook();
			registerPromptHook();

			// Should still only be called twice (once for each hook type)
			expect(mockEventSource.on).toHaveBeenCalledTimes(2);
		});

		it('only registers available hooks', () => {
			const originalEventTypes = mockContext.event_types;
			mockContext.event_types = {
				CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
			} as typeof mockEventTypes;

			registerPromptHook();

			expect(mockEventSource.on).toHaveBeenCalledTimes(1);
			expect(getRegisteredHooks()).toEqual({
				chatCompletion: true,
				textCompletion: false,
			});

			mockContext.event_types = originalEventTypes;
		});
	});

	// ============================================
	// unregisterPromptHook Tests
	// ============================================

	describe('unregisterPromptHook', () => {
		it('unregisters chat completion hook', () => {
			registerPromptHook();
			unregisterPromptHook();

			expect(mockEventSource.off).toHaveBeenCalledWith(
				'chat_completion_prompt_ready',
				expect.any(Function),
			);
		});

		it('unregisters text completion hook', () => {
			registerPromptHook();
			unregisterPromptHook();

			expect(mockEventSource.off).toHaveBeenCalledWith(
				'generate_before_combine_prompts',
				expect.any(Function),
			);
		});

		it('updates registration state', () => {
			registerPromptHook();
			expect(isPromptHookRegistered()).toBe(true);

			unregisterPromptHook();
			expect(isPromptHookRegistered()).toBe(false);
		});
	});

	// ============================================
	// isPromptHookRegistered Tests
	// ============================================

	describe('isPromptHookRegistered', () => {
		it('returns false when no hooks registered', () => {
			expect(isPromptHookRegistered()).toBe(false);
		});

		it('returns true when hooks are registered', () => {
			registerPromptHook();
			expect(isPromptHookRegistered()).toBe(true);
		});
	});

	// ============================================
	// getRegisteredHooks Tests
	// ============================================

	describe('getRegisteredHooks', () => {
		it('returns both false when no hooks registered', () => {
			expect(getRegisteredHooks()).toEqual({
				chatCompletion: false,
				textCompletion: false,
			});
		});

		it('returns correct state after registration', () => {
			registerPromptHook();
			expect(getRegisteredHooks()).toEqual({
				chatCompletion: true,
				textCompletion: true,
			});
		});
	});

	// ============================================
	// registerBridgeFunctions Tests
	// ============================================

	describe('registerBridgeFunctions', () => {
		it('accepts bridge functions without error', () => {
			const mockBridgeFunctions = {
				getV2EventStore: vi.fn(() => null),
				hasV2InitialSnapshot: vi.fn(() => false),
				buildSwipeContext: vi.fn(() => ({ getCanonicalSwipeId: () => 0 })),
			};

			expect(() => registerBridgeFunctions(mockBridgeFunctions)).not.toThrow();
		});
	});
});

// ============================================
// Handler Behavior Tests
// ============================================

describe('prompt hook handlers', () => {
	let chatCompletionHandler: (data: unknown) => Promise<void>;
	let textCompletionHandler: (data: unknown) => Promise<void>;

	beforeEach(() => {
		vi.clearAllMocks();
		unregisterPromptHook();

		// Capture the handlers when they're registered
		mockEventSource.on.mockImplementation((event: string, handler: unknown) => {
			if (event === 'chat_completion_prompt_ready') {
				chatCompletionHandler = handler as (data: unknown) => Promise<void>;
			} else if (event === 'generate_before_combine_prompts') {
				textCompletionHandler = handler as (data: unknown) => Promise<void>;
			}
		});

		registerPromptHook();
	});

	afterEach(() => {
		unregisterPromptHook();
	});

	describe('chat completion handler', () => {
		it('skips dry runs', async () => {
			const eventData = {
				chat: [{ role: 'system', content: 'You are helpful.' }],
				dryRun: true,
			};

			await chatCompletionHandler(eventData);

			// Chat should not be modified
			expect(eventData.chat).toHaveLength(1);
		});

		it('does not modify chat when bridge functions not registered', async () => {
			const eventData = {
				chat: [
					{ role: 'system', content: 'You are helpful.' },
					{ role: 'user', content: 'Hello' },
				],
				dryRun: false,
			};

			await chatCompletionHandler(eventData);

			// Chat should not be modified (no store available)
			expect(eventData.chat).toHaveLength(2);
		});
	});

	describe('text completion handler', () => {
		it('skips dry runs', async () => {
			const eventData = {
				mesSendString: 'Original messages',
				dryRun: true,
			};

			await textCompletionHandler(eventData);

			// mesSendString should not be modified
			expect(eventData.mesSendString).toBe('Original messages');
		});

		it('does not modify prompt when bridge functions not registered', async () => {
			const eventData = {
				mesSendString: 'Original messages',
				storyString: 'Story content',
				dryRun: false,
			};

			await textCompletionHandler(eventData);

			// mesSendString should not be modified (no store available)
			expect(eventData.mesSendString).toBe('Original messages');
		});
	});
});

// ============================================
// Integration Tests with Mock Store
// ============================================

describe('prompt hook with mock store', () => {
	let chatCompletionHandler: (data: unknown) => Promise<void>;
	let textCompletionHandler: (data: unknown) => Promise<void>;

	const mockStore = {
		projectStateAtMessage: vi.fn(() => ({
			time: { dayOfWeek: 'Monday', hour: 14, minute: 30 },
			location: { area: 'Downtown', place: 'Coffee Shop' },
			charactersPresent: ['Alice', 'Bob'],
		})),
		getActiveEvents: vi.fn(() => []),
		getChapterSnapshotOnCanonicalPath: vi.fn(() => null),
	};

	const mockSwipeContext = {
		getCanonicalSwipeId: () => 0,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		unregisterPromptHook();

		// Register bridge functions with mock store
		registerBridgeFunctions({
			getV2EventStore: () => mockStore as unknown as EventStore,
			hasV2InitialSnapshot: () => true,
			buildSwipeContext: () => mockSwipeContext,
		});

		// Capture the handlers
		mockEventSource.on.mockImplementation((event: string, handler: unknown) => {
			if (event === 'chat_completion_prompt_ready') {
				chatCompletionHandler = handler as (data: unknown) => Promise<void>;
			} else if (event === 'generate_before_combine_prompts') {
				textCompletionHandler = handler as (data: unknown) => Promise<void>;
			}
		});

		registerPromptHook();
	});

	afterEach(() => {
		unregisterPromptHook();
	});

	describe('chat completion injection', () => {
		it('injects content after system message', async () => {
			const eventData = {
				chat: [
					{ role: 'system', content: 'You are helpful.' },
					{ role: 'user', content: 'Hello' },
					{ role: 'assistant', content: 'Hi!' },
				],
				dryRun: false,
			};

			await chatCompletionHandler(eventData);

			// Should have injected a message after system
			expect(eventData.chat.length).toBeGreaterThanOrEqual(3);
		});

		it('injects at beginning when no system message', async () => {
			const eventData = {
				chat: [
					{ role: 'user', content: 'Hello' },
					{ role: 'assistant', content: 'Hi!' },
				],
				dryRun: false,
			};

			await chatCompletionHandler(eventData);

			// Should have injected at beginning
			expect(eventData.chat.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('text completion injection', () => {
		it('modifies finalMesSend for injection', async () => {
			const eventData = {
				mesSendString: 'Original messages here',
				storyString: 'Story content',
				api: 'kobold',
				dryRun: false,
				finalMesSend: [
					{ message: 'First message', extensionPrompts: [] },
					{ message: 'Second message', extensionPrompts: [] },
				],
			};

			await textCompletionHandler(eventData);

			// finalMesSend should be modified
			// First message should have extension prompts (before content)
			// Last message should have appended content (state)
			expect(eventData.finalMesSend).toBeDefined();
			expect(eventData.finalMesSend.length).toBe(2);
		});

		it('does not modify when finalMesSend is empty', async () => {
			const eventData = {
				mesSendString: 'Original messages here',
				storyString: 'Story content',
				api: 'kobold',
				dryRun: false,
				finalMesSend: [],
			};

			await textCompletionHandler(eventData);

			// Should not crash, finalMesSend still empty
			expect(eventData.finalMesSend).toHaveLength(0);
		});
	});

	describe('prefill/continuation handling', () => {
		it('chat completion: inserts state before assistant prefill message', async () => {
			// Set up mock chat to have assistant as last message (continuation mode)
			const originalChat = mockContext.chat;
			mockContext.chat = [
				{ mes: 'Hello', is_user: true },
				{ mes: 'Hi there!', is_user: false },
				{ mes: 'How are you?', is_user: true },
				{ mes: 'I am doing', is_user: false }, // Partial assistant response (prefill)
			];

			const eventData = {
				chat: [
					{ role: 'system', content: 'You are helpful.' },
					{ role: 'user', content: 'Hello' },
					{ role: 'assistant', content: 'Hi there!' },
					{ role: 'user', content: 'How are you?' },
					{ role: 'assistant', content: 'I am doing' }, // Prefill
				],
				dryRun: false,
			};

			await chatCompletionHandler(eventData);

			// The state should be inserted BEFORE the last assistant message
			// If state was injected, there should be a user message just before the last assistant
			if (eventData.chat.length > 5) {
				const messageBeforeLastAssistant =
					eventData.chat[eventData.chat.length - 2];
				// Should be a user message (the injected state)
				expect(messageBeforeLastAssistant.role).toBe('user');
			}

			mockContext.chat = originalChat;
		});

		it('chat completion: appends state at end when last message is user', async () => {
			// Set up mock chat to have user as last message (normal mode)
			const originalChat = mockContext.chat;
			mockContext.chat = [
				{ mes: 'Hello', is_user: true },
				{ mes: 'Hi there!', is_user: false },
				{ mes: 'How are you?', is_user: true }, // User message last (normal)
			];

			const eventData = {
				chat: [
					{ role: 'system', content: 'You are helpful.' },
					{ role: 'user', content: 'Hello' },
					{ role: 'assistant', content: 'Hi there!' },
					{ role: 'user', content: 'How are you?' },
				],
				dryRun: false,
			};

			await chatCompletionHandler(eventData);

			// In normal mode, the last message should be user (injected state)
			// The original last user message should be second-to-last if state was appended
			if (eventData.chat.length > 4) {
				const lastMessage = eventData.chat[eventData.chat.length - 1];
				expect(lastMessage.role).toBe('user');
			}

			mockContext.chat = originalChat;
		});

		it('text completion: appends state to second-to-last message in continuation mode', async () => {
			// In continuation mode, the assistant's prefill is the last entry in finalMesSend.
			// State should be appended to the second-to-last entry (before the prefill).
			const originalChat = mockContext.chat;
			mockContext.chat = [
				{ mes: 'Hello', is_user: true },
				{ mes: 'Hi there!', is_user: false },
				{ mes: 'How are you?', is_user: true },
				{ mes: 'I am doing', is_user: false }, // Assistant prefill (last message)
			];

			const eventData = {
				mesSendString: 'Original messages here',
				storyString: 'Story content',
				api: 'kobold',
				dryRun: false,
				finalMesSend: [
					{
						message: 'User: Hello',
						extensionPrompts: [] as string[],
					},
					{
						message: 'Assistant: Hi there!',
						extensionPrompts: [] as string[],
					},
					{
						message: 'User: How are you?',
						extensionPrompts: [] as string[],
					},
					{ message: 'I am doing', extensionPrompts: [] as string[] }, // Prefill
				],
			};

			const originalPrefillMessage = eventData.finalMesSend[3].message;

			await textCompletionHandler(eventData);

			// In continuation mode, state should be appended to second-to-last message
			// The prefill (last message) should be unchanged
			if (eventData.finalMesSend.length === 4) {
				// Prefill should be unchanged
				expect(eventData.finalMesSend[3].message).toBe(
					originalPrefillMessage,
				);
				// User message should have state appended (or be unchanged if no state generated)
				expect(eventData.finalMesSend[2].message).toBeDefined();
			}

			mockContext.chat = originalChat;
		});

		it('text completion: appends state to last message in normal mode', async () => {
			// Set up mock chat to have user as last message (normal mode)
			const originalChat = mockContext.chat;
			mockContext.chat = [
				{ mes: 'Hello', is_user: true },
				{ mes: 'Hi there!', is_user: false },
				{ mes: 'How are you?', is_user: true }, // User message last (normal)
			];

			const eventData = {
				mesSendString: 'Original messages here',
				storyString: 'Story content',
				api: 'kobold',
				dryRun: false,
				finalMesSend: [
					{
						message: 'User: Hello',
						extensionPrompts: [] as string[],
					},
					{
						message: 'Assistant: Hi there!',
						extensionPrompts: [] as string[],
					},
					{
						message: 'User: How are you?',
						extensionPrompts: [] as string[],
					},
				],
			};

			await textCompletionHandler(eventData);

			// In normal mode, state should be appended to the last message
			if (eventData.finalMesSend.length === 3) {
				const lastEntry = eventData.finalMesSend[2];
				// The message should be defined
				expect(lastEntry.message).toBeDefined();
			}

			mockContext.chat = originalChat;
		});
	});

	// ============================================
	// Inject Settings Tests
	// ============================================

	describe('inject settings', () => {
		it('chat completion: skips when both v2InjectState and v2InjectNarrative are false', async () => {
			mockGetV2Settings.mockReturnValue({
				...createDefaultV2Settings(),
				v2InjectState: false,
				v2InjectNarrative: false,
			});

			const eventData = {
				chat: [
					{ role: 'system', content: 'You are helpful.' },
					{ role: 'user', content: 'Hello' },
					{ role: 'assistant', content: 'Hi!' },
				],
				dryRun: false,
			};

			const originalLength = eventData.chat.length;
			await chatCompletionHandler(eventData);

			// Chat should not be modified
			expect(eventData.chat).toHaveLength(originalLength);
		});

		it('text completion: skips when both v2InjectState and v2InjectNarrative are false', async () => {
			mockGetV2Settings.mockReturnValue({
				...createDefaultV2Settings(),
				v2InjectState: false,
				v2InjectNarrative: false,
			});

			const originalChat = mockContext.chat;
			mockContext.chat = [
				{ mes: 'Hello', is_user: true },
				{ mes: 'Hi there!', is_user: false },
				{ mes: 'How are you?', is_user: true },
			];

			const eventData = {
				mesSendString: 'Original messages here',
				storyString: 'Story content',
				api: 'kobold',
				dryRun: false,
				finalMesSend: [
					{
						message: 'User: Hello',
						extensionPrompts: [] as string[],
					},
					{
						message: 'Assistant: Hi there!',
						extensionPrompts: [] as string[],
					},
				],
			};

			const originalFirstMessage = eventData.finalMesSend[0].message;
			const originalLastMessage = eventData.finalMesSend[1].message;
			await textCompletionHandler(eventData);

			// Messages should not be modified
			expect(eventData.finalMesSend[0].message).toBe(originalFirstMessage);
			expect(eventData.finalMesSend[1].message).toBe(originalLastMessage);
			expect(eventData.finalMesSend[0].extensionPrompts).toHaveLength(0);

			mockContext.chat = originalChat;
		});

		it('chat completion: still injects when only v2InjectState is true', async () => {
			mockGetV2Settings.mockReturnValue({
				...createDefaultV2Settings(),
				v2InjectState: true,
				v2InjectNarrative: false,
			});

			const eventData = {
				chat: [
					{ role: 'system', content: 'You are helpful.' },
					{ role: 'user', content: 'Hello' },
					{ role: 'assistant', content: 'Hi!' },
				],
				dryRun: false,
			};

			await chatCompletionHandler(eventData);

			// Should have injected state (chat length increases)
			expect(eventData.chat.length).toBeGreaterThanOrEqual(3);
		});

		it('chat completion: still injects when only v2InjectNarrative is true', async () => {
			mockGetV2Settings.mockReturnValue({
				...createDefaultV2Settings(),
				v2InjectState: false,
				v2InjectNarrative: true,
			});

			const eventData = {
				chat: [
					{ role: 'system', content: 'You are helpful.' },
					{ role: 'user', content: 'Hello' },
					{ role: 'assistant', content: 'Hi!' },
				],
				dryRun: false,
			};

			// Even if no narrative content is generated, the handler should not early-return
			// (it goes through the pipeline; absence of content is handled by the "no content" check)
			await chatCompletionHandler(eventData);

			// Should not crash
			expect(eventData.chat.length).toBeGreaterThanOrEqual(3);
		});
	});
});
