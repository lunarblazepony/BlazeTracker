/**
 * Better RP Injection Formatter
 *
 * Formats the response direction as a mandatory directive for injection into the prompt.
 */

import type { BeatPlanningResult, BetterRpResult } from './types';

/**
 * Format the response direction as a mandatory injection directive.
 * Returns null if planning failed (partial analysis isn't useful as a directive).
 */
export function formatBeatPlanInjection(
	result: BetterRpResult,
	npcNames: string[],
	userName: string,
): string | null {
	if (!result.beatPlanning || result.beatPlanning.directions.length === 0) {
		return null;
	}

	return formatDirective(result.beatPlanning, npcNames, userName);
}

/**
 * Format the response direction into the injection block.
 */
function formatDirective(plan: BeatPlanningResult, npcNames: string[], userName: string): string {
	const lines: string[] = [
		'[MANDATORY RESPONSE DIRECTION — YOU MUST FOLLOW THIS EXACTLY]',
		'',
		'YOU MUST WRITE YOUR RESPONSE FOLLOWING THE DIRECTION BELOW.',
		'This is not a suggestion or a guideline. This is the mandatory structure of your reply.',
		'These directions were planned to maintain scene continuity and character consistency.',
		'If you deviate from this direction, the scene will be inconsistent and broken.',
		'',
		'HOW TO USE THIS DIRECTION:',
		'- Read each numbered direction below. They are in order.',
		'- Write your response as flowing prose that follows these directions in sequence.',
		'- Each direction tells you what the NPC does, a sensory detail to include, and the emotional intent.',
		'- Weave them together naturally. Do not label or announce directions.',
		'- Do not add scenes, actions, or dialogue not covered by the directions.',
		'- Do not skip any direction. Do not reorder them.',
		'',
		'CHARACTER RULES:',
		`- You are writing ONLY for: ${npcNames.join(', ')}`,
		`- ${userName} does NOT act, speak, think, feel, or decide in your response`,
		`- ${npcNames.join(', ')} CAN interact with ${userName} (speak to, touch, look at)`,
		`- ${userName} NEVER responds, reacts, or has internal states described`,
		`- Include the sensory details provided — they are grounded in the character's physical description`,
		`- Never write ${userName}'s reaction to sensory details — describe what exists, not how ${userName} experiences it`,
		'',
		'--- BEGIN DIRECTIONS ---',
		'',
	];

	for (let i = 0; i < plan.directions.length; i++) {
		const dir = plan.directions[i];
		lines.push(`Direction ${i + 1}:`);
		lines.push(`  What happens: ${dir.narration}`);
		if (
			dir.dialogue &&
			dir.dialogue !== 'No dialogue.' &&
			dir.dialogue !== 'No dialogue'
		) {
			lines.push(`  Dialogue: ${dir.dialogue}`);
		}
		if (dir.sensory) {
			lines.push(`  Sensory detail to include: ${dir.sensory}`);
		}
		if (dir.intent) {
			lines.push(`  Emotional undercurrent: ${dir.intent}`);
		}
		lines.push('');
	}

	lines.push('--- END DIRECTIONS ---');
	lines.push('');
	lines.push(
		'Write your response now. Follow the directions above exactly, in order, as natural prose.',
	);
	lines.push(`Do not write ${userName}'s actions, dialogue, thoughts, or feelings.`);
	lines.push('[/MANDATORY RESPONSE DIRECTION]');

	return lines.join('\n');
}
