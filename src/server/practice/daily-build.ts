import { fsrsDue } from "../../core/practice/fsrs.ts";
import { isSandboxSubject } from "../../core/practice/sandbox.ts";
import type { PracticeEntry, PracticeSubject } from "../../core/practice/contracts.ts";
import { practiceStore } from "../../store/practice.ts";
import { buildItemForEntry } from "./engine.ts";
import { withGpuBrokerLease } from "./gpu-broker.ts";
import { LocalInferenceHttpError } from "./local-complete.ts";
import { getGraph } from "../../core/graph.ts";
import { graphStore } from "../../store/graph.ts";
import { nanoid } from "nanoid";

export interface DailyBuildResult {
	subjectId: string;
	built: number;
	proposed: number;
	stopped503: boolean;
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function pickDueEntries(
	subject: PracticeSubject,
	entries: PracticeEntry[],
	limit: number,
): PracticeEntry[] {
	const forSubject = entries.filter((e) => e.subjectId === subject.subjectId);
	const topics = forSubject.filter((e) => e.status === "pending" && e.topicOnly);
	const confirmed = forSubject.filter((e) => e.status === "confirmed");
	const due = confirmed.filter((e) => fsrsDue(e));
	const rest = confirmed.filter((e) => !fsrsDue(e));
	const ordered = subject.sources?.length
		? [...topics, ...due, ...rest]
		: [...due, ...rest];
	return ordered.slice(0, limit);
}

async function proposeGraphEntries(subject: PracticeSubject, entries: PracticeEntry[], max = 10): Promise<number> {
	const graph = getGraph(graphStore);
	const existingProps = new Set(
		entries.filter((e) => e.subjectId === subject.subjectId && e.propositionId).map((e) => e.propositionId!),
	);
	let added = 0;
	for (const node of graph.nodes) {
		if (added >= max) break;
		if (existingProps.has(node.id)) continue;
		const tags = [subject.subjectId];
		entries.push({
			subjectId: subject.subjectId,
			entryId: `graph_${node.id}`,
			type: "fact",
			front: node.name,
			back: node.statement,
			tags,
			origin: { kind: "graph", propositionId: node.id },
			propositionId: node.id,
			status: "pending",
		});
		added++;
	}
	if (added) practiceStore.writeEntries(entries);
	return added;
}

async function buildSubjectQueue(
	subject: PracticeSubject,
	modelId?: string,
	fetchImpl?: typeof fetch,
): Promise<DailyBuildResult> {
	const allEntries = practiceStore.readEntries();
	const candidates = pickDueEntries(subject, allEntries, subject.dailyCards * 2);
	const built: import("../../core/practice/contracts.ts").PracticeDailyItem[] = [];
	for (const entry of candidates) {
		if (built.length >= subject.dailyCards) break;
		try {
			const item = await buildItemForEntry(subject, entry, allEntries, modelId, fetchImpl);
			if (item) built.push(item);
		} catch (err) {
			if (err instanceof LocalInferenceHttpError && err.status === 503) {
				return { subjectId: subject.subjectId, built: built.length, proposed: 0, stopped503: true };
			}
		}
	}
	const subjects = practiceStore.readSubjects();
	const idx = subjects.findIndex((s) => s.subjectId === subject.subjectId);
	if (idx >= 0) {
		const current = subjects[idx]!;
		subjects[idx] = {
			...current,
			dailyQueue: built,
			dailyQueueDate: todayIso(),
		};
		practiceStore.writeSubjects(subjects);
	}
	const proposed = await proposeGraphEntries(subject, allEntries);
	return { subjectId: subject.subjectId, built: built.length, proposed, stopped503: false };
}

export async function runDailyBuildForSubject(
	subject: PracticeSubject,
	modelId?: string,
	fetchImpl?: typeof fetch,
): Promise<DailyBuildResult> {
	return buildSubjectQueue(subject, modelId, fetchImpl);
}

export async function runDailyBuildAll(modelId?: string, fetchImpl?: typeof fetch): Promise<DailyBuildResult[]> {
	const subjects = practiceStore.readSubjects().filter((s) => s.enabled && !isSandboxSubject(s));
	const results: DailyBuildResult[] = [];
	const wrapped = await withGpuBrokerLease(async () => {
		for (const subject of subjects) {
			const r = await buildSubjectQueue(subject, modelId, fetchImpl);
			results.push(r);
			if (r.stopped503) break;
		}
	}, fetchImpl);
	return wrapped.result ?? results;
}

export function newEntryId(): string {
	return `e_${nanoid(10)}`;
}
