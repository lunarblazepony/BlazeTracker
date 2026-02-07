---
title: Event Types
weight: 2
---

Complete reference for every event kind and subkind in BlazeTracker's event system. All events share a [base structure](#base-event), then add kind-specific fields.

## Base Event

All events include:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID for this event |
| `source.messageId` | `number` | Message that generated this event |
| `source.swipeId` | `number` | Swipe of that message |
| `timestamp` | `number` | Real-world creation time (ms) |
| `deleted` | `boolean?` | Soft delete flag |
| `kind` | `EventKind` | Event category |
| `subkind` | `string?` | Specific event type (some kinds have no subkind) |

## Time Events

### `time:initial`
Sets the absolute starting time. Created during initial extraction.

| Field | Type |
|-------|------|
| `time` | `string` (ISO 8601) |

### `time:delta`
Time passing. Created during event extraction.

| Field | Type | Description |
|-------|------|-------------|
| `delta.days` | `number` | Days passed |
| `delta.hours` | `number` | Hours passed |
| `delta.minutes` | `number` | Minutes passed |
| `delta.seconds` | `number` | Seconds passed |

## Location Events

### `location:moved`
Characters moved to a new location.

| Field | Type | Description |
|-------|------|-------------|
| `newArea` | `string` | New broad area |
| `newPlace` | `string` | New specific place |
| `newPosition` | `string` | New position within place |
| `newLocationType` | `LocationType?` | New indoor/outdoor type |
| `previousArea` | `string?` | Previous area |
| `previousPlace` | `string?` | Previous place |
| `previousPosition` | `string?` | Previous position |

### `location:prop_added`
A prop appeared in the scene.

| Field | Type |
|-------|------|
| `prop` | `string` |

### `location:prop_removed`
A prop was removed from the scene.

| Field | Type |
|-------|------|
| `prop` | `string` |

## Forecast Generated Events

### `forecast_generated`
A 28-day weather forecast was generated. No subkind.

| Field | Type | Description |
|-------|------|-------------|
| `areaName` | `string` | Area this forecast is for |
| `startDate` | `string` | Start date (YYYY-MM-DD) |
| `forecast` | `LocationForecast` | 28-day forecast data |

## Character Events

Character events track presence, profiles, state changes, and nicknames. The nickname extractor runs periodically (every 8 messages) to catch in-RP pet names, shortened names, and aliases that develop during the story.

### `character:appeared`
A character entered the scene.

| Field | Type | Description |
|-------|------|-------------|
| `character` | `string` | Character name |
| `initialPosition` | `string?` | Starting position |
| `initialActivity` | `string?` | Starting activity |
| `initialMood` | `string[]?` | Starting mood tags |
| `initialPhysicalState` | `string[]?` | Starting physical state |

### `character:departed`
A character left the scene.

| Field | Type |
|-------|------|
| `character` | `string` |

### `character:profile_set`
Character profile extracted (typically on first appearance).

| Field | Type | Description |
|-------|------|-------------|
| `character` | `string` | Character name |
| `profile.sex` | `'M' \| 'F' \| 'O'` | Biological sex |
| `profile.species` | `string` | Species |
| `profile.age` | `number` | Age |
| `profile.appearance` | `string[]` | Appearance tags |
| `profile.personality` | `string[]` | Personality tags |

### `character:akas_add`
Additively merges new aliases into a character's known names. Generated at character appearance (from profile extraction) and periodically by the nickname extractor (every 8 messages).

| Field | Type | Description |
|-------|------|-------------|
| `character` | `string` | Character name |
| `akas` | `string[]` | New alternate names to add |

### `character:position_changed`
Character moved to a new position within the location.

| Field | Type |
|-------|------|
| `character` | `string` |
| `newValue` | `string` |
| `previousValue` | `string?` |

### `character:activity_changed`
Character's current activity changed.

| Field | Type |
|-------|------|
| `character` | `string` |
| `newValue` | `string \| null` |
| `previousValue` | `string \| null?` |

### `character:mood_added`
A mood tag was added to a character.

| Field | Type |
|-------|------|
| `character` | `string` |
| `mood` | `string` |

### `character:mood_removed`
A mood tag was removed from a character.

| Field | Type |
|-------|------|
| `character` | `string` |
| `mood` | `string` |

### `character:outfit_changed`
A character's outfit slot changed.

| Field | Type | Description |
|-------|------|-------------|
| `character` | `string` | Character name |
| `slot` | `OutfitSlot` | Which slot changed |
| `newValue` | `string \| null` | New item (null = slot emptied) |
| `previousValue` | `string \| null?` | Previous item |

### `character:physical_added`
A physical state tag was added.

| Field | Type |
|-------|------|
| `character` | `string` |
| `physicalState` | `string` |

### `character:physical_removed`
A physical state tag was removed.

