// SillyTavern global types
// Based on observed patterns from wTracker and ST documentation

declare global {
	const SillyTavern: {
		getContext(): STContext;
	};
}

export interface STContext {
	// Event system
	eventSource: EventEmitter;
	event_types: EventTypes;

	// Chat state
	chat: ChatMessage[];
	chatMetadata: Record<string, unknown>;
	characters: Character[];
	characterId: number;

	// Current character
	name1: string; // User name
	name2: string; // Character name

	powerUserSettings?: {
		persona_description?: string;
	};

	// Generation
	generateQuietPrompt(options: GenerateOptions): Promise<string>;
	generateRaw(options: GenerateRawOptions): Promise<string>;

	deactivateSendButtons: () => void;
	activateSendButtons: () => void;
	stopGeneration: () => void;

	setExtensionPrompt: (
		key: string,
		value: string,
		position: number,
		depth: number,
		scan?: boolean,
		role?: string,
	) => void;

	// Persistence
	saveChat(): Promise<void>;
	saveMetadataDebounced(): void;

	// Extension settings
	extensionSettings: Record<string, unknown>;
	saveSettingsDebounced(): void;

	// Utilities
	Popup: {
		show: {
			confirm(title: string, message: string): Promise<boolean>;
		};
	};

	callGenericPopup: (
		content: string | HTMLElement,
		type: number,
		inputValue?: string | null,
		options?: {
			okButton?: string;
			cancelButton?: string;
			wide?: boolean;
			large?: boolean;
			rows?: number;
		},
	) => Promise<number>;

	POPUP_TYPE: {
		TEXT: number;
		CONFIRM: number;
		INPUT: number;
	};

	POPUP_RESULT: {
		AFFIRMATIVE: number;
		NEGATIVE: number;
		CANCELLED: number;
	};

	// Streaming processor
	streamingProcessor: {
		isStopped: boolean;
		isFinished: boolean;
	};
}

export interface EventEmitter {
	on(event: string, callback: (...args: unknown[]) => void): void;
	off(event: string, callback: (...args: unknown[]) => void): void;
	emit(event: string, ...args: unknown[]): void;
}

export interface EventTypes {
	MESSAGE_RECEIVED: string;
	MESSAGE_SENT: string;
	MESSAGE_SWIPED: string;
	MESSAGE_DELETED: string;
	MESSAGE_SWIPE_DELETED: string;
	MESSAGE_EDITED: string;
	CHAT_CHANGED: string;
	CHARACTER_MESSAGE_RENDERED: string;
	USER_MESSAGE_RENDERED: string;
	GENERATION_STARTED: string;
	GENERATION_ENDED: string;
	GENERATION_STOPPED: string;
	SWIPE_CHANGED: string;
	CHARACTER_EDITED: string;
}

export interface ChatMessage {
	name: string;
	is_user: boolean;
	mes: string;
	send_date: string;
	swipe_id: number;
	extra?: {
		[key: string]: unknown;
	};
}

export interface Character {
	name: string;
	avatar: string;
	description: string;
	personality: string;
	scenario: string;
	first_mes: string;
	mes_example: string;
}

export interface GenerateOptions {
	quietPrompt?: string;
	skipWIAN?: boolean;
	force_name2?: boolean;
	maxTokens?: number;
	schema?: object;
}

export interface GenerateRawOptions {
	prompt: string;
	systemPrompt?: string;
	prefill?: string;
	maxTokens?: number;
	schema?: object;
}

export {};
