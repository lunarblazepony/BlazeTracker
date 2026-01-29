/**
 * Chapter Ended Detection Prompt
 *
 * Detects natural chapter breaks based on major location changes, significant time jumps, or both.
 * This helps segment the narrative into meaningful chunks for summarization and navigation.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedChapterEnded } from '../../types/extraction';
import { chapterEndedSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Clear Location Change - New City
INPUT:
"""
Previous Location: Downtown Seattle - The Rusty Nail bar - Corner booth
Previous Time: Monday, June 15, 2024 at 11:30 PM

Elena: *The train pulls into Grand Central Terminal just as the morning sun breaks through the clouds. Elena steps onto the platform, her single bag slung over her shoulder. New York City. She had always wondered what it would be like. The air is different here - thicker, more charged with possibility and danger in equal measure. She weaves through the crowd of commuters, their faces set in the determined grimace of people who have places to be. The overhead boards clatter with departures and arrivals. She checks her phone - no messages from Marcus. Expected, but still disappointing. Time to start over, at least for now. She heads for the exit, ready to disappear into the anonymous mass of the city that never sleeps.*
"""
OUTPUT:
{
  "reasoning": "The scene has shifted from Seattle (The Rusty Nail bar at night) to New York City (Grand Central Terminal in the morning). This is a major geographic change - cross-country travel. The location change is dramatic and represents a new phase of the story. The time has also jumped from late night to morning, likely the next day or later. This is a clear chapter boundary.",
  "shouldEnd": true,
  "reason": "both"
}

### Example 2: Significant Time Jump - Weeks Later
INPUT:
"""
Previous Location: St. Mary's Hospital - Room 412 - Beside the bed
Previous Time: Thursday, March 3, 2024 at 9:15 AM

Marcus: *The spring sun warms Marcus's face as he sits on the park bench, watching children chase pigeons across the grass. Three weeks since the hospital. Three weeks since he had watched Sarah's heart monitor flatline and felt something inside himself break just as permanently. The bandages are off now, the stitches removed, leaving only pale pink scars where the bullets had torn through. Dr. Reyes says he's healing remarkably well for a man his age. She doesn't know about the other wounds - the ones that won't close no matter how much time passes. He takes a sip of coffee, cold now, and watches a young couple walk by hand in hand. They remind him of Sarah and himself, thirty years ago. Before everything.*
"""
OUTPUT:
{
  "reasoning": "Three weeks have passed since the hospital scene. The character has physically healed, left the hospital, and is now in a park reflecting on his loss. This significant time skip represents a major shift in the narrative - from the immediate crisis to the aftermath. While he might still be in the same general city, the passage of three weeks marks a natural chapter boundary.",
  "shouldEnd": true,
  "reason": "time_jump"
}

### Example 3: Both Location and Time - Return After Absence
INPUT:
"""
Previous Location: Corporate Office Tower - 47th Floor - Corner Office
Previous Time: Friday, December 20, 2024 at 5:00 PM

Lyra: *Six months. Six months of running, hiding, rebuilding herself from the ashes of her former life. And now she stands outside the gates of her childhood home, the Victorian mansion rising before her like a ghost made solid. Summer has transformed the grounds - the roses are in full bloom, their fragrance mixing with the cut grass smell that always meant home. The windows are dark except for a single light in her father's study. He's still working late, even now. Some things never change. Lyra takes a deep breath and pushes open the iron gate. The hinges creak in that familiar way that used to announce her teenage returns from forbidden parties. Now it announces something else entirely - the prodigal daughter, returning not for forgiveness but for answers.*
"""
OUTPUT:
{
  "reasoning": "This represents both a major location change (from a corporate office tower to her childhood home, which appears to be in a different area given she was 'running and hiding') AND a significant time jump (six months have passed, seasons have changed from December winter to summer). The narrative has clearly entered a new phase. This is a definitive chapter boundary.",
  "shouldEnd": true,
  "reason": "both"
}

### Example 4: Location Change - Different Building Same City
INPUT:
"""
Previous Location: Downtown Chicago - The Starlight Diner - Corner booth
Previous Time: Tuesday, November 14, 2024 at 3:47 PM

Elena: *The precinct smells like every precinct Elena has ever been in - stale coffee, old paper, and desperation. She sits in the uncomfortable plastic chair, handcuffs digging into her wrists, while Detective Morrison flips through a file that seems to grow thicker every time she looks at it. The fluorescent lights buzz overhead, one of them flickering in that special way designed to drive confessions out of people through sheer irritation. Through the window of the interrogation room, she can see cops going about their business - typing reports, arguing over the coffee pot, pretending this is just another day. For them, maybe it is. For Elena, it's the beginning of the end.*
"""
OUTPUT:
{
  "reasoning": "The character has moved from a diner to a police precinct, but this appears to be within the same general area (downtown) and likely the same day given the continuous narrative flow. This is a scene change within the same story beat - she was at the diner, now she's been arrested and taken to the precinct. The narrative is still dealing with the same immediate situation. This is NOT a chapter boundary - it's a continuation of the same chapter's events.",
  "shouldEnd": false
}

### Example 5: Minor Time Skip - Same Day Later
INPUT:
"""
Previous Location: University Campus - Library - Study carrel on third floor
Previous Time: Wednesday, October 3, 2018 at 4:30 PM

Mira: *The campus quad is nearly empty now, the last rays of sunset painting the old brick buildings in shades of orange and pink. Mira finally gave up on studying an hour ago, her brain refusing to absorb another word about quantum mechanics. Now she sits on the steps of the engineering building, sharing a bag of chips with her roommate Julie, watching the sky perform its daily magic show. The air has that crisp autumn bite that makes everything feel more alive. Julie is complaining about her terrible date last weekend, complete with dramatic hand gestures, and Mira is only half-listening, her mind still stuck on that email from Dr. Chen about the research position. This could change everything.*
"""
OUTPUT:
{
  "reasoning": "The character has moved from the library to outside on campus, and a few hours have passed (from 4:30 PM afternoon to sunset). However, this is the same day, same general location (university campus), and the narrative continues the same storyline without a major break. The study session ending and grabbing dinner with a roommate is a natural scene transition within a chapter, not a chapter break. There's no significant time jump or major location change.",
  "shouldEnd": false
}

### Example 6: Transition Scene - Travel in Progress
INPUT:
"""
Previous Location: Paris - Le Petit Café - Window table
Previous Time: Saturday, April 5, 2025 at 2:00 PM

Commander Vex: *The shuttle hums steadily as it ascends through Earth's atmosphere, the blue sky darkening to black as they break free of the planet's embrace. Vex watches through the porthole, her reflection ghostly against the stars beginning to appear. In four hours they'll reach the Mars orbital station. In four hours, everything she thought she knew about her mission will be tested. She opens the briefing folder again, though she's memorized every word. Agent Chen sits across from her, sleeping or pretending to - with him, it's always hard to tell. The document mentions the Prometheus incident only in passing, as if three hundred deaths can be reduced to a footnote. Vex closes the folder and closes her eyes. Rest now. War later.*
"""
OUTPUT:
{
  "reasoning": "The character is traveling from Earth to Mars - this is a major location change in progress. They've left Paris (and Earth entirely) and are en route to Mars orbital station. The transition is happening within the scene, but the departure from the previous location is complete and represents a significant narrative shift. The journey between locations is often a good chapter break point - the old chapter ends with departure, the new one can begin with arrival. This represents a clear location change.",
  "shouldEnd": true,
  "reason": "location_change"
}

### Example 7: Time Jump - Different Season
INPUT:
"""
Previous Location: Mountain Cabin - Main room - By the fireplace
Previous Time: Sunday, January 12, 2025 at 8:00 PM

Luna: *The cabin looks different now, dressed in wildflowers instead of snow. Luna pulls weeds from the garden she planted in March, the soil warm and rich between her fingers. The mountains still wear their white caps, but down here in the valley, spring has arrived with the subtlety of a brass band. Her recovery is complete now - at least the physical part. The nightmares still come sometimes, replaying those weeks of isolation when the blizzard trapped her here with nothing but canned food and her own thoughts for company. But today the sun is shining, birds are singing, and the therapist in town says she's making 'excellent progress.' Luna sits back on her heels and surveys her work. This is what healing looks like.*
"""
OUTPUT:
{
  "reasoning": "Significant time has passed - from January winter to spring (likely April or May based on wildflowers and garden planting). The character mentions months of recovery and therapy. While she's at the same cabin, the seasonal change and passage of months represents a major narrative shift from the crisis (blizzard survival) to the aftermath (recovery and healing). This time jump warrants a chapter break.",
  "shouldEnd": true,
  "reason": "time_jump"
}

### Example 8: Scene Break - Same Location Different Room
INPUT:
"""
Previous Location: Victorian Mansion - Grand Ballroom - Near the champagne table
Previous Time: Saturday, December 31, 2024 at 11:30 PM

James: *The bathroom is mercifully quiet, the sounds of the New Year's Eve party muffled by the heavy oak door. James leans against the marble sink, staring at his reflection in the ornate mirror. His bowtie is crooked, his eyes are bloodshot, and somewhere out there his wife is dancing with her tennis instructor. He splashes cold water on his face, watching it drip down his chin and spot his rented tuxedo. In thirty minutes, a new year begins. In thirty minutes, he's supposed to kiss Sarah at midnight and pretend everything is fine. He can do this. He's been doing it for five years. What's one more night? The door opens behind him - it's his brother, looking concerned. "You okay in here?" James forces a smile. "Never better."*
"""
OUTPUT:
{
  "reasoning": "The character has simply moved from the ballroom to a bathroom within the same mansion during the same party. No significant time has passed (still before midnight on the same night). This is a brief scene transition within the same chapter - a character taking a moment alone during ongoing events. The narrative continues seamlessly from the same story beat.",
  "shouldEnd": false
}

### Example 9: Flashback Does Not Break Chapter
INPUT:
"""
Previous Location: FBI Headquarters - Interrogation Room B - Across from the suspect
Previous Time: Monday, March 8, 2021 at 2:17 AM

Agent Reyes: *"Tell me about the warehouse," Reyes says, keeping her voice steady despite the exhaustion pulling at her bones. The suspect, a thin man with hollow eyes, stares at the table between them.

He finally speaks: "It was raining. I remember because the roof leaked, and the sound drove me crazy. We waited for hours." His voice is distant, lost in memory. "The shipment was supposed to arrive at midnight, but midnight came and went. By 2 AM, we knew something was wrong. By 3 AM, when the cops showed up, we knew we'd been set up."

Reyes makes a note. "And where were you standing when the police arrived?"

"Near the loading dock. I could smell the river."*
"""
OUTPUT:
{
  "reasoning": "While the suspect is describing past events (the warehouse incident), this is dialogue within the current scene - an interrogation room in FBI headquarters. The narrative frame remains the same: Reyes is conducting an interview in real-time. Flashbacks described through dialogue don't constitute a chapter break. The story is still anchored in the present interrogation scene.",
  "shouldEnd": false
}

### Example 10: Location Change - International Travel
INPUT:
"""
Previous Location: London - Heathrow Airport - Terminal 5 Gate 23
Previous Time: Thursday, August 15, 2024 at 6:00 AM

Sarah: *Tokyo assaults the senses from the moment Sarah steps out of Narita Airport. The humidity wraps around her like a wet blanket, the signs are incomprehensible cascades of characters, and the orderly flow of people moves with a precision that makes London look chaotic. Her translator app is already working overtime as she tries to find the bus to Shinjuku. Fourteen hours on a plane, and she still can't quite believe she's here. The letter in her purse feels heavier than its few grams of paper should warrant - Dr. Tanaka's invitation to join his research team. Three years she worked for this opportunity. The bus pulls up, impossibly clean and exactly on time. She boards with the other passengers, finding a window seat, and watches the Japanese countryside give way to the sprawling neon maze of the city. A new chapter of her life begins.*
"""
OUTPUT:
{
  "reasoning": "Clear international travel from London to Tokyo. This represents a major location change (different country, different continent) and also a significant time passage (14-hour flight plus time zone changes). The character explicitly thinks 'a new chapter of her life begins' which aligns with narrative structure. This is an obvious chapter boundary.",
  "shouldEnd": true,
  "reason": "both"
}

### Example 11: Continuous Scene - Driving
INPUT:
"""
Previous Location: Suburban House - Driveway - In the car
Previous Time: Friday, September 22, 2023 at 7:45 AM

Detective Chen: *The morning traffic is brutal, as always. Chen drums his fingers on the steering wheel, stuck behind a garbage truck that seems determined to stop at every single house on Oak Street. The radio crackles with dispatch calls - a domestic disturbance on Fifth, a fender bender blocking the intersection of Main and Harbor. Nothing that concerns him. His concern is waiting at the precinct, in the form of Internal Affairs agents who want to discuss the Martinez shooting for the fifth time this month. The light finally turns green. The garbage truck finally moves. Chen accelerates past it, catching a glimpse of the workers in his rearview mirror - young men doing honest work, unburdened by the weight of a questionable shooting and a partner who won't return his calls.*
"""
OUTPUT:
{
  "reasoning": "The character is simply commuting from home to work, stuck in traffic. This is a continuation of the morning routine, not a significant location change - he hasn't even arrived at his destination yet. No meaningful time has passed. This is mid-scene, mid-journey, definitely not a chapter break.",
  "shouldEnd": false
}

### Example 12: Time Jump with Same Location - Years Later
INPUT:
"""
Previous Location: Small Town Cemetery - Family Plot - Before the graves
Previous Time: Wednesday, November 11, 2020 at 3:00 PM

Marcus: *The weeds have taken over despite his best efforts. Marcus kneels in the autumn leaves, pulling crabgrass from around his mother's headstone. Five years since he stood here in the rain watching them lower her casket. Five years since his father followed three months later, unable to face life without her. The dates carved in granite tell a story he still can't quite accept: beloved wife and mother, beloved husband and father, together in death as in life. His knees ache - he's not as young as he was - and his hair has gone fully gray now. The wedding ring on his finger catches the light. Katherine would have loved this place, these people she never got to meet. He thinks she would have understood why he comes here every Veterans Day, why he talks to stones that can't hear him. "I'm doing okay, Mom," he says softly. "Finally doing okay."*
"""
OUTPUT:
{
  "reasoning": "Five years have passed between scenes. While the character is at the same location (family cemetery plot), this massive time jump represents a completely different phase of life - his hair has gone gray, he's married now (Katherine), his perspective and healing have progressed significantly. A five-year gap is absolutely a chapter break, regardless of location continuity. The narrative has jumped to a new era of the character's life.",
  "shouldEnd": true,
  "reason": "time_jump"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Treating Minor Movement as Major Location Change
INPUT:
"""
Previous Location: Restaurant - Main dining room - Table 12
Previous Time: Friday, July 4, 2025 at 8:30 PM

Elena: *Elena excuses herself from the table, leaving Marcus to study the dessert menu alone. The restroom is at the back of the restaurant, past the bar where well-dressed patrons sip cocktails and pretend not to notice each other. She pushes through the door marked 'Ladies' and leans against the sink, staring at her reflection. What is she doing? Marcus is kind, successful, everything her mother always said she should want. But there's no spark. No electricity. She checks her phone - three missed calls from her ex. She silences it and returns the phone to her purse. Tonight is about moving forward, not backward. She fixes her lipstick, straightens her dress, and heads back to the table.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena has moved from the dining room to the restroom. This is a different location within the restaurant, so it represents a location change worthy of a chapter break.",
  "shouldEnd": true,
  "reason": "location_change"
}
WHY THIS IS WRONG: Moving to the bathroom within the same restaurant during the same dinner is not a major location change. She's still at the restaurant, still on the same date, still in the same scene. Chapter breaks should mark significant narrative shifts, not every room change.

### Bad Example 2: Ignoring Significant Time Jump
INPUT:
"""
Previous Location: Hospital - ICU - Room 7
Previous Time: Tuesday, February 14, 2024 at 4:00 AM

James: *The lake house looks exactly as it did when they were children - the faded blue shutters, the creaky dock, the rope swing still hanging from the old oak tree. James stands on the porch, beer in hand, watching the sunset paint the water gold and pink. It's been two years since the accident. Two years since he last saw his sister's face outside of photographs. The doctors said she would never wake up, and eventually they were right. Now her ashes rest in an urn on the mantel inside, waiting to be scattered per her wishes. He takes a long pull from his beer. Summer at the lake was always her favorite. Seems fitting to let her go here, in the place she loved most.*
"""
WRONG OUTPUT:
{
  "reasoning": "The character is at a lake house watching a sunset. The scene feels peaceful and continuous. No need for a chapter break.",
  "shouldEnd": false
}
WHY THIS IS WRONG: Two years have passed since the previous scene! The character's sister has died during that time. This massive time jump represents a completely different phase of life and story - from crisis (ICU bedside) to resolution/aftermath (scattering ashes). This is clearly a chapter boundary.

### Bad Example 3: Treating Flashback Content as Current Location
INPUT:
"""
Previous Location: Therapist's Office - Dr. Morgan's suite - Leather couch
Previous Time: Wednesday, May 20, 2025 at 2:00 PM

Luna: *"I keep going back to that night," Luna says, twisting the tissue in her hands. "The warehouse. The smell of rust and blood." She closes her eyes, letting the memory wash over her.

The warehouse had been cold, she remembers. February in Detroit. The concrete floor sapped heat from her body as she crouched behind the shipping container. Viktor's men were everywhere, flashlight beams cutting through the darkness like searchlights. She could hear them calling to each other in Russian, their boots echoing.

"And then what happened?" Dr. Morgan's voice pulls her back. Luna opens her eyes, focusing on the fern in the corner of the office. "Then I did what I had to do."*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene has moved to a warehouse in Detroit. The character is now in a different location from the therapist's office. This is a major location change.",
  "shouldEnd": true,
  "reason": "location_change"
}
WHY THIS IS WRONG: The warehouse is a flashback being described in therapy. The current scene location is still the therapist's office. Luna is sitting on the couch, remembering past events. The narrative frame hasn't changed. Flashbacks within dialogue are not location changes.

### Bad Example 4: Requiring Both Time AND Location for Any Break
INPUT:
"""
Previous Location: New York City - Times Square - Tourist crowd
Previous Time: Thursday, December 31, 2024 at 11:55 PM

Sarah: *The flight touches down in Los Angeles at 6 AM local time. Sarah rubs her eyes, exhausted from the red-eye but too anxious to sleep. Her mother's message had been brief: "Come home. It's about your father." Through the scratched airplane window, she can see the palm trees and the smog that passes for morning mist in LA. The pilot announces the local temperature, the gate number, the standard warnings about watching for moving vehicles. Sarah is already unbuckling her seatbelt, reaching for her bag. The past doesn't care about seatbelt signs. It doesn't wait for permission. It just arrives, demanding attention, demanding presence, demanding the daughter she stopped being when she moved across the country ten years ago.*
"""
WRONG OUTPUT:
{
  "reasoning": "While there's a location change from New York to Los Angeles, the time between New Year's Eve night and early morning the next day isn't significant enough. Only a few hours have passed. This doesn't meet the threshold for a chapter break.",
  "shouldEnd": false
}
WHY THIS IS WRONG: Cross-country travel IS a major location change, regardless of how much clock time passed. NYC to LA represents a complete change of setting, geography, and likely story focus. You don't need BOTH a time jump AND location change - either one alone can justify a chapter break if significant enough.

### Bad Example 5: Treating Same-Scene Movement as Chapter Break
INPUT:
"""
Previous Location: Mansion - Library - Reading by the fireplace
Previous Time: Sunday, October 15, 2024 at 9:00 PM

Detective Chen: *The scream comes from upstairs. Chen drops his book and draws his weapon in one fluid motion, years of training taking over. He moves through the library door, sweeping the hallway with practiced efficiency. The grand staircase looms ahead, shadows dancing on the walls from the chandelier swaying in some unseen draft. Another scream - shorter this time, cut off. Chen takes the stairs two at a time, his footsteps muffled by the thick carpet. At the top, three doors face him. The middle one is ajar, light spilling through the crack. He approaches, weapon raised, and pushes it open with his foot.*
"""
WRONG OUTPUT:
{
  "reasoning": "The character has moved from the library to the second floor of the mansion. This is a significant change in location that marks a new chapter.",
  "shouldEnd": true,
  "reason": "location_change"
}
WHY THIS IS WRONG: This is continuous action within the same scene - someone screamed, he's responding. Moving from one room to another within the same building during an active sequence is not a chapter break. The tension is building, not resetting. Chapter breaks come at resolution points or significant transitions, not mid-action.

### Bad Example 6: Ignoring Clear Location Change Due to Emotional Continuity
INPUT:
"""
Previous Location: Seattle - Downtown Apartment - Living room
Previous Time: Monday, March 3, 2025 at 7:00 AM

Marcus: *The Tokyo subway is a marvel of efficiency and an assault on personal space. Marcus clings to the overhead rail, pressed between a businessman reading manga on his phone and a schoolgirl in uniform who looks exhausted. Three weeks since he walked out of the apartment. Three weeks since Sarah's words shattered everything he thought he knew about their marriage. Now here he is, halfway around the world, following a job lead that his college roommate swore was legitimate. The train sways. The advertisements overhead show products he can't read. Somewhere in this city of thirty million people, there's supposed to be a fresh start waiting for him. He just has to find it.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is processing his emotional journey from Seattle. The narrative is focused on his internal state and memories of Sarah. Since his emotional arc is continuous, this isn't a chapter break.",
  "shouldEnd": false
}
WHY THIS IS WRONG: Emotional continuity doesn't override physical relocation. Seattle to Tokyo is an international move! Three weeks have passed, he's in a completely different country, starting a new phase of his life. Just because he's still thinking about what happened doesn't mean the chapter should continue. This is absolutely a chapter break (both location_change and time_jump = "both").

### Bad Example 7: Treating Description of Plans as Actual Location Change
INPUT:
"""
Previous Location: Coffee Shop - Corner table - By the window
Previous Time: Tuesday, April 8, 2025 at 10:30 AM

Elena: *"So here's the plan," Marcus says, spreading the map across the coffee-stained table. "We fly into Marrakech on Thursday, make contact with our guy at the hotel, then drive into the Atlas Mountains to the village." He traces the route with his finger. "The monastery is here, about six hours from the city. If everything goes right, we're in and out in three days."

Elena studies the map, committing the route to memory. "And if everything goes wrong?"

Marcus grins, but there's no humor in it. "Then we're glad I booked refundable tickets." He folds the map and slides it into his jacket. "You still in?"

She thinks about the life she'll be leaving behind. The safety. The boredom. "I'm in."*
"""
WRONG OUTPUT:
{
  "reasoning": "The characters are discussing travel to Morocco and the Atlas Mountains. This represents upcoming location changes that mark a chapter transition.",
  "shouldEnd": true,
  "reason": "location_change"
}
WHY THIS IS WRONG: They're PLANNING a trip, not taking one. The current scene is still at the coffee shop. Discussing future locations doesn't mean the location has changed. The chapter break should come when they actually ARRIVE in Morocco, not when they talk about going there.

### Bad Example 8: Missing Obvious Time Jump
INPUT:
"""
Previous Location: High School - Chemistry Lab - Lab bench near the window
Previous Time: Friday, May 15, 2015 at 3:30 PM

James: *The reunion banner stretches across the gym entrance: "Welcome Back, Class of 2015! 10 Years!" James adjusts his tie nervously, feeling like the imposter he probably is. The gym looks smaller than he remembered, though the smell of floor wax and teenage anxiety remains exactly the same. Former classmates mill about, older and rounder and more desperate to prove their success. He spots Lisa Chen by the punch bowl - she married a doctor, according to Facebook. And there's Mark Rodriguez, the quarterback who peaked in junior year and never quite recovered. James gets a name tag from the volunteer at the desk. "James Miller," it reads, as if he needs reminding. As if ten years of distance hasn't made him a stranger in his own past.*
"""
WRONG OUTPUT:
{
  "reasoning": "The character is at his old high school, which could be seen as the same general location. The gym and chemistry lab are in the same building. This is just moving to a different room.",
  "shouldEnd": false
}
WHY THIS IS WRONG: TEN YEARS have passed! The previous scene was during high school in 2015, and now it's the 10-year reunion in 2025. This is one of the most obvious time jumps possible. The location continuity (same school building) doesn't matter when a decade has passed. This is a major chapter break.

### Bad Example 9: Breaking Chapter During Continuous Conversation
INPUT:
"""
Previous Location: Police Station - Interview Room A - Across from suspect
Previous Time: Saturday, November 9, 2024 at 1:15 AM

Agent Reyes: *The suspect shifts in his seat, chains rattling against the metal table. "I want a lawyer," he says for the third time.

"You'll get one," Reyes replies, not looking up from her notes. "But right now, I'm just asking about your whereabouts on Tuesday night. That's not incriminating anyone, is it?"

The fluorescent light flickers. The coffee machine in the corner gurgles. The clock on the wall shows 1:47 AM - she's been at this for over half an hour with nothing to show for it.

"I was at home," he finally says. "Watching TV."

"Anyone who can verify that?"

He laughs, bitter and hollow. "Lady, if I had someone at home to verify anything, do you think I'd be here?"*
"""
WRONG OUTPUT:
{
  "reasoning": "Thirty minutes have passed during the interrogation. The clock going from 1:15 to 1:47 represents time passing. Additionally, there's been emotional progression in the conversation. This could be a chapter break.",
  "shouldEnd": true,
  "reason": "time_jump"
}
WHY THIS IS WRONG: Thirty minutes is not a significant time jump! It's a normal conversation duration. The scene is continuous - same room, same conversation, same active narrative moment. Time passing within a scene doesn't make a chapter break. Chapter-worthy time jumps are hours, days, weeks, or more.

### Bad Example 10: Creating Break Based on Mood Change
INPUT:
"""
Previous Location: Beach House - Deck - Watching the sunset
Previous Time: Wednesday, July 22, 2025 at 7:45 PM

Luna: *The sunset is a lie, Luna decides. All that beauty, all those colors, hiding the fact that another day is ending with nothing resolved. She drains her wine glass and goes inside for a refill. The beach house is dark except for the kitchen light, casting long shadows across the hardwood floors. Her phone sits on the counter, silent. No calls from her agent. No callbacks from the auditions. She's been in LA for three years now, and she's exactly where she started - nowhere. The wine bottle is almost empty. Tomorrow she'll buy another. Tonight she'll finish this one and watch trash TV and try not to think about her mother's voice asking when she's coming home to get a real job. The refrigerator hums. The waves crash. Luna drinks.*
"""
WRONG OUTPUT:
{
  "reasoning": "The tone has shifted dramatically from watching a sunset to dark introspection. This emotional transition from hope to despair represents a significant narrative shift worthy of a chapter break.",
  "shouldEnd": true,
  "reason": "location_change"
}
WHY THIS IS WRONG: Mood and emotional shifts don't constitute chapter breaks by themselves. She's simply walked from the deck to the kitchen of the same beach house, probably just minutes apart, to get more wine. The narrative continues seamlessly. Internal emotional journey is not the same as physical relocation or time passage. Also, claiming "location_change" for walking inside is incorrect.

### Bad Example 11: Not Recognizing Multi-Day Time Skip
INPUT:
"""
Previous Location: Hospital - Emergency Room - Waiting area
Previous Time: Friday, January 3, 2025 at 11:30 PM

Marcus: *The funeral home is quiet in that specific way that only funeral homes can be - hushed with reverence and air freshener. Marcus signs the paperwork the director slides across the desk. Cremation. Simple service. No viewing. Just like Dad would have wanted, though they never actually talked about it. The director expresses condolences with practiced sincerity. Marcus nods and doesn't cry. He cried enough over the weekend. Now there's just this - logistics, paperwork, the bureaucracy of death. Outside, the January wind cuts through his thin jacket. He forgot his good coat at the hospital, in those frantic first hours. Now it probably smells like antiseptic and loss. He'll buy a new one.*
"""
WRONG OUTPUT:
{
  "reasoning": "The character is dealing with the aftermath of a hospital scene. This is emotional continuity - processing the death that occurred. The narrative thread is unbroken.",
  "shouldEnd": false
}
WHY THIS IS WRONG: Marcus mentions he "cried enough over the weekend" - indicating multiple days have passed since the ER scene. He's now at a funeral home making arrangements, not still at the hospital. Time has passed (at least several days, given "the weekend"), location has changed (hospital to funeral home), and the narrative phase has shifted from crisis to aftermath. This is clearly a chapter break with reason "both".

### Bad Example 12: Breaking at Cliffhanger Instead of Resolution
INPUT:
"""
Previous Location: Abandoned Factory - Main floor - Behind rusted machinery
Previous Time: Thursday, August 8, 2024 at 9:15 PM

Sarah: *The gunshot echoes through the empty factory, deafening in the enclosed space. Sarah freezes, her heart pounding so hard she can feel it in her teeth. Somewhere in the darkness, footsteps. Getting closer. She presses herself against the cold metal of the old pressing machine, trying to make herself small, invisible. Another shot - this one closer, sparking off metal somewhere to her left. "I know you're here," Viktor's voice calls out, almost friendly. "Come out and we can talk." She doesn't believe him. She can't. Her hand finds the gun at her hip, but her fingers are shaking too badly to draw it. The footsteps stop. She holds her breath.*
"""
WRONG OUTPUT:
{
  "reasoning": "This is a tense cliffhanger moment. Chapter breaks often occur at cliffhangers to maintain reader engagement. The scene has reached a peak tension point.",
  "shouldEnd": true,
  "reason": "location_change"
}
WHY THIS IS WRONG: First, this is NOT a location change - she's still in the same factory, hiding behind machinery. Second, chapter breaks should occur at natural narrative transitions (location changes, time jumps), not in the middle of action sequences just because tension is high. The chapter should continue through this sequence and potentially break AFTER the resolution of this encounter. Cliffhangers are scene-level tools, not chapter-level tools, and "location_change" is factually incorrect here.
`;

export const chapterEndedPrompt: PromptTemplate<ExtractedChapterEnded> = {
	name: 'chapter_ended',
	description:
		'Detect natural chapter breaks based on major location changes, significant time jumps, or both',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.currentLocation,
		PLACEHOLDERS.currentTime,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to detect natural chapter boundaries.

## Your Task
Determine if the current scene represents a natural chapter break from the previous state. Chapter breaks occur when:
- **Major Location Change**: Moving to a significantly different location (different city, different building/venue, leaving a location entirely)
- **Significant Time Jump**: Hours, days, weeks, or longer have passed between scenes
- **Both**: Both location and time have changed significantly

## What is NOT a Chapter Break
- Moving to a different room in the same building during continuous action
- Small time passages (minutes to an hour) within the same scene
- Flashbacks described in dialogue (the narrative frame remains the same)
- Emotional shifts without physical relocation or time passage
- Discussion of future plans or past events
- Cliffhangers or tension peaks (these are within chapters, not between them)

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of location and time changes
- "shouldEnd": Boolean - true if this is a chapter boundary
- "reason": (Only if shouldEnd is true) One of: "location_change", "time_jump", "both"

## Evaluation Criteria
1. Compare the previous location to the current scene location
2. Compare the previous time to any time references in the current scene
3. Consider whether the narrative has shifted to a new phase or continues the same beat
4. Look for explicit time indicators ("three weeks later", "the next morning", seasons changing)
5. Look for travel or relocation indicators (arriving somewhere new, leaving somewhere)

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Previous State
Location: {{currentLocation}}
Time: {{currentTime}}

## Character Context
Name: {{characterName}}

## Current Scene
{{messages}}

## Task
Analyze whether this scene represents a natural chapter break from the previous state. Consider:
1. Has the location changed significantly (different venue, area, or city)?
2. Has significant time passed (hours, days, or more)?
3. Has the narrative shifted to a new phase?

Respond with your analysis as JSON.`,

	responseSchema: chapterEndedSchema,

	defaultTemperature: 0.3,

	parseResponse(response: string): ExtractedChapterEnded | null {
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
		if (typeof parsed.shouldEnd !== 'boolean') return null;

		// Validate reason if shouldEnd is true
		if (parsed.shouldEnd) {
			const validReasons = ['location_change', 'time_jump', 'both'];
			if (parsed.reason && !validReasons.includes(parsed.reason as string)) {
				return null;
			}
		}

		return parsed as unknown as ExtractedChapterEnded;
	},
};
