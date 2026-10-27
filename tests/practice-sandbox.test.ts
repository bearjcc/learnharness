import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PRACTICE_FILES, PATHS } from "../config.ts";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-sandbox-"));
process.env.LH_DATA_DIR = TMP;

import { practiceStore } from "../src/store/practice.ts";
import { listTodayCards, recordAnswer } from "../src/server/practice/service.ts";
import { loadDemoDeck } from "../src/practice/demo/load.ts";
import { applyFsrsReview, defaultFsrsState } from "../src/core/practice/fsrs.ts";

beforeEach(() => {
	fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
	fs.writeFileSync(PRACTICE_FILES.subjects, "[]\n");
	fs.writeFileSync(PRACTICE_FILES.entries, "");
	fs.writeFileSync(PRACTICE_FILES.answerEvents, "");
	fs.writeFileSync(PRACTICE_FILES.entryDecisions, "");
});

describe("sandbox demo deck", () => {
	it("returns the full deck on every today fetch", () => {
		const cards = listTodayCards("demo");
		const deck = loadDemoDeck();
		assert.equal(cards.length, deck.length);
		assert.equal(cards.length, listTodayCards("demo").length);
		assert.ok(cards.some((c) => c.options.length === 2));
		assert.ok(cards.some((c) => c.options.length === 6));
		assert.ok(cards.some((c) => c.explain));
	});

	it("does not persist FSRS, answer events, or graph on answers", () => {
		practiceStore.writeEntries([
			{
				subjectId: "latin",
				entryId: "e1",
				type: "term",
				front: "a",
				back: "b",
				status: "confirmed",
				origin: { kind: "manual" },
				fsrs: defaultFsrsState(),
			},
		]);
		const beforeAnswers = practiceStore.readAnswerEvents().length;
		const beforeFsrs = practiceStore.readEntries()[0]!.fsrs!.reps;
		const graphFile = path.join(PATHS.graph, "nodes.jsonl");
		const graphBefore = fs.existsSync(graphFile) ? fs.readFileSync(graphFile, "utf-8") : "";

		const card = listTodayCards("demo")[0]!;
		const wrong = recordAnswer({
			event_id: "ev_sandbox_1",
			card_id: card.id,
			subject: "demo",
			picked: card.options[1]?.id,
			correct: false,
		});
		assert.equal(wrong.sandbox, true);
		assert.equal(wrong.correct, false);

		const right = recordAnswer({
			event_id: "ev_sandbox_2",
			card_id: card.id,
			subject: "demo",
			picked: card.answer,
			correct: true,
		});
		assert.equal(right.correct, true);

		const undo = recordAnswer({
			event_id: "ev_sandbox_3",
			card_id: card.id,
			subject: "demo",
			undo: true,
		});
		assert.equal(undo.undo, true);

		assert.equal(practiceStore.readAnswerEvents().length, beforeAnswers);
		assert.equal(practiceStore.readEntries()[0]!.fsrs!.reps, beforeFsrs);
		const graphAfter = fs.existsSync(graphFile) ? fs.readFileSync(graphFile, "utf-8") : "";
		assert.equal(graphAfter, graphBefore);

		// FSRS helper unchanged when not invoked via sandbox path
		const updated = applyFsrsReview(practiceStore.readEntries()[0]!, true);
		assert.ok(updated.reps >= beforeFsrs + 1);
	});
});
