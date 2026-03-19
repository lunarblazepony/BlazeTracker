/**
 * Better RP Pipeline Types
 *
 * Result types for the 4-step pre-flight thinking pipeline.
 */

/**
 * Step 1: Continuity Audit result.
 */
export interface ContinuityAuditResult {
	unresolvedActions: string[];
	physicalContinuity: string[];
	openThreads: string[];
	environmentalFactors: string[];
}

/**
 * Step 2: Character Knowledge & Intentions result.
 */
export interface CharacterKnowledgeResult {
	characters: CharacterAnalysis[];
}

export interface CharacterAnalysis {
	character: string;
	knows: string[];
	doesntKnow: string[];
	assumes: string[];
	wantsRightNow: string;
	candidateActions: string[];
}

/**
 * Step 3: Tension Steering result.
 */
export interface TensionSteeringResult {
	directive: 'escalate' | 'sustain' | 'release' | 'pivot';
	rationale: string;
	dramaticIronyOpportunities: string[];
	threadPriority: string[];
	toneTarget: string;
}

/**
 * Step 4: Response Direction result.
 */
export interface BeatPlanningResult {
	directions: Direction[];
}

export interface Direction {
	/** What the NPC physically does — actions, body language, movement */
	narration: string;
	/** What the NPC says — tone, content direction, register (not exact words) */
	dialogue: string;
	/** Sensory detail grounded in the character's description (1 sense, not repeated from recent messages) */
	sensory: string;
	/** What the NPC is thinking/feeling that the prose should convey through subtext */
	intent: string;
}

/** @deprecated Use Direction instead */
export type Beat = Direction;

/**
 * Complete pipeline result.
 */
export interface BetterRpResult {
	continuityAudit: ContinuityAuditResult | null;
	characterKnowledge: CharacterKnowledgeResult | null;
	tensionSteering: TensionSteeringResult | null;
	beatPlanning: BeatPlanningResult | null;
	errors: Array<{ step: string; error: Error }>;
}
