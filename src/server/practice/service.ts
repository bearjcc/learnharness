import { dailyItemToPickCard, mixedCardStack } from "../../core/practice/cards.ts";
import type {
	PracticeAnswerEvent,
	PracticeEntry,
	PracticeImportEntry,
	PracticePickCard,
	PracticeSubject,
} from "../../core/practice/contracts.ts";
import { applyFsrsReview } from "../../core/practice/fsrs.ts";
import { isSandboxSubject } from "../../core/practice/sandbox.ts";
import { practiceStore } from "../../store/practice.ts";
import { extensionForContentType, resolveCommonsImage } from "../../practice/wikimedia.ts";
import { newEntryId } from "./daily-build.ts";
import { findDemoCard, loadDemoDeck, loadDemoSubject } from "../../practice/demo/load.ts";
import { DEMO_SUBJECT_ID } from "../../practice/demo/paths.ts";
import { mergeSubjectPresets } from "./subject-presets.ts";
import { penalizeSource } from "./sources/trust.ts";
import { appendFlagEvent } from "../../store/practice-sources.ts";

export interface RecordAnswerResult {
	ok: boolean;
	error?: string;
	sandbox?: boolean;
	correct?: boolean;
	undo?: boolean;
}

function mergeSubjects(subjects: PracticeSubject[]): PracticeSubject[] {
	const withPresets = mergeSubjectPresets(subjects);
	const demo = loadDemoSubject();
	if (withPresets.some((s) => s.subjectId === DEMO_SUBJECT_ID)) return withPresets;
	return [...withPresets, demo];
}

function subjectById(subjectId: string): PracticeSubject | undefined {
	return mergeSubjects(practiceStore.readSubjects()).find((s) => s.subjectId === subjectId);
}

export function listTodayCards(subjectFilter?: string): PracticePickCard[] {
	const subjects = mergeSubjects(practiceStore.readSubjects()).filter((s) => s.enabled);
	const today = new Date().toISOString().slice(0, 10);
	const bySubject = new Map<string, import("../../core/practice/contracts.ts").PracticeDailyItem[]>();

	if (subjectFilter) {
		const subject = subjectById(subjectFilter);
		if (subject && isSandboxSubject(subject)) {
			return loadDemoDeck().map(dailyItemToPickCard);
		}
	}

	for (const s of subjects) {
		if (isSandboxSubject(s)) continue;
		if (subjectFilter && s.subjectId !== subjectFilter) continue;
		if (s.dailyQueueDate !== today || !s.dailyQueue?.length) continue;
		bySubject.set(s.subjectId, s.dailyQueue);
	}
	const items = subjectFilter
		? bySubject.get(subjectFilter) ?? []
		: mixedCardStack(bySubject);
	return items.map(dailyItemToPickCard);
}

export function recordAnswer(body: PracticeAnswerEvent): RecordAnswerResult {
	const subject = subjectById(body.subject);
	if (body.flag === "bad" && !body.undo && !isSandboxSubject(subject)) {
		const events = practiceStore.readAnswerEvents();
		if (events.some((e) => e.event_id === body.event_id)) return { ok: true };
		practiceStore.appendAnswerEvent(body);
		const entryId = findEntryIdForCard(body.card_id, body.subject);
		const item = subject?.dailyQueue?.find((c) => c.id === body.card_id);
		if (item?.citationSourceId) penalizeSource(item.citationSourceId);
		appendFlagEvent({
			event_id: body.event_id,
			card_id: body.card_id,
			subject: body.subject,
			...(entryId ? { entry_id: entryId } : {}),
			...(item?.citationSourceId ? { source_id: item.citationSourceId } : {}),
			at: new Date().toISOString(),
		});
		if (entryId) {
			const entries = practiceStore.readEntries();
			const target = entries.find((e) => e.entryId === entryId && e.subjectId === body.subject);
			if (target) {
				target.status = "retired";
				practiceStore.writeEntries(entries);
			}
		}
		if (subject?.dailyQueue) {
			const subjects = practiceStore.readSubjects();
			const idx = subjects.findIndex((s) => s.subjectId === body.subject);
			if (idx >= 0) {
				const cur = subjects[idx]!;
				subjects[idx] = {
					...cur,
					dailyQueue: cur.dailyQueue?.filter((c) => c.id !== body.card_id),
				};
				practiceStore.writeSubjects(subjects);
			}
		}
		return { ok: true };
	}
	if (isSandboxSubject(subject)) {
		const card = findDemoCard(body.card_id);
		if (!card) return { ok: false, error: "unknown card" };
		if (body.undo) {
			return { ok: true, sandbox: true, undo: true };
		}
		const correct = body.picked === card.correctOptionId;
		return { ok: true, sandbox: true, correct };
	}

	const events = practiceStore.readAnswerEvents();
	if (events.some((e) => e.event_id === body.event_id)) return { ok: true };
	if (body.undo) {
		practiceStore.appendAnswerEvent(body);
		return { ok: true, undo: true };
	}
	practiceStore.appendAnswerEvent(body);
	const entries = practiceStore.readEntries();
	const cardEntryId = findEntryIdForCard(body.card_id, body.subject);
	const target = entries.find((e) => e.entryId === cardEntryId && e.subjectId === body.subject);
	if (target && body.correct !== undefined) {
		target.fsrs = applyFsrsReview(target, body.correct);
		practiceStore.writeEntries(entries);
	}
	return { ok: true, correct: body.correct };
}

