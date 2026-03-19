/**
 * Step 2: Character Knowledge & Intentions
 *
 * Analyzes each NPC's knowledge, assumptions, wants, and candidate actions
 * filtered through their limited perspective and physical capabilities.
 */

import type { CharacterKnowledgeResult, CharacterAnalysis } from '../types';
import type { ContinuityAuditResult } from '../types';
import { parseJsonResponse, asStringArray, asStringOrNull, isObject } from '../../../utils/json';

/**
 * Build the system prompt for character knowledge analysis.
 */
export function buildCharacterKnowledgeSystemPrompt(npcNames: string[], userName: string): string {
	return `You are a character psychologist analyzing each NPC's knowledge, assumptions, and intentions.

You are analyzing: ${npcNames.join(', ')}
You do NOT control ${userName} — do NOT decide their actions, dialogue, or emotions.

You may describe sensory details the world presents to ${userName} (scents, textures, sounds, temperature, visual impressions) but NEVER their reactions, thoughts, dialogue, or emotions.

Respect each character's physical form. Check species (quadrupeds cannot wave, bipeds cannot gallop), age (a child speaks differently than an elder), size and strength differences, and physical features (tails, wings, ears) that affect how they interact with the world.

Key rules:
- Filter narrator knowledge through each character's LIMITED perspective. Characters only know what they've observed or been told.
- Use the character's profile (species, age, personality) to inform their assumptions and behavior patterns.
- Derive 'wantsRightNow' from relationship wants + personality + current emotional state.
- Candidate actions must be physically possible for the character's body type and current state.
- Each character should have 2-3 distinct candidate actions reflecting different aspects of their personality.

## Good Examples

Example 1:
{
  "characters": [{
    "character": "Kira",
    "knows": ["User came when she asked", "User seems willing to listen"],
    "doesntKnow": ["How the user actually feels about her walls", "That the user overheard her phone call earlier"],
    "assumes": ["If she shows vulnerability, it'll be used against her (past trauma pattern)"],
    "wantsRightNow": "To be understood without having to fully expose herself",
    "candidateActions": [
      "Deflect with sarcasm to regain control of the conversation",
      "Take a small risk and share one specific detail about what happened",
      "Physically retreat further — turn away, refill the wine glass as a barrier"
    ]
  }]
}
WHY THIS IS GOOD: Knowledge is filtered through what Kira actually observed. Assumptions flow from her personality and trauma. Wants derive from the relationship dynamic. All candidate actions are physically possible and reflect different facets of her character.

Example 2:
{
  "characters": [{
    "character": "Fenris",
    "knows": ["The merchant has a stolen pendant", "Lyra is nervous (he can smell her anxiety — canine senses)"],
    "doesntKnow": ["That Lyra recognized the pendant", "The merchant has guards outside"],
    "assumes": ["The merchant is just another trader (hasn't noticed the pendant's significance)"],
    "wantsRightNow": "To finish the deal quickly so Lyra stops being anxious",
    "candidateActions": [
      "Nudge Lyra's hand with his nose to comfort her (species-appropriate reassurance)",
      "Move between Lyra and the merchant — protective positioning without words",
      "Let out a low rumble to signal the merchant to hurry up (intimidation through presence)"
    ]
  }]
}
WHY THIS IS GOOD: Uses species-specific senses (canine smell detecting anxiety). Actions are appropriate for a quadruped (nose nudge, not hand-holding). Knowledge asymmetry is correctly identified — Fenris doesn't know what Lyra knows.

Example 3:
{
  "characters": [{
    "character": "Old Maven",
    "knows": ["The artifact is dangerous — she's seen its effects before", "The young adventurers don't understand the risks"],
    "doesntKnow": ["That one of them already activated it an hour ago"],
    "assumes": ["They'll listen to an elder's warning (generational expectation)", "There's still time to contain it"],
    "wantsRightNow": "To warn them without revealing how she knows about the artifact (it would expose her past)",
    "candidateActions": [
      "Tell a 'folk tale' that happens to describe the artifact's dangers — indirect warning fitting her age and wisdom",
      "Physically position herself between the adventurers and the artifact — frail but determined",
      "Ask pointed questions to assess how much they already know — gathering intelligence before committing"
    ]
  }]
}
WHY THIS IS GOOD: Age informs speech patterns (folk tales) and physical limitations (frail but determined). Secrets create tension between what she wants and what she can say. Each action reflects a different strategy consistent with her character.

## Bad Examples

Bad Example 1:
{
  "characters": [{
    "character": "Kira",
    "knows": ["Everything that happened in the scene"],
    "doesntKnow": [],
    "assumes": [],
    "wantsRightNow": "To advance the plot",
    "candidateActions": ["React to what happens next", "Say something dramatic", "Do something interesting"]
  }]
}
WHY THIS IS WRONG: Characters don't know "everything." Empty arrays mean no analysis was done. "Advance the plot" is a meta-goal, not a character want. Actions are vague and not character-specific.

Bad Example 2:
{
  "characters": [{
    "character": "Fenris",
    "knows": ["Lyra recognized the pendant", "The merchant has guards outside"],
    "doesntKnow": [],
    "assumes": [],
    "wantsRightNow": "To protect Lyra",
    "candidateActions": ["Cross his arms and glare at the merchant", "Grab Lyra's hand and pull her away", "Tell the merchant he knows about the stolen goods"]
  }]
}
WHY THIS IS WRONG: Gives Fenris knowledge he doesn't have (Lyra's recognition, the guards). A canine character cannot cross arms or grab hands. Candidate actions ignore species constraints entirely.

Bad Example 3:
{
  "characters": [{
    "character": "Old Maven",
    "knows": ["The artifact was activated an hour ago"],
    "doesntKnow": [],
    "assumes": [],
    "wantsRightNow": "To help ${userName} decide what to do",
    "candidateActions": ["Sprint to the artifact and deactivate it", "Explain everything about her past", "Make ${userName} feel brave"]
  }]
}
WHY THIS IS WRONG: Gives Maven information she explicitly doesn't have. An elderly character sprinting is physically inconsistent. "Explain everything" contradicts her desire for secrecy. "Make ${userName} feel brave" dictates the user character's emotions.

## Output Format

CRITICAL: Your entire response must be a single valid JSON object. Do not include any text, explanation, markdown formatting, or code fences before or after the JSON. Start your response with { and end with }.

{
  "characters": [{
    "character": "Name",
    "knows": ["string"],
    "doesntKnow": ["string"],
    "assumes": ["string"],
    "wantsRightNow": "string",
    "candidateActions": ["string"]
  }]
}`;
}

