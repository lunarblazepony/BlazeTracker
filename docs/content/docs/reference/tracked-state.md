---
title: Tracked State
weight: 1
---

Complete reference for all fields tracked by BlazeTracker, organized by category.

## Time

| Field | Type | Description |
|-------|------|-------------|
| time | `moment.Moment` | Current narrative date and time |

Time is stored as ISO strings in events/snapshots and deserialized to moment.js objects in projections.

## Location

| Field | Type | Description |
|-------|------|-------------|
| area | `string` | Broad region (e.g., "Mondstadt", "New York") |
| place | `string` | Specific location (e.g., "Angel's Share tavern") |
| position | `string` | Position within the place (e.g., "At the bar counter") |
| props | `string[]` | Nearby objects and items |
| locationType | `LocationType` | Indoor/outdoor classification |

### Location Types

| Value | Description |
|-------|-------------|
| `outdoor` | Outside, exposed to weather |
| `modern` | Climate-controlled (HVAC) — offices, malls, hotels |
| `heated` | Traditional heating — homes, cabins, taverns |
| `unheated` | Shelter but no climate control — barns, warehouses |
| `underground` | Below ground, stable temp — caves, basements |
| `tent` | Minimal shelter — tents, campsites |
| `vehicle` | Enclosed transport — cars, trains, planes |

## Climate

Climate is computed from weather forecasts, not extracted directly. See [Procedural Weather](../../concepts/procedural-weather).

| Field | Type | Description |
|-------|------|-------------|
| temperature | `number` | Current temperature (°F internally, displayed per user preference) |
| outdoorTemperature | `number` | Outdoor temperature before indoor adjustment |
| indoorTemperature | `number` | Indoor-adjusted temperature (if applicable) |
| feelsLike | `number` | Feels-like temperature |
| humidity | `number` | Relative humidity (0-100%) |
| precipitation | `number` | Precipitation amount |
| cloudCover | `number` | Cloud cover (0-100%) |
| windSpeed | `number` | Wind speed (mph) |
| windDirection | `string` | Cardinal wind direction |
| conditions | `string` | Human-readable condition string |
| conditionType | `WeatherCondition` | Condition category |
| uvIndex | `number` | UV index |
| daylight | `DaylightPhase` | Current daylight phase |
| isIndoors | `boolean` | Whether location is indoors |
| buildingType | `BuildingType` | Building type (if indoors) |

### Weather Conditions

`clear` · `sunny` · `partly_cloudy` · `overcast` · `foggy` · `drizzle` · `rain` · `heavy_rain` · `thunderstorm` · `sleet` · `snow` · `heavy_snow` · `blizzard` · `windy` · `hot` · `cold` · `humid`

### Daylight Phases

`dawn` · `day` · `dusk` · `night`

## Characters

Each present character has:

| Field | Type | Description |
|-------|------|-------------|
| name | `string` | Character name |
| profile | `CharacterProfile` | Condensed profile (extracted once) |
| position | `string` | Physical position in the scene |
| activity | `string \| null` | Current activity |
| mood | `string[]` | Current mood tags |
| physicalState | `string[]` | Physical state tags |
| outfit | `CharacterOutfit` | Current outfit by slot |
| akas | `string[]` | Alternate names, nicknames, pet names, aliases. Used for automatic name resolution during extraction. |

### Character Profile

| Field | Type | Description |
|-------|------|-------------|
| sex | `'M' \| 'F' \| 'O'` | Biological sex |
| species | `string` | Species |
| age | `number` | Age |
| appearance | `string[]` | 8-10 appearance tags |
| personality | `string[]` | 8-10 personality tags |

### Outfit Slots

| Slot | Examples |
|------|----------|
| `head` | Hat, headband, tiara, glasses |
| `neck` | Necklace, scarf, choker, tie |
| `jacket` | Hoodie, blazer, coat, vest |
| `back` | Backpack, wings, cloak, cape |
| `torso` | T-shirt, blouse, tank top, dress |
| `legs` | Jeans, skirt, shorts, leggings |
| `underwear` | Boxers, bra, panties, briefs |
| `socks` | Ankle socks, thigh-highs, stockings |
| `footwear` | Sneakers, boots, sandals, heels |

Each slot is `string | null`. Null means the slot is empty (nothing worn).

## Scene

| Field | Type | Description |
|-------|------|-------------|
| topic | `string` | Current scene topic |
| tone | `string` | Current scene tone |
| tension.level | `TensionLevel` | Tension intensity |
| tension.type | `TensionType` | Nature of the tension |
| tension.direction | `TensionDirection` | Whether tension is changing |

### Tension Levels

In order from lowest to highest:

| Level | Description |
|-------|-------------|
| `relaxed` | Calm, no tension |
| `aware` | Slight awareness of potential tension |
| `guarded` | Cautious, on alert |
| `tense` | Notable tension present |
| `charged` | High tension, something could happen |
| `volatile` | Very high tension, situation is unstable |
| `explosive` | Maximum tension, breaking point |

### Tension Types

| Type | Description |
|------|-------------|
| `confrontation` | Conflict or opposition between characters |
| `intimate` | Emotional or physical closeness |
| `vulnerable` | Emotional exposure or risk |
| `celebratory` | Joy, triumph, or celebration |
| `negotiation` | Discussion, bargaining, persuasion |
| `suspense` | Uncertainty, anticipation, mystery |
| `conversation` | General dialogue without strong tension |

### Tension Directions

| Direction | Description |
|-----------|-------------|
| `escalating` | Tension is increasing |
| `stable` | Tension is unchanged |
| `decreasing` | Tension is decreasing |

## Relationships

Each character pair has:

| Field | Type | Description |
|-------|------|-------------|
| pair | `[string, string]` | Alphabetically sorted character names |
| status | `RelationshipStatus` | Current relationship status |
| aToB | `RelationshipAttitude` | How character A feels about B |
| bToA | `RelationshipAttitude` | How character B feels about A |

### Relationship Attitude

| Field | Type | Description |
|-------|------|-------------|
| feelings | `string[]` | Emotional feelings toward the other |
| secrets | `string[]` | What they hide from the other |
| wants | `string[]` | What they want regarding the other |

### Relationship Statuses

| Status | Description |
|--------|-------------|
| `strangers` | No prior relationship |
| `acquaintances` | Know of each other |
| `friendly` | Positive but not close |
| `close` | Strong positive bond |
| `intimate` | Deep personal connection |
| `strained` | Relationship under stress |
| `hostile` | Active animosity |
| `complicated` | Mixed or unclear dynamics |

## Chapters

| Field | Type | Description |
|-------|------|-------------|
| index | `number` | Chapter index (0-based) |
| title | `string` | Chapter title |
| summary | `string` | Chapter summary |
| endReason | `string \| null` | Why chapter ended (null = current chapter) |
| endedAtMessage | `MessageAndSwipe \| null` | Where chapter ended |
| eventCount | `number` | Number of narrative events |

### Chapter End Reasons

| Reason | Description |
|--------|-------------|
| `location_change` | Characters moved to a new area |
| `time_jump` | Significant time skip |
| `both` | Both location change and time jump |
| `manual` | Manually triggered chapter break |

## Narrative Events

| Field | Type | Description |
|-------|------|-------------|
| description | `string` | Brief summary of what happened |
| witnesses | `string[]` | Characters who were present |
| location | `string` | Where it occurred |
| tension | `{ level, type }` | Tension at the moment |
| subjects | `NarrativeEventSubject[]` | Interaction types detected |
| chapterIndex | `number` | Which chapter this event belongs to |
| narrativeTime | `moment.Moment \| null` | When it occurred in narrative time |
