import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	completeLocalJsonDetailedForTest,
	extractJsonObject,
	resetOllamaNativeRequestCapture,
	lastOllamaNativeRequestBody,
} from "../src/server/practice/local-json.ts";
import { PRACTICE_FILES } from "../config.ts";

describe("Ollama local JSON completion", () => {
	const prevBase = process.env.LH_OLLAMA_BASE_URL;
	const prevData = process.env.LH_DATA_DIR;

	beforeEach(() => {
		const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-ollama-"));
		process.env.LH_DATA_DIR = tmp;
		fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
		process.env.LH_OLLAMA_BASE_URL = "http://127.0.0.1:11436/v1";
		resetOllamaNativeRequestCapture();
	});

	afterEach(() => {
		if (prevBase === undefined) delete process.env.LH_OLLAMA_BASE_URL;
		else process.env.LH_OLLAMA_BASE_URL = prevBase;
		if (prevData === undefined) delete process.env.LH_DATA_DIR;
		else process.env.LH_DATA_DIR = prevData;
	});

	it("calls native /api/chat with think:false and format schema", async () => {
		const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };
		const fakeFetch: typeof fetch = async (input) => {
			const url = String(input);
			assert.match(url, /\/api\/chat$/);
			return new Response(
				JSON.stringify({ message: { content: JSON.stringify({ ok: true }) }, done_reason: "stop" }),
				{ status: 200 },
			);
		};
		const out = await completeLocalJsonDetailedForTest(
			"kenai",
			[{ role: "user", content: "hi" }],
			schema,
			fakeFetch,
		);
		assert.equal(out?.data.ok, true);
		assert.equal(lastOllamaNativeRequestBody?.think, false);
		assert.ok(lastOllamaNativeRequestBody?.format);
	});

	it("extracts JSON from reasoning when content is empty", () => {
		const reasoning = 'Some preamble {"prompt":"q","answer":"a","citation":{"sourceId":"s","quote":"x"}} tail';
		const obj = extractJsonObject(reasoning);
		assert.equal(obj?.answer, "a");
	});

	it("surfaces writer_truncated via finish_reason length", async () => {
		const schema = { type: "object", properties: { x: { type: "string" } }, required: ["x"] };
		const fakeFetch: typeof fetch = async () =>
			new Response(JSON.stringify({ message: { content: "" }, done_reason: "length" }), { status: 200 });
		const out = await completeLocalJsonDetailedForTest("m", [{ role: "user", content: "x" }], schema, fakeFetch);
		assert.equal(out?.finishReason, "length");
		assert.equal(Object.keys(out?.data ?? {}).length, 0);
	});
});
