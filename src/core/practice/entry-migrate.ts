import type { PracticeEntry } from "./contracts.ts";

/** One-time shape fixes for entries on disk (non-destructive). */
export function migratePracticeEntries(entries: PracticeEntry[]): PracticeEntry[] {
	return entries.map((e) => {
		if (e.status === "pending" && !e.citation && !e.topicOnly) {
			return { ...e, topicOnly: true };
		}
		return e;
	});
}
