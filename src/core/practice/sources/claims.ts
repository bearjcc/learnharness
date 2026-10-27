import { normalizeQuoteText } from "../quote-normalize.ts";
import type { PracticeEntry } from "../contracts.ts";

const CLAIM_STOPWORDS = new Set([
	"which",
	"what",
	"when",
	"where",
	"who",
	"how",
	"the",
	"this",
	"that",
	"these",
	"those",
	"and",
	"or",
	"for",
	"from",
	"with",
	"mean",
	"means",
	"flag",
	"country",
	"groove",
	"term",
]);

/** Capitalised phrases and numbers that look like factual claims. */
export function extractClaims(text: string): string[] {
	const out: string[] = [];
	const numbers = text.match(/\b\d[\d,.]*%?\b/g) ?? [];
	out.push(...numbers);
	for (const m of text.match(/\b[A-Z][a-z]+(?:[''][a-z]+)?(?:\s+[A-Z][a-z]+(?:[''][a-z]+)?)*/g) ?? []) {
		const lower = m.toLowerCase();
		const words = lower.split(/\s+/).filter((w) => w && !CLAIM_STOPWORDS.has(w));
		if (words.length) out.push(words.join(" "));
	}
	return out;
}

function allowedCorpus(quote: string, entry: PracticeEntry): string {
	return normalizeQuoteText(
		[quote, entry.front, entry.back, entry.groupLabel ?? "", ...(entry.aliases ?? [])].join(" "),
	);
}

/** Conservative: every claim token in prompt/explain must appear in quote or entry fields. */
export function promptClaimsAllowed(
	prompt: string,
	explain: string,
	quote: string,
	entry: PracticeEntry,
): boolean {
	const corpus = allowedCorpus(quote, entry);
	for (const claim of extractClaims(`${prompt} ${explain}`)) {
		const c = normalizeQuoteText(claim);
		if (!c) continue;
		if (!corpus.includes(c)) return false;
	}
	return true;
}

export function significantTopicTokens(topic: string): string[] {
	return normalizeQuoteText(topic)
		.split(/\s+/)
		.filter((t) => t.length >= 3 && !CLAIM_STOPWORDS.has(t));
}

export function quoteMatchesTopic(topic: string, quote: string): boolean {
	const tokens = significantTopicTokens(topic);
	if (!tokens.length) return true;
	const q = normalizeQuoteText(quote);
	return tokens.some((t) => q.includes(t));
}

export function answerSupportedByQuote(answer: string, quote: string): boolean {
	const a = normalizeQuoteText(answer);
	const q = normalizeQuoteText(quote);
	if (!a) return false;
	if (q.includes(a)) return true;
	const tokens = a.split(/\s+/).filter((t) => t.length > 2);
	if (!tokens.length) return q.includes(a);
	return tokens.every((t) => q.includes(t));
}
