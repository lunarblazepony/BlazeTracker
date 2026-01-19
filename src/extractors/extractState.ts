import type { STContext, ChatMessage } from '../types/st';
import { TrackedState, EXTRACTION_SCHEMA, getSchemaExample } from '../types/state';
import type { ExtractedData } from 'sillytavern-utils-lib/types';
import type { Message } from 'sillytavern-utils-lib';
import { Generator } from 'sillytavern-utils-lib';
import { getSettings } from '../ui/settings';
import { getMessageState } from '../utils/messageState';

const generator = new Generator();
let currentAbortController: AbortController | null = null;
let extractionCount = 0;

const EXTRACTION_PROMPT = `Analyze this roleplay conversation and extract the current state of the scene. You must only return valid JSON with no commentary.

<instructions>
<objective>
- Your task is to produce a JSON object defining the state of the scene as it is at the end of recent_messages.
- Your final JSON object must perfectly match the defined schema.
- You must only output valid JSON, with no surrounding commentary.
</objective>
<general>
- The previous_state, if defined, is the state of the scene prior to the recent_messages.
- You must analyse the recent_messages, determine the changes to the previous_state, and return a complete JSON object with the fresh state.
- Where information is not provided, infer reasonable defaults. For example, if a character is wearing a full set of outdoors clothes, it is reasonable to assume they are wearing socks & underwear.
</general>
<time>
- Increment time realistically based on what happened in the recent_messages. Dialogue = 1-3 mins per message, actions = varies.
- Remember to tick over the hour/day when necessary (i.e. if previous_state shows Monday, 23:58 and the time passed is 2 minutes, advance to Tuesday 00:00).
- Do not introduce large leaps of time unless they are explicitly stated in the recent_messages (i.e. sleeping, a long journey, explicit 'days passed').
</time>
<location>
- Track location changes through the scene.
- Do not include character or activity information in the location.
- The 'area' should be a town, city or region i.e. 'Huntsville, AL', 'London, Great Britain', 'Mt. Doom, Middle Earth', 'Ponyville, Equestria'
- The 'place' should be a building or sub-section i.e. 'John's Warehouse', 'Fleet Street McDonalds', 'Slime-Covered Cave', 'School of Friendship'
- The 'position' should be a location within the place i.e. 'Manager's Office', 'The Corner Booth', 'Underground River Bed', or 'Rarity's Classroom'
- Be careful to introduce new props introduced or props changing state.
</location>
<climate>
- Detect any weather changes in the text, infer the temperature from the time, location and weather.
- Temperature for indoors locations should be based on the temperature indoors, not the temperature outdoors.
</climate>
<scene>
- Consider whether the topic or tone of the scene has changed since the previous_state.
- Consider the tension in the scene, characterise it as closely as possible with the enums allowed.
- If the tension level is the same as the previous_state, the direction is stable. Otherwise, set the direction based on whether it has increased or decreased.
- Now work through the recent events, retain events which are still relevant, discard events which have been superceded or resolved.
- Add significant recent events which affect the state of the roleplay i.e. a secret discovered, a higher level of intimacy, an injury.
- If there are more than five recent events, keep the five most salient ones.
</scene>
<characters>
For each character in the scene, watch closely for the following:
- Character enters/exits scene (add/remove from characters array)
- Position changes (standing→sitting, moves across room)
- Consider whether the character would usually wear clothes (i.e. a pony or a Pokémon would not), in this case only add clothes if explicitly mentioned, otherwise return null for all slots.
- Outfit changes (removes jacket, unbuttons shirt, etc) → set slot to null if removed and add the item of clothing to location props
- Fur and other anatomy do not count as part of a character's outfit. Do not include them when extracting outfit.
- Outfit must be *specific*, 't-shirt' not 'default top' or 'unspecified top'.
- Mood shifts (dialogue tone, reactions, internal thoughts)
- Disposition changes (feelings toward others shift)
</characters>
</instructions>

<character_info>
{{characterInfo}}
</character_info>

<previous_state>
{{previousState}}
</previous_state>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the current state as valid JSON:`;

export interface ExtractionResult {
  state: TrackedState;
  raw: string;
}

function setSendButtonState(isGenerating: boolean) {
  const context = SillyTavern.getContext();
  if (isGenerating) {
    context.deactivateSendButtons();
  } else {
    context.activateSendButtons();
  }
}

export function setupExtractionAbortHandler() {
  const context = SillyTavern.getContext();

  context.eventSource.on(context.event_types.GENERATION_STOPPED, (() => {
    if (currentAbortController) {
      console.log('[BlazeTracker] Generation stopped, aborting extraction');
      currentAbortController.abort();
      currentAbortController = null;
    }
  }) as (...args: unknown[]) => void);
}

export function abortCurrentExtraction() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

