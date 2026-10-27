import type {
	PracticeDailyItem,
	PracticeEntry,
	PracticeMediaRef,
	PracticeMediaVariantConfig,
	PracticeSubject,
} from "./contracts.ts";

/** Legacy entries with a single `media` field use this variant key. */
export const DEFAULT_MEDIA_VARIANT = "default";

export function listEntryMediaVariants(entry: PracticeEntry): string[] {
	const keys = new Set<string>();
	if (entry.variants) {
		for (const k of Object.keys(entry.variants)) keys.add(k);
	}
	if (entry.media) keys.add(DEFAULT_MEDIA_VARIANT);
	return [...keys].sort();
}

export function mediaRefForVariant(entry: PracticeEntry, variant: string): PracticeMediaRef | null {
	if (entry.variants?.[variant]) return entry.variants[variant];
	if (variant === DEFAULT_MEDIA_VARIANT && entry.media) return entry.media;
	return null;
}

export function mediaTokenForVariant(entry: PracticeEntry, variant: string): string | null {
	const ref = mediaRefForVariant(entry, variant);
	if (!ref || ref.kind === "audio") return null;
	return ref.ref;
}

export function entryHasMediaVariant(entry: PracticeEntry, variant: string): boolean {
	return mediaTokenForVariant(entry, variant) !== null;
}

function hashSeed(seed: string): number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function weightedVariantPick(enabled: string[], weights: Record<string, number>, seed: string): string {
	const total = enabled.reduce((sum, key) => sum + (weights[key] ?? 1), 0);
	let roll = (hashSeed(seed) % 10_000) / 10_000 * total;
	for (const key of enabled) {
		roll -= weights[key] ?? 1;
		if (roll <= 0) return key;
	}
	return enabled[enabled.length - 1]!;
}

/** Variants on the subject that this entry can supply. */
export function availableMediaVariants(
	subject: PracticeSubject,
	entry: PracticeEntry,
): string[] {
	const cfg = subject.mediaVariants;
	const enabled = cfg?.enabled?.length ? cfg.enabled : [DEFAULT_MEDIA_VARIANT];
	return enabled.filter((v) => entryHasMediaVariant(entry, v));
}

export function pickMediaVariant(
	subject: PracticeSubject,
	entry: PracticeEntry,
	seed: string,
): string | null {
	const available = availableMediaVariants(subject, entry);
	if (!available.length) return null;
	const weights = subject.mediaVariants?.weights ?? {};
	return weightedVariantPick(available, weights, seed);
}

export function assertConsistentMediaVariant(
	item: PracticeDailyItem,
	ctx: { entriesById: Map<string, PracticeEntry> },
): string[] {
	const errors: string[] = [];
	const variant = item.mediaVariant;
	if (!variant) return errors;
	const source = ctx.entriesById.get(item.entryId);
	if (!source) return errors;

	const expectToken = (entryId: string): string | null => {
		const ent = ctx.entriesById.get(entryId);
		if (!ent) return null;
		return mediaTokenForVariant(ent, variant);
	};

	const srcToken = expectToken(item.entryId);
	if (!srcToken) errors.push(`source missing variant ${variant}`);

	const promptImg = item.prompt.find((p) => p.type === "image");
	if (promptImg && srcToken && promptImg.token !== srcToken) {
		errors.push("prompt image variant mismatch");
	}

	for (const opt of item.options) {
		if (opt.type !== "image") continue;
		const token = expectToken(opt.id);
		if (!token) {
			errors.push(`option ${opt.id} missing variant ${variant}`);
			continue;
		}
		if (opt.token !== token) errors.push(`option ${opt.id} uses wrong variant asset`);
	}

	const imageTokens = [
		...(promptImg?.type === "image" ? [promptImg.token] : []),
		...item.options.filter((o) => o.type === "image").map((o) => o.token),
	];
	if (imageTokens.length > 1 && new Set(imageTokens).size !== imageTokens.length) {
		// duplicate tokens ok for different entries? No - should be distinct entries
	}
	return errors;
}

export function normalizeMediaVariantConfig(
	raw: PracticeMediaVariantConfig | undefined,
): PracticeMediaVariantConfig | undefined {
	if (!raw?.enabled?.length) return undefined;
	return {
		enabled: raw.enabled,
		...(raw.weights ? { weights: raw.weights } : {}),
		...(raw.distractorBias ? { distractorBias: raw.distractorBias } : {}),
	};
}
