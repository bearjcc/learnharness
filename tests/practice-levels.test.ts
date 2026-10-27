import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PracticeAnswerEvent, PracticeEntry, PracticeSubject } from "../src/core/practice/contracts.ts";
import {
	computePracticeLevelProgress,
	entryAllowedForDeal,
} from "../src/core/practice/levels.ts";
import { pickDueEntries } from "../src/server/practice/daily-build.ts";
import { mergeSubjectPresets } from "../src/server/practice/subject-presets.ts";

const drumsPreset = mergeSubjectPresets([
	{ subjectId: "drums", title: "Drums", enabled: true, dailyCards: 10, itemKinds: [] },
]).find((s) => s.subjectId === "drums")!;

function keyEntry(id: string): PracticeEntry {
	return {
		subjectId: "drums",
		entryId: `drumkey_${id}`,
		type: "visual",
		front: id,
		back: id,
		level: 1,
		status: "confirmed",
		fsrs: { due: "2000-01-01", stability: 0, difficulty: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0 },
		origin: { kind: "import" },
	};
}

function grooveEntry(id: string, level: number): PracticeEntry {
	return {
		subjectId: "drums",
		entryId: `groove_${id}`,
		type: "groove",
		front: id,
		back: "X:1",
		level,
		status: "confirmed",
		fsrs: { due: "2000-01-01", stability: 0, difficulty: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0 },
		origin: { kind: "import" },
	};
}

describe("practice levels and unlock", () => {
	it("level-2 grooves are excluded from daily deals until level 2 unlocks", () => {
		const entries = [keyEntry("snare"), grooveEntry("rock-beat", 2), grooveEntry("shuffle", 3)];
		const progress = computePracticeLevelProgress(drumsPreset, entries, []);
		assert.deepEqual(progress.unlockedLevels, [1]);
		assert.equal(entryAllowedForDeal(grooveEntry("rock-beat", 2), progress, drumsPreset, "seed"), false);
		const picked = pickDueEntries(drumsPreset, entries, 10, { answers: [] });
		assert.ok(picked.every((e) => (e.level ?? 1) <= 1));
	});

	it("unlock level 2 after enough correct answers on level-1 entries", () => {
		const entries = Array.from({ length: 4 }, (_, i) => keyEntry(`k${i}`));
		const answers: PracticeAnswerEvent[] = [];
		for (let i = 0; i < 12; i++) {
			answers.push({
				event_id: `e${i}`,
				card_id: `c${i}`,
				subject: "drums",
				entry_id: entries[i % entries.length]!.entryId,
				correct: true,
				at: new Date().toISOString(),
			});
		}
		const progress = computePracticeLevelProgress(drumsPreset, entries, answers);
		assert.ok(progress.unlockedLevels.includes(2));
		const groove = grooveEntry("rock-beat", 2);
		assert.equal(entryAllowedForDeal(groove, progress, drumsPreset, "seed"), true);
	});
});
