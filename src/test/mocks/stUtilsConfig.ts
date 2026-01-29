// Mock for sillytavern-utils-lib/config
export const st_echo = () => {};

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
