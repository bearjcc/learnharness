import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PracticeSubject } from "../src/core/practice/contracts.ts";
import { facetForText, textOption } from "../src/core/practice/facets.ts";
import { termPickKind } from "../src/practice/kinds/term-pick.ts";
import { buildCheckContext } from "../src/server/practice/engine.ts";
import { defaultFsrsState } from "../src/core/practice/fsrs.ts";
import type { PracticeEntry } from "../src/core/practice/contracts.ts";

const latinSubject: PracticeSubject = {
	subjectId: "latin",
	title: "Latin",
	enabled: true,
	dailyCards: 10,
	itemKinds: ["term-pick"],
	sideLanguages: { front: "la", back: "en" },
};

function termEntry(id: string, front: string, back: string): PracticeEntry {
	return {
		subjectId: "latin",
		entryId: id,
		type: "term",
		front,
		back,
		status: "confirmed",
		origin: { kind: "manual" },
		fsrs: defaultFsrsState(),
	};
}

describe("practice option facets", () => {
	it("accepts a valid Latin term-pick (prompt la, options en)", () => {
		const entries = ["puella", "puer", "canis", "feles"].map((w, i) =>
			termEntry(`t${i}`, w, `meaning-${w}`),
		);
		const source = entries[0]!;
		const item = termPickKind.assemble(source, entries.slice(1), { prompt: "Pick the meaning." }, { subject: latinSubject });
		assert.ok(item);
		const check = termPickKind.check(item!, source, buildCheckContext(entries, latinSubject));
		assert.equal(check.ok, true);
	});

	it("rejects mixed Latin/English facets on options", () => {
		const entries = ["puella", "puer", "canis", "feles"].map((w, i) =>
			termEntry(`t${i}`, w, `meaning-${w}`),
		);
		const source = entries[0]!;
		const item = termPickKind.assemble(source, entries.slice(1), {}, { subject: latinSubject });
		assert.ok(item);
		const mixed = {
			...item!,
			options: item!.options.map((o, i) =>
				i === 1
					? textOption(o.id, source.front, "front", latinSubject)
					: o,
			),
		};
		const check = termPickKind.check(mixed, source, buildCheckContext(entries, latinSubject));
		assert.equal(check.ok, false);
		assert.ok(check.errors.some((e) => e.includes("facet") || e.includes("field") || e.includes("front")));
	});

	it("rejects options in the same language as the prompt on translation picks", () => {
		const entries = ["puella", "puer", "canis", "feles"].map((w, i) =>
			termEntry(`t${i}`, w, `meaning-${w}`),
		);
		const source = entries[0]!;
		const bad = {
			id: "card_x",
			kind: "term-pick",
			subjectId: "latin",
			entryId: source.entryId,
			correctOptionId: source.entryId,
			optionIds: entries.map((e) => e.entryId),
			prompt: [{ type: "text" as const, text: "What does puella mean?", facet: facetForText("front", latinSubject) }],
			options: entries.map((e) => textOption(e.entryId, e.back, "back", latinSubject)),
		};
		// All backs are English-coded; prompt is Latin — valid facets. Now make one option Latin-coded wrongly on prompt side:
		const mixedLang = {
			...bad,
			options: bad.options.map((o, i) =>
				i === 2 ? { ...o, facet: { field: "back" as const, valueKind: "text" as const, lang: "la" } } : o,
			),
		};
		const check = termPickKind.check(mixedLang, source, buildCheckContext(entries, latinSubject));
		assert.equal(check.ok, false);
		assert.ok(check.errors.some((e) => e.includes("facet")));
	});
});
