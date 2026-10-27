import type { PracticeDailyItem, PracticeEntry } from "../../core/practice/contracts.ts";
import { validateInventedOptionsOnItem } from "../../core/practice/invented-distractors.ts";
import type { AssembleContext, KindCheckContext } from "./types.ts";

export async function finishTextPickCheck(
	item: PracticeDailyItem,
	source: PracticeEntry,
	ctx: KindCheckContext,
	assembleCtx: AssembleContext | undefined,
	baseErrors: string[],
): Promise<{ ok: boolean; errors: string[] }> {
	const errors = [...baseErrors];
	errors.push(
		...(await validateInventedOptionsOnItem(
			item,
			source,
			assembleCtx?.confirmedPool ?? [...ctx.entriesById.values()],
			ctx.subject,
			assembleCtx?.embed,
		)),
	);
	return { ok: errors.length === 0, errors };
}
