import type { ItemKindPlugin } from "./types.ts";
import { parseGrooveGrid, renderGrooveSvg } from "../../core/practice/groove.ts";
import { baseItem, fourDistinct } from "./shared.ts";

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
		const grid = parseGrooveGrid(entry.back);
		if (!grid) return null;
		const all = [entry, ...optionEntries];
		if (!fourDistinct(all)) return null;
		const svg = renderGrooveSvg(grid);
		const token = `inline:${Buffer.from(svg).toString("base64url")}`;
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
		if (!parseGrooveGrid(source.back)) errors.push("invalid groove grid");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct");
		if (item.options.length !== 4) errors.push("need 4 options");
		for (const opt of item.options) {
			if (opt.type !== "text" || !ctx.entriesById.has(opt.id)) errors.push("bad option");
		}
		return { ok: errors.length === 0, errors };
	},
};
