import type { ItemKindPlugin } from "./types.ts";
import { grooveNotationCacheToken, resolveGrooveAbc } from "../../core/practice/groove.ts";
import { renderGrooveAbcToSvg } from "../groove-render.ts";
import { practiceStore } from "../../store/practice.ts";
import { baseItem, fourDistinct } from "./shared.ts";

function cachedGrooveImageToken(abc: string): string {
	const token = grooveNotationCacheToken(abc);
	if (!practiceStore.mediaExists(token)) {
		const svg = renderGrooveAbcToSvg(abc);
		practiceStore.writeMedia(token, Buffer.from(svg, "utf-8"));
	}
	return token;
}

export const grooveIdKind: ItemKindPlugin = {
	kind: "groove-id",
	appliesTo: (e) => e.type === "groove",
	modelSchema: {
		type: "object",
		properties: { prompt: { type: "string" }, explain: { type: "string" } },
		required: ["prompt"],
		additionalProperties: false,
	},
	buildModelPrompt(entry, options) {
		return {
			system: "Name the groove pattern shown.",
			user: `Correct: ${entry.front}\nOther names: ${options.map((o) => o.front).join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model) {
		const abc = resolveGrooveAbc(entry.back, entry.front);
		if (!abc) return null;
		const all = [entry, ...optionEntries];
		if (!fourDistinct(all)) return null;
		const token = cachedGrooveImageToken(abc);
		const shuffled = [...all].sort((a, b) => a.entryId.localeCompare(b.entryId));
		const options = shuffled.map((e) => ({ id: e.entryId, type: "text" as const, text: e.front }));
		return baseItem(
			"groove-id",
			entry,
			shuffled,
			entry.entryId,
			[{ type: "image", token }, { type: "text", text: model?.prompt ?? "Name this groove." }],
			options,
			model?.explain,
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (!resolveGrooveAbc(source.back, source.front)) errors.push("invalid groove notation");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct");
		if (item.options.length !== 4) errors.push("need 4 options");
		for (const opt of item.options) {
			if (opt.type !== "text" || !ctx.entriesById.has(opt.id)) errors.push("bad option");
		}
		return { ok: errors.length === 0, errors };
	},
};
