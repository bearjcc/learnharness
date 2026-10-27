import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";

export const meaningPickKind: ItemKindPlugin = {
	kind: "meaning-pick",
	appliesTo: (e) => e.type === "term",
	modelSchema: {
		type: "object",
		properties: { prompt: { type: "string" }, explain: { type: "string" } },
		required: ["prompt"],
		additionalProperties: false,
	},
	buildModelPrompt(entry, options) {
		return {
			system: "Write a short reverse-definition question.",
			user: `Meaning: ${entry.back}\nTerms: ${[entry.front, ...options.map((o) => o.front)].join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model) {
		const all = [entry, ...optionEntries];
		if (!fourDistinct(all)) return null;
		const shuffled = [...all].sort((a, b) => a.entryId.localeCompare(b.entryId));
		const options = shuffled.map((e) => ({ id: e.entryId, type: "text" as const, text: e.front }));
		return baseItem(
			"meaning-pick",
			entry,
			shuffled,
			entry.entryId,
			[{ type: "text", text: model?.prompt ?? `Which term means: ${entry.back}?` }],
			options,
			model?.explain,
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (item.options.length !== 4) errors.push("need 4 options");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct id");
		for (const opt of item.options) {
			if (opt.type !== "text") errors.push("text options only");
			if (!ctx.entriesById.has(opt.id)) errors.push("unknown option");
		}
		return { ok: errors.length === 0, errors };
	},
};
