import { selectDistractors } from "../../core/practice/distractors.ts";
import { planDistractorMix, supportsInventedDistractors } from "../../core/practice/distractor-plan.ts";
import { pickMediaVariant } from "../../core/practice/media-variants.ts";
import type { PracticeDailyItem, PracticeEntry, PracticeSubject } from "../../core/practice/contracts.ts";
import { applicableKinds, kindFor } from "../../practice/kinds/registry.ts";
import type { AssembleContext, KindCheckContext } from "../../practice/kinds/types.ts";
import { schemaWithInventedDistractors } from "../../practice/kinds/model-schema.ts";
import { practiceStore } from "../../store/practice.ts";
import { completeLocalJson } from "./local-complete.ts";
import { embedTextsOllama } from "./embeddings.ts";
import type { EmbedFn } from "../../core/practice/invented-distractors.ts";

export interface BuildItemOptions {
	embed?: EmbedFn;
}

export function buildCheckContext(entries: PracticeEntry[], subject?: PracticeSubject): KindCheckContext {
	const entriesById = new Map(entries.map((e) => [e.entryId, e]));
	return {
		entriesById,
		mediaFileExists: (token) => practiceStore.mediaExists(token),
		...(subject ? { subject } : {}),
	};
}

function parseInventedList(raw: unknown, count: number): string[] | null {
	if (!Array.isArray(raw) || raw.length !== count) return null;
	const texts = raw.map((v) => (typeof v === "string" ? v.trim() : ""));
	if (texts.some((t) => !t)) return null;
	return texts;
}

export async function buildItemForEntry(
	subject: PracticeSubject,
	entry: PracticeEntry,
	allEntries: PracticeEntry[],
	modelId: string | undefined,
	fetchImpl?: typeof fetch,
	opts: BuildItemOptions = {},
): Promise<PracticeDailyItem | null> {
	const kindIds = subject.itemKinds.length ? subject.itemKinds : applicableKinds(entry).map((k) => k.kind);
	const kind = kindIds.map((id) => kindFor(entry, id)).find(Boolean);
	if (!kind) return null;
	const today = new Date().toISOString().slice(0, 10);
	const seed = `${subject.subjectId}:${entry.entryId}:${today}`;
	const mediaVariant = pickMediaVariant(subject, entry, seed);
	const needsVariant = kind.kind === "image-pick" || kind.kind === "label-pick";
	if (needsVariant && !mediaVariant) return null;

	const mix = planDistractorMix(subject, kind.kind, 3, seed);
	const pool = allEntries.filter((e) => e.status === "confirmed");
	const entryDistractors = selectDistractors(entry, pool, mix.fromEntries, {
		...(mediaVariant ? { mediaVariant } : {}),
		bias: subject.mediaVariants?.distractorBias,
	});

	const needInvented = mix.invented;
	const canInvent = needInvented > 0 && supportsInventedDistractors(kind.kind);
	if (entryDistractors.length < mix.fromEntries) return null;
	if (entryDistractors.length + (canInvent ? needInvented : 0) < 3) return null;
	if (needInvented > 0 && !canInvent) return null;

	let modelOut: { prompt?: string; explain?: string; inventedDistractors?: string[] } | undefined;
	const skipLlm = process.env.LH_PRACTICE_SKIP_LLM === "1";
	if (canInvent && needInvented > 0 && !skipLlm && modelId) {
		const { system, user } = kind.buildModelPrompt(entry, entryDistractors, {
			inventedCount: needInvented,
		});
		const schema = schemaWithInventedDistractors(kind.modelSchema, needInvented);
		const parsed = await completeLocalJson(
			modelId,
			[{ role: "system", content: system }, { role: "user", content: user }],
			schema,
			fetchImpl,
		);
		if (parsed) {
			const invented = parseInventedList(parsed.inventedDistractors, needInvented);
			if (!invented) return null;
			modelOut = {
				prompt: typeof parsed.prompt === "string" ? parsed.prompt : undefined,
				explain: typeof parsed.explain === "string" ? parsed.explain : undefined,
				inventedDistractors: invented,
			};
		} else if (needInvented > 0) {
			return null;
		}
	} else if (needInvented > 0) {
		return null;
	} else if (modelId && !skipLlm) {
		const { system, user } = kind.buildModelPrompt(entry, entryDistractors);
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

	const embedFn: EmbedFn =
		opts.embed ??
		(async (texts) => embedTextsOllama(texts, fetchImpl ?? fetch));

	const assembleCtx: AssembleContext = {
		subject,
		...(mediaVariant ? { mediaVariant } : {}),
		inventedDistractors: modelOut?.inventedDistractors ?? [],
		embed: embedFn,
		confirmedPool: pool,
		shuffleSeed: seed,
	};

	const item = kind.assemble(entry, entryDistractors, modelOut, assembleCtx);
	if (!item) return null;
	const ctx = buildCheckContext(allEntries, subject);
	const check = kind.checkAsync
		? await kind.checkAsync(item, entry, ctx, assembleCtx)
		: kind.check(item, entry, ctx);
	return check.ok ? item : null;
}
