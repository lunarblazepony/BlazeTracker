/**
 * Test utilities - DO NOT IMPORT IN PRODUCTION CODE
 *
 * This file contains utilities that should only be used in tests.
 * Importing from this file in production code will cause build issues.
 */

import type { SwipeContext } from '../v2/store/projection';

/**
 * A SwipeContext that returns 0 for all messages.
 * ONLY FOR TESTS - do not use in production code.
 */
export const NoSwipeFiltering: SwipeContext = {
	getCanonicalSwipeId: () => 0,
};
