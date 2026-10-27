import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-practice-"));
process.env.LH_DATA_DIR = TMP;
process.env.LH_PRACTICE_SKIP_LLM = "1";
import { selectDistractors } from "../src/core/practice/distractors.ts";
import { applyFsrsReview, defaultFsrsState, fsrsDue } from "../src/core/practice/fsrs.ts";
import { mixedCardStack, dailyItemToPickCard } from "../src/core/practice/cards.ts";
import { parseGrooveGrid, renderGrooveSvg } from "../src/core/practice/groove.ts";
import type { PracticeEntry, PracticeDailyItem } from "../src/core/practice/contracts.ts";
import { imagePickKind } from "../src/practice/kinds/image-pick.ts";
import { labelPickKind } from "../src/practice/kinds/label-pick.ts";
import { termPickKind } from "../src/practice/kinds/term-pick.ts";
import { resolveCommonsImage } from "../src/practice/wikimedia.ts";
import { practiceStore } from "../src/store/practice.ts";
import { PRACTICE_FILES } from "../config.ts";
import {
	recordAnswer,
	decideEntry,
	importEntries,
} from "../src/server/practice/service.ts";
import { buildCheckContext } from "../src/server/practice/engine.ts";

beforeEach(() => {
	fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
	fs.writeFileSync(PRACTICE_FILES.subjects, "[]");
	fs.writeFileSync(PRACTICE_FILES.entries, "");
	fs.writeFileSync(PRACTICE_FILES.answerEvents, "");
	fs.writeFileSync(PRACTICE_FILES.entryDecisions, "");
});

afterEach(() => {
	delete process.env.LH_PRACTICE_SKIP_LLM;
});

function entry(partial: Partial<PracticeEntry> & Pick<PracticeEntry, "entryId" | "subjectId" | "type" | "front" | "back">): PracticeEntry {
	return {
		status: "confirmed",
		origin: { kind: "manual" },
		fsrs: defaultFsrsState(),
		...partial,
	};
}

describe("practice distractors", () => {
	it("prefers shared tags", () => {
		const source = entry({
			subjectId: "s",
			entryId: "a",
			type: "term",
			front: "a",
			back: "1",
			tags: ["drums", "rock"],
		});
		const pool = [
			source,
			entry({ subjectId: "s", entryId: "b", type: "term", front: "b", back: "2", tags: ["drums"] }),
			entry({ subjectId: "s", entryId: "c", type: "term", front: "c", back: "3", tags: ["jazz"] }),
			entry({ subjectId: "s", entryId: "d", type: "term", front: "d", back: "4", tags: ["drums", "rock"] }),
			entry({ subjectId: "s", entryId: "e", type: "term", front: "e", back: "5", tags: [] }),
		];
		const picks = selectDistractors(source, pool, 3);
		assert.equal(picks.length, 3);
		assert.ok(picks.some((p) => p.entryId === "d"));
	});
});

describe("practice FSRS", () => {
	it("updates on review", () => {
		const e = entry({ subjectId: "s", entryId: "x", type: "term", front: "f", back: "b" });
		const next = applyFsrsReview(e, true);
		assert.ok(next.reps >= 1);
	});
});

describe("mixed stack", () => {
	it("groups about five per subject", () => {
		const mk = (subjectId: string, n: number) =>
			Array.from({ length: n }, (_, i) => ({
				id: `${subjectId}_${i}`,
				kind: "term-pick",
				subjectId,
				entryId: `e${i}`,
				correctOptionId: "e0",
				optionIds: [],
				prompt: [{ type: "text" as const, text: "q" }],
				options: [],
			}));
		const map = new Map<string, PracticeDailyItem[]>([
			["a", mk("a", 7)],
			["b", mk("b", 3)],
		]);
		const stack = mixedCardStack(map, 5);
		assert.equal(stack.filter((c) => c.subjectId === "a").length, 7);
		assert.equal(stack.filter((c) => c.subjectId === "b").length, 3);
	});
});

describe("groove SVG", () => {
	it("renders a grid", () => {
		const grid = parseGrooveGrid(
			JSON.stringify({ stepsPerBar: 4, bars: 1, instruments: { kick: [[true, false, false, false]] } }),
		);
		assert.ok(grid);
		const svg = renderGrooveSvg(grid!);
		assert.match(svg, /<svg/);
	});
});

