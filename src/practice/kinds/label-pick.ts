import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";
import type { PracticeEntry } from "../../core/practice/contracts.ts";
import { assertConsistentMediaVariant } from "../../core/practice/media-variants.ts";
import { imageTokenForEntry, visualEntryHasImage } from "./visual-media.ts";

/** Reverse of image-pick: image prompt, four text labels. */
export const labelPickKind: ItemKindPlugin = {
	kind: "label-pick",
	appliesTo: (e) => e.type === "visual" && visualEntryHasImage(e),
	modelSchema: {
		type: "object",
		properties: { explain: { type: "string" } },
		additionalProperties: false,
	},
	buildModelPrompt(entry, options) {
		return {
			system: "Optional one-line hint only.",
			user: `Image shows: ${entry.front}. Labels: ${[entry.front, ...options.map((o) => o.front)].join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model, ctx) {
		const mediaVariant = ctx?.mediaVariant;
		if (!mediaVariant) return null;
		const token = imageTokenForEntry(entry, mediaVariant);
		if (!token) return null;
		const all = [entry, ...optionEntries];
		if (!fourDistinct(all)) return null;
		const shuffled = [...all].sort((a, b) => a.entryId.localeCompare(b.entryId));
		const options = shuffled.map((e) => ({ id: e.entryId, type: "text" as const, text: e.front }));
		return baseItem(
			"label-pick",
			entry,
			shuffled,
			entry.entryId,
			[{ type: "image", token }],
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
		if (variant) {
			const expected = imageTokenForEntry(source, variant);
			if (expected && img && img.token !== expected) errors.push("prompt image variant mismatch");
		}
		for (const opt of item.options) {
			if (opt.type !== "text" || !ctx.entriesById.has(opt.id)) errors.push("bad text option");
		}
		errors.push(...assertConsistentMediaVariant(item, ctx));
		return { ok: errors.length === 0, errors };
	},
};
