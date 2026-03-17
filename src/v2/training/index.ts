/**
 * Training Data Capture
 *
 * Re-exports for the training data capture module.
 */

export type { TrainingPair, TrainingMessage } from './types';

export {
	isTrainingCaptureEnabled,
	captureRawPair,
	annotateLastCapture,
	getTrainingPairCount,
	getTrainingPairs,
	clearTrainingPairs,
	exportTrainingDataAsJsonl,
	downloadTrainingData,
} from './TrainingDataStore';

export { TrainingCaptureGenerator, withTrainingCapture } from './TrainingCaptureGenerator';
