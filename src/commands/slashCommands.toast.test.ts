// ============================================
// Toast Progress Notification & Extract-Remaining Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock st_echo as a spy
vi.mock('sillytavern-utils-lib/config', () => ({
	st_echo: vi.fn(),
	ExtensionSettingsManager: vi.fn().mockImplementation((_key: string, defaults: unknown) => ({
		getSettings: () => defaults,
		setSettings: () => {},
		renderSettingsHtml: () => '',
	})),
}));

// Capture the options passed to runV2ExtractionAll so we can invoke callbacks
import type { V2ExtractionOptions } from '../v2Bridge';

let capturedOptions: V2ExtractionOptions = {};
let capturedStartId: number = 0;

// Default mock store - can be overridden per test
let mockStore = {
	getMessageIdsWithEvents: () => [] as number[],
	getActiveEvents: () => [] as { source: { messageId: number; swipeId: number } }[],
	snapshots: [] as {
		type: string;
		source: { messageId: number; swipeId: number };
		swipeId: number;
	}[],
	initialSnapshotMessageId: -1,
};

let mockHasInitialSnapshot = false;

vi.mock('../v2Bridge', () => ({
	runV2ExtractionAll: vi.fn(
		async (
			startId: number,
			options: V2ExtractionOptions,
		): Promise<{ extracted: number; failed: number }> => {
			capturedStartId = startId;
			capturedOptions = options || {};
			return { extracted: 0, failed: 0 };
		},
	),
	runV2Extraction: vi.fn(),
	clearV2EventStore: vi.fn().mockResolvedValue(undefined),
	getV2EventStore: vi.fn(() => mockStore),
	hasV2InitialSnapshot: vi.fn(() => mockHasInitialSnapshot),
	getExtractionAbortController: vi.fn().mockReturnValue({
		signal: { aborted: false },
	}),
	resetAbortController: vi.fn(),
	getV2EventStoreForEditor: vi.fn(),
	buildSwipeContext: vi.fn(() => ({
		getCanonicalSwipeId: (messageId: number) => {
			// Default: canonical swipe is always 0
			const context = (globalThis as any).SillyTavern.getContext();
			return context.chat[messageId]?.swipe_id ?? 0;
		},
	})),
	abortExtraction: vi.fn(),
}));

vi.mock('../v2/ui/mountV2Display', () => ({
	unmountAllV2ProjectionDisplays: vi.fn(),
	mountV2ProjectionDisplay: vi.fn(),
	setV2ExtractionInProgress: vi.fn(),
	updateV2ExtractionProgress: vi.fn(),
}));

vi.mock('./eventStoreModal', () => ({
	openEventStoreModal: vi.fn(),
}));

vi.mock('../v2/settings', () => ({
	getV2Settings: vi.fn().mockReturnValue({ v2AutoExtract: false }),
}));

vi.mock('../utils/debug', () => ({
	debugWarn: vi.fn(),
	debugLog: vi.fn(),
	errorLog: vi.fn(),
}));

import { st_echo } from 'sillytavern-utils-lib/config';
import { runV2ExtractionAll } from '../v2Bridge';

// Capture registered commands during registerSlashCommands
let registeredCommands: Record<
	string,
	(args: Record<string, unknown>, value: string) => Promise<string>
> = {};

function createMockChat(count: number): Record<string, unknown>[] {
	const chat: Record<string, unknown>[] = [];
	for (let i = 0; i < count; i++) {
		chat.push({
			is_user: i % 2 === 1,
			mes: `Message ${i}`,
			extra: {},
			swipe_id: 0,
		});
	}
	return chat;
}

beforeEach(() => {
	vi.clearAllMocks();
	capturedOptions = {};
	capturedStartId = 0;
	registeredCommands = {};
	mockHasInitialSnapshot = false;
	mockStore = {
		getMessageIdsWithEvents: () => [],
		getActiveEvents: () => [],
		snapshots: [],
		initialSnapshotMessageId: -1,
	};

	// Set up SillyTavern global with mock context including SlashCommandParser
	const globalAny = globalThis as Record<string, unknown>;
	const mockChat = createMockChat(4); // 4 messages: 0 (system), 1, 2, 3

	globalAny.SillyTavern = {
		getContext: () => ({
			chat: mockChat,
			characters: [],
			POPUP_TYPE: { CONFIRM: 1, TEXT: 0 },
			callGenericPopup: vi.fn().mockResolvedValue(true),
			saveChat: vi.fn().mockResolvedValue(undefined),
			eventSource: {
				on: vi.fn(),
				off: vi.fn(),
				emit: vi.fn(),
			},
			SlashCommandParser: {
				addCommandObject: vi.fn(
					(cmd: {
						name: string;
						callback: (
							args: Record<string, unknown>,
							value: string,
						) => Promise<string>;
					}) => {
						registeredCommands[cmd.name] = cmd.callback;
					},
				),
			},
			SlashCommand: {
				fromProps: (props: {
					name: string;
					callback: (
						args: Record<string, unknown>,
						value: string,
					) => Promise<string>;
				}) => props,
			},
			SlashCommandNamedArgument: {
				fromProps: (props: unknown) => props,
			},
			ARGUMENT_TYPE: { NUMBER: 'number', STRING: 'string' },
		}),
	};
});

