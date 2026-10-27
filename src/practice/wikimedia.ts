/**
 * Wikimedia Commons / Wikipedia image fetch (injectable fetch for tests).
 */

export interface CommonsImageResult {
	bytes: Buffer;
	contentType: string;
	sourceUrl: string;
	author?: string;
	license?: string;
}

const API = "https://commons.wikimedia.org/w/api.php";

export async function resolveCommonsImage(
	pageTitle: string,
	fetchImpl: typeof fetch = fetch,
): Promise<CommonsImageResult | null> {
	const title = pageTitle.trim();
	if (!title) return null;
	try {
		const infoUrl = `${API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&format=json`;
		const infoRes = await fetchImpl(infoUrl, { headers: { "User-Agent": "LearnHarness/1.0 (practice import)" } });
		if (!infoRes.ok) return null;
		const infoJson = (await infoRes.json()) as {
			query?: { pages?: Record<string, { imageinfo?: { url?: string; extmetadata?: Record<string, { value?: string }> }[] }> };
		};
		const pages = infoJson.query?.pages ?? {};
		const page = Object.values(pages)[0];
		const imageInfo = page?.imageinfo?.[0];
		const fileUrl = imageInfo?.url;
		if (!fileUrl) return null;
		const fileRes = await fetchImpl(fileUrl, { headers: { "User-Agent": "LearnHarness/1.0 (practice import)" } });
		if (!fileRes.ok) return null;
		const bytes = Buffer.from(await fileRes.arrayBuffer());
		const contentType = fileRes.headers.get("content-type") ?? "application/octet-stream";
		const meta = imageInfo.extmetadata ?? {};
		return {
			bytes,
			contentType,
			sourceUrl: fileUrl,
			author: meta.Artist?.value?.replace(/<[^>]+>/g, "").trim(),
			license: meta.LicenseShortName?.value ?? meta.UsageTerms?.value,
		};
	} catch {
		return null;
	}
}

export function extensionForContentType(contentType: string): string {
	if (contentType.includes("svg")) return "svg";
	if (contentType.includes("png")) return "png";
	if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
	if (contentType.includes("webp")) return "webp";
	return "bin";
}