describe("image-pick check", () => {
	it("requires four distinct local images", () => {
		practiceStore.writeMedia("img1.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("img2.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("img3.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("img4.svg", Buffer.from("<svg/>"));
		const entries = ["e1", "e2", "e3", "e4"].map((id, i) =>
			entry({
				subjectId: "geo",
				entryId: id,
				type: "visual",
				front: id,
				back: id,
				media: { kind: "svg", ref: `img${i + 1}.svg` },
			}),
		);
		const source = entries[0]!;
		const item = imagePickKind.assemble(source, entries.slice(1), { prompt: "Pick" });
		assert.ok(item);
		const check = imagePickKind.check(item!, source, buildCheckContext(entries));
		assert.equal(check.ok, true);
	});
});

describe("label-pick", () => {
	it("uses image prompt and text options", () => {
		practiceStore.writeMedia("u.svg", Buffer.from("<svg/>"));
		const entries = ["a", "b", "c", "d"].map((id) =>
			entry({
				subjectId: "geo",
				entryId: id,
				type: "visual",
				front: `Label ${id}`,
				back: id,
				media: { kind: "svg", ref: "u.svg" },
			}),
		);
		for (let i = 1; i < 4; i++) {
			const ref = `img${i + 1}.svg`;
			entries[i]!.media = { kind: "svg", ref };
			practiceStore.writeMedia(ref, Buffer.from("<svg/>"));
		}
		practiceStore.writeMedia("u.svg", Buffer.from("<svg/>"));
		const item = labelPickKind.assemble(entries[0]!, entries.slice(1));
		assert.ok(item?.prompt.some((p) => p.type === "image"));
	});
});

describe("answer idempotency", () => {
	it("dedupes event_id", () => {
		const r1 = recordAnswer({
			event_id: "ev1",
			card_id: "card_x",
			subject: "s",
			picked: "a",
			correct: true,
		});
		const r2 = recordAnswer({
			event_id: "ev1",
			card_id: "card_x",
			subject: "s",
			picked: "b",
			correct: false,
		});
		assert.equal(r1.ok, true);
		assert.equal(r2.ok, true);
		assert.equal(practiceStore.readAnswerEvents().length, 1);
	});
});

describe("entry decision", () => {
	it("is idempotent and confirms", () => {
		practiceStore.writeEntries([
			entry({ subjectId: "s", entryId: "p1", type: "term", front: "a", back: "b", status: "pending" }),
		]);
		decideEntry("d1", "p1", "keep");
		decideEntry("d1", "p1", "keep");
		assert.equal(practiceStore.readEntryDecisions().length, 1);
		assert.equal(practiceStore.readEntries()[0]!.status, "confirmed");
	});
});

describe("wikimedia import mock", () => {
	it("caches bytes locally", async () => {
		const fakeFetch: typeof fetch = async (input) => {
			const url = String(input);
			if (url.includes("api.php")) {
				return new Response(
					JSON.stringify({
						query: {
							pages: {
								"1": {
									imageinfo: [
										{
											url: "https://commons.test/file.svg",
											extmetadata: { LicenseShortName: { value: "CC0" } },
										},
									],
								},
							},
						},
					}),
				);
			}
			return new Response("<svg xmlns='http://www.w3.org/2000/svg'/>", {
				headers: { "content-type": "image/svg+xml" },
			});
		};
		const resolved = await resolveCommonsImage("File:Test.svg", fakeFetch);
		assert.ok(resolved);
		const result = await importEntries(
			[
				{
					subjectId: "geo",
					type: "visual",
					front: "Test",
					back: "Test land",
					commons: { pageTitle: "File:Test.svg" },
				},
			],
			fakeFetch,
		);
		assert.equal(result.imported, 1);
		const stored = practiceStore.readEntries()[0]!;
		assert.equal(stored.status, "pending");
		assert.ok(stored.media?.attribution?.license);
		assert.ok(practiceStore.mediaExists(stored.media!.ref));
	});
});

describe("term-pick check", () => {
	it("validates four text options", () => {
		const entries = ["a", "b", "c", "d"].map((id) =>
			entry({ subjectId: "latin", entryId: id, type: "term", front: id, back: `mean-${id}` }),
		);
		const item = termPickKind.assemble(entries[0]!, entries.slice(1));
		assert.ok(item);
		const check = termPickKind.check(item!, entries[0]!, buildCheckContext(entries));
		assert.equal(check.ok, true);
		const card = dailyItemToPickCard(item!);
		assert.equal(card.kind, "pick");
		assert.equal(card.options.length, 4);
	});
});
