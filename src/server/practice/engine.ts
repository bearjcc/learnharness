import { selectDistractors } from "../../core/practice/distractors.ts";
import { pickMediaVariant } from "../../core/practice/media-variants.ts";
import type { PracticeDailyItem, PracticeEntry, PracticeSubject } from "../../core/practice/contracts.ts";
import { applicableKinds, kindFor } from "../../practice/kinds/registry.ts";
import type { KindCheckContext } from "../../practice/kinds/types.ts";
import { practiceStore } from "../../store/practice.ts";
import { completeLocalJson } from "./local-complete.ts";

export function buildCheckContext(entries: PracticeEntry[]): KindCheckContext {
	const entriesById = new Map(entries.map((e) => [e.entryId, e]));
	return {
		entriesById,
		mediaFileExists: (token) => practiceStore.mediaExists(token),
	};
}

export async function buildItemForEntry(
	subject: PracticeSubject,
	entry: PracticeEntry,
	allEntries: PracticeEntry[],
	modelId: string | undefined,
	fetchImpl?: typeof fetch,
): Promise<PracticeDailyItem | null> {
	const kindIds = subject.itemKinds.length ? subject.itemKinds : applicableKinds(entry).map((k) => k.kind);
	const kind = kindIds.map((id) => kindFor(entry, id)).find(Boolean);
	if (!kind) return null;
	const today = new Date().toISOString().slice(0, 10);
	const mediaVariant = pickMediaVariant(subject, entry, `${subject.subjectId}:${entry.entryId}:${today}`);
	const needsVariant = kind.kind === "image-pick" || kind.kind === "label-pick";
	if (needsVariant && !mediaVariant) return null;
	const distractors = selectDistractors(
		entry,
		allEntries.filter((e) => e.status === "confirmed"),
		3,
		{
			...(mediaVariant ? { mediaVariant } : {}),
			bias: subject.mediaVariants?.distractorBias,
		},
	);
	if (distractors.length < 3) return null;
	let modelOut: { prompt?: string; explain?: string } | undefined;
	if (modelId && process.env.LH_PRACTICE_SKIP_LLM !== "1") {
		const { system, user } = kind.buildModelPrompt(entry, distractors);
		const parsed = await completeLocalJson(
			modelId,
			[{ role: "system", content: system }, { role: "user", content: user }],
			kind.modelSchema,
			fetchImpl,
		);
		if (parsed) {
			modelOut = {
				prompt: typeof parsed.prompt === "string" ? parsed.prompt : undefined,
				explain: typeof parsed.explain === "string" ? parsed.explain : undefined,
			};
		}
	}
	const item = kind.assemble(entry, distractors, modelOut, mediaVariant ? { mediaVariant } : undefined);
	if (!item) return null;
	const check = kind.check(item, entry, buildCheckContext(allEntries));
	return check.ok ? item : null;
}
