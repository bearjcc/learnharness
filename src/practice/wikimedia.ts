/**
 * Wikimedia Commons / Wikipedia image fetch (injectable fetch for tests).
 */

import packageMetadata from "../../package.json" with { type: "json" };

export interface CommonsImageResult {
	bytes: Buffer;
	contentType: string;
	sourceUrl: string;
	author?: string;
	license?: string;
}

const API = "https://commons.wikimedia.org/w/api.php";
const THUMB_WIDTH = 512;

export const WIKIMEDIA_USER_AGENT = `LearnHarness/${packageMetadata.version} (${packageMetadata.homepage}; practice-import)`;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
	url: string,
	init: RequestInit,
	fetchImpl: typeof fetch,
	maxAttempts = 5,
): Promise<Response> {
	let delay = 1000;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const res = await fetchImpl(url, {
			...init,
			headers: { ...init.headers, "User-Agent": WIKIMEDIA_USER_AGENT },
		});
		if (res.status !== 429) return res;
		const retryAfter = Number(res.headers.get("retry-after"));
		await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay);
		delay = Math.min(delay * 2, 30_000);
	}
	return fetchImpl(url, {
		...init,
		headers: { ...init.headers, "User-Agent": WIKIMEDIA_USER_AGENT },
	});
}

export async function resolveCommonsImage(
	pageTitle: string,
	fetchImpl: typeof fetch = fetch,
): Promise<CommonsImageResult | null> {
	const title = pageTitle.trim();
	if (!title) return null;
	try {
		const infoUrl = `${API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|thumburl|extmetadata&iiurlwidth=${THUMB_WIDTH}&format=json`;
		const infoRes = await fetchWithRetry(infoUrl, {}, fetchImpl);
		if (!infoRes.ok) return null;
		const infoJson = (await infoRes.json()) as {
			query?: {
				pages?: Record<
					string,
					{
						imageinfo?: {
							url?: string;
							thumburl?: string;
							extmetadata?: Record<string, { value?: string }>;
						}[];
					}
				>;
			};
		};
		const pages = infoJson.query?.pages ?? {};
		const page = Object.values(pages)[0];
		const imageInfo = page?.imageinfo?.[0];
		const fileUrl = imageInfo?.thumburl ?? imageInfo?.url;
		if (!fileUrl) return null;
		const fileRes = await fetchWithRetry(fileUrl, {}, fetchImpl);
		if (!fileRes.ok) return null;
		const bytes = Buffer.from(await fileRes.arrayBuffer());
		const contentType = fileRes.headers.get("content-type") ?? "application/octet-stream";
		const meta = imageInfo?.extmetadata ?? {};
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
