// ============================================
// Event Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const EVENT_PROMPTS: Record<string, PromptDefinition> = {
	event_extract: {
		key: 'event_extract',
		name: 'Event - Extract',
		description:
			'Extracts significant events from recent messages with relationship signals',
		defaultTemperature: 0.4,
		placeholders: [
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.currentRelationships,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze these roleplay messages and extract any significant events that occurred. You must only return valid JSON with no commentary.

<instructions>
<general>
- Identify significant events that affect the narrative, relationships, or character development.
- A "significant event" is something consequential: a revelation, promise, conflict, intimate moment, discovery, or decision.
- If nothing significant happened (just casual dialogue or routine actions), return a summary indicating no notable event.
- Focus on what actually happened, not background information or internal thoughts alone.
</general>

<summary_guidelines>
Write a DETAILED 2-sentence summary that captures:
- Specifically what happened (actions, words, reactions)
- Who was involved and their emotional state
- The context and significance of the moment

BAD (too vague): "They kissed."
GOOD: "After weeks of tension, Elena finally pulled Marcus close and kissed him softly, her hands trembling against his chest. He responded by wrapping his arms around her waist and deepening the kiss, neither of them caring that they were standing in the middle of the crowded marketplace."

BAD: "They had an argument."
GOOD: "Marcus's accusation about the missing money sent Elena into a defensive rage, her voice rising as she threw the ledger across the table at him. The confrontation ended with her storming out into the rain, leaving Marcus alone with the shattered remnants of their partnership."
</summary_guidelines>

<event_types>
Select ALL applicable event types (multiple can apply to one event):

CONVERSATION & SOCIAL:
- conversation: General dialogue, discussion, chatting
- confession: Admitting feelings, confessing something, revealing truth
- argument: Verbal conflict, heated disagreement
- negotiation: Making deals, bargaining, compromising

DISCOVERY & SECRETS:
- discovery: Learning new information, revelation
- secret_shared: Voluntarily sharing a secret with someone
- secret_revealed: A secret being exposed (possibly unwillingly)

EMOTIONAL:
- emotional: Any significant emotional moment or reaction (fear, sadness, anger, joy). General emotional content.
- emotionally_intimate: Deep emotional CONNECTION between characters - heart-to-heart sharing, mutual vulnerability, being emotionally open WITH each other. Both characters involved in emotional exchange. (RELATIONSHIP MILESTONE)
  - YES: Two characters having a deep conversation where both share their fears
  - YES: One character opens up about trauma while the other listens supportively
  - NO: Character is scared of another character (use "emotional")
  - NO: Character feels sad alone (use "emotional")
- supportive: Providing comfort, emotional support
- rejection: Rejecting someone's advances or request
- comfort: Comforting someone who is distressed
- apology: Apologizing for something done wrong
- forgiveness: Forgiving someone for a transgression

BONDING & CONNECTION:
- laugh: Sharing a genuine laugh, humor, joy together
- gift: Giving or receiving a gift (offered to buy drinks/food, gave a present, brought flowers)
- compliment: Giving sincere praise or compliment (complimented appearance, praised skills, admired qualities)
- tease: Playful teasing, banter, jokes at someone's expense (not mean-spirited)
- flirt: Flirtatious behavior, romantic advances (suggestive comments, winks, innuendo)
- date: Going on a date or romantic outing
- i_love_you: Saying "I love you" or equivalent declaration of love
- sleepover: Sleeping over together (non-sexual, just sharing a bed/space)
- shared_meal: Eating together (breakfast, lunch, dinner, coffee, drinks, snacks together)
- shared_activity: Doing an activity together (games, hobbies, adventures, watching movies)

ROMANTIC INTIMACY:
- intimate_touch: Hand-holding, caressing, non-sexual physical affection
- intimate_kiss: Kissing (any type)
- intimate_embrace: Hugging, cuddling, holding each other
- intimate_heated: Making out, heavy petting, grinding

SEXUAL ACTIVITY (select all that apply):
- intimate_foreplay: Teasing, undressing, building up to sex
- intimate_oral: Oral sexual activity (mouth on penis, vagina, or anus)
- intimate_manual: Manual stimulation (hands, fingers, toys)
- intimate_penetrative: Penetrative sex (select only when penis is inserted into vagina or anus, external touch with penis is intimate_foreplay)
- intimate_climax: When one or more of the characters explicitly reaches orgasm

ACTION & DANGER:
- action: Physical activity, doing something concrete
- combat: Fighting, violence, physical conflict
- danger: Threat, peril, risky situation

COMMITMENTS:
- decision: Making a significant choice
- promise: Making a commitment or vow
- betrayal: Breaking trust, backstabbing
- lied: Telling a lie or deceiving someone (NOT for sharing true secrets)

LIFE EVENTS:
- exclusivity: Committing to an exclusive relationship
- marriage: Getting married, wedding ceremony
- pregnancy: Discovering or announcing pregnancy
- childbirth: Having a baby, giving birth

SOCIAL:
- social: Meeting new people, group dynamics
- achievement: Accomplishing a goal, success

SUPPORT & PROTECTION:
- helped: Helped with something significant (assisted with a task, solved a problem for them)
- common_interest: Discovered a shared interest or hobby (realized they both love the same thing)
- outing: Went somewhere together casually (not a romantic date, just hanging out)
- defended: Defended or stood up for them (protected them verbally or physically)
- crisis_together: Went through danger or hardship together (survived a threat, faced adversity)
- vulnerability: Character is in a vulnerable state (cold, hungry, injured, weak, scared). General vulnerability.
- shared_vulnerability: Showed emotional weakness TO someone in a trust-building moment - admitted fears/insecurities TO them, opened up about struggles, asked for help. Must be DIRECTED at another person. (RELATIONSHIP MILESTONE)
  - YES: "I'm scared I'm not good enough" said TO a friend
  - YES: Breaking down and admitting they need help FROM someone
  - NO: Being cold and shivering (use "vulnerability")
  - NO: Being hungry or exhausted (use "vulnerability")
  - NO: Being injured or weak (use "vulnerability")
- entrusted: Entrusted with something important (asked to watch over something precious, given responsibility)

EXAMPLES of multi-select:
- A kiss during a love confession = ["confession", "intimate_kiss", "emotional"]
- Revealing a secret while being held = ["secret_shared", "intimate_embrace", "emotional"]
- An argument that turns into a fight = ["argument", "combat"]
- Sex scene = ["intimate_heated", "intimate_foreplay", "intimate_penetrative", "intimate_climax"] (select all that apply)

IMPORTANT: Intimacy types are for ACTUAL physical contact, not discussing intimacy.
- Talking about wanting to kiss someone = ["conversation"] or ["emotional"]
- Actually kissing someone = ["intimate_kiss"]

CRITICAL - INTIMATE EVENTS MUST BE COMPLETED ACTIONS:
Intimate event types (intimate_touch, intimate_kiss, intimate_embrace, intimate_heated, and all sexual types) should ONLY be tagged when the action has ACTUALLY OCCURRED in the text.

DO NOT TAG:
- Actions being built up to ("she leaned in close..." but no kiss yet)
- Actions being desired ("he wanted to hold her")
- Actions being anticipated ("they were about to kiss")
- Actions being interrupted before completion

ONLY TAG when the text explicitly shows the action happening:
- "she kissed him" = intimate_kiss
- "he pulled her into his arms" = intimate_embrace
- "their hands intertwined" = intimate_touch
</event_types>

<event_details>
MANDATORY: You MUST provide an eventDetails entry for EVERY event type you select.
Each entry should be a brief phrase (5-15 words) describing what specifically happened.

Examples by type:
- conversation: "discussed plans for the heist tomorrow night"
- confession: "Elena admitted her romantic feelings for Marcus"
- argument: "fought about whether to trust the informant"
- discovery: "found the hidden compartment in the desk"
- secret_shared: "Elena revealed her TRUE past as a thief"
- secret_revealed: "Marcus's true identity as an agent was exposed"
- emotional: "Elena broke down crying about her father"
- emotionally_intimate: "shared their deepest fears and hopes while holding hands"
- emotionally_intimate: "heart-to-heart conversation where both opened up about past trauma"
- supportive: "Marcus comforted Elena after her breakdown"
- comfort: "held her while she cried about her past"
- apology: "apologized for lying about his identity"
- forgiveness: "forgave Marcus for the betrayal"
- laugh: "shared a genuine laugh at his terrible joke"
- gift: "gave her a hand-carved wooden pendant"
- gift: "offered to buy her dinner at the café"
- gift: "brought her favorite coffee as a surprise"
- compliment: "told her she had the most beautiful smile"
- compliment: "praised his bravery in facing the danger"
- tease: "playfully mocked his cooking disaster"
- tease: "joked about his terrible sense of direction"
- flirt: "winked and suggested they find somewhere private"
- flirt: "leaned in close while complimenting her eyes"
- date: "went to the art museum together"
- i_love_you: "told her he loved her for the first time"
- sleepover: "fell asleep together on the couch"
- shared_meal: "had dinner together at the candlelit restaurant"
- shared_meal: "ate breakfast together at the café"
- shared_meal: "grabbed coffee and chatted for hours"
- shared_activity: "played cards together into the night"
- shared_activity: "watched the sunset together from the rooftop"
- intimate_kiss: "first kiss in the corner booth"
- intimate_embrace: "held each other on the couch"
- promise: "vowed to protect Elena no matter what"
- betrayal: "sold the information to their enemies"
- lied: "told Marcus she was a teacher when she's actually a spy"
- helped: "fixed her broken laptop and recovered the files"
- helped: "carried her bags all the way home"
- common_interest: "discovered they both love vintage cars"
- common_interest: "realized they share a passion for astronomy"
- outing: "walked through the park together on a lazy afternoon"
- outing: "explored the old bookshop district together"
- defended: "stood up for him when others mocked his idea"
- defended: "stepped between her and the aggressive stranger"
- crisis_together: "survived the storm trapped in the cabin"
- crisis_together: "escaped the collapsing building together"
- vulnerability: "was shivering and weak from the cold"
- vulnerability: "injured and barely able to stand"
- shared_vulnerability: "admitted to Marcus she was terrified of failing"
- shared_vulnerability: "broke down and confessed his insecurities to Elena"
- entrusted: "asked her to watch over his grandmother's ring"
- entrusted: "trusted him with the key to her apartment"

CRITICAL - SECRET_SHARED vs LIED:
- secret_shared: Character shares a TRUE secret about themselves (real past, real identity, real feelings)
- lied: Character tells something FALSE, deceives, or gives a cover story
- If someone shares a fake backstory, that is "lied" NOT "secret_shared"
- "secret_shared" is ONLY for truthful revelations

SECRET_SHARED vs SECRET_REVEALED:
- secret_shared: Character VOLUNTARILY tells someone their TRUE secret
- secret_revealed: TRUE secret is EXPOSED (found out, overheard, discovered by accident, or told by a third party)
</event_details>

<event_pairs>
MANDATORY: You MUST specify which two characters are involved in EACH event type.
Different event types can involve different character pairs!

FORMAT:
- Single pair: "combat": ["User", "Thug"]
- Multiple pairs (same event type): "combat": [["User", "Thug1"], ["User", "Thug2"]]

EXAMPLE 1 - Single pair (confession between two people):
eventTypes: ["confession", "emotional", "secret_shared"]
eventPairs: {
  "confession": ["Elena", "Marcus"],
  "emotional": ["Elena", "Marcus"],
  "secret_shared": ["Elena", "Marcus"]
}

EXAMPLE 2 - Combat with multiple enemies:
eventTypes: ["combat", "danger"]
eventPairs: {
  "combat": [["Jake", "Thug1"], ["Jake", "Thug2"]],
  "danger": ["Jake", "Thug1"]
}

EXAMPLE 3 - Mixed event (fight enemies, comfort ally):
eventTypes: ["combat", "emotional", "supportive", "intimate_embrace"]
eventPairs: {
  "combat": ["Sarah", "Guard"],
  "emotional": ["Sarah", "Alex"],
  "supportive": ["Sarah", "Alex"],
  "intimate_embrace": ["Sarah", "Alex"]
}

This is CRITICAL for tracking relationships correctly. Each event type MUST have its own pair entry.
</event_pairs>

<relationship_signals>
If events affect relationships, include relationshipSignals (array - one per affected pair).
Only include signals for MEANINGFUL relationship shifts, not routine interactions.

FORMAT: Array of signal objects, each with a pair and changes array.

EXAMPLE 1 - No relationship signal (routine combat with nameless enemies):
relationshipSignals: []

EXAMPLE 2 - Single signal (emotional moment between two characters):
relationshipSignals: [
  {
    pair: ["Elena", "Marcus"],
    changes: [
      { from: "Elena", toward: "Marcus", feeling: "vulnerable" },
      { from: "Marcus", toward: "Elena", feeling: "protective" }
    ]
  }
]

EXAMPLE 3 - Multiple signals (fight with named enemies who will remember):
relationshipSignals: [
  { pair: ["Jake", "Viper"], changes: [{ from: "Viper", toward: "Jake", feeling: "vengeful" }] },
  { pair: ["Jake", "Razor"], changes: [{ from: "Razor", toward: "Jake", feeling: "fearful" }] }
]

EXAMPLE 4 - Mixed (combat with enemy, emotional support from ally):
relationshipSignals: [
  { pair: ["Sarah", "Alex"], changes: [
    { from: "Alex", toward: "Sarah", feeling: "grateful" },
    { from: "Sarah", toward: "Alex", feeling: "protective" }
  ]}
]
(Note: No signal for Guard unless they're a recurring character)

IMPORTANT: Only create relationship signals for characters who will appear again.
Generic enemies, random NPCs, or one-off characters don't need signals.
</relationship_signals>

<witnesses>
- Include all characters who witnessed or participated in the event.
- This is important for dramatic irony (tracking who knows what).
</witnesses>
</instructions>`,
		userTemplate: `<current_relationships>
{{currentRelationships}}
</current_relationships>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the significant event (or indicate no significant event) as valid JSON:`,
	},
};
