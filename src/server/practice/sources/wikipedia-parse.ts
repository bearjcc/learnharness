import { JSDOM } from "jsdom";
import { WIKIMEDIA_USER_AGENT, fetchWithRetry } from "../../../practice/wikimedia.ts";
import type { SourceChunkRecord } from "../../../store/practice-sources.ts";

/** One passage per wikitable row: `col1 | col2 | …`. */
export function tableRowPassagesFromHtml(
	html: string,
	sourceId: string,
	pageUrl: string,
	title: string,
): SourceChunkRecord[] {
	const dom = new JSDOM(html);
	const fetchedAt = new Date().toISOString();
	const rows: SourceChunkRecord[] = [];
	let idx = 0;
	for (const table of dom.window.document.querySelectorAll("table.wikitable")) {
		for (const tr of table.querySelectorAll("tr")) {
			const cells = [...tr.querySelectorAll("th,td")]
				.map((c) => c.textContent?.replace(/\s+/g, " ").trim() ?? "")
				.filter((c) => c.length > 0);
			if (cells.length < 2) continue;
			const headerLike = cells.every((c) => c.length < 40) && /latin|phrase|meaning|translation|notes/i.test(cells.join(" "));
			if (headerLike && cells.length <= 4) continue;
			const text = cells.join(" | ");
			if (text.length < 8) continue;
			rows.push({
				id: `${sourceId}:${title}:${idx}`,
				sourceId,
				url: pageUrl,
				title,
				text,
				fetchedAt,
			});
			idx++;
		}
	}
	return rows;
}

export async function fetchWikipediaParseRows(
	title: string,
	sourceId: string,
	lang: string,
	fetchImpl: typeof fetch,
): Promise<SourceChunkRecord[]> {
	const api = `https://${lang}.wikipedia.org/w/api.php`;
	const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
	const url = `${api}?action=parse&format=json&prop=text&page=${encodeURIComponent(title)}`;
	const res = await fetchWithRetry(url, { headers: { "User-Agent": WIKIMEDIA_USER_AGENT } }, fetchImpl);
	if (!res.ok) return [];
	const json = (await res.json()) as { parse?: { text?: { "*": string } } };
	const html = json.parse?.text?.["*"];
	if (!html) return [];
	return tableRowPassagesFromHtml(html, sourceId, pageUrl, title);
}
