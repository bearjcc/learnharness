import type {
	PracticeDailyItem,
	PracticeEntry,
	PracticeSubject,
} from "../../core/practice/contracts.ts";
import { isTopicHintEntry } from "../../core/practice/topic-hint.ts";
import { quoteAppearsInChunks, parseJudgeYesNo } from "../../core/practice/sources/verify.ts";
import { practiceStore } from "../../store/practice.ts";
import { appendSourcedBuildLog } from "../../store/practice-sources.ts";
import { completeLocalJson } from "./local-complete.ts";
import { buildItemForEntry } from "./engine.ts";
import { ensureSubjectSourcesCached } from "./sources/ingest.ts";
import { retrievePassages } from "./sources/retrieve.ts";
import type { SourceChunkRecord } from "../../store/practice-sources.ts";

const WRITER_SCHEMA = {
	type: "object",
	properties: {
		prompt: { type: "string" },
		answer: { type: "string" },
		explain: { type: "string" },
		citation: {
			type: "object",
			properties: {
				sourceId: { type: "string" },
				url: { type: "string" },
				quote: { type: "string" },
			},
			required: ["sourceId", "quote"],
			additionalProperties: false,
		},
	},
	required: ["prompt", "answer", "citation"],
	additionalProperties: false,
} as const;

export function subjectUsesSourcing(subject: PracticeSubject): boolean {
	return Boolean(subject.sources?.length) && subject.requireReview !== true;
}

async function judgeSupports(
	modelId: string,
	answer: string,
	quote: string,
	fetchImpl?: typeof fetch,
): Promise<boolean> {
	const parsed = await completeLocalJson(
		modelId,
		[
			{
				role: "system",
				content:
					"You verify quiz citations. Reply with JSON {\"verdict\":\"yes\"} only if the quote directly supports the answer; otherwise {\"verdict\":\"no\"}.",
			},
			{
				role: "user",
				content: `Answer: ${answer}\nQuote: ${quote}`,
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

export async function trySourcedItemForEntry(
	subject: PracticeSubject,
	entry: PracticeEntry,
	allEntries: PracticeEntry[],
	modelId: string | undefined,
	fetchImpl?: typeof fetch,
	opts?: { offline?: boolean },
): Promise<PracticeDailyItem | null> {
	if (!subjectUsesSourcing(subject) || !subject.sources?.length) return null;
	if (!modelId && process.env.LH_PRACTICE_SKIP_LLM !== "1") return null;
	if (!isTopicHintEntry(entry) && entry.status === "confirmed" && entry.back.trim()) {
		return null;
	}

	try {
		await ensureSubjectSourcesCached(subject.sources, fetchImpl ?? fetch, opts);
	} catch {
		return null;
	}

	const topic = entry.front.trim();
	const passages = retrievePassages(topic, subject.sources, 6);
	if (!passages.length) {
		logDrop(subject.subjectId, entry.entryId, "no_passages");
		return null;
	}

	const context = passages.map((p, i) => `[${i + 1}] (${p.sourceId}) ${p.url}\n${p.text}`).join("\n\n");
	const parsed = await completeLocalJson(
		modelId!,
		[
			{
				role: "system",
				content:
					"Write one quiz item using ONLY the provided sources. Return prompt, answer, short explain, and a citation with an exact verbatim quote from one passage.",
			},
			{
				role: "user",
				content: `Topic: ${topic}\nEntry type: ${entry.type}\n\nSources:\n${context}`,
			},
		],
		WRITER_SCHEMA,
		fetchImpl,
	);
	if (!parsed || typeof parsed.answer !== "string" || !parsed.citation || typeof parsed.citation.quote !== "string") {
		logDrop(subject.subjectId, entry.entryId, "writer_shape");
		return null;
	}

	const citation = parsed.citation as { sourceId: string; url?: string; quote: string };
	const usedChunks = passages.filter((p) => p.sourceId === citation.sourceId);
	if (!quoteAppearsInChunks(citation.quote, usedChunks.length ? usedChunks : passages)) {
		logDrop(subject.subjectId, entry.entryId, "quote_missing");
		return null;
	}

	const judgeModel = subject.judgeModel ?? modelId!;
	const ok = await judgeSupports(judgeModel, parsed.answer, citation.quote, fetchImpl);
	if (!ok) {
		logDrop(subject.subjectId, entry.entryId, "judge_no");
		return null;
	}

	const entries = practiceStore.readEntries();
	const idx = entries.findIndex((e) => e.entryId === entry.entryId && e.subjectId === entry.subjectId);
	if (idx < 0) return null;
	const updated: PracticeEntry = {
		...entries[idx]!,
		back: parsed.answer.trim(),
		status: "confirmed",
		topicOnly: false,
		citation: {
			sourceId: citation.sourceId,
			...(citation.url ? { url: citation.url } : {}),
			quote: citation.quote,
		},
	};
	entries[idx] = updated;
	practiceStore.writeEntries(entries);

	const item = await buildItemForEntry(subject, updated, allEntries, modelId, fetchImpl, {});
	if (!item) return null;

	const chunk = passages.find((p) => p.sourceId === citation.sourceId) ?? passages[0];
	const source = cardSourceFromChunk(chunk, citation.url);
	return {
		...item,
		explain: typeof parsed.explain === "string" ? parsed.explain : item.explain,
		...(source ? { source } : {}),
		citationSourceId: citation.sourceId,
	};
}

function logDrop(subjectId: string, entryId: string, reason: string): void {
	appendSourcedBuildLog({ at: new Date().toISOString(), subjectId, entryId, reason });
}
