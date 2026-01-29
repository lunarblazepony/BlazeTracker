/**
 * Subjects Confirmation Event Prompt
 *
 * Validates candidate subjects with 3-way classification:
 * - accept: The subject happened as detected
 * - wrong_subject: Something happened, but it's a different subject type
 * - reject: Nothing significant happened between these characters
 */

import type { PromptTemplate } from '../types';
import type { ExtractedSubjectsConfirmation } from '../../types/extraction';
import { subjectsConfirmationSchema } from '../schemas';
import { parseJsonResponse } from '../../../utils/json';
import { SUBJECTS, type Subject } from '../../types/subject';
import { debugWarn } from '../../../utils/debug';

/**
 * Detailed descriptions of each subject type for the LLM.
 */
const SUBJECT_DESCRIPTIONS = `
## Subject Type Definitions

### Conversation & Social
- **conversation**: Meaningful dialogue that reveals character, builds relationship, or exchanges important information. NOT casual small talk like "how's the weather" or "pass the salt".
- **confession**: Admitting romantic feelings, revealing an important truth about oneself, or confessing to wrongdoing. Must be a significant admission.
- **argument**: Genuine verbal conflict with raised voices, accusations, or emotional intensity. NOT playful banter or friendly debate about movies/opinions.
- **negotiation**: Making deals, compromises, or bargaining over something meaningful. Both parties must be working toward an agreement.

### Discovery & Information
- **discovery**: Learning new, significant information about someone or something that changes understanding. NOT trivial facts.
- **secret_shared**: VOLUNTARILY sharing a secret - the character CHOOSES to reveal something hidden. They must speak it aloud, not just think it.
- **secret_revealed**: A secret being EXPOSED against someone's will - through discovery, accusation, or third party. The secret-holder did not choose to reveal it.

### Emotional
- **emotional**: A significant emotional moment - crying, grief, joy, fear displayed openly. NOT just feeling emotions internally.
- **emotionally_intimate**: Deep emotional CONNECTION - heart-to-heart sharing where BOTH characters are vulnerable and open. Mutual vulnerability is key.
- **supportive**: Actively providing emotional support - listening, encouraging, being present for someone in need. More than just being polite.
- **rejection**: Explicitly rejecting someone's romantic advances, proposal, or significant request. Clear refusal, not just hesitation.
- **comfort**: Actively comforting someone in distress - holding them, soothing words, physical presence during grief/fear/pain.
- **apology**: A sincere apology for a specific wrongdoing. Must acknowledge what they did wrong. "Sorry" in passing doesn't count.
- **forgiveness**: Explicitly forgiving someone for a wrong. Must be stated or clearly demonstrated, not just "moving on".

### Bonding & Connection
- **laugh**: SHARED genuine laughter - both characters laughing together at something funny. One person chuckling doesn't count.
- **gift**: Physically giving or receiving a meaningful gift. The gift must change hands in the scene. Planning to give a gift doesn't count.
- **compliment**: A sincere, heartfelt compliment that affects the recipient. "Nice shirt" is too casual. Must be meaningful praise.
- **tease**: Playful teasing or banter that builds rapport. Must be clearly affectionate/playful, not mean-spirited.
- **flirt**: Intentionally flirtatious behavior with romantic undertones. Must be clearly romantic interest, not just friendliness.
- **date**: Going on an actual date or romantic outing. Must be framed as romantic, not just friends hanging out.
- **i_love_you**: Explicitly saying "I love you" or equivalent declaration OUT LOUD to the other person. Thinking it doesn't count.
- **sleepover**: Sleeping over together in a non-sexual context. Must actually sleep/stay the night.
- **shared_meal**: Actually eating a meal together. Planning a meal or being near food doesn't count - must eat together.
- **shared_activity**: Doing a meaningful activity together - games, hobbies, projects. Must be engaged in the activity, not just nearby.

### Intimacy Levels (Romantic Physical)
- **intimate_touch**: Meaningful romantic touch - hand-holding, caressing, face-cupping. Must be romantic in nature, not casual friendly contact.
- **intimate_kiss**: Romantic kissing on the lips. A peck on the cheek as greeting doesn't count. Must be clearly romantic.
- **intimate_embrace**: Hugging, cuddling, holding each other in a romantic or deeply emotional context. Not a quick friendly hug.
- **intimate_heated**: Making out, heavy petting, grinding - clearly sexual in nature but not explicit sex acts. More intense than just kissing.

### Sexual Activity
- **intimate_foreplay**: Explicit sexual teasing, undressing each other, leading up to sex. Must describe sexual actions beginning.
- **intimate_oral**: Oral sexual activity explicitly described or clearly occurring.
- **intimate_manual**: Manual stimulation (hands, fingers) explicitly described or clearly occurring.
- **intimate_penetrative**: Penetrative sex explicitly described or clearly occurring.
- **intimate_climax**: Orgasm or climax explicitly described or clearly occurring.

### Action & Physical
- **action**: Significant physical action together - fighting side by side, escaping danger, physical exertion.
- **combat**: Fighting or violence between characters. Physical conflict.
- **danger**: Facing threat, peril, or risk together. Must be actual danger, not hypothetical.

### Decisions & Commitments
- **decision**: Making a significant choice together that affects both characters. Joint decision-making.
- **promise**: Making a specific commitment or vow. "I'll try" isn't a promise. Must be a firm commitment.
- **betrayal**: Breaking trust in a significant way - lying about something major, cheating, revealing secrets to enemies. Major violation.
- **lied**: Telling a significant lie or deceiving someone. Must be an actual lie told in the scene, not suspected deception.

### Life Events
- **exclusivity**: Explicitly committing to an exclusive relationship. Must be stated, not assumed.
- **marriage**: Getting married or engaged. The proposal/ceremony must happen in the scene.
- **pregnancy**: Pregnancy-related event - discovering pregnancy, discussing it, etc.
- **childbirth**: Birth of a child occurring in the scene.

### Social & Achievement
- **social**: Meeting new people or navigating social dynamics in a meaningful way.
- **achievement**: Accomplishing something significant, reaching a goal, celebration of success.

### Support & Protection
- **helped**: Helped with something significant - not trivial assistance like passing salt. Must be meaningful help.
- **common_interest**: Discovering a shared interest or passion that creates connection. Must be a genuine discovery.
- **outing**: Going somewhere together casually - a walk, shopping, exploring. Friendly time together.
- **defended**: Stood up for someone against a threat or criticism. Must actively defend, not just witness.
- **crisis_together**: Went through danger or crisis together - natural disaster, attack, emergency. Must be actual crisis.
- **vulnerability**: One character showing weakness or vulnerability openly (not shared/mutual).
- **shared_vulnerability**: MUTUAL vulnerability - BOTH characters opening up about fears, weaknesses, painful experiences. Both must share.
- **entrusted**: Being entrusted with something important - a task, responsibility, secret, or item of significance.
`;

