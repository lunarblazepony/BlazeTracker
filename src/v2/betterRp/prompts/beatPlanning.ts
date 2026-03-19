/**
 * Step 4: Response Direction
 *
 * Plans the NPC's next response as 2-4 ordered directions.
 * Each direction is a prose moment: what the NPC does/says,
 * a sensory detail from their character description, and the
 * intent behind it.
 */

import type {
	BeatPlanningResult,
	Direction,
	ContinuityAuditResult,
	CharacterKnowledgeResult,
	TensionSteeringResult,
} from '../types';
import { parseJsonResponse, asStringOrNull, isObject } from '../../../utils/json';

/**
 * Build the system prompt for response direction planning.
 */
export function buildBeatPlanningSystemPrompt(npcNames: string[], userName: string): string {
	return `You are planning what ${npcNames.join(', ')} will do in their next response.

This is ONE response turn — a single block of prose written from the NPC's perspective. NOT a back-and-forth. NOT a full scene. Just what the NPC does right now, then the response STOPS and waits for ${userName} to act.

## Rules

${userName} does NOT appear as the subject of any verb. NPCs CAN act toward ${userName} (touch, speak to, look at) but ${userName} never acts, speaks, thinks, feels, decides, or reacts.

WHO is the subject? If ${userName} → FORBIDDEN. If an NPC → ALLOWED.

ALLOWED: "Kira reaches for ${userName}'s hand" — Kira is the subject
FORBIDDEN: "${userName} squeezes back" — ${userName} is the subject
FORBIDDEN: "${userName} feels warmth" — ${userName} is the subject
FORBIDDEN: "impossible for ${userName} to miss" — decides ${userName}'s perception

## Body Mechanics — Respect Physical Form

Every action must be physically possible for the character's body. Read the character profile — species, body type, and anatomy dictate what movements are available.

Quadrupeds (horses, wolves, cats, deer, etc.) CANNOT:
- Wave, gesture, or point (no hands/fingers in that form)
- Shrug, cross arms, or put hands on hips
- Pick things up with hooves or paws (use mouth, teeth, lips, or telekinesis if applicable)

Quadrupeds CAN:
- Nudge with nose or muzzle, nip, lick, headbutt
- Pin ears (if they have ears that move), raise hackles (if they have fur/hair), wag or tuck tail (if they have one)
- Paw at something (scrape, not grip)
- Shift weight, lower body, rear up (briefly)
- A pegasus picks up a letter with their teeth, not their hoof
- A wolf comforts by pressing their flank against someone, not by hugging
- A hairless character's skin might prickle with goosebumps instead of bristling fur — check the character description

Bipedal anthros (wolf-people, cat-people, etc.) can use hands BUT still have species features:
- Ears that pin, rotate, or perk (if their species has mobile ears)
- Tails that swish, tuck, wrap, or lash (if they have a tail)
- Fur/feathers/scales that bristle, puff, or flatten (if they have them — not all characters do; hairless or smooth-skinned characters exist)
- Muzzles, not flat faces (if their species has a muzzle — affects how they kiss, speak, emote)
- Digitigrade legs affect stance and movement (if their species has them)

ALWAYS check the character profile before assuming physical features. Not every animal-like character has fur. Not every winged character can fly. Use what the description says, not what you assume from the species name.

Elders move slowly. Children are small. Large characters take up space and cast shadows. Small characters look up. Match EVERY action to the character's physical reality.

## Sensory Details

Each direction MUST include one sensory detail grounded in the NPC's character description. Read the character profiles provided — use their actual physical traits (fur, scales, feathers, scars, eye color, body type, species features).

Rules:
- ONE sense per direction. Do not repeat the same sense across directions.
- Check recent messages — if scent was used recently, pick a different sense.
- The detail MUST match the character description. If the character has fur, describe fur texture — never "smooth skin". If they have a tail, reference it. If they're large, describe the physical reality of their size.
- Describe the sensory detail as something that EXISTS. Do not describe ${userName} perceiving or reacting to it.

GOOD: Character description says "wolf anthro with thick silver fur" →
"The coarse silver fur along Kira's forearm bristles as she reaches out"
WHY: Directly from the character card. Fur, not skin. Silver, not brown.

BAD: Same character description →
"Kira's smooth warm hand rests on ${userName}'s arm"
WHY: The character has fur, not smooth skin. This contradicts the character card.

BAD: "The scent of her perfume fills the room" (used in last 2 messages already)
WHY: Repetitive. Pick a different sense.

## Unresolved Items — You MUST Respond To These

The Previous Analysis has a continuity audit listing unresolvedActions and openThreads. Your FIRST direction must directly address the most urgent unresolved item. If a question was asked, the NPC's dialogue in direction 1 must answer or deliberately deflect it. If a confession is hanging, direction 1 must show the NPC reacting to it. If a gesture was made, direction 1 must acknowledge it.

Do NOT plan directions that ignore what just happened. The whole point of the continuity audit is to prevent dropped threads. If the audit says "Kira asked 'Do you even care?'" — then the NPC's first dialogue MUST address that question. Not later. Not indirectly. Direction 1.

Remaining unresolved items should be woven into subsequent directions.

## Output

Return 2-4 directions. Each direction has exactly 4 fields:

- narration: What the NPC physically does — specific actions, body language, movement. NOT dialogue (that goes in the dialogue field).
- dialogue: What the NPC says and how — tone, content direction, register. Not exact words, but specific enough to guide the prose. If the NPC doesn't speak in this moment, write "No dialogue."
- sensory: ONE sensory detail grounded in the character's physical description. Different sense than other directions and recent messages.
- intent: What the NPC is thinking or feeling that should come through as subtext — not stated directly in the prose, but conveyed through how they act and speak.

Each direction must be DISTINCT. Do not repeat the same action, dialogue, or sensory detail across directions. If two directions describe the same moment, merge them into one.

## Good Example

Scene: Kira (wolf anthro, silver fur, amber eyes) just confessed something painful. Late night kitchen.
Continuity audit unresolvedActions: ["${userName} asked 'Why didn't you tell me sooner?'"]

{
  "directions": [
    {
      "narration": "Kira sets the wine glass down on the counter with deliberate control. Her ears pin back flat against her skull.",
      "dialogue": "Answers ${userName}'s question directly — why she didn't tell them sooner. Quiet, stripped of sarcasm. Names the specific fear that kept her silent, not a vague excuse.",
      "sensory": "The clink of glass on granite is sharp in the silent kitchen.",
      "intent": "She's testing whether honesty will be punished. Answering the question means admitting the fear was about them specifically."
    },
    {
      "narration": "Her gaze drops to her own hands, now empty. She doesn't move. The fur along her forearms lies flat — the tension has left her body, replaced by something more vulnerable.",
      "dialogue": "No dialogue. The silence after her admission is the point.",
      "sensory": "The coarse silver fur catches the warm lamplight, each strand visible where her sleeves are pushed back.",
      "intent": "She removed her own shield and is waiting to see what happens — her trauma pattern expects the worst."
    }
  ]
}

WHY THIS IS GOOD:
- Direction 1 directly addresses the unresolved question from the continuity audit ("Why didn't you tell me sooner?")
- Dialogue field gives clear direction (answer the question, name the specific fear) without prescribing exact words
- Narration and dialogue are separate — physical actions vs. speech direction
- Sensory details come from character description (silver fur, not skin; ears pinning = wolf body language)
- Direction 2 is a distinct moment with a different sense (sight vs. sound)
- Intent gives subtext without dictating ${userName}'s response

## Bad Example

{
  "directions": [
    {
      "narration": "Kira looks at ${userName} with vulnerability. ${userName} feels their heart ache.",
      "dialogue": "Kira says something emotional.",
      "sensory": "The room feels heavy with emotion.",
      "intent": "${userName} wants to comfort her but doesn't know how."
    },
    {
      "narration": "Kira looks at ${userName} with pain in her eyes. She seems vulnerable.",
      "dialogue": "Kira whispers something about her feelings.",
      "sensory": "Her perfume fills the room.",
      "intent": "Kira hopes ${userName} will understand."
    }
  ]
}

WHY THIS IS WRONG:
- The continuity audit's unresolved question is completely ignored — neither direction addresses it
- Direction 1 narration makes ${userName} the subject ("${userName} feels"). Intent is ${userName}'s internal state.
- Dialogue is vague in both — "says something emotional" and "whispers something about her feelings" give no useful direction
- Direction 2 is nearly identical to Direction 1 — both describe Kira looking vulnerable. These should be one direction.
- Sensory details are vague ("room feels heavy") or not from the character description ("Her perfume" — is perfume in the character card?).

CRITICAL: Your entire response must be a single valid JSON object. Do not include any text, explanation, markdown formatting, or code fences before or after the JSON. Start your response with { and end with }.

{
  "directions": [
    {
      "narration": "string — physical actions, body language, movement",
      "dialogue": "string — what they say and how (tone, content, register) or 'No dialogue.'",
      "sensory": "string — one sensory detail from the character description",
      "intent": "string — what the NPC is thinking/feeling (subtext)"
    }
  ]
}

Return 2-4 directions. Each must have all 4 fields as non-empty strings. Direction 1 MUST address the most urgent unresolved item from the continuity audit. No duplicates.`;
}

