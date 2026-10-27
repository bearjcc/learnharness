import type { PracticeEntry } from "../../core/practice/contracts.ts";
import { practiceStore } from "../../store/practice.ts";
import { extensionForContentType, resolveCommonsImage } from "../wikimedia.ts";
import { PACIFIC_FLAG_ENTRIES } from "./pacific.ts";

export interface ImportPacificFlagsOptions {
	subjectId: string;
	status?: PracticeEntry["status"];
}

export async function importPacificFlags(
	options: ImportPacificFlagsOptions,
	fetchImpl: typeof fetch = fetch,
): Promise<{ imported: number; skipped: number }> {
	const { subjectId, status = "pending" } = options;
	const entries = practiceStore.readEntries();
	const existing = new Set(entries.filter((e) => e.subjectId === subjectId).map((e) => e.entryId));
	let imported = 0;
	let skipped = 0;

	for (const row of PACIFIC_FLAG_ENTRIES) {
		const entryId = `flag_${row.iso}`;
		if (existing.has(entryId)) {
			skipped++;
			continue;
		}
		const resolved = await resolveCommonsImage(`File:${row.commons}`, fetchImpl);
		if (!resolved) {
			skipped++;
			continue;
		}
		const ext = extensionForContentType(resolved.contentType);
		const token = `${entryId}.${ext}`;
		practiceStore.writeMedia(token, resolved.bytes);
		entries.push({
			subjectId,
			entryId,
			type: "visual",
			front: row.name,
			back: "",
			tags: [`flag-iso:${row.iso}`, "south-pacific", "flags"],
			variants: {
				flag: {
					kind: ext === "svg" ? "svg" : ext === "png" ? "png" : "jpg",
					ref: token,
					attribution: {
						sourceUrl: resolved.sourceUrl,
						...(resolved.author ? { author: resolved.author } : {}),
						...(resolved.license ? { license: resolved.license } : {}),
					},
				},
			},
			origin: { kind: "commons", pageTitle: row.commons },
			status,
			topicOnly: true,
		});
		imported++;
	}
	practiceStore.writeEntries(entries);
	return { imported, skipped };
}
