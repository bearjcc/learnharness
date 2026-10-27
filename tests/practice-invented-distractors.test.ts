import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PracticeEntry, PracticeSubject } from "../src/core/practice/contracts.ts";
import { defaultFsrsState } from "../src/core/practice/fsrs.ts";
import {
	cosineSimilarity,
	validateInventedText,
	type EmbedFn,
} from "../src/core/practice/invented-distractors.ts";
import { inventedTextOption } from "../src/practice/kinds/option-build.ts";
import { termPickKind } from "../src/practice/kinds/term-pick.ts";
import { buildCheckContext } from "../src/server/practice/engine.ts";

const latinSubject: PracticeSubject = {
	subjectId: "latin",
	title: "Latin",
	enabled: true,
	dailyCards: 10,
	itemKinds: ["term-pick"],
	sideLanguages: { front: "la", back: "en" },
	distractors: { fromEntries: 1, invented: 2 },
	embeddingMaxSimilarity: 0.85,
};

function term(id: string, front: string, back: string, aliases?: string[]): PracticeEntry {
	return {
		subjectId: "latin",
		entryId: id,
		type: "term",
		front,
		back,
		aliases,
		status: "confirmed",
		origin: { kind: "manual" },
		fsrs: defaultFsrsState(),
	};
}

describe("invented distractor safety", () => {
	const source = term("t1", "carpe diem", "seize the day", ["enjoy the day"]);
	const pool = [
		source,
		term("t2", "veni", "I came"),
		term("t3", "vidi", "I saw"),
		term("t4", "vici", "I conquered"),
	];

	it("rejects invented text that equals an alias", async () => {
		const errors = await validateInventedText("enjoy the day", source, "term-pick", pool, latinSubject, undefined);
		assert.ok(errors.length > 0);
	});

	it("rejects near-synonym above embedding threshold", async () => {
		const stub: EmbedFn = async (texts) =>
			texts.map((t) => (t.toLowerCase().includes("seize") ? [1, 0, 0] : [0.2, 0.9, 0.1]));
		const errors = await validateInventedText("seize today", source, "term-pick", pool, latinSubject, stub);
		assert.ok(errors.some((e) => e.includes("embedding")));
		assert.ok(cosineSimilarity([1, 0, 0], [0.2, 0.9, 0.1]) < 0.85);
	});

	it("accepts clearly wrong invented text like '10 fish'", async () => {
		const stub: EmbedFn = async (texts) =>
			texts.map((t) => (t.includes("fish") ? [0, 0, 1] : [1, 0, 0]));
		const errors = await validateInventedText("10 fish", source, "term-pick", pool, latinSubject, stub);
		assert.equal(errors.length, 0);
	});

	it("tags invented options and passes checker when valid", async () => {
		const invented = inventedTextOption("10 fish", "back", latinSubject);
		assert.equal(invented.source, "invented");
		const item = termPickKind.assemble(
			source,
			pool.slice(1, 2),
			{ inventedDistractors: ["10 fish", "purple Tuesday"] },
			{
				subject: latinSubject,
				inventedDistractors: ["10 fish", "purple Tuesday"],
				confirmedPool: pool,
				shuffleSeed: "test",
				embed: async () => null,
			},
		);
		assert.ok(item);
		const inventedCount = item!.options.filter((o) => o.source === "invented").length;
		assert.equal(inventedCount, 2);
		const check = await termPickKind.checkAsync!(
			item!,
			source,
			buildCheckContext(pool, latinSubject),
			{ confirmedPool: pool, embed: async () => null },
		);
		assert.equal(check.ok, true);
	});
});
