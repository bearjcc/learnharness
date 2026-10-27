import type { PracticeEntry } from "../../core/practice/contracts.ts";
import { practiceStore } from "../../store/practice.ts";
import {
	CURATED_GROOVE_LIBRARY,
	grooveLibraryByEntryId,
	readGrooveAbc,
} from "./library.ts";

export interface ImportGrooveLibraryOptions {
	subjectId: string;
	/** Replace existing curated groove rows (same groove_* id). */
	replace?: boolean;
}

export function importGrooveLibrary(options: ImportGrooveLibraryOptions): {
	imported: number;
	updated: number;
	skipped: number;
} {
	const { subjectId, replace = true } = options;
	const entries = practiceStore.readEntries();
	const byId = new Map(entries.map((e) => [`${e.subjectId}:${e.entryId}`, e]));
	let imported = 0;
	let updated = 0;
	let skipped = 0;

	for (const def of CURATED_GROOVE_LIBRARY) {
		const entryId = `groove_${def.id}`;
		const key = `${subjectId}:${entryId}`;
		const abc = readGrooveAbc(def);
		const row: PracticeEntry = {
			subjectId,
			entryId,
			type: "groove",
			front: def.name,
			back: abc,
			aliases: def.aliases.length ? def.aliases : undefined,
			group: def.group,
			identityScope: "entry",
			explain: def.explain,
			tags: ["drums", "curated-groove"],
			origin: { kind: "import" },
			status: "confirmed",
			topicOnly: false,
			citation: {
				sourceId: "grooves-lib",
				url: def.citation.url,
				quote: def.citation.quote,
			},
		};
		if (byId.has(key)) {
			if (!replace) {
				skipped++;
				continue;
			}
			const idx = entries.findIndex((e) => e.subjectId === subjectId && e.entryId === entryId);
			if (idx >= 0) {
				entries[idx] = row;
				updated++;
			}
		} else {
			entries.push(row);
			imported++;
		}
	}

	practiceStore.writeEntries(entries);
	return { imported, updated, skipped };
}

export function isCuratedGrooveEntry(entry: PracticeEntry): boolean {
	return entry.type === "groove" && Boolean(grooveLibraryByEntryId(entry.entryId));
}
