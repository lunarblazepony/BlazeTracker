import { describe, it, expect } from 'vitest';
import {
	calculateIndoorTemp,
	inferBuildingType,
	isIndoors,
	calculateEffectiveTemperature,
} from './indoorTemperature';
import type { LocationState } from '../types/state';

// ============================================
// Test Helpers
// ============================================

function makeLocation(overrides: Partial<LocationState> = {}): LocationState {
	return {
		area: '',
		place: '',
		position: '',
		props: [],
		...overrides,
	};
}

// ============================================
// calculateIndoorTemp
// ============================================

describe('calculateIndoorTemp', () => {
	describe('modern buildings (HVAC)', () => {
		it('maintains ~70°F in normal conditions', () => {
			const temp = calculateIndoorTemp({
				outdoorTemp: 85,
				buildingType: 'modern',
				hour: 12,
			});
			expect(temp).toBe(70);
		});

		it('slightly warmer when AC struggles in extreme heat', () => {
			const temp = calculateIndoorTemp({
				outdoorTemp: 105,
				buildingType: 'modern',
				hour: 14,
			});
			expect(temp).toBeGreaterThan(75);
		});

		it('slightly cooler in extreme cold', () => {
			const temp = calculateIndoorTemp({
				outdoorTemp: 0,
				buildingType: 'modern',
				hour: 12,
			});
			expect(temp).toBeLessThan(65);
		});
	});

	describe('heated buildings (fireplace)', () => {
		it('aims for ~65°F during active hours', () => {
			const temp = calculateIndoorTemp({
				outdoorTemp: 30,
				buildingType: 'heated',
				hour: 12,
			});
			// Target 65 with 30% outdoor influence
			expect(temp).toBeGreaterThan(50);
			expect(temp).toBeLessThan(70);
		});

		it('cooler at night when fire dies down', () => {
			const dayTemp = calculateIndoorTemp({
				outdoorTemp: 30,
				buildingType: 'heated',
				hour: 14,
			});
			const nightTemp = calculateIndoorTemp({
				outdoorTemp: 30,
				buildingType: 'heated',
				hour: 3,
			});
			expect(nightTemp).toBeLessThan(dayTemp);
		});
	});

	describe('unheated buildings', () => {
		it('provides minimal shelter - warmer than outdoor in cold', () => {
			const temp = calculateIndoorTemp({
				outdoorTemp: 20,
				buildingType: 'unheated',
				hour: 12,
			});
			expect(temp).toBeGreaterThan(20);
		});

		it('provides slight cooling in extreme heat', () => {
			const temp = calculateIndoorTemp({
				outdoorTemp: 95,
				buildingType: 'unheated',
				hour: 14,
			});
			expect(temp).toBeLessThan(95);
		});
	});

	describe('underground (caves, basements)', () => {
		it('maintains stable ~55°F regardless of outdoor', () => {
			const hotDay = calculateIndoorTemp({
				outdoorTemp: 100,
				buildingType: 'underground',
				hour: 14,
			});
			const coldDay = calculateIndoorTemp({
				outdoorTemp: -10,
				buildingType: 'underground',
				hour: 14,
			});

			expect(hotDay).toBe(55);
			expect(coldDay).toBe(55);
		});
	});

	describe('tent', () => {
		it('provides minimal shelter with greenhouse effect during day', () => {
			const dayTemp = calculateIndoorTemp({
				outdoorTemp: 70,
				buildingType: 'tent',
				hour: 12,
			});
			expect(dayTemp).toBeGreaterThan(70);
		});

		it('less greenhouse effect at night', () => {
			const nightTemp = calculateIndoorTemp({
				outdoorTemp: 70,
				buildingType: 'tent',
				hour: 2,
			});
			// Only +2 at night vs +9 during day
			expect(nightTemp).toBe(72);
		});
	});

	describe('vehicle', () => {
		it('greenhouse effect during sunny hours', () => {
			const dayTemp = calculateIndoorTemp({
				outdoorTemp: 80,
				buildingType: 'vehicle',
				hour: 14,
			});
			expect(dayTemp).toBe(95); // +15
		});

		it('moderate shelter at night', () => {
			const nightTemp = calculateIndoorTemp({
				outdoorTemp: 50,
				buildingType: 'vehicle',
				hour: 22,
			});
			expect(nightTemp).toBe(54); // +4
		});
	});
});

