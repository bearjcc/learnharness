import type { PracticeDailyItem, PracticeEntry, PracticeSubject } from "../../core/practice/contracts.ts";
import type { EmbedFn } from "../../core/practice/invented-distractors.ts";

export interface KindCheckContext {
	mediaFileExists: (token: string) => boolean;
	entriesById: Map<string, PracticeEntry>;
	subject?: PracticeSubject;
}

export interface AssembleContext {
	subject?: PracticeSubject;
	mediaVariant?: string;
	inventedDistractors?: string[];
	embed?: EmbedFn;
	confirmedPool?: PracticeEntry[];
	shuffleSeed?: string;
}

export interface ModelPromptHints {
	inventedCount?: number;
}

export interface ModelOutput {
	prompt?: string;
	explain?: string;
	inventedDistractors?: string[];
}

export interface ItemKindPlugin {
	kind: string;
	appliesTo(entry: PracticeEntry): boolean;
	modelSchema: Record<string, unknown>;
	buildModelPrompt(
		entry: PracticeEntry,
		optionEntries: PracticeEntry[],
		hints?: ModelPromptHints,
	): { system: string; user: string };
	assemble(
		entry: PracticeEntry,
		optionEntries: PracticeEntry[],
		model?: ModelOutput,
		ctx?: AssembleContext,
	): PracticeDailyItem | null;
	check(item: PracticeDailyItem, source: PracticeEntry, ctx: KindCheckContext): { ok: boolean; errors: string[] };
	checkAsync?(
		item: PracticeDailyItem,
		source: PracticeEntry,
		ctx: KindCheckContext,
		assembleCtx?: AssembleContext,
	): Promise<{ ok: boolean; errors: string[] }>;
}
