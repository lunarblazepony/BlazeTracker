import { test, expect } from '@playwright/experimental-ct-react';
import { V2CharacterCard } from './V2CharacterCard';
import { createEmptyCharacterState } from '../../types/snapshot';

// ============================================
// Test Fixtures
// ============================================

function createCharacterWithAkas() {
	const char = createEmptyCharacterState('Elena');
	char.position = 'standing';
	char.mood = ['curious'];
	char.akas = ['Lena', 'sunshine', 'troublemaker'];
	char.profile = {
		sex: 'F',
		species: 'Human',
		age: 28,
		appearance: ['auburn hair', 'green eyes'],
		personality: ['clever', 'guarded'],
	};
	return char;
}

function createCharacterWithEmptyAkas() {
	const char = createEmptyCharacterState('Marcus');
	char.position = 'sitting';
	char.mood = ['calm'];
	char.akas = [];
	char.profile = {
		sex: 'M',
		species: 'Human',
		age: 35,
		appearance: ['dark hair'],
		personality: ['stoic'],
	};
	return char;
}

function createCharacterWithUndefinedAkas() {
	const char = createEmptyCharacterState('Sofia');
	char.position = 'standing';
	char.mood = ['happy'];
	// akas defaults to [] from createEmptyCharacterState, but test the display
	return char;
}

// ============================================
// AKAs Display
// ============================================

test.describe('AKAs display', () => {
	test('shows AKAs in character header when present', async ({ mount }) => {
		const character = createCharacterWithAkas();

		const component = await mount(<V2CharacterCard character={character} />);

		const akasSpan = component.locator('.bt-char-akas');
		await expect(akasSpan).toBeVisible();
		await expect(akasSpan).toContainText('Lena');
		await expect(akasSpan).toContainText('sunshine');
		await expect(akasSpan).toContainText('troublemaker');
	});

	test('AKAs span has title attribute with full list', async ({ mount }) => {
		const character = createCharacterWithAkas();

		const component = await mount(<V2CharacterCard character={character} />);

		const akasSpan = component.locator('.bt-char-akas');
		await expect(akasSpan).toHaveAttribute(
			'title',
			'AKAs: Lena, sunshine, troublemaker',
		);
	});

	test('hides AKAs when array is empty', async ({ mount }) => {
		const character = createCharacterWithEmptyAkas();

		const component = await mount(<V2CharacterCard character={character} />);

		await expect(component.locator('.bt-char-akas')).not.toBeVisible();
	});

	test('hides AKAs when akas is default empty array', async ({ mount }) => {
		const character = createCharacterWithUndefinedAkas();

		const component = await mount(<V2CharacterCard character={character} />);

		await expect(component.locator('.bt-char-akas')).not.toBeVisible();
	});
});
