import { test, expect } from '@playwright/experimental-ct-react';
import { SnapshotFieldsEditor } from './SnapshotFieldsEditor';
import type { Snapshot } from '../types/snapshot';
import {
	createEmptySnapshot,
	createEmptyCharacterState,
	sortPair,
	getRelationshipKey,
} from '../types/snapshot';

// ============================================
// Test Fixtures
// ============================================

function createPopulatedSnapshot(): Snapshot {
	const snap = createEmptySnapshot({ messageId: 1, swipeId: 0 });
	snap.time = '2025-06-15T14:30:00.000Z';
	snap.location = {
		area: 'Downtown',
		place: 'Coffee Shop',
		position: 'Corner booth',
		props: ['menu', 'coffee cup'],
		locationType: 'modern',
	};
	snap.scene = {
		topic: 'First meeting',
		tone: 'Nervous excitement',
		tension: { level: 'aware', type: 'conversation', direction: 'escalating' },
	};

	const alice = createEmptyCharacterState('Alice');
	alice.position = 'Sitting at table';
	alice.activity = 'Sipping coffee';
	alice.mood = ['curious', 'nervous'];
	alice.profile = {
		sex: 'F',
		species: 'Human',
		age: 28,
		appearance: ['blonde hair', 'blue eyes'],
		personality: ['kind', 'adventurous'],
	};
	alice.outfit = {
		...alice.outfit,
		torso: 'White blouse',
		legs: 'Blue jeans',
		footwear: 'Sneakers',
	};

	const bob = createEmptyCharacterState('Bob');
	bob.position = 'Standing nearby';
	bob.mood = ['confident'];

	snap.characters = { Alice: alice, Bob: bob };

	const pair = sortPair('Alice', 'Bob');
	const key = getRelationshipKey(pair);
	snap.relationships = {
		[key]: {
			pair,
			status: 'strangers',
			aToB: { feelings: ['curious'], secrets: [], wants: ['friendship'] },
			bToA: { feelings: ['interested'], secrets: [], wants: [] },
		},
	};

	return snap;
}

function createMinimalSnapshot(): Snapshot {
	return createEmptySnapshot({ messageId: 1, swipeId: 0 });
}

// ============================================
// Section Rendering
// ============================================

test.describe('Section rendering', () => {
	test('renders all 5 sections with populated snapshot', async ({ mount }) => {
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={createPopulatedSnapshot()}
				onChange={() => {}}
			/>,
		);

		await expect(
			component.locator('.bt-snapshot-section-header', { hasText: 'Time' }),
		).toBeVisible();
		await expect(
			component.locator('.bt-snapshot-section-header', { hasText: 'Location' }),
		).toBeVisible();
		await expect(
			component.locator('.bt-snapshot-section-header', { hasText: 'Scene' }),
		).toBeVisible();
		await expect(component.getByText('Characters (2)')).toBeVisible();
		await expect(component.getByText('Relationships (1)')).toBeVisible();
	});

	test('shows correct character and relationship counts', async ({ mount }) => {
		const snap = createMinimalSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await expect(component.getByText('Characters (0)')).toBeVisible();
		await expect(component.getByText('Relationships (0)')).toBeVisible();
	});
});

// ============================================
// Time Section
// ============================================

test.describe('Time section', () => {
	test('shows datetime-local input when time is set', async ({ mount }) => {
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		const timeInput = component.locator('input[type="datetime-local"]');
		await expect(timeInput).toBeVisible();
	});

	test('shows Set Time button when time is null', async ({ mount }) => {
		const snap = createMinimalSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await expect(component.getByText('Set Time')).toBeVisible();
	});

	test('clear button removes time', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		await component.locator('button[title="Clear time"]').click();
		expect(lastSnapshot).not.toBeNull();
		expect(lastSnapshot!.time).toBeNull();
	});
});

// ============================================
// Location Section
// ============================================

test.describe('Location section', () => {
	test('shows location fields when location exists', async ({ mount }) => {
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await expect(component.locator('input[placeholder="Area name"]')).toBeVisible();
		await expect(component.locator('input[placeholder="Place name"]')).toBeVisible();
		await expect(
			component.locator('input[placeholder="Position description"]'),
		).toBeVisible();
		await expect(component.getByText('Clear Location')).toBeVisible();
	});

	test('shows Add Location button when location is null', async ({ mount }) => {
		const snap = createMinimalSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await expect(component.getByText('Add Location')).toBeVisible();
	});

	test('editing area text triggers onChange', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		const areaInput = component.locator('input[placeholder="Area name"]');
		await areaInput.fill('Uptown');
		expect(lastSnapshot).not.toBeNull();
		expect(lastSnapshot!.location!.area).toBe('Uptown');
	});

	test('Clear Location sets location to null', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		await component.getByText('Clear Location').click();
		expect(lastSnapshot).not.toBeNull();
		expect(lastSnapshot!.location).toBeNull();
	});
});

// ============================================
// Scene Section
// ============================================

