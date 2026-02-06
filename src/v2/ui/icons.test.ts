import { describe, it, expect } from 'vitest';
import {
	getTensionIcon,
	getTensionLevelIcon,
	getTensionTypeColor,
	getTensionColor,
	getConditionIconDayNight,
	TENSION_TYPE_ICONS,
	TENSION_LEVEL_ICONS,
	TENSION_TYPE_COLORS,
	TENSION_LEVEL_COLORS,
} from './icons';
import type { TensionLevel, TensionType } from '../types/common';

describe('getTensionIcon', () => {
	it('returns correct icon for each tension type', () => {
		const types: TensionType[] = [
			'conversation',
			'confrontation',
			'intimate',
			'suspense',
			'vulnerable',
			'celebratory',
			'negotiation',
		];
		for (const type of types) {
			expect(getTensionIcon(type)).toBe(`fa-solid ${TENSION_TYPE_ICONS[type]}`);
		}
	});
});

describe('getTensionLevelIcon', () => {
	it('returns correct icon for each tension level', () => {
		const levels: TensionLevel[] = [
			'relaxed',
			'aware',
			'guarded',
			'tense',
			'charged',
			'volatile',
			'explosive',
		];
		for (const level of levels) {
			expect(getTensionLevelIcon(level)).toBe(
				`fa-solid ${TENSION_LEVEL_ICONS[level]}`,
			);
		}
	});
});

describe('getTensionTypeColor', () => {
	it('returns correct color for each tension type', () => {
		const types: TensionType[] = [
			'conversation',
			'confrontation',
			'intimate',
			'suspense',
			'vulnerable',
			'celebratory',
			'negotiation',
		];
		for (const type of types) {
			expect(getTensionTypeColor(type)).toBe(TENSION_TYPE_COLORS[type]);
		}
	});
});

describe('getTensionColor', () => {
	it('returns correct color for each tension level', () => {
		const levels: TensionLevel[] = [
			'relaxed',
			'aware',
			'guarded',
			'tense',
			'charged',
			'volatile',
			'explosive',
		];
		for (const level of levels) {
			expect(getTensionColor(level)).toBe(TENSION_LEVEL_COLORS[level]);
		}
	});
});

describe('getConditionIconDayNight', () => {
	it('returns day icon for daytime', () => {
		expect(getConditionIconDayNight('sunny', false)).toBe('fa-sun');
		expect(getConditionIconDayNight('rain', false)).toBe('fa-cloud-showers-heavy');
	});

	it('returns night icon for nighttime', () => {
		expect(getConditionIconDayNight('clear', true)).toBe('fa-moon');
		expect(getConditionIconDayNight('drizzle', true)).toBe('fa-cloud-moon-rain');
	});
});
