---
title: Settings
weight: 5
---

Complete reference for all BlazeTracker settings. Settings are organized into collapsible sections in the extension panel.

## Connection

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Connection Profile | select | — | API connection for extraction calls. See [Setup](../../getting-started/setup). |
| Auto Extract | boolean | `true` | Automatically extract state from new messages. |

## Display

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| State Display Position | `'above' \| 'below'` | `'below'` | Show state block above or below message content. |
| Temperature Unit | `'fahrenheit' \| 'celsius'` | `'fahrenheit'` | Display unit for temperatures. |
| Time Format | `'12h' \| '24h'` | `'12h'` | Time display format. |

## Tracking

Enable or disable extraction modules. Disabling modules reduces LLM calls per message. See [Track Dependencies](../track-dependencies) for dependency rules.

| Module | Default | What It Tracks |
|--------|---------|----------------|
| Time | `true` | Narrative date and time |
| Location | `true` | Area, place, position |
| Props | `true` | Nearby objects and items |
| Climate | `true` | Weather and temperature (procedural) |
| Characters | `true` | Positions, activities, moods, outfits |
| Relationships | `true` | Feelings, secrets, wants, status |
| Scene | `true` | Topic, tone, tension |
| Narrative | `true` | Events, milestones, chapters |

## Context Injection

Controls what BlazeTracker injects into your prompts.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Auto Inject State | boolean | `true` | Automatically inject scene state (time, location, characters, etc.) into prompts. Disable for [macro-only workflows](../../guides/macros). |
| Auto Inject Narrative | boolean | `true` | Automatically inject chapter summaries and events into prompts. Disable for [macro-only workflows](../../guides/macros). |
| Injection Depth | number | `0` | Prompt injection depth (0 = near most recent messages). |

## Chapter & Event Injection

Configure how chapters and events are injected into context.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Max Recent Chapters | number | `5` | Maximum past chapters in "Story So Far" injection (0-10). |
| Max Recent Events | number | `15` | Maximum out-of-context events from current chapter (0-50). |
| Injection Token Budget | number | `0` | Token budget for context injection (0 = auto-detect from ST settings). |

## Scene Shakeups

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable Scene Shakeups | boolean | `false` | Inject random context-appropriate events into prompts. See [Scene Shakeups guide](../../guides/scene-shakeups). |
| Max Messages Between Shakeups | number | `20` | Messages at which trigger probability reaches 100%. Range: 5–100. |

## Better RP

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable Better RP | boolean | `false` | Run a 4-step LLM thinking pipeline before each response. See [Better RP guide](../../guides/better-rp). |
| Connection Profile | select | (main profile) | API connection for Better RP calls. Blank uses the main BlazeTracker profile. |
| Max Tokens Per Step | number | `2048` | Maximum tokens for each thinking step. Range: 512–8192. |

## Custom Prompts

Each extraction prompt can be overridden individually. For each prompt:

| Setting | Description |
|---------|-------------|
| Temperature | LLM temperature for this specific prompt (overrides category default) |
| System Prompt | Static instructions (cacheable) |
| User Template | Dynamic content with placeholders |

See [Custom Prompts guide](../../guides/custom-prompts) for details on customization.

## Advanced Settings

### LLM Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Max Tokens | number | `4096` | Maximum tokens for LLM extraction responses. |
| Max Requests/Min | number | `0` | Rate limit for LLM requests (0 = no limit). |
| Include World Info | boolean | `true` | Include lorebook entries in extractor prompts. |

### Message Limits

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Max Messages to Send | number | `10` | Maximum recent messages included in extractor prompts. |
| Max Chapter Messages | number | `24` | Maximum messages sent to the chapter description extractor. |

### Training Data Capture

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable Training Capture | boolean | `false` | Record all LLM extraction calls as input/output pairs for fine-tuning. Pairs are stored in memory for the current session. |

When enabled, a panel shows the number of captured pairs and provides **Download JSONL** and **Clear** buttons. The JSONL file contains one JSON object per line, each with the prompt messages, raw LLM response, parsed result, and metadata (temperature, max tokens, timestamp).

### Prompt Customization

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Prompt Prefix | string | `''` | Prepended to user template of all prompts (e.g., `/nothink`). |
| Prompt Suffix | string | `''` | Appended to user template of all prompts. |

### Category Temperatures

Default LLM temperatures per extraction category. Individual prompts can override these.

| Category | Default | Notes |
|----------|---------|-------|
| Time | `0.3` | Low for deterministic time parsing |
| Location | `0.5` | Moderate |
| Props | `0.5` | Moderate |
| Climate | `0.3` | Low for consistent weather classification |
| Characters | `0.5` | Moderate |
| Relationships | `0.6` | Slightly higher for nuanced feelings |
| Scene | `0.5` | Moderate |
| Narrative | `0.6` | Slightly higher for creative summaries |

### Debug

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Debug Logging | boolean | `false` | Log debug information to browser console. |
