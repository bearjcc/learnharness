import { nanoid } from "nanoid";
import type { PracticeEntry, PracticeOptionPart, PracticeSubject } from "../../core/practice/contracts.ts";
import { facetForText, textOption } from "../../core/practice/facets.ts";
import { optionTextFieldForKind } from "../../core/practice/option-fields.ts";

export function inventedTextOption(
	text: string,
	field: "front" | "back",
	subject?: PracticeSubject,
): PracticeOptionPart {
	return {
		id: `inv_${nanoid(10)}`,
		type: "text",
		text,
		facet: facetForText(field, subject),
		source: "invented",
	};
}

export function shuffleOptions(options: PracticeOptionPart[], seed: string): PracticeOptionPart[] {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return [...options].sort((a, b) => {
		h = (h * 1664525 + 1013904223) >>> 0;
		const ra = h % 1000;
		h = (h * 1664525 + 1013904223) >>> 0;
		const rb = h % 1000;
		return ra - rb || a.id.localeCompare(b.id);
	});
}

export function buildTextPickOptions(
	kind: string,
	source: PracticeEntry,
	distractorEntries: PracticeEntry[],
	inventedTexts: string[],
	subject?: PracticeSubject,
	shuffleSeed?: string,
): PracticeOptionPart[] | null {
	const field = optionTextFieldForKind(kind);
	if (!field) return null;
	const correct = { ...textOption(source.entryId, field === "back" ? source.back : source.front, field, subject), source: "entry" as const };
	const fromEntries = distractorEntries.map((e) => ({
		...textOption(e.entryId, field === "back" ? e.back : e.front, field, subject),
		source: "entry" as const,
	}));
	const invented = inventedTexts.map((t) => inventedTextOption(t, field, subject));
	const all = [correct, ...fromEntries, ...invented];
	if (all.length !== 4) return null;
	const texts = new Set(all.filter((o) => o.type === "text").map((o) => o.text.trim().toLowerCase()));
	if (texts.size !== 4) return null;
	return shuffleSeed ? shuffleOptions(all, shuffleSeed) : all;
}
