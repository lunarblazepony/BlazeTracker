---
title: Training Data Capture
weight: 8
---

Training Data Capture records all LLM extraction calls as input/output pairs, which can be exported as JSONL for fine-tuning models.

## How It Works

1. Enable **Training Capture** in BlazeTracker's settings (under **Training Data Capture**)
2. Use BlazeTracker normally — every LLM call during extraction is recorded
3. Each captured pair includes:
   - The prompt messages sent to the LLM (system + user)
   - The raw LLM response text
   - The parsed result (or parse error)
   - Metadata: prompt name, temperature, max tokens, timestamp
4. Download the captured data as a JSONL file when ready

## Settings Panel

When training capture is enabled, a controls panel appears in settings showing:

- **Pair count** — How many pairs have been captured this session
- **Download JSONL** — Export all captured pairs as a `.jsonl` file (one JSON object per line)
- **Clear** — Discard all captured pairs from memory

## Storage

Captured pairs are stored **in memory only** for the current browser session. They are not persisted to disk or saved with the chat. If you close the browser or refresh the page, captured data is lost unless you download it first.

## JSONL Format

Each line in the exported file is a JSON object with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `promptName` | string | Identifier for the prompt (e.g., `"timeInitial"`, `"characterUpdate"`) |
| `messages` | array | Conversation-format messages (`role` + `content`) |
| `response` | string | Raw LLM response text |
| `parsedResult` | object \| null | The parsed extraction result, or null if parsing failed |
| `parseSuccess` | boolean | Whether the response was successfully parsed |
| `parseError` | string \| null | Parse error message, if any |
| `temperature` | number | LLM temperature used |
| `maxTokens` | number | Max tokens setting |
| `timestamp` | number | Unix timestamp of the capture |

## Use Cases

- **Fine-tuning** smaller models to replicate BlazeTracker's extraction behavior
- **Evaluating** prompt changes by comparing outputs across different prompt versions
- **Debugging** extraction issues by inspecting exact LLM inputs and outputs
