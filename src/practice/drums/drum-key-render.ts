import { createHash } from "node:crypto";
import { renderGrooveAbcToSvg } from "../groove-render.ts";

export interface DrumKeyRenderedNote {
	/** ABC pitch token on the rendered note (`data-name` on the notehead path). */
	pitchToken: string;
	/** abcjs staff slot class (`abcjs-pN`). */
	staffPosition: number;
	/** SHA-1 (hex) of the notehead path `d` attribute (stable glyph fingerprint). */
	headPathHash: string;
}

const NOTE_RE =
	/<g class="(abcjs-note[^"]+)"[\s\S]*?data-name="note"[\s\S]*?<path data-name="([^"]+)" d="([^"]+)"/;

export function inspectDrumKeyRender(svg: string): DrumKeyRenderedNote {
	const match = svg.match(NOTE_RE);
	if (!match) throw new Error("drum_key_render: no note in SVG");
	const staffPosition = Number(match[1].match(/abcjs-p(\d+)/)?.[1]);
	if (!Number.isFinite(staffPosition)) throw new Error("drum_key_render: missing abcjs-p class");
	const headPathHash = createHash("sha1").update(match[3]).digest("hex");
	return { pitchToken: match[2], staffPosition, headPathHash };
}

export function renderDrumKeyVoice(abc: string, widthPx = 160): DrumKeyRenderedNote {
	return inspectDrumKeyRender(renderGrooveAbcToSvg(abc, widthPx));
}

export interface DrumKeyRenderExpectation {
	pitchToken: string;
	staffPosition: number;
	headPathHash: string;
	/** Human-readable notehead family for test failures. */
	headLabel: string;
}

/**
 * Golden render targets via `renderGrooveAbcToSvg` (same path as import + Choice media).
 * Percmap keys must match `pitchesToPerc` (single `^`/`_` only — not `^^` / `^^^`).
 */
export const DRUM_KEY_RENDER_EXPECTATIONS: Record<string, DrumKeyRenderExpectation> = {
	"bass-drum": {
		pitchToken: "F",
		staffPosition: 3,
		headPathHash: "d196fa7aeed57a28278c86251349e39a9a240332",
		headLabel: "oval",
	},
	snare: {
		pitchToken: "^c",
		staffPosition: 7,
		headPathHash: "1955f0e574db4b5a271b71783f41a05cd174d70a",
		headLabel: "oval",
	},
	"closed-hihat": {
		pitchToken: "^g",
		staffPosition: 11,
		headPathHash: "f801b7728237e7e495337915f4f51ec86a5e8899",
		headLabel: "x",
	},
	"open-hihat": {
		pitchToken: "^g",
		staffPosition: 11,
		headPathHash: "2170d56409395584dcfbda136bbe68b9dd1e1709",
		headLabel: "x (open)",
	},
	"hihat-foot": {
		pitchToken: "D",
		staffPosition: 1,
		headPathHash: "57275c06886668556fd36bfe11ce6be6fe17135d",
		headLabel: "x",
	},
	crash: {
		pitchToken: "^a",
		staffPosition: 12,
		headPathHash: "f801b7728237e7e495337915f4f51ec86a5e8899",
		headLabel: "x",
	},
	ride: {
		pitchToken: "^f",
		staffPosition: 10,
		headPathHash: "f801b7728237e7e495337915f4f51ec86a5e8899",
		headLabel: "x",
	},
	"ride-bell": {
		pitchToken: "^f",
		staffPosition: 10,
		headPathHash: "b2b1146fcb353db4b3570088ea667e4206aeaa4e",
		headLabel: "triangle",
	},
	"high-tom": {
		pitchToken: "^e",
		staffPosition: 9,
		headPathHash: "73c8181baa965dee1a469baeec5a24b8f99f4f54",
		headLabel: "oval",
	},
	"mid-tom": {
		pitchToken: "^d",
		staffPosition: 8,
		headPathHash: "55014cae583b4fe6c7d9dea803138b893b64ef32",
		headLabel: "oval",
	},
	"floor-tom": {
		pitchToken: "A",
		staffPosition: 5,
		headPathHash: "d196fa7aeed57a28278c86251349e39a9a240332",
		headLabel: "oval",
	},
	"cross-stick": {
		pitchToken: "^c",
		staffPosition: 7,
		headPathHash: "0c9aec783c5ee3af0b527043557ba71a4d66013a",
		headLabel: "x (cross-stick)",
	},
	rimshot: {
		pitchToken: "^c",
		staffPosition: 7,
		headPathHash: "b2f5f09bd7105bdc78e0aa48dae57cc1b883adad",
		headLabel: "rhythm slash",
	},
	"ghost-snare": {
		pitchToken: "^c",
		staffPosition: 7,
		headPathHash: "1955f0e574db4b5a271b71783f41a05cd174d70a",
		headLabel: "oval (ghost)",
	},
};

export function assertDrumKeyRenderMatches(voiceId: string, rendered: DrumKeyRenderedNote): void {
	const spec = DRUM_KEY_RENDER_EXPECTATIONS[voiceId];
	if (!spec) throw new Error(`drum_key_render: no expectation for ${voiceId}`);
	if (rendered.pitchToken !== spec.pitchToken) {
		throw new Error(
			`${voiceId}: pitch ${rendered.pitchToken} !== expected ${spec.pitchToken}`,
		);
	}
	if (rendered.staffPosition !== spec.staffPosition) {
		throw new Error(
			`${voiceId}: staff abcjs-p${rendered.staffPosition} !== expected p${spec.staffPosition}`,
		);
	}
	if (rendered.headPathHash !== spec.headPathHash) {
		throw new Error(
			`${voiceId}: ${spec.headLabel} notehead mismatch (got ${rendered.headPathHash})`,
		);
	}
}