| Field | Type |
|-------|------|
| `character` | `string` |
| `physicalState` | `string` |

## Relationship Events

### `relationship:feeling_added`
A character gained a feeling toward another.

| Field | Type |
|-------|------|
| `fromCharacter` | `string` |
| `towardCharacter` | `string` |
| `value` | `string` |

### `relationship:feeling_removed`
A character lost a feeling toward another.

| Field | Type |
|-------|------|
| `fromCharacter` | `string` |
| `towardCharacter` | `string` |
| `value` | `string` |

### `relationship:secret_added`
A character gained a secret regarding another.

| Field | Type |
|-------|------|
| `fromCharacter` | `string` |
| `towardCharacter` | `string` |
| `value` | `string` |

### `relationship:secret_removed`
A secret was revealed or resolved.

| Field | Type |
|-------|------|
| `fromCharacter` | `string` |
| `towardCharacter` | `string` |
| `value` | `string` |

### `relationship:want_added`
A character gained a desire regarding another.

| Field | Type |
|-------|------|
| `fromCharacter` | `string` |
| `towardCharacter` | `string` |
| `value` | `string` |

### `relationship:want_removed`
A want was fulfilled or abandoned.

| Field | Type |
|-------|------|
| `fromCharacter` | `string` |
| `towardCharacter` | `string` |
| `value` | `string` |

### `relationship:status_changed`
The overall relationship status changed.

| Field | Type | Description |
|-------|------|-------------|
| `pair` | `[string, string]` | Alphabetically sorted pair |
| `newStatus` | `RelationshipStatus` | New status |
| `previousStatus` | `RelationshipStatus?` | Previous status |

### `relationship:subject`
An interaction type occurred between a pair.

| Field | Type | Description |
|-------|------|-------------|
| `pair` | `[string, string]` | Alphabetically sorted pair |
| `subject` | `Subject` | Interaction type |
| `milestoneDescription` | `string?` | Makes this a milestone if present |

## Topic/Tone Events

### `topic_tone`
Scene topic and tone changed. No subkind.

| Field | Type |
|-------|------|
| `topic` | `string` |
| `tone` | `string` |
| `previousTopic` | `string?` |
| `previousTone` | `string?` |

## Tension Events

### `tension`
Scene tension changed. No subkind.

| Field | Type |
|-------|------|
| `level` | `TensionLevel` |
| `type` | `TensionType` |
| `direction` | `TensionDirection` |
| `previousLevel` | `TensionLevel?` |
| `previousType` | `TensionType?` |
| `previousDirection` | `TensionDirection?` |

## Narrative Description Events

### `narrative_description`
Summary of what happened at a message. No subkind.

| Field | Type |
|-------|------|
| `description` | `string` |

Witnesses and location are derived from projection state at projection time, not stored in the event itself.

## Chapter Events

### `chapter:ended`
A chapter boundary was detected.

| Field | Type | Description |
|-------|------|-------------|
| `chapterIndex` | `number` | Chapter that ended (0-based) |
| `reason` | `string` | `location_change`, `time_jump`, `both`, or `manual` |

### `chapter:described`
Title and summary added to a chapter.

| Field | Type |
|-------|------|
| `chapterIndex` | `number` |
| `title` | `string` |
| `summary` | `string` |

## Interaction Subjects

The `relationship:subject` event's `subject` field uses one of these values:

### Conversation & Social
`conversation` · `confession` · `argument` · `negotiation`

### Discovery & Information
`discovery` · `secret_shared` · `secret_revealed`

### Emotional
`emotional` · `emotionally_intimate` · `supportive` · `rejection` · `comfort` · `apology` · `forgiveness`

### Bonding & Connection
`laugh` · `gift` · `compliment` · `tease` · `flirt` · `date` · `i_love_you` · `sleepover` · `shared_meal` · `shared_activity`

### Intimacy
`intimate_touch` · `intimate_kiss` · `intimate_embrace` · `intimate_heated`

### Sexual Activity
`intimate_foreplay` · `intimate_oral` · `intimate_manual` · `intimate_penetrative` · `intimate_climax`

### Action & Physical
`action` · `combat` · `danger`

### Decisions & Commitments
`decision` · `promise` · `betrayal` · `lied`

### Life Events
`exclusivity` · `marriage` · `pregnancy` · `childbirth`

### Social & Achievement
`social` · `achievement`

### Support & Protection
`helped` · `common_interest` · `outing` · `defended` · `crisis_together` · `vulnerability` · `shared_vulnerability` · `entrusted`

### Milestone-Worthy Subjects

The first occurrence of certain subjects for a character pair triggers a **milestone** — an LLM-generated description of the moment. Milestone-worthy subjects include bonding milestones (first laugh, first gift, first compliment), intimacy milestones (first touch, first kiss), life milestones (marriage, pregnancy), and trust milestones (secret shared, defended, crisis together).
