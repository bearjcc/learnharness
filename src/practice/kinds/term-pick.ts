import type { ItemKindPlugin } from "./types.ts";
import { baseItem } from "./shared.ts";
import { promptPartText, validateItemFacets } from "../../core/practice/facets.ts";
import { buildTextPickOptions } from "./option-build.ts";
import { finishTextPickCheck } from "./text-pick-check.ts";

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
	buildModelPrompt(entry, options, hints) {
		const inv =
			hints?.inventedCount
				? ` Invent ${hints.inventedCount} additional wrong meanings in the same language as the correct answer (plausible but false).`
				: "";
		return {
			system: `Write a short quiz question. The correct answer is fixed; distractors may include invented wrong meanings.${inv}`,
			user: `Term: ${entry.front}\nCorrect meaning: ${entry.back}\nPeer meanings: ${options.map((o) => o.back).join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model, ctx) {
		const subject = ctx?.subject;
		const invented = ctx?.inventedDistractors ?? model?.inventedDistractors ?? [];
		const options = buildTextPickOptions(
			"term-pick",
			entry,
			optionEntries,
			invented,
			subject,
			ctx?.shuffleSeed,
		);
		if (!options) return null;
		return baseItem(
			"term-pick",
			entry,
			optionEntries,
			entry.entryId,
			[promptPartText(model?.prompt ?? `What does "${entry.front}" mean?`, "front", subject)],
			options,
			model?.explain,
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (item.options.length !== 4) errors.push("need 4 options");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct id");
		const correct = item.options.find((o) => o.id === source.entryId);
		if (!correct || correct.source === "invented") errors.push("correct must be entry-sourced");
		for (const opt of item.options) {
			if (opt.type !== "text" || !opt.text.trim()) errors.push("text option required");
		}
		errors.push(...validateItemFacets(item, ctx.subject, ctx.entriesById));
		return { ok: errors.length === 0, errors };
	},
	async checkAsync(item, source, ctx, assembleCtx) {
		return finishTextPickCheck(item, source, ctx, assembleCtx, this.check(item, source, ctx).errors);
	},
};
