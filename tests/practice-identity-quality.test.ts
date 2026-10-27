import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
	answerSupportedByQuote,
	promptClaimsAllowed,
	quoteMatchesTopic,
} from "../src/core/practice/sources/claims.ts";
import { selectDistractors } from "../src/core/practice/distractors.ts";
import { identityPromptFor } from "../src/core/practice/identity-prompt.ts";
import { buildItemForEntry } from "../src/server/practice/engine.ts";
import { renderGrooveAbcToSvg } from "../src/practice/groove-render.ts";
import { practiceStore } from "../src/store/practice.ts";
import { PRACTICE_FILES } from "../config.ts";
import type { PracticeEntry, PracticeSubject } from "../src/core/practice/contracts.ts";

// verifyBuiltinGeography is not exported - test via verifyEntryIdentity or export helper
// I'll use entry-verify internal by importing verifyEntryIdentity

import { verifyEntryIdentity } from "../src/server/practice/entry-verify.ts";
import { trySourcedFactPickItem } from "../src/server/practice/sourced-item.ts";
import { writeSourceCache } from "../src/store/practice-sources.ts";

describe("practice identity and sourcing quality", () => {
	const prevData = process.env.LH_DATA_DIR;
	let tmp: string;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-quality-"));
		process.env.LH_DATA_DIR = tmp;
		fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
		writeSourceCache({ chunks: [] });
	});

	afterEach(() => {
		if (prevData === undefined) delete process.env.LH_DATA_DIR;
		else process.env.LH_DATA_DIR = prevData;
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it("templated identity item uses fixed prompt without model call", async () => {
		process.env.LH_PRACTICE_SKIP_LLM = "1";
		const subject: PracticeSubject = {
			subjectId: "flags",
			title: "Flags",
			enabled: true,
			dailyCards: 5,
			itemKinds: ["image-pick"],
			mediaVariants: { enabled: ["flag"] },
			sources: [{ kind: "wikipedia", id: "flags-wiki", pages: ["Fiji"] }],
		};
		const entries: PracticeEntry[] = [
			{
				subjectId: "flags",
				entryId: "a",
				type: "visual",
				front: "Fiji",
				back: "Fiji",
				group: "country:FJI",
				groupLabel: "Fiji",
				identityScope: "group",
				origin: { kind: "commons", pageTitle: "Flag_of_Fiji.svg" },
				status: "confirmed",
				variants: { flag: { kind: "svg", ref: "a.svg" } },
				citation: { sourceId: "flags-wiki", quote: "Fiji" },
			},
			...["b", "c", "d"].map((id) => ({
				subjectId: "flags",
				entryId: id,
				type: "visual" as const,
				front: id,
				back: id,
				group: `country:${id}`,
				origin: { kind: "import" as const },
				status: "confirmed" as const,
				variants: { flag: { kind: "svg" as const, ref: `${id}.svg` } },
				citation: { sourceId: "flags-wiki", quote: id },
			})),
		];
		practiceStore.writeSubjects([subject]);
		practiceStore.writeEntries(entries);
		for (const id of ["a", "b", "c", "d"]) {
			practiceStore.writeMedia(`${id}.svg`, Buffer.from("<svg/>"));
		}
		const item = await buildItemForEntry(subject, entries[0]!, entries, undefined);
		assert.ok(item);
		const text = item!.prompt.find((p) => p.type === "text");
		assert.equal(text && text.type === "text" ? text.text : "", "Which is the flag of Fiji?");
		delete process.env.LH_PRACTICE_SKIP_LLM;
	});

	it("rejects quote that does not contain the answer", () => {
		assert.equal(answerSupportedByQuote("Suva", "The capital is Nadi."), false);
		assert.equal(answerSupportedByQuote("Suva", "The capital is Suva."), true);
	});

	it("rejects unrelated quote for topic", () => {
		assert.equal(quoteMatchesTopic("Nauru flag", "Rugby is popular in Fiji."), false);
	});

	it("excludes same-group distractors for group-level flag questions", () => {
		const source: PracticeEntry = {
			subjectId: "flags",
			entryId: "nz",
			type: "visual",
			front: "New Zealand",
			back: "",
			group: "country=NZ",
			groupLabel: "New Zealand",
			identityScope: "group",
			origin: { kind: "import" },
			status: "confirmed",
		};
		const pool: PracticeEntry[] = [
			source,
			{
				...source,
				entryId: "nz-white",
				front: "NZ White Ensign",
				identityScope: "entry",
			},
			{
				subjectId: "flags",
				entryId: "fj",
				type: "visual",
				front: "Fiji",
				back: "",
				group: "country=FJ",
				origin: { kind: "import" },
				status: "confirmed",
			},
			{
				subjectId: "flags",
				entryId: "ws",
				type: "visual",
				front: "Samoa",
				back: "",
				group: "country=WS",
				origin: { kind: "import" },
				status: "confirmed",
			},
			{
				subjectId: "flags",
				entryId: "to",
				type: "visual",
				front: "Tonga",
				back: "",
				group: "country=TO",
				origin: { kind: "import" },
				status: "confirmed",
			},
		];
		const plan = identityPromptFor("image-pick", { subjectId: "flags", title: "", enabled: true, dailyCards: 1, itemKinds: [] }, source);
		const dist = selectDistractors(source, pool, 3, { excludeGroup: plan.excludeGroup });
		assert.ok(dist.every((d) => d.group !== "country=NZ"));
	});

	it("rejects garbage citation source id in fact path", async () => {
		writeSourceCache({
			chunks: [
				{
					id: "1",
					sourceId: "flags-wiki",
					url: "https://example",
					text: "Nauru is an island. Sport is Australian rules football.",
					fetchedAt: new Date().toISOString(),
				},
			],
		});
		const subject: PracticeSubject = {
			subjectId: "flags",
			title: "F",
			enabled: true,
			dailyCards: 1,
			itemKinds: ["fact-pick"],
			sources: [{ kind: "wikipedia", id: "flags-wiki", pages: ["Nauru"] }],
		};
		const entry: PracticeEntry = {
			subjectId: "flags",
			entryId: "e1",
			type: "fact",
			front: "Nauru",
			back: "Australian rules football",
			origin: { kind: "import" },
			status: "confirmed",
			citation: {
				sourceId: "]} 3",
				quote: "Sport is Australian rules football.",
			},
		};
		practiceStore.writeSubjects([subject]);
		practiceStore.writeEntries([entry]);
		const item = await trySourcedFactPickItem(subject, entry, [entry], "writer", async () => new Response("{}", { status: 500 }));
		assert.equal(item, null);
	});

	it("auto-confirms builtin geography entries", async () => {
		const subject: PracticeSubject = {
			subjectId: "geography",
			title: "Geo",
			enabled: true,
			dailyCards: 1,
			itemKinds: ["label-pick"],
			sources: [{ kind: "builtin", id: "geo-ne", builtinId: "geography" }],
		};
		const entry: PracticeEntry = {
			subjectId: "geography",
			entryId: "g1",
			type: "visual",
			front: "Fiji",
			back: "",
			tags: ["flag-iso:FJI"],
			origin: { kind: "import" },
			status: "pending",
			topicOnly: true,
		};
		practiceStore.writeSubjects([subject]);
		practiceStore.writeEntries([entry]);
		const out = await verifyEntryIdentity(subject, entry, fetch, { offline: true });
		assert.equal(out?.status, "confirmed");
		assert.ok(out?.citation?.quote.includes("Fiji"));
	});

	it("rock beat renders on one percussion staff", () => {
		const abc = readFileSync("samples/grooves/rock-beat.abc", "utf-8");
		assert.match(abc, /%%score \(1 2\)/);
		const svg = renderGrooveAbcToSvg(abc, 160);
		const bracePairs = (svg.match(/class="abcjs-brace"/g) ?? []).length;
		assert.equal(bracePairs, 0, "expected no brace between staves");
		assert.match(svg, /data-name="B"/);
		assert.match(svg, /data-name="c"/);
		assert.match(svg, /data-name="g"/);
	});

	it("rejects invented prompt claims not in quote", () => {
		const entry: PracticeEntry = {
			subjectId: "x",
			entryId: "e",
			type: "fact",
			front: "Bougainville",
			back: "flower",
			origin: { kind: "import" },
			status: "confirmed",
		};
		assert.equal(
			promptClaimsAllowed("The Bougainville flower was named in 1768.", "", "flower symbol", entry),
			false,
		);
	});
});
