/**
 * Local OpenAI-compatible inference (Ollama, vLLM, etc.) — pure types and
 * parsing helpers. Browser-safe; no fs or network.
 */

/** pi-ai provider id for local OpenAI-compatible servers (Ollama uses this). */
export const LOCAL_INFERENCE_PROVIDER_ID = "ollama";

export const LOCAL_INFERENCE_BASE_URL_ENV = "LH_OLLAMA_BASE_URL";
export const LOCAL_INFERENCE_API_KEY_ENV = "LH_OLLAMA_API_KEY";

export const LOCAL_INFERENCE_LABEL = "Ollama";

/** JSON Schema object sent as OpenAI-style response_format (Ollama /v1). */
export type LocalInferenceJsonSchema = Record<string, unknown>;

/** One manually entered model when discovery is unavailable. */
export interface LocalInferenceManualModel {
	id: string;
	name?: string;
	/** Ollama: disable thinking so the model returns content (default false when unset). */
	think?: boolean;
	maxTokens?: number;
	format?: LocalInferenceJsonSchema;
}

/** Per-request overrides resolved for a configured model id. */
export interface LocalInferenceModelRequestOptions {
	think?: boolean;
	maxTokens?: number;
	format?: LocalInferenceJsonSchema;
}

/** Persisted non-secret options (settings.json `localInference` section). */
export interface LocalInferenceSettings {
	baseUrl?: string;
	manualModels?: LocalInferenceManualModel[];
}

/** Client-safe status for GET /api/local-inference. */
export interface LocalInferenceStatus {
	providerId: typeof LOCAL_INFERENCE_PROVIDER_ID;
	configured: boolean;
	baseUrl: string | null;
	baseUrlSource: "env" | "settings" | "none";
	apiKeyPresent: boolean;
	manualModels: LocalInferenceManualModel[];
	lastRefreshError: string | null;
	discoveredModelCount: number;
}

const TRAILING_SLASH = /\/+$/;

/** Normalise a user-pasted base URL to the OpenAI API root (…/v1). */
export function normalizeLocalInferenceBaseUrl(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	try {
		const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
		if (url.protocol !== "http:" && url.protocol !== "https:") return null;
		let path = url.pathname.replace(TRAILING_SLASH, "");
		if (path.endsWith("/v1")) {
			// already the completions root
		} else if (path === "" || path === "/") {
			path = "/v1";
		} else if (!path.endsWith("/v1")) {
			path = `${path}/v1`;
		}
		url.pathname = path;
		url.search = "";
		url.hash = "";
		return url.toString().replace(TRAILING_SLASH, "");
	} catch {
		return null;
	}
}

/** Strip `/v1` from an OpenAI-compatible base URL. */
export function ollamaApiRoot(openAiV1Base: string): string {
	const url = new URL(openAiV1Base);
	const path = url.pathname.replace(TRAILING_SLASH, "").replace(/\/v1$/, "") || "";
	url.pathname = path || "/";
	url.search = "";
	url.hash = "";
	return url.toString().replace(TRAILING_SLASH, "");
}

/** Derive the Ollama native API root (without /v1) for /api/tags. */
export function ollamaTagsUrl(openAiV1Base: string): string {
	const url = new URL(ollamaApiRoot(openAiV1Base));
	url.pathname = `${url.pathname.replace(TRAILING_SLASH, "")}/api/tags`;
	return url.toString();
}

/** Ollama native chat endpoint (supports `think` + `format` JSON schema). */
export function ollamaChatUrl(openAiV1Base: string): string {
	const url = new URL(ollamaApiRoot(openAiV1Base));
	url.pathname = `${url.pathname.replace(TRAILING_SLASH, "")}/api/chat`;
	return url.toString();
}

export function openAiModelsUrl(openAiV1Base: string): string {
	const base = openAiV1Base.replace(TRAILING_SLASH, "");
	return `${base}/models`;
}

export function parseOpenAiModelList(payload: unknown): { id: string; name?: string }[] {
	if (!payload || typeof payload !== "object") return [];
	const data = (payload as { data?: unknown }).data;
	if (!Array.isArray(data)) return [];
	const out: { id: string; name?: string }[] = [];
	for (const entry of data) {
		if (!entry || typeof entry !== "object") continue;
		const id = (entry as { id?: unknown }).id;
		if (typeof id !== "string" || !id.trim()) continue;
		const name = (entry as { name?: unknown }).name;
		out.push({ id, name: typeof name === "string" && name.trim() ? name : undefined });
	}
	return out;
}

