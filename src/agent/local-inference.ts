/**
 * Local OpenAI-compatible provider wiring (Ollama, etc.) — registers a
 * dynamic pi-ai provider when a base URL is configured. Reads config through
 * a server-injected reader (settings + env); the agent layer never imports
 * the store.
 */

import { createProvider, type Model, type Models, type MutableModels } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import {
	LOCAL_INFERENCE_API_KEY_ENV,
	LOCAL_INFERENCE_PROVIDER_ID,
	type LocalInferenceManualModel,
	mergeDiscoveredModels,
	normalizeLocalInferenceBaseUrl,
	ollamaTagsUrl,
	openAiModelsUrl,
	parseOllamaTags,
	parseOpenAiModelList,
} from "../core/local-inference.ts";

export interface LocalInferenceRuntimeConfig {
	baseUrl: string;
	manualModels: LocalInferenceManualModel[];
}

type ConfigReader = () => LocalInferenceRuntimeConfig | null;

const READER_KEY = Symbol.for("lh.localInference.configReader");
const STATE_KEY = Symbol.for("lh.localInference.state");

interface LocalInferenceState {
	signature: string | null;
	lastRefreshError: string | null;
	discoveredCount: number;
}

function state(): LocalInferenceState {
	const g = globalThis as typeof globalThis & { [STATE_KEY]?: LocalInferenceState };
	if (!g[STATE_KEY]) {
		g[STATE_KEY] = { signature: null, lastRefreshError: null, discoveredCount: 0 };
	}
	return g[STATE_KEY]!;
}

/** Server composition root registers how config is resolved (env + settings). */
export function registerLocalInferenceConfigReader(reader: ConfigReader): void {
	(globalThis as Record<symbol, ConfigReader>)[READER_KEY] = reader;
}

function readConfig(): LocalInferenceRuntimeConfig | null {
	const reader = (globalThis as Record<symbol, ConfigReader | undefined>)[READER_KEY];
	return reader?.() ?? null;
}

export function localInferenceApiKey(): string | undefined {
	return process.env[LOCAL_INFERENCE_API_KEY_ENV]?.trim() || undefined;
}

export function localInferenceConfigured(): boolean {
	return readConfig() !== null;
}

export function localInferenceLastRefreshError(): string | null {
	return state().lastRefreshError;
}

export function localInferenceDiscoveredModelCount(): number {
	return state().discoveredCount;
}

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export function buildLocalInferenceModel(
	baseUrl: string,
	id: string,
	name: string,
): Model<"openai-completions"> {
	return {
		id,
		name,
		api: "openai-completions",
		provider: LOCAL_INFERENCE_PROVIDER_ID,
		baseUrl,
		reasoning: false,
		input: ["text"],
		cost: ZERO_COST,
		contextWindow: 128_000,
		maxTokens: 32_000,
		compat: {
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
		},
	};
}

/** Fetch model ids from /v1/models and /api/tags (Ollama). Exported for tests. */
export async function discoverLocalModels(
	baseUrl: string,
	signal?: AbortSignal,
	fetchImpl: typeof fetch = fetch,
): Promise<{ id: string; name?: string }[]> {
	const headers: Record<string, string> = { Accept: "application/json" };
	const apiKey = localInferenceApiKey();
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

	const openAi = await fetchImpl(openAiModelsUrl(baseUrl), { headers, signal }).catch(() => null);
	if (openAi?.ok) {
		const json = await openAi.json().catch(() => null);
		const models = parseOpenAiModelList(json);
		if (models.length) return models;
	}

	const tags = await fetchImpl(ollamaTagsUrl(baseUrl), { headers, signal }).catch(() => null);
	if (tags?.ok) {
		const json = await tags.json().catch(() => null);
		return parseOllamaTags(json);
	}
	return [];
}

function configSignature(config: LocalInferenceRuntimeConfig): string {
	return JSON.stringify({
		baseUrl: config.baseUrl,
		manual: config.manualModels,
		key: localInferenceApiKey() ?? "",
	});
}

function toProviderModels(
	baseUrl: string,
	merged: readonly { id: string; name: string }[],
): Model<"openai-completions">[] {
	return merged.map((m) => buildLocalInferenceModel(baseUrl, m.id, m.name));
}

/** Upsert or remove the dynamic provider on the shared Models collection. */
export function ensureLocalInferenceProvider(models: Models): void {
	const config = readConfig();
	const mutable = models as MutableModels;
	const sig = config ? configSignature(config) : null;
	if (!config) {
		state().signature = null;
		state().lastRefreshError = null;
		state().discoveredCount = 0;
		mutable.deleteProvider(LOCAL_INFERENCE_PROVIDER_ID);
		return;
	}
	if (state().signature === sig && models.getProvider(LOCAL_INFERENCE_PROVIDER_ID)) return;

	const baseUrl = normalizeLocalInferenceBaseUrl(config.baseUrl);
	if (!baseUrl) return;

	const provider = createProvider({
		id: LOCAL_INFERENCE_PROVIDER_ID,
		name: "Ollama",
		baseUrl,
		auth: {
			apiKey: {
				name: "Ollama API key",
				resolve: async () => {
					const key = localInferenceApiKey();
					return key ? { auth: { apiKey: key } } : { auth: {} };
				},
			},
		},
		models: toProviderModels(baseUrl, mergeDiscoveredModels([], config.manualModels)),
		fetchModels: async ({ signal }) => {
			try {
				const discovered = await discoverLocalModels(baseUrl, signal);
				state().discoveredCount = discovered.length;
				state().lastRefreshError = null;
				return toProviderModels(
					baseUrl,
					mergeDiscoveredModels(discovered, config.manualModels),
				);
			} catch (err) {
				state().lastRefreshError = err instanceof Error ? err.message : "Model discovery failed";
				state().discoveredCount = 0;
				return toProviderModels(
					baseUrl,
					mergeDiscoveredModels([], config.manualModels),
				);
			}
		},
		api: openAICompletionsApi(),
	});

	mutable.setProvider(provider);
	state().signature = sig;
}

export async function refreshLocalInferenceModels(models: Models): Promise<void> {
	ensureLocalInferenceProvider(models);
	if (!readConfig()) return;
	try {
		await models.refresh({ providers: [LOCAL_INFERENCE_PROVIDER_ID] });
	} catch (err) {
		state().lastRefreshError = err instanceof Error ? err.message : "Refresh failed";
	}
}

export function localInferenceModel(models: Models, id: string): Model<"openai-completions"> | undefined {
	return models.getModel(LOCAL_INFERENCE_PROVIDER_ID, id) as Model<"openai-completions"> | undefined;
}
