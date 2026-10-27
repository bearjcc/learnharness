import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { PRACTICE_FILES } from "../config.ts";
import { DRUM_KEY_VOICES, readDrumKeyAbc } from "../src/practice/drums/key-library.ts";
import { renderGrooveAbcToSvg } from "../src/practice/groove-render.ts";
import { selectDistractors } from "../src/core/practice/distractors.ts";
import { identityPromptFor } from "../src/core/practice/identity-prompt.ts";
import type { PracticeEntry, PracticeSubject } from "../src/core/practice/contracts.ts";
import { importDrumKey } from "../src/practice/drums/import-drum-key.ts";
import {
	assertDrumKeyRenderMatches,
	renderDrumKeyVoice,
} from "../src/practice/drums/drum-key-render.ts";

const drumsSubject: PracticeSubject = {
	subjectId: "drums",
	title: "Drum kit",
	enabled: true,
	dailyCards: 8,
	itemKinds: ["label-pick", "image-pick"],
	mediaVariants: { enabled: ["drum-note"], distractorBias: "staff-neighbor" },
};

function drumKeyEntry(defId: string, staffPos: number, front: string): PracticeEntry {
	return {
		subjectId: "drums",
		entryId: `drumkey_${defId}`,
		type: "visual",
		front,
		back: front,
		group: `voice:${defId}`,
		identityScope: "entry",
		level: 1,
		tags: ["drums", "drum-key", `staff-pos:${staffPos}`],
		variants: { "drum-note": { kind: "svg", ref: `drumkey_${defId}.svg` } },
		origin: { kind: "import" },
		status: "confirmed",
	};
}

describe("drum key library", () => {
	it("has fourteen PAS-aligned voices with one-bar 4/4 percussion ABC", () => {
		assert.equal(DRUM_KEY_VOICES.length, 14);
		for (const def of DRUM_KEY_VOICES) {
			const abc = readDrumKeyAbc(def);
			assert.match(abc, /M:4\/4/);
			assert.match(abc, /K:perc/);
			assert.match(abc, /%%percmap/);
			assert.match(abc, / z z z \|/);
			assert.doesNotMatch(abc, /\^\^+/);
		}
	});

	it("each voice renders with expected abcjs staff slot and notehead glyph", () => {
		for (const def of DRUM_KEY_VOICES) {
			const rendered = renderDrumKeyVoice(readDrumKeyAbc(def));
			assertDrumKeyRenderMatches(def.id, rendered);
		}
	});

	it("each voice renders to a distinct SVG", () => {
		const hashes = new Set<string>();
		for (const def of DRUM_KEY_VOICES) {
			const svg = renderGrooveAbcToSvg(readDrumKeyAbc(def), 160);
			const hash = createHash("sha256").update(svg).digest("hex");
			assert.ok(!hashes.has(hash), `duplicate render for ${def.id}`);
			hashes.add(hash);
		}
	});

	it("staff-neighbor bias prefers adjacent staff positions", () => {
		const floor = drumKeyEntry("floor-tom", 3, "Floor tom");
		const mid = drumKeyEntry("mid-tom", 4, "Mid tom");
		const high = drumKeyEntry("high-tom", 7, "High tom");
		const bass = drumKeyEntry("bass-drum", 1, "Bass drum");
		const pool = [floor, mid, high, bass];
		const picked = selectDistractors(floor, pool, 1, {
			bias: "staff-neighbor",
			mediaVariant: "drum-note",
		});
		assert.equal(picked.length, 1);
		assert.equal(picked[0]!.entryId, mid.entryId);
	});

	it("identity prompts use templated drum copy", () => {
		const snare = drumKeyEntry("snare", 5, "Snare drum");
		assert.equal(identityPromptFor("label-pick", drumsSubject, snare).prompt, "Which drum is this?");
		assert.match(
			identityPromptFor("image-pick", drumsSubject, snare).prompt,
			/Which note is the Snare drum\?/,
		);
	});

	describe("import", () => {
		const prev = process.env.LH_DATA_DIR;
		let tmp: string;

		beforeEach(() => {
			tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lh-drum-key-"));
			process.env.LH_DATA_DIR = tmp;
			fs.mkdirSync(path.dirname(PRACTICE_FILES.subjects), { recursive: true });
		});

		afterEach(() => {
			if (prev === undefined) delete process.env.LH_DATA_DIR;
			else process.env.LH_DATA_DIR = prev;
			fs.rmSync(tmp, { recursive: true, force: true });
		});

		it("creates confirmed level-1 visual entries", () => {
			const result = importDrumKey({ subjectId: "drums" });
			assert.equal(result.imported + result.updated, 14);
			const again = importDrumKey({ subjectId: "drums", replace: true });
			assert.equal(again.updated, 14);
		});
	});
});
