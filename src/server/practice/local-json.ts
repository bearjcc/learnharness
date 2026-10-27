import {
	LOCAL_INFERENCE_API_KEY_ENV,
	ollamaChatUrl,
	resolveLocalModelRequestOptions,
} from "../../core/local-inference.ts";
import { effectiveLocalInferenceConfig } from "../local-inference.ts";
import { LocalInferenceHttpError } from "./local-complete.ts";

export interface LocalJsonCompletion {
	data: Record<string, unknown>;
	finishReason?: string;
	usedReasoningFallback?: boolean;
	rawSnippet?: string;
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
	const trimmed = text.trim();
	if (!trimmed) return null;
	try {
		return JSON.parse(trimmed) as Record<string, unknown>;
	} catch {
		const start = trimmed.indexOf("{");
		if (start < 0) return null;
		let depth = 0;
		for (let i = start; i < trimmed.length; i++) {
			const ch = trimmed[i];
			if (ch === "{") depth++;
			else if (ch === "}") {
				depth--;
				if (depth === 0) {
					try {
						return JSON.parse(trimmed.slice(start, i + 1)) as Record<string, unknown>;
					} catch {
						return null;
					}
				}
			}
		}
		return null;
	}
}

function truncateRaw(raw: string, max = 1200): string {
	if (raw.length <= max) return raw;
	return `${raw.slice(0, max)}…`;
}

function parseOpenAiCompletion(json: unknown): {
	content: string;
	reasoning: string;
	finishReason?: string;
} {
	const root = json as {
		choices?: {
			message?: { content?: string; reasoning?: string };
			finish_reason?: string;
		}[];
	};
	const choice = root.choices?.[0];
	const message = choice?.message;
	return {
		content: message?.content?.trim() ?? "",
		reasoning: message?.reasoning?.trim() ?? "",
		finishReason: choice?.finish_reason,
	};
}

function parseOllamaNativeCompletion(json: unknown): {
	content: string;
	reasoning: string;
	finishReason?: string;
} {
	const root = json as {
		message?: { content?: string; thinking?: string };
		done_reason?: string;
	};
	return {
		content: root.message?.content?.trim() ?? "",
		reasoning: root.message?.thinking?.trim() ?? "",
		finishReason: root.done_reason,
	};
}

function contentFromParts(content: string, reasoning: string): {
	text: string;
	usedReasoningFallback: boolean;
} {
	if (content) return { text: content, usedReasoningFallback: false };
	const fromReasoning = extractJsonObject(reasoning);
	if (fromReasoning) return { text: reasoning, usedReasoningFallback: true };
	return { text: "", usedReasoningFallback: false };
}

export async function completeLocalJsonDetailed(
	modelId: string,
	messages: { role: "system" | "user"; content: string }[],
	schema: Record<string, unknown>,
	fetchImpl: typeof fetch = fetch,
): Promise<LocalJsonCompletion | null> {
	const config = effectiveLocalInferenceConfig();
	if (!config) return null;
	const opts = resolveLocalModelRequestOptions(modelId, config.manualModels);
	const schemaBody = opts.format ?? schema;
	const numPredict = opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : 2048;
	const think = opts.think ?? false;

	const nativeUrl = ollamaChatUrl(config.baseUrl);
	const nativeBody = {
		model: modelId,
		messages,
		stream: false,
		think,
		format: schemaBody,
		options: { num_predict: numPredict },
	};

	let rawJson: unknown;
	let parsedParts: ReturnType<typeof parseOllamaNativeCompletion>;

	const nativeRes = await fetchImpl(nativeUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(nativeBody),
	});
	if (nativeRes.status === 503) throw new LocalInferenceHttpError("GPU gate closed", 503);
	if (nativeRes.ok) {
		rawJson = await nativeRes.json();
		parsedParts = parseOllamaNativeCompletion(rawJson);
	} else {
		const apiKey = process.env[LOCAL_INFERENCE_API_KEY_ENV]?.trim();
		const openAiUrl = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
		const openAiBody: Record<string, unknown> = {
			model: modelId,
			messages,
			stream: false,
			max_tokens: numPredict,
			think,
			reasoning_effort: "none",
			response_format: {
				type: "json_schema",
				json_schema: { name: "practice_item", schema: schemaBody, strict: true },
			},
		};
		const openAiRes = await fetchImpl(openAiUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
			},
			body: JSON.stringify(openAiBody),
		});
		if (openAiRes.status === 503) throw new LocalInferenceHttpError("GPU gate closed", 503);
		if (!openAiRes.ok) return null;
		rawJson = await openAiRes.json();
		parsedParts = parseOpenAiCompletion(rawJson);
	}

	const { text, usedReasoningFallback } = contentFromParts(parsedParts.content, parsedParts.reasoning);
	const data = extractJsonObject(text);
	if (!data) {
		return {
			data: {},
			finishReason: parsedParts.finishReason,
			usedReasoningFallback,
			rawSnippet: truncateRaw(JSON.stringify(rawJson)),
		};
	}
	return {
		data,
		finishReason: parsedParts.finishReason,
		usedReasoningFallback,
		rawSnippet: truncateRaw(text || parsedParts.reasoning),
	};
}

export async function completeLocalJson(
	modelId: string,
	messages: { role: "system" | "user"; content: string }[],
	schema: Record<string, unknown>,
	fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown> | null> {
	const result = await completeLocalJsonDetailed(modelId, messages, schema, fetchImpl);
	if (!result) return null;
	const keys = Object.keys(result.data);
	if (!keys.length) return null;
	return result.data;
}

/** @internal test hook — last native request body from mocked fetch. */
export let lastOllamaNativeRequestBody: Record<string, unknown> | null = null;

export function resetOllamaNativeRequestCapture(): void {
	lastOllamaNativeRequestBody = null;
}

export async function completeLocalJsonDetailedForTest(
	modelId: string,
	messages: { role: "system" | "user"; content: string }[],
	schema: Record<string, unknown>,
	fetchImpl: typeof fetch,
): Promise<LocalJsonCompletion | null> {
	const wrapped: typeof fetch = async (input, init) => {
		const url = String(input);
		if (url.includes("/api/chat")) {
			lastOllamaNativeRequestBody = JSON.parse(String(init?.body));
		}
		return fetchImpl(input, init);
	};
	return completeLocalJsonDetailed(modelId, messages, schema, wrapped);
}
