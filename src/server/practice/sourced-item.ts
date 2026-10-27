import type {
	PracticeDailyItem,
	PracticeEntry,
	PracticeSubject,
} from "../../core/practice/contracts.ts";
import { isTopicHintEntry } from "../../core/practice/topic-hint.ts";
import { quoteAppearsInChunks, parseJudgeYesNo } from "../../core/practice/sources/verify.ts";
import {
	answerSupportedByQuote,
	promptClaimsAllowed,
	quoteMatchesTopic,
} from "../../core/practice/sources/claims.ts";
import { practiceStore } from "../../store/practice.ts";
import { appendSourcedBuildLog } from "../../store/practice-sources.ts";
import { completeLocalJsonDetailed, completeLocalJson } from "./local-complete.ts";
import { buildItemForEntry } from "./engine.ts";
import { ensureSubjectSourcesCached } from "./sources/ingest.ts";
import { retrievePassages } from "./sources/retrieve.ts";
import type { SourceChunkRecord } from "../../store/practice-sources.ts";
import { verifyEntryIdentity } from "./entry-verify.ts";

const FACT_PROMPT_SCHEMA = {
	type: "object",
	properties: { prompt: { type: "string" } },
	required: ["prompt"],
	additionalProperties: false,
} as const;

export function subjectUsesSourcing(subject: PracticeSubject): boolean {
	return Boolean(subject.sources?.length) && subject.requireReview !== true;
}

function defaultJudgeModel(subject: PracticeSubject): string {
	return subject.judgeModel ?? "koda";
}

async function judgeFactPick(
	modelId: string,
	question: string,
	answer: string,
	options: string[],
	quote: string,
	fetchImpl?: typeof fetch,
): Promise<boolean> {
	const parsed = await completeLocalJson(
		modelId,
		[
			{
				role: "system",
				content:
					"You verify quiz citations. Reply JSON {\"verdict\":\"yes\"} only if the quote alone is sufficient for a reader to pick the correct answer and no other listed option is equally supported by the quote; otherwise {\"verdict\":\"no\"}.",
			},
			{
				role: "user",
				content: `Question: ${question}\nAnswer: ${answer}\nOptions: ${options.join(" | ")}\nQuote: ${quote}`,
			},
		],
		{
			type: "object",
			properties: { verdict: { type: "string", enum: ["yes", "no"] } },
			required: ["verdict"],
			additionalProperties: false,
		},
		fetchImpl,
	);
	if (!parsed || typeof parsed.verdict !== "string") return false;
	return parseJudgeYesNo(parsed.verdict);
}

function cardSourceFromChunk(chunk: SourceChunkRecord | undefined, url?: string): { url: string; label: string } | undefined {
	const u = url ?? chunk?.url;
	if (!u) return undefined;
	return { url: u, label: chunk?.title ?? chunk?.sourceId ?? "Source" };
}

function validCitationSourceId(sourceId: string, passages: SourceChunkRecord[]): boolean {
	return passages.some((p) => p.sourceId === sourceId);
}

export async function ensureSourcedEntryReady(
	subject: PracticeSubject,
	entry: PracticeEntry,
	fetchImpl?: typeof fetch,
	opts?: { offline?: boolean },
): Promise<PracticeEntry | null> {
	if (!subjectUsesSourcing(subject)) return entry;
	if (entry.status === "confirmed" && entry.citation && entry.back.trim()) return entry;
	if (!isTopicHintEntry(entry) && entry.status === "confirmed") return entry;
	return verifyEntryIdentity(subject, entry, fetchImpl ?? fetch, opts);
}

