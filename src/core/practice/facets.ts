import type {
	PracticeDailyItem,
	PracticeEntry,
	PracticeFacet,
	PracticeOptionPart,
	PracticeRenderPart,
	PracticeSubject,
} from "./contracts.ts";
import { isInventedOptionId } from "./invented-distractors.ts";
import { KIND_OPTION_FIELD } from "./option-fields.ts";

export type { PracticeFacet, EntryField } from "./contracts.ts";

export interface PracticeFormHeuristic {
	/** Reject when max/min word count among text options exceeds this ratio (default 3). */
	maxWordCountRatio?: number;
}

export function langForSide(subject: PracticeSubject | undefined, field: "front" | "back"): string | undefined {
	return subject?.sideLanguages?.[field];
}

export function facetForText(field: "front" | "back", subject?: PracticeSubject): PracticeFacet {
	return { field, valueKind: "text", lang: langForSide(subject, field) };
}

export function facetForMedia(mediaVariant: string): PracticeFacet {
	return { field: "media", valueKind: "image", mediaVariant };
}

export function facetKey(f: PracticeFacet): string {
	return `${f.field}|${f.valueKind}|${f.lang ?? ""}|${f.mediaVariant ?? ""}`;
}

const TRANSLATION_KINDS = new Set(["term-pick", "meaning-pick"]);

function isTranslationSubject(subject: PracticeSubject | undefined): boolean {
	const f = subject?.sideLanguages?.front;
	const b = subject?.sideLanguages?.back;
	return Boolean(f && b && f !== b);
}

function wordCount(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

function promptTextLangs(item: PracticeDailyItem): string[] {
	const langs: string[] = [];
	for (const p of item.prompt) {
		if (p.type === "text" && p.facet?.lang) langs.push(p.facet.lang);
	}
	return langs;
}

function optionFacet(opt: PracticeOptionPart): PracticeFacet | null {
	if (!opt.facet) return null;
	return opt.facet;
}

export function textOption(
	id: string,
	text: string,
	field: "front" | "back",
	subject?: PracticeSubject,
): PracticeOptionPart {
	return { id, type: "text", text, facet: facetForText(field, subject) };
}

export function imageOption(
	id: string,
	token: string,
	mediaVariant: string,
): PracticeOptionPart {
	return { id, type: "image", token, facet: facetForMedia(mediaVariant) };
}

export function validateItemFacets(
	item: PracticeDailyItem,
	subject: PracticeSubject | undefined,
	entriesById: Map<string, PracticeEntry>,
): string[] {
	const errors: string[] = [];
	const expectedField = KIND_OPTION_FIELD[item.kind];
	if (!expectedField) return errors;

	const facets = item.options.map((o) => optionFacet(o));
	if (facets.some((f) => !f)) {
		errors.push("every option must carry a facet");
		return errors;
	}
	const keys = facets.map((f) => facetKey(f!));
	if (new Set(keys).size !== 1) {
		errors.push("option facets differ");
	}

	for (const opt of item.options) {
		const f = opt.facet!;
		if (f.field !== expectedField) {
			errors.push(`option ${opt.id} uses wrong field ${f.field}`);
		}
		const invented = opt.source === "invented" || isInventedOptionId(opt.id);
		if (invented) continue;
		const ent = entriesById.get(opt.id);
		if (!ent) {
			errors.push(`unknown option entry ${opt.id}`);
			continue;
		}
		if (expectedField === "back" && opt.type === "text" && opt.text !== ent.back) {
			errors.push(`option ${opt.id} text not from entry back`);
		}
		if (expectedField === "front" && opt.type === "text" && opt.text !== ent.front) {
			errors.push(`option ${opt.id} text not from entry front`);
		}
		if (expectedField === "media" && opt.type === "image" && item.mediaVariant) {
			if (f.mediaVariant !== item.mediaVariant) {
				errors.push(`option ${opt.id} media variant mismatch`);
			}
		}
	}

	if (TRANSLATION_KINDS.has(item.kind) && isTranslationSubject(subject)) {
		const promptLangs = new Set(promptTextLangs(item));
		const optionLang = facets[0]?.lang;
		if (optionLang && promptLangs.has(optionLang)) {
			errors.push("options share language with prompt on translation pick");
		}
		for (const p of item.prompt) {
			if (p.type !== "text" || !p.facet) continue;
			if (p.facet.field === expectedField) {
				errors.push("prompt uses same entry field as answers");
			}
		}
	}

	const ratio =
		subject?.formHeuristic?.maxWordCountRatio ?? 3;
	const textOpts = item.options.filter((o) => o.type === "text");
	if (textOpts.length >= 2 && ratio > 0) {
		const counts = textOpts.map((o) => wordCount(o.text));
		const min = Math.min(...counts);
		const max = Math.max(...counts);
		if (min > 0 && max / min > ratio) {
			errors.push("option word counts differ too much");
		}
	}

	return errors;
}

export function promptPartText(text: string, field: "front" | "back", subject?: PracticeSubject): PracticeRenderPart {
	return { type: "text", text, facet: facetForText(field, subject) };
}
