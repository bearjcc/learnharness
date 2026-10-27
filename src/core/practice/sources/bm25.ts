const K1 = 1.2;
const B = 0.75;

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]+/gu, " ")
		.split(/\s+/)
		.filter(Boolean);
}

export interface RankedChunk {
	id: string;
	score: number;
}

/** Lexical BM25 over in-memory chunks (offline retrieval). */
export function rankChunks(
	query: string,
	chunks: Array<{ id: string; text: string }>,
	limit = 8,
): RankedChunk[] {
	const docs = chunks.map((c) => tokenize(c.text));
	const q = tokenize(query);
	if (!q.length || !docs.length) return [];
	const dl = docs.map((d) => d.length);
	const avgDl = dl.reduce((a, b) => a + b, 0) / dl.length;
	const df = new Map<string, number>();
	for (const d of docs) {
		const seen = new Set(d);
		for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
	}
	const N = docs.length;
	const scores = docs.map((d, i) => {
		let score = 0;
		const len = dl[i] ?? 0;
		for (const term of q) {
			const f = d.filter((t) => t === term).length;
			if (!f) continue;
			const n = df.get(term) ?? 0;
			const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
			const denom = f + K1 * (1 - B + B * (len / avgDl));
			score += idf * ((f * (K1 + 1)) / denom);
		}
		return { id: chunks[i]!.id, score };
	});
	return scores
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}
