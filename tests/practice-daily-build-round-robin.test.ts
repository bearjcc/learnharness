import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PRACTICE_FILES } from "../config.ts";
import { practiceStore } from "../src/store/practice.ts";
import { runDailyBuildAll } from "../src/server/practice/daily-build.ts";

describe("daily build round-robin", () => {
	const prev = process.env.LH_DATA_DIR;
	let tmp: string;

	beforeEach(() => {
		tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-rr-"));
		process.env.LH_DATA_DIR = tmp;
		process.env.LH_PRACTICE_SKIP_LLM = "1";
		process.env.LH_PRACTICE_BUILD_BUDGET_MS = "60000";
		fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
		practiceStore.writeSubjects([
			{ subjectId: "a", title: "A", enabled: true, dailyCards: 2, itemKinds: ["fact-pick"] },
			{ subjectId: "b", title: "B", enabled: true, dailyCards: 2, itemKinds: ["fact-pick"] },
		]);
		const mk = (subjectId: string, n: number) =>
			Array.from({ length: n }, (_, i) => ({
				subjectId,
				entryId: `${subjectId}_e${i}`,
				type: "fact" as const,
				front: `Q ${subjectId} ${i}`,
				back: `A ${subjectId} ${i}`,
				origin: { kind: "import" as const },
				status: "confirmed" as const,
			}));
		practiceStore.writeEntries([...mk("a", 4), ...mk("b", 4)]);
	});

	afterEach(() => {
		delete process.env.LH_PRACTICE_SKIP_LLM;
		delete process.env.LH_PRACTICE_BUILD_BUDGET_MS;
		if (prev === undefined) delete process.env.LH_DATA_DIR;
		else process.env.LH_DATA_DIR = prev;
		fs.rmSync(tmp, { recursive: true, force: true });
	});

	it("builds from both subjects instead of exhausting the first", async () => {
		const results = await runDailyBuildAll();
		const a = results.find((r) => r.subjectId === "a");
		const b = results.find((r) => r.subjectId === "b");
		assert.ok(a && b);
		assert.ok(a.built > 0);
		assert.ok(b.built > 0);
	});
});
