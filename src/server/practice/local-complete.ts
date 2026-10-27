import {
	LOCAL_INFERENCE_API_KEY_ENV,
	resolveLocalModelRequestOptions,
} from "../../core/local-inference.ts";
import { effectiveLocalInferenceConfig } from "../local-inference.ts";

export class LocalInferenceHttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "LocalInferenceHttpError";
	}
}

export async function completeLocalJson(
	modelId: string,
	messages: { role: "system" | "user"; content: string }[],
	schema: Record<string, unknown>,
	fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown> | null> {
	const config = effectiveLocalInferenceConfig();
	if (!config) return null;
	const opts = resolveLocalModelRequestOptions(modelId, config.manualModels);
	const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
	const apiKey = process.env[LOCAL_INFERENCE_API_KEY_ENV]?.trim();
	const body: Record<string, unknown> = {
		model: modelId,
		messages,
		stream: false,
		...(opts.maxTokens ? { max_tokens: opts.maxTokens } : { max_tokens: 512 }),
		...(opts.think !== undefined ? { think: opts.think } : { think: false }),
	};
	if (opts.format) {
		body.response_format = {
			type: "json_schema",
			json_schema: { name: "practice_item", schema: opts.format, strict: true },
		};
	} else if (schema) {
		body.response_format = {
			type: "json_schema",
			json_schema: { name: "practice_item", schema, strict: true },
		};
	}
	const res = await fetchImpl(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
		},
		body: JSON.stringify(body),
	});
	if (res.status === 503) throw new LocalInferenceHttpError("GPU gate closed", 503);
	if (!res.ok) return null;
	const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
	const text = json.choices?.[0]?.message?.content;
	if (!text) return null;
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		return null;
	}
}
