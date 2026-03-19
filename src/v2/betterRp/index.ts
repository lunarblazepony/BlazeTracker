/**
 * Better RP Pipeline
 *
 * Pre-flight thinking pipeline for better roleplay responses.
 */

export type {
	BetterRpResult,
	ContinuityAuditResult,
	CharacterKnowledgeResult,
	TensionSteeringResult,
	BeatPlanningResult,
	Direction,
	Beat,
	CharacterAnalysis,
} from './types';

export { runBetterRpPipeline, type BetterRpPipelineParams } from './pipeline';
export { formatBeatPlanInjection } from './inject';
export { buildSharedContext, type BuildSharedContextParams } from './context';
