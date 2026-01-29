import moment from 'moment';
import type { Generator } from '../generator';
import type {
	ExtractionContext,
	ExtractionSettings,
	InitialExtractionResult,
} from '../extractors/types';
import type { Snapshot, MessageAndSwipe, LocationState } from '../types';
import { createEmptySnapshot } from '../types/snapshot';
import { isValidLocationType, serializeMoment } from '../types/common';
import { initialExtractors } from '../extractors/initial';
import { startSection, completeSection } from '../extractors/progressTracker';
import type { CardExtensions } from '../cardExtensions/types';
import { debugLog, errorLog } from '../../utils/debug';

/**
 * Run initial extraction to produce the initial Snapshot.
 * Runs all enabled initial extractors in sequence.
 *
 * @param generator - The generator for LLM calls
 * @param context - Extraction context
 * @param settings - Extraction settings
 * @param source - Source message/swipe
 * @param setStatus - Optional status callback
 * @param cardExtensions - Optional card extensions (skip LLM for absolute replacements)
 */
export async function extractInitialSnapshot(
	generator: Generator,
	context: ExtractionContext,
	settings: ExtractionSettings,
	source: MessageAndSwipe,
	setStatus?: (status: string) => void,
	cardExtensions?: CardExtensions | null,
	abortSignal?: AbortSignal,
): Promise<InitialExtractionResult> {
	const errors: Array<{ extractor: string; error: Error }> = [];

	// Start with empty snapshot
	let partialSnapshot: Partial<Snapshot> = {};

	// Pre-populate from card extensions (absolute replacements - skip LLM entirely)
	if (cardExtensions?.time?.enabled && cardExtensions.time.datetime) {
		const parsed = moment(cardExtensions.time.datetime);
		if (parsed.isValid()) {
			partialSnapshot.time = serializeMoment(parsed);
			debugLog('Using time from card extension, skipping LLM');
		}
	}

	if (cardExtensions?.location?.enabled) {
		const loc = cardExtensions.location;
		const location: LocationState = {
			area: loc.area ?? '',
			place: loc.place ?? '',
			position: loc.position ?? '',
			props: [], // Props still extracted by LLM
			locationType:
				loc.locationType && isValidLocationType(loc.locationType)
					? loc.locationType
					: 'outdoor',
		};
		partialSnapshot.location = location;
		debugLog('Using location from card extension, skipping LLM');
	}

	// Run each enabled extractor in order
	for (const extractor of initialExtractors) {
		// Check if aborted before each extractor
		if (abortSignal?.aborted) {
			// Return empty snapshot with aborted flag
			return {
				snapshot: createEmptySnapshot(source),
				errors,
				aborted: true,
			};
		}

		// Check if extractor should run (pass partialSnapshot for dependency checks)
		// Extractors check partialSnapshot for existing data (e.g., from card extensions)
		if (!extractor.shouldRun(settings, context, partialSnapshot)) {
			debugLog(
				`Skipping ${extractor.name}: shouldRun returned false ` +
					`(track.${extractor.category}=${settings.track[extractor.category as keyof typeof settings.track]}, ` +
					`chat.length=${context.chat.length}, ` +
					`has location=${!!partialSnapshot?.location})`,
			);
			continue;
		}

		// Update status and start timing (each initial extractor is its own section)
		const sectionKey = `initial_${extractor.name}`;
		const label = `Extracting ${extractor.displayName}...`;
		startSection(sectionKey, label);
		setStatus?.(label);

		try {
			// Run extractor
			const result = await extractor.run(
				generator,
				context,
				settings,
				partialSnapshot,
				abortSignal,
			);

			// Check if aborted during extraction
			if (abortSignal?.aborted) {
				completeSection(sectionKey);
				return {
					snapshot: createEmptySnapshot(source),
					errors,
					aborted: true,
				};
			}

			// Merge result into partial snapshot
			partialSnapshot = { ...partialSnapshot, ...result };
		} catch (error) {
			// Log and collect errors but continue
			errorLog(`${extractor.name} failed:`, error);
			errors.push({
				extractor: extractor.name,
				error: error instanceof Error ? error : new Error(String(error)),
			});
		} finally {
			completeSection(sectionKey);
		}
	}

	// Create complete snapshot from partial
	const snapshot: Snapshot = {
		...createEmptySnapshot(source),
		...partialSnapshot,
		source,
		timestamp: Date.now(),
		swipeId: source.swipeId,
	};

	return { snapshot, errors };
}
