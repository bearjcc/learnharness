import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";
import { facetForMedia } from "../../core/practice/facets.ts";
import { buildTextPickOptions } from "./option-build.ts";
import { finishTextPickCheck } from "./text-pick-check.ts";
import { imageTokenForEntry, visualEntryHasImage } from "./visual-media.ts";
import { validateItemFacets } from "../../core/practice/facets.ts";

export const labelPickKind: ItemKindPlugin = {
	kind: "label-pick",
	appliesTo: (e) => e.type === "visual" && visualEntryHasImage(e),
	modelSchema: {
		type: "object",
		properties: { explain: { type: "string" } },
		additionalProperties: false,
	},
	buildModelPrompt(entry, options, hints) {
		const inv =
			hints?.inventedCount
				? ` Invent ${hints.inventedCount} wrong country/labels in the same language as the correct label.`
				: "";
		return {
			system: `Optional one-line hint only.${inv}`,
			user: `Image shows: ${entry.front}. Labels: ${[entry.front, ...options.map((o) => o.front)].join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model, ctx) {
		const mediaVariant = ctx?.mediaVariant;
		const subject = ctx?.subject;
		if (!mediaVariant) return null;
		const token = imageTokenForEntry(entry, mediaVariant);
		if (!token) return null;
		const invented = ctx?.inventedDistractors ?? model?.inventedDistractors ?? [];
		if (invented.length === 0) {
			const all = [entry, ...optionEntries];
			if (!fourDistinct(all)) return null;
		}
		const options = buildTextPickOptions(
			"label-pick",
			entry,
			optionEntries,
			invented,
			subject,
			ctx?.shuffleSeed,
		);
		if (!options) return null;
		return baseItem(
			"label-pick",
			entry,
			optionEntries,
			entry.entryId,
			[{ type: "image", token, facet: facetForMedia(mediaVariant) }],
			options,
			model?.explain,
			mediaVariant,
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (!item.mediaVariant) errors.push("missing mediaVariant");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct");
		if (item.options.length !== 4) errors.push("need 4");
		const variant = item.mediaVariant;
		const img = item.prompt.find((p) => p.type === "image");
		if (!img || !ctx.mediaFileExists(img.token)) errors.push("prompt image missing");
		if (variant && img?.facet?.mediaVariant !== variant) errors.push("prompt image variant mismatch");
		const correct = item.options.find((o) => o.id === source.entryId);
		if (!correct || correct.source === "invented") errors.push("correct must be entry-sourced");
		errors.push(...validateItemFacets(item, ctx.subject, ctx.entriesById));
		return { ok: errors.length === 0, errors };
	},
	async checkAsync(item, source, ctx, assembleCtx) {
		return finishTextPickCheck(item, source, ctx, assembleCtx, this.check(item, source, ctx).errors);
	},
};
