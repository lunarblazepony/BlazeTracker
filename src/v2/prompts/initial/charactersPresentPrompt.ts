/**
 * Initial Characters Present Extraction Prompt
 *
 * Extracts which characters are present in the opening messages of a roleplay,
 * including their positions and activities.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedCharactersPresent } from '../../types/extraction';
import { charactersPresentSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Two Characters in Clear Interaction
INPUT:
"""
Elena: *Elena leans against the worn wooden counter of the coffee shop, her fingers wrapped around a steaming ceramic mug. The morning light catches the silver rings on her fingers as she tilts her head, watching the man across from her with sharp, calculating eyes. The espresso machine hisses behind her, and the barista moves about preparing orders for the other customers.*

Marcus: *He sits hunched over his own coffee at the small corner table, dark circles under his eyes betraying another sleepless night. A crumpled newspaper lies abandoned beside his cup, the headlines screaming about another political scandal no one cares about. He refuses to meet Elena's gaze, instead tracing patterns in the condensation on the table.*
"""
OUTPUT:
{
  "reasoning": "Elena is leaning against the counter, actively watching Marcus - she's present and engaged. Her sharp, calculating eyes suggest she's alert and perhaps suspicious. Marcus is at a corner table, hunched over coffee - he's present but avoiding eye contact. The dark circles under his eyes indicate tiredness. The barista is mentioned as moving about preparing orders, so they are also present but as a background character. Other customers are mentioned but not individually identified, so they are not tracked as specific characters.",
  "characters": [
    {
      "name": "Elena",
      "position": "leaning against the coffee shop counter",
      "activity": "watching Marcus",
      "mood": ["alert", "calculating"],
      "physicalState": []
    },
    {
      "name": "Marcus",
      "position": "sitting at a corner table",
      "activity": "tracing patterns in condensation on the table",
      "mood": ["avoidant", "troubled"],
      "physicalState": ["tired", "sleep-deprived"]
    },
    {
      "name": "the barista",
      "position": "behind the counter",
      "activity": "preparing orders",
      "mood": [],
      "physicalState": []
    }
  ]
}

### Example 2: Character Alone with References to Others
INPUT:
"""
Sarah: *The apartment feels too quiet without him. Sarah paces the length of the living room, her bare feet silent on the cold hardwood floors. On the mantle, a photograph of her and James on their wedding day seems to mock her - his smile frozen in time, oblivious to everything that would come after. She checks her phone for the hundredth time. Nothing. No calls, no texts, no sign that he even remembers she exists. The dinner she made sits cold on the table, two place settings for a meal that will only feed one. She should call her mother, but the thought of explaining everything makes her chest tight. Instead, she pours herself another glass of wine and stares out the window at the rain-streaked city below.*
"""
OUTPUT:
{
  "reasoning": "Sarah is the only character physically present in the scene. She is pacing the living room and checking her phone. James is mentioned but is explicitly absent ('without him', 'No calls, no texts'). Her mother is mentioned as someone she could call but isn't present. The photograph shows James but that doesn't make him present - it's just a reference to him.",
  "characters": [
    {
      "name": "Sarah",
      "position": "in the living room of her apartment",
      "activity": "pacing and checking her phone"
    }
  ]
}

### Example 3: Multiple Characters in a Crowded Scene
INPUT:
"""
The Narrator: *The grand ballroom pulses with life as the annual charity gala reaches its peak. Lord Ashworth stands near the orchestra, his silver cufflinks catching the light as he gestures expansively to a group of admirers. His wife, Lady Catherine, circulates on the opposite side of the room, her emerald gown drawing envious glances. By the champagne table, young Theodore Ashworth sulks in his formal attire, clearly wishing he were anywhere else. The family's butler, Reginald, stands discretely by the service entrance, watching the proceedings with his usual impassive expression. Among the guests, diplomat Henri Beaumont engages the French ambassador in what appears to be an intense conversation near the potted ferns, while actress Vivian Monroe holds court near the grand staircase, surrounded by admirers. A string quartet plays softly in the corner, and servers weave through the crowd with trays of hors d'oeuvres.*
"""
OUTPUT:
{
  "reasoning": "Multiple characters are explicitly placed in the scene: Lord Ashworth near the orchestra with admirers, Lady Catherine circulating on the opposite side, Theodore by the champagne table, Reginald by the service entrance, Henri Beaumont near the potted ferns with the French ambassador, and Vivian Monroe by the staircase with admirers. The string quartet and servers are mentioned but as unnamed groups. The admirers around Lord Ashworth and Vivian are also unnamed groups.",
  "characters": [
    {
      "name": "Lord Ashworth",
      "position": "near the orchestra",
      "activity": "gesturing expansively to a group of admirers"
    },
    {
      "name": "Lady Catherine",
      "position": "opposite side of the ballroom",
      "activity": "circulating among guests"
    },
    {
      "name": "Theodore Ashworth",
      "position": "by the champagne table",
      "activity": "sulking"
    },
    {
      "name": "Reginald",
      "position": "by the service entrance",
      "activity": "watching the proceedings"
    },
    {
      "name": "Henri Beaumont",
      "position": "near the potted ferns",
      "activity": "conversing with the French ambassador"
    },
    {
      "name": "the French ambassador",
      "position": "near the potted ferns",
      "activity": "conversing with Henri Beaumont"
    },
    {
      "name": "Vivian Monroe",
      "position": "near the grand staircase",
      "activity": "holding court among admirers"
    }
  ]
}

### Example 4: Character Entering a Scene
INPUT:
"""
Marcus: *The door to the warehouse creaks open, and Marcus steps inside, his footsteps echoing in the cavernous space. Old shipping crates are stacked haphazardly, creating a maze of shadows that swallow the dim light from the grimy windows. The air smells of rust and old motor oil. He pauses just inside the entrance, letting his eyes adjust to the darkness.*

Viktor: *A match flares in the darkness, illuminating Viktor's scarred face as he lights a cigarette. He's been waiting here for hours, perched on a crate in the far corner like a patient spider. The orange glow of his cigarette tip traces small arcs in the air as he brings it to his lips.*

"You're late," *Viktor says, his accented voice carrying easily through the empty space.* "I don't like waiting."
"""
OUTPUT:
{
  "reasoning": "Marcus has just entered the warehouse and is standing by the entrance. Viktor was already waiting inside, seated on a crate in the far corner. Both are present and aware of each other. Marcus is letting his eyes adjust (activity), while Viktor is lighting/smoking a cigarette.",
  "characters": [
    {
      "name": "Marcus",
      "position": "just inside the warehouse entrance",
      "activity": "letting his eyes adjust to the darkness"
    },
    {
      "name": "Viktor",
      "position": "perched on a crate in the far corner",
      "activity": "smoking a cigarette"
    }
  ]
}

### Example 5: Off-Screen Character Communication
INPUT:
"""
Elena: *Her phone buzzes with an incoming call - Marcus's number flashing on the screen. Elena stares at it for a long moment, her thumb hovering over the accept button. The call rings out, going to voicemail. Almost immediately, a text arrives: "Please answer. It's important." She types out a response and deletes it three times before finally settling on a curt "Not now." The office around her is quiet, her coworkers having left for the day. Only the hum of the air conditioning and the flicker of fluorescent lights keep her company. She sets the phone face-down on her desk and returns to the stack of case files, trying to ignore how her hands are shaking.*
"""
OUTPUT:
{
  "reasoning": "Elena is alone in the office - her coworkers have left. Marcus is communicating with her via phone but is NOT physically present in the scene. Phone/text communication does not make someone present. Only Elena is in the scene, at her desk.",
  "characters": [
    {
      "name": "Elena",
      "position": "at her desk in the office",
      "activity": "reviewing case files"
    }
  ]
}

### Example 6: Characters in Different Areas of Same Location
INPUT:
"""
The Narrator: *The old Victorian house creaks and settles as night falls. In the kitchen, Grandmother Miller kneads bread dough with practiced hands, humming an old hymn under her breath while a pot of stew bubbles on the stove. Upstairs, in the attic bedroom, twelve-year-old Sophie has barricaded herself with a stack of library books, a flashlight, and her grandmother's old quilt, determined to stay awake until midnight to see if the house really is haunted. Down in the basement, Grandfather Tom tinkers with his ham radio, the static and occasional voices crackling through the darkness as he searches for distant signals. The family cat, Mr. Whiskers, prowls the hallway between the first and second floors, his yellow eyes gleaming in the shadows as he stalks something only he can see.*
"""
OUTPUT:
{
  "reasoning": "Four characters are present in the house but in different rooms: Grandmother Miller in the kitchen, Sophie in the attic bedroom, Grandfather Tom in the basement, and Mr. Whiskers in the hallway. Each has a distinct position and activity.",
  "characters": [
    {
      "name": "Grandmother Miller",
      "position": "in the kitchen",
      "activity": "kneading bread dough and humming"
    },
    {
      "name": "Sophie",
      "position": "in the attic bedroom",
      "activity": "reading by flashlight"
    },
    {
      "name": "Grandfather Tom",
      "position": "in the basement",
      "activity": "tinkering with his ham radio"
    },
    {
      "name": "Mr. Whiskers",
      "position": "in the hallway between the first and second floors",
      "activity": "prowling and stalking"
    }
  ]
}

### Example 7: Unconscious/Sleeping Character Present
INPUT:
"""
Dr. Chen: *The hospital room is quiet save for the steady beep of the heart monitor. Dr. Chen reviews the chart at the foot of the bed, her brow furrowed with concern. The patient - John Doe, as they've been calling him since he arrived with no identification - lies motionless beneath the thin hospital blanket, tubes and wires connecting him to machines that breathe for him, monitor him, keep him tethered to this world. Three days in a coma and still no one has come looking for him. No family, no friends, no employer wondering why he didn't show up. It's as if he materialized out of thin air, only to immediately slip into oblivion. Dr. Chen makes a note in the chart and sighs.*

Nurse Martinez: *Nurse Martinez enters with fresh IV bags, moving quietly so as not to disturb the doctor's concentration. She's been checking on this patient every hour, even though he never responds, never opens his eyes. There's something about his face - peaceful despite everything - that makes her want to believe he'll wake up someday.*
"""
OUTPUT:
{
  "reasoning": "Three characters are present. Dr. Chen is at the foot of the bed reviewing the chart. John Doe (the patient) is in the hospital bed - unconscious but physically present. Nurse Martinez has entered with IV bags. Even though John Doe is in a coma, he is still physically present in the scene.",
  "characters": [
    {
      "name": "Dr. Chen",
      "position": "at the foot of the hospital bed",
      "activity": "reviewing the patient's chart"
    },
    {
      "name": "John Doe",
      "position": "in the hospital bed",
      "activity": null
    },
    {
      "name": "Nurse Martinez",
      "position": "entering the room",
      "activity": "bringing fresh IV bags"
    }
  ]
}

### Example 8: Fantasy Setting with Non-Human Characters
INPUT:
"""
Aldric: *The ancient dragon's cave glitters with hoarded treasure - gold coins, jeweled crowns, enchanted weapons from a thousand fallen heroes. Aldric the Bold stands at the entrance, his legendary sword Dawnbreaker held before him, its blade glowing with holy light. Behind him, his loyal companion Whisper - a shadow fox bound to his service through ancient magic - circles nervously, her dark fur bristling with unease.*

Vexarion: *From atop the mountain of gold, Vexarion the Eternal opens one enormous eye. The eye is the color of molten copper, with a slit pupil that dilates as it focuses on the intruder. A low rumble builds in the dragon's throat - not quite a growl, not quite a purr - as smoke curls from between teeth the size of swords.*

"Another hero," *the dragon's voice echoes through the cavern, ancient and amused.* "How delightfully predictable."
"""
OUTPUT:
{
  "reasoning": "Three characters are present in the cave. Aldric stands at the entrance with his sword. Whisper (the shadow fox) is behind him, circling. Vexarion the dragon is on top of the treasure pile. All three are present and aware of each other, even though some are non-human.",
  "characters": [
    {
      "name": "Aldric",
      "position": "at the cave entrance",
      "activity": "holding his sword at the ready"
    },
    {
      "name": "Whisper",
      "position": "behind Aldric",
      "activity": "circling nervously"
    },
    {
      "name": "Vexarion",
      "position": "atop the mountain of gold",
      "activity": "watching Aldric"
    }
  ]
}

### Example 9: Character Behind a Barrier but Present
INPUT:
"""
Detective Harper: *The interrogation room is stark - gray walls, fluorescent lights, a metal table bolted to the floor. Detective Harper sits on one side, her folder of evidence spread before her like weapons in an arsenal. A cup of cold coffee sits untouched beside her elbow. On the other side of the table, separated by nothing but air and accusations, sits Tommy "Two-Fingers" Marconi, his hands cuffed to a ring in the table. His lawyer, the impeccably dressed Diana Vance, sits beside him, her pen poised over a legal pad that remains conspicuously empty.*

*Behind the two-way mirror, Captain Reynolds watches the proceedings, his arms crossed over his chest. Next to him, FBI Agent Torres takes notes on a tablet, occasionally murmuring observations into a voice recorder.*
"""
OUTPUT:
{
  "reasoning": "Five characters are present but in two areas. In the interrogation room: Detective Harper at the table, Tommy Marconi cuffed across from her, and Diana Vance beside Tommy. Behind the two-way mirror: Captain Reynolds and Agent Torres. All are present in the scene even though the mirror separates them - the mirror doesn't make the observers off-screen, it's part of the same scene setup.",
  "characters": [
    {
      "name": "Detective Harper",
      "position": "sitting at the interrogation table",
      "activity": "conducting the interrogation"
    },
    {
      "name": "Tommy Marconi",
      "position": "cuffed to the table across from Detective Harper",
      "activity": null
    },
    {
      "name": "Diana Vance",
      "position": "sitting beside Tommy Marconi",
      "activity": "observing with pen ready"
    },
    {
      "name": "Captain Reynolds",
      "position": "behind the two-way mirror",
      "activity": "watching the interrogation"
    },
    {
      "name": "Agent Torres",
      "position": "behind the two-way mirror, next to Captain Reynolds",
      "activity": "taking notes on a tablet"
    }
  ]
}

### Example 10: Idle Character with No Current Activity
INPUT:
"""
Mei Lin: *The tea ceremony is complete, the last drop poured with precision born of decades of practice. Mei Lin sets down the ceramic pot and folds her hands in her lap, her expression serene as the autumn garden beyond the shoji screens rustles with a gentle breeze. Across from her, old Master Tanaka sits in perfect stillness, his eyes closed, his breathing so shallow he might be mistaken for a statue. They have shared this ritual every Sunday for fifteen years, and in all that time, neither has felt the need to fill the silence with unnecessary words. The moment simply is, and that is enough.*
"""
OUTPUT:
{
  "reasoning": "Two characters are present. Mei Lin has finished the tea ceremony and is sitting with hands folded - she has completed an activity but is now simply sitting. Master Tanaka is also sitting in stillness with eyes closed. Neither is actively doing anything at the current moment, but both are present.",
  "characters": [
    {
      "name": "Mei Lin",
      "position": "seated at the tea ceremony",
      "activity": null
    },
    {
      "name": "Master Tanaka",
      "position": "seated across from Mei Lin",
      "activity": null
    }
  ]
}

### Example 11: Referenced Character Who Left Before Scene
INPUT:
"""
Lisa: *The apartment still smells like Mike's cologne, even though he packed his bags and left three hours ago. Lisa sits on the edge of the bed they used to share, staring at the empty closet where his clothes used to hang. His guitar is gone from the corner. His books are gone from the shelf. Three years of her life walked out the door with nothing but a suitcase and a muttered apology. Her cat, Biscuit, jumps onto the bed and headbutts her arm, demanding attention with a plaintive meow. At least someone still wants to be here.*

*Her phone lights up with a text from her sister: "Heard the news. Coming over with ice cream and wine. ETA 20 mins."*
"""
OUTPUT:
{
  "reasoning": "Lisa is sitting on the bed - she's present. Biscuit the cat is on the bed - present. Mike is explicitly stated to have left three hours ago - NOT present. Lisa's sister texted that she's coming in 20 minutes - NOT present yet. Only Lisa and Biscuit are currently in the scene.",
  "characters": [
    {
      "name": "Lisa",
      "position": "sitting on the edge of the bed",
      "activity": "staring at the empty closet"
    },
    {
      "name": "Biscuit",
      "position": "on the bed",
      "activity": "headbutting Lisa's arm for attention"
    }
  ]
}

### Example 12: Character Visible Through Window but Not in Scene
INPUT:
"""
Nathan: *Nathan watches from the cafe window as the woman crosses the street outside. She's bundled against the cold in a red coat, her dark hair whipping in the winter wind. She pauses at the bus stop directly across from him, checking her phone, completely unaware she's being observed. He's been following her for three days now, learning her patterns, her routines. The coffee in front of him has gone cold, but he doesn't care about the coffee. He cares about the moment she looked up at the cafe yesterday and their eyes met through the glass, and for one heart-stopping second, he thought she recognized him. But she didn't. Not yet.*

*The bus arrives, swallowing her and a handful of other commuters into its belly before pulling away. Nathan finally lets out the breath he's been holding.*
"""
OUTPUT:
{
  "reasoning": "Nathan is in the cafe, watching through the window - he is present. The woman in the red coat is OUTSIDE at the bus stop - she is in a different location (outside) being observed through a window. She then gets on a bus and leaves entirely. She is NOT present in Nathan's scene - she's just someone he can see. The cafe is the scene location, and only Nathan is there.",
  "characters": [
    {
      "name": "Nathan",
      "position": "at a table by the cafe window",
      "activity": "watching the street outside"
    }
  ]
}

### Example 13: Dead Body Present in Scene
INPUT:
"""
Detective Morrison: *The penthouse apartment would be beautiful under other circumstances - floor-to-ceiling windows overlooking the city, modern art on the walls, furniture that probably cost more than Morrison's yearly salary. But all he can focus on is the body sprawled across the white leather sofa, crimson blood a stark contrast against the pristine upholstery. Reginald Blackwood III, tech billionaire and notorious philanderer, has thrown his last party. His eyes stare sightlessly at the ceiling, one hand still clutching a champagne flute.*

*CSI technician Amy Cho crouches beside the body, her gloved hands carefully collecting samples. The medical examiner, Dr. Patterson, stands near the window, dictating notes into her recorder.*

"Time of death approximately 2 to 4 AM," *Dr. Patterson says.* "I'll know more after the autopsy."
"""
OUTPUT:
{
  "reasoning": "Four characters are present. Detective Morrison is standing (implied) observing the scene. The body of Reginald Blackwood III is on the sofa - dead but physically present in the scene. Amy Cho is crouched beside the body. Dr. Patterson is near the window. All are present even though one is deceased.",
  "characters": [
    {
      "name": "Detective Morrison",
      "position": "in the penthouse apartment",
      "activity": "observing the crime scene"
    },
    {
      "name": "Reginald Blackwood III",
      "position": "sprawled on the white leather sofa",
      "activity": null
    },
    {
      "name": "Amy Cho",
      "position": "crouched beside the body",
      "activity": "collecting samples"
    },
    {
      "name": "Dr. Patterson",
      "position": "near the window",
      "activity": "dictating notes into a recorder"
    }
  ]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Including Characters Only Mentioned in Dialogue
INPUT:
"""
Sarah: *Sarah slides into the booth across from Detective Murphy, pulling her coat tighter around her shoulders. The diner is nearly empty at this hour, just a tired waitress refilling coffee and a trucker hunched over pie at the counter.*

"I need to talk to you about my brother," *she says, her voice barely above a whisper.* "David hasn't been the same since he came back from Afghanistan. He keeps talking about this guy named Kozlov - says he's coming to kill him. I thought he was being paranoid, but yesterday someone broke into his apartment."
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah is at the booth, Detective Murphy is across from her. David is her brother who she's worried about. Kozlov is someone David mentioned.",
  "characters": [
    { "name": "Sarah", "position": "in the booth", "activity": "talking to Murphy" },
    { "name": "Detective Murphy", "position": "in the booth", "activity": "listening" },
    { "name": "David", "position": "unknown", "activity": "mentioned as paranoid" },
    { "name": "Kozlov", "position": "unknown", "activity": "mentioned as threat" }
  ]
}
WHY THIS IS WRONG: David and Kozlov are only mentioned in dialogue - they are not physically present in the scene. Only Sarah, Detective Murphy, the waitress, and the trucker are actually present.

### Bad Example 2: Missing Background Characters Clearly Described
INPUT:
"""
Elena: *The subway car lurches, and Elena grabs the overhead rail to steady herself. Beside her, an elderly man with a newspaper clucks his tongue at the latest headlines. Across the aisle, a young mother tries to calm a crying toddler while a teenager in oversized headphones bobs his head to unheard music. At the far end of the car, two transit cops share a joke, their laughter cutting through the usual subway ambiance.*

*Elena's phone buzzes. A text from Marcus: "Don't come to the usual place. We've been compromised. Will explain later."*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is on the subway. Marcus texted her.",
  "characters": [
    { "name": "Elena", "position": "on the subway", "activity": "checking her phone" },
    { "name": "Marcus", "position": "unknown", "activity": "texting" }
  ]
}
WHY THIS IS WRONG: The output misses multiple characters who are clearly present: the elderly man, the young mother, the toddler, the teenager, and the two transit cops. Marcus is NOT present - he sent a text, which doesn't make him physically there. The output should include all the background characters who are explicitly described in the scene.

### Bad Example 3: Confusing Past Presence with Current Presence
INPUT:
"""
Michael: *The beach house feels different without everyone here. Michael stands at the window where just yesterday, all five of them had gathered to watch the sunset. His mother had been in the kitchen making her famous seafood paella. His father had been arguing with Uncle Roberto about politics. His sister Carla had been teaching his niece Sofia how to build sandcastles on the beach below. Now they've all gone back to their regular lives, scattered across three different states, and Michael is alone with the sound of waves and the ghost of their laughter.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene describes a family gathering. Michael is at the window. His mother was in the kitchen. His father and Uncle Roberto were present. Carla and Sofia were on the beach.",
  "characters": [
    { "name": "Michael", "position": "at the window", "activity": "remembering" },
    { "name": "Michael's mother", "position": "in the kitchen", "activity": "cooking" },
    { "name": "Michael's father", "position": "unknown", "activity": "arguing" },
    { "name": "Uncle Roberto", "position": "unknown", "activity": "arguing" },
    { "name": "Carla", "position": "on the beach", "activity": "building sandcastles" },
    { "name": "Sofia", "position": "on the beach", "activity": "building sandcastles" }
  ]
}
WHY THIS IS WRONG: All family members except Michael are described in the past tense ("had been", "just yesterday") and the text explicitly states "Now they've all gone back" and "Michael is alone." Only Michael is present in the current scene.

### Bad Example 4: Adding Characters from Character Card Not in Scene
INPUT:
"""
[Character Card: Elena Volkov. She has a complicated relationship with her handler, Marcus Chen, and her former mentor, Natasha Ivanova. Her cover identity involves working at the Russian embassy with diplomat Alexei Petrov.]

Elena: *The safe house is small but secure - a one-room apartment above a laundromat, chosen precisely because no one would think to look for her here. Elena sits on the narrow cot, methodically cleaning her pistol. The familiar motions are soothing, something to focus on while she waits for her next instructions. Outside, rain patters against the single grimy window, and the rumble of dryers from below creates a constant white noise.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is in the safe house. Based on her character card, Marcus Chen is her handler, and Natasha Ivanova is her mentor.",
  "characters": [
    { "name": "Elena", "position": "on the cot", "activity": "cleaning her pistol" },
    { "name": "Marcus Chen", "position": "handler", "activity": "giving instructions" },
    { "name": "Natasha Ivanova", "position": "mentor", "activity": "training Elena" }
  ]
}
WHY THIS IS WRONG: Only Elena is present in the scene. Marcus and Natasha are mentioned in the character card as people in her life, but they are not physically present in this scene. Character card context provides background, not scene presence.

### Bad Example 5: Wrong Position or Activity
INPUT:
"""
James: *James leans against the bar, nursing his third whiskey of the night. The jazz band in the corner plays something slow and melancholy that matches his mood perfectly. His ex-wife Rebecca sits at a table near the stage, laughing at something her new boyfriend Chad says. They haven't noticed him yet, and James intends to keep it that way. He signals the bartender for another drink.*

The Bartender: *The bartender - a heavyset man with a magnificent handlebar mustache - slides another whiskey across the polished wood with a sympathetic nod.* "Rough night, friend?"
"""
WRONG OUTPUT:
{
  "reasoning": "James is at the bar drinking. Rebecca and Chad are at a table. The bartender is serving drinks.",
  "characters": [
    { "name": "James", "position": "at a table", "activity": "watching the band" },
    { "name": "Rebecca", "position": "at the bar", "activity": "drinking with Chad" },
    { "name": "Chad", "position": "at the bar", "activity": "talking" },
    { "name": "the bartender", "position": "in the kitchen", "activity": "preparing food" }
  ]
}
WHY THIS IS WRONG: The positions and activities are completely wrong. James is at the bar (not a table), nursing whiskey (not watching the band). Rebecca and Chad are at a table near the stage (not at the bar). The bartender is behind the bar serving drinks (not in the kitchen). The output must match what the text actually says.

### Bad Example 6: Including Animals or Objects as Characters
INPUT:
"""
Lily: *Lily's studio apartment is a chaos of half-finished paintings and dried paint palettes. She sits cross-legged on the floor, working on her latest piece - an abstract explosion of blues and purples that she hopes will finally impress the gallery owner. Her goldfish, Picasso, swims lazy circles in his bowl on the windowsill. The radiator clanks and hisses like an angry mechanical beast. On the easel beside her, a previous painting - a portrait of a woman with sad eyes - watches her work.*
"""
WRONG OUTPUT:
{
  "reasoning": "Lily is painting. Picasso the goldfish is in the bowl. The radiator makes noise. The painting on the easel has a woman.",
  "characters": [
    { "name": "Lily", "position": "on the floor", "activity": "painting" },
    { "name": "Picasso", "position": "in the fishbowl", "activity": "swimming" },
    { "name": "the radiator", "position": "in the corner", "activity": "clanking" },
    { "name": "the woman in the painting", "position": "on the easel", "activity": "watching" }
  ]
}
WHY THIS IS WRONG: The radiator is not a character, it's an object. The woman in the painting is not a character present in the scene - it's a painting. While Picasso the goldfish could potentially be tracked as a pet character depending on context, the radiator and painting subject should never be listed as present characters. Only Lily is definitely a character present.

### Bad Example 7: Vague or Uninformative Positions
INPUT:
"""
Commander Vex: *The bridge of the starship Prometheus hums with quiet efficiency. Commander Vex stands at the central command console, her eyes fixed on the viewscreen where an uncharted planet rotates slowly in the darkness of space. Behind her, Lieutenant Chen monitors the sensor array while Ensign Park handles communications. At the helm, veteran pilot Kowalski keeps the ship in a stable orbit, his hands moving across the controls with practiced ease.*
"""
WRONG OUTPUT:
{
  "reasoning": "Several crew members are on the bridge.",
  "characters": [
    { "name": "Commander Vex", "position": "on the bridge", "activity": "commanding" },
    { "name": "Lieutenant Chen", "position": "on the bridge", "activity": "working" },
    { "name": "Ensign Park", "position": "somewhere", "activity": "doing stuff" },
    { "name": "Kowalski", "position": "nearby", "activity": "helping" }
  ]
}
WHY THIS IS WRONG: The positions are too vague. The text gives specific positions: Vex is at the central command console, Chen is at the sensor array, Park handles communications (likely at a communications station), and Kowalski is at the helm. Activities should also be specific: Vex is watching the viewscreen, Chen is monitoring sensors, Park is handling communications, Kowalski is piloting/keeping orbit stable.

### Bad Example 8: Missing Character Names
INPUT:
"""
The Narrator: *The therapist's office is designed to be calming - soft lighting, neutral colors, a small fountain burbling in the corner. Dr. Samantha Greene sits in her leather chair, notepad balanced on her knee, watching her newest patient with professional interest. The young man on the couch - he introduced himself only as "Max" - hasn't stopped bouncing his leg since he sat down twenty minutes ago. His girlfriend, who insisted on waiting in the lobby, keeps texting him every few minutes, making his phone buzz insistently in his pocket.*
"""
WRONG OUTPUT:
{
  "reasoning": "The therapist and patient are in the office. A girlfriend is texting.",
  "characters": [
    { "name": "the therapist", "position": "in her chair", "activity": "taking notes" },
    { "name": "the patient", "position": "on the couch", "activity": "being nervous" },
    { "name": "the girlfriend", "position": "in the lobby", "activity": "texting" }
  ]
}
WHY THIS IS WRONG: The characters have names that should be used. The therapist is "Dr. Samantha Greene" and the patient is "Max." The girlfriend IS in a different location (the lobby) - whether to include her depends on whether the lobby is considered part of the same scene. If tracked, she still needs a description like "Max's girlfriend" since no name is given.

### Bad Example 9: Duplicate Characters Under Different Names
INPUT:
"""
Colonel Hawkins: *Colonel James "Hawk" Hawkins surveys the command tent, his weathered face grim in the lamplight. Twenty years of service have taught him to read a battlefield, and what he reads now doesn't look good. Across the map table, his trusted aide Captain Monroe traces enemy positions with a wooden pointer.*

"The Germans have reinforced their eastern flank, Colonel," *Monroe reports.* "Hawk, we need to reconsider our approach."
"""
WRONG OUTPUT:
{
  "reasoning": "Colonel Hawkins and Hawk are present along with Captain Monroe.",
  "characters": [
    { "name": "Colonel Hawkins", "position": "at the command tent", "activity": "surveying" },
    { "name": "Hawk", "position": "at the command tent", "activity": "listening" },
    { "name": "James", "position": "unknown", "activity": "unknown" },
    { "name": "Captain Monroe", "position": "at the map table", "activity": "reporting" }
  ]
}
WHY THIS IS WRONG: "Colonel Hawkins," "Hawk," and "James" are all the same person - Colonel James "Hawk" Hawkins. The output incorrectly lists him as three separate characters. Only two characters are present: Colonel Hawkins and Captain Monroe.

### Bad Example 10: Including Characters From Thoughts/Memories
INPUT:
"""
Yuki: *Yuki stares at the shrine photograph of her grandmother, incense smoke curling up toward the ceiling. Five years since the funeral, and she still comes here every Sunday to pay her respects. Grandmother always said that the dead watch over us, and Yuki finds comfort in believing the old woman's spirit lingers here. She remembers her grandmother's hands teaching her origami, her voice reading bedtime stories, her laughter filling the kitchen as they made mochi together. Those memories feel so vivid that Grandmother almost seems present, sitting in her usual spot by the window.*
"""
WRONG OUTPUT:
{
  "reasoning": "Yuki is at the shrine. Her grandmother's spirit might be present watching over her.",
  "characters": [
    { "name": "Yuki", "position": "at the shrine", "activity": "paying respects" },
    { "name": "Grandmother", "position": "by the window", "activity": "watching over Yuki" }
  ]
}
WHY THIS IS WRONG: The grandmother died five years ago - she is not physically present. The text describes memories and a feeling that she "almost seems present," but this is clearly metaphorical. Spiritual presence, memories, and feelings do not make a character physically present in the scene. Only Yuki is present.

### Bad Example 11: Wrong Number of Characters
INPUT:
"""
The party is in full swing when Detective Blake arrives. She counts at least thirty guests mingling in the mansion's grand ballroom, but her attention is drawn to the host, Reginald Sterling, holding court near the fireplace. His wife Cordelia stands beside him, champagne in hand, her smile not quite reaching her eyes. Near the French doors, Blake spots her contact - a nervous-looking man in an ill-fitting suit who introduced himself as "Jones" during their previous meeting.
"""
WRONG OUTPUT:
{
  "reasoning": "There are thirty guests plus the main characters.",
  "characters": [
    { "name": "Detective Blake", "position": "at the party", "activity": "observing" },
    { "name": "Reginald Sterling", "position": "by the fireplace", "activity": "hosting" },
    { "name": "Cordelia", "position": "beside Reginald", "activity": "holding champagne" },
    { "name": "Jones", "position": "near the French doors", "activity": "looking nervous" },
    { "name": "Guest 1", "position": "in the ballroom", "activity": "mingling" },
    { "name": "Guest 2", "position": "in the ballroom", "activity": "mingling" }
  ]
}
WHY THIS IS WRONG: The "thirty guests" are unnamed background characters and should not be individually listed with made-up names like "Guest 1, Guest 2." Only the specifically named/identified characters should be tracked: Detective Blake, Reginald Sterling, Cordelia, and Jones.

### Bad Example 12: Ignoring Character State Details
INPUT:
"""
The hospital waiting room is a study in anxiety. Maria paces by the vending machines, unable to sit still, her hands wringing constantly. Her husband Roberto slumps in a plastic chair, staring at nothing, his coffee long since gone cold. In the corner, their teenage son Diego has his earbuds in and his hood up, trying to disappear into his phone, but Maria can see his hands shaking. A nurse sits behind the reception desk, occasionally glancing at them with professional sympathy.
"""
WRONG OUTPUT:
{
  "reasoning": "Family is waiting at hospital with a nurse present.",
  "characters": [
    { "name": "Maria", "position": "in the waiting room", "activity": null },
    { "name": "Roberto", "position": "in the waiting room", "activity": null },
    { "name": "Diego", "position": "in the waiting room", "activity": null },
    { "name": "the nurse", "position": "in the waiting room", "activity": null }
  ]
}
WHY THIS IS WRONG: The positions are too vague, and activities are incorrectly marked as null when they are clearly described. Maria is by the vending machines, pacing and wringing her hands. Roberto is slumped in a plastic chair, staring at nothing. Diego is in the corner, on his phone. The nurse is behind the reception desk, occasionally glancing at them. All have specific positions and activities that should be captured.
`;

export const initialCharactersPresentPrompt: PromptTemplate<ExtractedCharactersPresent> = {
	name: 'initial_characters_present',
	description:
		'Extract which characters are present in the opening of a roleplay, with their positions and activities',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.characterDescription,
	],

	systemPrompt: `You are analyzing roleplay messages to determine which characters are physically present in the scene.

## Your Task
Read the provided roleplay messages and identify all characters who are PHYSICALLY PRESENT in the current scene. For each character, determine their position (where/how they are positioned) and their activity (what they are doing, or null if idle).

## Output Format
Respond with a JSON object containing:
- "reasoning": Your step-by-step analysis of which characters are present and why
- "characters": An array of character objects, each with:
  - "name": The character's FIRST NAME ONLY (e.g., "Elena" not "Elena Volkov", "Marcus" not "Marcus Chen")
  - "position": Where/how they are positioned in the scene
  - "activity": What they are currently doing (null if idle or passive)
  - "mood": Array of current emotional states (e.g., ["anxious", "hopeful"])
  - "physicalState": Array of notable physical conditions (e.g., ["tired", "sweating"]) - empty array if normal

## Name Guidelines
- Use FIRST NAME ONLY: "Elena" not "Elena Volkov"
- For titled characters, use just the name: "Samantha" not "Dr. Samantha Greene"
- For characters with only a last name given, use that name
- For unnamed characters use a brief descriptor: "the bartender", "the nurse"

## Presence Rules (from highest to lowest priority)
1. **Physically described in scene** - Characters whose physical presence, position, or actions are described
2. **Entering/arriving** - Characters who enter, arrive, or appear in the scene
3. **Unconscious/sleeping/dead** - Characters physically present but not active still count as present
4. **Behind barriers** - Characters behind windows, mirrors, doors in connected spaces may be present
5. **Background characters** - Named background characters (barista, bartender, guard) count if explicitly described

## NOT Present (Do NOT include)
- Characters only mentioned in dialogue ("My brother David said...")
- Characters who texted/called/emailed (remote communication)
- Characters who left before the scene ("He left three hours ago")
- Characters from memories, flashbacks, or thoughts
- Characters from photos, paintings, or recordings
- Characters who will arrive later ("Coming in 20 minutes")
- Characters in completely different locations being observed (through window to outside)
- Unnamed groups ("the crowd", "other customers") unless individually described
- Character card relationships not appearing in the actual scene

## Position Guidelines
- Be specific: "at the bar counter" not just "in the bar"
- Include posture when relevant: "slouched in the corner booth"
- Note relative positions: "standing behind Marcus"

## Activity Guidelines
- Use null for idle/passive characters
- Be concise but specific: "nursing a whiskey" not "drinking"
- Capture the main action: "reviewing documents" not "sitting and looking at papers and thinking"

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}
Description: {{characterDescription}}

## Messages to Analyze
{{messages}}

## Task
Identify all characters who are physically present in this scene. For each character, provide:
1. Their FIRST NAME ONLY (e.g., "Elena" not "Elena Volkov")
2. Their position (where/how they are positioned)
3. Their current activity (what they're doing, or null if idle)
4. Their mood (array of emotional states like "anxious", "happy", "suspicious")
5. Their physicalState (array of physical conditions like "tired", "injured", "sweating" - empty if normal)

Remember:
- Only include characters who are PHYSICALLY PRESENT
- Use FIRST NAME ONLY for all characters
- Do NOT include characters only mentioned in dialogue, memories, or communication
- Be specific about positions and activities
- Use null for activity if the character is idle/passive
- mood and physicalState should be arrays (can be empty)`,

	responseSchema: charactersPresentSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedCharactersPresent | null {
		let parsed: Record<string, unknown>;
		try {
			const result = parseJsonResponse(response);
			if (!result || typeof result !== 'object' || Array.isArray(result))
				return null;
			parsed = result as Record<string, unknown>;
		} catch {
			return null;
		}

		if (typeof parsed.reasoning !== 'string') return null;
		if (!Array.isArray(parsed.characters)) return null;

		// Validate each character has required fields
		for (const char of parsed.characters) {
			if (typeof char !== 'object' || char === null) return null;
			const c = char as Record<string, unknown>;
			if (typeof c.name !== 'string') return null;
			if (typeof c.position !== 'string') return null;
			// activity can be string or null

			// Ensure mood and physicalState are arrays (default to empty if missing)
			if (!Array.isArray(c.mood)) {
				c.mood = [];
			}
			if (!Array.isArray(c.physicalState)) {
				c.physicalState = [];
			}
		}

		return parsed as unknown as ExtractedCharactersPresent;
	},
};
