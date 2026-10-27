import { createHash } from "node:crypto";
import type { GrooveGrid } from "./contracts.ts";

const ABC_INSTRUMENT: Record<string, string> = {
	kick: "B",
	bass: "B",
	bassdrum: "B",
	snare: "S",
	hihat: "g",
	"hi-hat": "g",
	hat: "g",
};

const ABC_HEADER = `%%percmap B 35 normal
%%percmap S 38 normal
%%percmap g 42 x
`;

export function isAbcGrooveText(raw: string): boolean {
	return raw.trimStart().startsWith("X:");
}

export function parseGrooveGrid(raw: string): GrooveGrid | null {
	try {
		const parsed = JSON.parse(raw) as GrooveGrid;
		if (
			typeof parsed.stepsPerBar !== "number" ||
			typeof parsed.bars !== "number" ||
			!parsed.instruments ||
			typeof parsed.instruments !== "object"
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/** Legacy JSON step grid → ABC (kick/snare/hi-hat). */
export function grooveGridToAbc(grid: GrooveGrid, title = "Groove"): string {
	const dur = grid.stepsPerBar === 8 ? "1/8" : "1/16";
	const stepsTotal = grid.stepsPerBar * grid.bars;
	let body = "";
	for (let step = 0; step < stepsTotal; step++) {
		const bar = Math.floor(step / grid.stepsPerBar);
		const stepInBar = step % grid.stepsPerBar;
		const notes: string[] = [];
		for (const [name, bars] of Object.entries(grid.instruments)) {
			if (!bars[bar]?.[stepInBar]) continue;
			const letter = ABC_INSTRUMENT[name.toLowerCase()] ?? ABC_INSTRUMENT[name.toLowerCase().replace(/\s+/g, "-")];
			if (letter) notes.push(letter);
		}
		if (notes.length === 0) body += " z";
		else if (notes.length === 1) body += ` ${notes[0]}`;
		else body += ` [${notes.join("")}]`;
	}
	return `X:1
T:${title}
M:4/4
L:${dur}
K:perc
${ABC_HEADER}V:1
${body.trim()} |`;
}

/** Normalize entry `back` to ABC notation, or null if invalid. */
export function resolveGrooveAbc(back: string, title?: string): string | null {
	const trimmed = back.trim();
	if (isAbcGrooveText(trimmed)) return trimmed;
	const grid = parseGrooveGrid(trimmed);
	if (grid) return grooveGridToAbc(grid, title ?? "Groove");
	return null;
}

export function grooveNotationCacheToken(abc: string): string {
	const hash = createHash("sha256").update(abc).digest("hex").slice(0, 20);
	return `groove-${hash}.svg`;
}
