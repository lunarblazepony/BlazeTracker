/**
 * Training Capture Generator
 *
 * Decorator that wraps a Generator to capture LLM input/output pairs
 * for training data. Delegates all calls to the inner generator and
 * records pairs in the TrainingDataStore when capture is enabled.
 */

import type { Generator } from '../generator/Generator';
import type { GeneratorPrompt, GeneratorSettings } from '../generator/types';
import { isTrainingCaptureEnabled, captureRawPair } from './TrainingDataStore';

/**
 * Generator decorator that captures I/O pairs for training data.
 */
export class TrainingCaptureGenerator implements Generator {
	constructor(private readonly inner: Generator) {}

	async generate(prompt: GeneratorPrompt, settings: GeneratorSettings): Promise<string> {
		const response = await this.inner.generate(prompt, settings);

		if (isTrainingCaptureEnabled()) {
			// Extract messages in conversation format (pre-formatting)
			const messages = prompt.messages.map(m => ({
				role: m.role,
				content: m.content,
			}));

			captureRawPair({
				promptName: prompt.name ?? 'unknown',
				messages,
				response,
				temperature: settings.temperature ?? 0.5,
				maxTokens: settings.maxTokens,
			});
		}

		return response;
	}

	abort(): void {
		this.inner.abort();
	}
}

/**
 * Wrap a generator with training capture if enabled.
 * Returns the decorator when capture is on, passthrough when off.
 */
export function withTrainingCapture(generator: Generator): Generator {
	if (isTrainingCaptureEnabled()) {
		return new TrainingCaptureGenerator(generator);
	}
	return generator;
}