test.describe('Scene section', () => {
	test('shows scene fields when scene exists', async ({ mount }) => {
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await expect(component.locator('input[placeholder="Scene topic"]')).toBeVisible();
		await expect(component.locator('input[placeholder="Scene tone"]')).toBeVisible();
		await expect(component.getByText('Clear Scene')).toBeVisible();
	});

	test('shows Add Scene button when scene is null', async ({ mount }) => {
		const snap = createMinimalSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await expect(component.getByText('Add Scene')).toBeVisible();
	});

	test('changing tension level triggers onChange', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		// Find the Tension Level select by its label
		const tensionLevelSelect = component
			.locator('.bt-snapshot-field')
			.filter({ hasText: 'Tension Level' })
			.locator('select');
		await tensionLevelSelect.selectOption('tense');
		expect(lastSnapshot).not.toBeNull();
		expect(lastSnapshot!.scene!.tension.level).toBe('tense');
	});
});

// ============================================
// Characters Section
// ============================================

test.describe('Characters section', () => {
	test('renders character cards with names', async ({ mount }) => {
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await expect(
			component.locator('.bt-snapshot-char-name', { hasText: 'Alice' }),
		).toBeVisible();
		await expect(
			component.locator('.bt-snapshot-char-name', { hasText: 'Bob' }),
		).toBeVisible();
	});

	test('Add Character creates new character', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createMinimalSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		await component.locator('input[placeholder="Character name..."]').fill('Charlie');
		await component.getByText('Add Character').click();
		expect(lastSnapshot).not.toBeNull();
		expect(lastSnapshot!.characters).toHaveProperty('Charlie');
		expect(lastSnapshot!.characters['Charlie'].name).toBe('Charlie');
	});

	test('Add Character button disabled for empty name', async ({ mount }) => {
		const snap = createMinimalSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		const addBtn = component.getByText('Add Character');
		await expect(addBtn).toBeDisabled();
	});

	test('Add Character button disabled for duplicate name', async ({ mount }) => {
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await component.locator('input[placeholder="Character name..."]').fill('Alice');
		const addBtn = component.getByText('Add Character');
		await expect(addBtn).toBeDisabled();
	});

	test('Delete character removes character and its relationships', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		// Click delete on Alice's character card
		const aliceCard = component
			.locator('.bt-snapshot-char-card')
			.filter({ hasText: 'Alice' });
		await aliceCard.locator('.bt-snapshot-delete-char').click();

		expect(lastSnapshot).not.toBeNull();
		expect(lastSnapshot!.characters).not.toHaveProperty('Alice');
		// The Alice|Bob relationship should also be removed
		expect(Object.keys(lastSnapshot!.relationships)).toHaveLength(0);
	});

	test('profile add/remove toggle works', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		// Open Alice's character card
		const aliceCard = component
			.locator('.bt-snapshot-char-card')
			.filter({ hasText: 'Alice' });
		await aliceCard.locator('summary').click();

		// Alice has a profile - click the remove button on the Profile subsection
		const profileSection = aliceCard
			.locator('.bt-snapshot-subsection')
			.filter({ hasText: 'Profile' })
			.first();
		await profileSection.locator('.bt-snapshot-remove-btn').click();

		expect(lastSnapshot).not.toBeNull();
		expect(lastSnapshot!.characters['Alice'].profile).toBeUndefined();
	});
});

// ============================================
// Relationships Section
// ============================================

test.describe('Relationships section', () => {
	test('renders relationship with pair names and status', async ({ mount }) => {
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor snapshot={snap} onChange={() => {}} />,
		);

		await expect(component.locator('.bt-snapshot-rel-pair').first()).toBeVisible();
		await expect(
			component.locator('.bt-snapshot-rel-status', { hasText: 'strangers' }),
		).toBeVisible();
	});

	test('status select changes relationship status', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		// Open the relationship card
		const relCard = component.locator('.bt-snapshot-rel-card').first();
		await relCard.locator('summary').click();

		// Change the status select
		const statusSelect = relCard
			.locator('.bt-snapshot-field')
			.filter({ hasText: 'Status' })
			.locator('select');
		await statusSelect.selectOption('friendly');

		expect(lastSnapshot).not.toBeNull();
		const relKey = Object.keys(lastSnapshot!.relationships)[0];
		expect(lastSnapshot!.relationships[relKey].status).toBe('friendly');
	});

	test('add relationship creates new entry', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		// Remove existing relationship so we can add it fresh
		snap.relationships = {};
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		// Select Character A and B
		const addRow = component
			.locator('.bt-snapshot-section')
			.filter({ hasText: 'Relationships' })
			.locator('.bt-snapshot-add-row');
		const selectA = addRow.locator('select').first();
		const selectB = addRow.locator('select').nth(1);

		await selectA.selectOption('Alice');
		await selectB.selectOption('Bob');
		await addRow.locator('.bt-snapshot-add-btn').click();

		expect(lastSnapshot).not.toBeNull();
		const relKeys = Object.keys(lastSnapshot!.relationships);
		expect(relKeys).toHaveLength(1);
		expect(lastSnapshot!.relationships[relKeys[0]].pair).toContain('Alice');
		expect(lastSnapshot!.relationships[relKeys[0]].pair).toContain('Bob');
	});

	test('delete relationship removes it', async ({ mount }) => {
		let lastSnapshot: Snapshot | null = null;
		const snap = createPopulatedSnapshot();
		const component = await mount(
			<SnapshotFieldsEditor
				snapshot={snap}
				onChange={s => {
					lastSnapshot = s;
				}}
			/>,
		);

		const relCard = component.locator('.bt-snapshot-rel-card').first();
		await relCard.locator('.bt-snapshot-delete-rel').click();

		expect(lastSnapshot).not.toBeNull();
		expect(Object.keys(lastSnapshot!.relationships)).toHaveLength(0);
	});
});
