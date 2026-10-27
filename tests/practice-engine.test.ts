import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-practice-"));
process.env.LH_DATA_DIR = TMP;
process.env.LH_PRACTICE_SKIP_LLM = "1";
import { selectDistractors } from "../src/core/practice/distractors.ts";
import { applyFsrsReview, defaultFsrsState, fsrsDue } from "../src/core/practice/fsrs.ts";
import { mixedCardStack, dailyItemToPickCard } from "../src/core/practice/cards.ts";
import fs from "node:fs";
import path from "node:path";
import { resolveGrooveAbc } from "../src/core/practice/groove.ts";
import { renderGrooveAbcToSvg } from "../src/practice/groove-render.ts";
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
import { buildGpuBrokerLeaseBody, withGpuBrokerLease } from "../src/server/practice/gpu-broker.ts";
import { WIKIMEDIA_USER_AGENT } from "../src/practice/wikimedia.ts";
import { buildCheckContext } from "../src/server/practice/engine.ts";
import { DEFAULT_MEDIA_VARIANT } from "../src/core/practice/media-variants.ts";

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

const SEED_GROOVES = ["rock-beat", "half-time", "four-on-the-floor", "shuffle"] as const;
const GROOVE_SAMPLES_DIR = path.join(process.cwd(), "samples", "grooves");

describe("groove ABC notation", () => {
	for (const name of SEED_GROOVES) {
		it(`renders seed groove ${name} with noteheads`, () => {
			const abc = fs.readFileSync(path.join(GROOVE_SAMPLES_DIR, `${name}.abc`), "utf-8");
			assert.ok(resolveGrooveAbc(abc));
			const svg = renderGrooveAbcToSvg(abc, 160);
			assert.match(svg, /<svg/);
			assert.match(svg, /width="160"/);
			assert.match(svg, /abcjs-note|note-head|ellipse/i);
			assert.doesNotMatch(svg, /Rock Beat|Half[- ]Time|Four on the Floor|Shuffle/i);
			assert.doesNotMatch(svg, /scripts\.segno|abcjs-title/i);
			assert.match(svg, /fill="#ffffff"/);
			assert.match(svg, /fill="#111111"/);
		});
	}

	it("converts legacy JSON grid to ABC", () => {
		const back = JSON.stringify({
			stepsPerBar: 4,
			bars: 1,
			instruments: { kick: [[true, false, false, false]] },
		});
		const abc = resolveGrooveAbc(back);
		assert.ok(abc?.includes("K:perc"));
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
		const item = imagePickKind.assemble(source, entries.slice(1), { prompt: "Pick" }, {
			mediaVariant: DEFAULT_MEDIA_VARIANT,
		});
		assert.ok(item);
		const check = imagePickKind.check(item!, source, buildCheckContext(entries));
		assert.equal(check.ok, true);
	});
});

describe("media variants", () => {
	it("rejects image-pick items that mix variants", () => {
		practiceStore.writeMedia("a-outline.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("a-locator.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("b-outline.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("b-locator.svg", Buffer.from("<svg/>"));
		const mk = (id: string) =>
			entry({
				subjectId: "geo",
				entryId: id,
				type: "visual",
				front: id,
				back: id,
				variants: {
					outline: { kind: "svg", ref: `${id}-outline.svg` },
					locator: { kind: "svg", ref: `${id}-locator.svg` },
				},
			});
		const entries = ["a", "b", "c", "d"].map(mk);
		practiceStore.writeMedia("c-outline.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("c-locator.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("d-outline.svg", Buffer.from("<svg/>"));
		practiceStore.writeMedia("d-locator.svg", Buffer.from("<svg/>"));
		const source = entries[0]!;
		const good = imagePickKind.assemble(source, entries.slice(1), { prompt: "?" }, { mediaVariant: "outline" });
		assert.ok(good?.mediaVariant === "outline");
		const bad = {
			...good!,
			options: good!.options.map((o, i) =>
				i === 1 && o.type === "image"
					? { ...o, token: "b-locator.svg" }
					: o,
			),
		};
		const check = imagePickKind.check(bad, source, buildCheckContext(entries));
		assert.equal(check.ok, false);
		assert.ok(check.errors.some((e) => e.includes("variant") || e.includes("media mismatch")));
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
		const item = labelPickKind.assemble(entries[0]!, entries.slice(1), undefined, {
			mediaVariant: DEFAULT_MEDIA_VARIANT,
		});
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
				assert.match(url, /iiurlwidth=512/);
				return new Response(
					JSON.stringify({
						query: {
							pages: {
								"1": {
									imageinfo: [
										{
											url: "https://upload.wikimedia.org/original.svg",
											thumburl: "https://upload.wikimedia.org/thumb/512.png",
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

describe("gpu broker lease", () => {
	const prev = process.env.LH_GPU_BROKER_URL;
	afterEach(() => {
		if (prev === undefined) delete process.env.LH_GPU_BROKER_URL;
		else process.env.LH_GPU_BROKER_URL = prev;
	});

	it("buildGpuBrokerLeaseBody matches Dunce broker contract", () => {
		assert.deepEqual(buildGpuBrokerLeaseBody({}), {
			service: "learnharness",
			job: "practice-daily-build",
			vram_gb: 8,
			class: "batch",
			owner: "learnharness",
			reason: "practice daily build",
		});
	});

	it("leases, heartbeats, and releases", async () => {
		process.env.LH_GPU_BROKER_URL = "https://broker.test";
		const calls: string[] = [];
		let leaseBody: unknown;
		const fakeFetch: typeof fetch = async (input, init) => {
			const url = String(input);
			const method = init?.method ?? "GET";
			calls.push(`${method} ${url}`);
			if (url.endsWith("/api/lease") && method === "POST") {
				leaseBody = JSON.parse(String(init?.body));
				return new Response(JSON.stringify({ id: "lease-1", state: "active" }), { status: 200 });
			}
			if (url.includes("/heartbeat")) {
				return new Response(JSON.stringify({ state: "active" }), { status: 200 });
			}
			if (url.includes("/release")) {
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			}
			return new Response("not found", { status: 404 });
		};
		const out = await withGpuBrokerLease(async () => "done", fakeFetch);
		assert.equal(out.outcome, "ok");
		assert.equal(out.result, "done");
		assert.ok(calls.some((c) => c.startsWith("POST https://broker.test/api/lease")));
		assert.ok(calls.some((c) => c.includes("/release")));
		assert.deepEqual(leaseBody, buildGpuBrokerLeaseBody({ LH_GPU_BROKER_URL: "https://broker.test" }));
		assert.equal("vram_gb" in (leaseBody as object), true);
		assert.equal("vramGb" in (leaseBody as object), false);
	});

	it("falls through when broker is unreachable", async () => {
		process.env.LH_GPU_BROKER_URL = "https://broker.test";
		const fakeFetch: typeof fetch = async () => {
			throw new Error("fetch failed");
		};
		const out = await withGpuBrokerLease(async () => "direct", fakeFetch);
		assert.equal(out.outcome, "none");
		assert.equal(out.result, "direct");
	});
});

describe("wikimedia user agent", () => {
	it("includes app version and repo URL", () => {
		assert.match(WIKIMEDIA_USER_AGENT, /LearnHarness\/\d/);
		assert.match(WIKIMEDIA_USER_AGENT, /github\.com/);
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
