import type { PracticeSubject } from "../../core/practice/contracts.ts";
import { practiceStore } from "../../store/practice.ts";
import { mergeSubjectPresets } from "./subject-presets.ts";
import { verifyEntryIdentity } from "./entry-verify.ts";
import { logVerifyEvent } from "./verify-log.ts";

export interface ReverifySubjectResult {
	subjectId: string;
	attempted: number;
	confirmed: number;
	updated: number;
	failed: number;
	reasons: Record<string, number>;
}

export async function reverifySubjectEntries(
	subjectId: string,
	fetchImpl: typeof fetch = fetch,
): Promise<ReverifySubjectResult> {
	const subjects = mergeSubjectPresets(practiceStore.readSubjects());
	const subject = subjects.find((s) => s.subjectId === subjectId);
	if (!subject) {
		throw new Error(`unknown subject: ${subjectId}`);
	}
	const entries = practiceStore.readEntries().filter((e) => e.subjectId === subjectId);
	const reasons: Record<string, number> = {};
	let confirmed = 0;
	let updated = 0;
	let failed = 0;

	for (const entry of entries) {
		if (entry.status === "retired") continue;
		const before = JSON.stringify(entry.citation);
		const result = await verifyEntryIdentity(subject, entry, fetchImpl, { force: true });
		reasons[result.reason] = (reasons[result.reason] ?? 0) + 1;
		if (result.entry?.status === "confirmed") {
			confirmed++;
			if (JSON.stringify(result.entry.citation) !== before) updated++;
		} else {
			failed++;
		}
	}

	logVerifyEvent(subjectId, "*", "reverify_batch_complete", {
		attempted: entries.length,
		confirmed,
		updated,
		failed,
	});

	return {
		subjectId,
		attempted: entries.length,
		confirmed,
		updated,
		failed,
		reasons,
	};
}
