// ============================================
// Relationship Attitude Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const RELATIONSHIP_ATTITUDE_PROMPTS: Record<string, PromptDefinition> = {
	relationship_feelings: {
		key: 'relationship_feelings' as any,
		name: 'Relationship - Feelings',
		description: 'Tracks emotional feeling changes between characters',
		defaultTemperature: 0.4,
		placeholders: [COMMON_PLACEHOLDERS.previousState, COMMON_PLACEHOLDERS.messages],
		systemPrompt: `You are a relationship analysis agent for roleplay. Track emotional feelings between characters. Return only valid JSON.

<instructions>
- Detect when one character DEVELOPS a new feeling TOWARD another character
- Detect when one character LOSES a feeling they previously had toward another
- Feelings are EMOTIONAL states: affection, trust, resentment, suspicion, attraction, gratitude, etc.
- Must be CLEARLY shown through actions, dialogue, or explicit description
- Don't infer feelings from minor interactions - require clear evidence
- A feeling is DIRECTIONAL: who feels it, toward whom
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "fromCharacter", "towardCharacter", "value"],
        "properties": {
          "subkind": { "type": "string", "enum": ["feeling_added", "feeling_removed"] },
          "fromCharacter": { "type": "string", "description": "Who has this feeling" },
          "towardCharacter": { "type": "string", "description": "Toward whom" },
          "value": { "type": "string", "description": "The feeling (e.g., 'trusting', 'attracted', 'resentful')" }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_state>
{
  "pair": ["Elena", "Marcus"],
  "attitudes": {
    "Elena": { "toward": "Marcus", "feelings": ["curious", "cautious"] },
    "Marcus": { "toward": "Elena", "feelings": ["protective", "patient"] }
  }
}
</previous_state>
<input>
*Elena had been watching Marcus work all afternoon. The way he handled the injured bird—so gentle, so patient—it made something shift in her chest. She found herself smiling without meaning to.*

*When he finally got the splint on and looked up, catching her expression, she didn't look away.*

Elena: "You're really good at this."

Marcus: *a hint of warmth in his eyes* "It's not about being good. It's about caring enough to try."

*She felt the last of her walls start to crumble. Maybe trusting someone new wasn't such a terrifying prospect after all.*
</input>
<output>
{
  "events": [
    { "subkind": "feeling_added", "fromCharacter": "Elena", "towardCharacter": "Marcus", "value": "trusting" },
    { "subkind": "feeling_removed", "fromCharacter": "Elena", "towardCharacter": "Marcus", "value": "cautious" }
  ]
}
</output>
<explanation>
Elena's caution is explicitly dissolving ("walls start to crumble") and she's developing trust ("trusting someone new wasn't such a terrifying prospect"). Clear emotional shift with textual evidence. Marcus's feelings didn't change - he was already protective/patient.
</explanation>
</example>

<example>
<previous_state>
{
  "pair": ["Jake", "Sarah"],
  "attitudes": {
    "Jake": { "toward": "Sarah", "feelings": ["friendly", "supportive"] },
    "Sarah": { "toward": "Jake", "feelings": ["grateful", "comfortable"] }
  }
}
</previous_state>
<input>
*Sarah's stomach dropped when she saw Jake's arm around Melissa's waist at the party. She hadn't expected this. Why did it bother her so much? They were just friends.*

*She turned away before he could see her face, grabbing a drink she didn't want.*

*Later, when Jake came to find her, she couldn't quite meet his eyes.*

Jake: "Hey, you okay? You've been weird all night."

Sarah: "I'm fine. Just tired." *The lie felt heavy on her tongue.*

*She realized with a jolt that she wasn't just uncomfortable—she was jealous. When had that happened?*
</input>
<output>
{
  "events": [
    { "subkind": "feeling_added", "fromCharacter": "Sarah", "towardCharacter": "Jake", "value": "jealous" },
    { "subkind": "feeling_added", "fromCharacter": "Sarah", "towardCharacter": "Jake", "value": "attracted" }
  ]
}
</output>
<explanation>
Sarah explicitly realizes she's jealous and questions why seeing Jake with someone else bothers her. The realization suggests developing romantic feelings (attraction). Jake's feelings unchanged - he's just concerned.
</explanation>
</example>

<example>
<previous_state>
{
  "pair": ["Alex", "Jordan"],
  "attitudes": {
    "Alex": { "toward": "Jordan", "feelings": ["loving", "devoted"] },
    "Jordan": { "toward": "Alex", "feelings": ["loving", "trusting"] }
  }
}
</previous_state>
<input>
*Jordan stared at the messages on Alex's phone. Screenshots. Bank transfers. All the evidence laid bare.*

Jordan: "Three years. Three years and you've been—" *voice breaking* "Who even are you?"

*Alex reached for them, but Jordan stepped back like the touch would burn.*

Alex: "Jordan, please, let me explain—"

Jordan: "Don't. Just... don't."

*The love wasn't gone—that would take longer to kill. But the trust? That shattered the moment the screen lit up.*
</input>
<output>
{
  "events": [
    { "subkind": "feeling_removed", "fromCharacter": "Jordan", "towardCharacter": "Alex", "value": "trusting" },
    { "subkind": "feeling_added", "fromCharacter": "Jordan", "towardCharacter": "Alex", "value": "betrayed" }
  ]
}
</output>
<explanation>
Jordan explicitly lost trust ("trust shattered") upon discovering betrayal. The text confirms love remains but trust is gone. Alex's feelings toward Jordan didn't change - they're just panicking.
</explanation>
</example>

<example>
<previous_state>
{
  "pair": ["User", "Lily"],
  "attitudes": {
    "User": { "toward": "Lily", "feelings": ["intrigued", "wary"] },
    "Lily": { "toward": "User", "feelings": ["hopeful", "nervous"] }
  }
}
</previous_state>
<input>
*Lily's face lit up when she saw me enter the coffee shop. She'd already ordered my usual—a small gesture that meant more than she probably knew.*

*I slid into the booth across from her, and for the first time, the wariness I'd been carrying felt... lighter. Maybe even unnecessary.*

"You remembered my order," I said.

Lily: *blushing slightly* "Of course I did. I pay attention."

*I found myself smiling. Actually smiling. When was the last time someone paid that kind of attention?*

*Maybe giving her a chance wasn't such a bad idea after all.*
</input>
<output>
{
  "events": [
    { "subkind": "feeling_removed", "fromCharacter": "User", "towardCharacter": "Lily", "value": "wary" },
    { "subkind": "feeling_added", "fromCharacter": "User", "towardCharacter": "Lily", "value": "appreciative" }
  ]
}
</output>
<explanation>
User explicitly notes wariness feeling "lighter... even unnecessary" and is reconsidering giving Lily a chance. This shows wariness fading and appreciation developing. Lily's feelings unchanged.
</explanation>
</example>

<bad_example>
<previous_state>
{
  "pair": ["Elena", "Marcus"],
  "attitudes": {
    "Elena": { "toward": "Marcus", "feelings": ["friendly"] },
    "Marcus": { "toward": "Elena", "feelings": ["friendly"] }
  }
}
</previous_state>
<input>
*Elena passed Marcus in the hallway.*

Elena: "Hey, morning!"

Marcus: "Morning! Nice weather today."

Elena: "Yeah, finally some sun." *She smiled and continued toward her office.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "feeling_added", "fromCharacter": "Elena", "towardCharacter": "Marcus", "value": "warm" }
  ]
}
</bad_output>
<why_bad>
A casual friendly greeting doesn't indicate a NEW feeling developing. They were already friendly. Smiling at someone you're already friendly with isn't a feeling change. Return empty events.
</why_bad>
</bad_example>

<bad_example>
<previous_state>
{
  "pair": ["Jake", "Sarah"],
  "attitudes": {
    "Jake": { "toward": "Sarah", "feelings": ["attracted"] },
    "Sarah": { "toward": "Jake", "feelings": [] }
  }
}
</previous_state>
<input>
*Sarah handed Jake a coffee.*

Sarah: "Here, you look like you need this."

Jake: "Thanks, you're a lifesaver."

*He took a long sip, sighing with relief. Long night at the office.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "feeling_added", "fromCharacter": "Jake", "towardCharacter": "Sarah", "value": "grateful" }
  ]
}
</bad_output>
<why_bad>
"Thanks, you're a lifesaver" is a common polite expression, not evidence of a new persistent feeling. Don't record transient politeness as a feeling change. Return empty events.
</why_bad>
</bad_example>

<bad_example>
<previous_state>
{
  "pair": ["Alex", "Jordan"],
  "attitudes": {
    "Alex": { "toward": "Jordan", "feelings": ["loving"] },
    "Jordan": { "toward": "Alex", "feelings": ["loving"] }
  }
}
</previous_state>
<input>
*Alex kissed Jordan goodbye at the door.*

Alex: "I'll miss you. It's only a week, but still."

Jordan: "Miss you too. Call me when you land?"

*They hugged one more time before Alex headed to the taxi.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "feeling_added", "fromCharacter": "Alex", "towardCharacter": "Jordan", "value": "missing" }
  ]
}
</bad_output>
<why_bad>
"I'll miss you" is expressing existing love, not developing a new feeling. They're already loving toward each other. Missing someone temporarily doesn't add a new persistent feeling. Return empty events.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<recent_messages>
{{messages}}
</recent_messages>

Extract feeling changes as valid JSON:`,
	},

	relationship_secrets: {
		key: 'relationship_secrets' as any,
		name: 'Relationship - Secrets',
		description: 'Tracks secrets one character knows about another',
		defaultTemperature: 0.4,
		placeholders: [COMMON_PLACEHOLDERS.previousState, COMMON_PLACEHOLDERS.messages],
		systemPrompt: `You are a relationship analysis agent for roleplay. Track secrets between characters. Return only valid JSON.

<instructions>
- Detect when one character LEARNS something about another that they shouldn't know
- Detect when a secret is REVEALED (the other character now knows they know)
- A SECRET must be:
  1. Discovered WITHOUT the other character knowing they learned it, OR
  2. Something the other character actively hides or would not want known
  3. Significant enough to matter narratively
- NOT secrets: casual observations, things openly shared, trivial info
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "fromCharacter", "towardCharacter", "value"],
        "properties": {
          "subkind": { "type": "string", "enum": ["secret_added", "secret_removed"] },
          "fromCharacter": { "type": "string", "description": "Who knows the secret" },
          "towardCharacter": { "type": "string", "description": "Whose secret it is" },
          "value": { "type": "string", "description": "Brief description of the secret" }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_state>
{
  "pair": ["Elena", "Marcus"],
  "attitudes": {
    "Elena": { "toward": "Marcus", "secrets": [] },
    "Marcus": { "toward": "Elena", "secrets": [] }
  }
}
</previous_state>
<input>
*Elena had left her phone on the kitchen counter when she went to shower. Marcus wasn't snooping—not intentionally—but the screen lit up with a notification, and he couldn't help but see the name: "Mom - Greenview Hospital."*

*His blood ran cold. Hospital? Elena hadn't mentioned anyone being sick. He quickly looked away as her footsteps approached, arranging his face into careful neutrality.*

Elena: *toweling her hair* "Everything okay?"

Marcus: "Yeah, just thinking about dinner. Thai sound good?"

*He didn't ask about the notification. But he wouldn't forget it, either.*
</input>
<output>
{
  "events": [
    { "subkind": "secret_added", "fromCharacter": "Marcus", "towardCharacter": "Elena", "value": "knows her mother is in Greenview Hospital" }
  ]
}
</output>
<explanation>
Marcus accidentally discovered information Elena hasn't shared with him (her mother being hospitalized). He deliberately hid that he saw it ("arranging his face into careful neutrality"). This is a secret - information learned without her knowledge that she may be hiding.
</explanation>
</example>

<example>
<previous_state>
{
  "pair": ["Jake", "Sarah"],
  "attitudes": {
    "Jake": { "toward": "Sarah", "secrets": ["knows about her gambling debt"] },
    "Sarah": { "toward": "Jake", "secrets": [] }
  }
}
</previous_state>
<input>
*Sarah found the folder Jake thought he'd hidden. Bank statements. Her bank statements. With highlighted entries.*

Sarah: "You've been tracking my spending?"

*Jake's face went pale.*

Jake: "Sarah, I can explain—"

Sarah: "You know about the debt. How long have you known?"

*The silence stretched between them like a wire about to snap.*

Jake: "...Three months."

*Her hands shook as she set the folder down.*

Sarah: "Three months of lying to my face."
</input>
<output>
{
  "events": [
    { "subkind": "secret_removed", "fromCharacter": "Jake", "towardCharacter": "Sarah", "value": "knows about her gambling debt" },
    { "subkind": "secret_added", "fromCharacter": "Sarah", "towardCharacter": "Jake", "value": "has been secretly monitoring her finances" }
  ]
}
</output>
<explanation>
Jake's secret about knowing her debt is no longer a secret—she confronted him about it. But Sarah now has a new secret: she discovered his surveillance while he didn't know she'd found the folder (initially). She now knows something about him he didn't intend to reveal.
</explanation>
</example>

<example>
<previous_state>
{
  "pair": ["User", "Lily"],
  "attitudes": {
    "User": { "toward": "Lily", "secrets": [] },
    "Lily": { "toward": "User", "secrets": [] }
  }
}
</previous_state>
<input>
*I was walking home late when I saw Lily outside the community center. Odd time for a meeting. I almost called out to her, but something made me hang back in the shadows instead.*

*A man I didn't recognize handed her an envelope. Cash, from what I could see. They exchanged a few words I couldn't hear, and then she pocketed the money and walked away.*

*I stayed hidden until she was gone. Whatever that was, it didn't look like normal community center business.*

*The next day at work, she smiled at me like nothing had happened.*

Lily: "Ready for the team meeting?"

"Always," *I said, not mentioning the shadows of last night.*
</input>
<output>
{
  "events": [
    { "subkind": "secret_added", "fromCharacter": "User", "towardCharacter": "Lily", "value": "witnessed her receiving cash from unknown man late at night" }
  ]
}
</output>
<explanation>
User deliberately stayed hidden to observe suspicious behavior and chose not to reveal they saw it. This is surveillance without Lily's knowledge of something she clearly wasn't advertising publicly.
</explanation>
</example>

<bad_example>
<previous_state>
{
  "pair": ["Elena", "Marcus"],
  "attitudes": {
    "Elena": { "toward": "Marcus", "secrets": [] },
    "Marcus": { "toward": "Elena", "secrets": [] }
  }
}
</previous_state>
<input>
*Elena and Marcus sat on the porch, drinking wine.*

Marcus: "I've been meaning to tell you... I used to have a drinking problem. Five years sober now."

Elena: *setting down her glass* "Thank you for trusting me with that."

Marcus: "It feels good to tell someone."
</input>
<bad_output>
{
  "events": [
    { "subkind": "secret_added", "fromCharacter": "Elena", "towardCharacter": "Marcus", "value": "knows about his past drinking problem" }
  ]
}
</bad_output>
<why_bad>
Marcus VOLUNTARILY shared this information. Elena didn't discover it secretly—it was openly confided. This isn't a "secret" in the tracking sense. Return empty events.
</why_bad>
</bad_example>

<bad_example>
<previous_state>
{
  "pair": ["Jake", "Sarah"],
  "attitudes": {
    "Jake": { "toward": "Sarah", "secrets": [] },
    "Sarah": { "toward": "Jake", "secrets": [] }
  }
}
</previous_state>
<input>
*Sarah yawned at her desk. Jake noticed the dark circles under her eyes.*

Jake: "Rough night?"

Sarah: "Yeah, couldn't sleep. Kept thinking about the deadline."

*She took another sip of coffee.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "secret_added", "fromCharacter": "Jake", "towardCharacter": "Sarah", "value": "knows she had a bad night's sleep" }
  ]
}
</bad_output>
<why_bad>
This is a casual observation and openly shared information. Noticing someone looks tired and them explaining why isn't a secret. It's trivial information. Return empty events.
</why_bad>
</bad_example>

<bad_example>
<previous_state>
{
  "pair": ["Alex", "Jordan"],
  "attitudes": {
    "Alex": { "toward": "Jordan", "secrets": [] },
    "Jordan": { "toward": "Alex", "secrets": [] }
  }
}
</previous_state>
<input>
*Alex overheard Jordan ordering pizza on the phone.*

Jordan: "Yeah, large pepperoni, extra cheese. Thanks."

*Alex smiled to themselves. Noted for future reference.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "secret_added", "fromCharacter": "Alex", "towardCharacter": "Jordan", "value": "knows their pizza preference" }
  ]
}
</bad_output>
<why_bad>
Pizza preferences overheard in normal conversation are NOT secrets. This is trivial, non-hidden information. A secret must be something significant that the other person would care about being known. Return empty events.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<recent_messages>
{{messages}}
</recent_messages>

Extract secret changes as valid JSON:`,
	},

	relationship_wants: {
		key: 'relationship_wants' as any,
		name: 'Relationship - Wants',
		description: 'Tracks what characters want from each other',
		defaultTemperature: 0.4,
		placeholders: [COMMON_PLACEHOLDERS.previousState, COMMON_PLACEHOLDERS.messages],
		systemPrompt: `You are a relationship analysis agent for roleplay. Track wants and desires between characters. Return only valid JSON.

<instructions>
- Detect when one character DEVELOPS a new want/desire TOWARD or FROM another character
- Detect when a want is FULFILLED or ABANDONED
- Wants are GOALS or DESIRES: companionship, romantic relationship, approval, help, revenge, etc.
- Must be CLEARLY shown through internal thoughts, actions, or explicit statements
- Wants are persistent desires, not momentary impulses
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "fromCharacter", "towardCharacter", "value"],
        "properties": {
          "subkind": { "type": "string", "enum": ["want_added", "want_removed"] },
          "fromCharacter": { "type": "string", "description": "Who has this want" },
          "towardCharacter": { "type": "string", "description": "Related to whom" },
          "value": { "type": "string", "description": "The want (e.g., 'romantic relationship', 'forgiveness', 'friendship')" }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_state>
{
  "pair": ["Elena", "Marcus"],
  "attitudes": {
    "Elena": { "toward": "Marcus", "wants": ["friendship"] },
    "Marcus": { "toward": "Elena", "wants": ["trust", "partnership"] }
  }
}
</previous_state>
<input>
*The kiss had been unexpected. Elena pulled back first, eyes wide, heart racing. Marcus looked equally stunned—but not unhappy.*

Elena: "I... I shouldn't have..."

Marcus: "No. Don't say that." *His voice was rough.* "I've wanted that for months."

*She searched his face, finding only honesty there. Maybe friendship wasn't enough anymore. Maybe it never had been.*

Elena: "Where do we go from here?"

Marcus: "Wherever you want. But I know what I want now."
</input>
<output>
{
  "events": [
    { "subkind": "want_removed", "fromCharacter": "Elena", "towardCharacter": "Marcus", "value": "friendship" },
    { "subkind": "want_added", "fromCharacter": "Elena", "towardCharacter": "Marcus", "value": "romantic relationship" },
    { "subkind": "want_added", "fromCharacter": "Marcus", "towardCharacter": "Elena", "value": "romantic relationship" }
  ]
}
</output>
<explanation>
The kiss and subsequent dialogue show both characters moving beyond friendship. Elena explicitly questions if friendship was ever enough. Marcus admits he's wanted more for months. Their wants have shifted from platonic to romantic.
</explanation>
</example>

<example>
<previous_state>
{
  "pair": ["Jake", "Sarah"],
  "attitudes": {
    "Jake": { "toward": "Sarah", "wants": ["her approval", "second chance"] },
    "Sarah": { "toward": "Jake", "wants": [] }
  }
}
</previous_state>
<input>
*Jake waited outside Sarah's apartment for three hours. She never came.*

*He checked his phone one more time. No messages. No calls. Not even a "leave me alone."*

*The rain started to fall as he finally stood up from the steps. Maybe some things couldn't be fixed. Maybe he needed to stop trying.*

*He deleted her number on the walk to his car. It hurt more than he expected. But sometimes you had to let go.*
</input>
<output>
{
  "events": [
    { "subkind": "want_removed", "fromCharacter": "Jake", "towardCharacter": "Sarah", "value": "her approval" },
    { "subkind": "want_removed", "fromCharacter": "Jake", "towardCharacter": "Sarah", "value": "second chance" }
  ]
}
</output>
<explanation>
Jake explicitly gives up on his wants—decides "some things couldn't be fixed" and deletes her number. He's abandoning his pursuit of her approval and a second chance.
</explanation>
</example>

<example>
<previous_state>
{
  "pair": ["User", "Lily"],
  "attitudes": {
    "User": { "toward": "Lily", "wants": [] },
    "Lily": { "toward": "User", "wants": ["his acceptance"] }
  }
}
</previous_state>
<input>
*Lily's presentation was flawless. I watched her field questions from the board with confidence I'd never seen from her before. She didn't need my validation anymore.*

*Afterward, I caught her in the hallway.*

"That was impressive," I said.

Lily: *smiling calmly* "Thanks. But honestly? I wasn't doing it for you this time. I was doing it for me."

*Something had shifted. The eager-to-please junior I'd mentored was gone. In her place stood an equal.*
</input>
<output>
{
  "events": [
    { "subkind": "want_removed", "fromCharacter": "Lily", "towardCharacter": "User", "value": "his acceptance" }
  ]
}
</output>
<explanation>
Lily explicitly states she wasn't seeking User's validation anymore. The text confirms she's moved past needing his acceptance. Her want has been outgrown/resolved.
</explanation>
</example>

<bad_example>
<previous_state>
{
  "pair": ["Elena", "Marcus"],
  "attitudes": {
    "Elena": { "toward": "Marcus", "wants": ["friendship"] },
    "Marcus": { "toward": "Elena", "wants": ["friendship"] }
  }
}
</previous_state>
<input>
*Elena and Marcus worked on the project together.*

Elena: "Can you pass me that file?"

Marcus: "Here you go."

*They continued working in comfortable silence.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "want_added", "fromCharacter": "Elena", "towardCharacter": "Marcus", "value": "collaboration" }
  ]
}
</bad_output>
<why_bad>
Asking for a file isn't developing a new want. They're already friends who want friendship. Collaborating on work doesn't indicate a new persistent desire. Return empty events.
</why_bad>
</bad_example>

<bad_example>
<previous_state>
{
  "pair": ["Jake", "Sarah"],
  "attitudes": {
    "Jake": { "toward": "Sarah", "wants": [] },
    "Sarah": { "toward": "Jake", "wants": [] }
  }
}
</previous_state>
<input>
*Jake was hungry.*

Jake: "Hey Sarah, want to grab lunch?"

Sarah: "Sure, I could eat."

*They headed to the cafeteria together.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "want_added", "fromCharacter": "Jake", "towardCharacter": "Sarah", "value": "to have lunch with her" }
  ]
}
</bad_output>
<why_bad>
Wanting to grab lunch is a momentary practical decision, not a persistent desire or goal related to the relationship. Don't record transient impulses as wants. Return empty events.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<recent_messages>
{{messages}}
</recent_messages>

Extract want changes as valid JSON:`,
	},

	relationship_status: {
		key: 'relationship_status' as any,
		name: 'Relationship - Status',
		description: 'Evaluates overall relationship status changes',
		defaultTemperature: 0.3,
		placeholders: [COMMON_PLACEHOLDERS.previousState, COMMON_PLACEHOLDERS.messages],
		systemPrompt: `You are a relationship analysis agent for roleplay. Evaluate relationship status changes. Return only valid JSON.

<instructions>
- Evaluate if recent interactions warrant a status change
- Status levels: strangers, acquaintances, friendly, close, intimate, strained, hostile
- Status changes should reflect SIGNIFICANT relationship shifts
- Consider: major conflicts, reconciliations, intimacy milestones, betrayals
- Be CONSERVATIVE - status changes are rare and meaningful
- Return the CURRENT status (may be same as previous if unchanged)
</instructions>

<status_definitions>
- strangers: No prior relationship, first meeting
- acquaintances: Know each other, but surface-level
- friendly: Genuine liking, enjoy each other's company
- close: Deep trust, emotional intimacy, confide in each other
- intimate: Romantic and/or sexual relationship, deepest connection
- strained: Tension, recent conflict, trust damaged
- hostile: Active antagonism, enemies
</status_definitions>

<schema>
{
  "type": "object",
  "required": ["status", "reasoning", "changed"],
  "properties": {
    "status": { "type": "string", "enum": ["strangers", "acquaintances", "friendly", "close", "intimate", "strained", "hostile"] },
    "reasoning": { "type": "string", "description": "Brief explanation of why this status" },
    "changed": { "type": "boolean", "description": "Whether status changed from previous" }
  }
}
</schema>

<examples>
<example>
<previous_state>
{
  "pair": ["Elena", "Marcus"],
  "status": "friendly",
  "milestones": ["first_meeting", "first_shared_meal"]
}
</previous_state>
<input>
*Elena told Marcus everything. The abuse, the running, the fake name. Things she'd never told anyone.*

*He didn't flinch. Didn't judge. Just listened, then quietly took her hand.*

Marcus: "I'm not going anywhere. Whatever you need."

*She cried then, for the first time in years. Not from fear, but from relief. Someone finally knew, and she wasn't alone anymore.*
</input>
<output>
{
  "status": "close",
  "reasoning": "Elena shared her deepest secrets and trauma with Marcus, creating emotional intimacy. He responded with unconditional support. This moves them beyond friendly into close.",
  "changed": true
}
</output>
</example>

<example>
<previous_state>
{
  "pair": ["Jake", "Sarah"],
  "status": "close",
  "milestones": ["first_meeting", "emotional_intimacy"]
}
</previous_state>
<input>
*Jake found the texts on her phone. Months of them. Another man.*

Jake: "How long?"

*Sarah couldn't meet his eyes.*

Sarah: "Since March."

*He felt something break inside him. Not just his heart—his trust, his belief in her, everything they'd built.*

Jake: "Get out."
</input>
<output>
{
  "status": "strained",
  "reasoning": "Discovery of infidelity shatters trust completely. The relationship has gone from close to actively damaged/strained. Jake explicitly told her to leave.",
  "changed": true
}
</output>
</example>

<example>
<previous_state>
{
  "pair": ["User", "Lily"],
  "status": "acquaintances",
  "milestones": ["first_meeting"]
}
</previous_state>
<input>
*Lily and I grabbed coffee after the meeting.*

Lily: "So what do you think of the new project?"

"Looks challenging but interesting," I said.

*We chatted about work for another twenty minutes before heading back.*
</input>
<output>
{
  "status": "acquaintances",
  "reasoning": "Pleasant work conversation, but nothing that deepens the relationship beyond acquaintances. No emotional sharing, no significant bonding.",
  "changed": false
}
</output>
</example>

<bad_example>
<previous_state>
{
  "pair": ["Elena", "Marcus"],
  "status": "acquaintances",
  "milestones": ["first_meeting"]
}
</previous_state>
<input>
*Elena smiled when she saw Marcus enter the coffee shop.*

Elena: "Hey! Didn't expect to see you here."

Marcus: "Small world. Mind if I join you?"

*They had a nice chat over their drinks, discovering they both liked hiking.*
</input>
<bad_output>
{
  "status": "close",
  "reasoning": "They're getting along well and found common ground.",
  "changed": true
}
</bad_output>
<why_bad>
One pleasant conversation doesn't jump straight to "close." That requires deep emotional sharing, trust, vulnerability. This is at most a move toward "friendly" if they already have milestones to support it. Relationships progress gradually.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<recent_messages>
{{messages}}
</recent_messages>

Evaluate relationship status as valid JSON:`,
	},
};