export async function trySourcedFactPickItem(
	subject: PracticeSubject,
	entry: PracticeEntry,
	allEntries: PracticeEntry[],
	modelId: string | undefined,
	fetchImpl?: typeof fetch,
	opts?: { offline?: boolean },
): Promise<PracticeDailyItem | null> {
	if (!subjectUsesSourcing(subject) || !subject.sources?.length) return null;
	if (!modelId && process.env.LH_PRACTICE_SKIP_LLM !== "1") return null;

	const ready = await ensureSourcedEntryReady(subject, entry, fetchImpl, opts);
	if (!ready || ready.status !== "confirmed" || !ready.citation) return null;

	try {
		await ensureSubjectSourcesCached(subject.sources, fetchImpl ?? fetch, opts);
	} catch {
		return null;
	}

	const topic = ready.front.trim();
	const passages = retrievePassages(topic, subject.sources, 6);
	if (!passages.length) {
		logDrop(subject.subjectId, entry.entryId, "no_passages");
		return null;
	}

	const citation = ready.citation;
	const usedChunks = passages.filter((p) => p.sourceId === citation.sourceId);
	const chunksForQuote = usedChunks.length ? usedChunks : passages;
	if (!validCitationSourceId(citation.sourceId, passages)) {
		logDrop(subject.subjectId, entry.entryId, "citation_source_id");
		return null;
	}
	if (!quoteAppearsInChunks(citation.quote, chunksForQuote)) {
		logDrop(subject.subjectId, entry.entryId, "quote_missing");
		return null;
	}
	if (!answerSupportedByQuote(ready.back, citation.quote)) {
		logDrop(subject.subjectId, entry.entryId, "quote_answer_mismatch");
		return null;
	}
	if (!quoteMatchesTopic(topic, citation.quote)) {
		logDrop(subject.subjectId, entry.entryId, "quote_topic_mismatch");
		return null;
	}

	const context = passages.map((p, i) => `[${i + 1}] (${p.sourceId}) ${p.url}\n${p.text}`).join("\n\n");
	const writerResult = await completeLocalJsonDetailed(
		modelId!,
		[
			{
				role: "system",
				content:
					"Write only a quiz question stem. Do not state new facts, numbers, or names beyond the topic. Do not include the answer.",
			},
			{
				role: "user",
				content: `Topic: ${topic}\nVerified answer (do not repeat verbatim): ${ready.back}\n\nSources:\n${context}`,
			},
		],
		FACT_PROMPT_SCHEMA,
		fetchImpl,
	);
	const prompt = typeof writerResult?.data.prompt === "string" ? writerResult.data.prompt.trim() : "";
	if (writerResult?.finishReason === "length") {
		logDrop(subject.subjectId, entry.entryId, "writer_truncated", writerResult.rawSnippet);
		return null;
	}
	if (!prompt) {
		logDrop(subject.subjectId, entry.entryId, "writer_shape", writerResult?.rawSnippet);
		return null;
	}
	if (!promptClaimsAllowed(prompt, "", citation.quote, ready)) {
		logDrop(subject.subjectId, entry.entryId, "prompt_claims");
		return null;
	}

	const item = await buildItemForEntry(
		subject,
		ready,
		allEntries,
		undefined,
		fetchImpl,
		{ templatedFactPrompt: prompt },
	);
	if (!item) return null;

	const optionTexts = item.options
		.filter((o) => o.type === "text")
		.map((o) => (o as { text: string }).text);
	const judgeModel = defaultJudgeModel(subject);
	const ok = await judgeFactPick(judgeModel, prompt, ready.back, optionTexts, citation.quote, fetchImpl);
	if (!ok) {
		logDrop(subject.subjectId, entry.entryId, "judge_rejects");
		return null;
	}

	const chunk = passages.find((p) => p.sourceId === citation.sourceId) ?? passages[0];
	const source = cardSourceFromChunk(chunk, citation.url);
	return {
		...item,
		prompt: [{ type: "text", text: prompt }],
		explain: ready.explain?.trim() || undefined,
		...(source ? { source } : {}),
		citationSourceId: citation.sourceId,
	};
}

/** @deprecated identity items no longer use the writer; use ensureSourcedEntryReady + buildItemForEntry. */
export async function trySourcedItemForEntry(
	subject: PracticeSubject,
	entry: PracticeEntry,
	allEntries: PracticeEntry[],
	modelId: string | undefined,
	fetchImpl?: typeof fetch,
	opts?: { offline?: boolean },
): Promise<PracticeDailyItem | null> {
	return trySourcedFactPickItem(subject, entry, allEntries, modelId, fetchImpl, opts);
}

function logDrop(subjectId: string, entryId: string, reason: string, rawSnippet?: string): void {
	appendSourcedBuildLog({
		at: new Date().toISOString(),
		subjectId,
		entryId,
		reason,
		...(rawSnippet ? { rawSnippet } : {}),
	});
}