export function parseOllamaTags(payload: unknown): { id: string; name?: string }[] {
	if (!payload || typeof payload !== "object") return [];
	const models = (payload as { models?: unknown }).models;
	if (!Array.isArray(models)) return [];
	const out: { id: string; name?: string }[] = [];
	for (const entry of models) {
		if (!entry || typeof entry !== "object") continue;
		const name = (entry as { name?: unknown }).name;
		if (typeof name !== "string" || !name.trim()) continue;
		out.push({ id: name, name });
	}
	return out;
}

export function mergeDiscoveredModels(
	discovered: readonly { id: string; name?: string }[],
	manual: readonly LocalInferenceManualModel[],
): { id: string; name: string }[] {
	const byId = new Map<string, string>();
	for (const m of discovered) {
		byId.set(m.id, m.name?.trim() || m.id);
	}
	for (const m of manual) {
		const id = m.id.trim();
		if (!id) continue;
		if (!byId.has(id)) byId.set(id, m.name?.trim() || id);
	}
	return [...byId.entries()]
		.map(([id, name]) => ({ id, name }))
		.sort((a, b) => a.id.localeCompare(b.id));
}

/** Optional reverse-proxy token — looser than cloud API keys. */
export function localInferenceApiKeyGuard(id: string, rawValue: string): { ok: true } | { ok: false; error: string } {
	const value = rawValue.trim();
	if (value.length >= 1 && !/\s/.test(value)) return { ok: true };
	return { ok: false, error: `${id} must be non-empty with no whitespace` };
}

/** Effective runtime config from env (wins) and settings file section. */
export function resolveLocalInferenceRuntimeConfig(
	envBaseUrl: string | undefined,
	settings: LocalInferenceSettings,
): { baseUrl: string; manualModels: LocalInferenceManualModel[] } | null {
	const fromEnv = envBaseUrl ? normalizeLocalInferenceBaseUrl(envBaseUrl) : null;
	const fromSettings = settings.baseUrl ?? null;
	const baseUrl = fromEnv ?? fromSettings;
	if (!baseUrl) return null;
	return { baseUrl, manualModels: settings.manualModels ?? [] };
}

export function sanitizeLocalInferenceSettings(raw: unknown): LocalInferenceSettings {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	const record = raw as Record<string, unknown>;
	const out: LocalInferenceSettings = {};
	if (typeof record.baseUrl === "string") {
		const normalised = normalizeLocalInferenceBaseUrl(record.baseUrl);
		if (normalised) out.baseUrl = normalised;
	}
	if (Array.isArray(record.manualModels)) {
		const manual: LocalInferenceManualModel[] = [];
		for (const entry of record.manualModels) {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
			const id = (entry as { id?: unknown }).id;
			if (typeof id !== "string" || !id.trim()) continue;
			const name = (entry as { name?: unknown }).name;
			const think = (entry as { think?: unknown }).think;
			const maxTokens = (entry as { maxTokens?: unknown }).maxTokens;
			const format = (entry as { format?: unknown }).format;
			manual.push({
				id: id.trim(),
				...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
				...(typeof think === "boolean" ? { think } : {}),
				...(typeof maxTokens === "number" && Number.isFinite(maxTokens) && maxTokens > 0
					? { maxTokens: Math.floor(maxTokens) }
					: {}),
				...(format && typeof format === "object" && !Array.isArray(format)
					? { format: format as LocalInferenceJsonSchema }
					: {}),
			});
		}
		if (manual.length) out.manualModels = manual;
	}
	return out;
}

export function resolveLocalModelRequestOptions(
	modelId: string,
	manualModels: readonly LocalInferenceManualModel[],
): LocalInferenceModelRequestOptions {
	const row = manualModels.find((m) => m.id === modelId);
	if (!row) return { think: false };
	return {
		think: row.think ?? false,
		...(row.maxTokens !== undefined ? { maxTokens: row.maxTokens } : {}),
		...(row.format !== undefined ? { format: row.format } : {}),
	};
}
