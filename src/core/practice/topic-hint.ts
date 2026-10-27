import type { PracticeEntry } from "./contracts.ts";

/** Unsourced pending rows are topics, not trusted answers. */
export function isTopicHintEntry(entry: PracticeEntry): boolean {
	if (entry.topicOnly) return true;
	if (entry.status === "pending" && !entry.citation) return true;
	return false;
}
