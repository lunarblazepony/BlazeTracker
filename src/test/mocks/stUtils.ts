// Mock for sillytavern-utils-lib
export const st_echo = () => {};
export const generateContent = async () => '';

// Mock ExtensionSettingsManager
export class ExtensionSettingsManager<T> {
	private settings: T;

	constructor(key: string, defaults: T) {
		this.settings = { ...defaults };
	}

	getSettings(): T {
		return this.settings;
	}

	setSettings(updates: Partial<T>): void {
		this.settings = { ...this.settings, ...updates };
	}

	renderSettingsHtml(_onUpdate: () => void): string {
		return '';
	}
}

// Mock Generator
export class Generator {
	async generate(_options: Record<string, unknown>): Promise<string> {
		return '';
	}

	async generateWithAbort(
		_options: Record<string, unknown>,
		_signal?: AbortSignal,
	): Promise<string> {
		return '';
	}
}
