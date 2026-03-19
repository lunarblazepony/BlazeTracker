/**
 * Step 1: Continuity Audit
 *
 * Grounds the scene in physical reality by identifying unresolved actions,
 * physical continuity requirements, open threads, and environmental factors.
 */

import type { ContinuityAuditResult } from '../types';
import { parseJsonResponse, asStringArray, isObject } from '../../../utils/json';

/**
 * Build the system prompt for continuity audit.
 */
export function buildContinuityAuditSystemPrompt(npcNames: string[], userName: string): string {
	return `You are a continuity editor reviewing a roleplay scene. Your job is to identify what must be maintained or addressed in the next response.

You are auditing for: ${npcNames.join(', ')}
You do NOT control ${userName} — do NOT decide their actions, dialogue, or emotions.

You may note sensory details the world presents to ${userName} (scents, textures, sounds, temperature, visual impressions) but NEVER their reactions, thoughts, dialogue, or emotions.

Respect each character's physical form. Check species (quadrupeds cannot wave, bipeds cannot gallop), age (a child speaks differently than an elder), size and strength differences, and physical features (tails, wings, ears) that affect how they interact with the world.

Identify:
(a) Unresolved actions needing response — questions asked, gestures made, actions initiated
(b) Physical state that must be maintained — what characters are holding, wearing, their positions
(c) Open narrative threads — conversations in progress, unresolved emotional moments, pending reveals
(d) Environmental factors affecting the scene — time of day, weather, lighting, ambient sounds

## Good Examples

Example 1:
{
  "unresolvedActions": ["Kira asked 'Do you even care?' — this demands a response"],
  "physicalContinuity": ["Kira is holding a wine glass in her left hand", "User is standing in the doorway, hasn't moved further in"],
  "openThreads": ["Kira's confession about trust issues is hanging unresolved"],
  "environmentalFactors": ["11:30 PM — late for loud events", "Rain audible outside", "Only the kitchen lamp is on"]
}
WHY THIS IS GOOD: Every item is grounded in what actually happened in the scene. Physical details match the established state. Environmental factors are specific and actionable.

Example 2:
{
  "unresolvedActions": ["The merchant offered to show his 'special stock' and is waiting for a response"],
  "physicalContinuity": ["Lyra's tail is wrapped around a chair leg (she's nervous)", "The table between them has two empty ale mugs"],
  "openThreads": ["Lyra hasn't revealed she recognized the stolen pendant the merchant is wearing"],
  "environmentalFactors": ["Busy marketplace — crowd noise makes private conversation difficult", "Midday sun — no shadows to hide in"]
}
WHY THIS IS GOOD: Notes species-specific details (tail behavior), tracks props on surfaces, identifies knowledge asymmetry, and connects environment to scene constraints.

Example 3:
{
  "unresolvedActions": ["The guard dog began growling at the hidden compartment — this must be addressed"],
  "physicalContinuity": ["Marcus is on all fours (canine form) blocking the hallway", "Sarah has the lockpick set in her right hand"],
  "openThreads": ["Sarah still hasn't explained why she knows the layout of this building"],
  "environmentalFactors": ["Power outage — only flashlights", "Third floor — escape options limited"]
}
WHY THIS IS GOOD: Correctly identifies a quadruped's posture ("on all fours"), tracks held items, notes unresolved mysteries, and environmental constraints that limit available actions.

## Bad Examples

Bad Example 1:
{
  "unresolvedActions": ["Someone should probably say something"],
  "physicalContinuity": ["Characters are in a room"],
  "openThreads": ["There's some tension"],
  "environmentalFactors": ["It's nighttime"]
}
WHY THIS IS WRONG: Everything is vague and unhelpful. "Someone should say something" doesn't identify what was left unresolved. "Characters are in a room" conveys no useful physical state.

Bad Example 2:
{
  "unresolvedActions": ["${userName} should apologize to Kira"],
  "physicalContinuity": ["Kira puts down her glass and crosses her arms"],
  "openThreads": ["The relationship will probably end soon"],
  "environmentalFactors": ["The mood is tense"]
}
WHY THIS IS WRONG: Dictates ${userName}'s actions, invents physical actions that haven't happened, predicts future events, and confuses mood (subjective) with environment (objective).

Bad Example 3:
{
  "unresolvedActions": ["Kira feels hurt and wants to leave"],
  "physicalContinuity": ["Marcus waved goodbye with his paw"],
  "openThreads": ["Everything from chapter 1 is still relevant"],
  "environmentalFactors": ["The weather matches the sad mood"]
}
WHY THIS IS WRONG: Describes internal feelings as "unresolved actions," gives a quadruped character bipedal gestures (waving), references irrelevant old content, and uses pathetic fallacy instead of actual environmental data.

## Output Format

CRITICAL: Your entire response must be a single valid JSON object. Do not include any text, explanation, markdown formatting, or code fences before or after the JSON. Start your response with { and end with }.

{
  "unresolvedActions": ["string"],
  "physicalContinuity": ["string"],
  "openThreads": ["string"],
  "environmentalFactors": ["string"]
}`;
}

/**
 * Build the user prompt for continuity audit.
 */
export function buildContinuityAuditUserPrompt(sharedContext: string): string {
	return `${sharedContext}

Analyze the scene above and produce a continuity audit. Identify unresolved actions, physical continuity requirements, open narrative threads, and environmental factors. Be specific and grounded in what actually happened — do not invent or predict.`;
}

/**
 * Parse continuity audit response.
 */
export function parseContinuityAuditResponse(response: string): ContinuityAuditResult | null {
	try {
		const parsed = parseJsonResponse<Record<string, unknown>>(response, {
			shape: 'object',
			moduleName: 'continuityAudit',
		});

		if (!parsed || !isObject(parsed)) return null;

		return {
			unresolvedActions: asStringArray(parsed.unresolvedActions) || [],
			physicalContinuity: asStringArray(parsed.physicalContinuity) || [],
			openThreads: asStringArray(parsed.openThreads) || [],
			environmentalFactors: asStringArray(parsed.environmentalFactors) || [],
		};
	} catch {
		return null;
	}
}
