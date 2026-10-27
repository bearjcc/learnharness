import { normalizeQuoteText } from "./quote-normalize.ts";

/** Strip diacritics, punctuation noise, and case for Latin phrase matching. */
export function normalizeLatinTerm(raw: string): string {
	return normalizeQuoteText(raw)
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/…/g, "")
		.replace(/\.{2,}/g, "")
		.replace(/[''`]/g, "'")
		.replace(/[""]/g, '"')
		.replace(/[()[\]]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
}

export function latinTermsMatch(term: string, cellLatin: string): boolean {
	const t = normalizeLatinTerm(term);
	const c = normalizeLatinTerm(cellLatin);
	if (!t || !c) return false;
	if (c === t) return true;
	if (c.includes(t) && t.length >= 4) return true;
	// "ad hoc" style: cell may be longer lemma line
	const tParts = t.split(" ").filter(Boolean);
	if (tParts.length > 1 && tParts.every((p) => c.includes(p))) return true;
	return false;
}
