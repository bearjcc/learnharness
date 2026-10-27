import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";
import type { PracticeEntry } from "../../core/practice/contracts.ts";

function imageToken(entry: PracticeEntry): string | null {
	if (!entry.media || entry.media.kind === "audio") return null;
	return entry.media.ref;
}

export const imagePickKind: ItemKindPlugin = {
	kind: "image-pick",
	appliesTo: (e) => e.type === "visual" && !!imageToken(e),
	modelSchema: {
		type: "object",
		properties: { prompt: { type: "string" }, explain: { type: "string" } },
		required: ["prompt"],
		additionalProperties: false,
	},
	buildModelPrompt(entry, options) {
		return {
			system: "Write a recognition question. Options are fixed images.",
			user: `Label: ${entry.front}\nDistractor labels: ${options.map((o) => o.front).join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model) {
		const all = [entry, ...optionEntries];
		if (!fourDistinct(all)) return null;
		const shuffled = [...all].sort((a, b) => a.entryId.localeCompare(b.entryId));
		const options = shuffled
			.map((e) => {
				const token = imageToken(e);
				if (!token) return null;
				return { id: e.entryId, type: "image" as const, token };
			})
			.filter((o): o is NonNullable<typeof o> => o !== null);
		if (options.length !== 4) return null;
		return baseItem(
			"image-pick",
			entry,
			shuffled,
			entry.entryId,
			[{ type: "text", text: model?.prompt ?? entry.front }],
			options,
			model?.explain,
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct");
		if (item.options.length !== 4) errors.push("need 4 options");
		const tokens = new Set<string>();
		for (const opt of item.options) {
			if (opt.type !== "image") {
				errors.push("image options required");
				continue;
			}
			if (!ctx.mediaFileExists(opt.token)) errors.push(`missing media ${opt.token}`);
			if (tokens.has(opt.token)) errors.push("duplicate image file");
			tokens.add(opt.token);
			const ent = ctx.entriesById.get(opt.id);
			if (!ent?.media?.ref || ent.media.ref !== opt.token) errors.push("option media mismatch");
		}
		const srcToken = imageToken(source);
		if (!srcToken || !ctx.mediaFileExists(srcToken)) errors.push("source image missing");
		return { ok: errors.length === 0, errors };
	},
};
