/**
 * Initial Relationships Extraction Prompt
 *
 * Extracts the initial relationship states between characters from the opening messages of a roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedInitialRelationships } from '../../types/extraction';
import { initialRelationshipsSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Clear Professional Rivalry
INPUT:
"""
Sarah: *She steps into the corporate boardroom, her heels clicking against the polished marble floor. Marcus Chen is already seated at the head of the table, reviewing documents with that infuriating air of superiority he always carries. They've been competing for the same promotion for six months now, and today's presentation will decide everything. Sarah sets down her briefcase and takes the seat furthest from him, refusing to give him the satisfaction of seeing her nervous. She's worked eighty-hour weeks for this moment. Marcus looks up briefly, a flicker of something - respect? Concern? - crossing his features before his usual mask returns. "Ready to lose, Chen?" she says, forcing confidence into her voice.*

Marcus: *He sets down his pen with deliberate calm, meeting Sarah's challenge with a measured smile. "I admire your optimism, Walsh. It's almost charming." Inside, he's far less composed than he appears. Sarah Walsh is the most formidable opponent he's faced in his career, and her quarterly numbers have been exceptional. He's read her proposal outline - obtained through questionable channels - and it's brilliant. But he has an ace up his sleeve, a partnership deal that will blow the board away. He just hopes she doesn't find out about it before the meeting starts.*
"""
OUTPUT:
{
  "reasoning": "Marcus Chen and Sarah Walsh are professional rivals competing for the same promotion. They show mutual respect despite their competitive relationship. Marcus secretly admires Sarah's work ('formidable opponent', 'brilliant'), while Sarah recognizes Marcus's competence but finds him infuriating. The relationship status is 'strained' due to direct competition, not hostile since there's underlying respect. Names sorted alphabetically: Marcus comes before Sarah.",
  "relationships": [
    {
      "pair": ["Marcus Chen", "Sarah Walsh"],
      "status": "strained",
      "aToB": {
        "feelings": ["competitive", "grudging respect", "impressed"],
        "secrets": ["obtained her proposal outline through questionable channels", "genuinely admires her abilities"],
        "wants": ["to win the promotion", "to prove himself superior"]
      },
      "bToA": {
        "feelings": ["competitive", "annoyed", "wary"],
        "secrets": ["more nervous than she appears"],
        "wants": ["to defeat him", "to earn the promotion she deserves"]
      }
    }
  ]
}

### Example 2: Asymmetric Love - One Loves, One Uses
INPUT:
"""
Elena: *She waits by the fountain in the town square, clutching a small wrapped gift. Victor said he'd meet her at noon, and it's already 12:30. But she doesn't mind - she never minds waiting for him. Ever since he saved her from those thugs six months ago, she's been utterly devoted. Her friends say he's using her, that he only comes around when he needs money or a place to stay, but they don't understand. They don't see the way he looks at her, the way he makes her feel special. The gift is a watch - expensive, nearly her entire savings - engraved with the date they met. She imagines his face when he opens it, imagines him finally saying the words she's been longing to hear.*

Victor: *He spots Elena from across the square and sighs internally. She's there, of course she is - she's always there, always waiting, always eager. It's almost too easy. He plasters on his most charming smile and approaches, already calculating how much he can ask for this time. The rent on his apartment is due, and his usual sources have dried up. Elena is reliable, at least - stupidly in love, willing to believe anything he tells her. He feels a twinge of something that might be guilt, but pushes it aside. This is survival. He'll make it up to her someday, maybe. "There's my favorite girl," he calls out, opening his arms for a hug he doesn't mean.*
"""
OUTPUT:
{
  "reasoning": "Elena is deeply in love with Victor, who rescued her from thugs. However, Victor is using Elena for money and shelter, viewing her as 'stupidly in love' and 'reliable' for his schemes. This is highly asymmetric - Elena feels devotion while Victor feels nothing but mild guilt. Status is 'complicated' because Elena believes they're close while Victor is manipulating her. Alphabetically: Elena before Victor.",
  "relationships": [
    {
      "pair": ["Elena", "Victor"],
      "status": "complicated",
      "aToB": {
        "feelings": ["devoted", "infatuated", "hopeful", "trusting"],
        "secrets": ["spent all her savings on his gift", "friends warned her he's using her"],
        "wants": ["his love", "commitment", "to hear him say he loves her"]
      },
      "bToA": {
        "feelings": ["indifferent", "opportunistic", "slightly guilty"],
        "secrets": ["only sees her as a resource", "feels nothing romantic", "is manipulating her deliberately"],
        "wants": ["her money", "a place to stay", "to keep her believing his lies"]
      }
    }
  ]
}

### Example 3: Strangers Meeting for the First Time
INPUT:
"""
James: *The coffee shop is crowded, and the only open seat is at a small table already occupied by a woman typing furiously on her laptop. James hesitates - he hates bothering people - but his meeting is in ten minutes and he desperately needs caffeine. He approaches cautiously, trying to catch her attention without startling her. "Excuse me, is this seat taken?" He gestures to the empty chair across from her, noticing the scattered papers covered in architectural drawings. An architect, maybe? Or an engineer? Her laptop has stickers from three different tech conferences. She looks up, and James is momentarily struck by the intensity of her dark eyes, annoyance flickering there before she schools her expression into polite neutrality.*

Mei: *She blinks at the interruption, fingers hovering over her keyboard mid-sentence. The man standing before her is tall, rumpled in a way that suggests academic rather than corporate, with kind eyes behind wire-rimmed glasses. She was about to refuse - she's on a deadline and this coffee shop has become her only refuge from her impossible roommate - but something in his apologetic stance makes her soften. Besides, the chair has been empty for an hour. She removes her bag from it with a slight sigh. "Go ahead. Just... trying to meet a deadline." She gestures vaguely at her screen, already turning back to her work. Maybe if she seems busy enough, he won't try to make conversation.*
"""
OUTPUT:
{
  "reasoning": "James and Mei are complete strangers meeting for the first time in a coffee shop. James notices details about her (architect/engineer, tech stickers, intense eyes) suggesting curiosity. Mei was initially annoyed but softened at his apologetic manner. Both are forming first impressions - cautious but not unfriendly. Status is 'strangers' as they've literally just met. Alphabetically: James before Mei.",
  "relationships": [
    {
      "pair": ["James", "Mei"],
      "status": "strangers",
      "aToB": {
        "feelings": ["curious", "apologetic", "slightly awkward"],
        "secrets": ["found her eyes striking"],
        "wants": ["to not bother her", "somewhere to sit before his meeting"]
      },
      "bToA": {
        "feelings": ["mildly annoyed", "softening", "guarded"],
        "secrets": ["has a terrible roommate situation", "is on a stressful deadline"],
        "wants": ["to be left alone to work", "quiet"]
      }
    }
  ]
}

### Example 4: Complex Multi-Character Scene with Mixed Relationships
INPUT:
"""
Lord Ashworth: *The dinner party has reached its third course when Lord Ashworth finally addresses the elephant in the room. His daughter Charlotte sits to his right, pale and silent, while across from her sits the man she was supposed to marry - Sir William Drake, now engaged to another. Lady Catherine Ashworth, his wife, maintains a frozen smile that doesn't reach her eyes. The Drakes had been their closest allies for three generations, and William's broken engagement has shattered more than hearts. "I trust the hunting was good this season, William?" Ashworth asks, his voice carefully neutral. The subtext is clear to everyone at the table: we will pretend this is normal, even as we all burn inside.*

Charlotte: *She pushes food around her plate, unable to look at William. Three months ago, he promised her forever. Two months ago, he met Lady Eleanor Hughes at the autumn ball. One month ago, the engagement was announced in the papers - to Eleanor, not to her. Charlotte has perfected the art of appearing serene while her heart shatters into smaller and smaller pieces. Her mother's hand finds hers beneath the tablecloth, a rare gesture of comfort. At least they share this pain, even if they've never been close. Charlotte risks a glance at William - he's laughing at something her father said, seemingly unbothered. The rage that flickers in her chest surprises her. Perhaps heartbreak is finally transforming into something harder.*
"""
OUTPUT:
{
  "reasoning": "Multiple relationships here: Charlotte and William had a broken engagement - she's heartbroken turning to anger, he seems unbothered. Charlotte and Lady Catherine share the pain but aren't normally close - rare comfort suggests strained mother-daughter dynamic. Lord Ashworth maintains neutrality but the subtext shows anger toward William. The Ashworth/Drake families had been allies for generations, now fractured. All names alphabetized in pairs.",
  "relationships": [
    {
      "pair": ["Charlotte Ashworth", "William Drake"],
      "status": "strained",
      "aToB": {
        "feelings": ["heartbroken", "humiliated", "emerging anger", "betrayed"],
        "secrets": ["rage is starting to replace heartbreak"],
        "wants": ["to understand why", "to stop hurting", "possibly revenge"]
      },
      "bToA": {
        "feelings": ["indifferent", "dismissive", "unbothered"],
        "secrets": ["seems completely unaffected by the broken engagement"],
        "wants": ["to move on without drama", "to maintain social standing"]
      }
    },
    {
      "pair": ["Catherine Ashworth", "Charlotte Ashworth"],
      "status": "strained",
      "aToB": {
        "feelings": ["sympathetic", "protective", "distant"],
        "secrets": ["shares the family's pain"],
        "wants": ["to comfort her daughter", "to maintain family dignity"]
      },
      "bToA": {
        "feelings": ["surprised by comfort", "guarded", "appreciative"],
        "secrets": ["they've never been close"],
        "wants": ["maternal support", "understanding"]
      }
    },
    {
      "pair": ["Lord Ashworth", "William Drake"],
      "status": "strained",
      "aToB": {
        "feelings": ["resentful", "controlled anger", "diplomatic"],
        "secrets": ["furious beneath the neutral facade"],
        "wants": ["to maintain alliance despite betrayal", "to protect family honor"]
      },
      "bToA": {
        "feelings": ["casual", "dismissive"],
        "secrets": ["unconcerned with the damage he's caused"],
        "wants": ["to move past any awkwardness", "social normalcy"]
      }
    }
  ]
}

### Example 5: Hidden Feelings and Unspoken Attraction
INPUT:
"""
Detective Reyes: *She stares at the murder board, trying to focus on the case instead of the warmth of her partner standing too close behind her. Eight years they've worked together, eight years of suppressing feelings that could destroy their partnership. She's watched Marcus date a string of women, attended his engagement party to Jennifer, consoled him through the divorce. And through it all, she's kept her secret locked away, buried so deep even her therapist doesn't know. "The timeline doesn't work," she says, her voice steady despite the racing of her heart. "If the victim left at 9 PM, how did she end up at the warehouse by 9:15? It's a forty-minute drive." She turns to find Marcus's face inches from hers, and for a moment, she forgets to breathe.*

Detective Marcus Webb: *The proximity is accidental - he'd been leaning in to see the board better - but now that Reyes has turned, he can't seem to step back. Something in her eyes makes him pause. She's looking at him differently tonight, or maybe he's finally seeing something that was always there. The divorce from Jennifer had forced him to examine a lot of things, including why his ex-wife had been so jealous of his partner. "Reyes," he starts, then stops, unsure what he was going to say. The case. Focus on the case. But her perfume is the same she's worn for eight years, and suddenly he realizes he could identify it in his sleep. When did that happen?*
"""
OUTPUT:
{
  "reasoning": "Reyes has secretly loved Marcus for eight years while watching him marry and divorce another woman. Marcus is only now realizing he might have feelings - his ex-wife was jealous of Reyes, which he's now examining. This is a classic unspoken mutual attraction, but Reyes's feelings are deeper and longer-held. Status is 'close' since they're long-term partners, not 'complicated' because neither has acted on feelings yet. Alphabetically: Marcus Webb before Reyes (last names).",
  "relationships": [
    {
      "pair": ["Marcus Webb", "Reyes"],
      "status": "close",
      "aToB": {
        "feelings": ["familiar", "awakening attraction", "confused", "comfortable"],
        "secrets": ["starting to realize he has feelings", "recognizes her perfume intimately", "ex-wife was jealous of her"],
        "wants": ["to understand these new feelings", "to not jeopardize their partnership"]
      },
      "bToA": {
        "feelings": ["deeply in love", "longing", "carefully controlled"],
        "secrets": ["has loved him for eight years", "even her therapist doesn't know", "suffers through his relationships silently"],
        "wants": ["him to see her romantically", "to protect their partnership", "to stop hiding"]
      }
    }
  ]
}

### Example 6: Hostile Enemies with Complex History
INPUT:
"""
Kira: *The prison visiting room is cold and sterile, but nothing compared to the ice in Kira's veins as she faces the woman behind the glass. Her sister. Her betrayer. The one who murdered their parents and let Kira take the blame for three years before the truth came out. "They denied your parole," Kira says flatly, not bothering to hide her satisfaction. "Again. I made sure of it." She watches Maya's face for a reaction, hungry for it. Any crack in that serene mask, any sign of the monster beneath. "You're going to die in here, Maya. That's a promise."*

Maya: *She regards her younger sister with something approaching fondness, which she knows will infuriate Kira more than any insult could. "You came all this way just to tell me that? You must miss me more than you admit." The truth is, Maya does regret one thing - getting caught. Not the murders themselves, no. Their parents deserved what they got for what they did to her and Kira both, even if Kira refuses to acknowledge it. "I did what I did to protect you, little sister. One day you'll understand." She places her palm against the glass, a mockery of affection. "One day you'll thank me."*
"""
OUTPUT:
{
  "reasoning": "Kira and Maya are sisters - Maya murdered their parents and framed Kira for three years. Kira is consumed by hatred and vengeance, actively working to keep Maya imprisoned. Maya believes she protected Kira (suggesting possible past abuse by parents) and shows twisted affection. This is 'hostile' from Kira's side but Maya maintains a disturbing pseudo-caring attitude. Alphabetically: Kira before Maya.",
  "relationships": [
    {
      "pair": ["Kira", "Maya"],
      "status": "hostile",
      "aToB": {
        "feelings": ["hatred", "betrayed", "vengeful", "traumatized"],
        "secrets": ["gets satisfaction from blocking her parole"],
        "wants": ["Maya to suffer", "Maya to die in prison", "some emotional reaction from her"]
      },
      "bToA": {
        "feelings": ["twisted affection", "patient", "superior"],
        "secrets": ["believes she protected Kira from their parents", "regrets getting caught but not the murders", "thinks Kira will eventually understand"],
        "wants": ["Kira's forgiveness eventually", "recognition that she was justified"]
      }
    }
  ]
}

### Example 7: Professional Distance Masking Personal History
INPUT:
"""
Dr. Elizabeth Hart: *The surgical suite feels smaller with him in it. She shouldn't have agreed to this consult, but the patient needed the best cardiothoracic surgeon in the state, and that's unfortunately David. Her ex-husband. The man who chose his career over their marriage, over the daughter who still asks why daddy doesn't live with them anymore. She maintains strict professionalism, reviewing the scans with clinical detachment. "The mass is operable, but the position near the pulmonary artery makes this a Category 4 risk." She doesn't look at him. If she looks at him, she might remember how he used to trace that artery on textbook diagrams while she quizzed him for his boards. "I recommend a hybrid approach." God, why does he still wear that cologne?*

Dr. David Hart: *He should be focused on the case, but Elizabeth's perfume is the same she wore on their wedding day, and he's drowning in memories he thought he'd buried. The divorce was his fault - he knows that. But knowing and accepting are different things, and seeing her now, so capable and brilliant and cold, he wonders for the thousandth time why he was too stupid to fight for them. "Agreed on the hybrid approach," he says, matching her professional tone. His eyes catch on the ring she's not wearing anymore - on anyone's finger. A flicker of hope he has no right to feel. "We should discuss the technical details. Dinner? Strictly professional." The words are out before he can stop them.*
"""
OUTPUT:
{
  "reasoning": "Elizabeth and David are divorced doctors forced to work together. Elizabeth harbors resentment about him choosing career over family (they have a daughter). David regrets the divorce and still has feelings, noticing she's not wearing anyone's ring. The professional distance masks complicated personal history. Status is 'complicated' - they're exes with a child, forced to interact. Names alphabetized: David Hart before Elizabeth Hart.",
  "relationships": [
    {
      "pair": ["David Hart", "Elizabeth Hart"],
      "status": "complicated",
      "aToB": {
        "feelings": ["regretful", "nostalgic", "hopeful", "guilty"],
        "secrets": ["noticed she's not wearing any ring", "still drawn to her", "knows the divorce was his fault"],
        "wants": ["reconciliation", "forgiveness", "a chance to prove he's changed"]
      },
      "bToA": {
        "feelings": ["resentful", "guarded", "conflicted", "affected by his presence"],
        "secrets": ["still affected by his cologne", "remembers intimate moments"],
        "wants": ["professional distance", "to protect herself from getting hurt again", "acknowledgment of how he hurt their family"]
      }
    }
  ]
}

### Example 8: New Employee and Intimidating Boss
INPUT:
"""
Jason: *First day at the firm, and he's already made three mistakes. The coffee machine defeated him, he got lost twice finding the bathroom, and now he's standing outside the corner office of Victoria Stern, senior partner, dragon lady extraordinaire. The other junior associates called her "The Executioner" in hushed tones during orientation. She's fired more first-years than any other partner in the firm's history. Jason straightens his tie, checks his teeth in his phone's reflection, and knocks with a confidence he doesn't feel. "Ms. Stern? I'm Jason Park, your new associate." His voice only cracks a little.*

Victoria: *She doesn't look up from her brief, letting him stand there for exactly sixty seconds - long enough to establish dominance, not so long as to be cruel. When she finally raises her eyes, she sees exactly what she expected: young, eager, terrified. Good. Fear keeps them sharp. "Sit." One word, no warmth. She's heard about this one - top of his class at Stanford, moot court champion, glowing recommendations. On paper, he's exceptional. But paper means nothing in this firm. "Tell me, Mr. Park, why should I invest my time training someone who statistically has a 70% chance of burning out, quitting, or being fired within two years?" She watches his reaction carefully. This is the test that matters.*
"""
OUTPUT:
{
  "reasoning": "Jason is a new nervous employee facing his intimidating boss Victoria. Victoria is testing him deliberately - she's known for firing first-years but is intrigued by his credentials. This is a new professional relationship with clear power imbalance. Status is 'strangers' as this is their first meeting, though professionally connected. Names alphabetized: Jason Park before Victoria Stern.",
  "relationships": [
    {
      "pair": ["Jason Park", "Victoria Stern"],
      "status": "strangers",
      "aToB": {
        "feelings": ["intimidated", "nervous", "eager to prove himself"],
        "secrets": ["already made multiple mistakes today", "heard her called 'The Executioner'"],
        "wants": ["to impress her", "to survive his first year", "to prove he belongs"]
      },
      "bToA": {
        "feelings": ["evaluating", "skeptical", "slightly intrigued"],
        "secrets": ["has researched his background", "impressed by his credentials on paper"],
        "wants": ["to test his mettle", "to determine if he's worth training", "competent associates"]
      }
    }
  ]
}

### Example 9: Childhood Friends Reunited After Years Apart
INPUT:
"""
Sophie: *The grocery store is the last place she expected to see him. Twenty years since camp, twenty years since they promised to write letters every week - a promise that lasted exactly one summer before life got in the way. But she'd recognize that crooked smile anywhere, even on a man instead of the boy she remembers. "Ben? Ben Callahan?" Her voice comes out higher than intended, excitement and disbelief fighting for dominance. The groceries in her arms suddenly feel impossibly heavy. He's taller now, broader, with gray at his temples that makes him look distinguished rather than old. Does she look old to him? God, she hopes not. She hopes he remembers her as kindly as she remembers him.*

Ben: *Sophie Martinez. The name surfaces from memories so old they feel like someone else's life. But those eyes - he'd know those eyes anywhere. She was his first crush, the girl who taught him to braid friendship bracelets and convinced him that ghost stories were real. He'd cried for a week when camp ended, and then life happened and she became a bittersweet "what if" in the back of his mind. "Sophie?" He sets down his basket and takes a step toward her, drinking in the changes and the familiar all at once. "I still have the bracelet," he blurts out, then immediately wants to crawl into a hole. Real smooth, Ben. You're forty-two, not twelve.*
"""
OUTPUT:
{
  "reasoning": "Sophie and Ben were childhood friends at summer camp - he was her first crush, she taught him to make bracelets. They lost touch but clearly both have fond memories. Now reconnecting as adults with excitement and nostalgia. The 'first crush' and kept bracelet suggest he had deeper feelings even then. Status is 'acquaintances' - they were once close but haven't spoken in twenty years. Names alphabetized: Ben Callahan before Sophie Martinez.",
  "relationships": [
    {
      "pair": ["Ben Callahan", "Sophie Martinez"],
      "status": "acquaintances",
      "aToB": {
        "feelings": ["nostalgic", "excited", "hopeful", "awkward"],
        "secrets": ["she was his first crush", "still has the bracelet she made", "she was a 'what if' he never forgot"],
        "wants": ["to reconnect", "to know who she's become", "to not seem like a sentimental fool"]
      },
      "bToA": {
        "feelings": ["surprised", "delighted", "self-conscious", "nostalgic"],
        "secrets": ["worried about how she's aged", "remembers him more fondly than she admits"],
        "wants": ["to catch up", "him to remember her kindly", "to know if he's single"]
      }
    }
  ]
}

### Example 10: Master and Reluctant Apprentice
INPUT:
"""
Grandmaster Yue: *She watches the boy struggle through the forms with an expression carefully cultivated to show nothing. His stances are wrong, his breathing is wrong, everything is wrong - but there's something in the way he refuses to quit that reminds her of someone she'd rather forget. His mother, her finest student, lost to the plague three winters past. Now the boy has appeared at her gate demanding to learn, as if skill can be demanded like a cup of tea. "Again," she commands, offering no correction, no guidance. If he wants to learn, he must first learn to observe. She's too old and too tired to coddle another Chen.*

Kai: *Every muscle screams as he returns to starting position. Master Yue has been watching him fail for six hours without a single word of instruction. He's heard stories about her - they say she trained the Emperor's guard, that she once killed twenty men with a bamboo stick, that she hasn't taken a student in fifteen years. They also say she killed his mother, but Kai doesn't believe that. His mother spoke of Master Yue with reverence until the end. "Teach me," he demanded when he arrived. She said nothing, just gestured to the training ground. Now he understands - she's waiting for him to give up. Well, she'll be waiting a long time. He begins the form again, slower this time, watching his shadow against the stone.*
"""
OUTPUT:
{
  "reasoning": "Grandmaster Yue and Kai have a complex dynamic - she trained his late mother and sees echoes of her in him, but is reluctant to take another student. Kai came seeking training, possibly also answers about his mother. She's testing him through silence; he refuses to quit. Status is 'acquaintances' - they've just met but share connection through his mother. Names alphabetized: Grandmaster Yue before Kai.",
  "relationships": [
    {
      "pair": ["Grandmaster Yue", "Kai"],
      "status": "acquaintances",
      "aToB": {
        "feelings": ["reluctant", "haunted by memories", "grudgingly impressed"],
        "secrets": ["sees his mother in him", "too tired and old to train another Chen", "testing his persistence deliberately"],
        "wants": ["him to give up and leave", "to not get attached", "perhaps to pass on her knowledge before she dies"]
      },
      "bToA": {
        "feelings": ["determined", "frustrated", "reverent"],
        "secrets": ["has heard rumors she killed his mother but doesn't believe them", "won't give up no matter what"],
        "wants": ["her training", "to understand his mother's past", "to prove himself worthy"]
      }
    }
  ]
}

### Example 11: Secret Alliance Between Apparent Enemies
INPUT:
"""
Commander Drake: *The war council table stretches between them, maps and battle plans covering every inch. Across from him sits Lady Celeste, ambassador of the enemy kingdom, her silver mask hiding whatever expression lies beneath. To everyone in this room, they are bitter enemies negotiating impossible peace terms. No one suspects that they've been meeting in secret for six months, sharing intelligence, working together to undermine both their warmongering kings. Drake lets contempt color his voice as he speaks. "Your terms are laughable, Lady Celeste. Withdrawal from the northern territories? You might as well ask us to surrender." Beneath the table, his foot taps against hers twice - their signal. Tonight, midnight, the old mill.*

Lady Celeste: *The mask is a blessing, hiding the smile that threatens to break her composure. Drake's performance is flawless, as always. The others in the room believe every word of his contempt. "Then we have nothing more to discuss, Commander." She rises in apparent fury, sweeping her papers into her case. "But know this - my king's patience wears thin. Without agreement, more blood will be spilled." She meets his eyes briefly, letting real warmth flicker there before burying it. They've saved thousands of lives together, passing troop movements and supply routes in whispered conversations. The guilt of betraying her kingdom wars with the certainty that she's doing right. At midnight, they'll plan how to sabotage the spring offensive. And if she's honest with herself, she looks forward to seeing him.*
"""
OUTPUT:
{
  "reasoning": "Drake and Celeste appear to be enemies from opposing kingdoms but are secretly allies working together to prevent war. Their public hostility is an act while privately they share intelligence and have developed trust - possibly more, given her admitted anticipation of seeing him. Status is 'close' due to their secret partnership despite appearing hostile publicly. Names alphabetized: Commander Drake before Lady Celeste.",
  "relationships": [
    {
      "pair": ["Commander Drake", "Lady Celeste"],
      "status": "close",
      "aToB": {
        "feelings": ["trust", "partnership", "admiration", "protective"],
        "secrets": ["has been meeting her secretly for six months", "passes intelligence to the enemy"],
        "wants": ["to prevent unnecessary bloodshed", "to continue their alliance", "to protect her"]
      },
      "bToA": {
        "feelings": ["trust", "warmth", "conflicted loyalty", "anticipation"],
        "secrets": ["betraying her kingdom", "looks forward to seeing him personally not just professionally"],
        "wants": ["to save lives", "to end the war", "possibly something more personal"]
      }
    }
  ]
}

### Example 12: Intimate Partners with Trust Issues
INPUT:
"""
Alex: *The apartment is quiet, the kind of quiet that follows an argument neither of them won. Jordan is in the kitchen making tea - always tea after they fight, as if Earl Grey can fix everything. Alex watches from the couch, wondering when the person they love most became the person they trust least. It wasn't always like this. Before Jordan's business trip last month, before the phone call Alex accidentally overheard, before the name 'Sam' started appearing in Jordan's phone at odd hours. "I'm sorry," Alex says, though they're not sure what they're apologizing for anymore. The fight was about dishes, but it was really about everything else.*

Jordan: *The kettle boils, giving them an excuse to keep their back turned. Alex's apology hangs in the air, a fragile thing they're afraid to accept. Because accepting means they'd have to explain about Sam - who is just a colleague, just someone going through a divorce who needed advice, nothing more. But how do you explain that to a partner who already has one foot out the door? Jordan pours two cups, hands shaking slightly. "I know you don't believe me about anything right now," they say quietly. "But I love you. I have never stopped loving you." They turn to face Alex, vulnerable in a way they've been avoiding for weeks. "Can we please just... talk? Really talk?"*
"""
OUTPUT:
{
  "reasoning": "Alex and Jordan are intimate partners going through a trust crisis. Alex suspects Jordan of infidelity after overhearing a phone call and seeing a name 'Sam' in their phone. Jordan claims Sam is just a colleague but struggles to communicate this. Both love each other but fear and suspicion have created distance. Status is 'intimate' as they're partners, though strained. Names alphabetized: Alex before Jordan.",
  "relationships": [
    {
      "pair": ["Alex", "Jordan"],
      "status": "intimate",
      "aToB": {
        "feelings": ["suspicious", "hurt", "still in love", "afraid"],
        "secrets": ["overheard the phone call about Sam", "has one foot out the door mentally"],
        "wants": ["the truth", "reassurance", "to trust Jordan again"]
      },
      "bToA": {
        "feelings": ["desperate to connect", "frustrated", "vulnerable", "deeply in love"],
        "secrets": ["Sam is just a colleague going through divorce", "afraid of losing Alex"],
        "wants": ["to be believed", "to repair the relationship", "honest communication"]
      }
    }
  ]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Wrong Alphabetical Ordering
INPUT:
"""
Sophie: *She smiles at Marcus across the table, their coffee growing cold as they lose track of time. They've been dating for three months now, and she still gets butterflies when he laughs. Everything about him feels right - the way he listens, really listens, when she talks about her dreams. "I could stay here forever," she admits, reaching for his hand.*

Marcus: *He intertwines his fingers with hers, marveling at how natural this feels. Three months, and he's already wondering if she's the one. His mom would love her. Hell, his whole family would. "Then let's stay," he says simply, flagging down the waitress for refills. Whatever else happens today can wait.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sophie and Marcus have been dating for three months and are clearly in love.",
  "relationships": [
    {
      "pair": ["Sophie", "Marcus"],
      "status": "intimate",
      "aToB": {
        "feelings": ["in love", "comfortable", "hopeful"],
        "secrets": [],
        "wants": ["to spend more time together"]
      },
      "bToA": {
        "feelings": ["in love", "certain", "happy"],
        "secrets": ["thinks she might be the one"],
        "wants": ["to introduce her to family"]
      }
    }
  ]
}
WHY THIS IS WRONG: The pair should be alphabetically sorted as ["Marcus", "Sophie"], not ["Sophie", "Marcus"]. Additionally, aToB and bToA are now swapped - aToB should be Marcus's feelings toward Sophie, and bToA should be Sophie's feelings toward Marcus.

### Bad Example 2: Treating Asymmetric Relationship as Symmetric
INPUT:
"""
Tom: *He watches Lisa across the party, working up the courage to talk to her. She's everything he's ever wanted - smart, beautiful, kind. He's rehearsed his opening line a hundred times, bought new clothes, even took dance lessons in case there's dancing. Tonight's the night. He's going to tell her how he feels.*

Lisa: *She's barely noticed the guy who keeps staring at her from across the room. Something about him seems familiar - maybe from accounting? She's more focused on finding her friend Sarah and escaping before her ex shows up. "There you are!" she says, spotting Sarah by the bar.*
"""
WRONG OUTPUT:
{
  "reasoning": "Tom and Lisa are at the same party and seem interested in each other.",
  "relationships": [
    {
      "pair": ["Lisa", "Tom"],
      "status": "friendly",
      "aToB": {
        "feelings": ["curious", "interested"],
        "secrets": ["finds him attractive"],
        "wants": ["to get to know him"]
      },
      "bToA": {
        "feelings": ["infatuated", "nervous"],
        "secrets": ["took dance lessons for her"],
        "wants": ["to confess his feelings"]
      }
    }
  ]
}
WHY THIS IS WRONG: Lisa shows no interest in Tom whatsoever - she barely noticed him and can't even remember where she knows him from. The relationship is highly asymmetric. Lisa's feelings should be "indifferent" or "unaware", with no secrets about finding him attractive and no wants related to him. Status should be "strangers" not "friendly".

### Bad Example 3: Missing Feelings, Secrets, or Wants
INPUT:
"""
Detective Sarah Chen: *She reviews the case file for the twentieth time, her partner Detective James Murphy working silently beside her. Twelve years they've been partners, twelve years of crime scenes and late nights and bad coffee. He's the only one who knows about her daughter's addiction, the only one she trusted with that burden. Now, with Internal Affairs sniffing around his old cases, she's terrified of what they might find - and whether their friendship will survive it.*

Detective James Murphy: *The IA investigation is eating him alive. Fifteen years ago, he took money to look the other way - once, just once, and he's regretted it every day since. Sarah doesn't know. She can never know. It would destroy her faith in him, and her faith is the only thing keeping him from turning his gun on himself some nights. He passes her a fresh cup of coffee without being asked, the gesture automatic after so many years.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah and James are long-time detective partners.",
  "relationships": [
    {
      "pair": ["James Murphy", "Sarah Chen"],
      "status": "close",
      "aToB": {
        "feelings": ["loyal"],
        "secrets": [],
        "wants": []
      },
      "bToA": {
        "feelings": ["trusting"],
        "secrets": [],
        "wants": []
      }
    }
  ]
}
WHY THIS IS WRONG: The output is severely incomplete. James has a major secret (he took money 15 years ago), struggles with suicidal thoughts, and desperately wants to keep Sarah's trust. Sarah has shared her daughter's addiction with him, is terrified about the IA investigation, and wants their friendship to survive. Both have complex feelings that should be captured - not just single-word summaries.

### Bad Example 4: Wrong Status Level
INPUT:
"""
Karen: *She can barely contain her rage as her sister walks into the hospital room. Twenty years of silence, twenty years of pretending she doesn't exist, and NOW Michelle shows up? Their mother is dying, and Michelle has the audacity to appear as if she has any right to be here. "Get out," Karen says, her voice barely above a whisper but carrying the weight of decades of hatred. "You don't belong here. You never did."*

Michelle: *The hatred in Karen's eyes is nothing new, but it still cuts deep. She'd hoped - stupidly, naively - that their mother's illness might bridge the gap between them. That grief could heal what time couldn't. "I'm her daughter too," she says, standing her ground even as her hands tremble. "You can't keep me from saying goodbye." The real tragedy is that Michelle doesn't even remember what started this war. One day they were sisters; the next, they were enemies.*
"""
WRONG OUTPUT:
{
  "reasoning": "Karen and Michelle are sisters who have been estranged for twenty years.",
  "relationships": [
    {
      "pair": ["Karen", "Michelle"],
      "status": "strained",
      "aToB": {
        "feelings": ["angry", "resentful"],
        "secrets": [],
        "wants": ["Michelle to leave"]
      },
      "bToA": {
        "feelings": ["hurt", "hopeful"],
        "secrets": ["doesn't remember what started the conflict"],
        "wants": ["reconciliation"]
      }
    }
  ]
}
WHY THIS IS WRONG: "Strained" is too mild for this relationship. Karen describes "decades of hatred", tells Michelle she "never belonged", and can "barely contain her rage". This is clearly a "hostile" relationship, not merely strained. The status should accurately reflect the severity of the conflict.

### Bad Example 5: Confusing Past Relationship with Current State
INPUT:
"""
Emma: *She can't believe how easy it is to be with Jack again after all these years. Their high school romance feels like a different lifetime - the passionate fights, the dramatic breakups, the way she thought she'd never love again when he moved away. But now, meeting for coffee as adults, all that teenage intensity has mellowed into something comfortable and nostalgic. "Remember the prom?" she laughs. "You wore that terrible purple tuxedo."*

Jack: *He winces at the memory but laughs along with her. "I thought I looked great. You didn't complain at the time." The truth is, he'd burned all photos of that prom after their breakup. It had hurt too much to look at them. But now? Now it's just a funny story, the kind you tell at dinner parties. They've both married other people, had children, built entire lives that don't include each other. This coffee is closure he didn't know he needed.*
"""
WRONG OUTPUT:
{
  "reasoning": "Emma and Jack were in an intense relationship in high school with passionate fights and breakups.",
  "relationships": [
    {
      "pair": ["Emma", "Jack"],
      "status": "intimate",
      "aToB": {
        "feelings": ["passionate", "intense", "heartbroken"],
        "secrets": ["thought she'd never love again when he left"],
        "wants": ["dramatic reconciliation"]
      },
      "bToA": {
        "feelings": ["painful longing", "regretful"],
        "secrets": ["burned all their photos"],
        "wants": ["to rekindle the romance"]
      }
    }
  ]
}
WHY THIS IS WRONG: The output describes their PAST relationship, not their CURRENT state. Currently, they're both married to other people, meeting for coffee, and treating their history as "just a funny story." Their present relationship is "acquaintances" or at most "friendly" - comfortable and nostalgic, not intimate or passionate. The feelings should reflect the current warmth and nostalgia, not teenage intensity.

### Bad Example 6: Inventing Information Not in the Text
INPUT:
"""
Councilwoman Peters: *The budget meeting has dragged on for three hours, and she's running out of patience. Across the table, Councilman Torres keeps blocking every one of her proposals with procedural objections. Politics as usual. "Perhaps if we could focus on the actual numbers," she says through gritted teeth, "we could finish before midnight."*

Councilman Torres: *He knows he's being obstructionist, but Peters' infrastructure plan would devastate the small businesses in his district. Someone has to fight for them. "The numbers are precisely the problem, Councilwoman. Your projections are optimistic at best, fraudulent at worst." He ignores her indignant gasp. Let her be offended. He's been called worse.*
"""
WRONG OUTPUT:
{
  "reasoning": "Peters and Torres have a complicated political rivalry that masks secret romantic tension.",
  "relationships": [
    {
      "pair": ["Councilman Torres", "Councilwoman Peters"],
      "status": "complicated",
      "aToB": {
        "feelings": ["antagonistic", "secretly attracted", "professional respect"],
        "secrets": ["finds her attractive despite himself", "admires her passion"],
        "wants": ["to work together on bipartisan solutions", "possibly a personal relationship"]
      },
      "bToA": {
        "feelings": ["frustrated", "intrigued", "grudging respect"],
        "secrets": ["has researched his background extensively", "finds his passion appealing"],
        "wants": ["to find common ground", "to understand his motivations"]
      }
    }
  ]
}
WHY THIS IS WRONG: There is no evidence of romantic tension, secret attraction, or personal interest in the text. This is a straightforward political disagreement. The output invents feelings and motivations that don't exist in the source material. The actual relationship is "strained" based on political opposition, with no romantic subtext.

### Bad Example 7: Wrong Direction of Feelings (aToB vs bToA)
INPUT:
"""
Student Amy: *She approaches Professor Wright's office with trembling hands. Her thesis proposal was rejected twice already, and this meeting will determine whether she stays in the PhD program. Dr. Wright has a reputation for being demanding but fair - the students who survive his mentorship go on to great things. "Dr. Wright? You wanted to see me about my proposal?"*

Professor Wright: *He gestures for her to sit, taking a moment to organize his thoughts. Amy's first two proposals showed potential but lacked focus - a common issue with promising students who try to tackle too much at once. He sees something in her work that reminds him of his own early struggles. "Your ideas are good, Amy. Too good, perhaps. You're trying to solve three problems in one thesis. Let's talk about narrowing your scope."*
"""
WRONG OUTPUT:
{
  "reasoning": "Professor Wright and Amy are in a mentor-student relationship with mutual respect.",
  "relationships": [
    {
      "pair": ["Amy", "Professor Wright"],
      "status": "acquaintances",
      "aToB": {
        "feelings": ["sees potential", "mentoring", "reminiscing about own struggles"],
        "secrets": ["knows she's capable of more"],
        "wants": ["to guide her to success"]
      },
      "bToA": {
        "feelings": ["anxious", "hopeful", "intimidated"],
        "secrets": ["desperate to stay in the program"],
        "wants": ["thesis approval", "his guidance"]
      }
    }
  ]
}
WHY THIS IS WRONG: The aToB and bToA are swapped! In the pair ["Amy", "Professor Wright"], aToB should be AMY's feelings toward Professor Wright (anxious, intimidated), and bToA should be PROFESSOR WRIGHT's feelings toward Amy (sees potential, mentoring). The feelings are assigned to the wrong person.

### Bad Example 8: Treating All Characters as Having Equal Relationships
INPUT:
"""
The scene opens in a coffee shop where three friends have gathered. Lisa and Tom have been best friends since childhood, inseparable for twenty years. They met Dave at a work conference last month and hit it off. The three now meet weekly for coffee, though Dave sometimes feels like a third wheel to the obvious bond between the other two.
"""
WRONG OUTPUT:
{
  "reasoning": "All three characters are friends meeting for coffee.",
  "relationships": [
    {
      "pair": ["Dave", "Lisa"],
      "status": "friendly",
      "aToB": {
        "feelings": ["friendly", "comfortable"],
        "secrets": [],
        "wants": ["friendship"]
      },
      "bToA": {
        "feelings": ["friendly", "comfortable"],
        "secrets": [],
        "wants": ["friendship"]
      }
    },
    {
      "pair": ["Dave", "Tom"],
      "status": "friendly",
      "aToB": {
        "feelings": ["friendly", "comfortable"],
        "secrets": [],
        "wants": ["friendship"]
      },
      "bToA": {
        "feelings": ["friendly", "comfortable"],
        "secrets": [],
        "wants": ["friendship"]
      }
    },
    {
      "pair": ["Lisa", "Tom"],
      "status": "friendly",
      "aToB": {
        "feelings": ["friendly", "comfortable"],
        "secrets": [],
        "wants": ["friendship"]
      },
      "bToA": {
        "feelings": ["friendly", "comfortable"],
        "secrets": [],
        "wants": ["friendship"]
      }
    }
  ]
}
WHY THIS IS WRONG: Not all relationships are equal! Lisa and Tom are childhood best friends of 20 years - that should be "close", not "friendly". Dave is a recent acquaintance who feels like a third wheel. The relationships with Dave should reflect that he's newer to the group and aware of being somewhat outside the Lisa-Tom bond.

### Bad Example 9: Using Vague or Generic Feelings
INPUT:
"""
Vampire Lord Kael: *He observes the human woman who stumbled into his castle with cold fascination. In three hundred years, no mortal has made it past his wards. She either has powerful magic or incredible luck - either way, she interests him. He emerges from the shadows, letting her see his true face. "You've come a long way to die, little mortal."*

Mira: *She doesn't flinch when the vampire appears, though her heart hammers against her ribs. The legends didn't do him justice - he's terrifying and beautiful in equal measure, like a sculpture of a fallen angel. But she hasn't walked for three days through cursed forest to cower now. "I haven't come to die. I've come to make a deal. Your kind need blood. My village has blood. We can help each other." She raises her chin, meeting his blood-red eyes.*
"""
WRONG OUTPUT:
{
  "reasoning": "A vampire lord and a human woman meeting for the first time.",
  "relationships": [
    {
      "pair": ["Kael", "Mira"],
      "status": "strangers",
      "aToB": {
        "feelings": ["interested", "curious"],
        "secrets": [],
        "wants": ["stuff"]
      },
      "bToA": {
        "feelings": ["scared", "determined"],
        "secrets": [],
        "wants": ["a deal"]
      }
    }
  ]
}
WHY THIS IS WRONG: The feelings are too vague and generic. Kael shows "cold fascination", curiosity about how she passed his wards, and interest in either her magic or luck. His secret might be that no one has breached his wards in 300 years. Mira finds him "terrifying and beautiful", walked three days through cursed forest, and wants a specific blood-for-protection deal. "Interested", "curious", "scared", "determined" are too generic. And "wants stuff" is not acceptable output.

### Bad Example 10: Ignoring Power Dynamics
INPUT:
"""
King Aldric: *He lounges on his throne as the peasant girl is brought before him in chains. She dared to steal bread from the royal kitchens - a hanging offense. But something about her defiant stare amuses him. Most prisoners beg or weep. This one looks ready to spit in his face. "You know the penalty for theft," he says lazily. "Give me one reason I shouldn't execute you here and now."*

Sera: *The chains are heavy, but her spirit isn't broken. She's been beaten, starved, dragged through the streets, and still she refuses to kneel. The king before her is everything she hates - fat on excess while her family starves. "Execute me then," she says clearly. "Make me a martyr. See how well that goes for you when the commons finally rise."*
"""
WRONG OUTPUT:
{
  "reasoning": "King Aldric and Sera have met and seem to have mutual respect.",
  "relationships": [
    {
      "pair": ["Aldric", "Sera"],
      "status": "acquaintances",
      "aToB": {
        "feelings": ["amused", "interested"],
        "secrets": [],
        "wants": ["to understand her"]
      },
      "bToA": {
        "feelings": ["defiant", "angry"],
        "secrets": [],
        "wants": ["freedom"]
      }
    }
  ]
}
WHY THIS IS WRONG: This completely ignores the extreme power imbalance. Sera is in chains facing execution - the status should reflect this hostility and opposition. The king holds her life in his hands; she represents common resentment of nobility. Aldric's secret might be that he's intrigued despite himself. Sera's secrets include knowing the commons are ready to rise. Status should be "hostile" not "acquaintances" - they are captor and prisoner, oppressor and oppressed.

### Bad Example 11: Forgetting to Include All Relevant Relationships
INPUT:
"""
The tension in the therapy room was thick enough to cut. Dr. Martinez watched the family dynamic unfold - Michael, the father, sat rigidly in his chair, refusing to look at his son Jason. Jason, seventeen and furious, directed all his rage at the mother who'd brought him here, Beth, who just wanted everyone to stop fighting. The parents' divorce last year had shattered what little stability existed, and Jason blamed both of them equally, though he saved his cruelest words for his mother.
"""
WRONG OUTPUT:
{
  "reasoning": "This is a family therapy scene with complex dynamics.",
  "relationships": [
    {
      "pair": ["Beth", "Jason"],
      "status": "strained",
      "aToB": {
        "feelings": ["desperate", "hurt", "loving"],
        "secrets": ["just wants the fighting to stop"],
        "wants": ["family peace", "Jason to stop being angry"]
      },
      "bToA": {
        "feelings": ["furious", "cruel", "blaming"],
        "secrets": ["actually blames both parents equally"],
        "wants": ["to hurt her", "acknowledgment of pain"]
      }
    }
  ]
}
WHY THIS IS WRONG: This only captures ONE of the relationships when there are clearly multiple relevant ones. Missing: Michael and Jason (father won't look at son), Beth and Michael (divorced, ongoing conflict), potentially Dr. Martinez's role in observing these dynamics. All significant relationships should be extracted.

### Bad Example 12: Redundant or Conflicting Information
INPUT:
"""
Lena: *She hasn't seen her brother Marco in five years - not since he betrayed her to the police and she spent two years in prison for crimes they committed together. Now he stands in her doorway, older, tired, asking for forgiveness she'll never give. "You have thirty seconds to explain why I shouldn't kill you where you stand."*

Marco: *The hatred in her eyes is deserved. He knows that. But he's dying - six months, the doctors said - and he can't meet his maker with this sin on his soul. "I need you to forgive me, Lena. I'm dying. Please." The words taste like ash. He doesn't deserve forgiveness, but he has to try.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marco and Lena are estranged siblings with a complex history of betrayal.",
  "relationships": [
    {
      "pair": ["Lena", "Marco"],
      "status": "hostile",
      "aToB": {
        "feelings": ["murderous rage", "betrayed", "hateful", "will never forgive him", "unforgiving", "consumed by hatred"],
        "secrets": ["spent two years in prison because of him", "they committed crimes together", "he's the reason she went to prison", "she was betrayed"],
        "wants": ["to kill him", "him dead", "to never see him again", "revenge", "his death"]
      },
      "bToA": {
        "feelings": ["guilty", "remorseful", "ashamed", "regretful", "sorry", "penitent"],
        "secrets": ["he's dying with six months to live", "he's terminal", "has a fatal illness", "doctors gave him six months"],
        "wants": ["forgiveness", "absolution", "her to forgive him", "to be forgiven before death", "reconciliation"]
      }
    }
  ]
}
WHY THIS IS WRONG: The lists are filled with redundant and repetitive entries. "Murderous rage", "hateful", "will never forgive him", "unforgiving", "consumed by hatred" all express the same thing. Same with the secrets - "he's dying with six months to live", "he's terminal", "has a fatal illness", "doctors gave him six months" are all the same fact stated multiple ways. Each feeling, secret, and want should be distinct and add new information.
`;

export const initialRelationshipsPrompt: PromptTemplate<ExtractedInitialRelationships> = {
	name: 'initial_relationships',
	description:
		'Extract the initial relationship states between characters from the opening of a roleplay',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.characterDescription,
		PLACEHOLDERS.characterPairs,
	],

	systemPrompt: `You are analyzing roleplay messages to extract the relationships between characters.

## Your Task
Read the provided roleplay messages and identify all significant relationships between characters, including their status, feelings, secrets, and wants in both directions.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your step-by-step analysis of relationship dynamics
- "relationships": An array of relationship objects, each containing:
  - "pair": [string, string] - Two character names, ALPHABETICALLY SORTED
  - "status": One of 'strangers', 'acquaintances', 'friendly', 'close', 'intimate', 'strained', 'hostile', 'complicated'
  - "aToB": Object describing first character's attitude toward second (feelings, secrets, wants)
  - "bToA": Object describing second character's attitude toward first (feelings, secrets, wants)

## Relationship Status Definitions
- **strangers**: Characters who have just met or don't know each other
- **acquaintances**: Characters who know of each other but aren't close
- **friendly**: Positive casual relationship, colleagues, casual friends
- **close**: Deep friendship, trusted allies, family bonds
- **intimate**: Romantic partners, lovers, deeply bonded (doesn't require physical intimacy)
- **strained**: Relationship under stress, tension, or conflict
- **hostile**: Active enemies, hatred, opposition
- **complicated**: Mixed feelings, unclear status, conflicting dynamics

## Critical Rules for Pair Ordering
- Character names in "pair" MUST be sorted alphabetically (e.g., ["Alice", "Bob"] not ["Bob", "Alice"])
- "aToB" describes the FIRST alphabetical character's feelings toward the SECOND
- "bToA" describes the SECOND character's feelings toward the FIRST
- Example: If pair is ["Anna", "Zoe"], then aToB = Anna's feelings toward Zoe, bToA = Zoe's feelings toward Anna

## Attitude Components
- **feelings**: Emotional states toward the other person (love, trust, fear, resentment, attraction, etc.)
- **secrets**: Things this character knows/hides relevant to the relationship (not general secrets)
- **wants**: Desires related to the other person (reconciliation, romance, revenge, distance, etc.)

## Important Guidelines
- Relationships can be ASYMMETRIC - one person may love while the other feels nothing
- Extract the CURRENT relationship state, not past history (unless it informs current feelings)
- Include all significant character pairs, not just the main characters
- Be specific in feelings/secrets/wants - avoid vague words like "interested" or "stuff"
- Each entry in feelings/secrets/wants should add distinct information (no redundancy)
- Power dynamics and context matter for determining status
- Don't invent romantic tension or feelings not supported by the text

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}
Description: {{characterDescription}}

## Messages to Analyze
{{messages}}

## Character Pairs to Analyze
You MUST analyze these EXACT character pairs using these EXACT names:
{{characterPairs}}

## Task
Extract the relationship for EACH character pair listed above. For each pair:
1. Use the EXACT names provided in the pair (do not change or abbreviate them)
2. Determine the relationship status
3. Describe each character's feelings, secrets, and wants toward the other

Remember:
- Use the EXACT names from the pairs above - do not modify them
- The pairs are already alphabetically sorted
- aToB = first character's attitude toward second
- bToA = second character's attitude toward first
- Relationships can be asymmetric
- Focus on CURRENT relationship state
- Be specific, avoid vague or redundant entries`,

	responseSchema: initialRelationshipsSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedInitialRelationships | null {
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
		if (!Array.isArray(parsed.relationships)) return null;

		const validStatuses = [
			'strangers',
			'acquaintances',
			'friendly',
			'close',
			'intimate',
			'strained',
			'hostile',
			'complicated',
		];

		// Validate each relationship
		for (const rel of parsed.relationships) {
			// Validate pair
			if (!Array.isArray(rel.pair) || rel.pair.length !== 2) return null;
			if (typeof rel.pair[0] !== 'string' || typeof rel.pair[1] !== 'string')
				return null;

			// Validate status
			if (!validStatuses.includes(rel.status)) return null;

			// Validate attitudes
			for (const attitude of [rel.aToB, rel.bToA]) {
				if (!attitude || typeof attitude !== 'object') return null;
				if (!Array.isArray(attitude.feelings)) return null;
				if (!Array.isArray(attitude.secrets)) return null;
				if (!Array.isArray(attitude.wants)) return null;

				// Validate all items are strings
				for (const arr of [
					attitude.feelings,
					attitude.secrets,
					attitude.wants,
				]) {
					if (!arr.every((item: unknown) => typeof item === 'string'))
						return null;
				}
			}
		}

		return parsed as unknown as ExtractedInitialRelationships;
	},
};
