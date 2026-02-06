import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setDebugEnabled, isDebugEnabled, debugLog, debugWarn, errorLog } from './debug';

describe('debug utilities', () => {
	beforeEach(() => {
		setDebugEnabled(false);
	});

	describe('setDebugEnabled / isDebugEnabled', () => {
		it('defaults to disabled', () => {
			expect(isDebugEnabled()).toBe(false);
		});

		it('can be enabled', () => {
			setDebugEnabled(true);
			expect(isDebugEnabled()).toBe(true);
		});

		it('can be disabled again', () => {
			setDebugEnabled(true);
			setDebugEnabled(false);
			expect(isDebugEnabled()).toBe(false);
		});
	});

	describe('debugLog', () => {
		it('logs when debug is enabled', () => {
			const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
			setDebugEnabled(true);
			debugLog('test message');
			expect(spy).toHaveBeenCalledWith('[BlazeTracker]', 'test message');
			spy.mockRestore();
		});

		it('does not log when debug is disabled', () => {
			const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
			debugLog('test message');
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
		});
	});

	describe('debugWarn', () => {
		it('warns when debug is enabled', () => {
			const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			setDebugEnabled(true);
			debugWarn('warning message');
			expect(spy).toHaveBeenCalledWith('[BlazeTracker]', 'warning message');
			spy.mockRestore();
		});

		it('does not warn when debug is disabled', () => {
			const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			debugWarn('warning message');
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
		});
	});

	describe('errorLog', () => {
		it('always logs errors regardless of debug setting', () => {
			const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
			setDebugEnabled(false);
			errorLog('error message');
			expect(spy).toHaveBeenCalledWith('[BlazeTracker]', 'error message');
			spy.mockRestore();
		});
	});
});
