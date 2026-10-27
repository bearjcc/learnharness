import type { PracticeEntry } from "./contracts.ts";

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
export function selectDistractors(
	source: PracticeEntry,
	pool: readonly PracticeEntry[],
	count: number,
): PracticeEntry[] {
	const candidates = pool.filter(
		(e) =>
			e.entryId !== source.entryId &&
			e.status === "confirmed" &&
			e.subjectId === source.subjectId &&
			e.type === source.type,
	);
	const scored = candidates
		.map((e) => ({
			entry: e,
			score: tagOverlapScore(source.tags ?? [], e.tags ?? []),
		}))
		.sort((a, b) => b.score - a.score || a.entry.entryId.localeCompare(b.entry.entryId));
	const out: PracticeEntry[] = [];
	for (const row of scored) {
		if (out.length >= count) break;
		out.push(row.entry);
	}
	return out;
}
