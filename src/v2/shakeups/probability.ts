/**
 * Shakeup Probability Curve
 *
 * Quadratic probability curve: p(n) = (n / maxMessages)^2
 * Starts low and reaches 100% at maxMessages.
 */

/**
 * Compute the probability of a shakeup given messages since last shakeup.
 *
 * @param messagesSince - Number of messages since last shakeup (or start)
 * @param maxMessages - Messages at which probability reaches 100%
 * @returns Probability in [0, 1]
 */
export function computeShakeupProbability(messagesSince: number, maxMessages: number): number {
	if (maxMessages <= 0) return 1;
	if (messagesSince <= 0) return 0;
	const ratio = Math.min(messagesSince / maxMessages, 1);
	return ratio * ratio;
}

/**
 * Determine whether a shakeup should trigger.
 *
 * @param messagesSince - Number of messages since last shakeup
 * @param maxMessages - Messages at which probability reaches 100%
 * @param randomValue - Random value in [0, 1) for testing; defaults to Math.random()
 * @returns true if shakeup should trigger
 */
export function shouldTriggerShakeup(
	messagesSince: number,
	maxMessages: number,
	randomValue?: number,
): boolean {
	const probability = computeShakeupProbability(messagesSince, maxMessages);
	const roll = randomValue ?? Math.random();
	return roll < probability;
}
