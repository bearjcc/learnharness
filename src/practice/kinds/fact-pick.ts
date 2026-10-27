import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";

export const factPickKind: ItemKindPlugin = {
	kind: "fact-pick",
	appliesTo: (e) => e.type === "fact",
	modelSchema: {
		type: "object",
		properties: { prompt: { type: "string" }, explain: { type: "string" } },
		required: ["prompt"],
		additionalProperties: false,
	},
	buildModelPrompt(entry, options) {
		return {
			system: "Write a concise fact-check question.",
			user: `Fact: ${entry.front}\nAnswer: ${entry.back}\nDistractors: ${options.map((o) => o.back).join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model) {
		const all = [entry, ...optionEntries];
		if (!fourDistinct(all)) return null;
		const shuffled = [...all].sort((a, b) => a.entryId.localeCompare(b.entryId));
		const options = shuffled.map((e) => ({ id: e.entryId, type: "text" as const, text: e.back }));
		return baseItem(
			"fact-pick",
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
		if (item.options.length !== 4) errors.push("need 4 options");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct");
		for (const opt of item.options) {
			if (opt.type !== "text" || !ctx.entriesById.has(opt.id)) errors.push("invalid option");
		}
		return { ok: errors.length === 0, errors };
	},
};