export async function extractState(
  context: STContext,
  messageId: number,
  previousState: TrackedState | null,
  abortSignal?: AbortSignal
): Promise<ExtractionResult> {
  const settings = getSettings();

  if (!settings.profileId) {
    throw new Error('No connection profile selected. Please configure BlazeTracker in extension settings.');
  }

  // Create and register abort controller
  const abortController = new AbortController();
  currentAbortController = abortController;

  // Track active extractions for button state
  extractionCount++;
  if (extractionCount === 1) {
    setSendButtonState(true);
  }

  try {
    const { lastXMessages, maxResponseTokens } = settings;

    // Get recent messages for context
    let startIdx = 0;
    if (previousState) {
      for (let i = messageId - 1; i >= 0; i--) {
        const msg = context.chat[i];
        const stored = getMessageState(msg);
        if (stored?.state) {
          startIdx = i + 1;  // Start from message AFTER the one with state
          break;
        }
      }
    }

    // Get only new messages
    const effectiveStart = Math.max(startIdx, messageId - lastXMessages);
    const chatMessages = context.chat.slice(effectiveStart, messageId + 1);

    // Format messages for prompt
    const formattedMessages = chatMessages
      .map((msg) => `${msg.name}: ${msg.mes}`)
      .join('\n\n');

    // Get character info
    const character = context.characters?.[context.characterId];
    const characterInfo = character
      ? `Name: ${context.name2}\nDescription: ${character.description || 'No description'}`
      : `Name: ${context.name2}`;

    // Build the prompt
    const prompt = EXTRACTION_PROMPT
      .replace('{{characterInfo}}', previousState
        ? 'Not provided - initial state calculated already.'
        : characterInfo)
      .replace('{{previousState}}', previousState
        ? JSON.stringify(previousState, null, 2)
        : 'No previous state - this is the start of the scene.')
      .replace('{{messages}}', formattedMessages)
      .replace('{{schema}}', JSON.stringify(EXTRACTION_SCHEMA, null, 2))
      .replace('{{schemaExample}}', getSchemaExample());

    const messages: Message[] = [
      { role: 'system', content: 'You are an expert state analysis agent. Return only valid JSON.' },
      { role: 'user', content: prompt }
    ];

    // Call LLM via Generator
    const response = await makeGeneratorRequest(
      messages,
      settings.profileId,
      maxResponseTokens,
      abortController.signal
    );

    // Parse response
    const state = parseResponse(response);

    return { state, raw: response };
  } finally {
    extractionCount--;
    if (extractionCount === 0) {
      setSendButtonState(false);
    }
    if (currentAbortController === abortController) {
      currentAbortController = null;
    }
  }
}

function makeGeneratorRequest(
  messages: Message[],
  profileId: string,
  maxTokens: number,
  abortSignal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (abortSignal && abortSignal.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    const abortController = new AbortController();

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => abortController.abort());
    }

    generator.generateRequest(
      {
        profileId,
        prompt: messages,
        maxTokens,
        custom: { signal: abortController.signal },
        overridePayload: {
          temperature: 0.5,
        }
      },
      {
        abortController,
        onFinish: (requestId, data, error) => {
          if (error) {
            return reject(error);
          }
          if (!data) {
            return reject(new DOMException('Request aborted', 'AbortError'));
          }
          const content = (data as ExtractedData).content;
          if (typeof content === 'string') {
            resolve(content);
          } else {
            resolve(JSON.stringify(content));
          }
        },
      },
    );
  });
}

function parseResponse(response: string): TrackedState {
  // Try to extract JSON from response
  // Handle cases where model wraps in markdown code blocks
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find JSON object if there's other text
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return validateState(parsed);
  } catch (e) {
    console.error('[BlazeTracker] Failed to parse response:', e);
    console.error('[BlazeTracker] Response was:', response);
    throw new Error('Failed to parse extraction response as JSON');
  }
}

function validateState(data: any): TrackedState {
  // Basic validation - ensure required fields exist

  if (!data.time || typeof data.time.hour !== 'number') {
    throw new Error('Invalid state: missing or invalid time.hour');
  }
  if (typeof data.time.minute !== 'number') {
    data.time.minute = 0; // Default to :00 if not specified
  }

  if (!data.location || !data.location.place) {
    throw new Error('Invalid state: missing or invalid location');
  }

  if (!Array.isArray(data.characters)) {
    throw new Error('Invalid state: characters must be an array');
  }

  // Ensure characters have required fields
  for (const char of data.characters) {
    if (!char.name || !char.position) {
      throw new Error(`Invalid character data: missing name or position in ${JSON.stringify(char)}`);
    }
    // Ensure mood is an array
    if (!Array.isArray(char.mood)) {
      char.mood = char.mood ? [char.mood] : ['neutral'];
    }
  }

  return data as TrackedState;
}
