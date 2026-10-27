import type { PracticeEntry, PracticeSubject } from "./contracts.ts";
import { entryHasMediaVariant } from "./media-variants.ts";

export type DistractorBias = "tags" | "similar-size" | "similar-shape";

export interface DistractorOptions {
	/** Require this media variant on every distractor. */
	mediaVariant?: string;
	bias?: DistractorBias;
	/** Exclude peers in the same equivalence group (group-level identity questions). */
	excludeGroup?: string;
}

/** Shared-tag overlap score (higher = closer). */
export function tagOverlapScore(a: readonly string[], b: readonly string[]): number {
	const setB = new Set(b.map((t) => t.toLowerCase()));
	let score = 0;
	for (const t of a) {
		if (setB.has(t.toLowerCase())) score++;
	}
	return score;
}

/** Pick `count` distractors from confirmed peers, nearest tags first. */
function areaTag(entry: PracticeEntry): number | null {
	const tag = entry.tags?.find((t) => t.startsWith("geo-area:"));
	if (!tag) return null;
	const n = Number(tag.slice("geo-area:".length));
	return Number.isFinite(n) ? n : null;
}

function similarityScore(source: PracticeEntry, other: PracticeEntry, bias: DistractorOptions["bias"]): number {
	if (bias === "similar-size") {
		const a = areaTag(source);
		const b = areaTag(other);
		if (a !== null && b !== null) {
			return -Math.abs(Math.log(a) - Math.log(b));
		}
	}
	if (bias === "similar-shape") {
		const ar = source.tags?.find((t) => t.startsWith("geo-aspect:"));
		const br = other.tags?.find((t) => t.startsWith("geo-aspect:"));
		if (ar && br) {
			return -Math.abs(Number(ar.slice(9)) - Number(br.slice(9)));
		}
	}
	return tagOverlapScore(source.tags ?? [], other.tags ?? []);
}

export function selectDistractors(
	source: PracticeEntry,
	pool: readonly PracticeEntry[],
	count: number,
	options: DistractorOptions = {},
): PracticeEntry[] {
	const candidates = pool.filter(
		(e) =>
			e.entryId !== source.entryId &&
			e.status === "confirmed" &&
			e.subjectId === source.subjectId &&
			e.type === source.type &&
			(!options.mediaVariant || entryHasMediaVariant(e, options.mediaVariant)) &&
			(!options.excludeGroup || !e.group || e.group !== options.excludeGroup),
	);
	const scored = candidates
		.map((e) => ({
			entry: e,
			score: similarityScore(source, e, options.bias),
		}))
		.sort((a, b) => b.score - a.score || a.entry.entryId.localeCompare(b.entry.entryId));
	const out: PracticeEntry[] = [];
	for (const row of scored) {
		if (out.length >= count) break;
		out.push(row.entry);
	}
	return out;
}
