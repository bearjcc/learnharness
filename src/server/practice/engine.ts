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
import { isTopicHintEntry } from "../../core/practice/topic-hint.ts";
import { isIdentityItemKind } from "../../core/practice/identity-kinds.ts";
import { identityPromptFor } from "../../core/practice/identity-prompt.ts";
import {
	ensureSourcedEntryReady,
	subjectUsesSourcing,
	trySourcedFactPickItem,
} from "./sourced-item.ts";

export interface BuildItemOptions {
	embed?: EmbedFn;
	/** Pre-written fact-pick stem (sourced fact cards). */
	templatedFactPrompt?: string;
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
	let working = entry;
	if (subjectUsesSourcing(subject)) {
		const ready = await ensureSourcedEntryReady(subject, entry, fetchImpl);
		if (!ready) return null;
		working = ready;
		if (isTopicHintEntry(working)) return null;
	}

	const kindIds = subject.itemKinds.length ? subject.itemKinds : applicableKinds(working).map((k) => k.kind);
	const kind = kindIds.map((id) => kindFor(working, id)).find(Boolean);
	if (!kind) return null;

	if (subjectUsesSourcing(subject) && kind.kind === "fact-pick" && !opts.templatedFactPrompt) {
		return trySourcedFactPickItem(subject, working, allEntries, modelId, fetchImpl);
	}

	const today = new Date().toISOString().slice(0, 10);
	const seed = `${subject.subjectId}:${working.entryId}:${today}`;
	const mediaVariant = pickMediaVariant(subject, working, seed);
	const needsVariant = kind.kind === "image-pick" || kind.kind === "label-pick";
	if (needsVariant && !mediaVariant) return null;

	const identityTemplated = subjectUsesSourcing(subject) && isIdentityItemKind(kind.kind);
	const templatePlan = identityTemplated ? identityPromptFor(kind.kind, subject, working) : undefined;

	const mix = planDistractorMix(subject, kind.kind, 3, seed);
	const pool = allEntries.filter((e) => e.status === "confirmed");
	const entryDistractors = selectDistractors(working, pool, mix.fromEntries, {
		...(mediaVariant ? { mediaVariant } : {}),
		bias: subject.mediaVariants?.distractorBias,
		...(templatePlan?.excludeGroup ? { excludeGroup: templatePlan.excludeGroup } : {}),
	});

	const needInvented = mix.invented;
	const canInvent = needInvented > 0 && supportsInventedDistractors(kind.kind);
	if (entryDistractors.length < mix.fromEntries) return null;
	if (entryDistractors.length + (canInvent ? needInvented : 0) < 3) return null;
	if (needInvented > 0 && !canInvent) return null;

	let modelOut: { prompt?: string; explain?: string; inventedDistractors?: string[] } | undefined;
	const skipLlm = process.env.LH_PRACTICE_SKIP_LLM === "1";

	if (opts.templatedFactPrompt) {
		modelOut = { prompt: opts.templatedFactPrompt, explain: working.explain?.trim() || undefined };
	} else if (identityTemplated && templatePlan) {
		modelOut = { prompt: templatePlan.prompt, explain: templatePlan.explain || undefined };
	} else if (canInvent && needInvented > 0 && !skipLlm && modelId) {
		const { system, user } = kind.buildModelPrompt(working, entryDistractors, {
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
	} else if (modelId && !skipLlm && !identityTemplated) {
		const { system, user } = kind.buildModelPrompt(working, entryDistractors);
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
	} else if (!identityTemplated && !opts.templatedFactPrompt) {
		modelOut = undefined;
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

	const item = kind.assemble(working, entryDistractors, modelOut, assembleCtx);
	if (!item) return null;
	const ctx = buildCheckContext(allEntries, subject);
	const check = kind.checkAsync
		? await kind.checkAsync(item, working, ctx, assembleCtx)
		: kind.check(item, working, ctx);
	return check.ok ? item : null;
}
