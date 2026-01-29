/**
 * Wants Change Event Prompt
 *
 * Extracts changes in what one character wants from/regarding another character.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedWantsChange } from '../../types/extraction';
import { wantsChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Romantic Desires Emerging (Bidirectional)
INPUT:
"""
CURRENT RELATIONSHIP:
Status: acquaintances
Elena toward Marcus: wants: professional collaboration, access to his contacts
Marcus toward Elena: wants: her trust, to work closely with her
---
Marcus: *The moonlight catches his profile as they stand on the balcony, the party forgotten inside. He turns to her, and there's something in his eyes she hasn't seen before - vulnerability, maybe, or longing.* "Elena, I need to tell you something. These past few months working together..." *He trails off, searching for words.*

Elena: *Her heart stutters. She's spent so long convincing herself this was just business, just a partnership of convenience. But standing here, close enough to touch, she can't remember why she ever believed that.* "Marcus..."

Marcus: *He reaches out, his fingers brushing her cheek with impossible gentleness.* "I know this complicates everything. But I can't pretend anymore."
"""
OUTPUT:
{
  "reasoning": "Elena's wants are shifting from purely professional to romantic. The scene shows her 'heart stuttering' and questioning why she thought this was 'just business.' Her professional wants remain, but new romantic desires are emerging. Marcus has just confessed his feelings - he's achieved the closeness he wanted, and now his wants shift to hoping she reciprocates, wanting her romantic interest.",
  "changes": [
    {
      "fromCharacter": "Elena",
      "towardCharacter": "Marcus",
      "added": ["romantic connection", "emotional intimacy"],
      "removed": []
    },
    {
      "fromCharacter": "Marcus",
      "towardCharacter": "Elena",
      "added": ["her romantic interest", "to know if she feels the same"],
      "removed": []
    }
  ]
}

### Example 2: Desire for Revenge Replacing Love
INPUT:
"""
CURRENT RELATIONSHIP:
James toward Victoria: wants: to grow old together, her happiness, a family with her
---
Victoria: *She doesn't even look guilty as James stands in the doorway. The other man scrambles for clothes while Victoria pulls the sheet up, her expression bored.* "You're home early."

James: *The world tilts. Fifteen years of marriage, and she looks at him like an inconvenience.* "How long?"

Victoria: "Does it matter? We both know this marriage has been over for years."
"""
OUTPUT:
{
  "reasoning": "James's romantic wants have been catastrophically destroyed. Discovering his wife's affair with complete indifference eliminates his desires for growing old together, her happiness, and family. These loving wants are being replaced by darker desires - to hurt her as she's hurt him, to make her feel something. His entire vision of their future has shattered.",
  "fromCharacter": "James",
  "towardCharacter": "Victoria",
  "added": ["to make her feel the pain she's caused", "answers about the affair"],
  "removed": ["to grow old together", "her happiness", "a family with her"]
}

### Example 3: Desires Fulfilled and New Ones Emerging
INPUT:
"""
CURRENT RELATIONSHIP:
Sophie toward her mother: wants: an apology, acknowledgment of the past, explanation for her absence
---
Mother: *She takes Sophie's hands, tears streaming.* "I'm so sorry. I was sick - not just my body, my mind. I couldn't be a mother when I could barely be a person. I thought you'd be better without someone so broken." *Her voice cracks.* "I've regretted leaving every single day."

Sophie: *The words she's waited fifteen years to hear. But now that she has them, she doesn't feel the relief she expected - just a hollow ache and new questions.* "Why didn't you tell me? Why let me think I wasn't enough?"
"""
OUTPUT:
{
  "reasoning": "Sophie's initial wants are being addressed - her mother is apologizing, acknowledging the past, and explaining her absence. These wants are being fulfilled/removed. But new wants are emerging from this conversation: understanding the full truth, knowing why her mother chose silence over honesty, possibly rebuilding a relationship now that she understands better.",
  "fromCharacter": "Sophie",
  "towardCharacter": "her mother",
  "added": ["to understand the full truth", "possibly to rebuild their relationship"],
  "removed": ["an apology", "acknowledgment of the past", "explanation for her absence"]
}

### Example 4: Professional Wants Shifting
INPUT:
"""
CURRENT RELATIONSHIP:
Dr. Chen toward Dr. Okonkwo: wants: to maintain his reputation, to discredit her unconventional methods
---
Dr. Okonkwo: *She completes the sixteen-hour surgery flawlessly - the tumor three other surgeons said was inoperable. The patient will live.*

Dr. Chen: *Watching from the gallery, awed despite himself. This isn't recklessness. This is mastery.* "Remarkable."
"""
OUTPUT:
{
  "reasoning": "Dr. Chen's wants are fundamentally shifting. Witnessing Dr. Okonkwo's extraordinary surgical skill has changed his perspective - he no longer wants to discredit her because he's seen her methods work brilliantly. His competitive desire to maintain his reputation remains, but now he also wants to learn from her. His adversarial wants are giving way to collaborative ones.",
  "fromCharacter": "Dr. Chen",
  "towardCharacter": "Dr. Okonkwo",
  "added": ["to learn from her techniques", "professional collaboration"],
  "removed": ["to discredit her unconventional methods"]
}

### Example 5: Combining Similar Wants - Intense Emotional Scene
INPUT:
"""
CURRENT RELATIONSHIP:
Mira toward King Aldric: wants: to survive, to protect her brother
---
King Aldric: *He gestures lazily, and guards drag Mira's brother forward. Without warning, he draws his dagger and slashes Thomas's face.* "Let this motivate your next attempt. Bring me what I want, or I'll take his eyes next."

Mira: *Horror and fury war inside her as Thomas's blood drips onto the marble floor. She wants to kill Aldric, to tear him apart, to make him suffer as Thomas suffers. She wants vengeance, retribution, justice. She wants to destroy him, to watch him burn, to escape this nightmare and take Thomas far away where no one can hurt him ever again.*
"""
OUTPUT:
{
  "reasoning": "Mira experiences intense, overlapping desires for revenge. Rather than listing every variant (vengeance, retribution, justice, destroy him, watch him burn - all essentially 'revenge'), I combine into distinct wants. Her desire to protect her brother intensifies but doesn't need to be re-added. Keep arrays focused on distinct, meaningful desires.",
  "fromCharacter": "Mira",
  "towardCharacter": "King Aldric",
  "added": ["revenge for what he did to Thomas", "to escape his control entirely"],
  "removed": []
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Over-Listing Similar Wants Instead of Combining
INPUT:
"""
CURRENT RELATIONSHIP:
Mira toward King Aldric: wants: to survive
---
King Aldric: *Mutilates her brother in front of her.*
Mira: *Fury consumes her. She wants revenge, vengeance, retribution, justice. She wants to kill him, destroy him, make him suffer, watch him burn, tear him apart, end his life.*
"""
WRONG OUTPUT:
{
  "reasoning": "Mira wants revenge.",
  "fromCharacter": "Mira",
  "towardCharacter": "King Aldric",
  "added": ["revenge", "vengeance", "retribution", "justice", "to kill him", "to destroy him", "to make him suffer", "to watch him burn", "to tear him apart", "to end his life"],
  "removed": []
}
WHY THIS IS WRONG: These are all synonyms for the same desire - revenge/to harm him. Pick 2-3 distinct terms that capture the essence (e.g., "revenge", "to make him suffer"). Keep arrays to 5-6 items maximum. Don't list every word the text uses.

### Bad Example 2: Removing Wants That Should Persist
INPUT:
"""
CURRENT RELATIONSHIP:
Elena toward Marcus: wants: professional success, his respect, to work together
---
Elena: *They argue about the project approach.*
Marcus: "Fine, we'll try it your way. But if it fails, it's on you."
Elena: "Deal."
"""
WRONG OUTPUT:
{
  "reasoning": "They had an argument.",
  "fromCharacter": "Elena",
  "towardCharacter": "Marcus",
  "added": ["to prove him wrong"],
  "removed": ["his respect", "to work together"]
}
WHY THIS IS WRONG: One professional disagreement doesn't remove desires for respect and collaboration. They're still working together - she got him to agree to her approach. "To prove him wrong" might be added, but removing the collaborative wants is an overreaction.

### Bad Example 3: Adding Wants Not Supported by Text
INPUT:
"""
CURRENT RELATIONSHIP:
Alex toward Sam: wants: friendship
---
Sam: "I got the job!"
Alex: "Congratulations! That's amazing news!"
"""
WRONG OUTPUT:
{
  "reasoning": "Alex is happy for Sam's job.",
  "fromCharacter": "Alex",
  "towardCharacter": "Sam",
  "added": ["to celebrate with Sam", "to help Sam succeed in new job", "to be Sam's best friend", "to always support Sam"],
  "removed": []
}
WHY THIS IS WRONG: Being happy for someone's news doesn't create four new wants. Celebration is temporary, not an ongoing desire. The output invents elaborate wants not evidenced in a simple congratulations.

### Bad Example 4: Adding Redundant Wants
INPUT:
"""
CURRENT RELATIONSHIP:
Wife toward Husband: wants: his love, his attention, quality time together
---
Husband: *Comes home with flowers.* "I know I've been working late. Let me make it up to you - dinner, just us?"
Wife: *Smiles.* "I'd like that."
"""
WRONG OUTPUT:
{
  "reasoning": "Wife wants to have dinner.",
  "fromCharacter": "Wife",
  "towardCharacter": "Husband",
  "added": ["dinner with him", "time with him", "his attention", "quality time", "to be prioritized"],
  "removed": []
}
WHY THIS IS WRONG: She already wants "quality time together" and "his attention" - the new additions are redundant. The dinner is an instance of existing wants, not a new category of desire. Don't add wants that overlap with existing ones.

### Bad Example 5: Not Removing Fulfilled Wants
INPUT:
"""
CURRENT RELATIONSHIP:
Daughter toward Father: wants: his blessing for the wedding, his approval of her fiance
---
Father: *Takes her hands.* "I've watched you with him. He makes you happy. You have my blessing, sweetheart."
Daughter: *Tears of joy.* "Thank you, Daddy."
"""
WRONG OUTPUT:
{
  "reasoning": "Father gave his blessing.",
  "fromCharacter": "Daughter",
  "towardCharacter": "Father",
  "added": [],
  "removed": []
}
WHY THIS IS WRONG: Her wants have been fulfilled - she explicitly wanted his blessing and approval, and he gave both. These should be removed from her wants (she has them now) and potentially replaced with new wants about their relationship going forward.
`;

export const wantsChangePrompt: PromptTemplate<ExtractedWantsChange> = {
	name: 'wants_change',
	description: 'Extract changes in what one character wants from/regarding another character',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.relationshipPair,
		PLACEHOLDERS.relationshipState,
		PLACEHOLDERS.relationshipProfiles,
	],

	systemPrompt: `You are analyzing roleplay messages to detect changes in what one character wants from or regarding another character.

## Your Task
Given the current relationship state and new messages, identify any wants/desires that have been added (newly emerged) or removed (fulfilled or abandoned) for the specified directional relationship.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what desire changes occurred and why for BOTH directions
- "changes": Array of changes for each direction (A toward B, and B toward A). Each change object has:
  - "fromCharacter": The character whose wants are changing
  - "towardCharacter": The character the wants are directed toward
  - "added": Array of new wants/desires that have emerged (empty if none)
  - "removed": Array of wants that have been fulfilled or abandoned (empty if none)

IMPORTANT: You must analyze BOTH directions of the relationship and include both in the changes array. If no changes occurred in a direction, include it with empty added/removed arrays.

## What Counts as Wants
Wants are desires, goals, and wishes one character has regarding another:
- Relationship goals: commitment, trust, intimacy, distance, reconciliation
- Emotional wants: their approval, their love, their respect, understanding
- Practical desires: their help, their resources, their cooperation
- Negative wants: revenge, to hurt them, to defeat them, their failure
- Protective wants: their safety, their happiness, their success

## When Wants Are Removed
Wants should be removed when:
- The want has been fulfilled/achieved
- The character has given up on that want
- The want has been explicitly abandoned or replaced
- Circumstances make the want impossible or irrelevant

## Key Guidelines
- Wants are DIRECTIONAL: Character A's wants regarding B are different from B's wants
- Be specific: "his approval" not "good things"
- Actions are not wants - "to have lunch" is temporary, "to spend time together" is ongoing
- Wants should be significant and lasting, not momentary reactions
- Don't add wants already in the relationship state
- Empty arrays are valid if no changes occurred

## Array Limits
- Each character should have a MAXIMUM of 5-6 total wants toward each other character
- If a character already has 5-6 wants toward someone, remove less relevant ones to make space for new ones
- Combine similar wants into one descriptive term - don't list synonyms
- "revenge" covers vengeance/retribution/to destroy them
- "romantic connection" covers intimacy/closeness/to be with them

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Profiles
{{relationshipProfiles}}

## Current Relationship State
{{relationshipState}}

## New Messages
{{messages}}

## Task
Analyze these messages for changes in wants/desires between {{relationshipPair}}.

For BOTH directions of the relationship, determine:
1. What new desires have emerged?
2. What wants have been fulfilled or abandoned?
3. Why did these changes occur?

Return your analysis as JSON with a "changes" array containing both directions.`,

	responseSchema: wantsChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedWantsChange | null {
		let parsed: Record<string, unknown>;
		try {
			const result = parseJsonResponse(response);
			if (!result || typeof result !== 'object' || Array.isArray(result))
				return null;
			parsed = result as Record<string, unknown>;
		} catch {
			return null;
		}

		// Validate required fields
		if (typeof parsed.reasoning !== 'string') return null;
		if (!Array.isArray(parsed.changes)) return null;

		// Validate each change in the array
		for (const change of parsed.changes) {
			if (typeof change !== 'object' || change === null) return null;
			const c = change as Record<string, unknown>;
			if (typeof c.fromCharacter !== 'string') return null;
			if (typeof c.towardCharacter !== 'string') return null;
			if (!Array.isArray(c.added)) return null;
			if (!Array.isArray(c.removed)) return null;
			if (!c.added.every((item: unknown) => typeof item === 'string'))
				return null;
			if (!c.removed.every((item: unknown) => typeof item === 'string'))
				return null;
		}

		return parsed as unknown as ExtractedWantsChange;
	},
};
