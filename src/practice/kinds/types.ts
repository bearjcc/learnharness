import type { PracticeDailyItem, PracticeEntry } from "../../core/practice/contracts.ts";

export interface KindCheckContext {
	mediaFileExists: (token: string) => boolean;
	entriesById: Map<string, PracticeEntry>;
}

export interface ItemKindPlugin {
	kind: string;
	appliesTo(entry: PracticeEntry): boolean;
	/** JSON schema fragment for model `format` (question + explain only). */
	modelSchema: Record<string, unknown>;
	buildModelPrompt(entry: PracticeEntry, optionEntries: PracticeEntry[]): { system: string; user: string };
	/** Assemble a card from fixed options + optional model wording. */
	assemble(
		entry: PracticeEntry,
		optionEntries: PracticeEntry[],
		model?: { prompt?: string; explain?: string },
	): PracticeDailyItem | null;
	check(item: PracticeDailyItem, source: PracticeEntry, ctx: KindCheckContext): { ok: boolean; errors: string[] };
}