// Dynamically import to get fresh module with mocks applied
async function getRegisterSlashCommands() {
	const mod = await import('./slashCommands');
	return mod.registerSlashCommands;
}

// ============================================
// Toast Notification Tests
// ============================================

describe('bt-extract-all toast notifications', () => {
	it('shows toast for each message during extraction', async () => {
		const registerSlashCommands = await getRegisterSlashCommands();
		registerSlashCommands();

		const extractAllCmd = registeredCommands['bt-extract-all'];
		expect(extractAllCmd).toBeDefined();

		// Mock runV2ExtractionAll to invoke onMessageStart for messages 1, 2, 3
		vi.mocked(runV2ExtractionAll).mockImplementation(async (_startId, options) => {
			capturedOptions = options || {};
			capturedOptions.onMessageStart?.(1);
			capturedOptions.onMessageStart?.(2);
			capturedOptions.onMessageStart?.(3);
			return { extracted: 3, failed: 0 };
		});

		await extractAllCmd({}, '');

		// totalMessages = 4, so last message index = 3
		expect(st_echo).toHaveBeenCalledWith('info', 'Extracting for message 1/3');
		expect(st_echo).toHaveBeenCalledWith('info', 'Extracting for message 2/3');
		expect(st_echo).toHaveBeenCalledWith('info', 'Extracting for message 3/3');
		expect(st_echo).toHaveBeenCalledTimes(3);
	});
});

describe('bt-extract-remaining toast notifications', () => {
	it('shows toast for each message during extraction', async () => {
		const registerSlashCommands = await getRegisterSlashCommands();
		registerSlashCommands();

		const extractRemainingCmd = registeredCommands['bt-extract-remaining'];
		expect(extractRemainingCmd).toBeDefined();

		// Mock runV2ExtractionAll to invoke onMessageStart for messages 2, 3
		vi.mocked(runV2ExtractionAll).mockImplementation(async (_startId, options) => {
			capturedOptions = options || {};
			capturedOptions.onMessageStart?.(2);
			capturedOptions.onMessageStart?.(3);
			return { extracted: 2, failed: 0 };
		});

		await extractRemainingCmd({}, '');

		// totalMessages = 4, so last message index = 3
		expect(st_echo).toHaveBeenCalledWith('info', 'Extracting for message 2/3');
		expect(st_echo).toHaveBeenCalledWith('info', 'Extracting for message 3/3');
		expect(st_echo).toHaveBeenCalledTimes(2);
	});
});

// ============================================
// Extract-Remaining Start Point Tests
// ============================================

