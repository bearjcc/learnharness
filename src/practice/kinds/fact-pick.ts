import type { ItemKindPlugin } from "./types.ts";
import { baseItem, fourDistinct } from "./shared.ts";
import { promptPartText, validateItemFacets } from "../../core/practice/facets.ts";
import { buildTextPickOptions } from "./option-build.ts";
import { finishTextPickCheck } from "./text-pick-check.ts";

export const factPickKind: ItemKindPlugin = {
	kind: "fact-pick",
	appliesTo: (e) => e.type === "fact",
	modelSchema: {
		type: "object",
		properties: { prompt: { type: "string" }, explain: { type: "string" } },
		required: ["prompt"],
		additionalProperties: false,
	},
	buildModelPrompt(entry, options, hints) {
		const inv =
			hints?.inventedCount
				? ` Invent ${hints.inventedCount} false answers in the same language/register as the correct answer.`
				: "";
		return {
			system: `Write a concise fact-check question.${inv}`,
			user: `Fact: ${entry.front}\nAnswer: ${entry.back}\nPeer answers: ${options.map((o) => o.back).join(" | ")}`,
		};
	},
	assemble(entry, optionEntries, model, ctx) {
		const subject = ctx?.subject;
		const invented = ctx?.inventedDistractors ?? model?.inventedDistractors ?? [];
		if (invented.length === 0 && optionEntries.length === 3) {
			if (!fourDistinct([entry, ...optionEntries])) return null;
		}
		const options = buildTextPickOptions(
			"fact-pick",
			entry,
			optionEntries,
			invented,
			subject,
			ctx?.shuffleSeed,
		);
		if (!options) return null;
		return baseItem(
			"fact-pick",
			entry,
			optionEntries,
			entry.entryId,
			[promptPartText(model?.prompt ?? entry.front, "front", subject)],
			options,
			model?.explain,
		);
	},
	check(item, source, ctx) {
		const errors: string[] = [];
		if (item.options.length !== 4) errors.push("need 4 options");
		if (item.correctOptionId !== source.entryId) errors.push("wrong correct");
		const correct = item.options.find((o) => o.id === source.entryId);
		if (!correct || correct.source === "invented") errors.push("correct must be entry-sourced");
		errors.push(...validateItemFacets(item, ctx.subject, ctx.entriesById));
		return { ok: errors.length === 0, errors };
	},
	async checkAsync(item, source, ctx, assembleCtx) {
		return finishTextPickCheck(item, source, ctx, assembleCtx, this.check(item, source, ctx).errors);
	},
};
