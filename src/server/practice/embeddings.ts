import { effectiveLocalInferenceConfig } from "../local-inference.ts";
import { LOCAL_INFERENCE_API_KEY_ENV } from "../../core/local-inference.ts";

export async function embedTextsOllama(
	texts: string[],
	fetchImpl: typeof fetch = fetch,
	modelOverride?: string,
): Promise<number[][] | null> {
	const config = effectiveLocalInferenceConfig();
	if (!config) return null;
	const model =
		modelOverride?.trim() ||
		process.env.LH_PRACTICE_EMBED_MODEL?.trim() ||
		process.env.LH_OLLAMA_EMBED_MODEL?.trim();
	if (!model) return null;
	const url = `${config.baseUrl.replace(/\/$/, "")}/embeddings`;
	const apiKey = process.env[LOCAL_INFERENCE_API_KEY_ENV]?.trim();
	const res = await fetchImpl(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
		},
		body: JSON.stringify({ model, input: texts }),
	});
	if (!res.ok) return null;
	const json = (await res.json()) as { data?: { embedding?: number[] }[] };
	const out: number[][] = [];
	for (const row of json.data ?? []) {
		if (!row.embedding) return null;
		out.push(row.embedding);
	}
	return out.length === texts.length ? out : null;
}
