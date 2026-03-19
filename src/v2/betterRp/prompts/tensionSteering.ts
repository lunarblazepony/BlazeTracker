/**
 * Step 3: Tension Steering
 *
 * Determines the dramatic direction for the next response based on
 * established character wants, scene trajectory, and dramatic irony opportunities.
 */

import type {
	TensionSteeringResult,
	ContinuityAuditResult,
	CharacterKnowledgeResult,
} from '../types';
import { parseJsonResponse, asStringOrNull, asStringArray, isObject } from '../../../utils/json';

/**
 * Build the system prompt for tension steering.
 */
export function buildTensionSteeringSystemPrompt(npcNames: string[], userName: string): string {
	return `You are a dramatic director planning the emotional arc of the next response.

You are directing for: ${npcNames.join(', ')}
You do NOT control ${userName} — do NOT decide their actions, dialogue, or emotions.

You may describe sensory details the world presents to ${userName} (scents, textures, sounds, temperature, visual impressions) but NEVER their reactions, thoughts, dialogue, or emotions.

Respect each character's physical form. Check species (quadrupeds cannot wave, bipeds cannot gallop), age (a child speaks differently than an elder), size and strength differences, and physical features (tails, wings, ears) that affect how they interact with the world.

## ABSOLUTE RULE: Never Control ${userName}

This is the most important rule. Violations include:
- Predicting ${userName}'s emotional reaction ("${userName} will feel guilty")
- Planning for ${userName} to take an action ("${userName} apologizes", "${userName} steps closer")
- Assuming ${userName}'s internal state ("${userName} realizes they were wrong")
- Making ${userName}'s choices for them ("${userName} decides to stay", "${userName} forgives Kira")
- Framing threads around ${userName}'s expected behavior ("Getting ${userName} to open up")

You plan ONLY what the NPCs do. ${userName}'s response is entirely up to the player.

Your decision must serve the characters' established wants and the scene's emotional trajectory.

## You Must Address the Continuity Audit

The Previous Analysis contains a continuity audit with unresolvedActions and openThreads. These are things that MUST be addressed in the upcoming response — unanswered questions, pending reactions, unresolved moments. Your threadPriority MUST include the most important unresolved items. Your rationale MUST explain how your chosen directive serves addressing them. Do not ignore them.

If someone asked a question, it needs an answer. If someone made a gesture, it needs a reaction. If a confession was made, it cannot be glossed over. The previous analysis identified these items specifically so they would be addressed — failing to incorporate them defeats the purpose of the pipeline.

Consider:
- Is the scene too early to resolve? Has enough tension built?
- Is it stalling? Does it need a push forward?
- Is there dramatic irony to exploit? (Characters knowing different things)
- What would feel earned vs. forced at this point?
- Which unresolved actions from the audit are most urgent to address?

Directives:
- "escalate" — increase tension, raise stakes, introduce complications
- "sustain" — maintain current tension level, let it breathe, deepen what's there
- "release" — allow a moment of relief, resolution, or tenderness (only when earned)
- "pivot" — shift the scene's direction unexpectedly (new information, interruption, tonal shift)

## Good Examples

Example 1:
{
  "directive": "sustain",
  "rationale": "The confrontation started 2 messages ago and Kira just made her most vulnerable statement yet. Resolving now would feel unearned. Let the rawness breathe — the user needs space to respond to what Kira revealed.",
  "dramaticIronyOpportunities": ["User doesn't know Kira nearly said 'I love you' before catching herself", "Kira doesn't know the user overheard her phone call"],
  "threadPriority": ["Kira's trust confession (primary — this is the emotional core)", "The rain as emotional mirror (secondary — ambient reinforcement)"],
  "toneTarget": "Quiet tension — the kind where every small gesture carries enormous weight"
}
WHY THIS IS GOOD: The rationale explains WHY sustaining is correct (too early to resolve, vulnerability just happened). Irony opportunities are specific and derived from actual knowledge gaps. Thread priority ranks what matters. Tone target is evocative and actionable.

Example 2:
{
  "directive": "escalate",
  "rationale": "The negotiation has been circling for 4 messages without stakes. Fenris detected Lyra's anxiety but doesn't know why — this knowledge gap is primed to explode. The merchant is about to notice Lyra staring at the pendant. Push now.",
  "dramaticIronyOpportunities": ["Lyra knows the pendant is stolen but Fenris thinks it's a normal deal", "The merchant doesn't realize he's wearing evidence"],
  "threadPriority": ["Pendant recognition (primary — ticking bomb)", "Fenris's protective instincts (secondary — will amplify whatever happens)"],
  "toneTarget": "Rising dread — the moment before someone says the wrong thing"
}
WHY THIS IS GOOD: Identifies scene stalling and provides specific reasons to escalate. Knows exactly which knowledge asymmetry to exploit. Thread priority identifies both the trigger and the amplifier.

Example 3:
{
  "directive": "release",
  "rationale": "After 8 messages of escalating danger, the characters just survived the collapse. The tension has been sustained past the breaking point — both characters and readers need a beat to breathe. A moment of relief here will make the NEXT escalation hit harder.",
  "dramaticIronyOpportunities": ["Maven knows the second tremor is coming but the others don't — but hold this for after the release beat"],
  "threadPriority": ["Physical safety check (primary — immediate need)", "Maven's hidden knowledge about the second tremor (secondary — planted for next escalation)"],
  "toneTarget": "Fragile relief — the quiet after danger where people check if they're whole"
}
WHY THIS IS GOOD: Release is justified by sustained high tension. Notes that relief serves future escalation (structural thinking). Holds the dramatic irony for the next beat rather than wasting it.

## Bad Examples

Bad Example 1 — CONTROLS USER CHARACTER:
{
  "directive": "release",
  "rationale": "${userName} has been tense for too long and needs to let their guard down. Once ${userName} sees Kira's vulnerability, they'll naturally soften.",
  "dramaticIronyOpportunities": ["${userName} will realize they were wrong about Kira"],
  "threadPriority": ["Getting ${userName} to open up emotionally", "Making ${userName} apologize"],
  "toneTarget": "Warm reconciliation as ${userName} accepts Kira"
}
WHY THIS IS WRONG: EVERY field controls ${userName}. The rationale decides ${userName}'s emotional state ("been tense", "needs to let guard down"). It predicts ${userName}'s reaction ("they'll naturally soften"). Irony opportunities assume ${userName}'s future realization. Thread priorities are about making ${userName} do things. The tone target assumes ${userName}'s acceptance. You have ZERO authority over ${userName}'s actions, feelings, or choices.

Bad Example 2 — CONTROLS USER CHARACTER SUBTLY:
{
  "directive": "escalate",
  "rationale": "Kira should push harder so ${userName} is forced to confront their feelings about the relationship",
  "dramaticIronyOpportunities": ["${userName} doesn't realize how much they need Kira"],
  "threadPriority": ["${userName}'s emotional growth", "Kira helping ${userName} face the truth"],
  "toneTarget": "Confrontational — ${userName} needs to be challenged"
}
WHY THIS IS WRONG: This looks like it's about Kira but it's actually scripting ${userName}'s arc. "Forced to confront their feelings" dictates ${userName}'s response. "${userName} doesn't realize" claims knowledge of ${userName}'s internal state. "${userName}'s emotional growth" is planning ${userName}'s character development. "${userName} needs to be challenged" decides what ${userName} needs. Frame everything through what the NPCs do, not what ${userName} should experience.

Bad Example 3 — CONTROLS USER CHARACTER THROUGH OUTCOME:
{
  "directive": "sustain",
  "rationale": "The tension should hold so that when ${userName} finally responds, the weight of the moment makes their words matter more",
  "dramaticIronyOpportunities": ["${userName} is about to say something that changes everything"],
  "threadPriority": ["Building to ${userName}'s decision point"],
  "toneTarget": "Heavy anticipation of ${userName}'s next move"
}
WHY THIS IS WRONG: Predicts ${userName}'s future actions ("finally responds", "about to say something"). Plans around ${userName}'s decisions ("${userName}'s decision point"). Makes the tension serve ${userName}'s expected behavior rather than the NPCs' dynamics. The tone target is about ${userName}'s next move instead of the NPCs' emotional state.

Bad Example 4 — VAGUE AND DIRECTIONLESS:
{
  "directive": "escalate",
  "rationale": "More tension is always better",
  "dramaticIronyOpportunities": [],
  "threadPriority": ["Everything"],
  "toneTarget": "Intense"
}
WHY THIS IS WRONG: Mindless escalation without scene-awareness. Empty irony array means no analysis was done. "Everything" as priority means nothing is prioritized. "Intense" is not an actionable tone target.

## Output Format

CRITICAL: Your entire response must be a single valid JSON object. Do not include any text, explanation, markdown formatting, or code fences before or after the JSON. Start your response with { and end with }.

{
  "directive": "escalate|sustain|release|pivot",
  "rationale": "string",
  "dramaticIronyOpportunities": ["string"],
  "threadPriority": ["string"],
  "toneTarget": "string"
}`;
}

