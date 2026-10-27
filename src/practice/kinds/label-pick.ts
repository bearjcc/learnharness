import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";
import type { PracticeEntry } from "../../core/practice/contracts.ts";

function imageToken(entry: PracticeEntry): string | null {
	if (!entry.media || entry.media.kind === "audio") return null;
	return entry.media.ref;
}

/** Reverse of image-pick: image prompt, four text labels. */
export const labelPickKind: ItemKindPlugin = {
	kind: "label-pick",
	appliesTo: (e) => e.type === "visual" && !!imageToken(e),
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
	assemble(entry, optionEntries, model) {
		const token = imageToken(entry);
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
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct");
		if (item.options.length !== 4) errors.push("need 4");
		const img = item.prompt.find((p) => p.type === "image");
		if (!img || !ctx.mediaFileExists(img.token)) errors.push("prompt image missing");
		for (const opt of item.options) {
			if (opt.type !== "text" || !ctx.entriesById.has(opt.id)) errors.push("bad text option");
		}
		return { ok: errors.length === 0, errors };
	},
};