// ============================================
// inferBuildingType
// ============================================

describe('inferBuildingType', () => {
	it('detects underground locations', () => {
		expect(inferBuildingType(makeLocation({ place: 'Ancient Cave' }))).toBe(
			'underground',
		);
		expect(inferBuildingType(makeLocation({ area: 'Basement level' }))).toBe(
			'underground',
		);
		expect(inferBuildingType(makeLocation({ position: 'In the mine shaft' }))).toBe(
			'underground',
		);
		expect(inferBuildingType(makeLocation({ place: 'The sewer tunnel' }))).toBe(
			'underground',
		);
	});

	it('detects tents', () => {
		expect(inferBuildingType(makeLocation({ place: 'Camping tent' }))).toBe('tent');
		expect(inferBuildingType(makeLocation({ area: 'Campsite' }))).toBe('tent');
		expect(inferBuildingType(makeLocation({ place: 'A small yurt' }))).toBe('tent');
	});

	it('detects vehicles', () => {
		expect(inferBuildingType(makeLocation({ place: 'In the car' }))).toBe('vehicle');
		expect(inferBuildingType(makeLocation({ place: 'Train compartment' }))).toBe(
			'vehicle',
		);
		expect(inferBuildingType(makeLocation({ position: 'On the ship deck' }))).toBe(
			'vehicle',
		);
		expect(inferBuildingType(makeLocation({ place: 'Spaceship bridge' }))).toBe(
			'vehicle',
		);
	});

	it('detects unheated buildings', () => {
		expect(inferBuildingType(makeLocation({ place: 'Old barn' }))).toBe('unheated');
		expect(inferBuildingType(makeLocation({ place: 'Warehouse' }))).toBe('unheated');
		expect(inferBuildingType(makeLocation({ place: 'Storage shed' }))).toBe('unheated');
		expect(inferBuildingType(makeLocation({ place: 'The stable' }))).toBe('unheated');
	});

	it('detects modern buildings', () => {
		expect(inferBuildingType(makeLocation({ place: 'Office building' }))).toBe(
			'modern',
		);
		expect(inferBuildingType(makeLocation({ place: 'Hotel room' }))).toBe('modern');
		expect(inferBuildingType(makeLocation({ place: 'Hospital ward' }))).toBe('modern');
		expect(inferBuildingType(makeLocation({ place: 'Shopping mall' }))).toBe('modern');
	});

	it('detects heated buildings', () => {
		expect(inferBuildingType(makeLocation({ place: 'Cozy cabin' }))).toBe('heated');
		expect(inferBuildingType(makeLocation({ place: 'The tavern' }))).toBe('heated');
		expect(inferBuildingType(makeLocation({ place: 'Castle hall' }))).toBe('heated');
		expect(inferBuildingType(makeLocation({ place: 'Temple of Light' }))).toBe(
			'heated',
		);
	});

	it('returns null for unknown/outdoor locations', () => {
		expect(inferBuildingType(makeLocation({ place: 'The forest' }))).toBeNull();
		expect(inferBuildingType(makeLocation({ area: 'Mountain peak' }))).toBeNull();
		expect(inferBuildingType(makeLocation())).toBeNull();
	});

	it('is case insensitive', () => {
		expect(inferBuildingType(makeLocation({ place: 'CAVE' }))).toBe('underground');
		expect(inferBuildingType(makeLocation({ place: 'Hotel' }))).toBe('modern');
	});
});

// ============================================
// isIndoors
// ============================================

