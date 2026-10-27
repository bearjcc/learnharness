const CHUNK_SIZE = 900;
const OVERLAP = 120;

export function chunkText(text: string, sourceId: string, url: string, title?: string): Array<{
	id: string;
	sourceId: string;
	url: string;
	title?: string;
	text: string;
	fetchedAt: string;
}> {
	const clean = text.replace(/\r\n/g, "\n").trim();
	if (!clean) return [];
	const fetchedAt = new Date().toISOString();
	const out: Array<{
		id: string;
		sourceId: string;
		url: string;
		title?: string;
		text: string;
		fetchedAt: string;
	}> = [];
	let start = 0;
	let idx = 0;
	while (start < clean.length) {
		const end = Math.min(clean.length, start + CHUNK_SIZE);
		const slice = clean.slice(start, end);
		out.push({
			id: `${sourceId}:${idx}`,
			sourceId,
			url,
			...(title ? { title } : {}),
			text: slice,
			fetchedAt,
		});
		idx++;
		if (end >= clean.length) break;
		start = Math.max(0, end - OVERLAP);
	}
	return out;
}