const EXAMPLES = `
## Examples

### Example 1: Accept - Clear intimate_kiss
CANDIDATE: Elena and Marcus - intimate_kiss
TEXT: Elena reached up, cupped his face, and pressed her lips softly against his. For a moment, time stopped.
OUTPUT:
{
  "result": "accept",
  "reasoning": "Clear physical kiss action - 'pressed her lips softly against his' is unambiguous."
}

### Example 2: Reject - Almost but didn't happen
CANDIDATE: Elena and Marcus - intimate_kiss
TEXT: She leaned in, her eyes fluttering closed, their lips nearly touching... then her phone rang and they jerked apart.
OUTPUT:
{
  "result": "reject",
  "reasoning": "Kiss was interrupted before it happened - 'nearly touching' means no actual contact."
}

### Example 3: Wrong Subject - Different event occurred
CANDIDATE: Elena and Marcus - intimate_kiss
TEXT: Instead of kissing him, she pulled him into a tight embrace, burying her face in his shoulder. "Not yet," she whispered.
OUTPUT:
{
  "result": "wrong_subject",
  "correct_subject": "intimate_embrace",
  "reasoning": "An embrace happened but the kiss was explicitly avoided."
}

### Example 4: Accept - Clear shared_vulnerability
CANDIDATE: Elena and Marcus - shared_vulnerability
TEXT: "I've never told anyone this," Elena said, voice shaking. "My father used to hit me." Marcus took her hand. "I understand. My mother was the same way."
OUTPUT:
{
  "result": "accept",
  "reasoning": "Both characters share painful personal secrets - mutual vulnerability established."
}

### Example 5: Wrong Subject - Only one-sided
CANDIDATE: Elena and Marcus - shared_vulnerability
TEXT: Marcus broke down crying about his mother's death. Elena held him and listened, rubbing his back soothingly.
OUTPUT:
{
  "result": "wrong_subject",
  "correct_subject": "comfort",
  "reasoning": "Only Marcus was vulnerable. Elena provided comfort but didn't share her own vulnerability."
}

### Example 6: Reject - Internal thoughts only
CANDIDATE: Elena and Marcus - confession
TEXT: Marcus watched Elena laugh with James, his chest aching with everything he couldn't say. I love her, he thought. I should tell her. But his feet wouldn't move.
OUTPUT:
{
  "result": "reject",
  "reasoning": "All internal thoughts - Marcus never speaks the confession aloud."
}

### Example 7: Accept - Clear confession
CANDIDATE: Elena and Marcus - confession
TEXT: "I can't keep pretending anymore," Elena said, voice breaking. "I've been in love with you for three years, Marcus."
OUTPUT:
{
  "result": "accept",
  "reasoning": "Direct verbal confession of love spoken aloud to the other person."
}

### Example 8: Wrong Subject - Similar but different
CANDIDATE: Elena and Marcus - argument
TEXT: "The ending made no sense!" Marcus insisted. Elena shook her head, laughing. "You just weren't paying attention to the subtext!" They debated for hours, enjoying every minute.
OUTPUT:
{
  "result": "wrong_subject",
  "correct_subject": "conversation",
  "reasoning": "Animated debate but no real conflict - they're clearly enjoying the disagreement."
}

### Example 9: Reject - Casual not meaningful
CANDIDATE: Elena and Marcus - compliment
TEXT: "Nice shirt," Sarah said. Tom shrugged. "Thanks."
OUTPUT:
{
  "result": "reject",
  "reasoning": "Casual comment, not a meaningful compliment that affects the relationship."
}

### Example 10: Accept - Physical gift exchange
CANDIDATE: Elena and Marcus - gift
TEXT: Marcus held out the small wrapped box nervously. Inside was a vintage compass. "So you'll always find your way home," he said.
OUTPUT:
{
  "result": "accept",
  "reasoning": "Gift physically given and received with meaningful sentiment."
}

### Example 11: Reject - Gift not yet given
CANDIDATE: Elena and Marcus - gift
TEXT: The perfect gift sat wrapped in Elena's closet, waiting for his birthday next weekend.
OUTPUT:
{
  "result": "reject",
  "reasoning": "Gift exists but hasn't been given - birthday is next week."
}

### Example 12: Wrong Subject - Secret exposed vs shared
CANDIDATE: Elena and Marcus - secret_shared
TEXT: Elena's face appeared on the news - leaked documents revealing she was an undercover operative. Marcus stared at the TV in shock.
OUTPUT:
{
  "result": "wrong_subject",
  "correct_subject": "secret_revealed",
  "reasoning": "Secret was exposed through a leak, not voluntarily shared by Elena."
}
`;

