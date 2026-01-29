/**
 * Secrets Change Event Prompt
 *
 * Extracts changes in secrets one character holds regarding another character.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedSecretsChange } from '../../types/extraction';
import { secretsChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Discovering Someone's Secret Identity
INPUT:
"""
CURRENT RELATIONSHIP:
Status: friendly
Elena toward Marcus: secrets: none
Marcus toward Elena: secrets: none
---
Marcus: *He doesn't know she followed him. Elena watches from the shadows as Marcus approaches the homeless man - except the man rises, perfectly healthy, and hands Marcus an envelope.* "The senator's meeting is Tuesday. The guards change shift at 8:45."

Elena: *She presses herself against the cold brick, heart hammering. Marcus takes the envelope without a word, then pulls out a badge she recognizes instantly - the emblem of the Royal Intelligence Service. Her coworker. Her friend. He's a spy.*
"""
OUTPUT:
{
  "reasoning": "Elena has discovered that Marcus is secretly a spy for the Royal Intelligence Service. She witnessed him meeting a contact and showing an RIS badge. These are major secrets she now holds about him that he doesn't know she knows. Marcus didn't learn anything new about Elena - he doesn't even know she was there.",
  "changes": [
    {
      "fromCharacter": "Elena",
      "towardCharacter": "Marcus",
      "added": ["knows he's a Royal Intelligence Service spy", "witnessed his secret meeting with a contact"],
      "removed": []
    },
    {
      "fromCharacter": "Marcus",
      "towardCharacter": "Elena",
      "added": [],
      "removed": []
    }
  ]
}

### Example 2: Secret Revealed and No Longer Secret
INPUT:
"""
CURRENT RELATIONSHIP:
James toward Victoria: secrets: knows she's been lying about her whereabouts, suspects she's having an affair
---
James: *He sets the photos on the table.* "I know you haven't been at Sarah's house on Thursdays."

Victoria: *Her face hardens.* "Fine. Yes, I've been seeing someone. His name is David."
"""
OUTPUT:
{
  "reasoning": "James's secret knowledge has been revealed - he confronted her and she confirmed. The secrets he was holding are no longer secrets because they're now openly discussed between them.",
  "fromCharacter": "James",
  "towardCharacter": "Victoria",
  "added": [],
  "removed": ["knows she's been lying about her whereabouts", "suspects she's having an affair"]
}

### Example 3: Learning Family Secret
INPUT:
"""
CURRENT RELATIONSHIP:
Sophie toward her mother: secrets: none
---
Sophie: *She opens a box from the attic and finds photographs - her mother holding a baby that isn't Sophie. A birth certificate for "Thomas Michael." A newspaper clipping about a car accident.*

Mother: *She sinks into a chair.* "He was three. You weren't born yet. I couldn't talk about him."
"""
OUTPUT:
{
  "reasoning": "Sophie has discovered that she had an older brother who died before she was born - a family secret her mother kept for decades. She found physical evidence: photos, a birth certificate, and accident clipping.",
  "fromCharacter": "Sophie",
  "towardCharacter": "her mother",
  "added": ["discovered she had a brother named Thomas Michael who died at age three", "knows her mother hid this family tragedy for decades"],
  "removed": []
}

### Example 4: Overhearing Damaging Information
INPUT:
"""
CURRENT RELATIONSHIP:
Assistant toward CEO: secrets: none
---
CEO: *On the phone, unaware his assistant is nearby.* "I don't care what the environmental report says. We bury it. The shareholders don't need to know about the contamination. I have three senators who owe me favors. Make sure those documents never see daylight."
"""
OUTPUT:
{
  "reasoning": "The assistant has accidentally overheard the CEO planning to hide environmental contamination, bribe politicians, and deceive shareholders. This is explosive information they now possess without the CEO's knowledge.",
  "fromCharacter": "Assistant",
  "towardCharacter": "CEO",
  "added": ["overheard plans to hide environmental contamination", "knows about bribery of senators", "has evidence of shareholder deception"],
  "removed": []
}

### Example 5: Discovering Hidden Feelings Through Diary
INPUT:
"""
CURRENT RELATIONSHIP:
Marcus toward Elena: secrets: none
---
Marcus: *He hadn't meant to read her journal - it fell open when he moved her bag to clean the table. But his own name catches his eye, and he can't look away.*

Journal entry: "I don't know how much longer I can pretend. Every time Marcus looks at me with those oblivious eyes, my heart breaks a little more. Three years of loving him in silence. Three years of being the 'best friend' when I want so much more."
"""
OUTPUT:
{
  "reasoning": "Marcus has accidentally discovered Elena's secret romantic feelings for him by reading her journal. He now knows she's been in love with him for three years and has been hiding it while playing the role of 'best friend.' This is deeply personal knowledge she never intended him to have.",
  "fromCharacter": "Marcus",
  "towardCharacter": "Elena",
  "added": ["discovered she's been secretly in love with him for three years", "knows she's been hiding romantic feelings while pretending to be just a friend"],
  "removed": []
}

### Example 6: Confession Removing the Secret
INPUT:
"""
CURRENT RELATIONSHIP:
Lily toward Jake: secrets: has been secretly applying to grad schools out of state, plans to leave after graduation
---
Lily: *She takes a deep breath.* "Jake, I need to tell you something. I've been applying to grad schools - in California, in New York. I might be leaving after graduation."

Jake: *His face goes still.* "How long have you known?"

Lily: "A few months. I'm sorry I didn't tell you sooner."
"""
OUTPUT:
{
  "reasoning": "Lily has confessed her secret plans to Jake - the grad school applications and potential move are no longer hidden. Since she's told him directly, these are no longer secrets she's keeping from him.",
  "fromCharacter": "Lily",
  "towardCharacter": "Jake",
  "added": [],
  "removed": ["has been secretly applying to grad schools out of state", "plans to leave after graduation"]
}

### Example 7: Witnessing Betrayal
INPUT:
"""
CURRENT RELATIONSHIP:
Sarah toward her business partner Tom: secrets: none
---
Sarah: *She arrives at the office early, sees light under the conference room door. Through the crack, she watches Tom shake hands with their biggest competitor.*

Competitor: "When you transfer the client list, we'll have your signing bonus ready."

Tom: "Make sure it's the offshore account. Sarah doesn't suspect a thing."
"""
OUTPUT:
{
  "reasoning": "Sarah has witnessed Tom's betrayal - he's selling their client list to a competitor and specifically hiding it from her. She now has knowledge of his treachery that he believes is completely hidden.",
  "fromCharacter": "Sarah",
  "towardCharacter": "Tom",
  "added": ["witnessed him selling client list to competitor", "knows about his secret offshore account", "knows he's actively deceiving her"],
  "removed": []
}

### Example 8: Learning Medical Secret
INPUT:
"""
CURRENT RELATIONSHIP:
Wife toward Husband: secrets: none
---
Wife: *She finds the prescription bottle in his coat pocket while looking for her phone. The label reads his name, followed by medication she recognizes. Her mother took the same pills for her heart condition. Stage 3.*

Husband: *He comes in smiling.* "Ready for dinner? I made reservations at that place you like."
"""
OUTPUT:
{
  "reasoning": "The wife has discovered her husband is taking heart medication consistent with a serious condition - one he's clearly kept from her. She's holding this knowledge while he acts normally, unaware she found the pills.",
  "fromCharacter": "Wife",
  "towardCharacter": "Husband",
  "added": ["found his heart medication", "knows he's hiding a serious medical condition"],
  "removed": []
}

### Example 9: Secret Shared Willingly Becomes Known
INPUT:
"""
CURRENT RELATIONSHIP:
Detective toward informant: secrets: suspects informant is playing both sides
---
Informant: *He slides into the booth, looking over his shoulder.* "I need to come clean. I've been feeding info to the cartel too. They have my daughter. I had no choice."

Detective: *Her eyes narrow.* "You've been a double agent this whole time?"

Informant: "I'm telling you now because they're moving her tomorrow. Help me get her back and I'll give you everything."
"""
OUTPUT:
{
  "reasoning": "The informant has confessed to being a double agent - the detective's suspicion is now confirmed and openly known between them. This is no longer secret knowledge she holds, but acknowledged fact. However, she's gained new information about his daughter being held hostage.",
  "fromCharacter": "Detective",
  "towardCharacter": "informant",
  "added": ["knows his daughter is being held hostage by the cartel"],
  "removed": ["suspects informant is playing both sides"]
}

### Example 10: Discovering Financial Deception
INPUT:
"""
CURRENT RELATIONSHIP:
Daughter toward Father: secrets: none
---
Father: *At the restaurant, his card is declined. He fumbles for another, face reddening.*

Daughter: *Later, using his computer to order him a gift, she sees the browser history. Gambling sites. Payday loans. A foreclosure notice on the house she grew up in.*
"""
OUTPUT:
{
  "reasoning": "The daughter has stumbled upon evidence of her father's financial crisis - gambling addiction, predatory loans, and impending foreclosure. She's discovered he's in deep trouble while maintaining a facade of normalcy.",
  "fromCharacter": "Daughter",
  "towardCharacter": "Father",
  "added": ["discovered his gambling addiction", "knows about his payday loans", "found foreclosure notice on family home", "realizes he's been hiding financial crisis"],
  "removed": []
}

### Example 11: Learning Criminal Past
INPUT:
"""
CURRENT RELATIONSHIP:
Girlfriend toward Boyfriend: secrets: none
---
Girlfriend: *The old newspaper clipping falls out of his yearbook. 'Local Teen Acquitted in Vehicular Manslaughter Case.' The photo is unmistakably Marcus, fifteen years younger, hollow-eyed. The article mentions alcohol. A dead pedestrian.*

Marcus: *From downstairs.* "Babe? You find that photo album?"
"""
OUTPUT:
{
  "reasoning": "The girlfriend has discovered Marcus was involved in a vehicular manslaughter case when he was young - acquitted but clearly traumatic. He's never mentioned any of this. She now holds knowledge of a dark chapter in his past that he's kept hidden.",
  "fromCharacter": "Girlfriend",
  "towardCharacter": "Marcus",
  "added": ["found newspaper clipping about his vehicular manslaughter case", "knows he was acquitted of killing a pedestrian", "discovered he was involved in a drunk driving incident as a teen"],
  "removed": []
}

### Example 12: Intelligence Through Third Party
INPUT:
"""
CURRENT RELATIONSHIP:
Queen toward her Advisor: secrets: suspects he has hidden loyalties
---
Servant: *Bowing low.* "Your Majesty, I've seen what you asked me to watch for. The Lord Advisor meets a hooded figure in the gardens each new moon. Last night I followed - the figure bore the sigil of House Blackwood, your sworn enemies."

Queen: *Her expression remains serene, but her knuckles whiten on the armrest.* "You've done well. Speak of this to no one."
"""
OUTPUT:
{
  "reasoning": "The queen's suspicions about her advisor are now confirmed through intelligence gathering. She's learned he has been meeting with representatives of her enemies. Her 'suspects hidden loyalties' becomes concrete knowledge of treasonous contact.",
  "fromCharacter": "Queen",
  "towardCharacter": "her Advisor",
  "added": ["knows he meets secretly with House Blackwood agents", "has confirmed evidence of his treasonous contacts"],
  "removed": ["suspects he has hidden loyalties"]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Confusing Public Knowledge with Secrets
INPUT:
"""
CURRENT RELATIONSHIP:
John toward Mary: secrets: none
---
Mary: *At the party.* "Everyone, I have an announcement! John and I are engaged!"
John: *Smiling.* "I asked her last night."
"""
WRONG OUTPUT:
{
  "reasoning": "John knows they're engaged.",
  "fromCharacter": "John",
  "towardCharacter": "Mary",
  "added": ["knows about the engagement"],
  "removed": []
}
WHY THIS IS WRONG: This is public knowledge, not a secret. Secrets are things one character knows about another that are hidden or private. An engagement announced at a party is the opposite of secret.

### Bad Example 2: Adding Already-Established Secrets
INPUT:
"""
CURRENT RELATIONSHIP:
Elena toward Marcus: secrets: knows he has a criminal record
---
Elena: *They're having coffee.*
Marcus: "I was thinking about that trip we planned."
Elena: "Sounds good. When should we leave?"
"""
WRONG OUTPUT:
{
  "reasoning": "Elena still knows about his criminal record.",
  "fromCharacter": "Elena",
  "towardCharacter": "Marcus",
  "added": ["knows he has a criminal record"],
  "removed": []
}
WHY THIS IS WRONG: She already knew this. Nothing in the scene changes or adds to her secret knowledge. Adding existing secrets is redundant. The correct output would have empty added/removed arrays.

### Bad Example 3: Wrong Direction of Secret
INPUT:
"""
CURRENT RELATIONSHIP:
Sarah toward Tom: secrets: none
---
Sarah: *She writes in her diary.* "I've been skimming money from the company account. Tom has no idea."
"""
WRONG OUTPUT:
{
  "reasoning": "Tom doesn't know Sarah is stealing.",
  "fromCharacter": "Tom",
  "towardCharacter": "Sarah",
  "added": ["doesn't know she's stealing"],
  "removed": []
}
WHY THIS IS WRONG: The direction is reversed. The question is what secrets SARAH holds about TOM, not what Tom doesn't know. "Doesn't know" is also not a secret - it's an absence of knowledge. The correct output would be no changes since Sarah didn't learn anything new about Tom.

### Bad Example 4: Treating General Information as Relationship Secret
INPUT:
"""
CURRENT RELATIONSHIP:
Detective toward suspect: secrets: none
---
Detective: *Reviews case files.* The suspect's fingerprints match those found at two other crime scenes in the district.
"""
WRONG OUTPUT:
{
  "reasoning": "Detective learned about the fingerprints.",
  "fromCharacter": "Detective",
  "towardCharacter": "suspect",
  "added": ["knows his fingerprints were at crime scenes"],
  "removed": []
}
WHY THIS IS WRONG: This is case evidence, not a personal secret about the suspect. Secrets in this context are hidden personal information - affairs, hidden identities, concealed motivations. Police evidence from official files doesn't fit this category.

### Bad Example 5: Not Removing Revealed Secrets
INPUT:
"""
CURRENT RELATIONSHIP:
Wife toward Husband: secrets: knows he's been gambling, found loan shark threats
---
Wife: "I found the letters from the loan sharks. I know about the gambling, Mike."
Husband: "I can explain—"
Wife: "Don't. We need to talk about how to fix this."
"""
WRONG OUTPUT:
{
  "reasoning": "Wife confronts husband about gambling.",
  "fromCharacter": "Wife",
  "towardCharacter": "Husband",
  "added": [],
  "removed": []
}
WHY THIS IS WRONG: When a secret is openly revealed and discussed, it's no longer a secret. The wife has confronted him - he knows she knows. The removed array should include "knows he's been gambling, found loan shark threats" because this information is now openly acknowledged.

### Bad Example 6: Vague or Useless Secret Descriptions
INPUT:
"""
CURRENT RELATIONSHIP:
Alex toward Jordan: secrets: none
---
Alex: *Overhears Jordan on the phone.* "Yes, I'm at the location. The package is secure. Extraction at midnight."
"""
WRONG OUTPUT:
{
  "reasoning": "Alex heard something suspicious.",
  "fromCharacter": "Alex",
  "towardCharacter": "Jordan",
  "added": ["knows something", "heard something suspicious"],
  "removed": []
}
WHY THIS IS WRONG: "Knows something" and "heard something suspicious" are useless vague descriptions. Be specific: "overheard coded conversation about a package and extraction" or similar. Secrets should be specific enough to be meaningful.

### Bad Example 7: Treating Character Thoughts as Discovered Secrets
INPUT:
"""
CURRENT RELATIONSHIP:
Marcus toward Elena: secrets: none
---
Marcus: *He watches Elena work, thinking about how talented she is. She doesn't know he nominated her for the promotion.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena doesn't know Marcus nominated her.",
  "fromCharacter": "Elena",
  "towardCharacter": "Marcus",
  "added": ["doesn't know he nominated her"],
  "removed": []
}
WHY THIS IS WRONG: The prompt is asking about Marcus's secrets regarding Elena, not Elena's secrets. Also, "doesn't know" isn't a secret - it's a lack of knowledge. Additionally, we can't add secrets based on what the text says a character is thinking unless another character discovers those thoughts.

### Bad Example 8: Inferring Secrets Not in the Text
INPUT:
"""
CURRENT RELATIONSHIP:
Sarah toward her sister: secrets: none
---
Sister: "I'll be late to dinner tonight."
Sarah: "Okay, see you then."
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah might suspect her sister is hiding something.",
  "fromCharacter": "Sarah",
  "towardCharacter": "her sister",
  "added": ["suspects she's hiding something"],
  "removed": []
}
WHY THIS IS WRONG: Nothing in the text suggests Sarah suspects anything. Being late to dinner is completely normal. The output invents a suspicion that has no basis in the provided text.

### Bad Example 9: Listing Same Secret Multiple Ways
INPUT:
"""
CURRENT RELATIONSHIP:
Tom toward his boss: secrets: none
---
Tom: *Sees his boss's email open.* The message shows plans to lay off the entire department in two weeks.
"""
WRONG OUTPUT:
{
  "reasoning": "Tom saw the layoff email.",
  "fromCharacter": "Tom",
  "towardCharacter": "his boss",
  "added": ["saw the layoff email", "knows about upcoming layoffs", "discovered termination plans", "learned department is being eliminated", "found out about job cuts"],
  "removed": []
}
WHY THIS IS WRONG: These are all the same piece of information phrased five different ways. Pick one clear, specific description: "discovered plans to lay off the entire department in two weeks."

### Bad Example 10: Mixing Up Who Holds the Secret
INPUT:
"""
CURRENT RELATIONSHIP:
Detective toward criminal: secrets: none
---
Criminal: *In interrogation, he accidentally mentions a warehouse address the police don't know about.*
Detective: *Makes a mental note of the address.*
"""
WRONG OUTPUT:
{
  "reasoning": "The criminal revealed the warehouse.",
  "fromCharacter": "criminal",
  "towardCharacter": "Detective",
  "added": ["accidentally revealed the warehouse location"],
  "removed": []
}
WHY THIS IS WRONG: The direction is backwards. The detective now holds secret knowledge about the criminal (knows a warehouse address connected to him), not the criminal holding a secret about the detective. fromCharacter should be Detective, towardCharacter should be criminal.

### Bad Example 11: Not Recognizing Partial Reveals
INPUT:
"""
CURRENT RELATIONSHIP:
Maria toward Carlos: secrets: knows he's an undercover cop, knows his real identity
---
Maria: "I know you're a cop, Carlos. Or should I say... Officer?"
Carlos: *Freezes.* "How long have you known?"
Maria: "Long enough."
"""
WRONG OUTPUT:
{
  "reasoning": "Maria revealed she knows he's a cop.",
  "fromCharacter": "Maria",
  "towardCharacter": "Carlos",
  "added": [],
  "removed": ["knows he's an undercover cop", "knows his real identity"]
}
WHY THIS IS WRONG: She only revealed that she knows he's a cop - she didn't reveal that she knows his real identity. The "real identity" secret could still be held. Only remove the specific secret that was revealed.

### Bad Example 12: Treating Character Observations as Secrets
INPUT:
"""
CURRENT RELATIONSHIP:
Emma toward Jack: secrets: none
---
Emma: *She notices Jack looks tired today, dark circles under his eyes.*
"""
WRONG OUTPUT:
{
  "reasoning": "Emma noticed Jack looks tired.",
  "fromCharacter": "Emma",
  "towardCharacter": "Jack",
  "added": ["noticed he looks tired", "saw dark circles under his eyes"],
  "removed": []
}
WHY THIS IS WRONG: Observable facts like someone looking tired aren't secrets. Secrets are hidden information - things a character wouldn't want others to know or that aren't publicly apparent. Dark circles are visible to anyone.
`;

export const secretsChangePrompt: PromptTemplate<ExtractedSecretsChange> = {
	name: 'secrets_change',
	description: 'Extract changes in secrets one character holds regarding another character',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.relationshipPair,
		PLACEHOLDERS.relationshipState,
		PLACEHOLDERS.relationshipProfiles,
	],

	systemPrompt: `You are analyzing roleplay messages to detect changes in secrets one character holds about another.

## Your Task
Given the current relationship state and new messages, identify any secrets that have been added (newly discovered) or removed (revealed/no longer secret) for the specified directional relationship.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what secret information was discovered or revealed for BOTH directions
- "changes": Array of changes for each direction (A toward B, and B toward A). Each change object has:
  - "fromCharacter": The character who holds (or held) the secret
  - "towardCharacter": The character the secret is about
  - "added": Array of newly discovered secrets (empty if none)
  - "removed": Array of secrets that are no longer hidden (empty if none)

IMPORTANT: You must analyze BOTH directions of the relationship and include both in the changes array. If no changes occurred in a direction, include it with empty added/removed arrays.

## What Counts as Secrets
Secrets are hidden knowledge one character possesses about another:
- Information discovered without the other's knowledge (overheard conversations, found documents, witnessed events)
- Knowledge the other person is actively hiding (affairs, crimes, secret identities)
- Private information not yet shared (feelings, plans, past events)
- Suspicions or evidence gathered covertly

## When Secrets Are Removed
Secrets should be removed when:
- The secret is openly revealed or confessed
- The other person learns that this character knows
- The information becomes public knowledge
- The secret is directly discussed between the characters

## Key Guidelines
- Secrets are DIRECTIONAL: Character A's secrets about B are different from B's secrets about A
- Be specific in descriptions - "knows about his affair" not "knows something"
- Observable facts (looks tired, seems sad) are NOT secrets
- Case evidence or public records are NOT personal secrets
- Don't add secrets that already exist in the relationship state
- Empty arrays are valid if no changes occurred

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
Analyze these messages for changes in secrets between {{relationshipPair}}.

For BOTH directions of the relationship, determine:
1. What new hidden information was discovered?
2. What secrets were revealed and are no longer hidden?
3. Why these changes occurred?

Return your analysis as JSON with a "changes" array containing both directions.`,

	responseSchema: secretsChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedSecretsChange | null {
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

		return parsed as unknown as ExtractedSecretsChange;
	},
};
