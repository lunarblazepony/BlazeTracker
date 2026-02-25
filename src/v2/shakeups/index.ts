/**
 * Scene Shakeups — LLM-driven random event injection
 */

export type { ShakeupSuggestion, ShakeupHistory } from './types';
export { createEmptyShakeupHistory } from './types';
export { computeShakeupProbability, shouldTriggerShakeup } from './probability';
export { getMessagesSinceLastShakeup, addShakeupTrigger } from './history';
export {
	SHAKEUP_SYSTEM_PROMPT,
	buildShakeupUserPrompt,
	parseShakeupResponse,
} from './shakeupPrompt';
export { generateShakeup, type GenerateShakeupParams } from './generateShakeup';
