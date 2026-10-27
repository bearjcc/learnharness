import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";
import { imageOption, promptPartText, validateItemFacets } from "../../core/practice/facets.ts";
import { imageTokenForEntry, visualEntryHasImage } from "./visual-media.ts";

export const imagePickKind: ItemKindPlugin = {
	kind: "image-pick",
	appliesTo: (e) => e.type === "visual" && visualEntryHasImage(e),
	modelSchema: {
		type: "object",
		properties: { prompt: { type: "string" }, explain: { type: "string" } },
		required: ["prompt"],
		additionalProperties: false,
	},
	buildModelPrompt(entry, options, _hints?) {
		return {
			system: "Write a recognition question. Options are fixed images.",
			user: `Label: ${entry.front}\nDistractor labels: ${options.map((o) => o.front).join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model, ctx) {
		const mediaVariant = ctx?.mediaVariant;
		const subject = ctx?.subject;
		if (!mediaVariant) return null;
		const all = [entry, ...optionEntries];
		if (!fourDistinct(all)) return null;
		const shuffled = [...all].sort((a, b) => a.entryId.localeCompare(b.entryId));
		const options = shuffled
			.map((e) => {
				const token = imageTokenForEntry(e, mediaVariant);
				if (!token) return null;
				return imageOption(e.entryId, token, mediaVariant);
			})
			.filter((o): o is NonNullable<typeof o> => o !== null);
		if (options.length !== 4) return null;
		return baseItem(
			"image-pick",
			entry,
			shuffled,
			entry.entryId,
			[promptPartText(model?.prompt ?? entry.front, "front", subject)],
			options,
			model?.explain,
			mediaVariant,
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (!item.mediaVariant) errors.push("missing mediaVariant");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct");
		if (item.options.length !== 4) errors.push("need 4 options");
		const variant = item.mediaVariant;
		for (const opt of item.options) {
			if (opt.type !== "image") {
				errors.push("image options required");
				continue;
			}
			if (!ctx.mediaFileExists(opt.token)) errors.push(`missing media ${opt.token}`);
			const ent = ctx.entriesById.get(opt.id);
			if (!variant || !ent) continue;
			const expected = imageTokenForEntry(ent, variant);
			if (!expected || expected !== opt.token) errors.push("option media mismatch");
		}
		const srcToken = variant ? imageTokenForEntry(source, variant) : null;
		if (!srcToken || !ctx.mediaFileExists(srcToken)) errors.push("source image missing");
		errors.push(...validateItemFacets(item, ctx.subject, ctx.entriesById));
		return { ok: errors.length === 0, errors };
	},
};
