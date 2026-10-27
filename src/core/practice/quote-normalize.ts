/** Normalize quotes for verbatim-in-chunk verification. */
export function normalizeQuoteText(raw: string): string {
	return raw
		.normalize("NFKC")
		.replace(/\u00a0/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}
