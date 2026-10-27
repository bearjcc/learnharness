import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	LOCAL_INFERENCE_PROVIDER_ID,
	mergeDiscoveredModels,
	normalizeLocalInferenceBaseUrl,
	ollamaTagsUrl,
	openAiModelsUrl,
	parseOllamaTags,
	parseOpenAiModelList,
	sanitizeLocalInferenceSettings,
} from "../src/core/local-inference.ts";
import {
	buildLocalInferenceModel,
	discoverLocalModels,
	ensureLocalInferenceProvider,
	registerLocalInferenceConfigReader,
} from "../src/agent/local-inference.ts";
import { createModels } from "@earendil-works/pi-ai";
import { providerKeyPresent } from "../src/server/keys.ts";
import { modelCatalog } from "../src/server/model-catalog.ts";
import { providerKeyMissing } from "../src/core/settings.ts";

describe("local inference URL helpers", () => {
	it("normalises host-only URLs to /v1", () => {
		assert.equal(normalizeLocalInferenceBaseUrl("http://127.0.0.1:11434"), "http://127.0.0.1:11434/v1");
		assert.equal(
			normalizeLocalInferenceBaseUrl("https://mint.example.ts.net:11434/"),
			"https://mint.example.ts.net:11434/v1",
		);
	});

	it("parses OpenAI and Ollama discovery payloads", () => {
		assert.deepEqual(parseOpenAiModelList({ data: [{ id: "llama3", name: "Llama 3" }] }), [
			{ id: "llama3", name: "Llama 3" },
		]);
		assert.deepEqual(parseOllamaTags({ models: [{ name: "qwen2.5:7b" }] }), [{ id: "qwen2.5:7b", name: "qwen2.5:7b" }]);
	});

	it("builds discovery URLs from the OpenAI root", () => {
		const base = "http://127.0.0.1:11434/v1";
		assert.equal(openAiModelsUrl(base), "http://127.0.0.1:11434/v1/models");
		assert.equal(ollamaTagsUrl(base), "http://127.0.0.1:11434/api/tags");
	});

	it("merges discovered and manual models without duplicates", () => {
		const merged = mergeDiscoveredModels(
			[{ id: "a", name: "A" }],
			[{ id: "b" }, { id: "a", name: "Manual A" }],
		);
		assert.deepEqual(merged, [{ id: "a", name: "A" }, { id: "b", name: "b" }]);
	});
});

describe("local inference provider wiring", () => {
	it("registers zero-cost openai-completions models when configured", () => {
		registerLocalInferenceConfigReader(() => ({
			baseUrl: "http://127.0.0.1:11434/v1",
			manualModels: [{ id: "test-model" }],
		}));
		const models = createModels();
		ensureLocalInferenceProvider(models);
		const model = models.getModel(LOCAL_INFERENCE_PROVIDER_ID, "test-model");
		assert.ok(model);
		assert.equal(model!.api, "openai-completions");
		assert.deepEqual(model!.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
		assert.equal(buildLocalInferenceModel("http://x/v1", "m", "M").provider, LOCAL_INFERENCE_PROVIDER_ID);
		registerLocalInferenceConfigReader(() => null);
	});

	it("discovers models via fetch without network when injected", async () => {
		const fakeFetch: typeof fetch = async (input) => {
			const url = String(input);
			if (url.endsWith("/models")) {
				return new Response(JSON.stringify({ data: [{ id: "from-openai" }] }), { status: 200 });
			}
			return new Response("{}", { status: 404 });
		};
		const found = await discoverLocalModels("http://127.0.0.1:11434/v1", undefined, fakeFetch);
		assert.deepEqual(found, [{ id: "from-openai", name: undefined }]);
	});

	it("treats a configured base URL as provider-present for gates", () => {
		process.env.LH_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
		registerLocalInferenceConfigReader(() => ({
			baseUrl: "http://127.0.0.1:11434/v1",
			manualModels: [{ id: "m" }],
		}));
		ensureLocalInferenceProvider(createModels());
		assert.equal(providerKeyPresent(LOCAL_INFERENCE_PROVIDER_ID), true);
		const refusal = providerKeyMissing(LOCAL_INFERENCE_PROVIDER_ID, ["strong"]);
		assert.match(refusal.error, /base URL/i);
		delete process.env.LH_OLLAMA_BASE_URL;
		registerLocalInferenceConfigReader(() => null);
	});

	it("federates manual models into the catalog when configured", () => {
		registerLocalInferenceConfigReader(() => ({
			baseUrl: "http://127.0.0.1:11434/v1",
			manualModels: [{ id: "only-local" }],
		}));
		ensureLocalInferenceProvider(createModels());
		const row = modelCatalog().models.find((m) => m.provider === LOCAL_INFERENCE_PROVIDER_ID);
		assert.ok(row, "local model listed");
		assert.equal(row!.cost.input, 0);
		registerLocalInferenceConfigReader(() => null);
	});
});

describe("local inference settings sanitiser", () => {
	it("drops invalid base URLs and keeps manual ids", () => {
		const section = sanitizeLocalInferenceSettings({
			baseUrl: "not a url",
			manualModels: [{ id: "  ok  " }, { id: "" }],
		});
		assert.equal(section.baseUrl, undefined);
		assert.deepEqual(section.manualModels, [{ id: "ok" }]);
	});
});