function findEntryIdForCard(cardId: string, subjectId: string): string | undefined {
	const subject = subjectById(subjectId);
	if (isSandboxSubject(subject)) {
		return findDemoCard(cardId)?.entryId;
	}
	const item = subject?.dailyQueue?.find((c) => c.id === cardId);
	return item?.entryId;
}

export function listPendingEntries(subjectId?: string): PracticeEntry[] {
	return practiceStore
		.readEntries()
		.filter(
			(e) =>
				e.status === "pending" &&
				e.subjectId !== DEMO_SUBJECT_ID &&
				(!subjectId || e.subjectId === subjectId) &&
				!isSandboxSubject(subjectById(e.subjectId)),
		);
}

export function decideEntry(eventId: string, entryId: string, value: "keep" | "reject"): { ok: boolean } {
	const entries = practiceStore.readEntries();
	const entry = entries.find((e) => e.entryId === entryId);
	if (entry && isSandboxSubject(subjectById(entry.subjectId))) {
		return { ok: false };
	}
	const prior = practiceStore.readEntryDecisions();
	if (prior.some((e) => e.event_id === eventId)) return { ok: true };
	practiceStore.appendEntryDecision({ event_id: eventId, entry_id: entryId, value });
	const target = entries.find((e) => e.entryId === entryId);
	if (!target) return { ok: false };
	target.status = value === "keep" ? "confirmed" : "retired";
	practiceStore.writeEntries(entries);
	return { ok: true };
}

export async function importEntries(
	rows: PracticeImportEntry[],
	fetchImpl: typeof fetch = fetch,
): Promise<{ imported: number; skipped: number }> {
	const entries = practiceStore.readEntries();
	let imported = 0;
	let skipped = 0;
	for (const row of rows) {
		if (row.subjectId === DEMO_SUBJECT_ID) {
			skipped++;
			continue;
		}
		const entryId = row.entryId ?? newEntryId();
		if (entries.some((e) => e.entryId === entryId)) {
			skipped++;
			continue;
		}
		let media = row.media;
		let origin = row.commons
			? { kind: "commons" as const, pageTitle: row.commons.pageTitle }
			: { kind: "import" as const };
		if (row.commons) {
			const resolved = await resolveCommonsImage(row.commons.pageTitle, fetchImpl);
			if (!resolved) {
				skipped++;
				continue;
			}
			const ext = extensionForContentType(resolved.contentType);
			const token = `${entryId}.${ext}`;
			practiceStore.writeMedia(token, resolved.bytes);
			media = {
				kind: ext === "svg" ? "svg" : ext === "png" ? "png" : ext === "webp" ? "webp" : "jpg",
				ref: token,
				attribution: {
					sourceUrl: resolved.sourceUrl,
					...(resolved.author ? { author: resolved.author } : {}),
					...(resolved.license ? { license: resolved.license } : {}),
				},
			};
		}
		const subj = mergeSubjects(practiceStore.readSubjects()).find((s) => s.subjectId === row.subjectId);
		const topicOnly = Boolean(subj?.sources?.length && subj.requireReview !== true && !row.back?.trim());
		entries.push({
			subjectId: row.subjectId,
			entryId,
			type: row.type,
			front: row.front,
			back: row.back,
			...(topicOnly ? { topicOnly: true } : {}),
			...(row.aliases ? { aliases: row.aliases } : {}),
			...(row.tags ? { tags: row.tags } : {}),
			...(media ? { media } : {}),
			...(row.variants ? { variants: row.variants } : {}),
			origin,
			status: "pending",
		});
		imported++;
	}
	practiceStore.writeEntries(entries);
	return { imported, skipped };
}

export function upsertSubject(subject: PracticeSubject): void {
	if (subject.subjectId === DEMO_SUBJECT_ID) return;
	const subjects = practiceStore.readSubjects().filter((s) => s.subjectId !== DEMO_SUBJECT_ID);
	const idx = subjects.findIndex((s) => s.subjectId === subject.subjectId);
	if (idx >= 0) subjects[idx] = subject;
	else subjects.push(subject);
	practiceStore.writeSubjects(subjects);
}

export function readSubjects(): PracticeSubject[] {
	return mergeSubjects(practiceStore.readSubjects());
}

export function mediaResponse(token: string): { bytes: Buffer; contentType: string } | null {
	return practiceStore.readMedia(token);
}
