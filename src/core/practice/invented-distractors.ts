import type { PracticeEntry, PracticeOptionPart, PracticeSubject } from "./contracts.ts";
import { KIND_OPTION_FIELD } from "./option-fields.ts";

export type EmbedFn = (texts: string[]) => Promise<number[][] | null>;

export interface InventedSafetyConfig {
	/** Max cosine similarity to correct answer / aliases (default 0.85). */
	maxSimilarity?: number;
}

export function normalizeDistractorText(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/\b(the|a|an)\b/g, " ")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function containsNormalized(haystack: string, needle: string): boolean {
	if (!needle) return false;
	return haystack.includes(needle) || needle.includes(haystack);
}

export function answerTexts(entry: PracticeEntry, field: "front" | "back"): string[] {
	const primary = field === "front" ? entry.front : entry.back;
	return [primary, ...(entry.aliases ?? [])].filter(Boolean);
}

function normalizedAnswerPhrases(entry: PracticeEntry, field: "front" | "back"): string[] {
	return answerTexts(entry, field).map(normalizeDistractorText).filter(Boolean);
}

export function collidesWithConfirmedEntry(
	text: string,
	source: PracticeEntry,
	field: "front" | "back",
	pool: readonly PracticeEntry[],
): boolean {
	const norm = normalizeDistractorText(text);
	for (const e of pool) {
		if (e.entryId === source.entryId) continue;
		if (e.subjectId !== source.subjectId) continue;
		if (e.status !== "confirmed") continue;
		const candidate = field === "front" ? e.front : e.back;
		if (normalizeDistractorText(candidate) === norm) return true;
		for (const a of e.aliases ?? []) {
			if (normalizeDistractorText(a) === norm) return true;
		}
	}
	return false;
}

export function normalizeSafetyRejects(
	text: string,
	source: PracticeEntry,
	field: "front" | "back",
	pool: readonly PracticeEntry[],
): string[] {
	const errors: string[] = [];
	const norm = normalizeDistractorText(text);
	if (!norm) {
		errors.push("empty invented distractor");
		return errors;
	}
	for (const phrase of normalizedAnswerPhrases(source, field)) {
		if (phrase === norm) errors.push("invented equals correct answer");
		if (containsNormalized(norm, phrase)) errors.push("invented overlaps correct answer");
	}
	if (collidesWithConfirmedEntry(text, source, field, pool)) {
		errors.push("invented matches another entry answer");
	}
	return errors;
}

export function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * b[i]!;
		na += a[i]! * a[i]!;
		nb += b[i]! * b[i]!;
	}
	if (na === 0 || nb === 0) return 0;
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function embeddingSafetyRejects(
	text: string,
	source: PracticeEntry,
	field: "front" | "back",
	config: InventedSafetyConfig,
	embed: EmbedFn | undefined,
): Promise<string[]> {
	if (!embed) return [];
	const vectors = await embed([text, ...answerTexts(source, field)]);
	if (!vectors || vectors.length < 2) return [];
	const inv = vectors[0]!;
	const maxSim = config.maxSimilarity ?? 0.85;
	for (let i = 1; i < vectors.length; i++) {
		const sim = cosineSimilarity(inv, vectors[i]!);
		if (sim > maxSim) return ["invented too similar to answer (embedding)"];
	}
	return [];
}

export async function validateInventedText(
	text: string,
	source: PracticeEntry,
	kind: string,
	pool: readonly PracticeEntry[],
	subject: PracticeSubject | undefined,
	embed: EmbedFn | undefined,
): Promise<string[]> {
	const field = KIND_OPTION_FIELD[kind];
	if (field !== "front" && field !== "back") return ["invented not supported for kind"];
	const errors = normalizeSafetyRejects(text, source, field, pool);
	if (errors.length) return errors;
	errors.push(
		...(await embeddingSafetyRejects(text, source, field, {
			maxSimilarity: subject?.embeddingMaxSimilarity,
		}, embed)),
	);
	return errors;
}

export function isInventedOptionId(id: string): boolean {
	return id.startsWith("inv_");
}

export async function validateInventedOptionsOnItem(
	item: { kind: string; options: PracticeOptionPart[] },
	source: PracticeEntry,
	pool: readonly PracticeEntry[],
	subject: PracticeSubject | undefined,
	embed: EmbedFn | undefined,
): Promise<string[]> {
	const errors: string[] = [];
	for (const opt of item.options) {
		if (opt.source !== "invented" && !isInventedOptionId(opt.id)) continue;
		if (opt.type !== "text") {
			errors.push("invented option must be text");
			continue;
		}
		errors.push(...(await validateInventedText(opt.text, source, item.kind, pool, subject, embed)));
	}
	return errors;
}
