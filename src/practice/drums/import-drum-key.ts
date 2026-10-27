import type { PracticeEntry } from "../../core/practice/contracts.ts";
import { renderGrooveAbcToSvg } from "../groove-render.ts";
import { practiceStore } from "../../store/practice.ts";
import {
	DRUM_KEY_VOICES,
	drumKeyMediaToken,
	readDrumKeyAbc,
} from "./key-library.ts";

export const DRUM_NOTE_VARIANT = "drum-note";

export interface ImportDrumKeyOptions {
	subjectId: string;
	replace?: boolean;
}

export function importDrumKey(options: ImportDrumKeyOptions): {
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

	for (const def of DRUM_KEY_VOICES) {
		const entryId = `drumkey_${def.id}`;
		const key = `${subjectId}:${entryId}`;
		const abc = readDrumKeyAbc(def);
		const token = drumKeyMediaToken(def.id);
		const svg = renderGrooveAbcToSvg(abc, 160);
		practiceStore.writeMedia(token, Buffer.from(svg, "utf-8"));

		const explain = [def.explain, def.notationNote].filter(Boolean).join(" ");
		const row: PracticeEntry = {
			subjectId,
			entryId,
			type: "visual",
			front: def.name,
			back: def.name,
			aliases: def.aliases.length ? def.aliases : undefined,
			group: def.group,
			identityScope: "entry",
			level: 1,
			explain,
			tags: ["drums", "drum-key", `staff-pos:${def.staffPos}`],
			variants: {
				[DRUM_NOTE_VARIANT]: { kind: "svg", ref: token },
			},
			origin: { kind: "import" },
			status: "confirmed",
			topicOnly: false,
			citation: {
				sourceId: "drum-key-lib",
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
