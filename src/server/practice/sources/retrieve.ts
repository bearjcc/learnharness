import type { PracticeSourceConfig } from "../../../core/practice/contracts.ts";
import { rankChunks } from "../../../core/practice/sources/bm25.ts";
import { readSourceCache, type SourceChunkRecord } from "../../../store/practice-sources.ts";
import { trustWeight } from "./trust.ts";

export function retrievePassages(
	query: string,
	sources: PracticeSourceConfig[],
	limit = 8,
): SourceChunkRecord[] {
	const allowed = new Set(sources.map((s) => s.id));
	const cache = readSourceCache();
	const chunks = cache.chunks.filter((c) => allowed.has(c.sourceId));
	const ranked = rankChunks(query, chunks, limit * 2);
	const weighted = ranked
		.map((r) => ({
			...r,
			score: r.score * trustWeight(chunks.find((c) => c.id === r.id)?.sourceId ?? ""),
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
	const byId = new Map(chunks.map((c) => [c.id, c]));
	return weighted.map((w) => byId.get(w.id)!).filter(Boolean);
}