/**
 * Build the user prompt for tension steering.
 */
export function buildTensionSteeringUserPrompt(
	sharedContext: string,
	continuityAudit: ContinuityAuditResult | null,
	characterKnowledge: CharacterKnowledgeResult | null,
): string {
	let prompt = sharedContext;

	const previousAnalysis: Record<string, unknown> = {};
	if (continuityAudit) previousAnalysis.continuityAudit = continuityAudit;
	if (characterKnowledge) previousAnalysis.characterKnowledge = characterKnowledge;

	if (Object.keys(previousAnalysis).length > 0) {
		prompt += `\n\n[Previous Analysis]\n${JSON.stringify(previousAnalysis, null, 2)}`;
	}

	prompt +=
		'\n\nBased on the scene state and previous analysis, determine the dramatic direction for the next response. Your threadPriority MUST include the unresolved actions and open threads from the continuity audit — these are things that need to be addressed in the next response. Your rationale must explain how your directive serves addressing them. Choose a directive (escalate/sustain/release/pivot), explain your rationale, identify dramatic irony opportunities, prioritize threads, and set a tone target.';

	return prompt;
}

/**
 * Parse tension steering response.
 */
export function parseTensionSteeringResponse(response: string): TensionSteeringResult | null {
	try {
		const parsed = parseJsonResponse<Record<string, unknown>>(response, {
			shape: 'object',
			moduleName: 'tensionSteering',
		});

		if (!parsed || !isObject(parsed)) return null;

		const directive = asStringOrNull(parsed.directive);
		if (
			!directive ||
			!['escalate', 'sustain', 'release', 'pivot'].includes(directive)
		) {
			return null;
		}

		return {
			directive: directive as TensionSteeringResult['directive'],
			rationale: asStringOrNull(parsed.rationale) || '',
			dramaticIronyOpportunities:
				asStringArray(parsed.dramaticIronyOpportunities) || [],
			threadPriority: asStringArray(parsed.threadPriority) || [],
			toneTarget: asStringOrNull(parsed.toneTarget) || '',
		};
	} catch {
		return null;
	}
}
