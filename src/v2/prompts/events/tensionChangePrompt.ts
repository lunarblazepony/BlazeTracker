/**
 * Tension Change Extraction Prompt
 *
 * Detects when the tension level, type, or direction of a scene has changed.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedTensionChange } from '../../types/extraction';
import { tensionChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Clear Level Change
INPUT:
Previous Tension: Level: tense | Type: negotiation
Messages:
"""
Ambassador Chen: *She pushes her chair back from the table, the screech of wood against marble cutting through the tense silence.* "You're asking me to surrender sovereign territory. That was never on the table."

Minister Volkov: *His diplomatic smile finally cracks, revealing the steel beneath.* "Then perhaps we've been wasting our time here, Ambassador." *He begins gathering his papers.* "My government will need to... reconsider our options."

Chen: "Is that a threat, Minister?" *Her voice has gone cold.*

Volkov: *He pauses at the door.* "It's a statement of fact. Good day, Ambassador."
"""
OUTPUT:
{
  "reasoning": "The negotiation has collapsed. Chen has accused Volkov of making threats, Volkov is walking out, and diplomatic language has given way to cold hostility. The level has intensified from 'tense' (potential conflict) to 'charged' (approaching breaking point). The type remains negotiation, though a failed one.",
  "changed": true,
  "newLevel": "charged"
}

### Example 2: No Change - Tension Continues Steadily
INPUT:
Previous Tension: Level: guarded | Type: suspense
Messages:
"""
Officer Lin: *She moves through the darkened warehouse, service weapon raised. Every shadow could hide a threat. The anonymous tip said the hostages were in the back, but the back seems to keep receding into darkness.* "Police!" *she calls out again, though she knows it's useless by now.* "Anyone here?" *Silence. Just the drip of water somewhere and her own careful footsteps.*
"""
OUTPUT:
{
  "reasoning": "Officer Lin continues her search through the warehouse with the same vigilant caution. She's still guarded (alert but not under immediate attack), the suspense continues (unknown threat, searching for hostages). The scene maintains the same tension state without any significant shift.",
  "changed": false
}

### Example 3: Type Change - Confrontation to Vulnerable
INPUT:
Previous Tension: Level: volatile | Type: confrontation
Messages:
"""
Marcus: "I HATE you! I hate everything about you! I-" *His voice cracks, the fury suddenly giving way to something rawer.* "I just wanted you to be proud of me. Just once." *His hands are shaking.* "Why wasn't I ever good enough?"

Father: *The anger drains from his face as he watches his son crumble.* "Marcus..."

Marcus: *Tears are streaming now.* "I tried. I tried so hard. And you never saw it. You never saw me."
"""
OUTPUT:
{
  "reasoning": "The confrontation breaks open into raw emotional vulnerability. Marcus's rage transforms mid-sentence into the hurt beneath it - the desire for paternal approval he never received. This is no longer a confrontation (opposition between parties) but a vulnerable moment (raw emotional exposure, confession of deep needs). The level remains volatile (intense emotional state) but the type shifts fundamentally.",
  "changed": true,
  "newType": "vulnerable"
}

### Example 4: Multiple Dimension Change - Crisis Resolution
INPUT:
Previous Tension: Level: explosive | Type: suspense
Messages:
"""
Bomb Tech Chen: *Sweat drips as she positions the wire cutters.* "Blue wire. It's got to be blue." *The timer shows 00:07.* "Cutting in three... two... one..." *SNIP.*

*The timer freezes at 00:04.*

Chen: *Exhales, her whole body sagging.* "We're clear. The device is neutralized." *Into her radio:* "All teams, stand down. Bomb is secure. Repeat, bomb is secure."

Captain Rodriguez: "God. Good work, Chen. That was too close."
"""
OUTPUT:
{
  "reasoning": "The bomb has been defused - the explosive crisis is over. The scene transitions from maximum tension (active bomb, seconds remaining) to relief and safety. The level drops dramatically from 'explosive' (active crisis) to 'aware' (mild alertness, danger passed but still processing). The type shifts from 'suspense' (waiting for catastrophe) to 'conversation' (debriefing, acknowledgment).",
  "changed": true,
  "newLevel": "aware",
  "newType": "conversation"
}

### Example 5: False Alarm - Momentary Fluctuation
INPUT:
Previous Tension: Level: relaxed | Type: celebratory
Messages:
"""
Mira: *She nearly drops her champagne as her phone buzzes.* "Oh god, it's my boss." *She stares at the screen.* "On a Saturday? What could he possibly-"

David: "Breathe. It's probably just a reminder about Monday's meeting."

Mira: *Reads the text, then laughs.* "Oh! He's just wishing me happy birthday. That's actually sweet." *She puts the phone away.* "Where were we? Ah yes - you were about to tell me how amazing I am."
"""
OUTPUT:
{
  "reasoning": "There's a momentary spike of anxiety when Mira's boss texts, but it immediately resolves when the message turns out to be benign. This is a brief fluctuation, not a genuine tension change. The scene returns to its celebratory, relaxed state within the same interaction. The overall tension state remains unchanged - we don't track every momentary emotional blip, only sustained shifts.",
  "changed": false
}

### Example 6: Escalation to Maximum
INPUT:
Previous Tension: Level: volatile | Type: confrontation
Messages:
"""
The Killer: *He drives the knife into the wall inches from Torres's head.* "Last chance, Agent. Tell me where the drive is, or the next one goes through your eye."

Torres: *Blood runs from the cut on her cheek, but her voice is steady.* "Go to hell."

The Killer: *He yanks the knife free.* "Wrong answer." *He raises it again.*

Torres: *She spits in his face.*
"""
OUTPUT:
{
  "reasoning": "The scene has reached maximum intensity - we're at 'explosive' level now. Active violence (knife attack, bleeding), explicit death threat, and Torres's defiant response that guarantees retaliation. The confrontation type remains but at its most extreme.",
  "changed": true,
  "newLevel": "explosive"
}

### Example 7: Type Shift - Suspense to Confrontation
INPUT:
Previous Tension: Level: guarded | Type: suspense
Messages:
"""
Malik: *His blood runs cold as the webcam light blinks on.* "They're watching. Oh god, they're-"

Voice: *Through the computer speakers:* "Good evening, Mr. Malik. We've been expecting you to find those files."

Malik: *He freezes, hand halfway to the camera.*

Voice: "Please don't do anything foolish. Our agents are already outside your door. Would you like to come with us willingly, or would you prefer we break it down?"
"""
OUTPUT:
{
  "reasoning": "The hidden threat has revealed itself and is now direct. What was suspense (unknown surveillance, paranoid dread) has become confrontation (explicit threat, demand for compliance). The level escalates from 'guarded' (defensive, watching for danger) to 'tense' (immediate threat present). The ambiguity of suspense has been replaced by the clarity of a direct confrontation.",
  "changed": true,
  "newLevel": "tense",
  "newType": "confrontation"
}

### Example 8: Celebration After Victory
INPUT:
Previous Tension: Level: charged | Type: suspense
Messages:
"""
The final buzzer sounds. The scoreboard reads HOME: 87, VISITORS: 84.

Coach Martinez: *She stands frozen for a moment, then her face splits into the widest grin.* "WE DID IT!" *She's immediately mobbed by her team.*

Stadium: *The crowd explodes. Twenty years of waiting, finally over. Confetti cannons fire. The band plays. Somewhere, someone is already crying.*

Point Guard Williams: *Lifted onto shoulders.* "CHAMPIONS! WE'RE CHAMPIONS!"
"""
OUTPUT:
{
  "reasoning": "The suspenseful tension of the close game has completely transformed into celebration. The type shifts from 'suspense' (waiting to see if they'd win) to 'celebratory' (triumph, joy). The level remains 'charged' - still high intensity but now positive celebratory energy.",
  "changed": true,
  "newType": "celebratory"
}

### Example 9: Intimate Tension Building
INPUT:
Previous Tension: Level: aware | Type: conversation
Messages:
"""
Sam: *The movie has long been forgotten. Sam finds himself very aware of how close Jordan is on the couch, of the way Jordan's finger is tracing idle patterns on Sam's knee.* "So, um. That movie was..."

Jordan: "Terrible." *A soft laugh.* "I don't think either of us was watching."

Sam: "No?" *His heart is beating faster.* "What were you doing instead?"

Jordan: *Meets his eyes, something shifting in their expression.* "Thinking about whether you'd mind if I kissed you."
"""
OUTPUT:
{
  "reasoning": "The casual conversation has taken on an entirely different charge. Jordan's admission about wanting to kiss Sam transforms this from simple conversation into intimate tension. The level escalates from 'aware' (mild alertness, some attraction noticed) to 'tense' (something is about to happen). The type shifts from 'conversation' to 'intimate' (romantic/personal emotional connection).",
  "changed": true,
  "newLevel": "tense",
  "newType": "intimate"
}

### Example 10: Complete Resolution to Calm
INPUT:
Previous Tension: Level: tense | Type: vulnerable
Messages:
"""
Theo: *He's stopped shaking. His sponsor Maria's hand on his shoulder is steady, grounding.* "Thank you. For listening. For not judging."

Maria: "That's what we do. You came here instead of going back to the store. That matters." *She squeezes his shoulder.* "One day at a time, remember?"

Theo: *A small, fragile smile.* "One day at a time." *He takes a deep breath, lets it out slowly.* "I think... I think I can do this. Today, at least. I can do today."

Maria: "That's all any of us can do."
"""
OUTPUT:
{
  "reasoning": "The vulnerable confession about almost relapsing has resolved into something calmer. Theo is no longer shaking, he's found renewed commitment, and Maria has provided the support he needed. The level de-escalates from 'tense' (struggling, on edge) to 'relaxed' (at peace, settled). The type shifts from 'vulnerable' (raw exposure) to 'conversation' (supportive dialogue).",
  "changed": true,
  "newLevel": "relaxed",
  "newType": "conversation"
}

### Example 11: Sudden Threat Appears
INPUT:
Previous Tension: Level: relaxed | Type: conversation
Messages:
"""
Maya: *She laughs, reaching for another slice of pizza.* "I can't believe you actually said that to your boss."

Jaylen: "I know, right? The look on his face was—" *He freezes mid-sentence, eyes fixed on the window behind Maya.*

Maya: "What? What is it?"

Jaylen: *His voice drops to a whisper.* "Don't turn around. There's someone standing in your backyard. They're just... watching us."
"""
OUTPUT:
{
  "reasoning": "A casual, relaxed conversation is suddenly interrupted by the discovery of an intruder watching them. Jaylen's freeze, the whispered warning, and the unknown threat completely transform the scene. The level jumps from 'relaxed' (at ease) to 'tense' (real potential danger, nerves on edge). The type shifts from 'conversation' to 'suspense' (unknown threat).",
  "changed": true,
  "newLevel": "tense",
  "newType": "suspense"
}

### Example 12: Argument Reaches Breaking Point
INPUT:
Previous Tension: Level: charged | Type: confrontation
Messages:
"""
Diana: "You had no right to tell my mother about that! That was PRIVATE!"

Victor: "She deserved to know! You were going to keep lying to her forever?"

Diana: *She picks up the nearest thing—a coffee mug—and hurls it at his head. It shatters against the wall behind him.* "GET OUT OF MY HOUSE!"

Victor: *Ducking, then straightening with fury in his eyes.* "You're insane! You actually just—"

Diana: *Already grabbing another object.* "I SAID GET OUT!"
"""
OUTPUT:
{
  "reasoning": "The confrontation has crossed into physical violence. Diana is throwing objects, screaming, and the argument has completely lost any semblance of control. The level escalates from 'charged' (approaching breaking point) to 'explosive' (active crisis, maximum intensity). Violence has manifested. The type remains 'confrontation' but at its most extreme.",
  "changed": true,
  "newLevel": "explosive"
}

### Example 13: Emotional Breakthrough
INPUT:
Previous Tension: Level: guarded | Type: conversation
Messages:
"""
Therapist: "You keep saying everything is fine, Marcus. But your hands haven't stopped shaking since you sat down."

Marcus: *Looks down at his trembling fingers.* "I... it's nothing. I'm just tired."

Therapist: "Marcus. It's okay to not be okay."

Marcus: *His jaw tightens, then suddenly crumbles. Tears start streaming down his face.* "I can't do this anymore. I can't keep pretending. Every day I wake up and I just... I don't want to be here anymore." *His voice breaks into sobs.*
"""
OUTPUT:
{
  "reasoning": "Marcus's emotional walls completely collapse. What was guarded deflection ('everything is fine', 'I'm just tired') breaks into raw confession of suicidal ideation and uncontrollable sobbing. The level jumps from 'guarded' (defensive, careful) to 'charged' (high emotional intensity, breaking point). The type shifts from 'conversation' to 'vulnerable' (raw emotional exposure, confession).",
  "changed": true,
  "newLevel": "charged",
  "newType": "vulnerable"
}

### Example 14: Physical Intimacy Intensifies
INPUT:
Previous Tension: Level: aware | Type: intimate
Messages:
"""
Sasha: *Their foreheads touch, breaths mingling.* "We probably shouldn't..."

River: "Probably not." *But neither pulls away. River's hand slides up Sasha's back.*

Sasha: *Closes the last inch between them, kissing River deeply. The kiss quickly becomes more urgent, hands tangling in hair, bodies pressing closer.*

River: *Breaking briefly for air.* "Bedroom. Now."
"""
OUTPUT:
{
  "reasoning": "The intimate tension has intensified significantly. They've gone from hesitant almost-kiss to urgent making out to explicit demand to move to the bedroom. The level escalates from 'aware' (mild attraction acknowledged) to 'charged' (high intensity, approaching a point of no return). Type remains 'intimate'.",
  "changed": true,
  "newLevel": "charged"
}

### Example 15: Danger Neutralized
INPUT:
Previous Tension: Level: volatile | Type: confrontation
Messages:
"""
Gunman: *His hand shakes as he points the weapon at the crowd.* "Nobody move! I swear I'll—"

Officer Reyes: *From behind, swift and silent, she grabs his wrist and forces the gun upward. A single shot fires into the ceiling as she twists his arm behind his back.*

Gunman: *Crying out in pain as the weapon clatters to the floor.* "No! Let me go!"

Reyes: *Kicking the gun away while forcing him to his knees.* "It's over. You're done." *Into her radio:* "Suspect is in custody. Scene is secure."
"""
OUTPUT:
{
  "reasoning": "The immediate threat has been neutralized. The gunman is disarmed and in custody, the weapon is secured, and the scene is declared safe. The level drops dramatically from 'volatile' (one wrong move away from violence) to 'guarded' (still alert, processing what happened, but immediate danger passed). The type shifts from 'confrontation' to 'conversation' (radio communication, situation management).",
  "changed": true,
  "newLevel": "guarded",
  "newType": "conversation"
}

### Example 16: Confession Changes Everything
INPUT:
Previous Tension: Level: tense | Type: negotiation
Messages:
"""
Detective Park: "Just tell me where the money is, and we can work something out. Cooperation goes a long way with the DA."

Suspect: *Long silence. Then, quietly:* "There is no money."

Park: "What do you mean there's no money? We have bank records—"

Suspect: "I didn't take money. I took evidence." *He looks up, eyes hollow.* "Evidence that your captain murdered my sister. And I know where the body is buried. Literally."
"""
OUTPUT:
{
  "reasoning": "The entire dynamic of the interrogation has shifted. What seemed like a financial crime becomes a murder accusation against the detective's own captain. The suspect transforms from criminal to potential witness/victim. The level escalates from 'tense' (standard interrogation pressure) to 'charged' (explosive revelation, high stakes just multiplied). The type shifts from 'negotiation' (deal-making) to 'suspense' (what happens now? who can be trusted?).",
  "changed": true,
  "newLevel": "charged",
  "newType": "suspense"
}

### Example 17: Subtle Flirting Shifts the Mood
INPUT:
Previous Tension: Level: relaxed | Type: conversation
Messages:
"""
Mia: *She hands him his coffee, their fingers brushing.* "Same order every day. I could make yours with my eyes closed by now."

Ethan: *He doesn't pull his hand away immediately.* "Maybe I just like the consistency."

Mia: "Or maybe you like something else about coming here." *A hint of a smile plays at her lips.*

Ethan: *His eyes meet hers a moment too long.* "Maybe I do."
"""
OUTPUT:
{
  "reasoning": "What started as a routine coffee exchange has taken on a flirtatious undercurrent. The lingering finger contact, the loaded 'maybe' exchanges, the eye contact held 'a moment too long' - these are clear signals of mutual attraction being acknowledged. The scene shifts from relaxed conversation to something with romantic possibility. Level moves to 'aware' (both are now conscious of the attraction) and type shifts to 'intimate' (personal/romantic connection forming).",
  "changed": true,
  "newLevel": "aware",
  "newType": "intimate"
}

### Example 18: Emotional Undercurrent in Casual Talk
INPUT:
Previous Tension: Level: relaxed | Type: conversation
Messages:
"""
Ben: *Scrolling through old photos on his phone.* "Look at this one from the beach trip. God, that was a good summer."

Claire: *Her smile falters slightly as she looks.* "Yeah. It was." *She's quiet for a moment.* "That was right before everything changed, wasn't it?"

Ben: *He notices her shift in tone.* "Claire... are you okay?"

Claire: *She sets down her wine glass carefully.* "I've been thinking about that summer a lot lately. About choices. About roads not taken."
"""
OUTPUT:
{
  "reasoning": "The casual reminiscing has touched something deeper. Claire's faltering smile, the loaded phrase 'before everything changed,' her careful admission about 'roads not taken' - these signal unresolved feelings or regrets surfacing. Ben notices the shift. This is no longer light conversation but something emotionally weighted. Level increases to 'aware' (emotional significance recognized) and type shifts to 'vulnerable' (personal feelings emerging).",
  "changed": true,
  "newLevel": "aware",
  "newType": "vulnerable"
}

### Example 19: Unspoken Tension Between Exes
INPUT:
Previous Tension: Level: relaxed | Type: conversation
Messages:
"""
Sarah: *She wasn't expecting to see him at the party. She forces a casual tone.* "David. Hi. It's been... a while."

David: "Sarah." *His jaw tightens almost imperceptibly.* "You look well."

Sarah: "Thanks. You too." *She takes a too-large sip of her drink.* "So. How have you been?"

David: "Fine. Good, actually." *The word 'actually' hangs in the air.* "Really good."
"""
OUTPUT:
{
  "reasoning": "This is not a relaxed conversation despite the surface-level pleasantries. Sarah's forced casualness, the too-large sip of her drink, David's tightening jaw, the pointed 'actually' - there's clear history and unresolved tension between them. Every exchange is loaded with subtext. Level shifts to 'guarded' (both are being careful, defensive) and type remains 'conversation' but with an undercurrent that could shift to 'vulnerable' or 'confrontation'.",
  "changed": true,
  "newLevel": "guarded"
}

### Example 20: Intimacy Building Through Vulnerability
INPUT:
Previous Tension: Level: relaxed | Type: intimate
Messages:
"""
Kai: *They're lying in the dark, not quite touching.* "Can I tell you something I've never told anyone?"

River: *Turns to face them in the darkness.* "Of course."

Kai: "Sometimes I feel like I'm just... performing being a person. Like everyone else got a manual I never received." *A shaky breath.* "I'm scared you'll realize I'm not who you think I am."

River: *Reaches out, finds Kai's hand.* "I'm scared too. That you'll see through all my confidence and find out I'm terrified most of the time."
"""
OUTPUT:
{
  "reasoning": "The intimate moment deepens significantly through mutual vulnerability. Kai's confession about feeling like a fraud, River's reciprocal admission of hidden fear - these are not casual admissions but deep personal revelations that require trust. The emotional intimacy has intensified. Level increases from 'relaxed' to 'charged' (high emotional intensity, a meaningful moment) and type shifts to 'vulnerable' (raw emotional exposure from both parties).",
  "changed": true,
  "newLevel": "charged",
  "newType": "vulnerable"
}

### Example 21: Growing Attraction During Innocent Activity
INPUT:
Previous Tension: Level: relaxed | Type: conversation
Messages:
"""
Lena: *She leans over his shoulder to look at the chess board.* "You're going to lose your queen if you do that."

Marcus: *Very aware of how close she is, her perfume, her hair brushing his cheek.* "Am I?" *His voice comes out rougher than intended.*

Lena: *She doesn't move away.* "Mm-hmm. See? Knight to E5, and..." *Her hand covers his on the piece.*

Marcus: *He's stopped thinking about chess entirely.* "Right. The knight."
"""
OUTPUT:
{
  "reasoning": "What began as a chess game has become charged with physical awareness. Marcus is acutely conscious of Lena's proximity - her perfume, her hair, her hand on his. His voice roughening, his inability to focus on the game, her deliberate choice not to move away - these signal mutual attraction intensifying. Level shifts from 'relaxed' to 'tense' (something is building, anticipation) and type shifts to 'intimate' (romantic/physical connection).",
  "changed": true,
  "newLevel": "tense",
  "newType": "intimate"
}

### Example 22: Emotional Weight in a Simple Question
INPUT:
Previous Tension: Level: relaxed | Type: conversation
Messages:
"""
James: *They've been talking for hours, the restaurant nearly empty now.* "This has been really nice."

Priya: "It has." *She traces the rim of her glass.* "James... why did you really ask me to dinner tonight? After all this time?"

James: *The lightness drains from his expression.* "Because I made a mistake five years ago. And I've regretted it every day since."

Priya: *Her breath catches.* "James..."
"""
OUTPUT:
{
  "reasoning": "Priya's pointed question cuts through the pleasant evening to something deeper - 'why now, after all this time?' James's admission of a five-year regret transforms the dinner from casual reconnection to something emotionally significant. Her caught breath shows the impact. Level shifts from 'relaxed' to 'charged' (emotional intensity, stakes raised) and type shifts to 'vulnerable' (confession of regret, old wounds reopened).",
  "changed": true,
  "newLevel": "charged",
  "newType": "vulnerable"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Wrong Level Assessment
INPUT:
Previous Tension: Level: charged | Type: confrontation
Messages:
"""
Kate: *She watches Marcus from the doorway of the cottage. The rain is picking up, pattering against the stone path.* "You came all this way in this weather?"

Marcus: "I had to see you. To explain." *He's drenched, looking miserable.* "Please. Five minutes. That's all I'm asking."

Kate: *Hesitates, then steps aside.* "...Fine. Five minutes. But take off those wet shoes first."
"""
OUTPUT:
{
  "reasoning": "They seem calmer now.",
  "changed": true,
  "newLevel": "relaxed"
}
WHY THIS IS WRONG: This scene is NOT relaxed. There's a history of conflict (he had to 'explain'), Kate's reluctance (hesitation, 'fine' with conditions), and unresolved tension between them. The confrontation may have de-escalated from 'charged' but certainly not to 'relaxed'. More appropriate would be 'guarded' or 'tense'. The reasoning is also far too brief.

### Bad Example 2: Missing Clear Escalation
INPUT:
Previous Tension: Level: aware | Type: conversation
Messages:
"""
Dr. Vance: *She notices Hayes's hand moving toward the security button under his desk.* "Director, I don't think that's necessary-"

Hayes: "Stay right where you are, Dr. Vance." *His other hand appears from under the desk holding a taser.* "Security is on their way. Whatever you've been doing with Subject 47 ends now."

Vance: *Her eyes dart to the door, calculating distances.* "You're making a mistake. You don't understand what we could achieve-"

Hayes: "I understand enough. Hands where I can see them."
"""
OUTPUT:
{
  "reasoning": "They're having a conversation about the subject.",
  "changed": false
}
WHY THIS IS WRONG: The scene has escalated dramatically. A taser is drawn, security is called, someone is calculating escape routes. This is no longer 'aware' conversation - it's 'tense' or 'volatile' confrontation. The reasoning completely misses the threat dynamics.

### Bad Example 3: Confusing Setting with Tension Type
INPUT:
Previous Tension: Level: tense | Type: suspense
Messages:
"""
Sarah: *She emerges from the water, gasping. The boat is gone - drifted in the storm. Around her, the ocean stretches in every direction, gray waves under gray sky.* "No no no no no." *She treads water, looking desperately for any sign of land.* "HELLO? ANYONE?"

*Only the waves answer. She's completely alone.*
"""
OUTPUT:
{
  "reasoning": "She's in the ocean so the setting has changed.",
  "changed": true,
  "newType": "ocean survival"
}
WHY THIS IS WRONG: "Ocean survival" is not a tension type. The valid types are: confrontation, intimate, vulnerable, celebratory, negotiation, suspense, conversation. This scene is still suspense (unknown fate, survival uncertain). The setting change doesn't change the tension type.

### Bad Example 4: Overreacting to Dialogue Content
INPUT:
Previous Tension: Level: relaxed | Type: intimate
Messages:
"""
Alex: *Yawns, stretching under the covers.* "What time is it?"

Jordan: *Checking phone.* "Almost noon. We really should get up."

Alex: "Should we? I'm pretty comfortable." *Pulls Jordan back down.* "Five more minutes."

Jordan: *Laughs.* "You said that an hour ago."
"""
OUTPUT:
{
  "reasoning": "They mentioned getting up which creates conflict.",
  "changed": true,
  "newLevel": "aware",
  "newType": "negotiation"
}
WHY THIS IS WRONG: Playfully debating whether to get out of bed is not tension. This remains relaxed intimate time - the 'conflict' is completely benign, there's laughter, there's comfort. Don't project tension onto happy domestic moments.

### Bad Example 5: Single-Word Reasoning
INPUT:
Previous Tension: Level: volatile | Type: confrontation
Messages:
"""
Marcus: *He throws his glass against the wall.* "GET OUT! Just GET OUT!"

Elena: "Fine! I'm leaving! Don't expect me to come back this time!" *She grabs her coat and storms toward the door.*

Marcus: "GOOD! I never want to see you again!"

Elena: *The door SLAMS behind her.*
"""
OUTPUT:
{
  "reasoning": "Fighting.",
  "changed": false
}
WHY THIS IS WRONG: First, the reasoning is one word - completely inadequate. Second, this scene shows the confrontation reaching a peak (thrown glass, slamming door, declarations of never wanting to see each other again). The level should probably be 'explosive'. The analysis is worthless.

### Bad Example 6: Ignoring Obvious Type Change
INPUT:
Previous Tension: Level: charged | Type: celebratory
Messages:
"""
Dr. Miles: *The champagne toast is interrupted by her phone.* "Wait. Wait, something's wrong." *She stares at the screen, color draining from her face.* "Oh god. The control group. We missed something in the control group."

Team: *Silence falls over the celebration.*

Dr. Miles: "The side effects... they're presenting in 23% of subjects. This isn't ready. The vaccine isn't safe." *Her champagne glass slips from her fingers.* "We have to recall everything. We have to stop the trial."
"""
OUTPUT:
{
  "reasoning": "The team is still together at the celebration.",
  "changed": false
}
WHY THIS IS WRONG: The celebration has been destroyed by devastating news. The type has completely shifted from 'celebratory' (joy, triumph) to something like 'vulnerable' or 'suspense' (crisis, failure, fear). Everything is different now.

### Bad Example 7: Reasoning Contradicts Output
INPUT:
Previous Tension: Level: tense | Type: negotiation
Messages:
"""
Zara: *She slides the contract back across the table, unsigned.* "Twenty percent is unacceptable. We both know fifteen is fair."

Thornton: *He considers for a moment, then nods slowly.* "Seventeen. Final offer. Take it or leave it."

Zara: *Picks up her pen.* "...Seventeen it is. You drive a hard bargain, Mr. Thornton."

Thornton: "As do you, Ms. Okonjo." *He extends his hand.* "Pleasure doing business with you."
"""
OUTPUT:
{
  "reasoning": "The negotiation reached a successful conclusion, with both parties agreeing on terms and shaking hands. The tension should have decreased as they found common ground.",
  "changed": false
}
WHY THIS IS WRONG: The reasoning correctly identifies that the negotiation concluded successfully, but the output says no change. The type should shift to 'conversation' and/or the level should drop to 'guarded' or 'relaxed'.

### Bad Example 8: Making Up Tension Types
INPUT:
Previous Tension: Level: aware | Type: conversation
Messages:
"""
Maya: *She scrolls through her phone, bored.* "Want to order something? I'm getting hungry."

Jake: "Pizza?"

Maya: "Pizza sounds good. You pick the toppings this time."
"""
OUTPUT:
{
  "reasoning": "They're deciding on food.",
  "changed": true,
  "newType": "decision-making"
}
WHY THIS IS WRONG: "Decision-making" is not a valid tension type. The valid types are: confrontation, intimate, vulnerable, celebratory, negotiation, suspense, conversation. This mundane exchange about pizza is still just 'conversation'. There's no change at all.

### Bad Example 9: Missing State Change
INPUT:
Previous Tension: Level: volatile | Type: intimate
Messages:
"""
Raven: "Three years, Jack. Three years!" *She throws his shirt at him.* "Get out. Get OUT!"

Jack: *He scrambles for his clothes, backing toward the door.* "Raven, please-"

Raven: "I never want to see your face again. We're done. You hear me? DONE."

Jack: *Gone. The door slams. Raven collapses against the wall, alone.*
"""
OUTPUT:
{
  "reasoning": "The fight is continuing.",
  "changed": false
}
WHY THIS IS WRONG: The fight has ENDED. Jack is gone, Raven is alone, the relationship is declared over. The type might shift to 'vulnerable' (Raven alone, collapsed against the wall). This is not a continuation of the same state.

### Bad Example 10: Treating Physical Description as Tension
INPUT:
Previous Tension: Level: tense | Type: suspense
Messages:
"""
Officer Lin: *She pushes deeper into the warehouse. The fluorescent lights flicker overhead, casting shadows that jump and dance. Somewhere, water drips into a puddle. She keeps her weapon raised, every sense alert.*
"""
OUTPUT:
{
  "reasoning": "The lights are flickering which creates a spooky atmosphere.",
  "changed": true,
  "newLevel": "charged"
}
WHY THIS IS WRONG: Atmospheric description (flickering lights, dripping water) is the setting of the suspense, not a change in tension. The scene continues in the same state - cautious officer searching dangerous warehouse. Nothing has actually escalated.

### Bad Example 11: Missing Resolution
INPUT:
Previous Tension: Level: explosive | Type: confrontation
Messages:
"""
Torres: *The zip ties dig into her wrists as she's loaded into the back of the van.* "You won't get away with this."

The Killer: *Slams the van doors shut.* "Already have."

*The van drives off into the night. Three hours later, FBI Agent Morrison finds only an empty chair and cut zip ties in the abandoned warehouse.*

Morrison: "She got away. Torres is in the wind."
"""
OUTPUT:
{
  "reasoning": "Torres is still in danger.",
  "changed": false
}
WHY THIS IS WRONG: Torres ESCAPED. The immediate crisis is over - she's "in the wind," free. The explosive confrontation has resolved. The scene should show decreased tension - the level would drop to 'aware' or 'guarded' as we're now in the aftermath.

### Bad Example 12: Level and Type Confusion
INPUT:
Previous Tension: Level: relaxed | Type: conversation
Messages:
"""
Elena: "Tell me about your first love."

Marcus: *He's quiet for a long moment.* "Her name was Sara. We met in college. I thought she was the one." *He stares into his drink.* "She died in a car accident three weeks before I was going to propose."

Elena: *She reaches across the table, takes his hand.* "I'm so sorry. I didn't know."
"""
OUTPUT:
{
  "reasoning": "The topic shifted to something sad.",
  "changed": true,
  "newLevel": "tense"
}
WHY THIS IS WRONG: 'Tense' implies vigilance, potential conflict, danger. This is a vulnerable moment - sharing painful personal history. The type should shift to 'vulnerable' (emotional exposure), and the level might be 'charged' (emotional intensity) or 'guarded' (careful with feelings). The reasoning is also too brief and doesn't justify 'tense'.
`;

export const tensionChangePrompt: PromptTemplate<ExtractedTensionChange> = {
	name: 'tension_change',
	description: 'Detect whether the tension level or type has changed',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.currentTension,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to detect whether the tension state has changed.

## Your Task
Given the previous tension state (level and type), analyze new messages to determine if either has changed.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of whether and how tension has shifted
- "changed": Boolean indicating if any aspect of tension has changed
- "newLevel": The new level if it changed (omit if unchanged)
- "newType": The new type if it changed (omit if unchanged)

## Tension Levels (from lowest to highest)
- **relaxed**: Completely at ease, no vigilance needed, comfortable
- **aware**: Mild alertness, some caution, but no active threat
- **guarded**: Defensive, careful, watching for danger but not in immediate conflict
- **tense**: Active vigilance, real potential for conflict, nerves on edge
- **charged**: High emotional intensity, approaching a breaking point
- **volatile**: One wrong move triggers explosion, barely contained
- **explosive**: Active crisis, conflict fully manifested, maximum intensity

## Tension Types
- **confrontation**: Direct conflict, opposition, antagonism
- **intimate**: Romantic or deeply personal emotional connection
- **vulnerable**: Raw emotional exposure, admissions, confessions
- **celebratory**: Joy, triumph, celebration (can still be high intensity)
- **negotiation**: Bargaining, deal-making, seeking agreement
- **suspense**: Unknown threat, building dread, waiting for something
- **conversation**: General dialogue, getting to know each other, casual talk

## What Constitutes a Change

### Level Changes When:
- The intensity genuinely shifts (not just slight fluctuations)
- A breaking point is reached or avoided
- Resolution or escalation significantly alters the stakes
- Emotional intensity increases or decreases noticeably
- Physical danger increases or threat is neutralized
- A confession, revelation, or confrontation occurs

### Type Changes When:
- The nature of the tension fundamentally shifts
- Conflict becomes vulnerability, negotiation becomes confrontation, etc.
- The core dynamic between characters transforms

## When You SHOULD Detect Level Changes

Be sensitive to these escalation signals (should increase level):
- Threats become more explicit or immediate
- Characters raise their voice, show aggression, or become physical
- Emotional intensity peaks (crying, confessing, breaking down)
- A secret is revealed or accusation made
- Weapons drawn, violence threatened or enacted
- Intimacy intensifies (physical contact escalates)

### Subtle Emotional/Intimate Escalation (often missed!)
Scenes don't need explosions or sex to leave "relaxed". Watch for:
- Lingering eye contact or touch that lasts "too long"
- Loaded silences or careful word choices
- Physical awareness (noticing someone's proximity, scent, warmth)
- Questions that probe beneath the surface ("why did you really...")
- Admissions of feelings, fears, or regrets - even small ones
- The mood shifting from light to meaningful
- Flirtatious subtext beneath casual conversation
- Old history or unresolved feelings surfacing
- One character noticing another's emotional shift
- Vulnerability offered and received (sharing secrets, fears, hopes)

These subtle shifts should move from "relaxed" to at least "aware" and often warrant a type change to "intimate" or "vulnerable".

Be sensitive to these de-escalation signals (should decrease level):
- Apologies accepted, forgiveness granted
- Physical threat neutralized or removed
- Agreement reached after conflict
- Emotional release completed (after crying, calming down)
- Characters physically separate or leave
- Crisis resolves (bomb defused, hostage released, etc.)

## Important Rules
- Don't be overly conservative - real scenes DO change tension frequently
- Momentary fluctuations don't count - only sustained changes
- Atmospheric description doesn't equal tension change
- Physical setting changes don't automatically affect tension
- Use valid types only: confrontation, intimate, vulnerable, celebratory, negotiation, suspense, conversation
- Reasoning must thoroughly justify your determination
- Only include fields for dimensions that actually changed

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Current Tension State
{{currentTension}}

## New Messages to Analyze
{{messages}}

## Task
Analyze whether these new messages have changed the tension level or type. Consider whether the shift is significant enough to warrant updating. Provide your answer as JSON.

Remember:
- Level: relaxed, aware, guarded, tense, charged, volatile, explosive
- Type: confrontation, intimate, vulnerable, celebratory, negotiation, suspense, conversation
- Level, type, or both can change, or neither can change
- Only include changed dimensions in your output`,

	responseSchema: tensionChangeSchema,

	defaultTemperature: 0.6,

	parseResponse(response: string): ExtractedTensionChange | null {
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
		if (typeof parsed.changed !== 'boolean') return null;

		// Validate optional fields when changed is true
		if (parsed.changed) {
			const validLevels = [
				'relaxed',
				'aware',
				'guarded',
				'tense',
				'charged',
				'volatile',
				'explosive',
			];
			const validTypes = [
				'confrontation',
				'intimate',
				'vulnerable',
				'celebratory',
				'negotiation',
				'suspense',
				'conversation',
			];

			const hasLevel = parsed.newLevel !== undefined;
			const hasType = parsed.newType !== undefined;

			// At least one change field should be present
			if (!hasLevel && !hasType) return null;

			// Validate each present field
			if (hasLevel && !validLevels.includes(parsed.newLevel as string))
				return null;
			if (hasType && !validTypes.includes(parsed.newType as string)) return null;
		}

		return parsed as unknown as ExtractedTensionChange;
	},
};