describe('isIndoors', () => {
	describe('explicit outdoor indicators', () => {
		it('detects outdoor positions', () => {
			expect(isIndoors(makeLocation({ position: 'Outside in the garden' }))).toBe(
				false,
			);
			expect(isIndoors(makeLocation({ position: 'On the street' }))).toBe(false);
			expect(isIndoors(makeLocation({ position: 'On the beach' }))).toBe(false);
		});

		it('detects outdoor places', () => {
			expect(isIndoors(makeLocation({ place: 'City park' }))).toBe(false);
			expect(isIndoors(makeLocation({ place: 'Forest clearing' }))).toBe(false);
			expect(isIndoors(makeLocation({ place: 'Mountain trail' }))).toBe(false);
		});

		it('detects outdoor areas', () => {
			expect(isIndoors(makeLocation({ area: 'The desert' }))).toBe(false);
			expect(isIndoors(makeLocation({ area: 'Coastal shore' }))).toBe(false);
		});
	});

	describe('explicit indoor indicators', () => {
		it('detects indoor positions', () => {
			expect(isIndoors(makeLocation({ position: 'Inside the room' }))).toBe(true);
			expect(isIndoors(makeLocation({ position: 'In the corridor' }))).toBe(true);
		});

		it('detects indoor places', () => {
			expect(isIndoors(makeLocation({ place: 'Bedroom' }))).toBe(true);
			expect(isIndoors(makeLocation({ place: 'Kitchen' }))).toBe(true);
			expect(isIndoors(makeLocation({ place: 'Office lobby' }))).toBe(true);
		});
	});

	describe('building type inference', () => {
		it('assumes indoor for building types except tent', () => {
			expect(isIndoors(makeLocation({ place: 'Cave entrance' }))).toBe(true);
			expect(isIndoors(makeLocation({ place: 'Barn' }))).toBe(true);
			expect(isIndoors(makeLocation({ place: 'Hotel' }))).toBe(true);
		});

		it('tent is treated as outdoor', () => {
			expect(isIndoors(makeLocation({ place: 'Camping tent' }))).toBe(false);
		});
	});

	describe('defaults', () => {
		it('defaults to outdoor when uncertain', () => {
			expect(isIndoors(makeLocation())).toBe(false);
			expect(isIndoors(makeLocation({ area: 'Unknown location' }))).toBe(false);
		});
	});

	describe('priority', () => {
		it('position takes priority over place', () => {
			// Position says outdoor, but place could be indoor
			expect(
				isIndoors(
					makeLocation({
						place: 'Hotel',
						position: 'Outside the entrance',
					}),
				),
			).toBe(false);
		});

		it('place takes priority over area', () => {
			// Area is outdoor nature, but place is specific indoor
			expect(
				isIndoors(makeLocation({ area: 'Forest', place: 'Cabin bedroom' })),
			).toBe(true);
		});
	});
});

// ============================================
// calculateEffectiveTemperature
// ============================================

describe('calculateEffectiveTemperature', () => {
	it('returns outdoor temp for outdoor locations', () => {
		const result = calculateEffectiveTemperature(
			75,
			makeLocation({ place: 'City park' }),
			12,
		);

		expect(result.isIndoors).toBe(false);
		expect(result.effectiveTemperature).toBe(75);
		expect(result.buildingType).toBeUndefined();
	});

	it('calculates indoor temp for indoor locations', () => {
		const result = calculateEffectiveTemperature(
			30,
			makeLocation({ place: 'Cozy cabin' }),
			12,
		);

		expect(result.isIndoors).toBe(true);
		expect(result.buildingType).toBe('heated');
		expect(result.effectiveTemperature).toBeGreaterThan(30);
	});

	it('returns indoor temp details', () => {
		const result = calculateEffectiveTemperature(
			100,
			makeLocation({ place: 'Underground cave' }),
			14,
		);

		expect(result.isIndoors).toBe(true);
		expect(result.buildingType).toBe('underground');
		expect(result.indoorTemperature).toBe(55);
		expect(result.effectiveTemperature).toBe(55);
	});

	it('uses heated as default for unknown indoor buildings', () => {
		const result = calculateEffectiveTemperature(
			30,
			makeLocation({ position: 'Inside the chamber' }),
			12,
		);

		expect(result.isIndoors).toBe(true);
		expect(result.buildingType).toBe('heated');
	});

	it('passes hour correctly for time-dependent calculations', () => {
		// Use vehicle which has time-dependent greenhouse effect
		const dayResult = calculateEffectiveTemperature(
			70,
			makeLocation({ place: 'In the car' }),
			14,
		);
		const nightResult = calculateEffectiveTemperature(
			70,
			makeLocation({ place: 'In the car' }),
			2,
		);

		// Vehicle has greenhouse effect during day (+15) vs night (+4)
		expect(dayResult.effectiveTemperature).toBeGreaterThan(
			nightResult.effectiveTemperature,
		);
	});
});
