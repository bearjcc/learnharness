import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";

export const termPickKind: ItemKindPlugin = {
	kind: "term-pick",
	appliesTo: (e) => e.type === "term",
	modelSchema: {
		type: "object",
		properties: {
			prompt: { type: "string" },
			explain: { type: "string" },
		},
		required: ["prompt"],
		additionalProperties: false,
	},
	buildModelPrompt(entry, options) {
		return {
			system: "Write a short quiz question. Do not invent answers; options are fixed.",
			user: `Term: ${entry.front}\nCorrect meaning: ${entry.back}\nDistractors: ${options.map((o) => o.back).join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model) {
		const all = [entry, ...optionEntries];
		if (!fourDistinct(all)) return null;
		const shuffled = [...all].sort((a, b) => a.entryId.localeCompare(b.entryId));
		const options = shuffled.map((e) => ({ id: e.entryId, type: "text" as const, text: e.back }));
		return baseItem(
			"term-pick",
			entry,
			shuffled,
			entry.entryId,
			[{ type: "text", text: model?.prompt ?? `What does "${entry.front}" mean?` }],
			options,
			model?.explain,
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (item.options.length !== 4) errors.push("need 4 options");
		const ids = new Set(item.options.map((o) => o.id));
		if (ids.size !== 4) errors.push("options must be distinct");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct id");
		for (const opt of item.options) {
			if (opt.type !== "text" || !opt.text.trim()) errors.push("text option required");
			if (!ctx.entriesById.has(opt.id)) errors.push(`unknown option ${opt.id}`);
		}
		return { ok: errors.length === 0, errors };
	},
};
