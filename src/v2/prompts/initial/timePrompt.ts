/**
 * Initial Time Extraction Prompt
 *
 * Extracts the initial date/time from the opening messages of a roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedInitialTime } from '../../types/extraction';
import { initialTimeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Explicit Date and Time
INPUT:
"""
Elena: *The clock on the wall reads 3:47 PM as Elena steps into the coffee shop on this chilly Tuesday afternoon. November 14th, 2024 - exactly one year since everything changed. She pulls her coat tighter around her shoulders, scanning the crowd for any sign of Marcus. The barista calls out an order, the espresso machine hisses, and somewhere in the back a child is laughing. Elena finds a seat near the window, the gray sky outside matching her mood perfectly. She checks her phone - no new messages. Typical. The waitress approaches with a menu, but Elena waves her away, knowing she won't be ordering until Marcus arrives. If he arrives at all.*
"""
OUTPUT:
{
  "reasoning": "The text explicitly states 'The clock on the wall reads 3:47 PM' and mentions 'Tuesday afternoon' and 'November 14th, 2024'. This gives us a complete date and time.",
  "time": {
    "year": 2024,
    "month": 11,
    "day": 14,
    "hour": 15,
    "minute": 47,
    "second": 0,
    "dayOfWeek": "Tuesday"
  }
}

### Example 2: Partial Time with Context Clues
INPUT:
"""
Marcus: *The summer heat is oppressive as Marcus waits outside the old warehouse. It's been three hours since noon, and still no sign of the courier. Sweat drips down his neck, soaking the collar of his white shirt. The August sun beats down mercilessly on the cracked pavement, creating shimmering heat mirages in the distance. He checks his watch for the hundredth time, then pulls out a cigarette, lighting it with trembling hands. The year 2019 had been nothing but disappointments, and it seemed like that trend would continue. A stray dog wanders past, panting heavily. Marcus considers calling off the whole operation, but the money is too good. The warehouse door remains stubbornly closed.*
"""
OUTPUT:
{
  "reasoning": "The text states 'three hours since noon' which means 3:00 PM (15:00). It mentions 'August sun' for the month and '2019' for the year. No specific day is given, so I'll use a reasonable default of August 15th. No day of week mentioned, so I need to calculate that August 15, 2019 was a Thursday.",
  "time": {
    "year": 2019,
    "month": 8,
    "day": 15,
    "hour": 15,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Thursday"
  }
}

### Example 3: Morning Scene with Seasonal Context
INPUT:
"""
Sarah: *Dawn breaks over the mountain village, painting the snow-capped peaks in shades of pink and gold. Sarah stretches in her narrow bed, the wooden floor creaking beneath her feet as she rises. The first day of spring, March 20th, and yet winter still clings stubbornly to the high country. She can hear her grandmother already moving about in the kitchen below, the clatter of pots and pans a familiar morning symphony. Sarah checks the old grandfather clock in the hallway - 6:15 AM, right on schedule. She has exactly two hours before she needs to leave for the city. The year 2023 had brought many changes to this sleepy village, but mornings like this remained blessedly constant. She walks to the window, breath fogging the glass, and watches the sun slowly climb.*
"""
OUTPUT:
{
  "reasoning": "The text states 'Dawn breaks' and the clock reads '6:15 AM'. The date is explicitly given as 'March 20th' and the year is '2023'. March 20, 2023 was a Monday.",
  "time": {
    "year": 2023,
    "month": 3,
    "day": 20,
    "hour": 6,
    "minute": 15,
    "second": 0,
    "dayOfWeek": "Monday"
  }
}

### Example 4: Late Night Scene
INPUT:
"""
Detective Chen: *The neon signs of the red-light district cast garish reflections on the rain-slicked streets as Detective Chen makes his rounds. His watch shows 11:45 PM - fifteen minutes until his shift ends, fifteen minutes until the new year begins. December 31st, 2020, and he's spending it alone as usual. The pandemic had emptied the usually crowded streets, leaving only the desperate and the lost wandering through the cold. A distant firework explodes prematurely, making him reach for his gun before he catches himself. Chen lights a cigarette and leans against a lamp post, watching a couple hurry past with champagne bottles clutched to their chests. Somewhere a car alarm goes off, then falls silent. The night feels heavy with endings and beginnings.*
"""
OUTPUT:
{
  "reasoning": "The watch shows '11:45 PM' and it's 'December 31st, 2020' - New Year's Eve. December 31, 2020 was a Thursday.",
  "time": {
    "year": 2020,
    "month": 12,
    "day": 31,
    "hour": 23,
    "minute": 45,
    "second": 0,
    "dayOfWeek": "Thursday"
  }
}

### Example 5: Afternoon with Indirect Time Reference
INPUT:
"""
Mira: *The afternoon sun hangs low on the horizon, casting long shadows across the university campus. Mira had been waiting at this bench for over an hour now, watching students drift by in groups of twos and threes. The digital clock on the library tower flashes 4:30, then cycles to show the date: October 3rd. She remembers reading somewhere that this day, back in the year 2018, would mark some kind of historical anniversary, but the details escape her now. A squirrel darts across the path, making her jump. Her coffee has gone cold, the textbook on her lap forgotten. She's been trying to study for finals, but concentration is impossible when every passing figure makes her heart race with anticipation. The autumn breeze carries the scent of fallen leaves and impending rain.*
"""
OUTPUT:
{
  "reasoning": "The digital clock shows '4:30' in the afternoon (the text mentions 'afternoon sun'). The date is 'October 3rd' in '2018'. October 3, 2018 was a Wednesday.",
  "time": {
    "year": 2018,
    "month": 10,
    "day": 3,
    "hour": 16,
    "minute": 30,
    "second": 0,
    "dayOfWeek": "Wednesday"
  }
}

### Example 6: Early Morning Before Dawn
INPUT:
"""
James: *The alarm clock blares its shrill warning at 4:00 AM sharp, dragging James from a dreamless sleep. Monday morning, the first day of June 2022, and already he dreads the week ahead. He slaps the snooze button and lies still, staring at the ceiling where shadows dance from passing headlights. The apartment is cold, the heating having shut off at midnight to save money. His cat, a mangy orange tabby named Rust, jumps onto the bed and begins kneading his chest with sharp claws. James groans and pushes the animal away, but it persists, purring loudly. Finally, he forces himself upright, feet finding the cold hardwood floor. Coffee. He needs coffee before anything else can happen. The pre-dawn darkness outside his window offers no comfort.*
"""
OUTPUT:
{
  "reasoning": "The alarm clock shows '4:00 AM' and it's explicitly 'Monday morning, the first day of June 2022'. June 1, 2022 was indeed a Wednesday, not Monday - but the text explicitly says Monday, so there may be an inconsistency. I'll trust the explicit day of week stated.",
  "time": {
    "year": 2022,
    "month": 6,
    "day": 1,
    "hour": 4,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Monday"
  }
}

### Example 7: Midnight Scene
INPUT:
"""
Luna: *The grandfather clock in the hallway strikes twelve, its deep chimes echoing through the empty mansion. Luna counts each one, confirming what she already knew - midnight has arrived, and with it, her twenty-first birthday. July 15th, 2025 - a date she had been dreading for years. The party guests have all gone home, leaving behind empty champagne glasses and deflated balloons. She stands alone in the grand ballroom, her reflection multiplied infinitely in the mirrors that line the walls. Her heels click against the marble floor as she walks to the window, pushing aside the heavy velvet curtains. The garden below is silver with moonlight, the fountain still and silent. Somewhere in the darkness, an owl calls. Luna lets the curtain fall and turns away from the night.*
"""
OUTPUT:
{
  "reasoning": "The clock strikes twelve midnight, marking the start of her birthday on 'July 15th, 2025'. July 15, 2025 falls on a Tuesday.",
  "time": {
    "year": 2025,
    "month": 7,
    "day": 15,
    "hour": 0,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Tuesday"
  }
}

### Example 8: Fantasy Setting with Real-World Time Mapping
INPUT:
"""
Narrator: *The twin moons of Aethoria hang heavy in the evening sky as the village bells toll seven times, marking the dinner hour. It is the fifteenth day of Harvest Month, in the year 847 of the Third Age - though scholars argue endlessly about what this means in the old calendar. Lady Evelyn stands at her tower window, watching the farmers return from the fields below. The autumn wind carries the smell of burning leaves and fresh bread. Her handmaiden enters with a tray of food, but Evelyn waves her away, too anxious to eat. Tomorrow the king's men arrive to collect taxes, and the village coffers are nearly empty. She turns back to her desk, covered in ledgers and scrolls, each one telling the same story of declining fortunes. The candles flicker as the wind finds its way through the old stone walls.*
"""
OUTPUT:
{
  "reasoning": "This is a fantasy setting with non-standard calendar (Third Age 847, Harvest Month). However, the scene provides useful contextual clues: 'evening sky', 'bells toll seven times', 'fifteenth day', 'autumn'. I'll map this to a reasonable real-world equivalent: September 15th at 7:00 PM. Using a generic year like 2024 since the fantasy year doesn't map directly. September 15, 2024 is a Sunday.",
  "time": {
    "year": 2024,
    "month": 9,
    "day": 15,
    "hour": 19,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Sunday"
  }
}

### Example 9: Scene with Only Relative Time Clues
INPUT:
"""
Alex: *The lunch rush is in full swing at Tony's Diner, the clatter of dishes and buzz of conversation creating a wall of noise that makes thinking nearly impossible. Alex squeezes into the last empty booth, grateful for the tiny island of space. The waitress appears almost immediately, pencil poised over her pad, one eyebrow raised in impatient inquiry. Alex orders the special without looking at the menu - it's always the same on Wednesdays, meatloaf and mashed potatoes. The winter sun streams weakly through the grimy windows, providing little warmth. Alex's phone buzzes - a text from Mom, reminding him that Christmas is only two weeks away. He sighs and pockets the phone without responding. Some conversations are better left for later. The meatloaf arrives, steaming and smothered in gravy.*
"""
OUTPUT:
{
  "reasoning": "The scene is during 'lunch rush' (around noon), on a Wednesday, in winter with Christmas 'two weeks away'. Two weeks before Christmas is around December 11th. No year is given, so I'll use a recent year where December 11 falls on a Wednesday: 2024. December 11, 2024 is indeed a Wednesday.",
  "time": {
    "year": 2024,
    "month": 12,
    "day": 11,
    "hour": 12,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Wednesday"
  }
}

### Example 10: Scene with Ambiguous AM/PM Resolved by Context
INPUT:
"""
Dr. Reyes: *The hospital corridor is eerily quiet at this hour, the overhead lights dimmed to their nighttime setting. Dr. Reyes checks her pager - 2:17 shows on the display, though whether it's AM or PM hardly matters anymore after a thirty-six hour shift. The date, March 8th, 2021, feels surreal, as if time itself has lost meaning within these sterile white walls. She's been awake so long that the coffee no longer helps, just makes her hands shake. A nurse hurries past with a crash cart, the wheels squeaking on the linoleum. Somewhere a monitor beeps its steady rhythm. Dr. Reyes leans against the wall and closes her eyes, just for a moment. Sleep tugs at her consciousness, but she pushes it away. There are still three more hours until the day shift arrives, three more hours of responsibility. She forces herself upright and continues her rounds.*
"""
OUTPUT:
{
  "reasoning": "The pager shows '2:17' and context tells us it's nighttime ('nighttime setting', 'three more hours until the day shift arrives'). Day shift typically starts at 6-7 AM, so 3 hours before would be 3-4 AM, making this 2:17 AM. The date is 'March 8th, 2021'. March 8, 2021 was a Monday.",
  "time": {
    "year": 2021,
    "month": 3,
    "day": 8,
    "hour": 2,
    "minute": 17,
    "second": 0,
    "dayOfWeek": "Monday"
  }
}

### Example 11: Historical Setting
INPUT:
"""
Captain Wells: *The oil lamp sputters and flickers as Captain Wells bends over his charts, the wooden deck swaying beneath his feet. By his reckoning, they should reach port within the week if the winds hold. He pulls out his pocket watch - half past nine in the evening, the twenty-third of April, eighteen hundred and fifty-two. The crew has been restless lately, muttering about bad omens and ghost ships. Wells ignores them, as he ignores most things that don't directly concern navigation or profit. Through the porthole, he can see nothing but endless black water beneath a canopy of stars. The ship creaks and groans, speaking its own language of stress and strain. His first mate knocks and enters without waiting for permission, bearing news of a developing storm to the east.*
"""
OUTPUT:
{
  "reasoning": "The pocket watch shows 'half past nine in the evening' (21:30) on 'the twenty-third of April, eighteen hundred and fifty-two' (April 23, 1852). April 23, 1852 was a Friday.",
  "time": {
    "year": 1852,
    "month": 4,
    "day": 23,
    "hour": 21,
    "minute": 30,
    "second": 0,
    "dayOfWeek": "Friday"
  }
}

### Example 12: Sci-Fi Future Setting
INPUT:
"""
Commander Vex: *The holographic display flickers to life, casting a blue glow across the command deck of the starship Prometheus. Commander Vex checks the ship's chronometer: 0800 hours, standard Earth time, May 1st, 2347. She has been awake for nearly eighteen hours, overseeing the repairs to the damaged hull plating. Through the reinforced viewport, the rings of Saturn shimmer like a jeweled bracelet against the velvet darkness of space. The AI chimes softly, reporting that all systems are nominal and the crew rotation has begun. Vex stretches, her joints popping after hours of tension. In six more hours, they'll begin the slingshot maneuver around the gas giant, using its gravity to boost their speed toward the outer colonies. Until then, there's nothing to do but wait and watch the stars turn slowly past.*
"""
OUTPUT:
{
  "reasoning": "The chronometer shows '0800 hours' (8:00 AM) on 'May 1st, 2347'. For the day of week, I'll calculate: May 1, 2347 would fall on a Saturday based on calendar projection.",
  "time": {
    "year": 2347,
    "month": 5,
    "day": 1,
    "hour": 8,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Saturday"
  }
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Guessing Without Evidence
INPUT:
"""
Elena: *She walks into the room, looking around nervously. The place is exactly as she remembered it - the faded wallpaper, the creaky floorboards, the smell of old books and dust. She runs her finger along the mantelpiece, leaving a trail in the accumulated grime. A spider web catches the light from the dirty window. Elena shivers, pulling her jacket tighter. Memories flood back unbidden - laughter, tears, whispered promises in the dark. She should never have come back here. The house seems to hold its breath, waiting to see what she'll do next. In the distance, she can hear traffic passing on the main road, a reminder that the world outside still exists. Elena takes a deep breath and steps further into the shadows.*
"""
WRONG OUTPUT:
{
  "reasoning": "I'll guess it's autumn based on the mood, maybe October 2023, around 3 PM.",
  "time": {
    "year": 2023,
    "month": 10,
    "day": 15,
    "hour": 15,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Sunday"
  }
}
WHY THIS IS WRONG: The text provides almost no time information. There's light from a window and traffic sounds, suggesting daytime, but no specific time. The jacket could indicate any cool season. When minimal evidence exists, the reasoning should acknowledge this uncertainty rather than confidently guessing specific values.

### Bad Example 2: Ignoring Explicit Time Information
INPUT:
"""
Marcus: *The digital clock on the dashboard reads 14:32 as Marcus pulls into the parking lot. Saturday afternoon, the lot is nearly full with weekend shoppers. He finally finds a spot near the back, next to a rusted pickup truck that's seen better days. The March wind cuts through his thin jacket as he exits the car, making him wish he'd worn something warmer. 2024 has been a cold year so far. He hurries toward the mall entrance, dodging puddles from last night's rain. A group of teenagers loiters near the doors, vaping and laughing at something on a phone. Marcus pushes past them, focused on his mission - find a birthday present for his mother before the stores close at six.*
"""
WRONG OUTPUT:
{
  "reasoning": "It's afternoon at a mall. I'll say it's around 2 PM.",
  "time": {
    "year": 2024,
    "month": 3,
    "day": 15,
    "hour": 14,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Friday"
  }
}
WHY THIS IS WRONG: The text explicitly says "14:32" but the output only says "around 2 PM" and loses the minute precision. It also says "Saturday afternoon" but outputs Friday. When explicit information is given, it must be used exactly.

### Bad Example 3: Wrong Month Number Convention
INPUT:
"""
Sarah: *Christmas Eve, 5:30 PM, and the shopping mall is absolute chaos. Sarah weaves through the crowd, clutching her shopping bags like a shield. 2023 has been a year of surprises, and she's determined to end it on a high note with perfect gifts for everyone on her list. The massive Christmas tree in the center atrium twinkles with thousands of lights, casting rainbow reflections on the faces of exhausted shoppers. A brass band plays carols somewhere near the food court, barely audible over the general din. Sarah's feet ache from hours of walking, but she's only halfway done. She checks her phone - two hours until the mall closes, two hours to find something for her impossible-to-please father. She soldiers on, determined.*
"""
WRONG OUTPUT:
{
  "reasoning": "Christmas Eve is December 24th at 5:30 PM.",
  "time": {
    "year": 2023,
    "month": 24,
    "day": 12,
    "hour": 17,
    "minute": 30,
    "second": 0,
    "dayOfWeek": "Sunday"
  }
}
WHY THIS IS WRONG: The month and day are swapped. Month should be 12 (December), day should be 24. Also, December 24, 2023 was a Sunday, which happens to be correct, but the reasoning shows confusion about the date format.

### Bad Example 4: Not Calculating Day of Week
INPUT:
"""
Detective Chen: *The fluorescent lights buzz overhead as Chen reviews the case files. His desk calendar shows June 15, 2021 - exactly one month since the murder. The clock on the wall reads 9:15 PM, and the precinct is nearly empty, only a few dedicated officers still working at this hour. Chen rubs his tired eyes and reaches for his cold coffee. The victim's photograph stares up at him from the open folder, forever frozen in a smile that will never fade. He's been over these files a hundred times, looking for something he missed. The answer is here somewhere, hidden in the details. A colleague waves goodnight as she heads for the elevator. Chen barely acknowledges her, lost in thought.*
"""
WRONG OUTPUT:
{
  "reasoning": "June 15, 2021 at 9:15 PM. I don't know what day of the week that was.",
  "time": {
    "year": 2021,
    "month": 6,
    "day": 15,
    "hour": 21,
    "minute": 15,
    "second": 0,
    "dayOfWeek": "Monday"
  }
}
WHY THIS IS WRONG: The reasoning says "I don't know" but then guesses Monday. June 15, 2021 was actually a Tuesday. The day of week must be calculated correctly from the given date.

### Bad Example 5: Confusing 12-hour and 24-hour Format
INPUT:
"""
Mira: *The antique clock in the corner chimes twice - 2 o'clock in the afternoon. Mira has been waiting in this dusty bookshop since morning, searching for a specific first edition that the owner insists exists somewhere in the labyrinthine stacks. February 28th, 2020, and she still has three more shops to visit today if this one turns up empty. The owner, a wizened old man with thick glasses, shuffles past carrying a tower of books that threatens to topple at any moment. Mira offers to help, but he waves her away with a grumble. She returns to her search, running her fingers along cracked spines and faded titles. Dust motes dance in the weak winter light streaming through the grimy windows.*
"""
WRONG OUTPUT:
{
  "reasoning": "2 o'clock in the afternoon, so that's 2:00.",
  "time": {
    "year": 2020,
    "month": 2,
    "day": 28,
    "hour": 2,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Friday"
  }
}
WHY THIS IS WRONG: "2 o'clock in the afternoon" is 14:00, not 02:00. The hour should be 14 in 24-hour format.

### Bad Example 6: Inventing Specific Times from Vague Descriptions
INPUT:
"""
James: *Morning light streams through the curtains as James slowly wakes. He spent most of the night tossing and turning, plagued by nightmares he can barely remember. The apartment is quiet except for the distant hum of traffic and the occasional bark of a neighbor's dog. He reaches for his phone to check the time but finds it dead - forgot to charge it again. With a groan, he forces himself out of bed and stumbles toward the kitchen, following the smell of coffee that his automatic machine has prepared. It's sometime in late April, he thinks, though the exact date escapes him. The year 2019 feels like it's been going on forever. He pours himself a cup and stares out the window at the gray sky, wondering if he should call in sick to work.*
"""
WRONG OUTPUT:
{
  "reasoning": "Morning light suggests around 7:30 AM. Late April 2019, I'll say April 25th.",
  "time": {
    "year": 2019,
    "month": 4,
    "day": 25,
    "hour": 7,
    "minute": 30,
    "second": 0,
    "dayOfWeek": "Thursday"
  }
}
WHY THIS IS WRONG: The text says "morning light" and "late April" but provides no specific time or date. The output invents 7:30 AM and April 25th with false precision. When time is ambiguous, the reasoning should note this and defaults should be used (like mid-month and a neutral morning time like 9:00 AM), not arbitrary specific values.

### Bad Example 7: Misinterpreting Relative Time
INPUT:
"""
Luna: *Two hours before sunset, Luna begins her preparations. The autumn equinox of 2022 demands certain rituals be observed, certain traditions upheld. She gathers candles, herbs, and the old book passed down through generations of her family. The September air carries the first hints of the coming cold, a reminder that the wheel of the year continues to turn. Her cottage sits alone on the hillside, far from prying eyes and curious neighbors. She works in silence, arranging each item with careful precision. The cats watch from their perches, green eyes tracking her every movement. When everything is ready, she sits cross-legged before the altar and waits for the perfect moment - that liminal space between day and night when anything becomes possible.*
"""
WRONG OUTPUT:
{
  "reasoning": "Two hours before sunset on the autumn equinox. Sunset is around 6 PM, so two hours before is 4 PM.",
  "time": {
    "year": 2022,
    "month": 9,
    "day": 21,
    "hour": 4,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Wednesday"
  }
}
WHY THIS IS WRONG: The hour is 4, which would be 4:00 AM, not 4:00 PM (16:00). When working with 24-hour time, afternoon/evening hours must be 12+. The correct hour should be 16.

### Bad Example 8: Ignoring Story Context for Time
INPUT:
"""
The Narrator: *The story begins, as all good stories do, on a dark and stormy night. Lightning splits the sky above the old mansion on the hill, illuminating its Gothic towers for a brief, terrible moment. Inside, the grandfather clock in the main hall begins to strike - one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve. Midnight. The witching hour. Halloween night, the year of our Lord nineteen-hundred-and-twenty-three. The guests assembled in the parlor exchange nervous glances as the thunder rolls overhead. Their host, the mysterious Count Ravenswood, rises from his chair with a thin smile. "Now," he says, "the real entertainment begins." The candles flicker, then go out, plunging the room into absolute darkness.*
"""
WRONG OUTPUT:
{
  "reasoning": "Dark and stormy, could be any time. I'll say evening, around 8 PM.",
  "time": {
    "year": 1923,
    "month": 10,
    "day": 31,
    "hour": 20,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Wednesday"
  }
}
WHY THIS IS WRONG: The text explicitly states the clock strikes twelve times for midnight, and it's Halloween night 1923. The hour should be 0 (midnight), not 20 (8 PM). The explicit time in the text must be used.

### Bad Example 9: Wrong Year from Context Clues
INPUT:
"""
Alex: *The New Year's Eve party is in full swing, confetti and champagne flowing in equal measure. Alex checks his phone - 11:55 PM, five minutes until the ball drops. The crowd around him buzzes with anticipation, strangers becoming friends in the magic of the moment. The year 1999 is about to end, taking with it a millennium of history. Some people are worried about Y2K, but Alex figures if the computers all crash, at least the hangover won't seem so bad by comparison. He spots Maria across the room, her silver dress catching the light like liquid mercury. Their eyes meet, and she smiles. The countdown begins - ten, nine, eight. Alex pushes through the crowd toward her, determined to start the new millennium with a kiss.*
"""
WRONG OUTPUT:
{
  "reasoning": "New Year's Eve at 11:55 PM. The text mentions 1999 but we're about to enter 2000.",
  "time": {
    "year": 2000,
    "month": 1,
    "day": 1,
    "hour": 23,
    "minute": 55,
    "second": 0,
    "dayOfWeek": "Saturday"
  }
}
WHY THIS IS WRONG: At 11:55 PM on New Year's Eve, it's still 1999 - the year doesn't change until midnight. The year should be 1999, month 12, day 31. Also, the hour would be 23:55 on December 31, 1999, which was a Friday.

### Bad Example 10: Extracting Mentioned Time Instead of Current Time
INPUT:
"""
Dr. Reyes: *The patient record shows admission time: 3:47 AM, March 3rd, 2021. Dr. Reyes reviews the chart, noting the progression of symptoms over the past week. It's now Friday the 10th, and the patient has finally stabilized. The afternoon sun streams through the hospital window, casting warm rectangles of light across the sterile white sheets. A vase of fresh flowers sits on the bedside table, brought by a visitor this morning. Reyes makes a note in the chart, then looks up at the wall clock - 2:30 PM. The patient sleeps peacefully for the first time in days. She allows herself a small smile of satisfaction before moving on to the next room.*
"""
WRONG OUTPUT:
{
  "reasoning": "The record shows 3:47 AM on March 3rd, 2021.",
  "time": {
    "year": 2021,
    "month": 3,
    "day": 3,
    "hour": 3,
    "minute": 47,
    "second": 0,
    "dayOfWeek": "Wednesday"
  }
}
WHY THIS IS WRONG: The admission time is a past reference, not the current time. The current scene is on "Friday the 10th" at "2:30 PM" (14:30), one week after admission. March 10, 2021 was a Wednesday, not Friday - so this might be March 12, 2021 which was a Friday.

### Bad Example 11: Mixing Multiple Time References
INPUT:
"""
Commander Vex: *The mission briefing plays back on the screen: "Operation commenced at 0600 hours, April 15th." Vex pauses the recording and checks the current ship time - 22:47, April 17th. Two days since everything went wrong. She's been reviewing the footage obsessively, looking for the moment when the mission went sideways. The year 2156 has not been kind to the fleet. Her coffee has gone cold, the cup sitting forgotten beside a pile of mission reports. Through the porthole, she can see the distant star that was supposed to be their destination, now an unreachable goal. The AI chimes softly, reminding her that she hasn't slept in thirty-six hours. She ignores it and resumes the playback.*
"""
WRONG OUTPUT:
{
  "reasoning": "The mission started at 0600 on April 15th. That's 6 AM.",
  "time": {
    "year": 2156,
    "month": 4,
    "day": 15,
    "hour": 6,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Monday"
  }
}
WHY THIS IS WRONG: The current scene time is 22:47 on April 17th, not the mission start time. The briefing playback is a past reference. The correct time is April 17, 2156 at 22:47.

### Bad Example 12: Not Using Character Card Context
INPUT:
"""
[Character Card: Lyra, a vampire who has lived for 500 years. The story is set in modern-day New York City, 2024.]

Lyra: *The night is young, and so is the crowd at the underground club. Lyra surveys the dance floor from her usual spot in the VIP section, a glass of red wine (or so it appears to be) in her pale hand. The DJ drops a new beat, and the dancers move as one, lost in the rhythm. She has seen empires rise and fall, watched humanity crawl from darkness into electric light, and still she finds herself drawn to places like this - where the living forget their mortality and dance like there's no tomorrow. A young man catches her eye, handsome and utterly unaware of the predator watching him. Lyra smiles, revealing just the hint of sharp teeth. Perhaps tonight won't be so boring after all.*
"""
WRONG OUTPUT:
{
  "reasoning": "It's nighttime at a club. No specific time given, so I'll guess midnight.",
  "time": {
    "year": 1524,
    "month": 6,
    "day": 15,
    "hour": 0,
    "minute": 0,
    "second": 0,
    "dayOfWeek": "Wednesday"
  }
}
WHY THIS IS WRONG: The character card explicitly states "modern-day New York City, 2024" but the output uses 1524 (perhaps calculating 500 years back from her age). The story setting in the character card overrides character backstory - the current scene is in 2024, not when the character was born.
`;

export const initialTimePrompt: PromptTemplate<ExtractedInitialTime> = {
	name: 'initial_time',
	description: 'Extract the initial date and time from the opening of a roleplay',

	placeholders: [PLACEHOLDERS.messages, PLACEHOLDERS.characterName],

	systemPrompt: `You are analyzing roleplay messages to extract the current date and time.

## Your Task
Read the provided roleplay messages and determine the precise date and time when the scene is taking place.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your step-by-step analysis of time clues in the text
- "time": An object with year, month (1-12), day, hour (0-23), minute, second, and dayOfWeek

## Time Clue Priority (from highest to lowest)
1. Explicit timestamps (clocks, watches, digital displays)
2. Explicit dates mentioned in narration
3. Day of week + time of day
4. Seasonal/holiday references with context
5. Time-of-day descriptions (dawn, noon, dusk, midnight)
6. Character card/setting information

## Important Rules
- Use 24-hour format for hours (0-23)
- Months are 1-12 (January = 1, December = 12)
- Always calculate the correct day of week for the given date
- When time is ambiguous, prefer reasonable defaults over random guesses
- Current scene time matters, not past events mentioned in dialogue
- Character cards may specify the story's time period - use this if no other clues exist
- Fantasy/sci-fi calendars should be mapped to reasonable real-world equivalents

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Messages to Analyze
{{messages}}

## Task
Extract the current date and time from these messages. Think through the time clues carefully, then provide your answer as JSON.

Remember:
- Use 24-hour format (0-23 for hours)
- Months are 1-12
- Calculate the day of week correctly
- Focus on the CURRENT scene time, not past events mentioned`,

	responseSchema: initialTimeSchema,

	defaultTemperature: 0.3,

	parseResponse(response: string): ExtractedInitialTime | null {
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
		if (!parsed.time || typeof parsed.time !== 'object') return null;

		const time = parsed.time as Record<string, unknown>;
		if (typeof time.year !== 'number') return null;
		if (
			typeof time.month !== 'number' ||
			(time.month as number) < 1 ||
			(time.month as number) > 12
		)
			return null;
		if (
			typeof time.day !== 'number' ||
			(time.day as number) < 1 ||
			(time.day as number) > 31
		)
			return null;
		if (
			typeof time.hour !== 'number' ||
			(time.hour as number) < 0 ||
			(time.hour as number) > 23
		)
			return null;
		if (
			typeof time.minute !== 'number' ||
			(time.minute as number) < 0 ||
			(time.minute as number) > 59
		)
			return null;
		if (
			typeof time.second !== 'number' ||
			(time.second as number) < 0 ||
			(time.second as number) > 59
		)
			return null;

		const validDays = [
			'Sunday',
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday',
		];
		if (!validDays.includes(time.dayOfWeek as string)) return null;

		return parsed as unknown as ExtractedInitialTime;
	},
};
