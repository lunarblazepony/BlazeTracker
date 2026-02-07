import { test, expect } from '@playwright/experimental-ct-react';
import { V2ProjectionPreview } from './V2ProjectionPreview';
import { createEmptyCharacterState } from '../types/snapshot';
import type { Projection } from '../types/snapshot';
import type { SwipeContext } from '../store/projection';
import moment from 'moment';

// ============================================
// Test Fixtures
// ============================================

function createSwipeContext(): SwipeContext {
	return {
		getCanonicalSwipeId: () => 0,
	};
}

function createProjectionWithAkas(): Projection {
	const elena = createEmptyCharacterState('Elena');
	elena.position = 'standing';
	elena.mood = ['curious'];
	elena.akas = ['Lena', 'sunshine'];

	const marcus = createEmptyCharacterState('Marcus');
	marcus.position = 'sitting';
	marcus.mood = ['calm'];
	marcus.akas = [];

	return {
		source: { messageId: 5, swipeId: 0 },
		time: moment('2024-11-14T15:00:00'),
		location: {
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'at a table',
			props: [],
			locationType: 'heated',
		},
		forecasts: {},
		climate: null,
		scene: {
			topic: 'meeting',
			tone: 'casual',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		characters: { Elena: elena, Marcus: marcus },
		relationships: {},
		currentChapter: 0,
		charactersPresent: ['Elena', 'Marcus'],
		narrativeEvents: [],
	};
}

function createProjectionWithoutAkas(): Projection {
	const elena = createEmptyCharacterState('Elena');
	elena.position = 'standing';
	elena.mood = ['curious'];
	elena.akas = [];

	return {
		source: { messageId: 5, swipeId: 0 },
		time: moment('2024-11-14T15:00:00'),
		location: null,
		forecasts: {},
		climate: null,
		scene: null,
		characters: { Elena: elena },
		relationships: {},
		currentChapter: 0,
		charactersPresent: ['Elena'],
		narrativeEvents: [],
	};
}

// ============================================
// AKAs Display in CharacterStateCard
// ============================================

test.describe('CharacterStateCard AKAs', () => {
	test('shows AKAs in character header when present', async ({ mount }) => {
		const projection = createProjectionWithAkas();

		const component = await mount(
			<V2ProjectionPreview
				projection={projection}
				swipeContext={createSwipeContext()}
			/>,
		);

		const akasSpan = component.locator('.bt-projected-char-akas').first();
		await expect(akasSpan).toBeVisible();
		await expect(akasSpan).toContainText('Lena');
		await expect(akasSpan).toContainText('sunshine');
	});

	test('AKAs span has title attribute', async ({ mount }) => {
		const projection = createProjectionWithAkas();

		const component = await mount(
			<V2ProjectionPreview
				projection={projection}
				swipeContext={createSwipeContext()}
			/>,
		);

		const akasSpan = component.locator('.bt-projected-char-akas').first();
		await expect(akasSpan).toHaveAttribute('title', 'AKAs: Lena, sunshine');
	});

	test('hides AKAs when array is empty', async ({ mount }) => {
		const projection = createProjectionWithoutAkas();

		const component = await mount(
			<V2ProjectionPreview
				projection={projection}
				swipeContext={createSwipeContext()}
			/>,
		);

		await expect(component.locator('.bt-projected-char-akas')).not.toBeVisible();
	});

	test('only shows AKAs for characters that have them', async ({ mount }) => {
		const projection = createProjectionWithAkas();

		const component = await mount(
			<V2ProjectionPreview
				projection={projection}
				swipeContext={createSwipeContext()}
			/>,
		);

		// Elena has AKAs, Marcus does not
		const akasSpans = component.locator('.bt-projected-char-akas');
		await expect(akasSpans).toHaveCount(1);
	});
});
