import { fsrsDue } from "../../core/practice/fsrs.ts";
import type { PracticeEntry, PracticeSubject } from "../../core/practice/contracts.ts";
import { practiceStore } from "../../store/practice.ts";
import { buildItemForEntry } from "./engine.ts";
import { acquireGpuLease, releaseGpuLease } from "./gpu-broker.ts";
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

function pickDueEntries(subjectId: string, entries: PracticeEntry[], limit: number): PracticeEntry[] {
	const confirmed = entries.filter((e) => e.subjectId === subjectId && e.status === "confirmed");
	const due = confirmed.filter((e) => fsrsDue(e));
	const rest = confirmed.filter((e) => !fsrsDue(e));
	return [...due, ...rest].slice(0, limit);
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

export async function runDailyBuildForSubject(
	subject: PracticeSubject,
	modelId?: string,
	fetchImpl?: typeof fetch,
): Promise<DailyBuildResult> {
	const lease = await acquireGpuLease(fetchImpl);
	if (lease === "503") {
		return { subjectId: subject.subjectId, built: 0, proposed: 0, stopped503: true };
	}
	try {
		const allEntries = practiceStore.readEntries();
		const candidates = pickDueEntries(subject.subjectId, allEntries, subject.dailyCards * 2);
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
				subjectId: current.subjectId,
				title: current.title,
				enabled: current.enabled,
				dailyCards: current.dailyCards,
				itemKinds: current.itemKinds,
				dailyQueue: built,
				dailyQueueDate: todayIso(),
			};
			practiceStore.writeSubjects(subjects);
		}
		const proposed = await proposeGraphEntries(subject, allEntries);
		return { subjectId: subject.subjectId, built: built.length, proposed, stopped503: false };
	} finally {
		await releaseGpuLease(lease, fetchImpl);
	}
}

export async function runDailyBuildAll(modelId?: string, fetchImpl?: typeof fetch): Promise<DailyBuildResult[]> {
	const subjects = practiceStore.readSubjects().filter((s) => s.enabled);
	const results: DailyBuildResult[] = [];
	for (const subject of subjects) {
		const r = await runDailyBuildForSubject(subject, modelId, fetchImpl);
		results.push(r);
		if (r.stopped503) break;
	}
	return results;
}

export function newEntryId(): string {
	return `e_${nanoid(10)}`;
}
