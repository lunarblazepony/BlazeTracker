---
title: Better RP
weight: 8
---

Better RP is a pre-flight thinking pipeline that runs 4 sequential LLM calls before each main response. It analyzes continuity, character knowledge, dramatic tension, and then plans the NPC's response — injecting the direction as a mandatory directive. This makes any model behave like a thinking model for roleplay, ensuring continuity, character consistency, information asymmetry, and dramatic pacing.

## How It Works

Before each assistant response, BlazeTracker runs 4 analysis steps:

| Step | Name | Purpose |
|------|------|---------|
| 1 | Continuity Audit | Identifies unresolved actions, physical continuity, open threads, environmental factors |
| 2 | Character Knowledge | Per-NPC analysis: what they know/don't know/assume, wants, candidate actions |
| 3 | Tension Steering | Dramatic direction: escalate/sustain/release/pivot, irony opportunities, tone target |
| 4 | Response Direction | 2-4 ordered directions — narration, sensory detail, and emotional intent |

Each step receives the full BlazeTracker state (time, location, climate, characters, relationships, scene) plus the outputs of all previous steps. The final response direction is injected as a mandatory directive into the main generation prompt.

Steps build on each other:
- Step 2 receives Step 1's output (continuity findings inform character analysis)
- Step 3 receives Steps 1+2 (continuity + character knowledge inform tension decisions)
- Step 4 receives Steps 1+2+3 (everything informs the response direction)

If a step fails, later steps still run with whatever succeeded. Each step retries up to 3 times with lower temperature on failure.

## Response Direction (Step 4)

The final step plans 2-4 **directions** that together form one coherent NPC response turn. Each direction has three fields:

| Field | Purpose |
|-------|---------|
| **narration** | What the NPC does and says — specific physical actions, body language, dialogue direction (tone and content, not exact words) |
| **sensory** | One sensory detail grounded in the character's physical description (fur texture, scent, sound of their voice, visual detail from their appearance) |
| **intent** | What the NPC is thinking or feeling — conveyed through subtext, not stated directly |

### Sensory Details

Each direction includes one sensory detail drawn from the NPC's character card:
- Only one sense per direction (scent, touch, sound, sight, temperature) — no repeating the same sense across directions or from recent messages
- Details must match the character's actual description — if the character has fur, the detail describes fur, not smooth skin
- Body mechanics respect species: quadrupeds pick things up with their mouth, not hooves; anthro characters have mobile ears, tails, and muzzles

### No Duplicates

Directions must be distinct moments. If two directions describe the same action or dialogue, they should be merged into one. The pipeline explicitly instructs the LLM to check for and eliminate duplicate directions.

## Character Control

Better RP enforces strict rules about who controls which characters:

**NPCs can interact with the user character** — they can speak to them, touch them, look at them, act toward them. What's forbidden is deciding what the user character does in response.

The rule is simple: **who is the subject of the verb?**

| Example | Allowed? | Why |
|---------|----------|-----|
| "Kira reaches for User's hand" | Yes | Kira is the subject |
| "Kira steps closer to User" | Yes | Kira is the subject |
| "User squeezes back" | **No** | User is the subject |
| "User feels their heart race" | **No** | User's emotions decided |
| "The vulnerability is impossible for User to miss" | **No** | User's perception decided |

This distinction is enforced at every level — in the Step 4 planning prompt, in the validation checklist the LLM applies before outputting, and in the injection directive.

## Injection

The response direction is injected into the main generation prompt with explicit instructions:

1. **Mandatory framing** — "YOU MUST FOLLOW THIS EXACTLY. This is not a suggestion."
2. **How-to instructions** — Read each direction in order, write as flowing prose, don't skip or reorder
3. **Character rules** — Who the LLM writes for, who it doesn't control, sensory allowance
4. **Numbered directions** — Each with narration, sensory detail to include, and emotional undercurrent
5. **Closing reinforcement** — "Follow the directions above exactly" + repeated user prohibition

## Scene Shakeup Integration

When both Better RP and Scene Shakeups are enabled:

1. The shakeup triggers first (existing probability check + LLM call)
2. The selected shakeup instruction is passed to **all 4 Better RP steps** as context
3. Step 4 incorporates it into the response direction
4. **Only the response direction is injected** — the raw shakeup block is NOT injected separately
5. If Better RP is disabled, shakeups work as before (raw injection)

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Enable Better RP | Off | Enable the pre-flight thinking pipeline |
| Connection Profile | (main profile) | API connection for Better RP calls. Use a different model for planning vs. extraction. |
| Max Tokens Per Step | 2048 | Maximum tokens for each thinking step (512-8192) |

Better RP has its own collapsible section in the BlazeTracker settings panel.

## Performance

Better RP adds 4 sequential LLM calls before each response:

- **Latency**: 4 API calls before the main response generates (with up to 2 retries each on failure)
- **Token usage**: Each step uses up to the configured max tokens (default 2048)
- **Cost**: 4 additional LLM calls per message

Use the **Connection Profile** setting to route Better RP calls to a fast, affordable model while keeping your main model for the actual response. The pipeline prompt prefix/suffix settings (e.g. `/nothink`) also apply to Better RP calls.

## Error Handling

- Each step retries up to 3 times (initial attempt + 2 retries with lower temperature)
- Assistant prefill (`{`) forces JSON output from the LLM
- If a step fails after all retries, later steps still run with whatever succeeded
- If Step 4 (Response Direction) fails, no injection occurs — the response generates normally
- The stop button cancels the pipeline mid-flight via abort signal
- Toast notifications show progress ("Better RP: Auditing continuity... (1/4)")
- Debug logging (when enabled) shows full JSON outputs for each step