export const subjectsConfirmationPrompt: PromptTemplate<ExtractedSubjectsConfirmation> = {
	name: 'subjects_confirmation',
	description: 'Validate candidate subjects with accept/wrong_subject/reject classification',

	placeholders: [
		{
			name: 'candidateSubject',
			description: 'The subject being validated',
			example: 'intimate_kiss',
		},
		{
			name: 'candidatePair',
			description: 'The character pair',
			example: 'Elena and Marcus',
		},
		{
			name: 'messages',
			description: 'The relevant messages',
			example: '...',
		},
	],

	systemPrompt: `You validate whether a detected interaction subject actually occurred between characters.

## Your Task
Determine if the candidate subject accurately describes what happened in the text.

## Classifications
- **accept**: The subject type accurately describes what happened between these characters
- **wrong_subject**: Something significant happened, but it's a DIFFERENT subject type (provide correct_subject)
- **reject**: The subject did NOT happen - it was imagined, planned, interrupted, or simply didn't occur

## Critical Rules
- Only "accept" events that ACTUALLY, EXPLICITLY occurred in the text
- "She wanted to kiss him" = kiss did NOT happen
- "They almost kissed" = kiss did NOT happen
- Internal thoughts and feelings are NOT actions
- Planning to do something is NOT doing it
- Being interrupted before completion = did NOT happen

${SUBJECT_DESCRIPTIONS}

${EXAMPLES}
`,

	userTemplate: `## Candidate Subject to Validate
Pair: {{candidatePair}}
Subject: {{candidateSubject}}

## Text
{{messages}}

## Task
Did this subject ({{candidateSubject}}) actually happen between {{candidatePair}}?
Return your classification as JSON.`,

	responseSchema: subjectsConfirmationSchema,

	defaultTemperature: 0.2,

	parseResponse(response: string): ExtractedSubjectsConfirmation | null {
		let parsed: Record<string, unknown>;
		try {
			const result = parseJsonResponse(response);
			if (!result || typeof result !== 'object' || Array.isArray(result)) {
				debugWarn('subjects confirmation: failed to parse JSON');
				return null;
			}
			parsed = result as Record<string, unknown>;
		} catch (e) {
			debugWarn('subjects confirmation: JSON parse error', e);
			return null;
		}

		// Validate result field
		const validResults = ['accept', 'wrong_subject', 'reject'];
		if (typeof parsed.result !== 'string' || !validResults.includes(parsed.result)) {
			debugWarn('subjects confirmation: invalid result', parsed.result);
			return null;
		}

		// Validate reasoning
		if (typeof parsed.reasoning !== 'string') {
			debugWarn('subjects confirmation: missing reasoning');
			return null;
		}

		// For wrong_subject, validate correct_subject
		if (parsed.result === 'wrong_subject') {
			if (typeof parsed.correct_subject !== 'string') {
				debugWarn(
					'subjects confirmation: wrong_subject missing correct_subject',
				);
				return null;
			}
			if (!SUBJECTS.includes(parsed.correct_subject as Subject)) {
				debugWarn(
					'subjects confirmation: invalid correct_subject',
					parsed.correct_subject,
				);
				return null;
			}
		}

		return {
			result: parsed.result as 'accept' | 'wrong_subject' | 'reject',
			reasoning: parsed.reasoning,
			correct_subject: parsed.correct_subject as Subject | undefined,
		};
	},
};
