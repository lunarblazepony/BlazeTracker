---
title: Prompt Injection
weight: 5
---

BlazeTracker doesn't just track state — it injects it back into your LLM's context so the model stays aware of the current scene. This page explains what gets injected, in what format, and how to control it.

{{< callout type="info" >}}
"Prompt injection" here refers to injecting tracked state into the LLM prompt, not the security vulnerability. BlazeTracker uses SillyTavern's official extension prompt API.
{{< /callout >}}

## What Gets Injected

The injection includes several sections, each wrapped in XML-style tags:

### Story So Far

```
[Story So Far]
Chapter 1: A Chance Meeting
  Two strangers cross paths at the marketplace...
Chapter 2: The Journey Begins
  Having agreed to travel together, they set out...
[/Story So Far]
```

Recent completed chapters with titles and summaries. Controlled by the **Max Recent Chapters** setting (default: 5).

### Scene State

```
[Scene State]
Topic: Exploring the ruins
Tone: Cautious, adventurous
Tension: guarded (suspense, escalating)
Time: Thursday, March 15, 1247 at 2:30 PM (day)
Location: Ancient Ruins - Central Chamber - Near the collapsed pillar
Nearby objects: torch, crumbled stone tablet, iron door
Climate: overcast, 48°F, humid
Characters present:
  Alice: crouching near the inscription; doing: translating runes; mood: focused, excited; physical: dusty; wearing: leather vest, cargo pants, hiking boots
  Bob: standing guard at the entrance; doing: watching the corridor; mood: alert, nervous; wearing: chain shirt, dark trousers, boots, short sword on belt
[/Scene State]
```

The complete current state: time, location, props, climate, and all present characters with their positions, activities, moods, physical states, and outfits.

### Recent Events

```
[Recent Events]
- Alice discovered ancient runes on the chamber wall
- Bob heard footsteps echoing from the lower levels
- Alice identified the runes as a warning about guardians
[/Recent Events]
```

Narrative events from the current chapter. Controlled by the **Max Recent Events** setting (default: 15).

### Knowledge Gaps

```
[Knowledge Gaps]
Bob was not present for: Alice discovered a hidden passage behind the altar
Alice was not present for: Bob overheard guards discussing the patrol route
[/Knowledge Gaps]
```

Events that present characters **missed** because they weren't witnesses. This creates natural dramatic irony — the LLM knows what each character doesn't know, enabling more realistic interactions.

### Relationships

```
[Relationships]
Alice & Bob: friendly
  Alice → Bob: feels trust, curiosity; wants to learn his past
  Bob → Alice: feels protective, respect; hides: his true identity; wants to keep her safe

Alice & Clara: strained
  Alice → Clara: feels betrayal, anger
  Clara → Alice: feels guilt, regret; wants forgiveness
[/Relationships]
```

Relationship states for all pairs where **both characters are present**. Includes feelings, wants, and secrets (secrets can be disabled via settings).

## Injection Depth

The injection is placed **in-chat** at a configurable depth. Depth 0 means right before the most recent messages (the default). Higher depth values push the injection further back in the conversation.

This is configured via the **Injection Depth** setting.

## What Controls Each Section

Each section is controlled by its corresponding track toggle:

| Section | Track Toggle | Setting |
|---------|-------------|---------|
| Story So Far | `narrative` | Max Recent Chapters |
| Scene State (time) | `time` | — |
| Scene State (location) | `location` | — |
| Scene State (props) | `props` | — |
| Scene State (climate) | `climate` | — |
| Scene State (characters) | `characters` | — |
| Scene State (topic/tone/tension) | `scene` | — |
| Recent Events | `narrative` | Max Recent Events |
| Knowledge Gaps | `characters` + `narrative` | — |
| Relationships | `relationships` | Include Secrets |

If a track toggle is disabled, its corresponding sections are omitted from injection.

## Auto-Injection Toggles

You can independently disable auto-injection for state and narrative content:

| Setting | Controls | Default |
|---------|----------|---------|
| **Auto Inject State** | Scene State + Relationships | `true` |
| **Auto Inject Narrative** | Story So Far + Recent Events + Knowledge Gaps | `true` |

These settings are in **Advanced Settings** > **Context Injection**.

When you disable auto-injection for a category, BlazeTracker stops inserting that content into prompts automatically. However, extraction still runs normally — the data is still tracked, just not injected.

This is useful when you want to place content manually using [ST Macros](../../guides/macros) (`{{btState}}` and `{{btNarrative}}`).

## Token Budget

The injection content counts against your context window. For a fully-tracked scene with several characters and chapters, the injection might be 500-1500 tokens.

The **Token Budget** setting lets you cap injection size. When set to 0 (default), it uses SillyTavern's full context size. Setting a lower value trims older chapters and events first.

## ST Macros

BlazeTracker registers two macros that can be placed anywhere in your prompts:

- `{{btState}}` — Current scene state (time, location, characters, relationships)
- `{{btNarrative}}` — Chapter summaries and current chapter events

These work independently of auto-injection — you can use them even when auto-injection is disabled. See the [ST Macros guide](../../guides/macros) for details and examples.
