import fs from "node:fs";
import path from "node:path";
import { PATHS, ROOT } from "../../../../config.ts";
import type { PracticeSourceConfig } from "../../../core/practice/contracts.ts";
import { loadCountryCatalog } from "../../../practice/geography/countries-data.ts";
import { WIKIMEDIA_USER_AGENT, fetchWithRetry } from "../../../practice/wikimedia.ts";
import { readSourceCache, writeSourceCache, type SourceChunkRecord } from "../../../store/practice-sources.ts";
import { chunkText } from "./chunk-text.ts";
import { fetchWikipediaParseRows } from "./wikipedia-parse.ts";
import { builtinDrumKeyCorpusText } from "../../../practice/drums/key-library.ts";
import { builtinGroovesCorpusText } from "../../../practice/grooves/library.ts";
import { pdfExtract } from "../../../agent/subagents/pdf-ops.ts";
import fsPromises from "node:fs/promises";

const DEFAULT_TTL_MS = 168 * 3600_000;

function resolveDataPath(p: string): string {
	if (path.isAbsolute(p)) return p;
	return path.join(PATHS.data, p);
}

function isStale(fetchedAt: string, ttlHours?: number): boolean {
	const ttl = (ttlHours ?? 168) * 3600_000;
	return Date.now() - Date.parse(fetchedAt) > ttl;
}

async function fetchWikipediaPages(
	source: Extract<PracticeSourceConfig, { kind: "wikipedia" }>,
	fetchImpl: typeof fetch,
): Promise<SourceChunkRecord[]> {
	const lang = source.language ?? "en";
	const api = `https://${lang}.wikipedia.org/w/api.php`;
	const titles = [...(source.pages ?? [])];
	const out: SourceChunkRecord[] = [];
	for (const title of titles) {
		const rows = await fetchWikipediaParseRows(title, source.id, lang, fetchImpl);
		if (rows.length) {
			out.push(...rows);
			continue;
		}
		const url = `${api}?action=query&format=json&prop=extracts&explaintext=1&titles=${encodeURIComponent(title)}`;
		const res = await fetchWithRetry(url, { headers: { "User-Agent": WIKIMEDIA_USER_AGENT } }, fetchImpl);
		if (!res.ok) continue;
		const json = (await res.json()) as {
			query?: { pages?: Record<string, { title?: string; extract?: string }> };
		};
		const pages = json.query?.pages ?? {};
		for (const page of Object.values(pages)) {
			if (!page.extract?.trim()) continue;
			const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title ?? title)}`;
			out.push(...chunkText(page.extract, source.id, pageUrl, page.title ?? title));
		}
	}
	return out;
}

function loadBuiltinText(builtinId: string): { url: string; title: string; text: string } | null {
	if (builtinId === "geography") {
		const catalog = loadCountryCatalog();
		const lines = catalog.map((c) => `${c.nameEn} (${c.isoA3}): native name ${c.nameNative}.`);
		return {
			url: "builtin://geography",
			title: "Natural Earth country catalog",
			text: lines.join("\n"),
		};
	}
	if (builtinId === "grooves") {
		return { url: "builtin://grooves", title: "Curated groove library", text: builtinGroovesCorpusText() };
	}
	if (builtinId === "drum-key") {
		return {
			url: "builtin://drum-key",
			title: "Standard drum kit key",
			text: builtinDrumKeyCorpusText(),
		};
	}
	if (builtinId === "latin-phrases") {
		return {
			url: "builtin://latin-phrases",
			title: "Latin phrases seed list",
			text: "List of Latin phrases — use Wikipedia List of Latin phrases for authoritative meanings.",
		};
	}
	return null;
}

async function fetchBuiltin(
	source: Extract<PracticeSourceConfig, { kind: "builtin" }>,
): Promise<SourceChunkRecord[]> {
	const doc = loadBuiltinText(source.builtinId);
	if (!doc) return [];
	return chunkText(doc.text, source.id, doc.url, doc.title);
}

async function fetchPdf(source: Extract<PracticeSourceConfig, { kind: "pdf" }>): Promise<SourceChunkRecord[]> {
	const filePath = resolveDataPath(source.path);
	try {
		await fsPromises.access(filePath);
	} catch {
		return [];
	}
	const text = await pdfExtract(filePath, "1-");
	return chunkText(text, source.id, `file://${filePath}`, source.label ?? path.basename(filePath));
}

function hostAllowed(url: string, allow: string[]): boolean {
	try {
		const h = new URL(url).hostname.toLowerCase();
		return allow.some((d) => h === d.toLowerCase() || h.endsWith(`.${d.toLowerCase()}`));
	} catch {
		return false;
	}
}

async function fetchSite(
	source: Extract<PracticeSourceConfig, { kind: "site" }>,
	fetchImpl: typeof fetch,
): Promise<SourceChunkRecord[]> {
	const seeds = source.seedUrls ?? [];
	const out: SourceChunkRecord[] = [];
	for (const seed of seeds) {
		if (!hostAllowed(seed, source.allowDomains)) continue;
		try {
			const res = await fetchWithRetry(seed, { headers: { "User-Agent": WIKIMEDIA_USER_AGENT } }, fetchImpl);
			if (!res.ok) continue;
			const html = await res.text();
			const text = html
				.replace(/<script[\s\S]*?<\/script>/gi, " ")
				.replace(/<style[\s\S]*?<\/style>/gi, " ")
				.replace(/<[^>]+>/g, " ")
				.replace(/\s+/g, " ")
				.trim();
			if (!text) continue;
			out.push(...chunkText(text.slice(0, 120_000), source.id, seed, seed));
		} catch {
			/* polite skip */
		}
	}
	return out;
}

export async function ingestSource(
	source: PracticeSourceConfig,
	fetchImpl: typeof fetch,
	force = false,
): Promise<number> {
	const cache = readSourceCache();
	const existing = cache.chunks.filter((c) => c.sourceId === source.id);
	if (!force && existing.length > 0 && !isStale(existing[0]!.fetchedAt, source.ttlHours)) {
		return existing.length;
	}
	let fresh: SourceChunkRecord[] = [];
	if (source.kind === "wikipedia") fresh = await fetchWikipediaPages(source, fetchImpl);
	else if (source.kind === "builtin") fresh = await fetchBuiltin(source);
	else if (source.kind === "pdf") fresh = await fetchPdf(source);
	else if (source.kind === "site") fresh = await fetchSite(source, fetchImpl);
	const rest = cache.chunks.filter((c) => c.sourceId !== source.id);
	cache.chunks = [...rest, ...fresh];
	writeSourceCache(cache);
	return fresh.length;
}

export async function ensureSubjectSourcesCached(
	sources: PracticeSourceConfig[],
	fetchImpl: typeof fetch,
	opts?: { offline?: boolean },
): Promise<void> {
	for (const src of sources) {
		const cache = readSourceCache();
		const have = cache.chunks.some((c) => c.sourceId === src.id);
		if (opts?.offline) {
			if (!have) throw new Error(`offline: missing cache for ${src.id}`);
			continue;
		}
		await ingestSource(src, fetchImpl, false);
	}
}
