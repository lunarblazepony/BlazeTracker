---
title: ST Macros
weight: 6
---

BlazeTracker provides two SillyTavern macros that let you place tracked state anywhere in your prompts. Use these when you want full control over where BlazeTracker content appears, instead of (or in addition to) automatic injection.

## Available Macros

### `{{btState}}`

Returns the current **scene state** — time, location, climate, characters, relationships, and scene info. This is the same content that auto-injection places near the end of the prompt.

Example output:

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
  Alice: crouching near the inscription; doing: translating runes; mood: focused, excited; wearing: leather vest, cargo pants, hiking boots
  Bob: standing guard at the entrance; doing: watching the corridor; mood: alert, nervous; wearing: chain shirt, dark trousers, boots
[/Scene State]

[Relationships]
Alice & Bob: friendly
  Alice → Bob: feels trust, curiosity; wants to learn his past
  Bob → Alice: feels protective, respect; hides: his true identity
[/Relationships]
```

{{< callout type="info" >}}
`{{btState}}` does **not** include chapters or events — use `{{btNarrative}}` for those.
{{< /callout >}}

### `{{btNarrative}}`

Returns the **narrative context** — past chapter summaries ("Story So Far") and recent events from the current chapter.

Example output:

```
[Story So Far]
Chapter 1: A Chance Meeting
  Two strangers cross paths at the marketplace...
  Milestones: Alice & Bob: First Meeting
Chapter 2: The Journey Begins
  Having agreed to travel together, they set out...
[/Story So Far]

[Recent Events]
- Alice discovered ancient runes on the chamber wall
- Bob heard footsteps echoing from the lower levels
- Alice identified the runes as a warning about guardians
[/Recent Events]
```

## Using Macros in Prompts

Place the macros in any SillyTavern prompt field — system prompts, character cards, Author's Note, or Quick Replies. They are resolved at generation time and replaced with the current tracked state.

**Example: Character card system prompt**

```
You are {{char}}, a wandering merchant.

Current scene context:
{{btState}}

Story background:
{{btNarrative}}
```

**Example: Author's Note**

```
[OOC: The following is the current scene state for reference.]
{{btState}}
```

## Macro-Only Workflow

If you want full control over injection placement, you can disable auto-injection while keeping macros active:

1. Open **BlazeTracker Settings** > **Advanced Settings** > **Context Injection**
2. Uncheck **Auto Inject State** to stop automatic scene state injection
3. Uncheck **Auto Inject Narrative** to stop automatic chapter/event injection
4. Place `{{btState}}` and/or `{{btNarrative}}` wherever you want in your prompts

{{< callout type="warning" >}}
Disabling auto-injection without using macros means the LLM will receive **no** BlazeTracker context. Make sure you place the macros somewhere in your prompt setup if you disable auto-injection.
{{< /callout >}}

## Combining Macros with Auto-Injection

You can also use macros **alongside** auto-injection. For example:

- Keep auto-injection enabled for state (so it always appears near recent messages)
- Disable auto-injection for narrative, and place `{{btNarrative}}` in your system prompt so chapter summaries appear at the very top of the context

This gives you precise placement for narrative context while keeping state injection automatic.

## What Controls Each Macro

| Macro | Content | Respects |
|-------|---------|----------|
| `{{btState}}` | Scene state (time, location, characters, etc.) | Track toggles (Time, Location, etc.) |
| `{{btNarrative}}` | Chapter summaries + current chapter events | Max Recent Chapters, Max Recent Events |

Both macros return an empty string when no BlazeTracker data is available (e.g., before the first extraction).

## Related

- [Prompt Injection](../../concepts/prompt-injection) — How auto-injection works
- [Settings Reference](../../reference/settings) — All injection settings
