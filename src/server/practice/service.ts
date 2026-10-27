import { dailyItemToPickCard, mixedCardStack } from "../../core/practice/cards.ts";
import type {
	PracticeAnswerEvent,
	PracticeEntry,
	PracticeImportEntry,
	PracticePickCard,
	PracticeSubject,
} from "../../core/practice/contracts.ts";
import { applyFsrsReview } from "../../core/practice/fsrs.ts";
import { practiceStore } from "../../store/practice.ts";
import { extensionForContentType, resolveCommonsImage } from "../../practice/wikimedia.ts";
import { newEntryId } from "./daily-build.ts";
import { nanoid } from "nanoid";

export function listTodayCards(subjectFilter?: string): PracticePickCard[] {
	const subjects = practiceStore.readSubjects().filter((s) => s.enabled);
	const today = new Date().toISOString().slice(0, 10);
	const bySubject = new Map<string, import("../../core/practice/contracts.ts").PracticeDailyItem[]>();
	for (const s of subjects) {
		if (subjectFilter && s.subjectId !== subjectFilter) continue;
		if (s.dailyQueueDate !== today || !s.dailyQueue?.length) continue;
		bySubject.set(s.subjectId, s.dailyQueue);
	}
	const items = subjectFilter
		? bySubject.get(subjectFilter) ?? []
		: mixedCardStack(bySubject);
	return items.map(dailyItemToPickCard);
}

export function recordAnswer(body: PracticeAnswerEvent): { ok: boolean; error?: string } {
	const events = practiceStore.readAnswerEvents();
	if (events.some((e) => e.event_id === body.event_id)) return { ok: true };
	if (body.undo) {
		practiceStore.appendAnswerEvent(body);
		return { ok: true };
	}
	practiceStore.appendAnswerEvent(body);
	const entries = practiceStore.readEntries();
	const entry = entries.find((e) => e.subjectId === body.subject && e.entryId === body.card_id.split("_")[0]);
	// card id is card_xxx; map via daily queue — store entryId on item
	const cardEntryId = findEntryIdForCard(body.card_id, body.subject);
	const target = entries.find((e) => e.entryId === cardEntryId && e.subjectId === body.subject);
	if (target && body.correct !== undefined) {
		target.fsrs = applyFsrsReview(target, body.correct);
		practiceStore.writeEntries(entries);
	}
	return { ok: true };
}

function findEntryIdForCard(cardId: string, subjectId: string): string | undefined {
	const subject = practiceStore.readSubjects().find((s) => s.subjectId === subjectId);
	const item = subject?.dailyQueue?.find((c) => c.id === cardId);
	return item?.entryId;
}

export function listPendingEntries(subjectId?: string): PracticeEntry[] {
	return practiceStore
		.readEntries()
		.filter((e) => e.status === "pending" && (!subjectId || e.subjectId === subjectId));
}

export function decideEntry(eventId: string, entryId: string, value: "keep" | "reject"): { ok: boolean } {
	const prior = practiceStore.readEntryDecisions();
	if (prior.some((e) => e.event_id === eventId)) return { ok: true };
	practiceStore.appendEntryDecision({ event_id: eventId, entry_id: entryId, value });
	const entries = practiceStore.readEntries();
	const entry = entries.find((e) => e.entryId === entryId);
	if (!entry) return { ok: false };
	entry.status = value === "keep" ? "confirmed" : "retired";
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
		entries.push({
			subjectId: row.subjectId,
			entryId,
			type: row.type,
			front: row.front,
			back: row.back,
			...(row.aliases ? { aliases: row.aliases } : {}),
			...(row.tags ? { tags: row.tags } : {}),
			...(media ? { media } : {}),
			origin,
			status: "pending",
		});
		imported++;
	}
	practiceStore.writeEntries(entries);
	return { imported, skipped };
}

export function upsertSubject(subject: PracticeSubject): void {
	const subjects = practiceStore.readSubjects();
	const idx = subjects.findIndex((s) => s.subjectId === subject.subjectId);
	if (idx >= 0) subjects[idx] = subject;
	else subjects.push(subject);
	practiceStore.writeSubjects(subjects);
}

export function readSubjects(): PracticeSubject[] {
	return practiceStore.readSubjects();
}

export function mediaResponse(token: string): { bytes: Buffer; contentType: string } | null {
	return practiceStore.readMedia(token);
}