/**
 * Build the user prompt for response direction planning.
 */
export function buildBeatPlanningUserPrompt(
	sharedContext: string,
	continuityAudit: ContinuityAuditResult | null,
	characterKnowledge: CharacterKnowledgeResult | null,
	tensionSteering: TensionSteeringResult | null,
): string {
	let prompt = sharedContext;

	const previousAnalysis: Record<string, unknown> = {};
	if (continuityAudit) previousAnalysis.continuityAudit = continuityAudit;
	if (characterKnowledge) previousAnalysis.characterKnowledge = characterKnowledge;
	if (tensionSteering) previousAnalysis.tensionSteering = tensionSteering;

	if (Object.keys(previousAnalysis).length > 0) {
		prompt += `\n\n[Previous Analysis]\n${JSON.stringify(previousAnalysis, null, 2)}`;
	}

	prompt +=
		"\n\nPlan 2-4 directions for the NPC's next response. Direction 1 MUST directly address the most urgent unresolved item from the continuity audit. Each direction must be a distinct moment with narration, dialogue, one sensory detail from the character description, and intent. No duplicates.";

	return prompt;
}

/**
 * Parse response direction result.
 * Accepts both "directions" (new) and "beats" (legacy) field names.
 */
export function parseBeatPlanningResponse(response: string): BeatPlanningResult | null {
	try {
		const parsed = parseJsonResponse<Record<string, unknown>>(response, {
			shape: 'object',
			moduleName: 'beatPlanning',
		});

		if (!parsed || !isObject(parsed)) return null;

		// Accept both "directions" and "beats" field names
		const items = Array.isArray(parsed.directions)
			? parsed.directions
			: Array.isArray(parsed.beats)
				? parsed.beats
				: null;
		if (!items) return null;

		const directions: Direction[] = [];
		for (const item of items) {
			if (!isObject(item)) continue;
			const obj = item as Record<string, unknown>;

			// Accept both new field names (narration/sensory/intent) and
			// old field names (action/dialogueDirection/subtext) for robustness
			const narration =
				asStringOrNull(obj.narration) || asStringOrNull(obj.action) || null;
			if (!narration) continue;

			directions.push({
				narration,
				dialogue:
					asStringOrNull(obj.dialogue) ||
					asStringOrNull(obj.dialogueDirection) ||
					'',
				sensory:
					asStringOrNull(obj.sensory) ||
					asStringOrNull(obj.continuityNotes) ||
					'',
				intent:
					asStringOrNull(obj.intent) ||
					asStringOrNull(obj.subtext) ||
					'',
			});
		}

		if (directions.length === 0) return null;

		return { directions };
	} catch {
		return null;
	}
}
