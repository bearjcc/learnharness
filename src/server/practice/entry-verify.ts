import type { PracticeEntry, PracticeSubject } from "../../core/practice/contracts.ts";
import { loadCountryCatalog } from "../../practice/geography/countries-data.ts";
import { normalizeQuoteText } from "../../core/practice/quote-normalize.ts";
import { answerSupportedByQuote, quoteMatchesTopic } from "../../core/practice/sources/claims.ts";
import { practiceStore } from "../../store/practice.ts";
import { ensureSubjectSourcesCached } from "./sources/ingest.ts";
import { retrievePassages } from "./sources/retrieve.ts";

function builtinSourceId(subject: PracticeSubject, builtinId: string): string | undefined {
	return subject.sources?.find((s) => s.kind === "builtin" && s.builtinId === builtinId)?.id;
}

function confirmEntry(
	entry: PracticeEntry,
	back: string,
	citation: { sourceId: string; url?: string; quote: string },
): PracticeEntry {
	return {
		...entry,
		back: back.trim() || entry.back,
		status: "confirmed",
		topicOnly: false,
		citation,
	};
}

function persistEntry(updated: PracticeEntry): PracticeEntry {
	const entries = practiceStore.readEntries();
	const idx = entries.findIndex((e) => e.entryId === updated.entryId && e.subjectId === updated.subjectId);
	if (idx < 0) return updated;
	entries[idx] = updated;
	practiceStore.writeEntries(entries);
	return updated;
}

function verifyBuiltinGeography(entry: PracticeEntry, subject: PracticeSubject): PracticeEntry | null {
	const sourceId = builtinSourceId(subject, "geography");
	if (!sourceId || entry.type !== "visual") return null;
	const catalog = loadCountryCatalog();
	const iso = entry.tags?.find((t) => t.startsWith("flag-iso:"))?.slice("flag-iso:".length);
	const row = iso
		? catalog.find((c) => c.isoA3 === iso)
		: catalog.find((c) => c.nameEn === entry.front || c.isoA3 === entry.front);
	if (!row) return null;
	const line = `${row.nameEn} (${row.isoA3}): native name ${row.nameNative}.`;
	return confirmEntry(entry, row.nameEn, {
		sourceId,
		url: "builtin://geography",
		quote: line,
	});
}

function verifyBuiltinGroove(entry: PracticeEntry, subject: PracticeSubject): PracticeEntry | null {
	const sourceId = builtinSourceId(subject, "grooves");
	if (!sourceId || entry.type !== "groove") return null;
	const quote = `Groove ${entry.front}:`;
	return confirmEntry(entry, entry.back || entry.front, {
		sourceId,
		url: "builtin://grooves",
		quote,
	});
}

function verifyCommonsFlag(entry: PracticeEntry, subject: PracticeSubject): PracticeEntry | null {
	if (entry.origin.kind !== "commons") return null;
	const sourceId = subject.sources?.[0]?.id ?? "commons";
	const attr = entry.variants?.flag?.attribution;
	const url = attr?.sourceUrl ?? `https://commons.wikimedia.org/wiki/File:${entry.origin.pageTitle}`;
	const quote = [entry.front, attr?.license, attr?.author].filter(Boolean).join(" — ");
	if (!quote.trim()) return null;
	const back = entry.back.trim() || entry.front;
	return confirmEntry(entry, back, { sourceId, url, quote });
}

function latinRowMatches(term: string, rowText: string): { meaning: string } | null {
	const cells = rowText.split("|").map((c) => c.trim());
	if (cells.length < 2) return null;
	const latin = normalizeQuoteText(cells[0] ?? "");
	const termNorm = normalizeQuoteText(term);
	if (!latin.includes(termNorm) && !termNorm.includes(latin)) return null;
	return { meaning: cells[1] ?? "" };
}

function verifyLatinTerm(entry: PracticeEntry, subject: PracticeSubject): PracticeEntry | null {
	if (entry.type !== "term") return null;
	const term = entry.front.trim();
	const passages = retrievePassages(term, subject.sources ?? [], 24);
	for (const p of passages) {
		const match = latinRowMatches(term, p.text);
		if (!match?.meaning) continue;
		if (!quoteMatchesTopic(term, p.text)) continue;
		return confirmEntry(entry, match.meaning, {
			sourceId: p.sourceId,
			url: p.url,
			quote: p.text,
		});
	}
	return null;
}

function verifyFactEntry(entry: PracticeEntry, subject: PracticeSubject): PracticeEntry | null {
	if (entry.type !== "fact" || !entry.back.trim()) return null;
	const topic = entry.front.trim();
	const passages = retrievePassages(topic, subject.sources ?? [], 12);
	for (const p of passages) {
		if (!quoteMatchesTopic(topic, p.text)) continue;
		if (!answerSupportedByQuote(entry.back, p.text)) continue;
		return confirmEntry(entry, entry.back, {
			sourceId: p.sourceId,
			url: p.url,
			quote: p.text,
		});
	}
	return null;
}

export async function verifyEntryIdentity(
	subject: PracticeSubject,
	entry: PracticeEntry,
	fetchImpl: typeof fetch = fetch,
	opts?: { offline?: boolean },
): Promise<PracticeEntry | null> {
	if (entry.status === "confirmed" && entry.citation && entry.back.trim()) return entry;
	if (!subject.sources?.length) return null;

	const builtinIds = new Set(
		subject.sources.filter((s) => s.kind === "builtin").map((s) => s.builtinId),
	);

	let updated: PracticeEntry | null = null;
	if (builtinIds.has("geography")) updated = verifyBuiltinGeography(entry, subject);
	if (!updated && builtinIds.has("grooves")) updated = verifyBuiltinGroove(entry, subject);
	if (updated) return persistEntry(updated);

	try {
		await ensureSubjectSourcesCached(subject.sources, fetchImpl, opts);
	} catch {
		return null;
	}

	if (!updated && entry.type === "visual") updated = verifyCommonsFlag(entry, subject);
	if (!updated && entry.type === "term") updated = verifyLatinTerm(entry, subject);
	if (!updated && entry.type === "fact") updated = verifyFactEntry(entry, subject);

	if (updated) return persistEntry(updated);
	return null;
}