describe('bt-extract-remaining start point', () => {
	it('starts from message 1 when no initial snapshot exists', async () => {
		const registerSlashCommands = await getRegisterSlashCommands();
		registerSlashCommands();

		const extractRemainingCmd = registeredCommands['bt-extract-remaining'];
		mockHasInitialSnapshot = false;

		vi.mocked(runV2ExtractionAll).mockImplementation(async (startId = 1, options) => {
			capturedStartId = startId;
			capturedOptions = options || {};
			return { extracted: 1, failed: 0 };
		});

		await extractRemainingCmd({}, '');

		expect(capturedStartId).toBe(1);
	});

	it('starts after initial snapshot when snapshot exists but no events', async () => {
		const registerSlashCommands = await getRegisterSlashCommands();
		registerSlashCommands();

		const extractRemainingCmd = registeredCommands['bt-extract-remaining'];
		mockHasInitialSnapshot = true;
		mockStore = {
			getMessageIdsWithEvents: () => [],
			getActiveEvents: () => [],
			snapshots: [
				{
					type: 'initial',
					source: { messageId: 1, swipeId: 0 },
					swipeId: 0,
				},
			],
			initialSnapshotMessageId: 1,
		};

		vi.mocked(runV2ExtractionAll).mockImplementation(async (startId = 1, options) => {
			capturedStartId = startId;
			capturedOptions = options || {};
			return { extracted: 1, failed: 0 };
		});

		await extractRemainingCmd({}, '');

		// Should start at 2 (after the snapshot at message 1), not 1
		expect(capturedStartId).toBe(2);
	});

	it('starts after last event when events exist beyond snapshot', async () => {
		const registerSlashCommands = await getRegisterSlashCommands();
		registerSlashCommands();

		const extractRemainingCmd = registeredCommands['bt-extract-remaining'];
		mockHasInitialSnapshot = true;
		mockStore = {
			getMessageIdsWithEvents: () => [2],
			getActiveEvents: () => [{ source: { messageId: 2, swipeId: 0 } }],
			snapshots: [
				{
					type: 'initial',
					source: { messageId: 1, swipeId: 0 },
					swipeId: 0,
				},
			],
			initialSnapshotMessageId: 1,
		};

		vi.mocked(runV2ExtractionAll).mockImplementation(async (startId = 1, options) => {
			capturedStartId = startId;
			capturedOptions = options || {};
			return { extracted: 1, failed: 0 };
		});

		await extractRemainingCmd({}, '');

		// Message 1 has snapshot, message 2 has events, so start at 3
		expect(capturedStartId).toBe(3);
	});

	it('skips non-canonical events when determining start point', async () => {
		const registerSlashCommands = await getRegisterSlashCommands();
		registerSlashCommands();

		// Set up chat where message 2 has swipe_id=1 (non-canonical events at swipe 0)
		const globalAny = globalThis as Record<string, unknown>;
		const mockChat = createMockChat(4);
		mockChat[2].swipe_id = 1; // Current swipe is 1

		globalAny.SillyTavern = {
			getContext: () => ({
				chat: mockChat,
				characters: [],
				POPUP_TYPE: { CONFIRM: 1, TEXT: 0 },
				callGenericPopup: vi.fn().mockResolvedValue(true),
				saveChat: vi.fn().mockResolvedValue(undefined),
				eventSource: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
				SlashCommandParser: {
					addCommandObject: vi.fn(
						(cmd: {
							name: string;
							callback: (
								args: Record<string, unknown>,
								value: string,
							) => Promise<string>;
						}) => {
							registeredCommands[cmd.name] = cmd.callback;
						},
					),
				},
				SlashCommand: {
					fromProps: (props: {
						name: string;
						callback: (
							args: Record<string, unknown>,
							value: string,
						) => Promise<string>;
					}) => props,
				},
				SlashCommandNamedArgument: { fromProps: (props: unknown) => props },
				ARGUMENT_TYPE: { NUMBER: 'number', STRING: 'string' },
			}),
		};

		// Re-register commands with new context
		registerSlashCommands();

		const extractRemainingCmd = registeredCommands['bt-extract-remaining'];
		mockHasInitialSnapshot = true;
		mockStore = {
			getMessageIdsWithEvents: () => [2],
			// Event at message 2 swipe 0, but canonical swipe for message 2 is 1
			getActiveEvents: () => [{ source: { messageId: 2, swipeId: 0 } }],
			snapshots: [
				{
					type: 'initial',
					source: { messageId: 1, swipeId: 0 },
					swipeId: 0,
				},
			],
			initialSnapshotMessageId: 1,
		};

		vi.mocked(runV2ExtractionAll).mockImplementation(async (startId = 1, options) => {
			capturedStartId = startId;
			capturedOptions = options || {};
			return { extracted: 1, failed: 0 };
		});

		await extractRemainingCmd({}, '');

		// Message 1 has snapshot, message 2 has events on swipe 0 but canonical is swipe 1
		// So message 2 is uncovered — start at 2
		expect(capturedStartId).toBe(2);
	});

	it('reports already caught up when all messages are covered', async () => {
		const registerSlashCommands = await getRegisterSlashCommands();
		registerSlashCommands();

		const extractRemainingCmd = registeredCommands['bt-extract-remaining'];
		mockHasInitialSnapshot = true;
		mockStore = {
			getMessageIdsWithEvents: () => [2, 3],
			getActiveEvents: () => [
				{ source: { messageId: 2, swipeId: 0 } },
				{ source: { messageId: 3, swipeId: 0 } },
			],
			snapshots: [
				{
					type: 'initial',
					source: { messageId: 1, swipeId: 0 },
					swipeId: 0,
				},
			],
			initialSnapshotMessageId: 1,
		};

		const result = await extractRemainingCmd({}, '');

		expect(result).toBe('Already caught up! All messages have been extracted.');
	});

	it('accounts for chapter snapshots when determining start point', async () => {
		const registerSlashCommands = await getRegisterSlashCommands();
		registerSlashCommands();

		const extractRemainingCmd = registeredCommands['bt-extract-remaining'];
		mockHasInitialSnapshot = true;
		mockStore = {
			getMessageIdsWithEvents: () => [2],
			getActiveEvents: () => [{ source: { messageId: 2, swipeId: 0 } }],
			snapshots: [
				{
					type: 'initial',
					source: { messageId: 1, swipeId: 0 },
					swipeId: 0,
				},
				// Chapter snapshot at message 3
				{
					type: 'chapter',
					source: { messageId: 3, swipeId: 0 },
					swipeId: 0,
				},
			],
			initialSnapshotMessageId: 1,
		};

		vi.mocked(runV2ExtractionAll).mockImplementation(async (startId = 1, options) => {
			capturedStartId = startId;
			capturedOptions = options || {};
			return { extracted: 0, failed: 0 };
		});

		const result = await extractRemainingCmd({}, '');

		// Messages 1 (initial snapshot), 2 (events), 3 (chapter snapshot) all covered
		// All messages covered -> already caught up
		expect(result).toBe('Already caught up! All messages have been extracted.');
	});
});
