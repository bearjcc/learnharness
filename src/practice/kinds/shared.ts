import type { PracticeDailyItem, PracticeEntry } from "../../core/practice/contracts.ts";
import { nanoid } from "nanoid";

export function baseItem(
	kind: string,
	entry: PracticeEntry,
	optionEntries: PracticeEntry[],
	correctOptionId: string,
	prompt: PracticeDailyItem["prompt"],
	options: PracticeDailyItem["options"],
	explain?: string,
): PracticeDailyItem {
	return {
		id: `card_${nanoid(12)}`,
		kind,
		subjectId: entry.subjectId,
		entryId: entry.entryId,
		correctOptionId,
		optionIds: optionEntries.map((e) => e.entryId),
		prompt,
		options,
		...(explain ? { explain } : {}),
		...(entry.tags?.length ? { tags: entry.tags } : {}),
	};
}

export function fourDistinct(entries: PracticeEntry[]): boolean {
	return entries.length === 4 && new Set(entries.map((e) => e.entryId)).size === 4;
}
