import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { PRACTICE_FILES } from "../config.ts";
import { assertGrooveBarsFitMeter } from "../src/practice/grooves/abc-meter.ts";
import { CURATED_GROOVE_LIBRARY, readGrooveAbc } from "../src/practice/grooves/library.ts";
import { renderGrooveAbcToSvg } from "../src/practice/groove-render.ts";
import { selectDistractors } from "../src/core/practice/distractors.ts";
import { grooveIdKind } from "../src/practice/kinds/groove-id.ts";
import type { PracticeEntry, PracticeSubject } from "../src/core/practice/contracts.ts";

function noteBody(abc: string): string {
	return abc
		.split("\n")
		.filter((l) => /V:[12]/.test(l) || /^[Bcgdz\s|z\[\]]+$/i.test(l.trim()))
		.join("\n");
}

describe("curated groove library", () => {
	const prev = process.env.LH_DATA_DIR;
	let tmp: string;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-grooves-"));
		process.env.LH_DATA_DIR = tmp;
		fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
	});

	afterEach(() => {
		if (prev === undefined) delete process.env.LH_DATA_DIR;
		else process.env.LH_DATA_DIR = prev;
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it("every groove voice fills each bar to the written meter", () => {
		for (const def of CURATED_GROOVE_LIBRARY) {
			const abc = readGrooveAbc(def);
			assertGrooveBarsFitMeter(abc);
		}
	});

	it("every groove renders to distinct SVG hash and ABC note content", () => {
		const svgHashes = new Set<string>();
		const bodies = new Set<string>();
		for (const def of CURATED_GROOVE_LIBRARY) {
			const abc = readGrooveAbc(def);
			const svg = renderGrooveAbcToSvg(abc, 160);
			const hash = createHash("sha256").update(svg).digest("hex");
			assert.ok(!svgHashes.has(hash), `duplicate SVG for ${def.id}`);
			svgHashes.add(hash);
			const body = noteBody(abc);
			assert.ok(!bodies.has(body), `duplicate pattern for ${def.id}`);
			bodies.add(body);
		}
		assert.equal(CURATED_GROOVE_LIBRARY.length, 15);
	});

	it("aliases never appear as distractors against their groove", () => {
		const four: PracticeEntry = {
			subjectId: "drums",
			entryId: "groove_four-on-the-floor",
			type: "groove",
			front: "Four on the floor",
			back: readGrooveAbc(CURATED_GROOVE_LIBRARY.find((g) => g.id === "four-on-the-floor")!),
			aliases: ["disco"],
			group: "groove:four-on-the-floor",
			origin: { kind: "import" },
			status: "confirmed",
		};
		const discoAliasRow: PracticeEntry = {
			...four,
			entryId: "groove_disco_fake",
			front: "disco",
			aliases: [],
		};
		const others = CURATED_GROOVE_LIBRARY.filter((g) => g.id !== "four-on-the-floor").map((g, i) => ({
			subjectId: "drums",
			entryId: `groove_${g.id}`,
			type: "groove" as const,
			front: g.name,
			back: readGrooveAbc(g),
			group: g.group,
			origin: { kind: "import" as const },
			status: "confirmed" as const,
		}));
		const pool = [four, discoAliasRow, ...others];
		const dist = selectDistractors(four, pool, 3);
		assert.ok(dist.every((d) => d.front.toLowerCase() !== "disco"));
		assert.ok(dist.every((d) => !four.aliases?.includes(d.front)));
	});

	it("groove-id item options are pairwise distinct renders", async () => {
		process.env.LH_PRACTICE_SKIP_LLM = "1";
		const subject: PracticeSubject = {
			subjectId: "drums",
			title: "Drums",
			enabled: true,
			dailyCards: 4,
			itemKinds: ["groove-id"],
		};
		const entries: PracticeEntry[] = CURATED_GROOVE_LIBRARY.slice(0, 4).map((g) => ({
			subjectId: "drums",
			entryId: `groove_${g.id}`,
			type: "groove" as const,
			front: g.name,
			back: readGrooveAbc(g),
			group: g.group,
			origin: { kind: "import" as const },
			status: "confirmed" as const,
		}));
		const dist = selectDistractors(entries[0]!, entries, 3);
		assert.equal(dist.length, 3, "need three entry distractors");
		const cardEntries = [entries[0]!, ...dist];
		const svgHashes = new Set<string>();
		for (const ent of cardEntries) {
			const svg = renderGrooveAbcToSvg(ent.back, 160);
			svgHashes.add(createHash("sha256").update(svg).digest("hex"));
		}
		assert.equal(svgHashes.size, 4);
		const item = grooveIdKind.assemble(entries[0]!, dist, { prompt: "Which groove is this?" }, {
			subject,
			shuffleSeed: "test-seed",
			inventedDistractors: [],
			embed: async () => [],
			confirmedPool: entries,
		});
		assert.ok(item, "groove-id assemble returned null");
		assert.equal(item!.options.length, 4);
		delete process.env.LH_PRACTICE_SKIP_LLM;
	});
});
