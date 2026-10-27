import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PRACTICE_FILES } from "../config.ts";
import { practiceStore } from "../src/store/practice.ts";
import { writeSourceCache } from "../src/store/practice-sources.ts";
import { verifyEntryIdentity } from "../src/server/practice/entry-verify.ts";
import { latinTermsMatch } from "../src/core/practice/latin-normalize.ts";
import type { PracticeSubject } from "../src/core/practice/contracts.ts";

/** Row text as produced from Wikipedia parse wikitable extraction. */
const FIXTURE_ROWS = [
	"ad hoc | for this purpose | Improvised solution.",
	"carpe diem | seize the day | Horace.",
	"deus ex machina | god from the machine | Plot device.",
	"īgnī | with fire | Macron test row.",
];

describe("latin verification", () => {
	const prev = process.env.LH_DATA_DIR;
	let tmp: string;
	const subject: PracticeSubject = {
		subjectId: "latin",
		title: "Latin",
		enabled: true,
		dailyCards: 5,
		itemKinds: ["term-pick"],
		sources: [{ kind: "wikipedia", id: "latin-wiki", pages: ["List of Latin phrases (A)"] }],
	};

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-latin-"));
		process.env.LH_DATA_DIR = tmp;
		fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
		practiceStore.writeSubjects([subject]);
		writeSourceCache({
			chunks: FIXTURE_ROWS.map((text, i) => ({
				id: `latin:${i}`,
				sourceId: "latin-wiki",
				url: "https://en.wikipedia.org/wiki/List_of_Latin_phrases_(A)",
				title: "List (A)",
				text,
				fetchedAt: new Date().toISOString(),
			})),
		});
	});

	afterEach(() => {
		if (prev === undefined) delete process.env.LH_DATA_DIR;
		else process.env.LH_DATA_DIR = prev;
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it("matches parse-style rows for ad hoc, carpe diem, and deus ex machina", async () => {
		for (const term of ["ad hoc", "carpe diem", "deus ex machina"]) {
			practiceStore.writeEntries([
				{
					subjectId: "latin",
					entryId: `term_${term.replace(/\s+/g, "_")}`,
					type: "term",
					front: term,
					back: "",
					origin: { kind: "import" },
					status: "pending",
					topicOnly: true,
				},
			]);
			const entry = practiceStore.readEntries()[0]!;
			const result = await verifyEntryIdentity(subject, entry, fetch, { offline: true });
			assert.equal(result.reason, "latin_confirmed", term);
			assert.ok(result.entry?.back.length);
			assert.match(result.entry?.citation?.quote ?? "", new RegExp(term.split(" ")[0]!, "i"));
		}
	});

	it("normalises macrons when matching", () => {
		assert.equal(latinTermsMatch("igni", "īgnī"), true);
	});

	it("logs latin_no_row when nothing matches", async () => {
		practiceStore.writeEntries([
			{
				subjectId: "latin",
				entryId: "term_none",
				type: "term",
				front: "et cetera",
				back: "",
				origin: { kind: "import" },
				status: "pending",
				topicOnly: true,
			},
		]);
		const result = await verifyEntryIdentity(subject, practiceStore.readEntries()[0]!, fetch, {
			offline: true,
		});
		assert.equal(result.reason, "latin_no_row");
	});
});
