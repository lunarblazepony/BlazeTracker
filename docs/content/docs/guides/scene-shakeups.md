---
title: Scene Shakeups
weight: 7
---

Scene Shakeups inject random, context-appropriate events into your roleplay to prevent conversations from becoming stale and predictable. When triggered, BlazeTracker makes a separate LLM call to generate scene-appropriate disruption suggestions, picks one at random, and injects it as a mandatory scene direction into the main generation prompt.

## How It Works

1. Before each assistant response, BlazeTracker checks whether a shakeup should trigger
2. A **quadratic probability curve** determines the chance: the longer since the last shakeup, the higher the probability
3. If triggered, a pre-request LLM call generates 10 scene-appropriate suggestions
4. One suggestion is randomly selected and injected into the prompt as a mandatory scene direction
5. The main LLM receives the instruction and must incorporate the event into its response

The probability curve uses the formula `p(n) = (n / maxMessages)^2`, where `n` is messages since the last shakeup and `maxMessages` is the configured maximum (default: 20). This means:

| Messages Since Last | Probability (N=20) |
|--------------------|--------------------|
| 5 | 6.25% |
| 10 | 25% |
| 15 | 56.25% |
| 18 | 81% |
| 20 | 100% (guaranteed) |

The curve starts low to avoid disrupting scenes that are already interesting, then ramps up as conversations risk becoming stale.

## Shakeup Types

The LLM can suggest events from these categories:

| Type | Description |
|------|-------------|
| **arrival** | A new character, creature, or group arrives (avoided in private settings) |
| **interruption** | An external event interrupts the current interaction (phone call, knock, alarm) |
| **emotional_shift** | A character's emotional state changes dramatically due to a trigger |
| **complication** | Something goes wrong — a plan fails, an obstacle appears, or a situation worsens |
| **opportunity** | An unexpected chance or opening presents itself |
| **environment** | The environment changes — weather shifts, power outage, noise, something breaks |
| **escalation** | The current situation intensifies or stakes are raised |
| **risk** | A character in the scene decides to try something risky |

## What Context Is Provided

The shakeup generator receives rich context to ensure suggestions are scene-appropriate:

- **Character description** and **user description** from the card/persona
- **Character profiles** (positions, moods, physical states) from current projection
- **Relationship data** (feelings, wants, secrets, status) between characters
- **Scene state** (time, location, climate, tension, props, recent narrative events)
- **World info / lorebook** entries (if enabled)
- **Recent messages** from the conversation

This ensures suggestions respect the time of day, setting, character personalities, established relationships, and world rules.

## Safety Guardrails

The shakeup prompt includes extensive guardrails to prevent problematic suggestions:

- **Time-appropriate**: No work calls at midnight, no deliveries at 2 AM
- **Setting-consistent**: No helicopters in medieval settings, no magic where it's forbidden
- **Character-accurate**: Characters must act consistently with their personalities, motivations, and known capabilities
- **No fabrication**: Never invents characters, family members, pets, objects, backstory, or history that aren't established in provided context
- **No user character control**: Never dictates actions, decisions, dialogue, or emotions for the user's character — only external events, NPC actions, or environmental changes
- **Climate-aware**: Never contradicts established weather conditions
- **Relationship-aware**: Uses relationship data (feelings, wants, secrets, status) to inform interpersonal dynamics
- **Physical state-aware**: Respects character positions, injuries, and physical conditions
- **World info-consistent**: Treats lorebook entries as established canon

The prompt also includes three fully worked example scenes with 10 good and 10 bad suggestions each, teaching the LLM to mine scene-specific details rather than generating generic suggestions.

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable Scene Shakeups | boolean | `false` | Turn the feature on or off. Off by default. |
| Max Messages Between Shakeups | number | `20` | Messages at which probability reaches 100%. Range: 5-100. |

These settings are in the **Injection** section of BlazeTracker's settings panel.

{{< callout type="info" >}}
Scene Shakeups require a **Connection Profile** to be configured, since they make a separate LLM call. The same profile used for extraction is used for shakeup generation.
{{< /callout >}}

## Injection Format

When a shakeup triggers, it's injected alongside the scene state as a mandatory direction:

```
[IMPORTANT — Mandatory Scene Direction]
You MUST incorporate the following event into your next response.
This is not optional. The event MUST occur during this response
and be woven naturally into the narrative.

Event: The ex-soldier freezes mid-sentence as a patron drops
a tankard — the crash triggers a flashback to combat.

Write the event as a natural part of the scene — do not announce
it mechanically or break immersion. The event must happen, but
how the characters react should be true to their personalities.
[/IMPORTANT — Mandatory Scene Direction]
```

## Debug Logging

With **Debug Logging** enabled, BlazeTracker logs shakeup information to the browser console:

- **Roll details**: Messages since last shakeup, probability, random roll, whether it triggered
- **All suggestions**: The full list of 10 generated suggestions with types and rationales
- **Selected suggestion**: Which suggestion was randomly chosen for injection

This is useful for understanding why shakeups trigger (or don't) and what options were available.
