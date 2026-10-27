import type { PracticeSubject } from "./contracts.ts";

export interface DistractorMix {
	fromEntries: number;
	invented: number;
}

const DEFAULT_MIX = { fromEntries: 1, invented: 0 };

export const INVENTED_DISTRACTOR_KINDS = new Set([
	"term-pick",
	"meaning-pick",
	"fact-pick",
	"label-pick",
]);

export function supportsInventedDistractors(kind: string): boolean {
	return INVENTED_DISTRACTOR_KINDS.has(kind);
}

function hashSeed(seed: string): number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** Split `total` distractor slots between entry pool and model-invented (weights default 1). */
export function planDistractorMix(
	subject: PracticeSubject,
	kind: string,
	total: number,
	seed: string,
): DistractorMix {
	if (!supportsInventedDistractors(kind)) {
		return { fromEntries: total, invented: 0 };
	}
	const weights = subject.distractors ?? DEFAULT_MIX;
	const fromW = weights.fromEntries ?? 1;
	const invW = weights.invented ?? 0;
	if (invW <= 0) return { fromEntries: total, invented: 0 };
	if (fromW <= 0) return { fromEntries: 0, invented: total };
	const sum = fromW + invW;
	let invented = 0;
	for (let i = 0; i < total; i++) {
		const roll = ((hashSeed(`${seed}:${i}`) % 10_000) / 10_000) * sum;
		if (roll >= fromW) invented++;
	}
	return { fromEntries: total - invented, invented };
}
