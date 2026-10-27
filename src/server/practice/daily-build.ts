import { fsrsDue } from "../../core/practice/fsrs.ts";
import { isSandboxSubject } from "../../core/practice/sandbox.ts";
import type { PracticeDailyItem, PracticeEntry, PracticeSubject } from "../../core/practice/contracts.ts";
import { practiceStore } from "../../store/practice.ts";
import { buildItemForEntry } from "./engine.ts";
import { withGpuBrokerLease } from "./gpu-broker.ts";
import { LocalInferenceHttpError } from "./local-complete.ts";
import { getGraph } from "../../core/graph.ts";
import { graphStore } from "../../store/graph.ts";
import { mergeSubjectPresets } from "./subject-presets.ts";
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

function buildBudgetMs(): number {
	const raw = Number(process.env.LH_PRACTICE_BUILD_BUDGET_MS);
	return Number.isFinite(raw) && raw > 0 ? raw : 20 * 60_000;
}

export function pickDueEntries(
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

function persistSubjectQueue(subject: PracticeSubject, built: PracticeDailyItem[]): void {
	const subjects = practiceStore.readSubjects();
	const idx = subjects.findIndex((s) => s.subjectId === subject.subjectId);
	if (idx < 0) return;
	subjects[idx] = {
		...subjects[idx]!,
		dailyQueue: built,
		dailyQueueDate: todayIso(),
	};
	practiceStore.writeSubjects(subjects);
}

async function buildSubjectQueue(
	subject: PracticeSubject,
	modelId?: string,
	fetchImpl?: typeof fetch,
): Promise<DailyBuildResult> {
	const allEntries = practiceStore.readEntries();
	const candidates = pickDueEntries(subject, allEntries, subject.dailyCards * 2);
	const built: PracticeDailyItem[] = [];
	for (const entry of candidates) {
		if (built.length >= subject.dailyCards) break;
		try {
			const item = await buildItemForEntry(subject, entry, practiceStore.readEntries(), modelId, fetchImpl);
			if (item) built.push(item);
		} catch (err) {
			if (err instanceof LocalInferenceHttpError && err.status === 503) {
				return { subjectId: subject.subjectId, built: built.length, proposed: 0, stopped503: true };
			}
		}
	}
	persistSubjectQueue(subject, built);
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
	const subjects = mergeSubjectPresets(practiceStore.readSubjects()).filter(
		(s) => s.enabled && !isSandboxSubject(s),
	);
	const results: DailyBuildResult[] = subjects.map((s) => ({
		subjectId: s.subjectId,
		built: 0,
		proposed: 0,
		stopped503: false,
	}));
	const resultById = new Map(results.map((r) => [r.subjectId, r]));

	interface Slot {
		subject: PracticeSubject;
		candidates: PracticeEntry[];
		cursor: number;
		built: PracticeDailyItem[];
	}

	const slots: Slot[] = subjects.map((subject) => ({
		subject,
		candidates: pickDueEntries(subject, practiceStore.readEntries(), subject.dailyCards * 3),
		cursor: 0,
		built: [],
	}));

	const deadline = Date.now() + buildBudgetMs();
	let stopped503 = false;

	const wrapped = await withGpuBrokerLease(async () => {
		while (Date.now() < deadline && !stopped503) {
			let progressed = false;
			for (const slot of slots) {
				if (slot.built.length >= slot.subject.dailyCards) continue;
				while (slot.cursor < slot.candidates.length && slot.built.length < slot.subject.dailyCards) {
					const entry = slot.candidates[slot.cursor++]!;
					try {
						const item = await buildItemForEntry(
							slot.subject,
							entry,
							practiceStore.readEntries(),
							modelId,
							fetchImpl,
						);
						if (item) {
							slot.built.push(item);
							progressed = true;
							break;
						}
					} catch (err) {
						if (err instanceof LocalInferenceHttpError && err.status === 503) {
							stopped503 = true;
							break;
						}
					}
				}
			}
			const allAtCap = slots.every((s) => s.built.length >= s.subject.dailyCards);
			const allExhausted = slots.every(
				(s) => s.built.length >= s.subject.dailyCards || s.cursor >= s.candidates.length,
			);
			if (!progressed && (allAtCap || allExhausted)) break;
		}

		for (const slot of slots) {
			persistSubjectQueue(slot.subject, slot.built);
			const r = resultById.get(slot.subject.subjectId)!;
			r.built = slot.built.length;
			r.stopped503 = stopped503;
			r.proposed = await proposeGraphEntries(slot.subject, practiceStore.readEntries());
		}
	}, fetchImpl);

	return wrapped.result ?? results;
}

export function newEntryId(): string {
	return `e_${nanoid(10)}`;
}