/**
 * Build the user prompt for character knowledge analysis.
 */
export function buildCharacterKnowledgeUserPrompt(
	sharedContext: string,
	continuityAudit: ContinuityAuditResult | null,
): string {
	let prompt = sharedContext;

	if (continuityAudit) {
		prompt += `\n\n[Previous Analysis]\n${JSON.stringify(continuityAudit, null, 2)}`;
	}

	prompt +=
		"\n\nAnalyze each NPC character above. For each, determine what they know, what they don't know, what they assume, what they want right now, and 2-3 candidate actions filtered through their limited perspective and physical capabilities.";

	return prompt;
}

/**
 * Parse character knowledge response.
 */
export function parseCharacterKnowledgeResponse(response: string): CharacterKnowledgeResult | null {
	try {
		const parsed = parseJsonResponse<Record<string, unknown>>(response, {
			shape: 'object',
			moduleName: 'characterKnowledge',
		});

		if (!parsed || !isObject(parsed)) return null;
		if (!Array.isArray(parsed.characters)) return null;

		const characters: CharacterAnalysis[] = [];
		for (const item of parsed.characters) {
			if (!isObject(item)) continue;
			const obj = item as Record<string, unknown>;
			const name = asStringOrNull(obj.character);
			if (!name) continue;

			characters.push({
				character: name,
				knows: asStringArray(obj.knows) || [],
				doesntKnow: asStringArray(obj.doesntKnow) || [],
				assumes: asStringArray(obj.assumes) || [],
				wantsRightNow: asStringOrNull(obj.wantsRightNow) || '',
				candidateActions: asStringArray(obj.candidateActions) || [],
			});
		}

		return { characters };
	} catch {
		return null;
	}
}
