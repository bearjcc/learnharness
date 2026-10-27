import { normalizeQuoteText } from "../quote-normalize.ts";

export function quoteAppearsInCorpus(quote: string, corpus: string): boolean {
	const q = normalizeQuoteText(quote);
	if (!q) return false;
	const c = normalizeQuoteText(corpus);
	return c.includes(q);
}

export function quoteAppearsInChunks(
	quote: string,
	chunks: Array<{ text: string }>,
): boolean {
	return chunks.some((ch) => quoteAppearsInCorpus(quote, ch.text));
}

export type JudgeFn = (answer: string, quote: string) => Promise<boolean>;

export function parseJudgeYesNo(raw: string): boolean {
	const t = raw.trim().toLowerCase();
	return t === "yes" || t === "y" || t.startsWith("yes");
}
