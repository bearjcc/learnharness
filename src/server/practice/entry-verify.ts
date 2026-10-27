import type { PracticeEntry, PracticeSubject } from "../../core/practice/contracts.ts";
import { latinTermsMatch, normalizeLatinTerm } from "../../core/practice/latin-normalize.ts";
import { loadCountryCatalog } from "../../practice/geography/countries-data.ts";
import { answerSupportedByQuote, quoteMatchesTopic } from "../../core/practice/sources/claims.ts";
import { grooveLibraryByEntryId, readGrooveAbc } from "../../practice/grooves/library.ts";
import { practiceStore } from "../../store/practice.ts";
import { readSourceCache } from "../../store/practice-sources.ts";
import { ensureSubjectSourcesCached } from "./sources/ingest.ts";
import { retrievePassages } from "./sources/retrieve.ts";
import type { SourceChunkRecord } from "../../store/practice-sources.ts";
import { logVerifyEvent } from "./verify-log.ts";

export interface VerifyEntryResult {
	entry: PracticeEntry | null;
	reason: string;
}

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

function citationSupportsEntry(entry: PracticeEntry): boolean {
	if (!entry.citation?.quote?.trim()) return false;
	const topic = entry.front.trim();
	if (!quoteMatchesTopic(topic, entry.citation.quote)) return false;
	if (entry.type === "term" && entry.back.trim() && !isAbcGrooveBack(entry.back)) {
		if (!answerSupportedByQuote(entry.back, entry.citation.quote)) return false;
	}
	if (entry.type === "fact" && entry.back.trim()) {
		if (!answerSupportedByQuote(entry.back, entry.citation.quote)) return false;
	}
	return true;
}

function isAbcGrooveBack(back: string): boolean {
	return back.trimStart().startsWith("X:");
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
	const lib = grooveLibraryByEntryId(entry.entryId);
	if (!lib) return null;
	const abc = readGrooveAbc(lib);
	return confirmEntry(entry, abc, {
		sourceId,
		url: lib.citation.url,
		quote: lib.citation.quote,
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

function latinMeaningFromRow(rowText: string): string | null {
	const cells = rowText.split("|").map((c) => c.trim());
	if (cells.length < 2) return null;
	return cells[1]?.trim() || null;
}

function matchLatinInPassages(
	entry: PracticeEntry,
	passages: SourceChunkRecord[],
): { ok: true; meaning: string; passage: SourceChunkRecord } | { ok: false; reason: string } {
	const needles = [entry.front, ...(entry.aliases ?? [])].map((s) => s.trim()).filter(Boolean);
	const hits: { meaning: string; passage: SourceChunkRecord }[] = [];
	for (const p of passages) {
		for (const needle of needles) {
			const cells = p.text.split("|").map((c) => c.trim());
			const latinCell = cells[0] ?? "";
			if (!latinTermsMatch(needle, latinCell)) continue;
			const meaning = latinMeaningFromRow(p.text);
			if (!meaning) continue;
			hits.push({ meaning, passage: p });
		}
	}
	if (!hits.length) return { ok: false, reason: "latin_no_row" };
	const meanings = new Set(hits.map((h) => normalizeLatinTerm(h.meaning)));
	if (meanings.size > 1) return { ok: false, reason: "latin_multiple_rows" };
	return { ok: true, meaning: hits[0]!.meaning, passage: hits[0]!.passage };
}

function verifyLatinTerm(
	entry: PracticeEntry,
	subject: PracticeSubject,
	subjectId: string,
): VerifyEntryResult {
	if (entry.type !== "term") {
		return { entry: null, reason: "latin_wrong_type" };
	}
	const term = entry.front.trim();
	let passages = retrievePassages(term, subject.sources ?? [], 32);
	if (!passages.length) {
		const allowed = new Set((subject.sources ?? []).map((s) => s.id));
		passages = readSourceCache().chunks.filter((c) => allowed.has(c.sourceId));
		if (passages.length) {
			logVerifyEvent(subjectId, entry.entryId, "latin_scan_all_chunks", { term });
		} else {
			logVerifyEvent(subjectId, entry.entryId, "latin_no_passages");
			return { entry: null, reason: "latin_no_passages" };
		}
	}
	const matched = matchLatinInPassages(entry, passages);
	if (!matched.ok) {
		logVerifyEvent(subjectId, entry.entryId, matched.reason, { term });
		return { entry: null, reason: matched.reason };
	}
	if (!quoteMatchesTopic(term, matched.passage.text)) {
		logVerifyEvent(subjectId, entry.entryId, "latin_topic_mismatch");
		return { entry: null, reason: "latin_topic_mismatch" };
	}
	const updated = confirmEntry(entry, matched.meaning, {
		sourceId: matched.passage.sourceId,
		url: matched.passage.url,
		quote: matched.passage.text,
	});
	logVerifyEvent(subjectId, entry.entryId, "latin_confirmed");
	return { entry: persistEntry(updated), reason: "latin_confirmed" };
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
	opts?: { offline?: boolean; force?: boolean },
): Promise<VerifyEntryResult> {
	const subjectId = subject.subjectId;
	logVerifyEvent(subjectId, entry.entryId, "verify_attempted", { force: Boolean(opts?.force) });

	if (
		!opts?.force &&
		entry.status === "confirmed" &&
		entry.citation &&
		entry.back.trim() &&
		citationSupportsEntry(entry)
	) {
		return { entry, reason: "verify_already_valid" };
	}

	if (entry.status === "confirmed" && entry.citation && !citationSupportsEntry(entry)) {
		logVerifyEvent(subjectId, entry.entryId, "verify_stale_citation");
	}

	if (!subject.sources?.length) {
		logVerifyEvent(subjectId, entry.entryId, "verify_no_sources");
		return { entry: null, reason: "verify_no_sources" };
	}

	const builtinIds = new Set(
		subject.sources.filter((s) => s.kind === "builtin").map((s) => s.builtinId),
	);

	let updated: PracticeEntry | null = null;
	if (builtinIds.has("geography")) updated = verifyBuiltinGeography(entry, subject);
	if (!updated && builtinIds.has("grooves")) updated = verifyBuiltinGroove(entry, subject);
	if (updated) {
		logVerifyEvent(subjectId, entry.entryId, "verify_builtin_confirmed");
		return { entry: persistEntry(updated), reason: "verify_builtin_confirmed" };
	}

	if (entry.type === "term") {
		return verifyLatinTerm(entry, subject, subjectId);
	}

	try {
		await ensureSubjectSourcesCached(subject.sources, fetchImpl, opts);
	} catch (err) {
		const message = err instanceof Error ? err.message : "cache_failed";
		logVerifyEvent(subjectId, entry.entryId, "verify_cache_failed", { message });
		return { entry: null, reason: "verify_cache_failed" };
	}

	if (entry.type === "visual") updated = verifyCommonsFlag(entry, subject);
	if (!updated && entry.type === "fact") updated = verifyFactEntry(entry, subject);

	if (updated) {
		logVerifyEvent(subjectId, entry.entryId, "verify_confirmed");
		return { entry: persistEntry(updated), reason: "verify_confirmed" };
	}

	logVerifyEvent(subjectId, entry.entryId, "verify_no_match");
	return { entry: null, reason: "verify_no_match" };
}
