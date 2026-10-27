import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { quoteAppearsInChunks, parseJudgeYesNo } from "../src/core/practice/sources/verify.ts";
import { retrievePassages } from "../src/server/practice/sources/retrieve.ts";
import { writeSourceCache } from "../src/store/practice-sources.ts";
import { penalizeSource, trustForSource } from "../src/server/practice/sources/trust.ts";
import { mergeSubjectPresets } from "../src/server/practice/subject-presets.ts";
import { ensureSubjectSourcesCached } from "../src/server/practice/sources/ingest.ts";
import { recordAnswer } from "../src/server/practice/service.ts";
import { practiceStore } from "../src/store/practice.ts";
import { PRACTICE_FILES } from "../config.ts";

describe("sourced quiz", () => {
	const prevData = process.env.LH_DATA_DIR;
	let tmp: string;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-sourced-"));
		process.env.LH_DATA_DIR = tmp;
		fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
		fs.writeFileSync(PRACTICE_FILES.subjects, "[]");
		fs.writeFileSync(PRACTICE_FILES.entries, "");
		fs.writeFileSync(PRACTICE_FILES.answerEvents, "");
		fs.writeFileSync(PRACTICE_FILES.entryDecisions, "");
		fs.writeFileSync(PRACTICE_FILES.flagEvents, "");
		writeSourceCache({ chunks: [] });
	});

	afterEach(() => {
		if (prevData === undefined) delete process.env.LH_DATA_DIR;
		else process.env.LH_DATA_DIR = prevData;
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it("rejects fabricated quotes not present in cached chunks", () => {
		const corpus = [{ text: "The capital of Fiji is Suva." }];
		assert.equal(quoteAppearsInChunks("completely made up", corpus), false);
		assert.equal(quoteAppearsInChunks("capital of Fiji is Suva", corpus), true);
	});

	it("parseJudgeYesNo handles yes/no", () => {
		assert.equal(parseJudgeYesNo("yes"), true);
		assert.equal(parseJudgeYesNo("no"), false);
	});

	it("rejects when quote matches but judge says no", () => {
		const corpus = [{ text: "Suva is the capital of Fiji." }];
		const quote = "Suva is the capital of Fiji.";
		assert.equal(quoteAppearsInChunks(quote, corpus), true);
		assert.equal(parseJudgeYesNo("no"), false);
	});

	it("retrieves from cache with network disabled", async () => {
		writeSourceCache({
			chunks: [
				{
					id: "w:0",
					sourceId: "flags-wiki",
					url: "https://en.wikipedia.org/wiki/Fiji",
					text: "Fiji is an island country in Melanesia.",
					fetchedAt: new Date().toISOString(),
				},
			],
		});
		const sources = [{ kind: "wikipedia" as const, id: "flags-wiki", pages: ["Fiji"] }];
		await ensureSubjectSourcesCached(sources, fetch, { offline: true });
		const hits = retrievePassages("Fiji island", sources, 3);
		assert.ok(hits.some((h) => h.text.includes("Melanesia")));
	});

	it("flag retires entry and lowers source trust", () => {
		const sourceId = "flags-wiki";
		practiceStore.writeSubjects([
			{
				subjectId: "flags",
				title: "Flags",
				enabled: true,
				dailyCards: 5,
				itemKinds: ["label-pick"],
				dailyQueueDate: "2099-01-01",
				dailyQueue: [
					{
						id: "card-1",
						kind: "label-pick",
						subjectId: "flags",
						entryId: "flag_FJI",
						correctOptionId: "flag_FJI",
						optionIds: ["flag_FJI", "a", "b", "c"],
						prompt: [{ type: "text", text: "?" }],
						options: [
							{ id: "flag_FJI", type: "text", text: "Fiji" },
							{ id: "a", type: "text", text: "X" },
							{ id: "b", type: "text", text: "Y" },
							{ id: "c", type: "text", text: "Z" },
						],
						citationSourceId: sourceId,
					},
				],
			},
		]);
		practiceStore.writeEntries([
			{
				subjectId: "flags",
				entryId: "flag_FJI",
				type: "visual",
				front: "Fiji",
				back: "Fiji",
				origin: { kind: "import" },
				status: "confirmed",
			},
		]);
		const before = trustForSource(sourceId);
		const out = recordAnswer({
			event_id: "evt-flag-1",
			card_id: "card-1",
			subject: "flags",
			flag: "bad",
		});
		assert.equal(out.ok, true);
		const entry = practiceStore.readEntries().find((e) => e.entryId === "flag_FJI");
		assert.equal(entry?.status, "retired");
		assert.ok(trustForSource(sourceId) < before);
	});

	it("includes flags preset with flag media variant", () => {
		const merged = mergeSubjectPresets([]);
		const flags = merged.find((s) => s.subjectId === "flags");
		assert.ok(flags);
		assert.deepEqual(flags!.mediaVariants?.enabled, ["flag"]);
		assert.ok(flags!.sources?.length);
	});
});
